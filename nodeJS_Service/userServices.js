const http = require('http');
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
      last_active TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP`);

  const { rows } = await pool.query('SELECT COUNT(*) FROM users');
  if (Number(rows[0].count) === 0) {
    await pool.query(
      `INSERT INTO users (username) VALUES ('sinem'), ('reyhan'), ('valentin')`
    );
  }
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
      const { rows } = await pool.query('SELECT id, username, last_active FROM users ORDER BY id');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
      return;
    }

    if (req.method === 'POST' && req.url === '/users') {
      const body = await readBody(req);
      const { username } = JSON.parse(body);

      if (!username) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'username is required' }));
        return;
      }

      const { rows } = await pool.query(
        'INSERT INTO users (username) VALUES ($1) RETURNING id, username',
        [username]
      );
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows[0]));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
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
