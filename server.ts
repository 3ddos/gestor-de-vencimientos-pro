import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { differenceInDays, parseISO, isValid } from 'date-fns';
import { Client } from 'pg';

async function test(db: Client) {
  console.log(`\nTesting connection to Postgres database at ${process.env.DB_HOST}...`);
  try {
    const res = await db.query('SELECT NOW() AS current_time, version()');
    console.log('✅ Connection to Supabase Postgres successful!');
    console.log('Current Time:', res.rows[0].current_time);
    console.log('Postgres Version:', res.rows[0].version);
  } catch (err) {
    console.error('❌ Connection failed:', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

async function initDb(db: Client) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'admin'
    );
    CREATE TABLE IF NOT EXISTS sub_sellers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      responsible TEXT CHECK(responsible IN ('Gnomo', 'Leo')) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      domain TEXT NOT NULL,
      seller_id INTEGER,
      sub_seller_id INTEGER,
      client_email TEXT,
      client_phone TEXT,
      hosting_expiry TEXT,
      hosting_price REAL,
      hosting_cycle INTEGER,
      ssl_manual_90d INTEGER DEFAULT 0,
      ssl_technical_expiry TEXT,
      ssl_commercial_expiry TEXT,
      ssl_price REAL,
      CONSTRAINT fk_sub_seller FOREIGN KEY(sub_seller_id) REFERENCES sub_sellers(id)
    );
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      client_id INTEGER,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      concept TEXT NOT NULL,
      CONSTRAINT fk_client FOREIGN KEY(client_id) REFERENCES clients(id)
    );
  `);

  // Seed if empty — password is 'admin'
  const { rows } = await db.query('SELECT count(*) as count FROM users');
  if (parseInt(rows[0].count) === 0) {
    // Real bcrypt hash of 'admin'
    const adminHash = '$2b$10$aYyTBuDBrIH.qNYFYEwmB.jV2UOR6bydeKOe.TjeJvdHVicEDWS22';
    await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', ['admin', adminHash]);
    await db.query('INSERT INTO sub_sellers (name, responsible) VALUES ($1, $2)', ['Vendedor 1', 'Gnomo']);
    await db.query('INSERT INTO sub_sellers (name, responsible) VALUES ($1, $2)', ['Vendedor 2', 'Leo']);

    const now = new Date();
    const addDays = (d: number) => { const dt = new Date(now); dt.setDate(dt.getDate() + d); return dt.toISOString().split('T')[0]; };
    await db.query(`INSERT INTO clients (domain, sub_seller_id, client_email, client_phone, hosting_expiry, ssl_technical_expiry, ssl_price) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['google.com', 1, 'contact@google.com', '+123456789', addDays(5), addDays(8), 50.0]);
    await db.query(`INSERT INTO clients (domain, sub_seller_id, client_email, client_phone, hosting_expiry, ssl_technical_expiry, ssl_price) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['apple.com', 2, 'ceo@apple.com', '+987654321', addDays(15), addDays(25), 100.0]);
    await db.query(`INSERT INTO clients (domain, sub_seller_id, client_email, client_phone, hosting_expiry, ssl_technical_expiry, ssl_price) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['amazon.com', 1, 'jeff@amazon.com', '+1122334455', addDays(40), addDays(50), 120.0]);
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

const db = new Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  ssl: {
    rejectUnauthorized: false
  }
});

let isDbInitialized = false;

async function ensureDb() {
  if (!isDbInitialized) {
    await db.connect();
    await test(db);
    await initDb(db);
    isDbInitialized = true;
  }
}

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Middleware to ensure DB connection
app.use(async (req, res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err) {
    console.error('DB Connection error:', err);
    res.status(500).json({ error: 'Internal Server Error (DB)' });
  }
});

// --- Auth Middleware ---
const authenticateToken = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Access denied 2' });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token' });
  }
};

// --- API Routes ---

// Auth
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = result.rows[0];
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
  res.cookie('token', token, { httpOnly: true });
  res.json({ id: user.id, username: user.username });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

app.get('/api/me', authenticateToken, (req: any, res) => {
  res.json(req.user);
});

// Clients
app.get('/api/clients', authenticateToken, async (req, res) => {
  const result = await db.query(`
    SELECT c.*, s.name as sub_seller_name, s.responsible as responsible
    FROM clients c
    LEFT JOIN sub_sellers s ON c.sub_seller_id = s.id
  `);
  const clients = result.rows;

  // Add health status logic
  const clientsWithHealth = clients.map((c: any) => {
    const hExpiryStr = c.hosting_expiry ? String(c.hosting_expiry).replace(/\//g, '-') : null;
    const sExpiryStr = c.ssl_technical_expiry ? String(c.ssl_technical_expiry).replace(/\//g, '-') : null;

    const hExpiry = hExpiryStr ? parseISO(hExpiryStr) : null;
    const sExpiry = sExpiryStr ? parseISO(sExpiryStr) : null;

    const dates = [hExpiry, sExpiry].filter(d => d && isValid(d)) as Date[];
    if (dates.length === 0) return { ...c, health: 'green', daysRemaining: 999 };

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const days = differenceInDays(minDate, new Date());

    let health = 'green';
    if (days < 10) health = 'red';
    else if (days < 20) health = 'orange';

    return { ...c, health, daysRemaining: days };
  });

  // Sort by health (red -> orange -> green) and then by daysRemaining
  const sorted = clientsWithHealth.sort((a, b) => {
    const order = { red: 0, orange: 1, green: 2 };
    if (order[a.health as keyof typeof order] !== order[b.health as keyof typeof order]) {
      return order[a.health as keyof typeof order] - order[b.health as keyof typeof order];
    }
    return a.daysRemaining - b.daysRemaining;
  });

  res.json(sorted);
});

app.get('/api/clients/:id/payments', authenticateToken, async (req, res) => {
  const result = await db.query('SELECT * FROM payments WHERE client_id = $1 ORDER BY date DESC', [req.params.id]);
  res.json(result.rows);
});

app.post('/api/clients/:id/renew-ssl', authenticateToken, async (req, res) => {
  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + 90);
  await db.query('UPDATE clients SET ssl_technical_expiry = $1 WHERE id = $2', [newExpiry.toISOString().split('T')[0], req.params.id]);
  res.json({ success: true, newExpiry });
});

app.post('/api/clients/:id/record-payment', authenticateToken, async (req, res) => {
  const { amount, currency, concept } = req.body;
  const date = new Date().toISOString().split('T')[0];

  await db.query('INSERT INTO payments (client_id, date, amount, currency, concept) VALUES ($1, $2, $3, $4, $5)',
    [req.params.id, date, amount, currency, concept]);

  // Auto-renew hosting for 1 year if concept includes hosting
  if (concept.toLowerCase().includes('hosting')) {
    const result = await db.query('SELECT hosting_expiry FROM clients WHERE id = $1', [req.params.id]);
    const client = result.rows[0];

    let current = new Date();
    if (client?.hosting_expiry) {
      const normalized = String(client.hosting_expiry).replace(/\//g, '-');
      const parsed = parseISO(normalized);
      if (isValid(parsed)) {
        current = parsed;
      }
    }

    const next = new Date(current);
    next.setFullYear(next.getFullYear() + 1);

    if (isValid(next)) {
      await db.query('UPDATE clients SET hosting_expiry = $1 WHERE id = $2', [next.toISOString().split('T')[0], req.params.id]);
    }
  }

  res.json({ success: true });
});

// Sub-sellers
app.get('/api/sub-sellers', authenticateToken, async (req, res) => {
  const result = await db.query('SELECT * FROM sub_sellers');
  res.json(result.rows);
});

app.post('/api/sub-sellers', authenticateToken, async (req, res) => {
  const { name, responsible } = req.body;
  await db.query('INSERT INTO sub_sellers (name, responsible) VALUES ($1, $2)', [name, responsible]);
  res.json({ success: true });
});

// --- Vite / Static Files ---
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

export default app;

// Local startup
if (process.env.NODE_ENV !== 'production' || process.env.RENDER) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
