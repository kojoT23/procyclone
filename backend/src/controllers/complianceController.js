const pool = require('../config/db');

const VALID_CATEGORIES = ['tax', 'customs', 'permits', 'insurance', 'internal'];
const VALID_RECURRENCES = ['none', 'monthly', 'quarterly', 'annual'];

// Derives a display status (upcoming / due_soon / overdue / filed) from the
// stored status + due_date, rather than storing a status that can drift out
// of sync with today's date.
const withComputedStatus = (row) => {
  if (row.status === 'filed') return { ...row, computed_status: 'filed' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(row.due_date);
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  let computed_status;
  if (diffDays < 0) computed_status = 'overdue';
  else if (diffDays <= (row.reminder_days_before ?? 14)) computed_status = 'due_soon';
  else computed_status = 'upcoming';
  return { ...row, computed_status, days_until_due: diffDays };
};

const advanceDueDate = (dueDate, recurrence) => {
  const next = new Date(dueDate);
  if (recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
  else if (recurrence === 'quarterly') next.setMonth(next.getMonth() + 3);
  else if (recurrence === 'annual') next.setFullYear(next.getFullYear() + 1);
  return next.toISOString().slice(0, 10);
};

exports.getComplianceItems = async (req, res) => {
  try {
    const { category, status } = req.query;
    const conditions = [];
    const params = [];

    if (category) {
      params.push(category);
      conditions.push(`ci.category = $${params.length}`);
    }
    if (status === 'filed') {
      conditions.push(`ci.status = 'filed'`);
    } else if (status === 'pending') {
      conditions.push(`ci.status = 'pending'`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT ci.*, s.name as linked_shipment_name, u1.name as created_by_name, u2.name as filed_by_name
       FROM compliance_items ci
       LEFT JOIN import_shipments s ON s.id = ci.linked_shipment_id
       LEFT JOIN users u1 ON u1.id = ci.created_by
       LEFT JOIN users u2 ON u2.id = ci.filed_by
       ${whereClause}
       ORDER BY ci.status ASC, ci.due_date ASC`,
      params
    );

    const items = result.rows.map(withComputedStatus);
    const summary = {
      overdue: items.filter(i => i.computed_status === 'overdue').length,
      due_soon: items.filter(i => i.computed_status === 'due_soon').length,
      upcoming: items.filter(i => i.computed_status === 'upcoming').length,
      filed: items.filter(i => i.computed_status === 'filed').length,
    };

    res.json({ success: true, items, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getComplianceItem = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ci.*, s.name as linked_shipment_name, u1.name as created_by_name, u2.name as filed_by_name
       FROM compliance_items ci
       LEFT JOIN import_shipments s ON s.id = ci.linked_shipment_id
       LEFT JOIN users u1 ON u1.id = ci.created_by
       LEFT JOIN users u2 ON u2.id = ci.filed_by
       WHERE ci.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Compliance item not found' });
    }
    res.json({ success: true, item: withComputedStatus(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createComplianceItem = async (req, res) => {
  try {
    const { title, category, due_date, recurrence, reminder_days_before, linked_shipment_id, notes } = req.body;

    if (!title || !category || !due_date) {
      return res.status(400).json({ success: false, message: 'title, category, and due_date are required' });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }
    if (recurrence && !VALID_RECURRENCES.includes(recurrence)) {
      return res.status(400).json({ success: false, message: `recurrence must be one of: ${VALID_RECURRENCES.join(', ')}` });
    }

    const result = await pool.query(
      `INSERT INTO compliance_items
        (title, category, due_date, recurrence, reminder_days_before, linked_shipment_id, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        title,
        category,
        due_date,
        recurrence || 'none',
        reminder_days_before ?? 14,
        linked_shipment_id || null,
        notes || null,
        req.user?.id || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: `Created compliance item "${title}"`,
      item: withComputedStatus(result.rows[0]),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateComplianceItem = async (req, res) => {
  try {
    const { title, category, due_date, recurrence, reminder_days_before, linked_shipment_id, notes } = req.body;

    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }
    if (recurrence && !VALID_RECURRENCES.includes(recurrence)) {
      return res.status(400).json({ success: false, message: `recurrence must be one of: ${VALID_RECURRENCES.join(', ')}` });
    }

    const existing = await pool.query('SELECT * FROM compliance_items WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: 'Compliance item not found' });
    }
    const current = existing.rows[0];

    const result = await pool.query(
      `UPDATE compliance_items
       SET title = $1, category = $2, due_date = $3, recurrence = $4,
           reminder_days_before = $5, linked_shipment_id = $6, notes = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        title ?? current.title,
        category ?? current.category,
        due_date ?? current.due_date,
        recurrence ?? current.recurrence,
        reminder_days_before ?? current.reminder_days_before,
        linked_shipment_id !== undefined ? linked_shipment_id : current.linked_shipment_id,
        notes !== undefined ? notes : current.notes,
        req.params.id,
      ]
    );

    res.json({
      success: true,
      message: `Updated compliance item #${req.params.id}`,
      item: withComputedStatus(result.rows[0]),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteComplianceItem = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM compliance_items WHERE id = $1 RETURNING title', [req.params.id]);
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Compliance item not found' });
    }
    res.json({ success: true, message: `Deleted compliance item "${result.rows[0].title}"` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Marks an item filed, and — if it recurs — automatically creates the next
// occurrence so recurring deadlines (VAT returns, PAYE, etc.) don't have to
// be re-entered by hand every month/quarter/year.
exports.fileComplianceItem = async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM compliance_items WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: 'Compliance item not found' });
    }
    const item = existing.rows[0];

    const filedResult = await pool.query(
      `UPDATE compliance_items
       SET status = 'filed', filed_by = $1, filed_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user?.id || null, req.params.id]
    );

    let nextItem = null;
    if (item.recurrence !== 'none') {
      const nextDueDate = advanceDueDate(item.due_date, item.recurrence);
      const nextResult = await pool.query(
        `INSERT INTO compliance_items
          (title, category, due_date, recurrence, reminder_days_before, linked_shipment_id, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [item.title, item.category, nextDueDate, item.recurrence, item.reminder_days_before, item.linked_shipment_id, item.notes, req.user?.id || null]
      );
      nextItem = nextResult.rows[0];
    }

    res.json({
      success: true,
      message: `Marked "${item.title}" as filed${nextItem ? `; next occurrence created for ${nextItem.due_date}` : ''}`,
      item: withComputedStatus(filedResult.rows[0]),
      next_item: nextItem ? withComputedStatus(nextItem) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
