const pool = require('../config/db');

const getRiders = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM riders WHERE is_active = true ORDER BY created_at DESC'
    );
    res.json({ success: true, count: result.rows.length, riders: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getRider = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM riders WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }
    res.json({ success: true, rider: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createRider = async (req, res) => {
  try {
    const { name, phone, vehicle_type, vehicle_number, vehicle_make_model, vehicle_color, zone, date_of_birth, gender, address, ghana_card_number, license_number, license_expiry, insurance_number, insurance_expiry, momo_number, emergency_name, emergency_phone, emergency_relation, passport_photo, notes, user_id } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }
    const result = await pool.query(
      `INSERT INTO riders (name, phone, vehicle_type, vehicle_number, vehicle_make_model, vehicle_color, zone, date_of_birth, gender, address, ghana_card_number, license_number, license_expiry, insurance_number, insurance_expiry, momo_number, emergency_name, emergency_phone, emergency_relation, passport_photo, notes, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
      [name, phone, vehicle_type, vehicle_number, vehicle_make_model, vehicle_color, zone, date_of_birth||null, gender, address, ghana_card_number, license_number, license_expiry||null, insurance_number, insurance_expiry||null, momo_number, emergency_name, emergency_phone, emergency_relation, passport_photo, notes, user_id||null]
    );
    res.status(201).json({ success: true, message: 'Rider created', rider: result.rows[0] });
  } catch (error) {
    console.error('createRider error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateRider = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, vehicle_type, vehicle_number, vehicle_make_model, vehicle_color, zone, date_of_birth, gender, address, ghana_card_number, license_number, license_expiry, insurance_number, insurance_expiry, momo_number, emergency_name, emergency_phone, emergency_relation, passport_photo, notes, user_id, is_available } = req.body;
    const result = await pool.query(
      `UPDATE riders SET name=$1, phone=$2, vehicle_type=$3, vehicle_number=$4,
       vehicle_make_model=$5, vehicle_color=$6, zone=$7, date_of_birth=$8,
       gender=$9, address=$10, ghana_card_number=$11, license_number=$12,
       license_expiry=$13, insurance_number=$14, insurance_expiry=$15,
       momo_number=$16, emergency_name=$17, emergency_phone=$18,
       emergency_relation=$19, passport_photo=$20, notes=$21,
       user_id=$22, is_available=COALESCE($23, is_available), updated_at=NOW()
       WHERE id=$24 RETURNING *`,
      [name, phone, vehicle_type, vehicle_number, vehicle_make_model, vehicle_color, zone, date_of_birth||null, gender, address, ghana_card_number, license_number, license_expiry||null, insurance_number, insurance_expiry||null, momo_number, emergency_name, emergency_phone, emergency_relation, passport_photo, notes, user_id||null, is_available, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }
    res.json({ success: true, message: 'Rider updated', rider: result.rows[0] });
  } catch (error) {
    console.error('updateRider error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteRider = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE riders SET is_active = false WHERE id = $1', [id]);
    res.json({ success: true, message: 'Rider removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const assignDelivery = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { order_id, rider_id } = req.body;
    const order = await client.query('SELECT * FROM orders WHERE id = $1', [order_id]);
    if (order.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const delivery = await client.query(
      `INSERT INTO deliveries (order_id, rider_id, assigned_at) VALUES ($1, $2, NOW()) RETURNING *`,
      [order_id, rider_id]
    );
    await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['confirmed', order_id]);
    await client.query('UPDATE riders SET is_available = false, updated_at = NOW() WHERE id = $1', [rider_id]);
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Delivery assigned', delivery: delivery.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('assignDelivery error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

const updateDeliveryStatus = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { status } = req.body;
    const { failure_reason, issue_type, proof_note, delivery_notes } = req.body;
    let updateQuery = 'UPDATE deliveries SET status = $1, updated_at = NOW()';
    if (status === 'picked_up') updateQuery += ', picked_up_at = NOW()';
    if (status === 'delivered') updateQuery += ', delivered_at = NOW()';
    if (failure_reason) updateQuery += `, failure_reason = '${failure_reason}'`;
    if (issue_type) updateQuery += `, issue_type = '${issue_type}'`;
    if (proof_note) updateQuery += `, proof_note = '${proof_note}'`;
    if (delivery_notes) updateQuery += `, delivery_notes = '${delivery_notes}'`;
    updateQuery += ' WHERE id = $2 RETURNING *';
    const result = await client.query(updateQuery, [status, id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }
    const delivery = result.rows[0];
    if (status === 'picked_up') {
      await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['processing', delivery.order_id]);
    }
    if (status === 'out_for_delivery') {
      await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['out_for_delivery', delivery.order_id]);
    }
    if (status === 'failed') {
      await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['failed', delivery.order_id]);
      await client.query('UPDATE riders SET is_available = true, updated_at = NOW() WHERE id = $1', [delivery.rider_id]);
    }
    if (status === 'delivered') {
      await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['delivered', delivery.order_id]);
      await client.query('UPDATE riders SET is_available = true, updated_at = NOW() WHERE id = $1', [delivery.rider_id]);

      // Auto-create cash log for COD orders
      const order = await client.query('SELECT * FROM orders WHERE id = $1', [delivery.order_id]);
      if (order.rows[0]?.payment_method === 'cod') {
        // Check if cash log already exists for this order
        const existing = await client.query('SELECT id FROM cash_logs WHERE order_id = $1', [delivery.order_id]);
        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO cash_logs (rider_id, order_id, amount, status, collected_at, confirmed_by_rider)
             VALUES ($1, $2, $3, 'pending', NOW(), true)`,
            [delivery.rider_id, delivery.order_id, order.rows[0].total_amount]
          );
        }
      }
    }
    await client.query('COMMIT');
    res.json({ success: true, message: 'Delivery status updated', delivery });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('updateDeliveryStatus error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

const resetAvailability = async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE riders SET is_available = true, updated_at = NOW() WHERE is_available = false RETURNING id"
    );
    res.json({ success: true, message: `${result.rowCount} rider${result.rowCount !== 1 ? 's' : ''} reset to available`, count: result.rowCount });
  } catch (error) {
    console.error('resetAvailability error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getRiderDeliveries = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;
    let dateFilter = '';
    let params = [id];
    if (date) {
      dateFilter = `AND DATE(d.created_at) = $2`;
      params.push(date);
    }
    const result = await pool.query(
      `SELECT
        d.id, d.status, d.assigned_at, d.picked_up_at, d.delivered_at, d.delivery_notes,
        o.id as order_id, o.order_number, o.total_amount, o.payment_method,
        o.delivery_address, o.notes as order_notes,
        c.name as customer_name, c.phone as customer_phone, c.address as customer_address
       FROM deliveries d
       JOIN orders o ON d.order_id = o.id
       JOIN customers c ON o.customer_id = c.id
       WHERE d.rider_id = $1
       ${dateFilter}
       ORDER BY d.created_at DESC`,
      params
    );
    const deliveries = await Promise.all(result.rows.map(async (d) => {
      const items = await pool.query(
        `SELECT oi.quantity, oi.unit_price, oi.total_price, p.name as product_name
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [d.order_id]
      );
      return { ...d, items: items.rows };
    }));
    res.json({ success: true, deliveries });
  } catch (error) {
    console.error('getRiderDeliveries error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getRiderStats = async (req, res) => {
  try {
    const { id } = req.params;
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const todayStats = await pool.query(
      `SELECT COUNT(*) as today_deliveries,
        COUNT(CASE WHEN d.status = 'delivered' THEN 1 END) as today_delivered,
        COUNT(CASE WHEN d.status = 'failed' THEN 1 END) as today_failed
       FROM deliveries d WHERE d.rider_id = $1 AND DATE(d.created_at) = $2`,
      [id, today]
    );
    const allStats = await pool.query(
      `SELECT COUNT(*) as total_deliveries,
        COUNT(CASE WHEN d.status = 'delivered' THEN 1 END) as total_delivered
       FROM deliveries d WHERE d.rider_id = $1`,
      [id]
    );
    const earnings = await pool.query(
      `SELECT COALESCE(SUM(o.total_amount), 0) as month_earnings
       FROM deliveries d JOIN orders o ON d.order_id = o.id
       WHERE d.rider_id = $1 AND d.status = 'delivered' AND DATE(d.created_at) >= $2`,
      [id, monthStart]
    );
    const t = todayStats.rows[0];
    const a = allStats.rows[0];
    const successRate = a.total_deliveries > 0 ? Math.round((a.total_delivered / a.total_deliveries) * 100) : 0;
    res.json({
      success: true,
      stats: {
        today_deliveries: parseInt(t.today_deliveries),
        today_delivered: parseInt(t.today_delivered),
        today_failed: parseInt(t.today_failed),
        total_deliveries: parseInt(a.total_deliveries),
        total_delivered: parseInt(a.total_delivered),
        success_rate: successRate,
        month_earnings: parseFloat(earnings.rows[0].month_earnings),
      },
    });
  } catch (error) {
    console.error('getRiderStats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getRiders, getRider, createRider, updateRider, deleteRider, assignDelivery, updateDeliveryStatus, resetAvailability, getRiderDeliveries, getRiderStats };
