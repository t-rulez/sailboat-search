'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ───────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blokkert: ${origin}`));
  },
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-admin-token'],
}));

app.use(express.json({ limit: '2mb' }));

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use('/api/search',    require('./routes/search'));
app.use('/api/finn',      require('./routes/finn'));
app.use('/api/blocket',   require('./routes/blocket'));
app.use('/api/listings',  require('./routes/listings'));
app.use('/api/favorites', require('./routes/favorites'));

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.query(schema);
  console.log('Database schema OK');
}

async function start() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`\n⚓ Båtsøk backend kjører på port ${PORT}\n`);
    });
  } catch (err) {
    console.error('Oppstart feilet:', err);
    process.exit(1);
  }
}

start();
