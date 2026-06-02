const pool = require('../config/db');

const getRevenueReport = async (req, res) => {
  try {
    const { period = '30' } = req.query;

    // Daily revenue for the period
    const dailyRevenue = await pool.query(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END) as revenue
       FROM orders
       WHERE created_at >= NOW() - INTERVAL '${parseInt(period)} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`
    );

    // Overall summary
    const summary = await pool.query(
      `SELECT
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'returned' THEN 1 END) as returned,
        SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END) as total_revenue,
        AVG(CASE WHEN status = 'delivered' THEN total_amount END) as avg_order_value
       FROM orders
       WHERE created_at >= NOW() - INTERVAL '${parseInt(period)} days'`
    );

    // Payment method breakdown
    const paymentBreakdown = await pool.query(
      `SELECT
        payment_method,
        COUNT(*) as count,
        SUM(total_amount) as total
       FROM orders
       WHERE created_at >= NOW() - INTERVAL '${parseInt(period)} days'
       GROUP BY payment_method`
    );

    res.json({
      success: true,
      period: parseInt(period),
      summary: summary.rows[0],
      daily: dailyRevenue.rows,
      payment_breakdown: paymentBreakdown.rows,
    });
  } catch (error) {
    console.error('getRevenueReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getProductReport = async (req, res) => {
  try {
    const { period = '30' } = req.query;

    // Top selling products
    const topProducts = await pool.query(
      `SELECT
        p.name, p.category, p.price,
        SUM(oi.quantity) as total_sold,
        SUM(oi.total_price) as total_revenue,
        p.stock_quantity as current_stock
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.status = 'delivered'
       AND o.created_at >= NOW() - INTERVAL '${parseInt(period)} days'
       GROUP BY p.id, p.name, p.category, p.price, p.stock_quantity
       ORDER BY total_sold DESC
       LIMIT 10`
    );

    // Low stock products
    const lowStock = await pool.query(
      `SELECT id, name, category, stock_quantity, low_stock_threshold
       FROM products
       WHERE is_active = true
       AND stock_quantity <= low_stock_threshold
       ORDER BY stock_quantity ASC`
    );

    // Out of stock
    const outOfStock = await pool.query(
      `SELECT id, name, category, stock_quantity
       FROM products
       WHERE is_active = true AND stock_quantity = 0`
    );

    res.json({
      success: true,
      period: parseInt(period),
      top_products: topProducts.rows,
      low_stock: lowStock.rows,
      out_of_stock: outOfStock.rows,
    });
  } catch (error) {
    console.error('getProductReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getRiderReport = async (req, res) => {
  try {
    const { period = '30' } = req.query;

    const riderPerformance = await pool.query(
      `SELECT
        r.name as rider_name,
        r.phone,
        COUNT(d.id) as total_deliveries,
        COUNT(CASE WHEN d.status = 'delivered' THEN 1 END) as successful,
        COUNT(CASE WHEN d.status = 'failed' THEN 1 END) as failed,
        COALESCE(SUM(cl.amount), 0) as total_cash_collected,
        COUNT(CASE WHEN cl.status = 'verified' THEN 1 END) as verified_collections,
        COUNT(CASE WHEN cl.status = 'disputed' THEN 1 END) as disputed_collections
       FROM riders r
       LEFT JOIN deliveries d ON r.id = d.rider_id
         AND d.created_at >= NOW() - INTERVAL '${parseInt(period)} days'
       LEFT JOIN cash_logs cl ON r.id = cl.rider_id
         AND cl.created_at >= NOW() - INTERVAL '${parseInt(period)} days'
       GROUP BY r.id, r.name, r.phone
       ORDER BY total_deliveries DESC`
    );

    res.json({
      success: true,
      period: parseInt(period),
      riders: riderPerformance.rows,
    });
  } catch (error) {
    console.error('getRiderReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getRevenueReport, getProductReport, getRiderReport };
