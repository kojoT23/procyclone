const pool = require('../config/db');

const VALID_TYPES = ['offer_letter', 'warning_letter', 'termination_letter', 'id_card'];

// ── My documents (self-service) ──────────────────────────────────
const getMyDocuments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM hr_documents WHERE user_id = $1 ORDER BY generated_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, documents: result.rows });
  } catch (error) {
    console.error('getMyDocuments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: list all documents (optionally filtered by user) ──────
const getAllDocuments = async (req, res) => {
  try {
    const { user_id, doc_type } = req.query;
    const conditions = [];
    const values = [];
    let i = 1;

    if (user_id)  { conditions.push(`hd.user_id = $${i++}`); values.push(user_id); }
    if (doc_type) { conditions.push(`hd.doc_type = $${i++}`); values.push(doc_type); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT hd.*, u.name as user_name, u.role as user_role, g.name as generated_by_name
       FROM hr_documents hd
       JOIN users u ON hd.user_id = u.id
       LEFT JOIN users g ON hd.generated_by = g.id
       ${where} ORDER BY hd.generated_at DESC`,
      values
    );
    res.json({ success: true, documents: result.rows });
  } catch (error) {
    console.error('getAllDocuments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: generate a document ─────────────────────────────────────
const generateDocument = async (req, res) => {
  try {
    const { user_id, doc_type, title, content } = req.body;
    if (!user_id || !doc_type || !title || !content) {
      return res.status(400).json({ success: false, message: 'user_id, doc_type, title and content are required' });
    }
    if (!VALID_TYPES.includes(doc_type)) {
      return res.status(400).json({ success: false, message: `doc_type must be one of: ${VALID_TYPES.join(', ')}` });
    }

    const result = await pool.query(
      `INSERT INTO hr_documents (user_id, doc_type, title, content, generated_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user_id, doc_type, title, content, req.user.id]
    );
    res.status(201).json({ success: true, message: 'Document generated', document: result.rows[0] });
  } catch (error) {
    console.error('generateDocument error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: delete a document ────────────────────────────────────────
const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM hr_documents WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    console.error('deleteDocument error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getMyDocuments,
  getAllDocuments,
  generateDocument,
  deleteDocument,
};
