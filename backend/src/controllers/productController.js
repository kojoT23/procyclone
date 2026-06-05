const { body } = require('express-validator');
const pool = require('../config/db');

const createProductValidation = [
  body('name').notEmpty().withMessage('Product name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('stock_quantity').optional().isInt({ min: 0 }).withMessage('Stock must be a positive number'),
];

const getProducts = async (req, res) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = ['is_active = true'];
    const values = [];
    let i = 1;

    if (search) {
      conditions.push(`(name ILIKE $${i} OR description ILIKE $${i} OR category ILIKE $${i})`);
      values.push(`%${search}%`); i++;
    }
    if (category) { conditions.push(`category = $${i++}`); values.push(category); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(`SELECT COUNT(*) FROM products ${where}`, values);
    const result = await pool.query(
      `SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
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

const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM products WHERE id = $1 AND is_active = true', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createProduct = async (req, res) => {
  try {
    const {
      name, description, price, stock_quantity, low_stock_threshold,
      category, image_url, compare_price, images, rating, review_count, is_deal, badge
    } = req.body;
    const result = await pool.query(
      `INSERT INTO products (name, description, price, stock_quantity, low_stock_threshold,
        category, image_url, compare_price, images, rating, review_count, is_deal, badge)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [name, description, price, stock_quantity || 0, low_stock_threshold || 5,
       category, image_url, compare_price || null, images || null,
       rating || 0, review_count || 0, is_deal || false, badge || null]
    );
    res.status(201).json({ success: true, message: 'Product created', product: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, description, price, stock_quantity, low_stock_threshold,
      category, image_url, compare_price, images, rating, review_count, is_deal, badge
    } = req.body;
    const result = await pool.query(
      `UPDATE products SET name=$1, description=$2, price=$3, stock_quantity=$4,
       low_stock_threshold=$5, category=$6, image_url=$7, compare_price=$8,
       images=$9, rating=$10, review_count=$11, is_deal=$12, badge=$13, updated_at=NOW()
       WHERE id=$14 AND is_active=true RETURNING *`,
      [name, description, price, stock_quantity, low_stock_threshold,
       category, image_url, compare_price || null, images || null,
       rating || 0, review_count || 0, is_deal || false, badge || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product updated', product: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
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
        `INSERT INTO products (name, description, price, stock_quantity, low_stock_threshold, category, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [
          product.name.trim(),
          product.description || null,
          parseFloat(product.price),
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
  getProducts, getPublicProducts, getProduct, createProduct,
  updateProduct, deleteProduct, updateStock, bulkImport, createProductValidation
};