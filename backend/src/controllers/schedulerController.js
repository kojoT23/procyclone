const pool = require('../config/db');

// customer_support included deliberately — they need to view any rider's
// schedule and add deliveries/tasks to it (that's the whole point of
// Transport's Scheduler access), not just manage their own.
const PRIVILEGED_ROLES = ['super_admin', 'admin', 'manager', 'customer_support'];

/* ── Get a schedule — own tasks by default, or anyone's if privileged ── */
const getSchedule = async (req, res) => {
  try {
    const { user_id, date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const targetUser = user_id ? parseInt(user_id) : req.user.id;

    if (targetUser !== req.user.id && !PRIVILEGED_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "You can only view your own schedule" });
    }

    const result = await pool.query(
      `SELECT st.*, u.name as assigned_to_name, ab.name as assigned_by_name,
              o.order_number, o.total_amount, o.delivery_address, o.status as order_status,
              c.name as customer_name, c.phone as customer_phone,
              dz.id as zone_id, dz.name as zone_name
       FROM scheduled_tasks st
       JOIN users u ON st.assigned_to = u.id
       LEFT JOIN users ab ON st.assigned_by = ab.id
       LEFT JOIN orders o ON st.order_id = o.id
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN delivery_zones dz ON o.delivery_zone_id = dz.id
       WHERE st.assigned_to = $1 AND st.task_date = $2
       ORDER BY st.sort_order ASC, st.created_at ASC`,
      [targetUser, targetDate]
    );

    res.json({ success: true, date: targetDate, tasks: result.rows });
  } catch (error) {
    console.error('getSchedule error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ── Create a task — privileged roles only ─────────────────────
   For type='order', this ALSO creates the real delivery assignment
   (mirroring assignDelivery in riderController.js), since assignDelivery
   never actually checked rider availability to begin with — the busy
   block was purely a frontend dropdown filter. This table adds the
   organizational "here's your day" layer on top of that real assignment,
   it doesn't replace it. */
const createTask = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { assigned_to, task_date, type, order_id, title, notes } = req.body;

    if (!assigned_to || !task_date) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'assigned_to and task_date are required' });
    }
    if (!['order', 'freeform'].includes(type)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: "type must be 'order' or 'freeform'" });
    }

    let finalTitle = title;

    if (type === 'order') {
      if (!order_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'order_id is required for an order task' });
      }
      const orderRes = await client.query('SELECT * FROM orders WHERE id = $1', [order_id]);
      if (orderRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      const order = orderRes.rows[0];

      // Same MoMo payment gate as assignDelivery — a Scheduler assignment
      // shouldn't be able to skip a rule the normal assign flow enforces.
      if (order.payment_method === 'momo' && order.payment_status !== 'paid') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          code: 'PAYMENT_NOT_VERIFIED',
          message: "This order's MoMo payment must be verified before it can be scheduled for delivery.",
        });
      }

      // scheduled_tasks.assigned_to is a users.id, but deliveries.rider_id
      // is the riders table's own separate primary key — these are NOT
      // interchangeable. Look up the actual rider row for this user before
      // touching the deliveries table at all.
      const riderRes = await client.query('SELECT id FROM riders WHERE user_id = $1', [assigned_to]);
      if (riderRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Only riders can be assigned order deliveries — this staff member has no linked rider profile.' });
      }
      const riderId = riderRes.rows[0].id;

      const existingDelivery = await client.query('SELECT * FROM deliveries WHERE order_id = $1', [order_id]);

      if (existingDelivery.rows.length === 0) {
        // Brand new assignment — unchanged from before, just using the
        // correct riderId now instead of the raw users.id.
        await client.query(
          `INSERT INTO deliveries (order_id, rider_id, assigned_at) VALUES ($1, $2, NOW())`,
          [order_id, riderId]
        );
        await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['confirmed', order_id]);
        await client.query('UPDATE riders SET is_available = false, updated_at = NOW() WHERE id = $1', [riderId]);
      } else {
        const delivery = existingDelivery.rows[0];
        if (delivery.rider_id !== riderId) {
          // Reassigning to a different rider. Only safe while the package
          // hasn't actually been picked up yet — past that point it's
          // physically with the original rider, not this new one.
          if (delivery.picked_up_at) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              success: false,
              message: 'This order has already been picked up by its current rider — it can\'t be reassigned mid-delivery.',
            });
          }

          const oldRiderId = delivery.rider_id;
          // Reset to a clean 'assigned' state for the new rider — without
          // this, they'd inherit whatever the old rider's status was
          // (e.g. 'rejected'), and see no Accept/Pickup buttons at all
          // since that status reads as already resolved.
          await client.query(
            `UPDATE deliveries SET rider_id = $1, status = 'assigned', updated_at = NOW(),
             accepted_at = NULL, rejected_at = NULL, rejection_reason = NULL
             WHERE id = $2`,
            [riderId, delivery.id]
          );
          await client.query('UPDATE riders SET is_available = false, updated_at = NOW() WHERE id = $1', [riderId]);
          // Order may currently be 'pending' (e.g. after a rejection sent it
          // back to the unassigned pool) — reassigning it is itself the
          // re-confirmation, same as a brand new assignment.
          await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['confirmed', order_id]);

          // The old rider shouldn't still see this on their schedule too —
          // it just moved to someone else's day entirely.
          await client.query('DELETE FROM scheduled_tasks WHERE order_id = $1 AND assigned_to != $2', [order_id, assigned_to]);

          // Free the old rider if this was the last thing in their queue
          // (same rule freeRiderIfQueueClear enforces in riderController.js).
          const oldRiderUser = await client.query('SELECT user_id FROM riders WHERE id = $1', [oldRiderId]);
          if (oldRiderUser.rows[0]?.user_id) {
            const remaining = await client.query(
              `SELECT COUNT(*) FROM scheduled_tasks WHERE assigned_to = $1 AND task_date = CURRENT_DATE AND status IN ('pending','in_progress')`,
              [oldRiderUser.rows[0].user_id]
            );
            if (parseInt(remaining.rows[0].count) === 0) {
              await client.query('UPDATE riders SET is_available = true, updated_at = NOW() WHERE id = $1', [oldRiderId]);
            }
          }
        }
        // else: already assigned to this same rider — no delivery change needed, just the scheduled_task below.
      }

      finalTitle = finalTitle || `Deliver order ${order.order_number}`;
    } else {
      if (!finalTitle || !finalTitle.trim()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'title is required for a freeform task' });
      }
    }

    const result = await client.query(
      `INSERT INTO scheduled_tasks (assigned_to, assigned_by, task_date, type, order_id, title, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [assigned_to, req.user?.id || null, task_date, type, type === 'order' ? order_id : null, finalTitle, notes || null]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Task scheduled', task: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createTask error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

/* ── Update task status — the assigned person themselves, or a
     privileged role acting on their behalf ─────────────────────── */
const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const task = await pool.query('SELECT assigned_to FROM scheduled_tasks WHERE id = $1', [id]);
    if (task.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    if (task.rows[0].assigned_to !== req.user.id && !PRIVILEGED_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "You can only update your own tasks" });
    }

    const result = await pool.query(
      `UPDATE scheduled_tasks SET status = $1, updated_at = NOW(),
        completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
       WHERE id = $2 RETURNING *`,
      [status, id]
    );
    res.json({ success: true, message: 'Task updated', task: result.rows[0] });
  } catch (error) {
    console.error('updateTaskStatus error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ── Delete a task — privileged roles only ─────────────────────
   For order-linked tasks, "removing from schedule" also releases the
   REAL assignment — without this, the scheduled_task disappears from
   view but the delivery/rider/order stay untouched, so the order looks
   unassigned in the Scheduler while still actually being assigned
   underneath. Always releasable now, even after pickup: the delivery
   row is deleted the same way whether or not it was picked up, since
   every screen (Transport, Rider Portal) already treats "no delivery
   row" as "needs assignment" — that's what keeps the order correctly
   reappearing as unassigned everywhere with no other changes needed.
   If it had already been picked up, that's noted on the order instead
   of silently disappearing. */
const deleteTask = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    const taskRes = await client.query('SELECT * FROM scheduled_tasks WHERE id = $1', [id]);
    if (taskRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    const task = taskRes.rows[0];

    if (task.type === 'order' && task.order_id) {
      const deliveryRes = await client.query('SELECT * FROM deliveries WHERE order_id = $1', [task.order_id]);
      if (deliveryRes.rows.length > 0) {
        const delivery = deliveryRes.rows[0];
        const riderId = delivery.rider_id;

        // Always release fully, even if the rider already picked up —
        // a blanket block here left orders permanently stuck with no way
        // to reassign. Every screen (Transport, Rider Portal) already
        // treats "no delivery row" as "needs assignment," same as a
        // brand new order, so deleting the row is what keeps every one
        // of those screens correct with no further changes. If it had
        // already been picked up, that fact is preserved as an order
        // note instead of silently disappearing.
        if (delivery.picked_up_at) {
          await client.query(
            `UPDATE orders SET notes = COALESCE(notes || E'\\n', '') ||
             'Released from rider after pickup (was picked up ' || to_char($1::timestamp, 'YYYY-MM-DD HH24:MI') || ') — reassign needed.'
             WHERE id = $2`,
            [delivery.picked_up_at, task.order_id]
          );
        }
        await client.query('DELETE FROM deliveries WHERE id = $1', [delivery.id]);
        await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['pending', task.order_id]);

        // Free the rider if this was the last thing in their queue
        const riderUser = await client.query('SELECT user_id FROM riders WHERE id = $1', [riderId]);
        if (riderUser.rows[0]?.user_id) {
          const remaining = await client.query(
            `SELECT COUNT(*) FROM scheduled_tasks
             WHERE assigned_to = $1 AND task_date = CURRENT_DATE AND status IN ('pending','in_progress') AND id != $2`,
            [riderUser.rows[0].user_id, id]
          );
          if (parseInt(remaining.rows[0].count) === 0) {
            await client.query('UPDATE riders SET is_available = true, updated_at = NOW() WHERE id = $1', [riderId]);
          }
        }
      }
    }

    await client.query('DELETE FROM scheduled_tasks WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Task removed and order released' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('deleteTask error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

/* ── Whole day, across all staff — privileged only. Powers the
     "Print Whole Day" sheet and the per-person task-count badges in the
     sidebar, both from one query rather than one call per staff member. */
const getDaySchedule = async (req, res) => {
  try {
    if (!PRIVILEGED_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT st.*, u.name as assigned_to_name, u.role as assigned_to_role,
              o.order_number, o.total_amount, o.delivery_address, o.status as order_status,
              c.name as customer_name, c.phone as customer_phone,
              dz.id as zone_id, dz.name as zone_name
       FROM scheduled_tasks st
       JOIN users u ON st.assigned_to = u.id
       LEFT JOIN orders o ON st.order_id = o.id
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN delivery_zones dz ON o.delivery_zone_id = dz.id
       WHERE st.task_date = $1
       ORDER BY u.name ASC, st.sort_order ASC, st.created_at ASC`,
      [targetDate]
    );

    res.json({ success: true, date: targetDate, tasks: result.rows });
  } catch (error) {
    console.error('getDaySchedule error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getSchedule, getDaySchedule, createTask, updateTaskStatus, deleteTask };
