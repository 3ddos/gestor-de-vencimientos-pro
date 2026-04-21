import Database from 'better-sqlite3';
import path from 'path';

// Use SQLite for the preview environment as recommended
// In a real MySQL environment, you would use mysql2/promise
const dbPath = path.join(process.cwd(), 'database.sqlite');
export const db = new Database(dbPath);

// Initialize Schema
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'admin'
    );

    CREATE TABLE IF NOT EXISTS sub_sellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      responsible TEXT CHECK(responsible IN ('Gnomo', 'Leo')) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      
      FOREIGN KEY(sub_seller_id) REFERENCES sub_sellers(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      concept TEXT NOT NULL,
      FOREIGN KEY(client_id) REFERENCES clients(id)
    );
  `);

  // Simple seed if empty
  const userCount = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', '$2a$10$X86Z9k.hXG.h8G.h8G.h8OqQ7.h8OqQ7.h8OqQ7.h8OqQ7'); // password: admin
    
    // Seed sub_sellers
    db.prepare('INSERT INTO sub_sellers (name, responsible) VALUES (?, ?)').run('Vendedor 1', 'Gnomo');
    db.prepare('INSERT INTO sub_sellers (name, responsible) VALUES (?, ?)').run('Vendedor 2', 'Leo');

    // Seed some clients
    const now = new Date();
    const addDays = (d: number) => {
      const date = new Date(now);
      date.setDate(date.getDate() + d);
      return date.toISOString().split('T')[0];
    };

    db.prepare(`
      INSERT INTO clients (domain, sub_seller_id, client_email, client_phone, hosting_expiry, ssl_technical_expiry, ssl_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('google.com', 1, 'contact@google.com', '+123456789', addDays(5), addDays(8), 50.0);
    
    db.prepare(`
      INSERT INTO clients (domain, sub_seller_id, client_email, client_phone, hosting_expiry, ssl_technical_expiry, ssl_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('apple.com', 2, 'ceo@apple.com', '+987654321', addDays(15), addDays(25), 100.0);

    db.prepare(`
      INSERT INTO clients (domain, sub_seller_id, client_email, client_phone, hosting_expiry, ssl_technical_expiry, ssl_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('amazon.com', 1, 'jeff@amazon.com', '+1122334455', addDays(40), addDays(50), 120.0);
  }
}
