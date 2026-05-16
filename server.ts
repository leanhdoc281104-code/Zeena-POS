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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
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
app.get('/api/status', async (req, res) => {
  try {
    const hasUsers = await db.schema.hasTable('users');
    res.json({ 
      status: 'ok', 
      db: hasUsers ? 'ready' : 'not_ready',
      env: process.env.NODE_ENV || 'development',
      time: new Date().toISOString()
    });
  } catch (e: any) {
    console.error('Status check error:', e);
    res.status(500).json({ status: 'error', error: e.message || String(e) });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { id, uid, name, email, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const finalId = id || uid || Math.random().toString(36).substring(2, 15);
    
    console.log(`Processing registration for ${email} with ID ${finalId}`);
    
    const existing = await db('users').where({ email }).first();
    if (existing) {
      console.log(`User ${email} already exists, updating...`);
      await db('users').where({ email }).update({
        id: finalId, // Ensure ID matches
        name,
        password: hashedPassword,
        role: role || existing.role
      });
      return res.json({ message: 'User updated' });
    }

    await db('users').insert({
      id: finalId,
      name,
      email,
      password: hashedPassword,
      role: role || 'cashier'
    });
    console.log(`User ${email} created successfully`);
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db('users').where({ email }).first();

  if (!user) {
    return res.status(401).json({ error: 'البريد الإلكتروني غير مسجل في النظام' });
  }

  if (await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email } });
  } else {
    res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
  }
});

app.put('/api/auth/password', async (req, res) => {
  const { email, password, newPassword } = req.body;
  const user = await db('users').where({ email }).first();
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  }
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db('users').where({ email }).update({ password: hashedPassword });
  res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
});

// --- UTILS ---
const columnCache: Record<string, string[]> = {};

const filterFields = async (tableName: string, data: any) => {
  if (tableName === 'settings') return data;
  try {
    if (!columnCache[tableName]) {
      const columns = await db(tableName).columnInfo();
      columnCache[tableName] = Object.keys(columns);
    }
    
    const allowedKeys = columnCache[tableName];
    const filtered: any = {};
    for (const key of allowedKeys) {
      if (data[key] !== undefined) {
        filtered[key] = data[key];
      }
    }
    return filtered;
  } catch (e) {
    console.error(`Filter fields failed for ${tableName}:`, e);
    return data; 
  }
};

// --- GENERIC DATA ROUTES (Firestore-like) ---
app.get('/api/data/:collection', authenticateToken, async (req, res) => {
  const { collection } = req.params;
  const { limit: colLimit, offset, orderBy, orderDir, whereField, whereValue, whereOp } = req.query;

  try {
    let query = db(collection);

    if (whereField && whereValue) {
      const op = whereOp === '>=' ? '>=' : whereOp === '<=' ? '<=' : '=';
      query = query.where(whereField as string, op, whereValue as string);
    }

    if (orderBy) {
      query = query.orderBy(orderBy as string, (orderDir as string) || 'asc');
    }

    if (offset && !isNaN(parseInt(offset as string))) {
      query = query.offset(parseInt(offset as string));
    }

    if (colLimit && !isNaN(parseInt(colLimit as string))) {
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
  let data = { ...req.body };

  // Stringify JSON fields
  if (data.items) data.items = JSON.stringify(data.items);
  if (data.materials) data.materials = JSON.stringify(data.materials);
  if (data.products) data.products = JSON.stringify(data.products);

  try {
    if (!data.id) data.id = Math.random().toString(36).substring(2, 15);
    const filteredData = await filterFields(collection, data);
    await db(collection).insert(filteredData);
    res.status(201).json({ id: data.id });
  } catch (error) {
    console.error('Post data error:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

app.put('/api/data/:collection/:id', authenticateToken, async (req, res) => {
  const { collection, id } = req.params;
  let data = { ...req.body };

  if (data.items) data.items = JSON.stringify(data.items);
  if (data.materials) data.materials = JSON.stringify(data.materials);
  if (data.products) data.products = JSON.stringify(data.products);
  if (data.id) delete data.id;

  try {
    if (collection === 'settings') {
        const value = JSON.stringify(data);
        const existing = await db('settings').where({ id }).first();
        if (existing) {
            await db('settings').where({ id }).update({ value });
        } else {
            await db('settings').insert({ id, value });
        }
        return res.json({ success: true });
    }
    
    const filteredData = await filterFields(collection, data);
    console.log(`Updating ${collection}/${id}:`, Object.keys(filteredData));
    
    // Attempt update by ID
    const updated = await db(collection).where({ id }).update(filteredData);
    
    if (updated === 0) {
        // Specialty handling for users to resolve UNIQUE constraint errors during migration
        if (collection === 'users' && filteredData.email) {
            const existingByEmail = await db('users').where({ email: filteredData.email }).first();
            if (existingByEmail) {
                console.log(`Found user by email ${filteredData.email}, updating existing record ${existingByEmail.id} and syncing ID to ${id}`);
                // Use a direct update to change the ID as well
                await db('users').where({ id: existingByEmail.id }).update({ ...filteredData, id });
                return res.json({ success: true, note: 'updated_by_email_and_id_synced' });
            }
        }

        console.log(`Document ${id} not found in ${collection}, inserting...`);
        try {
            await db(collection).insert({ id, ...filteredData });
        } catch (e: any) {
            console.error(`Insert failed for ${collection}/${id}:`, e);
            // If it's a unique constraint error for email on users table that we missed
            if (collection === 'users' && e.message?.includes('UNIQUE constraint failed: users.email')) {
                const retryByEmail = await db('users').where({ email: filteredData.email }).first();
                if (retryByEmail) {
                    console.log(`Retry: Syncing ID ${id} for email ${filteredData.email}`);
                    await db('users').where({ id: retryByEmail.id }).update({ ...filteredData, id });
                    return res.json({ success: true, note: 'updated_by_email_retry_and_id_synced' });
                }
            }
            throw e; // Re-throw to be caught by the outer catch
        }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Update data error:', error);
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
            try {
                return res.json(JSON.parse(data.value));
            } catch (e) {
                return res.json({});
            }
        }
        res.json(data || null);
    } catch (error) {
        console.error('Fetch doc error:', error);
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

// --- BACKUP ---
app.get('/api/backup/export', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  
  try {
    const tables = [
      'users', 'products', 'categories', 'customers', 'suppliers', 
      'sales', 'expenses', 'purchases', 'customer_payments', 
      'supplier_payments', 'debt_logs', 'manufacturing_cycles', 
      'manufacturing_sales', 'manufacturing_expenses', 'settings'
    ];
    
    const backup: any = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: {}
    };
    
    for (const table of tables) {
      if (await db.schema.hasTable(table)) {
        backup.data[table] = await db(table).select('*');
      }
    }
    
    res.json(backup);
  } catch (error) {
    console.error('Backup failed:', error);
    res.status(500).json({ error: 'Failed to generate backup' });
  }
});

// Vite Middleware for Dev
async function startServer() {
  const env = process.env.NODE_ENV || 'development';
  console.log(`Starting server in ${env} mode on port ${PORT}`);
  
  try {
    await initDb();
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization failed', err);
  }

  if (env !== 'production') {
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
