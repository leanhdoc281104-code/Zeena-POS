import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db, { initDb } from './src/lib/db.ts';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'zeina-pos-secret-key-123';

app.use(cors());
app.use(express.json());

// Initialize Database
initDb().then(() => {
  console.log('Database initialized');
}).catch(err => {
  console.error('Database initialization failed', err);
});

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const uid = Math.random().toString(36).substring(2, 15);
    await db('users').insert({
      uid,
      name,
      email,
      password: hashedPassword,
      role: role || 'cashier'
    });
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    res.status(500).json({ error: 'User already exists or server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db('users').where({ email }).first();

  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ uid: user.uid, role: user.role, name: user.name }, JWT_SECRET);
    res.json({ token, user: { uid: user.uid, name: user.name, role: user.role, email: user.email } });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// --- GENERIC DATA ROUTES (Firestore-like) ---
app.get('/api/data/:collection', authenticateToken, async (req, res) => {
  const { collection } = req.params;
  const { limit: colLimit, orderBy, orderDir, whereField, whereValue, whereOp } = req.query;

  try {
    let query = db(collection);

    if (whereField && whereValue) {
      const op = whereOp === '>=' ? '>=' : whereOp === '<=' ? '<=' : '=';
      query = query.where(whereField as string, op, whereValue as string);
    }

    if (orderBy) {
      query = query.orderBy(orderBy as string, (orderDir as string) || 'asc');
    }

    if (colLimit) {
      query = query.limit(parseInt(colLimit as string));
    }

    const data = await query;
    
    // Parse JSON fields for specific collections
    const parsedData = data.map((item: any) => {
      const newItem = { ...item };
      if (newItem.items && typeof newItem.items === 'string') newItem.items = JSON.parse(newItem.items);
      if (newItem.materials && typeof newItem.materials === 'string') newItem.materials = JSON.parse(newItem.materials);
      if (newItem.products && typeof newItem.products === 'string') newItem.products = JSON.parse(newItem.products);
      return newItem;
    });

    res.json(parsedData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.post('/api/data/:collection', authenticateToken, async (req, res) => {
  const { collection } = req.params;
  const data = { ...req.body };

  // Stringify JSON fields
  if (data.items) data.items = JSON.stringify(data.items);
  if (data.materials) data.materials = JSON.stringify(data.materials);
  if (data.products) data.products = JSON.stringify(data.products);

  try {
    if (!data.id) data.id = Math.random().toString(36).substring(2, 15);
    await db(collection).insert(data);
    res.status(201).json({ id: data.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

app.put('/api/data/:collection/:id', authenticateToken, async (req, res) => {
  const { collection, id } = req.params;
  const data = { ...req.body };

  if (data.items) data.items = JSON.stringify(data.items);
  if (data.materials) data.materials = JSON.stringify(data.materials);
  if (data.products) data.products = JSON.stringify(data.products);
  if (data.id) delete data.id;

  try {
    await db(collection).where({ id }).update(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update data' });
  }
});

app.delete('/api/data/:collection/:id', authenticateToken, async (req, res) => {
  const { collection, id } = req.params;
  try {
    await db(collection).where({ id }).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete data' });
  }
});

// Single document fetch (e.g. settings)
app.get('/api/doc/:collection/:id', authenticateToken, async (req, res) => {
    const { collection, id } = req.params;
    try {
        const data = await db(collection).where({ id }).first();
        if (data && data.value && collection === 'settings') {
            return res.json(JSON.parse(data.value));
        }
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

// --- POS CHECKOUT ---
app.post('/api/pos/checkout', authenticateToken, async (req, res) => {
  const { saleData, cart } = req.body;
  
  try {
    await db.transaction(async trx => {
      // 1. Create sale record
      if (!saleData.id) saleData.id = Math.random().toString(36).substring(2, 15);
      const insertData = { ...saleData };
      if (insertData.items) insertData.items = JSON.stringify(insertData.items);
      await trx('sales').insert(insertData);

      // 2. Update product stocks
      for (const item of cart) {
        await trx('products')
          .where({ id: item.productId })
          .decrement('stock', item.qty);
      }

      // 3. Update customer debt if applicable
      if (saleData.paymentMethod === 'debt' && saleData.customerId) {
        await trx('customers')
          .where({ id: saleData.customerId })
          .increment('debtBalance', saleData.total);
      }
    });
    res.json({ success: true, id: saleData.id });
  } catch (error) {
    console.error('Checkout transaction failed', error);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

// --- RECORD PURCHASE ---
app.post('/api/purchases/record', authenticateToken, async (req, res) => {
  const { purchaseData, cart } = req.body;
  
  try {
    await db.transaction(async trx => {
      // 1. Create purchase record
      if (!purchaseData.id) purchaseData.id = Math.random().toString(36).substring(2, 15);
      const insertData = { ...purchaseData };
      if (insertData.items) insertData.items = JSON.stringify(insertData.items);
      await trx('purchases').insert(insertData);

      // 2. Update product stocks and costs
      for (const item of cart) {
        await trx('products')
          .where({ id: item.productId })
          .increment('stock', item.qty)
          .update({ cost: item.cost, updatedAt: new Date().toISOString() });
      }
    });
    res.json({ success: true, id: purchaseData.id });
  } catch (error) {
    console.error('Purchase record failed', error);
    res.status(500).json({ error: 'Purchase record failed' });
  }
});

// Vite Middleware for Dev
async function startServer() {
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
