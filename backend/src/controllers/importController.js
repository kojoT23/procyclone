const pool = require('../config/db');

/* ═══════════════════════════════════════════════════════════════════
   TOTALS SQL — all correlated subqueries against import_shipments
   aliased as `s`. Kept as scalar subqueries (not JOINs) so a shipment
   with zero items or zero cost rows still returns a real 0, not a
   dropped row or a NULL that breaks arithmetic downstream.
═══════════════════════════════════════════════════════════════════ */
const CUSTOM_ITEMS_TOTAL_SQL = `
  COALESCE((SELECT SUM(amount) FROM import_shipment_cost_items ci WHERE ci.shipment_id = s.id), 0)
`;

// Product cost is in purchase_currency until multiplied by the exchange
// rate — everything else on the shipment (shipping, customs, etc.) is
// already GHS, so this is the one place a currency conversion happens.
const PRODUCT_COST_BUDGETED_SQL = `
  COALESCE((SELECT SUM(i.purchase_unit_price * i.quantity_ordered) FROM import_shipment_items i WHERE i.shipment_id = s.id), 0)
  * s.exchange_rate_used
`;
const PRODUCT_COST_ACTUAL_SQL = `
  COALESCE((SELECT SUM(
    COALESCE(i.actual_purchase_unit_price, i.purchase_unit_price)
    * COALESCE(i.quantity_received, i.quantity_ordered)
  ) FROM import_shipment_items i WHERE i.shipment_id = s.id), 0)
  * COALESCE(s.actual_exchange_rate_used, s.exchange_rate_used)
`;

const SHARED_COSTS_BUDGETED_SQL = `
  (s.shipping_cost + s.customs_duty + s.clearing_agent_fee + s.inland_transport_cost + s.other_fees)
  + ${CUSTOM_ITEMS_TOTAL_SQL}
`;
const SHARED_COSTS_ACTUAL_SQL = `
  (COALESCE(s.actual_shipping_cost, s.shipping_cost)
   + COALESCE(s.actual_customs_duty, s.customs_duty)
   + COALESCE(s.actual_clearing_agent_fee, s.clearing_agent_fee)
   + COALESCE(s.actual_inland_transport_cost, s.inland_transport_cost)
   + COALESCE(s.actual_other_fees, s.other_fees))
  + ${CUSTOM_ITEMS_TOTAL_SQL}
`;

const BUDGETED_TOTAL_SQL = `(${PRODUCT_COST_BUDGETED_SQL} + ${SHARED_COSTS_BUDGETED_SQL})`;
const ACTUAL_TOTAL_SQL = `(${PRODUCT_COST_ACTUAL_SQL} + ${SHARED_COSTS_ACTUAL_SQL})`;

const PROJECTED_REVENUE_SQL = `
  COALESCE((SELECT SUM(i.expected_selling_price_per_unit * i.quantity_ordered)
    FROM import_shipment_items i
    WHERE i.shipment_id = s.id AND i.expected_selling_price_per_unit IS NOT NULL), 0)
`;
// Planning estimate, not a promise — see note on the old version. Uses
// the actual total once the shipment is received, budgeted before then.
const PROJECTED_PROFIT_SQL = `
  (${PROJECTED_REVENUE_SQL} - (CASE WHEN s.status = 'received' THEN ${ACTUAL_TOTAL_SQL} ELSE ${BUDGETED_TOTAL_SQL} END))
`;

const SELECT_WITH_TOTALS = `
  SELECT s.*, u.name as created_by_name, sup.name as supplier_name, sup.country as supplier_country,
    (SELECT COUNT(*) FROM import_shipment_items i WHERE i.shipment_id = s.id) as item_count,
    ${BUDGETED_TOTAL_SQL} as budgeted_total,
    ${ACTUAL_TOTAL_SQL} as actual_total,
    ${PROJECTED_REVENUE_SQL} as projected_revenue,
    ${PROJECTED_PROFIT_SQL} as projected_profit
  FROM import_shipments s
  LEFT JOIN users u ON s.created_by = u.id
  LEFT JOIN suppliers sup ON s.supplier_id = sup.id
`;

/* ── Health badge thresholds — margin = profit / revenue ────────── */
const healthFor = (profit, revenue) => {
  if (!revenue || revenue <= 0) return null;
  const margin = (profit / revenue) * 100;
  if (margin > 40) return 'excellent';
  if (margin >= 25) return 'good';
  if (margin >= 10) return 'low';
  return 'loss';
};

const replaceCostItems = async (client, shipmentId, costItems) => {
  await client.query('DELETE FROM import_shipment_cost_items WHERE shipment_id = $1', [shipmentId]);
  const items = (costItems || []).filter(i => i && i.label && i.label.trim());
  for (const item of items) {
    await client.query(
      'INSERT INTO import_shipment_cost_items (shipment_id, label, amount) VALUES ($1, $2, $3)',
      [shipmentId, item.label.trim(), parseFloat(item.amount) || 0]
    );
  }
};
const getCostItems = async (shipmentId) => {
  const res = await pool.query(
    'SELECT id, label, amount FROM import_shipment_cost_items WHERE shipment_id = $1 ORDER BY id ASC',
    [shipmentId]
  );
  return res.rows;
};

// Shared by createShipment/updateShipment — replaces a shipment's entire
// set of product line items, same delete-then-reinsert pattern as cost
// items. product_id may be null (legacy/unlinked row) but every other
// field is required.
const replaceItems = async (client, shipmentId, items) => {
  await client.query('DELETE FROM import_shipment_items WHERE shipment_id = $1', [shipmentId]);
  const rows = (items || []).filter(i => i && i.quantity_ordered > 0);
  for (const item of rows) {
    await client.query(
      `INSERT INTO import_shipment_items
        (shipment_id, product_id, quantity_ordered, quantity_received, purchase_unit_price, expected_selling_price_per_unit,
         carton_length_cm, carton_width_cm, carton_height_cm, carton_weight_kg, cartons_qty, hs_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        shipmentId, item.product_id || null, item.quantity_ordered,
        item.quantity_ordered, // quantity_received defaults to ordered qty until stock is confirmed
        parseFloat(item.purchase_unit_price) || 0,
        item.expected_selling_price_per_unit ? parseFloat(item.expected_selling_price_per_unit) : null,
        item.carton_length_cm ? parseFloat(item.carton_length_cm) : null,
        item.carton_width_cm ? parseFloat(item.carton_width_cm) : null,
        item.carton_height_cm ? parseFloat(item.carton_height_cm) : null,
        item.carton_weight_kg ? parseFloat(item.carton_weight_kg) : null,
        item.cartons_qty ? parseInt(item.cartons_qty) : null,
        item.hs_code || null,
      ]
    );
  }
};

const getItems = async (shipmentId) => {
  const res = await pool.query(
    `SELECT i.*, p.name as product_name, p.stock_quantity as product_current_stock
     FROM import_shipment_items i
     LEFT JOIN products p ON i.product_id = p.id
     WHERE i.shipment_id = $1 ORDER BY i.id ASC`,
    [shipmentId]
  );
  return res.rows;
};

/* ── Allocates shared shipment costs across items proportionally to
   each item's own product cost — done in JS, not SQL, because it's far
   more readable here and only needed for the single-shipment detail
   view (the list view only needs shipment-level totals). This is what
   makes a multi-product shipment's per-product profit numbers fair:
   a GHS 2000 item absorbs 10x the shared customs/shipping cost that a
   GHS 200 item does, not an equal split per line. ── */
const allocateItemCosts = (items, shipment) => {
  const isReceived = shipment.status === 'received';
  const rate = isReceived
    ? parseFloat(shipment.actual_exchange_rate_used || shipment.exchange_rate_used)
    : parseFloat(shipment.exchange_rate_used);

  const sharedTotal = isReceived
    ? parseFloat(shipment.actual_shipping_cost ?? shipment.shipping_cost)
      + parseFloat(shipment.actual_customs_duty ?? shipment.customs_duty)
      + parseFloat(shipment.actual_clearing_agent_fee ?? shipment.clearing_agent_fee)
      + parseFloat(shipment.actual_inland_transport_cost ?? shipment.inland_transport_cost)
      + parseFloat(shipment.actual_other_fees ?? shipment.other_fees)
      + parseFloat(shipment.custom_items_total || 0)
    : parseFloat(shipment.shipping_cost) + parseFloat(shipment.customs_duty)
      + parseFloat(shipment.clearing_agent_fee) + parseFloat(shipment.inland_transport_cost)
      + parseFloat(shipment.other_fees) + parseFloat(shipment.custom_items_total || 0);

  const itemProductCosts = items.map(item => {
    const unitPrice = isReceived ? parseFloat(item.actual_purchase_unit_price ?? item.purchase_unit_price) : parseFloat(item.purchase_unit_price);
    const qty = isReceived ? (item.quantity_received ?? item.quantity_ordered) : item.quantity_ordered;
    return unitPrice * qty * rate;
  });
  const totalProductCost = itemProductCosts.reduce((a, b) => a + b, 0);

  return items.map((item, idx) => {
    const productCostGhs = itemProductCosts[idx];
    const shareOfShared = totalProductCost > 0 ? (productCostGhs / totalProductCost) * sharedTotal : 0;
    const usableQty = Math.max(0, (item.quantity_received ?? item.quantity_ordered) - (item.quantity_damaged || 0) - (item.quantity_missing || 0));
    const allocatedLandedCost = productCostGhs + shareOfShared;
    const landedCostPerUnit = usableQty > 0 ? allocatedLandedCost / usableQty : 0;
    const sellingPrice = parseFloat(item.expected_selling_price_per_unit) || 0;
    const profitPerUnit = sellingPrice - landedCostPerUnit;
    return {
      ...item,
      product_cost_ghs: Math.round(productCostGhs * 100) / 100,
      allocated_shared_cost: Math.round(shareOfShared * 100) / 100,
      allocated_landed_cost: Math.round(allocatedLandedCost * 100) / 100,
      usable_quantity: usableQty,
      landed_cost_per_unit: Math.round(landedCostPerUnit * 100) / 100,
      profit_per_unit: Math.round(profitPerUnit * 100) / 100,
      total_item_profit: Math.round(profitPerUnit * usableQty * 100) / 100,
    };
  });
};

const getShipments = async (req, res) => {
  try {
    const { status, supplier_id, hs_code, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];
    let p = 1;
    if (status && status !== 'all') { conditions.push(`s.status = $${p++}`); params.push(status); }
    if (supplier_id) { conditions.push(`s.supplier_id = $${p++}`); params.push(supplier_id); }
    if (hs_code) {
      conditions.push(`EXISTS (SELECT 1 FROM import_shipment_items i WHERE i.shipment_id = s.id AND i.hs_code ILIKE $${p++})`);
      params.push(`%${hs_code}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const countResult = await pool.query(`SELECT COUNT(*) FROM import_shipments s ${where}`, params);
    const result = await pool.query(
      `${SELECT_WITH_TOTALS} ${where} ORDER BY s.created_at DESC LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );

    const shipments = result.rows.map(s => ({
      ...s,
      health: healthFor(parseFloat(s.projected_profit), parseFloat(s.projected_revenue)),
    }));

    res.json({
      success: true,
      shipments,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit),
    });
  } catch (error) {
    console.error('getShipments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getShipment = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`${SELECT_WITH_TOTALS} WHERE s.id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }
    const shipment = result.rows[0];
    const cost_items = await getCostItems(id);
    const rawItems = await getItems(id);
    const custom_items_total = cost_items.reduce((s, c) => s + parseFloat(c.amount), 0);
    const items = allocateItemCosts(rawItems, { ...shipment, custom_items_total });

    res.json({
      success: true,
      shipment: {
        ...shipment,
        health: healthFor(parseFloat(shipment.projected_profit), parseFloat(shipment.projected_revenue)),
        cost_items,
        items,
      },
    });
  } catch (error) {
    console.error('getShipment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createShipment = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      supplier_id, purchase_currency, exchange_rate_used,
      shipping_cost, customs_duty, clearing_agent_fee, inland_transport_cost, other_fees,
      expected_arrival, notes, cost_items, items, ucr_number, boe_number, name,
      duty_rate_pct, ecowas_levy_pct, au_levy_pct, exim_levy_pct, processing_fee_pct, vat_pct, nhil_pct, getfund_pct,
    } = req.body;

    if (!items || items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Add at least one product to the shipment' });
    }
    if (items.some(i => !i.quantity_ordered || i.quantity_ordered <= 0)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Every product needs a quantity greater than 0' });
    }
    if ((purchase_currency && purchase_currency !== 'GHS') && (!exchange_rate_used || parseFloat(exchange_rate_used) <= 0)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Enter the exchange rate used for this currency' });
    }

    const result = await client.query(
      `INSERT INTO import_shipments
        (supplier_id, purchase_currency, exchange_rate_used, shipping_cost, customs_duty,
         clearing_agent_fee, inland_transport_cost, other_fees, expected_arrival, notes, created_by,
         ucr_number, boe_number, name,
         duty_rate_pct, ecowas_levy_pct, au_levy_pct, exim_levy_pct, processing_fee_pct, vat_pct, nhil_pct, getfund_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
      [
        supplier_id || null, purchase_currency || 'GHS', exchange_rate_used || 1,
        shipping_cost || 0, customs_duty || 0, clearing_agent_fee || 0, inland_transport_cost || 0, other_fees || 0,
        expected_arrival || null, notes || null, req.user.id,
        ucr_number || null, boe_number || null, name || null,
        duty_rate_pct ?? null, ecowas_levy_pct ?? null, au_levy_pct ?? null, exim_levy_pct ?? null,
        processing_fee_pct ?? null, vat_pct ?? null, nhil_pct ?? null, getfund_pct ?? null,
      ]
    );
    const shipment = result.rows[0];

    await replaceItems(client, shipment.id, items);
    await replaceCostItems(client, shipment.id, cost_items);

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Shipment budgeted', shipment: { ...shipment, items: await getItems(shipment.id), cost_items: await getCostItems(shipment.id) } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createShipment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

const updateShipment = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const {
      supplier_id, purchase_currency, exchange_rate_used,
      shipping_cost, customs_duty, clearing_agent_fee, inland_transport_cost, other_fees,
      actual_shipping_cost, actual_customs_duty, actual_clearing_agent_fee,
      actual_inland_transport_cost, actual_other_fees, actual_exchange_rate_used,
      expected_arrival, notes, cost_items, items, ucr_number, boe_number, name,
      duty_rate_pct, ecowas_levy_pct, au_levy_pct, exim_levy_pct, processing_fee_pct, vat_pct, nhil_pct, getfund_pct,
    } = req.body;

    const existing = await client.query('SELECT * FROM import_shipments WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }
    if (['received', 'cancelled'].includes(existing.rows[0].status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'This shipment is finalized and can no longer be edited' });
    }
    if (!items || items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'A shipment needs at least one product' });
    }

    const result = await client.query(
      `UPDATE import_shipments SET
        supplier_id = $1, purchase_currency = $2, exchange_rate_used = $3,
        shipping_cost = $4, customs_duty = $5, clearing_agent_fee = $6, inland_transport_cost = $7, other_fees = $8,
        actual_shipping_cost = $9, actual_customs_duty = $10, actual_clearing_agent_fee = $11,
        actual_inland_transport_cost = $12, actual_other_fees = $13, actual_exchange_rate_used = $14,
        expected_arrival = $15, notes = $16, ucr_number = $17, boe_number = $18, name = $19,
        duty_rate_pct = $20, ecowas_levy_pct = $21, au_levy_pct = $22, exim_levy_pct = $23,
        processing_fee_pct = $24, vat_pct = $25, nhil_pct = $26, getfund_pct = $27,
        updated_at = NOW()
       WHERE id = $28 RETURNING *`,
      [
        supplier_id || null, purchase_currency || 'GHS', exchange_rate_used || 1,
        shipping_cost || 0, customs_duty || 0, clearing_agent_fee || 0, inland_transport_cost || 0, other_fees || 0,
        actual_shipping_cost ?? null, actual_customs_duty ?? null, actual_clearing_agent_fee ?? null,
        actual_inland_transport_cost ?? null, actual_other_fees ?? null, actual_exchange_rate_used ?? null,
        expected_arrival || null, notes || null, ucr_number || null, boe_number || null, name || null,
        duty_rate_pct ?? null, ecowas_levy_pct ?? null, au_levy_pct ?? null, exim_levy_pct ?? null,
        processing_fee_pct ?? null, vat_pct ?? null, nhil_pct ?? null, getfund_pct ?? null, id,
      ]
    );
    const shipment = result.rows[0];

    await replaceItems(client, shipment.id, items);
    await replaceCostItems(client, shipment.id, cost_items);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Shipment updated', shipment: { ...shipment, items: await getItems(shipment.id), cost_items: await getCostItems(shipment.id) } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('updateShipment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

/* ── PUT /api/imports/:id/status ──────────────────────────────────
   Moves planning -> ordered -> shipped -> received (or -> cancelled).
   Marking 'received' locks costs and creates the linked expense — it
   does NOT touch product stock. That's a deliberate second gate, see
   confirmStock below: a wrong quantity typed while clearing customs
   shouldn't be able to silently corrupt real sellable stock counts. */
const updateShipmentStatus = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['planning', 'ordered', 'shipped', 'received', 'cancelled'];
    if (!validStatuses.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const existing = await client.query('SELECT * FROM import_shipments WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }
    const shipment = existing.rows[0];
    if (['received', 'cancelled'].includes(shipment.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `This shipment is already ${shipment.status} and can't be changed further` });
    }

    let expenseId = shipment.expense_id;

    if (status === 'received') {
      const totalRes = await client.query(`SELECT ${ACTUAL_TOTAL_SQL} as actual_total FROM import_shipments s WHERE s.id = $1`, [id]);
      const actualTotal = parseFloat(totalRes.rows[0].actual_total);
      const itemsRes = await client.query(
        `SELECT COUNT(*) as n, STRING_AGG(COALESCE(p.name, i.legacy_description, 'item'), ', ') as names
         FROM import_shipment_items i LEFT JOIN products p ON i.product_id = p.id
         WHERE i.shipment_id = $1`, [id]
      );
      const supplierRes = await client.query('SELECT name FROM suppliers WHERE id = $1', [shipment.supplier_id]);

      const expense = await client.query(
        `INSERT INTO expenses (category, description, amount, expense_date, payment_method, notes, created_by)
         VALUES ('import', $1, $2, CURRENT_DATE, 'bank_transfer', $3, $4) RETURNING id`,
        [
          `China import: ${itemsRes.rows[0].names || `${itemsRes.rows[0].n} item(s)`}`,
          actualTotal,
          supplierRes.rows[0]?.name ? `Supplier: ${supplierRes.rows[0].name}` : null,
          req.user.id,
        ]
      );
      expenseId = expense.rows[0].id;
    }

    const result = await client.query(
      `UPDATE import_shipments SET
         status = $1,
         received_at = CASE WHEN $1::varchar = 'received' THEN NOW() ELSE received_at END,
         expense_id = $2,
         updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, expenseId, id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Shipment status updated', shipment: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('updateShipmentStatus error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

/* ── PUT /api/imports/:id/confirm-stock — the second gate ─────────
   Only reachable once status = 'received' and stock hasn't already
   been confirmed. Accepts final received/damaged/missing counts per
   item (defaults to what was already on the item if not overridden),
   then — and only then — touches products.stock_quantity, logging
   the exact same stock_movements shape receivePurchaseOrder already
   uses, just with reference_type = 'import_shipment' so both systems
   share one real audit trail instead of two disconnected ones. */
const confirmStock = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { items } = req.body; // [{ id, quantity_received, quantity_damaged, quantity_missing }]

    const shipmentRes = await client.query('SELECT * FROM import_shipments WHERE id = $1', [id]);
    if (shipmentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }
    const shipment = shipmentRes.rows[0];
    if (shipment.status !== 'received') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: "Mark this shipment as 'received' before confirming stock" });
    }
    if (shipment.stock_confirmed_at) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Stock has already been confirmed for this shipment' });
    }

    const existingItems = await client.query('SELECT * FROM import_shipment_items WHERE shipment_id = $1', [id]);
    const overrides = new Map((items || []).map(i => [i.id, i]));

    for (const item of existingItems.rows) {
      const override = overrides.get(item.id);
      const qtyReceived = override?.quantity_received ?? item.quantity_received ?? item.quantity_ordered;
      const qtyDamaged = override?.quantity_damaged ?? item.quantity_damaged ?? 0;
      const qtyMissing = override?.quantity_missing ?? item.quantity_missing ?? 0;
      const usableQty = Math.max(0, qtyReceived - qtyDamaged - qtyMissing);

      await client.query(
        `UPDATE import_shipment_items SET quantity_received = $1, quantity_damaged = $2, quantity_missing = $3, updated_at = NOW() WHERE id = $4`,
        [qtyReceived, qtyDamaged, qtyMissing, item.id]
      );

      if (item.product_id && usableQty > 0) {
        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2',
          [usableQty, item.product_id]
        );
        await client.query(
          `INSERT INTO stock_movements (product_id, type, quantity, reference_id, reference_type, notes, created_by)
           VALUES ($1, 'purchase', $2, $3, 'import_shipment', 'Stock received from import shipment', $4)`,
          [item.product_id, usableQty, id, req.user?.id]
        );
      }
    }

    await client.query(
      `UPDATE import_shipments SET stock_confirmed_at = NOW(), stock_confirmed_by = $1, updated_at = NOW() WHERE id = $2`,
      [req.user.id, id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Stock confirmed and added to inventory', items: await getItems(id) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('confirmStock error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

const deleteShipment = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT status FROM import_shipments WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }
    if (existing.rows[0].status === 'received') {
      return res.status(400).json({ success: false, message: 'Cannot delete a received shipment — it has a linked expense record. Cancel future shipments instead of deleting historical ones.' });
    }
    await pool.query('DELETE FROM import_shipments WHERE id = $1', [id]);
    res.json({ success: true, message: 'Shipment deleted' });
  } catch (error) {
    console.error('deleteShipment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getShipmentSummary = async (req, res) => {
  try {
    const totals = await pool.query(`
      SELECT
        COALESCE(SUM(${BUDGETED_TOTAL_SQL}) FILTER (WHERE s.status NOT IN ('cancelled')), 0) as total_budgeted,
        COALESCE(SUM(${ACTUAL_TOTAL_SQL}) FILTER (WHERE s.status = 'received'), 0) as total_actual_spent,
        COALESCE(SUM(${PROJECTED_PROFIT_SQL}) FILTER (WHERE s.status NOT IN ('cancelled')), 0) as total_projected_profit,
        COUNT(*) FILTER (WHERE s.status = 'planning') as planning_count,
        COUNT(*) FILTER (WHERE s.status IN ('ordered', 'shipped')) as in_transit_count,
        COUNT(*) FILTER (WHERE s.status = 'received') as received_count,
        COUNT(*) FILTER (WHERE s.status = 'received' AND s.stock_confirmed_at IS NULL) as awaiting_stock_confirm_count
      FROM import_shipments s
    `);
    const t = totals.rows[0];
    res.json({
      success: true,
      total_budgeted: parseFloat(t.total_budgeted),
      total_actual_spent: parseFloat(t.total_actual_spent),
      total_projected_profit: parseFloat(t.total_projected_profit),
      planning_count: parseInt(t.planning_count),
      in_transit_count: parseInt(t.in_transit_count),
      received_count: parseInt(t.received_count),
      awaiting_stock_confirm_count: parseInt(t.awaiting_stock_confirm_count),
    });
  } catch (error) {
    console.error('getShipmentSummary error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ── GET /api/imports/reports?type=product|supplier|monthly ──────
   Kept intentionally simple — three flat tables, no PDF export, no
   trend lines yet, per the scoped-down plan. */
const getReports = async (req, res) => {
  try {
    const { type = 'product', start_date, end_date } = req.query;
    const dateParams = [];
    let dateFilter = '';
    if (start_date && end_date) {
      dateFilter = `AND DATE(s.created_at) >= $1 AND DATE(s.created_at) <= $2`;
      dateParams.push(start_date, end_date);
    }

    if (type === 'product') {
      const result = await pool.query(`
        SELECT p.id as product_id, p.name as product_name,
          SUM(i.quantity_ordered) as total_ordered,
          SUM(COALESCE(i.quantity_received, 0)) as total_received,
          SUM(COALESCE(i.actual_purchase_unit_price, i.purchase_unit_price) * COALESCE(i.quantity_received, i.quantity_ordered)) as total_cost_purchase_currency,
          COUNT(DISTINCT i.shipment_id) as shipment_count
        FROM import_shipment_items i
        JOIN products p ON i.product_id = p.id
        JOIN import_shipments s ON i.shipment_id = s.id
        WHERE s.status != 'cancelled' ${dateFilter}
        GROUP BY p.id, p.name
        ORDER BY total_cost_purchase_currency DESC
      `, dateParams);
      return res.json({ success: true, type: 'product', rows: result.rows });
    }

    if (type === 'supplier') {
      const result = await pool.query(`
        SELECT sup.id as supplier_id, sup.name as supplier_name, sup.country,
          COUNT(DISTINCT s.id) as shipment_count,
          COALESCE(SUM(${ACTUAL_TOTAL_SQL}) FILTER (WHERE s.status = 'received'), 0) as total_actual_spent,
          COALESCE(SUM(${PROJECTED_PROFIT_SQL}) FILTER (WHERE s.status != 'cancelled'), 0) as total_projected_profit
        FROM import_shipments s
        JOIN suppliers sup ON s.supplier_id = sup.id
        WHERE 1=1 ${dateFilter}
        GROUP BY sup.id, sup.name, sup.country
        ORDER BY total_actual_spent DESC
      `, dateParams);
      return res.json({ success: true, type: 'supplier', rows: result.rows });
    }

    if (type === 'monthly') {
      const result = await pool.query(`
        SELECT TO_CHAR(s.created_at, 'YYYY-MM') as month,
          COUNT(*) as shipment_count,
          COALESCE(SUM(${ACTUAL_TOTAL_SQL}) FILTER (WHERE s.status = 'received'), 0) as total_actual_spent,
          COALESCE(SUM(${PROJECTED_PROFIT_SQL}) FILTER (WHERE s.status != 'cancelled'), 0) as total_projected_profit
        FROM import_shipments s
        WHERE 1=1 ${dateFilter}
        GROUP BY TO_CHAR(s.created_at, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 24
      `, dateParams);
      return res.json({ success: true, type: 'monthly', rows: result.rows });
    }

    res.status(400).json({ success: false, message: 'type must be product, supplier, or monthly' });
  } catch (error) {
    console.error('getReports error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getShipments, getShipment, createShipment, updateShipment,
  updateShipmentStatus, confirmStock, deleteShipment, getShipmentSummary, getReports,
  BUDGETED_TOTAL_SQL, ACTUAL_TOTAL_SQL,
};
