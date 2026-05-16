'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { runRefresh } = require('./jobs/refresh');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ───────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blokkert: ${origin}`));
  },
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-admin-token'],
}));

app.use(express.json());

// ─── Logging ─────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ─── Helsekontroll ───────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ─── Routes ──────────────────────────────────────────────
app.use('/api/search',   require('./routes/search'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/favorites',require('./routes/favorites'));

// ─── Database setup ──────────────────────────────────────
async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.query(schema);
  console.log('Database schema OK');
}

// ─── Cron: refresh hver 30. minutt ───────────────────────
// '*/30 * * * *' = hvert 30. minutt
cron.schedule('*/30 * * * *', async () => {
  console.log('Cron: starter planlagt refresh...');
  try {
    await runRefresh();
  } catch (err) {
    console.error('Cron refresh feilet:', err.message);
  }
});

// ─── Start ───────────────────────────────────────────────
async function start() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`\n⚓ Båtsøk backend kjører på port ${PORT}`);
      console.log(`   Refresh cron: hvert 30. minutt`);
      console.log(`   Helse: http://localhost:${PORT}/health\n`);
    });

    // Kjør første refresh etter 5 sekunder
    setTimeout(() => {
      console.log('Første refresh...');
      runRefresh().catch(console.error);
    }, 5000);
  } catch (err) {
    console.error('Oppstart feilet:', err);
    process.exit(1);
  }
}

start();
