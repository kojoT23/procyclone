const pool = require('../config/db');

const generatePOReference = () => 'PO-' + Date.now();

// ── Stock Movements ────────────────────────────────────────────
const getStockMovements = async (req, res) => {
  try {
    const { product_id, type, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let i = 1;

    if (product_id) { conditions.push(`sm.product_id = $${i++}`); values.push(product_id); }
    if (type) { conditions.push(`sm.type = $${i++}`); values.push(type); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM stock_movements sm ${where}`, values
    );
    const result = await pool.query(
      `SELECT sm.*, p.name as product_name, u.name as created_by_name
       FROM stock_movements sm
       LEFT JOIN products p ON sm.product_id = p.id
       LEFT JOIN users u ON sm.created_by = u.id
       ${where} ORDER BY sm.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      movements: result.rows,
    });
  } catch (error) {
    console.error('getStockMovements error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const adjustStock = async (req, res) => {
  const client = await pool.connect();
  try {
    const { product_id, type, quantity, notes } = req.body;

    if (!product_id || !type || !quantity) {
      return res.status(400).json({ success: false, message: 'product_id, type and quantity are required' });
    }

    const validTypes = ['adjustment', 'damage', 'return', 'transfer'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: `Type must be one of: ${validTypes.join(', ')}` });
    }

    await client.query('BEGIN');

    const product = await client.query('SELECT * FROM products WHERE id = $1', [product_id]);
    if (product.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Negative types reduce stock
    const negativeTypes = ['damage', 'transfer'];
    const delta = negativeTypes.includes(type) ? -Math.abs(quantity) : Math.abs(quantity);
    const newStock = product.rows[0].stock_quantity + delta;

    if (newStock < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Insufficient stock. Current: ${product.rows[0].stock_quantity}` });
    }

    await client.query(
      'UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2',
      [newStock, product_id]
    );

    await client.query(
      `INSERT INTO stock_movements (product_id, type, quantity, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [product_id, type, delta, notes, req.user?.id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Stock adjusted successfully',
      new_stock: newStock,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('adjustStock error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

// ── Suppliers ──────────────────────────────────────────────────
const getSuppliers = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = ['is_active = true'];
    const values = [];
    let i = 1;

    if (search) {
      conditions.push(`(name ILIKE $${i} OR phone ILIKE $${i} OR email ILIKE $${i})`);
      values.push(`%${search}%`); i++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const countResult = await pool.query(`SELECT COUNT(*) FROM suppliers ${where}`, values);
    const result = await pool.query(
      `SELECT * FROM suppliers ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      suppliers: result.rows,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createSupplier = async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Supplier name is required' });

    const result = await pool.query(
      `INSERT INTO suppliers (name, phone, email, address, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, phone, email, address, notes]
    );
    res.status(201).json({ success: true, message: 'Supplier created', supplier: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, notes } = req.body;
    const result = await pool.query(
      `UPDATE suppliers SET name=COALESCE($1,name), phone=COALESCE($2,phone),
       email=COALESCE($3,email), address=COALESCE($4,address),
       notes=COALESCE($5,notes), updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [name, phone, email, address, notes, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, message: 'Supplier updated', supplier: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Purchase Orders ────────────────────────────────────────────
const getPurchaseOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let i = 1;

    if (status) { conditions.push(`po.status = $${i++}`); values.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await pool.query(`SELECT COUNT(*) FROM purchase_orders po ${where}`, values);
    const result = await pool.query(
      `SELECT po.*, s.name as supplier_name, u.name as created_by_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       LEFT JOIN users u ON po.created_by = u.id
       ${where} ORDER BY po.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      purchase_orders: result.rows,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createPurchaseOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    const { supplier_id, items, notes } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }

    await client.query('BEGIN');

    const total = items.reduce((sum, item) => sum + item.unit_cost * item.quantity_ordered, 0);

    const po = await client.query(
      `INSERT INTO purchase_orders (reference, supplier_id, total_amount, notes, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [generatePOReference(), supplier_id, total, notes, req.user?.id]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity_ordered, unit_cost)
         VALUES ($1, $2, $3, $4)`,
        [po.rows[0].id, item.product_id, item.quantity_ordered, item.unit_cost]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Purchase order created', purchase_order: po.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createPurchaseOrder error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

const receivePurchaseOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { items } = req.body;

    await client.query('BEGIN');

    for (const item of items) {
      if (item.quantity_received > 0) {
        // Update quantity received on PO item
        await client.query(
          'UPDATE purchase_order_items SET quantity_received = $1 WHERE id = $2',
          [item.quantity_received, item.id]
        );

        // Add stock to product
        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2',
          [item.quantity_received, item.product_id]
        );

        // Log stock movement
        await client.query(
          `INSERT INTO stock_movements (product_id, type, quantity, reference_id, reference_type, notes, created_by)
           VALUES ($1, 'purchase', $2, $3, 'purchase_order', 'Stock received from purchase order', $4)`,
          [item.product_id, item.quantity_received, id, req.user?.id]
        );
      }
    }

    // Update PO status
    await client.query(
      `UPDATE purchase_orders SET status = 'received', received_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Purchase order received and stock updated' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('receivePurchaseOrder error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

module.exports = {
  getStockMovements,
  adjustStock,
  getSuppliers,
  createSupplier,
  updateSupplier,
  getPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder,
};