const { body } = require('express-validator');
const pool = require('../config/db');

const createProductValidation = [
  body('name').notEmpty().withMessage('Product name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('stock_quantity').optional().isInt({ min: 0 }).withMessage('Stock must be a positive number'),
];

// Roles allowed to see cost_price (margin-sensitive — not for
// customer-facing or delivery staff).
const COST_VISIBLE_ROLES = ['super_admin', 'admin', 'manager', 'warehouse'];
const stripCost = (row, role) =>
  COST_VISIBLE_ROLES.includes(role) || !row ? row : (({ cost_price, ...rest }) => rest)(row);

// Only these columns are sortable — never interpolate req.query.sort
// directly into SQL, that's an injection vector.
const SORT_COLUMNS = {
  name: 'name', price: 'price', stock_quantity: 'stock_quantity',
  category: 'category', created_at: 'created_at',
};

const getProducts = async (req, res) => {
  try {
    const {
      search, category, low_stock, out_of_stock, is_active,
      sort = 'created_at', dir = 'desc', page = 1, limit = 20,
    } = req.query;
    const safeLimit = Math.min(parseInt(limit) || 20, 100);
    const offset = (page - 1) * safeLimit;

    const conditions = [];
    const values = [];
    let i = 1;

    // Default to active-only, but let an explicit is_active param
    // (e.g. the "Inactive" filter) override that default.
    if (is_active === 'false') conditions.push('is_active = false');
    else if (is_active === 'true' || is_active === undefined) conditions.push('is_active = true');

    if (search) {
      conditions.push(`(name ILIKE $${i} OR description ILIKE $${i} OR category ILIKE $${i} OR sku ILIKE $${i} OR barcode ILIKE $${i})`);
      values.push(`%${search}%`); i++;
    }
    if (category) { conditions.push(`category = $${i++}`); values.push(category); }
    if (low_stock === 'true') { conditions.push(`stock_quantity <= low_stock_threshold`); }
    if (out_of_stock === 'true') { conditions.push(`stock_quantity = 0`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortCol = SORT_COLUMNS[sort] || 'created_at';
    const sortDir = dir === 'asc' ? 'ASC' : 'DESC';

    const countResult = await pool.query(`SELECT COUNT(*) FROM products ${where}`, values);
    const result = await pool.query(
      `SELECT * FROM products ${where} ORDER BY ${sortCol} ${sortDir} LIMIT $${i} OFFSET $${i + 1}`,
      [...values, safeLimit, offset]
    );

    const products = result.rows.map(row => stripCost(row, req.user?.role));

    res.json({
      success: true,
      count: products.length,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / safeLimit),
      products,
    });
  } catch (error) {
    console.error('getProducts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getPublicProducts = async (req, res) => {
  try {
    const { search, category, is_deal, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = ['is_active = true'];
    const values = [];
    let i = 1;

    if (search) {
      conditions.push(`(name ILIKE $${i} OR description ILIKE $${i} OR category ILIKE $${i})`);
      values.push(`%${search}%`); i++;
    }
    if (category) { conditions.push(`category = $${i++}`); values.push(category); }
    if (is_deal === 'true') { conditions.push(`is_deal = true`); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(`SELECT COUNT(*) FROM products ${where}`, values);
    const result = await pool.query(
      `SELECT id, name, description, price, compare_price, stock_quantity, low_stock_threshold,
              category, image_url, images, rating, review_count, is_deal, badge, created_at
       FROM products ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      products: result.rows,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/products/categories — every distinct category across the
// whole catalog, not just whatever page happens to be loaded. Powers
// the category filter dropdown and the add/edit form's datalist.
const getCategories = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT category FROM products
       WHERE is_active = true AND category IS NOT NULL AND category != ''
       ORDER BY category ASC`
    );
    res.json({ success: true, categories: result.rows.map(r => r.category) });
  } catch (error) {
    console.error('getCategories error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM products WHERE id = $1 AND is_active = true', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, product: stripCost(result.rows[0], req.user?.role) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/products/barcode/:code — instant lookup for a scanned barcode.
// A real barcode scanner just types the code fast and hits Enter, so this
// is designed for a search box that submits on Enter, not a special
// scanning UI — no scanner-specific integration needed on our end.
const getProductByBarcode = async (req, res) => {
  try {
    const { code } = req.params;
    const result = await pool.query(
      'SELECT * FROM products WHERE barcode = $1 AND is_active = true',
      [code]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: `No product found for barcode ${code}` });
    }
    res.json({ success: true, product: stripCost(result.rows[0], req.user?.role) });
  } catch (error) {
    console.error('getProductByBarcode error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createProduct = async (req, res) => {
  try {
    const {
      name, description, price, cost_price, sku, barcode, stock_quantity, low_stock_threshold,
      category, image_url, compare_price, images, rating, review_count, is_deal, badge
    } = req.body;
    const result = await pool.query(
      `INSERT INTO products (name, description, price, cost_price, sku, barcode, stock_quantity, low_stock_threshold,
        category, image_url, compare_price, images, rating, review_count, is_deal, badge)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [name, description, price, cost_price || null, sku || null, barcode || null, stock_quantity || 0, low_stock_threshold || 5,
       category, image_url, compare_price || null, images || null,
       rating || 0, review_count || 0, is_deal || false, badge || null]
    );
    res.status(201).json({ success: true, message: 'Product created', product: result.rows[0] });
  } catch (error) {
    // 23505 = Postgres unique-violation — sku/barcode each have a unique
    // index, so this is the expected way a duplicate surfaces. Naming
    // which field failed (via error.constraint) beats a generic 500.
    if (error.code === '23505') {
      const field = error.constraint?.includes('barcode') ? 'barcode' : error.constraint?.includes('sku') ? 'SKU' : 'value';
      return res.status(409).json({ success: false, message: `That ${field} is already in use by another product` });
    }
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, description, price, cost_price, sku, barcode, stock_quantity, low_stock_threshold,
      category, image_url, compare_price, images, rating, review_count, is_deal, badge, is_active
    } = req.body;
    const result = await pool.query(
      `UPDATE products SET
         name=COALESCE($1,name), description=COALESCE($2,description), price=COALESCE($3,price),
         cost_price=COALESCE($4,cost_price), sku=COALESCE($5,sku), barcode=COALESCE($6,barcode),
         stock_quantity=COALESCE($7,stock_quantity), low_stock_threshold=COALESCE($8,low_stock_threshold),
         category=COALESCE($9,category), image_url=COALESCE($10,image_url), compare_price=COALESCE($11,compare_price),
         images=COALESCE($12,images), rating=COALESCE($13,rating), review_count=COALESCE($14,review_count),
         is_deal=COALESCE($15,is_deal), badge=COALESCE($16,badge), is_active=COALESCE($17,is_active), updated_at=NOW()
       WHERE id=$18 RETURNING *`,
      [name, description, price, cost_price, sku, barcode, stock_quantity, low_stock_threshold,
       category, image_url, compare_price, images, rating, review_count, is_deal, badge, is_active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product updated', product: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      const field = error.constraint?.includes('barcode') ? 'barcode' : error.constraint?.includes('sku') ? 'SKU' : 'value';
      return res.status(409).json({ success: false, message: `That ${field} is already in use by another product` });
    }
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    // sku/barcode are nulled here because the unique index on those
    // columns applies to inactive rows too — without this, a
    // discontinued product would permanently block that SKU/barcode
    // from ever being reused by a new product.
    const result = await pool.query(
      'UPDATE products SET is_active = false, sku = NULL, barcode = NULL, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deactivated' });
  } catch (error) {
    console.error('deleteProduct error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock_quantity } = req.body;
    const result = await pool.query(
      'UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [stock_quantity, id]
    );
    res.json({ success: true, message: 'Stock updated', product: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const bulkImport = async (req, res) => {
  const client = await pool.connect();
  try {
    const { products } = req.body;
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, message: 'No products provided' });
    }
    if (products.length > 1000) {
      return res.status(400).json({ success: false, message: 'Maximum 1000 products per import' });
    }

    await client.query('BEGIN');

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const [index, product] of products.entries()) {
      if (!product.name || !product.price) {
        errors.push(`Row ${index + 1}: name and price are required`);
        skipped++;
        continue;
      }
      if (isNaN(parseFloat(product.price)) || parseFloat(product.price) < 0) {
        errors.push(`Row ${index + 1}: invalid price for "${product.name}"`);
        skipped++;
        continue;
      }

      await client.query(
        `INSERT INTO products (name, description, price, cost_price, stock_quantity, low_stock_threshold, category, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [
          product.name.trim(),
          product.description || null,
          parseFloat(product.price),
          product.cost_price ? parseFloat(product.cost_price) : null,
          parseInt(product.stock_quantity) || 0,
          parseInt(product.low_stock_threshold) || 5,
          product.category || null,
          product.image_url || null,
        ]
      );
      imported++;
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Import complete — ${imported} imported, ${skipped} skipped`,
      imported,
      skipped,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('bulkImport error:', error);
    res.status(500).json({ success: false, message: 'Server error during import' });
  } finally {
    client.release();
  }
};

module.exports = {
  getProducts, getPublicProducts, getProduct, getProductByBarcode, getCategories, createProduct,
  updateProduct, deleteProduct, updateStock, bulkImport, createProductValidation
};