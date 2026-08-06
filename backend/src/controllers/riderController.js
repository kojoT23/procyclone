const pool = require('../config/db');

// Same privileged set as schedulerController.js — these roles can view
// any rider's deliveries/stats (dashboard, Transport support work);
// everyone else may only view their own.
const PRIVILEGED_ROLES = ['super_admin', 'admin', 'manager', 'customer_support'];

// :id on these routes is always a riders.id, not a users.id — so
// ownership can't be checked by comparing req.user.id to :id directly.
// Look up which user actually owns that rider row first.
const canViewRider = async (client, riderIdParam, reqUser) => {
  if (PRIVILEGED_ROLES.includes(reqUser.role)) return true;
  const rider = await client.query('SELECT user_id FROM riders WHERE id = $1', [riderIdParam]);
  return rider.rows.length > 0 && rider.rows[0].user_id === reqUser.id;
};

// Fields every screen actually needs about a rider OTHER than yourself
// (Transport's assign dropdown, the Rider Portal's own myRider lookup).
// Everything else — Ghana Card, license, MoMo number, DOB, home address,
// emergency contacts, phone — is PII that has no business being sent to
// every logged-in user just because the riders list loads.
const PUBLIC_RIDER_FIELDS = ['id', 'user_id', 'name', 'zone', 'is_available'];

const toPublicRider = (row) => {
  const safe = {};
  PUBLIC_RIDER_FIELDS.forEach(f => { safe[f] = row[f]; });
  return safe;
};

// Privileged roles see everything, always. A rider sees full detail on
// their OWN row (needed for their profile screen) but only the safe
// public subset for every other rider.
const scopeRiderRow = (row, reqUser) => {
  if (PRIVILEGED_ROLES.includes(reqUser.role)) return row;
  if (row.user_id === reqUser.id) return row;
  return toPublicRider(row);
};

const getRiders = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM riders WHERE is_active = true ORDER BY created_at DESC'
    );
    const riders = result.rows.map(row => scopeRiderRow(row, req.user));
    res.json({ success: true, count: riders.length, riders });
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
    res.json({ success: true, rider: scopeRiderRow(result.rows[0], req.user) });
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

    // MoMo orders must have their payment verified on the dashboard before
    // a rider can be assigned. Cash/COD are treated as confirmed at the
    // point of sale (cash in hand, or collected on delivery) — only MoMo
    // has a real "did this actually go through" question, so only MoMo
    // gets gated here.
    if (order.rows[0].payment_method === 'momo' && order.rows[0].payment_status !== 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        code: 'PAYMENT_NOT_VERIFIED',
        message: "This order's MoMo payment must be verified before a rider can be assigned.",
      });
    }
    // Guard against duplicate delivery rows for the same order — without
    // this, a double-click or a retried request would INSERT a second
    // deliveries row for an order that's already assigned, and the rider
    // would see the same order twice in their list.
    const existingDelivery = await client.query('SELECT * FROM deliveries WHERE order_id = $1', [order_id]);

    if (existingDelivery.rows.length === 0) {
      // Brand new assignment — unchanged from before.
      const delivery = await client.query(
        `INSERT INTO deliveries (order_id, rider_id, assigned_at) VALUES ($1, $2, NOW()) RETURNING *`,
        [order_id, rider_id]
      );
      await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['confirmed', order_id]);
      await client.query('UPDATE riders SET is_available = false, updated_at = NOW() WHERE id = $1', [rider_id]);
      await client.query('COMMIT');
      return res.status(201).json({ success: true, message: 'Delivery assigned', delivery: delivery.rows[0] });
    }

    const delivery = existingDelivery.rows[0];

    if (delivery.rider_id === rider_id) {
      // Same rider re-submitted (double-click, retry) — idempotent no-op,
      // just return what's already there instead of erroring or duplicating.
      await client.query('COMMIT');
      return res.status(200).json({ success: true, message: 'Delivery already assigned', delivery });
    }

    // Different rider than currently assigned — only safe to move while
    // the package hasn't actually been picked up yet, same rule the
    // Scheduler's reassignment enforces.
    if (delivery.picked_up_at) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This order has already been picked up by its current rider — it can\'t be reassigned mid-delivery.',
      });
    }

    const oldRiderId = delivery.rider_id;
    const updatedDelivery = await client.query(
      `UPDATE deliveries SET rider_id = $1, status = 'assigned', updated_at = NOW(),
       accepted_at = NULL, rejected_at = NULL, rejection_reason = NULL
       WHERE id = $2 RETURNING *`,
      [rider_id, delivery.id]
    );
    await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['confirmed', order_id]);
    await client.query('UPDATE riders SET is_available = false, updated_at = NOW() WHERE id = $1', [rider_id]);
    await freeRiderIfQueueClear(client, oldRiderId);
    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Delivery reassigned', delivery: updatedDelivery.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('assignDelivery error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

// scheduled_tasks and deliveries are separate tables with no automatic
// link between them — without this, an order-linked task would never
// reflect what's actually happening with its real delivery. Order tasks
// are meant to be read-only reflections of the real delivery's progress,
// NOT manually completed from the Schedule screen itself (that would skip
// proof-of-delivery entirely and leave the order's own status stuck).
const syncLinkedTaskStatus = async (client, orderId, taskStatus) => {
  const completedAt = taskStatus === 'completed' ? ', completed_at = NOW()' : '';
  await client.query(
    `UPDATE scheduled_tasks SET status = $1, updated_at = NOW()${completedAt}
     WHERE order_id = $2 AND status NOT IN ('completed', 'cancelled')`,
    [taskStatus, orderId]
  );
};

// Only marks a rider available again once their WHOLE day's Scheduler
// queue is clear — not the instant any single delivery finishes. Without
// this, a rider with three more scheduled stops would show as
// "available" the moment they finish the first one, letting the normal
// checkout dropdown pull them into an unrelated delivery and derail the
// route they were actually planning around location. A rider with no
// Scheduler queue at all (the normal one-off assignment case) behaves
// exactly as before, since the query below simply finds nothing pending.
const freeRiderIfQueueClear = async (client, riderId) => {
  // scheduled_tasks.assigned_to stores users.id, but riderId here is a
  // riders.id (every call site passes delivery.rider_id/oldRiderId) —
  // two different ID spaces. Without this lookup, the count below either
  // undercounts (nothing matches) or coincidentally matches an unrelated
  // user with that same numeric id, freeing the rider regardless of
  // their real remaining workload for the day.
  const riderRow = await client.query('SELECT user_id FROM riders WHERE id = $1', [riderId]);
  const userId = riderRow.rows[0]?.user_id;
  if (!userId) return; // no linked login — nothing in scheduled_tasks to check

  const remaining = await client.query(
    `SELECT COUNT(*) FROM scheduled_tasks
     WHERE assigned_to = $1 AND task_date = CURRENT_DATE AND status IN ('pending', 'in_progress')`,
    [userId]
  );
  if (parseInt(remaining.rows[0].count) === 0) {
    await client.query('UPDATE riders SET is_available = true, updated_at = NOW() WHERE id = $1', [riderId]);
  }
};

const updateDeliveryStatus = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { status, failure_reason, issue_type, proof_note, delivery_notes, proof_photo, recipient_name, rejection_reason } = req.body;

    if (status === 'rejected' && !rejection_reason?.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'A reason is required to reject a delivery' });
    }

    // Built with parameterized placeholders throughout — a previous version
    // interpolated these fields directly into the SQL string
    // (`failure_reason = '${failure_reason}'`), which is a SQL injection
    // vulnerability. Anything from req.body must go through $N params.
    const setClauses = ['status = $1', 'updated_at = NOW()'];
    const values = [status];
    let i = 2;

    if (status === 'accepted') setClauses.push('accepted_at = NOW()');
    if (status === 'rejected') setClauses.push('rejected_at = NOW()');
    if (status === 'picked_up') setClauses.push('picked_up_at = NOW()');
    if (status === 'delivered') setClauses.push('delivered_at = NOW()');
    if (rejection_reason) { setClauses.push(`rejection_reason = $${i++}`); values.push(rejection_reason); }
    if (failure_reason)  { setClauses.push(`failure_reason = $${i++}`);  values.push(failure_reason); }
    if (issue_type)      { setClauses.push(`issue_type = $${i++}`);      values.push(issue_type); }
    if (proof_note)      { setClauses.push(`proof_note = $${i++}`);      values.push(proof_note); }
    if (delivery_notes)  { setClauses.push(`delivery_notes = $${i++}`);  values.push(delivery_notes); }
    if (proof_photo)     { setClauses.push(`proof_photo = $${i++}`);     values.push(proof_photo); }
    if (recipient_name)  { setClauses.push(`recipient_name = $${i++}`);  values.push(recipient_name); }

    values.push(id);
    const result = await client.query(
      `UPDATE deliveries SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }
    const delivery = result.rows[0];
    if (status === 'accepted') {
      await syncLinkedTaskStatus(client, delivery.order_id, 'in_progress');
    }
    if (status === 'rejected') {
      // Send the order back to the unassigned pool — a dispatcher can pick
      // it up again via Scheduler's reassignment flow. Unlike a failed
      // delivery (which happened mid-attempt), a rejection means this
      // rider never started, so nothing about the order itself failed.
      await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['pending', delivery.order_id]);
      await syncLinkedTaskStatus(client, delivery.order_id, 'cancelled');
      await freeRiderIfQueueClear(client, delivery.rider_id);
    }
    if (status === 'picked_up') {
      await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['processing', delivery.order_id]);
      await syncLinkedTaskStatus(client, delivery.order_id, 'in_progress');
    }
    if (status === 'out_for_delivery') {
      await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['out_for_delivery', delivery.order_id]);
    }
    if (status === 'failed') {
      await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['failed', delivery.order_id]);
      await syncLinkedTaskStatus(client, delivery.order_id, 'completed');
      await freeRiderIfQueueClear(client, delivery.rider_id);
    }
    if (status === 'delivered') {
      await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['delivered', delivery.order_id]);
      await syncLinkedTaskStatus(client, delivery.order_id, 'completed');
      await freeRiderIfQueueClear(client, delivery.rider_id);

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
    if (!(await canViewRider(pool, id, req.user))) {
      return res.status(403).json({ success: false, message: 'You can only view your own deliveries' });
    }
    const { date } = req.query;
    let dateFilter = '';
    let params = [id];
    if (date) {
      dateFilter = `AND DATE(d.created_at) = $2`;
      params.push(date);
    }
    const result = await pool.query(
      `SELECT
        d.id, d.status, d.assigned_at, d.accepted_at, d.rejected_at, d.rejection_reason, d.picked_up_at, d.delivered_at, d.delivery_notes,
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
    if (!(await canViewRider(pool, id, req.user))) {
      return res.status(403).json({ success: false, message: 'You can only view your own stats' });
    }
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
