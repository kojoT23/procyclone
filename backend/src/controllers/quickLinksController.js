const pool = require('../config/db');

// Any authenticated user can view — this is just a shared bookmark
// list (ICUMS, GRA, forwarder tracking pages, etc.), nothing sensitive.
const getQuickLinks = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ql.*, u.name as created_by_name
       FROM quick_links ql
       LEFT JOIN users u ON ql.created_by = u.id
       ORDER BY ql.created_at ASC`
    );
    res.json({ success: true, links: result.rows });
  } catch (error) {
    console.error('getQuickLinks error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createQuickLink = async (req, res) => {
  try {
    const { label, url } = req.body;
    if (!label || !url) {
      return res.status(400).json({ success: false, message: 'Label and URL are required' });
    }
    // Light sanity check — prepend https:// if someone types a bare domain
    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    const result = await pool.query(
      `INSERT INTO quick_links (label, url, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [label, normalizedUrl, req.user?.id || null]
    );
    res.status(201).json({ success: true, message: 'Link added', link: result.rows[0] });
  } catch (error) {
    console.error('createQuickLink error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteQuickLink = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM quick_links WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Link not found' });
    res.json({ success: true, message: 'Link removed' });
  } catch (error) {
    console.error('deleteQuickLink error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getQuickLinks, createQuickLink, deleteQuickLink };
