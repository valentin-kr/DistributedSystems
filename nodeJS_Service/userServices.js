const http = require('http');
const crypto = require('crypto');
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');

const PORT = process.env.PORT || 3000;
const AUTH_REQUIRED = process.env.AUTH_REQUIRED === 'true';
const ZITADEL_ISSUER = (process.env.ZITADEL_ISSUER || '').replace(/\/$/, '');
const ZITADEL_AUDIENCE = process.env.ZITADEL_AUDIENCE || '';
const ZITADEL_JWKS_URI =
  process.env.ZITADEL_JWKS_URI ||
  (ZITADEL_ISSUER ? `${ZITADEL_ISSUER}/oauth/v2/keys` : '');
const ZITADEL_USERINFO_URI =
  process.env.ZITADEL_USERINFO_URI ||
  (ZITADEL_ISSUER ? `${ZITADEL_ISSUER}/oidc/v1/userinfo` : '');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'users',
});

const kafka = new Kafka({
  clientId: 'user-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: { retries: 20, initialRetryTime: 1000 },
});
const consumer = kafka.consumer({ groupId: 'user-service-group' });
const admin = kafka.admin();
let remoteJwks;

async function waitForDb(retries = 10, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      console.log(`Waiting for database... (${i + 1}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('Could not connect to database');
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT,
      zitadel_sub TEXT UNIQUE,
      last_active TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS zitadel_sub TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_zitadel_sub_key
    ON users (zitadel_sub)
    WHERE zitadel_sub IS NOT NULL
  `);
  await pool.query(`UPDATE users SET display_name = username WHERE display_name IS NULL`);
  await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS phone_number`);

  const { rows } = await pool.query('SELECT COUNT(*) FROM users');
  if (Number(rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO users (username, display_name) VALUES
        ('sinem', 'Sinem'),
        ('reyhan', 'Reyhan Rumengan'),
        ('valentin', 'Valentin')
    `);
  }
}

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,30}$/;

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function userColumns() {
  return 'id, username, display_name, zitadel_sub, last_active, created_at, updated_at';
}

function requestError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function authenticateBearer(req) {
  if (!ZITADEL_ISSUER || !ZITADEL_JWKS_URI) {
    throw requestError(503, 'Zitadel authentication is not configured');
  }

  const match = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw requestError(401, 'Bearer token is required');
  }

  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  remoteJwks ||= createRemoteJWKSet(new URL(ZITADEL_JWKS_URI));
  const options = { issuer: ZITADEL_ISSUER };
  if (ZITADEL_AUDIENCE) {
    options.audience = ZITADEL_AUDIENCE;
  }

  try {
    const { payload } = await jwtVerify(match[1], remoteJwks, options);
    if (!payload.sub) {
      throw requestError(401, 'Token subject is missing');
    }
    return { token: match[1], payload };
  } catch (err) {
    if (err.statusCode) throw err;
    throw requestError(401, 'Invalid or expired bearer token');
  }
}

async function loadZitadelUserInfo(token, expectedSubject) {
  if (!ZITADEL_USERINFO_URI) {
    throw requestError(503, 'Zitadel userinfo endpoint is not configured');
  }
  let response;
  try {
    response = await fetch(ZITADEL_USERINFO_URI, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw requestError(502, 'Could not reach Zitadel userinfo endpoint');
  }
  if (!response.ok) {
    throw requestError(502, 'Could not load Zitadel user profile');
  }
  const profile = await response.json();
  if (!profile.sub || profile.sub !== expectedSubject) {
    throw requestError(401, 'Zitadel profile subject does not match token');
  }
  return profile;
}

function isValidUsername(username) {
  return typeof username === 'string' && USERNAME_PATTERN.test(username);
}

function handleFromDisplayName(displayName) {
  const base = displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return base || `user-${crypto.randomBytes(3).toString('hex')}`;
}

async function createUniqueUsername(displayName) {
  const base = handleFromDisplayName(displayName);
  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const candidate = `${base.slice(0, 30 - suffix.length)}${suffix}`;
    const { rows } = await pool.query('SELECT 1 FROM users WHERE username = $1', [candidate]);
    if (rows.length === 0) {
      return candidate;
    }
  }
  return `${base.slice(0, 23)}-${crypto.randomBytes(3).toString('hex')}`;
}

async function bootstrapZitadelProfile(profile) {
  const displayName =
    String(
      profile.name ||
        [profile.given_name, profile.family_name].filter(Boolean).join(' ') ||
        profile.preferred_username ||
        `User ${profile.sub.slice(-6)}`
    ).trim();
  const existing = await pool.query(
    `SELECT ${userColumns()} FROM users WHERE zitadel_sub = $1`,
    [profile.sub]
  );
  if (existing.rows.length) {
    const { rows } = await pool.query(
      `UPDATE users
       SET display_name = $2,
           updated_at = NOW()
       WHERE zitadel_sub = $1
       RETURNING ${userColumns()}`,
      [profile.sub, displayName]
    );
    return rows[0];
  }

  const preferredUsername =
    typeof profile.preferred_username === 'string'
      ? profile.preferred_username
      : '';
  const username = isValidUsername(preferredUsername)
    ? preferredUsername
    : await createUniqueUsername(displayName);
  const { rows } = await pool.query(
    `INSERT INTO users (username, display_name, zitadel_sub)
     VALUES ($1, $2, $3)
     RETURNING ${userColumns()}`,
    [username, displayName, profile.sub]
  );
  return rows[0];
}

function duplicateUserMessage(err) {
  if (err.constraint === 'users_username_key') {
    return 'username already exists';
  }
  if (err.constraint === 'users_zitadel_sub_key') {
    return 'zitadel profile is already linked';
  }
  return 'user already exists';
}

async function startEventConsumer() {
  await admin.connect();
  await admin.createTopics({
    topics: [{ topic: 'message-events', numPartitions: 1, replicationFactor: 1 }],
    waitForLeaders: true,
  });
  await admin.disconnect();

  await consumer.connect();
  await consumer.subscribe({ topic: 'message-events', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        await pool.query('UPDATE users SET last_active = $1 WHERE id = $2', [
          event.timestamp,
          event.userId,
        ]);
        console.log(`Updated last_active for user ${event.userId} from message-events`);
      } catch (err) {
        console.error('Failed to process message-events event:', err);
      }
    },
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const body = await readBody(req);
  return body ? JSON.parse(body) : {};
}

function parseUserId(pathname) {
  const match = pathname.match(/^\/users\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const { pathname } = url;
    const userId = parseUserId(pathname);

    if (req.method === 'GET' && pathname === '/health') {
      sendJson(res, 200, {
        status: 'ok',
        service: 'user-service',
        authRequired: AUTH_REQUIRED,
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/auth/profile') {
      const identity = await authenticateBearer(req);
      const profile = await loadZitadelUserInfo(identity.token, identity.payload.sub);
      const user = await bootstrapZitadelProfile(profile);
      sendJson(res, 200, user);
      return;
    }

    if (AUTH_REQUIRED && (pathname === '/users' || userId !== null)) {
      await authenticateBearer(req);
    }

    if (req.method === 'GET' && pathname === '/users') {
      const { rows } = await pool.query(
        `SELECT ${userColumns()} FROM users ORDER BY id`
      );
      sendJson(res, 200, rows);
      return;
    }

    if (req.method === 'GET' && userId !== null) {
      const { rows } = await pool.query(`SELECT ${userColumns()} FROM users WHERE id = $1`, [userId]);
      if (rows.length === 0) {
        sendJson(res, 404, { error: 'user not found' });
        return;
      }
      sendJson(res, 200, rows[0]);
      return;
    }

    if (req.method === 'POST' && pathname === '/users') {
      const { username, displayName, zitadelSub } = await readJson(req);

      if (!username) {
        sendJson(res, 400, { error: 'username is required' });
        return;
      }
      if (!isValidUsername(username)) {
        sendJson(res, 400, {
          error: 'username must be 3-30 characters using letters, numbers, dot, underscore, or hyphen',
        });
        return;
      }

      const { rows } = await pool.query(
        `INSERT INTO users (username, display_name, zitadel_sub)
         VALUES ($1, $2, $3)
         RETURNING ${userColumns()}`,
        [username, displayName || username, zitadelSub || null]
      );
      sendJson(res, 201, rows[0]);
      return;
    }

    if (req.method === 'PATCH' && userId !== null) {
      const { username, displayName, zitadelSub } = await readJson(req);
      const updates = [];
      const values = [];

      if (username !== undefined) {
        if (!isValidUsername(username)) {
          sendJson(res, 400, {
            error: 'username must be 3-30 characters using letters, numbers, dot, underscore, or hyphen',
          });
          return;
        }
        values.push(username);
        updates.push(`username = $${values.length}`);
      }

      if (displayName !== undefined) {
        const nextDisplayName = String(displayName).trim();
        if (!nextDisplayName) {
          sendJson(res, 400, { error: 'displayName cannot be empty' });
          return;
        }
        values.push(nextDisplayName);
        updates.push(`display_name = $${values.length}`);
      }

      if (zitadelSub !== undefined) {
        values.push(zitadelSub || null);
        updates.push(`zitadel_sub = $${values.length}`);
      }

      if (updates.length === 0) {
        sendJson(res, 400, { error: 'at least one profile field is required' });
        return;
      }

      values.push(userId);
      const { rows } = await pool.query(
        `UPDATE users
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${values.length}
         RETURNING ${userColumns()}`,
        values
      );
      if (rows.length === 0) {
        sendJson(res, 404, { error: 'user not found' });
        return;
      }
      sendJson(res, 200, rows[0]);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    if (err.statusCode) {
      sendJson(res, err.statusCode, { error: err.message });
      return;
    }
    if (err instanceof SyntaxError) {
      sendJson(res, 400, { error: 'invalid JSON body' });
      return;
    }
    if (err.code === '23505') {
      sendJson(res, 409, { error: duplicateUserMessage(err) });
      return;
    }
    console.error(err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

waitForDb()
  .then(initDb)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`userServices listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });

startEventConsumer().catch((err) => {
  console.error('Failed to start Kafka consumer (HTTP API remains available):', err);
});
