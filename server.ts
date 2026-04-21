import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, initDb } from './src/lib/db.ts';
import { differenceInDays, parseISO } from 'date-fns';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

async function startServer() {
  initDb();
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  // --- Auth Middleware ---
  const authenticateToken = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Access denied' });

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
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user: any = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

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
  app.get('/api/clients', authenticateToken, (req, res) => {
    const clients = db.prepare(`
      SELECT c.*, s.name as sub_seller_name, s.responsible as responsible
      FROM clients c
      LEFT JOIN sub_sellers s ON c.sub_seller_id = s.id
    `).all();

    // Add health status logic
    const clientsWithHealth = clients.map((c: any) => {
      const hExpiry = c.hosting_expiry ? parseISO(c.hosting_expiry) : null;
      const sExpiry = c.ssl_technical_expiry ? parseISO(c.ssl_technical_expiry) : null;
      
      const dates = [hExpiry, sExpiry].filter(Boolean) as Date[];
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

  app.get('/api/clients/:id/payments', authenticateToken, (req, res) => {
    const payments = db.prepare('SELECT * FROM payments WHERE client_id = ? ORDER BY date DESC').all(req.params.id);
    res.json(payments);
  });

  app.post('/api/clients/:id/renew-ssl', authenticateToken, (req, res) => {
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 90);
    db.prepare('UPDATE clients SET ssl_technical_expiry = ? WHERE id = ?').run(newExpiry.toISOString().split('T')[0], req.params.id);
    res.json({ success: true, newExpiry });
  });

  app.post('/api/clients/:id/record-payment', authenticateToken, (req, res) => {
    const { amount, currency, concept } = req.body;
    const date = new Date().toISOString().split('T')[0];
    
    db.prepare('INSERT INTO payments (client_id, date, amount, currency, concept) VALUES (?, ?, ?, ?, ?)')
      .run(req.params.id, date, amount, currency, concept);
    
    // Auto-renew hosting for 1 year if concept includes hosting
    if (concept.toLowerCase().includes('hosting')) {
      const client: any = db.prepare('SELECT hosting_expiry FROM clients WHERE id = ?').get(req.params.id);
      const current = client.hosting_expiry ? parseISO(client.hosting_expiry) : new Date();
      const next = new Date(current);
      next.setFullYear(next.getFullYear() + 1);
      db.prepare('UPDATE clients SET hosting_expiry = ? WHERE id = ?').run(next.toISOString().split('T')[0], req.params.id);
    }

    res.json({ success: true });
  });

  // Sub-sellers
  app.get('/api/sub-sellers', authenticateToken, (req, res) => {
    const sellers = db.prepare('SELECT * FROM sub_sellers').all();
    res.json(sellers);
  });

  app.post('/api/sub-sellers', authenticateToken, (req, res) => {
    const { name, responsible } = req.body;
    db.prepare('INSERT INTO sub_sellers (name, responsible) VALUES (?, ?)').run(name, responsible);
    res.json({ success: true });
  });

  // --- Vite Integration ---
  if (process.env.NODE_ENV !== 'production') {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
