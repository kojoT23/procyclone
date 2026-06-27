const pool = require('../config/db');

const getExpenses = async (req, res) => {
  try {
    const { category, start_date, end_date, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let conditions = [];
    let params = [];
    let p = 1;
    if (category && category !== 'all') { conditions.push(`e.category = $${p++}`); params.push(category); }
    if (start_date) { conditions.push(`e.expense_date >= $${p++}`); params.push(start_date); }
    if (end_date) { conditions.push(`e.expense_date <= $${p++}`); params.push(end_date); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await pool.query(`SELECT COUNT(*) FROM expenses e ${where}`, params);
    const expenses = await pool.query(
      `SELECT e.*, u.name as created_by_name
       FROM expenses e
       LEFT JOIN users u ON e.created_by = u.id
       ${where}
       ORDER BY e.expense_date DESC, e.created_at DESC
       LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );
    res.json({ success: true, expenses: expenses.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page), pages: Math.ceil(countResult.rows[0].count / limit) });
  } catch (error) {
    console.error('getExpenses error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createExpense = async (req, res) => {
  try {
    const { category, description, amount, expense_date, payment_method, notes } = req.body;
    if (!category || !description || !amount) {
      return res.status(400).json({ success: false, message: 'Category, description and amount are required' });
    }
    const result = await pool.query(
      `INSERT INTO expenses (category, description, amount, expense_date, payment_method, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [category, description, amount, expense_date || new Date(), payment_method || 'cash', notes, req.user.id]
    );
    res.status(201).json({ success: true, expense: result.rows[0] });
  } catch (error) {
    console.error('createExpense error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, description, amount, expense_date, payment_method, notes } = req.body;
    const result = await pool.query(
      `UPDATE expenses SET category=$1, description=$2, amount=$3, expense_date=$4, payment_method=$5, notes=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [category, description, amount, expense_date, payment_method, notes, id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Expense not found' });
    res.json({ success: true, expense: result.rows[0] });
  } catch (error) {
    console.error('updateExpense error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM expenses WHERE id=$1 RETURNING id', [id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Expense not found' });
    res.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    console.error('deleteExpense error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getExpenseSummary = async (req, res) => {
  try {
    const { start_date, end_date, period = '30' } = req.query;
    let whereClause;
    let params = [];
    if (start_date && end_date) {
      whereClause = `WHERE expense_date >= $1 AND expense_date <= $2`;
      params = [start_date, end_date];
    } else {
      whereClause = `WHERE expense_date >= NOW() - INTERVAL '${parseInt(period)} days'`;
    }
    const byCategory = await pool.query(
      `SELECT category, SUM(amount) as total, COUNT(*) as count FROM expenses ${whereClause} GROUP BY category ORDER BY total DESC`,
      params
    );
    const total = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses ${whereClause}`, params);
    const thisMonth = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', NOW())`);
    const daily = await pool.query(
      `SELECT expense_date as date, SUM(amount) as total FROM expenses ${whereClause} GROUP BY expense_date ORDER BY expense_date ASC`,
      params
    );
    res.json({ success: true, total_expenses: parseFloat(total.rows[0].total_expenses), this_month: parseFloat(thisMonth.rows[0].total), by_category: byCategory.rows, daily: daily.rows });
  } catch (error) {
    console.error('getExpenseSummary error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary };
