const pool = require('../config/db');

const getRevenueReport = async (req, res) => {
  try {
    const { period = '30', start_date, end_date } = req.query;

    // Build WHERE clause — support both period and custom date range
    let whereClause;
    let queryParams = [];
    if (start_date && end_date) {
      whereClause = `WHERE DATE(created_at) >= $1 AND DATE(created_at) <= $2`;
      queryParams = [start_date, end_date];
    } else {
      whereClause = `WHERE created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;
    }

    const ph = queryParams.length; // number of existing params

    // Daily revenue for the period
    const dailyRevenue = await pool.query(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END) as revenue
       FROM orders
       ${whereClause}
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      queryParams
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
       ${whereClause}`,
      queryParams
    );

    // Payment method breakdown
    const paymentBreakdown = await pool.query(
      `SELECT
        payment_method,
        COUNT(*) as count,
        SUM(total_amount) as total
       FROM orders
       ${whereClause}
       GROUP BY payment_method`,
      queryParams
    );

    res.json({
      success: true,
      period: start_date && end_date ? 'custom' : parseInt(period),
      start_date: start_date || null,
      end_date: end_date || null,
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
    const { period = '30', start_date, end_date } = req.query;

    let dateFilter;
    let queryParams = [];
    if (start_date && end_date) {
      dateFilter = `AND DATE(o.created_at) >= $1 AND DATE(o.created_at) <= $2`;
      queryParams = [start_date, end_date];
    } else {
      dateFilter = `AND o.created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;
    }

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
       ${dateFilter}
       GROUP BY p.id, p.name, p.category, p.price, p.stock_quantity
       ORDER BY total_sold DESC
       LIMIT 10`,
      queryParams
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
    const { period = '30', start_date, end_date } = req.query;

    let deliveryFilter, cashFilter, queryParams = [];
    if (start_date && end_date) {
      deliveryFilter = `AND DATE(d.created_at) >= $1 AND DATE(d.created_at) <= $2`;
      cashFilter     = `AND DATE(cl.created_at) >= $1 AND DATE(cl.created_at) <= $2`;
      queryParams    = [start_date, end_date];
    } else {
      deliveryFilter = `AND d.created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;
      cashFilter     = `AND cl.created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;
    }

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
         ${deliveryFilter}
       LEFT JOIN cash_logs cl ON r.id = cl.rider_id
         ${cashFilter}
       GROUP BY r.id, r.name, r.phone
       ORDER BY total_deliveries DESC`,
      queryParams
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
