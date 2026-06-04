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
    const { name, phone, vehicle_type, vehicle_number } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }
    const result = await pool.query(
      `INSERT INTO riders (name, phone, vehicle_type, vehicle_number)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, phone, vehicle_type, vehicle_number]
    );
    res.status(201).json({ success: true, message: 'Rider created', rider: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateRider = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, vehicle_type, vehicle_number, is_available } = req.body;
    const result = await pool.query(
      `UPDATE riders SET name=$1, phone=$2, vehicle_type=$3, vehicle_number=$4,
       is_available=$5, updated_at=NOW() WHERE id=$6 RETURNING *`,
      [name, phone, vehicle_type, vehicle_number, is_available, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }
    res.json({ success: true, message: 'Rider updated', rider: result.rows[0] });
  } catch (error) {
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

    // Check order exists and is pending
    const order = await client.query('SELECT * FROM orders WHERE id = $1', [order_id]);
    if (order.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Create delivery record
    const delivery = await client.query(
      `INSERT INTO deliveries (order_id, rider_id, assigned_at)
       VALUES ($1, $2, NOW()) RETURNING *`,
      [order_id, rider_id]
    );

    // Update order status to confirmed + store rider info
    await client.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
      ['confirmed', order_id]
    );

    // Mark rider as busy
    await client.query(
      'UPDATE riders SET is_available = false, updated_at = NOW() WHERE id = $1',
      [rider_id]
    );

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

    // Build delivery update query
    let updateQuery = 'UPDATE deliveries SET status = $1, updated_at = NOW()';
    if (status === 'picked_up') updateQuery += ', picked_up_at = NOW()';
    if (status === 'delivered') updateQuery += ', delivered_at = NOW()';
    updateQuery += ' WHERE id = $2 RETURNING *';

    const result = await client.query(updateQuery, [status, id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }

    const delivery = result.rows[0];

    // Sync order status
    if (status === 'picked_up') {
      await client.query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
        ['processing', delivery.order_id]
      );
    }

    if (status === 'delivered') {
      await client.query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
        ['delivered', delivery.order_id]
      );
      // Mark rider available again
      await client.query(
        'UPDATE riders SET is_available = true, updated_at = NOW() WHERE id = $1',
        [delivery.rider_id]
      );
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

module.exports = { getRiders, getRider, createRider, updateRider, deleteRider, assignDelivery, updateDeliveryStatus };
