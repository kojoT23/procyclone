const pool = require('../config/db');

/* ─── GET all riders ──────────────────────────────────────────── */
const getRiders = async (req, res) => {
  try {
    const { search, limit = 100, page = 1 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = ['is_active = true'];
    const values = [];
    let i = 1;

    if (search) {
      conditions.push(`(name ILIKE $${i} OR phone ILIKE $${i})`);
      values.push(`%${search}%`); i++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const countResult = await pool.query(`SELECT COUNT(*) FROM riders ${where}`, values);
    const result = await pool.query(
      `SELECT * FROM riders ${where} ORDER BY created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count:  result.rows.length,
      total:  parseInt(countResult.rows[0].count),
      pages:  Math.ceil(parseInt(countResult.rows[0].count) / limit),
      riders: result.rows,
    });
  } catch (error) {
    console.error('getRiders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─── GET one rider ───────────────────────────────────────────── */
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

/* ─── CREATE rider ────────────────────────────────────────────── */
const createRider = async (req, res) => {
  try {
    const {
      name, phone, vehicle_type, vehicle_number,
      date_of_birth, gender, address, ghana_card_number,
      license_number, license_expiry,
      vehicle_make_model, vehicle_color,
      insurance_number, insurance_expiry,
      zone, momo_number,
      emergency_name, emergency_phone, emergency_relation,
      passport_photo, notes,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }

    const result = await pool.query(
      `INSERT INTO riders (
        name, phone, vehicle_type, vehicle_number,
        date_of_birth, gender, address, ghana_card_number,
        license_number, license_expiry,
        vehicle_make_model, vehicle_color,
        insurance_number, insurance_expiry,
        zone, momo_number,
        emergency_name, emergency_phone, emergency_relation,
        passport_photo, notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
      ) RETURNING *`,
      [
        name, phone, vehicle_type || null, vehicle_number || null,
        date_of_birth || null, gender || null, address || null, ghana_card_number || null,
        license_number || null, license_expiry || null,
        vehicle_make_model || null, vehicle_color || null,
        insurance_number || null, insurance_expiry || null,
        zone || null, momo_number || null,
        emergency_name || null, emergency_phone || null, emergency_relation || null,
        passport_photo || null, notes || null,
      ]
    );

    res.status(201).json({ success: true, message: 'Rider created', rider: result.rows[0] });
  } catch (error) {
    console.error('createRider error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─── UPDATE rider ────────────────────────────────────────────── */
const updateRider = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, phone, vehicle_type, vehicle_number, is_available,
      date_of_birth, gender, address, ghana_card_number,
      license_number, license_expiry,
      vehicle_make_model, vehicle_color,
      insurance_number, insurance_expiry,
      zone, momo_number,
      emergency_name, emergency_phone, emergency_relation,
      passport_photo, notes,
    } = req.body;

    const result = await pool.query(
      `UPDATE riders SET
        name               = COALESCE($1,  name),
        phone              = COALESCE($2,  phone),
        vehicle_type       = COALESCE($3,  vehicle_type),
        vehicle_number     = COALESCE($4,  vehicle_number),
        is_available       = COALESCE($5,  is_available),
        date_of_birth      = COALESCE($6,  date_of_birth),
        gender             = COALESCE($7,  gender),
        address            = COALESCE($8,  address),
        ghana_card_number  = COALESCE($9,  ghana_card_number),
        license_number     = COALESCE($10, license_number),
        license_expiry     = COALESCE($11, license_expiry),
        vehicle_make_model = COALESCE($12, vehicle_make_model),
        vehicle_color      = COALESCE($13, vehicle_color),
        insurance_number   = COALESCE($14, insurance_number),
        insurance_expiry   = COALESCE($15, insurance_expiry),
        zone               = COALESCE($16, zone),
        momo_number        = COALESCE($17, momo_number),
        emergency_name     = COALESCE($18, emergency_name),
        emergency_phone    = COALESCE($19, emergency_phone),
        emergency_relation = COALESCE($20, emergency_relation),
        passport_photo     = COALESCE($21, passport_photo),
        notes              = COALESCE($22, notes),
        updated_at         = NOW()
       WHERE id = $23
       RETURNING *`,
      [
        name, phone, vehicle_type, vehicle_number, is_available,
        date_of_birth || null, gender || null, address || null, ghana_card_number || null,
        license_number || null, license_expiry || null,
        vehicle_make_model || null, vehicle_color || null,
        insurance_number || null, insurance_expiry || null,
        zone || null, momo_number || null,
        emergency_name || null, emergency_phone || null, emergency_relation || null,
        passport_photo || null, notes || null,
        id,
      ]
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

/* ─── DELETE rider (soft delete) ─────────────────────────────── */
const deleteRider = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE riders SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );
    res.json({ success: true, message: 'Rider removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─── ASSIGN delivery ─────────────────────────────────────────── */
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
      `INSERT INTO deliveries (order_id, rider_id, assigned_at)
       VALUES ($1, $2, NOW()) RETURNING *`,
      [order_id, rider_id]
    );

    await client.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
      ['confirmed', order_id]
    );

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

/* ─── UPDATE delivery status ──────────────────────────────────── */
const updateDeliveryStatus = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { status } = req.body;

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

module.exports = {
  getRiders, getRider, createRider, updateRider,
  deleteRider, assignDelivery, updateDeliveryStatus,
};
