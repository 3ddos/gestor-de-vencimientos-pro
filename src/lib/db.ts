import { Client } from 'pg';

export const db = new Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 6543,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function test(db) {
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

// Initialize Schema
export async function initDb() {
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
      
      -- Hosting
      hosting_expiry TEXT,
      hosting_price REAL,
      hosting_cycle INTEGER, -- in years
      
      -- SSL
      ssl_manual_90d INTEGER DEFAULT 0, -- boolean
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

  // Simple seed if empty
  const userCountRes = await db.query('SELECT count(*) as count FROM users');
  const userCount = parseInt(userCountRes.rows[0].count);

  if (userCount === 0) {
    await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', ['admin', '$2a$10$X86Z9k.hXG.h8G.h8G.h8OqQ7.h8OqQ7.h8OqQ7.h8OqQ7']); // password: admin

    // Seed sub_sellers
    await db.query('INSERT INTO sub_sellers (name, responsible) VALUES ($1, $2)', ['Vendedor 1', 'Gnomo']);
    await db.query('INSERT INTO sub_sellers (name, responsible) VALUES ($1, $2)', ['Vendedor 2', 'Leo']);

    // Seed some clients
    const now = new Date();
    const addDays = (d: number) => {
      const date = new Date(now);
      date.setDate(date.getDate() + d);
      return date.toISOString().split('T')[0];
    };

    await db.query(`
      INSERT INTO clients (domain, sub_seller_id, client_email, client_phone, hosting_expiry, ssl_technical_expiry, ssl_price)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, ['google.com', 1, 'contact@google.com', '+123456789', addDays(5), addDays(8), 50.0]);

    await db.query(`
      INSERT INTO clients (domain, sub_seller_id, client_email, client_phone, hosting_expiry, ssl_technical_expiry, ssl_price)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, ['apple.com', 2, 'ceo@apple.com', '+987654321', addDays(15), addDays(25), 100.0]);

    await db.query(`
      INSERT INTO clients (domain, sub_seller_id, client_email, client_phone, hosting_expiry, ssl_technical_expiry, ssl_price)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, ['amazon.com', 1, 'jeff@amazon.com', '+1122334455', addDays(40), addDays(50), 120.0]);
  }
}
