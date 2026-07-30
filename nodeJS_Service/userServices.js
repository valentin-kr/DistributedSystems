const http = require('http');
const crypto = require('crypto');
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');

const PORT = process.env.PORT || 3000;

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
      phone_number TEXT UNIQUE,
      zitadel_sub TEXT UNIQUE,
      last_active TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT UNIQUE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS zitadel_sub TEXT`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_zitadel_sub_key
    ON users (zitadel_sub)
    WHERE zitadel_sub IS NOT NULL
  `);
  await pool.query(`UPDATE users SET display_name = username WHERE display_name IS NULL`);
  await pool.query(`
    UPDATE users
    SET display_name = CASE phone_number
      WHEN '+490000000001' THEN 'Sinem'
      WHEN '+490000000002' THEN 'Reyhan Rumengan'
      WHEN '+490000000003' THEN 'Valentin'
      ELSE display_name
    END
    WHERE phone_number IN ('+490000000001', '+490000000002', '+490000000003')
      AND display_name = username
  `);

  const { rows } = await pool.query('SELECT COUNT(*) FROM users');
  if (Number(rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO users (username, display_name, phone_number) VALUES
        ('sinem', 'Sinem', '+490000000001'),
        ('reyhan', 'Reyhan Rumengan', '+490000000002'),
        ('valentin', 'Valentin', '+490000000003')
    `);
  }
}

// In-memory verification codes: phoneNumber -> { code, expiresAt }
// A real deployment would use an SMS gateway (Twilio, AWS SNS, ...) here instead
// of returning the code directly in the response.
const verificationCodes = new Map();
const CODE_TTL_MS = 5 * 60 * 1000;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,30}$/;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
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

function duplicateUserMessage(err) {
  if (err.constraint === 'users_username_key') {
    return 'username already exists';
  }
  if (err.constraint === 'users_zitadel_sub_key') {
    return 'zitadel profile is already linked';
  }
  if (err.constraint === 'users_phone_number_key') {
    return 'phone number already exists';
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

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/users') {
      const { rows } = await pool.query(
        'SELECT id, username, display_name, phone_number, last_active FROM users ORDER BY id'
      );
      sendJson(res, 200, rows);
      return;
    }

    if (req.method === 'POST' && req.url === '/users') {
      const body = await readBody(req);
      const { username, displayName, zitadelSub } = JSON.parse(body);

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
         RETURNING id, username, display_name, phone_number, zitadel_sub, last_active`,
        [username, displayName || username, zitadelSub || null]
      );
      sendJson(res, 201, rows[0]);
      return;
    }

    if (req.method === 'POST' && req.url === '/auth/request-code') {
      const body = await readBody(req);
      const { phoneNumber } = JSON.parse(body);

      if (!phoneNumber) {
        sendJson(res, 400, { error: 'phoneNumber is required' });
        return;
      }

      const code = generateCode();
      verificationCodes.set(phoneNumber, {
        code,
        expiresAt: Date.now() + CODE_TTL_MS,
      });
      const existing = await pool.query(
        'SELECT 1 FROM users WHERE phone_number = $1',
        [phoneNumber]
      );

      sendJson(res, 200, {
        message: 'Verification code generated',
        simulatedSms: true,
        code,
        isNewUser: existing.rows.length === 0,
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/auth/verify') {
      const body = await readBody(req);
      const { phoneNumber, code, displayName, username } = JSON.parse(body);

      const entry = verificationCodes.get(phoneNumber);
      if (!entry || entry.code !== code || Date.now() > entry.expiresAt) {
        sendJson(res, 401, { error: 'Invalid or expired verification code' });
        return;
      }
      verificationCodes.delete(phoneNumber);

      const existing = await pool.query(
        'SELECT id, username, display_name, phone_number FROM users WHERE phone_number = $1',
        [phoneNumber]
      );

      let user;
      if (existing.rows.length) {
        user = existing.rows[0];
      } else {
        const nextDisplayName = (displayName || username || '').trim();
        if (!nextDisplayName) {
          sendJson(res, 400, { error: 'displayName is required to sign up' });
          return;
        }
        const nextUsername = isValidUsername(username)
          ? username
          : await createUniqueUsername(nextDisplayName);
        const inserted = await pool.query(
          `INSERT INTO users (username, display_name, phone_number)
           VALUES ($1, $2, $3)
           RETURNING id, username, display_name, phone_number`,
          [nextUsername, nextDisplayName, phoneNumber]
        );
        user = inserted.rows[0];
      }

      const token = crypto.randomBytes(16).toString('hex');
      sendJson(res, 200, { ...user, token });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
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
