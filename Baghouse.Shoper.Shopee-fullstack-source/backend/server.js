require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function dbQuery(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.substring(7) : null;

    if (!token) {
      if (!required) return next();
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

app.get('/api/health', async (req, res) => {
  try {
    await dbQuery('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: err.message });
  }
});

// AUTH
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const existing = await dbQuery('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await dbQuery(
      'INSERT INTO users (name, email, password_hash, phone) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, phone || null]
    );

    const user = { id: result.insertId, name, email, role: 'customer' };
    res.status(201).json({ user, token: createToken(user) });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const rows = await dbQuery(
      'SELECT id, name, email, password_hash, role, phone FROM users WHERE email = ?',
      [email]
    );

    if (!rows.length) return res.status(401).json({ message: 'Invalid email or password' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid email or password' });

    delete user.password_hash;
    res.json({ user, token: createToken(user) });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

app.get('/api/auth/me', auth(), async (req, res) => {
  const rows = await dbQuery(
    'SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'User not found' });
  res.json(rows[0]);
});

// CATEGORIES
app.get('/api/categories', async (req, res) => {
  try {
    const rows = await dbQuery('SELECT * FROM categories ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Could not load categories', error: err.message });
  }
});

// PRODUCTS
app.get('/api/products', async (req, res) => {
  try {
    const { category, brand, search, limit = 50 } = req.query;
    let sql = `
      SELECT p.*, c.name AS category_name, b.name AS brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.is_active = 1
    `;
    const params = [];

    if (category) {
      sql += ' AND c.slug = ?';
      params.push(category);
    }
    if (brand) {
      sql += ' AND b.slug = ?';
      params.push(brand);
    }
    if (search) {
      sql += ' AND (p.name LIKE ? OR p.description LIKE ? OR b.name LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    sql += ' ORDER BY p.created_at DESC LIMIT ?';
    params.push(Math.min(Number(limit) || 50, 100));

    res.json(await dbQuery(sql, params));
  } catch (err) {
    res.status(500).json({ message: 'Could not load products', error: err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  const rows = await dbQuery(`
    SELECT p.*, c.name AS category_name, b.name AS brand_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.id = ?
  `, [req.params.id]);

  if (!rows.length) return res.status(404).json({ message: 'Product not found' });
  res.json(rows[0]);
});

app.post('/api/products', auth(), adminOnly, async (req, res) => {
  try {
    const {
      name, slug, description, price, mrp, stock, category_id,
      brand_id, image_url, sku
    } = req.body;

    const result = await dbQuery(`
      INSERT INTO products
      (name, slug, description, price, mrp, stock, category_id, brand_id, image_url, sku)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, slug, description || '', price, mrp || price, stock || 0,
      category_id, brand_id, image_url || '', sku
    ]);

    res.status(201).json({ id: result.insertId, message: 'Product created' });
  } catch (err) {
    res.status(500).json({ message: 'Could not create product', error: err.message });
  }
});

app.put('/api/products/:id', auth(), adminOnly, async (req, res) => {
  try {
    const fields = ['name','description','price','mrp','stock','category_id','brand_id','image_url','sku','is_active'];
    const updates = [];
    const values = [];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (!updates.length) return res.status(400).json({ message: 'No fields to update' });

    values.push(req.params.id);
    await dbQuery(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Product updated' });
  } catch (err) {
    res.status(500).json({ message: 'Could not update product', error: err.message });
  }
});

app.delete('/api/products/:id', auth(), adminOnly, async (req, res) => {
  await dbQuery('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ message: 'Product deactivated' });
});

// ORDERS
app.post('/api/orders', auth(), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { items, shipping_address, payment_method = 'COD' } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order must contain items' });
    }

    await connection.beginTransaction();

    let total = 0;
    const validatedItems = [];

    for (const item of items) {
      const [rows] = await connection.execute(
        'SELECT id, name, price, stock FROM products WHERE id = ? AND is_active = 1 FOR UPDATE',
        [item.product_id]
      );

      if (!rows.length) throw new Error(`Product ${item.product_id} not found`);
      const product = rows[0];
      const qty = Number(item.quantity);

      if (!Number.isInteger(qty) || qty < 1) throw new Error('Invalid quantity');
      if (product.stock < qty) throw new Error(`Insufficient stock for ${product.name}`);

      total += Number(product.price) * qty;
      validatedItems.push({ ...product, quantity: qty });
    }

    const [order] = await connection.execute(`
      INSERT INTO orders (user_id, total_amount, shipping_address, payment_method, status)
      VALUES (?, ?, ?, ?, 'PLACED')
    `, [req.user.id, total, shipping_address || '', payment_method]);

    for (const item of validatedItems) {
      await connection.execute(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price)
        VALUES (?, ?, ?, ?)
      `, [order.insertId, item.id, item.quantity, item.price]);

      await connection.execute(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.id]
      );
    }

    await connection.commit();
    res.status(201).json({ order_id: order.insertId, total_amount: total, status: 'PLACED' });
  } catch (err) {
    await connection.rollback();
    res.status(400).json({ message: 'Order failed', error: err.message });
  } finally {
    connection.release();
  }
});

app.get('/api/orders/my', auth(), async (req, res) => {
  const orders = await dbQuery(`
    SELECT id, total_amount, shipping_address, payment_method, status, created_at
    FROM orders WHERE user_id = ? ORDER BY created_at DESC
  `, [req.user.id]);

  for (const order of orders) {
    order.items = await dbQuery(`
      SELECT oi.product_id, oi.quantity, oi.unit_price, p.name, p.image_url
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
    `, [order.id]);
  }

  res.json(orders);
});

// SERVICE REQUESTS
app.post('/api/service-requests', auth(), async (req, res) => {
  const { order_id, product_id, service_type, issue_description } = req.body;
  if (!service_type || !issue_description) {
    return res.status(400).json({ message: 'Service type and issue description are required' });
  }

  const result = await dbQuery(`
    INSERT INTO service_requests
    (user_id, order_id, product_id, service_type, issue_description, status)
    VALUES (?, ?, ?, ?, ?, 'OPEN')
  `, [req.user.id, order_id || null, product_id || null, service_type, issue_description]);

  res.status(201).json({ id: result.insertId, status: 'OPEN' });
});

app.get('/api/service-requests/my', auth(), async (req, res) => {
  const rows = await dbQuery(`
    SELECT sr.*, p.name AS product_name
    FROM service_requests sr
    LEFT JOIN products p ON p.id = sr.product_id
    WHERE sr.user_id = ?
    ORDER BY sr.created_at DESC
  `, [req.user.id]);
  res.json(rows);
});

// Serve frontend
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API route not found' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Baghouse.Shoper.Shopee running on http://localhost:${PORT}`);
});
