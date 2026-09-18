const pool = require('../config/db');

/* ─────────────────────────────────────────────────────────────────
   DATA FUNCTIONS — pure data fetchers, no req/res.
   Shared between the JSON endpoints below and reportExportController.js,
   so the exported Word/Excel file always matches exactly what's on screen.
   ───────────────────────────────────────────────────────────────── */

const getRevenueData = async ({ period = '30', start_date, end_date }) => {
  let whereClause;
  let queryParams = [];
  if (start_date && end_date) {
    whereClause = `WHERE DATE(created_at) >= $1 AND DATE(created_at) <= $2`;
    queryParams = [start_date, end_date];
  } else {
    whereClause = `WHERE created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;
  }

  const dailyRevenue = await pool.query(
    `SELECT
      DATE(created_at) as date,
      COUNT(*) as total_orders,
      COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
      SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END) as revenue
     FROM orders
     ${whereClause}
     GROUP BY DATE(created_at)
     ORDER BY date DESC`,
    queryParams
  );

  const summary = await pool.query(
    `SELECT
      COUNT(*) as total_orders,
      COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status = 'returned' THEN 1 END) as returned,
      SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END) as total_revenue,
      AVG(CASE WHEN status = 'delivered' THEN total_amount END) as avg_order_value
     FROM orders
     ${whereClause}`,
    queryParams
  );

  const paymentBreakdown = await pool.query(
    `SELECT method as payment_method, COUNT(*) as count, SUM(amount) as total
     FROM payments
     ${whereClause} AND status = 'verified'
     GROUP BY method`,
    queryParams
  );

  // Money currently owed back to customers (returned orders whose payment
  // had already been verified before the failed delivery). Not scoped to
  // the report period — this is a present-moment liability, like Cash
  // Runway, not a historical figure.
  const refundsOwed = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
     FROM payments WHERE status = 'refund_pending'`
  );

  return {
    period: start_date && end_date ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    summary: summary.rows[0],
    daily: dailyRevenue.rows,
    payment_breakdown: paymentBreakdown.rows,
    refunds_owed: refundsOwed.rows[0],
  };
};

const getProductData = async ({ period = '30', start_date, end_date }) => {
  let dateFilter;
  let queryParams = [];
  if (start_date && end_date) {
    dateFilter = `AND DATE(o.created_at) >= $1 AND DATE(o.created_at) <= $2`;
    queryParams = [start_date, end_date];
  } else {
    dateFilter = `AND o.created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;
  }

  const topProducts = await pool.query(
    `SELECT
      p.name, p.category, p.price,
      SUM(oi.quantity) as total_sold,
      SUM(oi.total_price) as total_revenue,
      p.stock_quantity as current_stock
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     JOIN orders o ON oi.order_id = o.id
     WHERE o.status = 'delivered'
     ${dateFilter}
     GROUP BY p.id, p.name, p.category, p.price, p.stock_quantity
     ORDER BY total_sold DESC
     LIMIT 10`,
    queryParams
  );

  const lowStock = await pool.query(
    `SELECT id, name, category, stock_quantity, low_stock_threshold
     FROM products
     WHERE is_active = true
     AND stock_quantity <= low_stock_threshold
     ORDER BY stock_quantity ASC`
  );

  const outOfStock = await pool.query(
    `SELECT id, name, category, stock_quantity
     FROM products
     WHERE is_active = true AND stock_quantity = 0`
  );

  return {
    period: parseInt(period),
    top_products: topProducts.rows,
    low_stock: lowStock.rows,
    out_of_stock: outOfStock.rows,
  };
};

const getRiderData = async ({ period = '30', start_date, end_date }) => {
  let deliveryFilter, cashFilter, queryParams = [];
  if (start_date && end_date) {
    deliveryFilter = `AND DATE(d.created_at) >= $1 AND DATE(d.created_at) <= $2`;
    cashFilter     = `AND DATE(cl.created_at) >= $1 AND DATE(cl.created_at) <= $2`;
    queryParams    = [start_date, end_date];
  } else {
    deliveryFilter = `AND d.created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;
    cashFilter     = `AND cl.created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;
  }

  const riderPerformance = await pool.query(
    `SELECT
      r.name as rider_name,
      r.phone,
      COUNT(d.id) as total_deliveries,
      COUNT(CASE WHEN d.status = 'delivered' THEN 1 END) as successful,
      COUNT(CASE WHEN d.status = 'failed' THEN 1 END) as failed,
      COALESCE(SUM(cl.amount), 0) as total_cash_collected,
      COUNT(cl.id) as total_collections,
      COUNT(CASE WHEN cl.status = 'verified' THEN 1 END) as verified_collections,
      COUNT(CASE WHEN cl.status = 'disputed' THEN 1 END) as disputed_collections,
      COUNT(CASE WHEN cl.status = 'pending' THEN 1 END) as pending_collections,
      COUNT(CASE WHEN cl.status = 'resolved' THEN 1 END) as resolved_collections
     FROM riders r
     LEFT JOIN deliveries d ON r.id = d.rider_id
       ${deliveryFilter}
     LEFT JOIN cash_logs cl ON r.id = cl.rider_id
       ${cashFilter}
     GROUP BY r.id, r.name, r.phone
     ORDER BY total_deliveries DESC`,
    queryParams
  );

  return { period: parseInt(period), riders: riderPerformance.rows };
};

/* ─────────────────────────────────────────────────────────────────
   P&L — Revenue, COGS, Gross Profit, Operating Expenses, Net Profit.
   COGS comes from real order_items × products.cost_price, not a guess.
   Whether the 'import' expense category is excluded from Operating
   Expenses depends entirely on the cost_price_includes_landed_cost
   setting (Report Settings) — set by the user, never assumed here.
   ───────────────────────────────────────────────────────────────── */
const getPnLData = async ({ period = '30', start_date, end_date }) => {
  const useCustomRange = !!(start_date && end_date);
  const queryParams = useCustomRange ? [start_date, end_date] : [];

  const orderDateFilter = useCustomRange
    ? `AND DATE(o.created_at) >= $1 AND DATE(o.created_at) <= $2`
    : `AND o.created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const expenseDateFilter = useCustomRange
    ? `expense_date >= $1 AND expense_date <= $2`
    : `expense_date >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const revenueRes = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0) as revenue
     FROM orders o WHERE status = 'delivered' ${orderDateFilter}`,
    queryParams
  );
  const revenue = parseFloat(revenueRes.rows[0].revenue);

  const cogsRes = await pool.query(
    `SELECT COALESCE(SUM(oi.quantity * COALESCE(p.cost_price, 0)), 0) as cogs,
            COUNT(DISTINCT CASE WHEN p.cost_price IS NULL THEN p.id END) as products_missing_cost
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     JOIN products p ON oi.product_id = p.id
     WHERE o.status = 'delivered' ${orderDateFilter}`,
    queryParams
  );
  const cogs = parseFloat(cogsRes.rows[0].cogs);
  const productsMissingCost = parseInt(cogsRes.rows[0].products_missing_cost);

  const settingRes = await pool.query(
    `SELECT setting_value FROM report_settings WHERE setting_key = 'cost_price_includes_landed_cost'`
  );
  const rawSetting = settingRes.rows[0]?.setting_value;
  const settingConfigured = rawSetting !== null && rawSetting !== undefined;
  const costPriceIncludesLandedCost = settingConfigured && parseFloat(rawSetting) === 1;

  const categoryExclusion = costPriceIncludesLandedCost ? `AND category != 'import'` : '';
  const expensesByCategory = await pool.query(
    `SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
     FROM expenses
     WHERE ${expenseDateFilter} ${categoryExclusion}
     GROUP BY category ORDER BY total DESC`,
    queryParams
  );
  const totalOperatingExpenses = expensesByCategory.rows.reduce((sum, r) => sum + parseFloat(r.total), 0);

  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - totalOperatingExpenses;

  return {
    period: useCustomRange ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    setting_configured: settingConfigured,
    cost_price_includes_landed_cost: costPriceIncludesLandedCost,
    products_missing_cost: productsMissingCost,
    revenue,
    cogs,
    gross_profit: grossProfit,
    gross_margin_percent: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    expenses_by_category: expensesByCategory.rows,
    total_operating_expenses: totalOperatingExpenses,
    net_profit: netProfit,
    net_margin_percent: revenue > 0 ? (netProfit / revenue) * 100 : 0,
  };
};

const getPnLReport = async (req, res) => {
  try {
    const data = await getPnLData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getPnLReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   Shared helper: computes revenue/COGS/expenses/margins for exactly
   one calendar month. Used by both Budget vs Actual and Margin Trend
   so the two reports can never disagree on how a given month's
   numbers are computed.
   ───────────────────────────────────────────────────────────────── */
const getMonthlyFinancials = async (targetMonth) => {
  const revenueRes = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0) as revenue
     FROM orders
     WHERE status = 'delivered' AND TO_CHAR(created_at, 'YYYY-MM') = $1`,
    [targetMonth]
  );
  const revenue = parseFloat(revenueRes.rows[0].revenue);

  const cogsRes = await pool.query(
    `SELECT COALESCE(SUM(oi.quantity * COALESCE(p.cost_price, 0)), 0) as cogs
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     JOIN products p ON oi.product_id = p.id
     WHERE o.status = 'delivered' AND TO_CHAR(o.created_at, 'YYYY-MM') = $1`,
    [targetMonth]
  );
  const cogs = parseFloat(cogsRes.rows[0].cogs);

  const settingsRes = await pool.query(
    `SELECT setting_value FROM report_settings WHERE setting_key = 'cost_price_includes_landed_cost'`
  );
  const rawSetting = settingsRes.rows[0]?.setting_value;
  const costPriceIncludesLandedCost = rawSetting !== null && rawSetting !== undefined && parseFloat(rawSetting) === 1;
  const categoryExclusion = costPriceIncludesLandedCost ? `AND category != 'import'` : '';

  const expensesRes = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM expenses
     WHERE TO_CHAR(expense_date, 'YYYY-MM') = $1 ${categoryExclusion}`,
    [targetMonth]
  );
  const expenses = parseFloat(expensesRes.rows[0].total);

  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenses;

  return {
    month: targetMonth,
    revenue,
    cogs,
    gross_profit: grossProfit,
    gross_margin_percent: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    expenses,
    net_profit: netProfit,
    net_margin_percent: revenue > 0 ? (netProfit / revenue) * 100 : 0,
  };
};

/* ─────────────────────────────────────────────────────────────────
   MARGIN TREND — Gross/Net margin for each of the last N months,
   so you can see whether profitability is improving or slipping,
   not just a single period's snapshot.
   ───────────────────────────────────────────────────────────────── */
const getMarginTrendData = async ({ months = '6' }) => {
  const n = Math.min(parseInt(months) || 6, 24);
  const now = new Date();
  const monthStrings = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthStrings.push(d.toISOString().slice(0, 7));
  }

  const results = [];
  for (const m of monthStrings) {
    results.push(await getMonthlyFinancials(m));
  }

  return { months: results };
};

const getMarginTrendReport = async (req, res) => {
  try {
    const data = await getMarginTrendData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getMarginTrendReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   EXCEPTIONS REPORT — every disputed and resolved cash log in one
   view, using the real dispute/resolution data already recorded on
   cash_logs (status, notes with auto-flag reason, resolution_notes,
   resolved_amount, resolved_by, resolved_at). Nothing here is
   estimated — it's the same rows admins already act on in Cash,
   just surfaced together instead of scattered across filters.
   ───────────────────────────────────────────────────────────────── */
const getExceptionsData = async ({ period = '30', start_date, end_date }) => {
  const useCustomRange = !!(start_date && end_date);
  const queryParams = useCustomRange ? [start_date, end_date] : [];

  const dateFilter = useCustomRange
    ? `AND DATE(cl.created_at) >= $1 AND DATE(cl.created_at) <= $2`
    : `AND cl.created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const exceptionsRes = await pool.query(
    `SELECT cl.id, cl.rider_id, cl.order_id, cl.amount, cl.status, cl.notes,
            cl.created_at, cl.resolved_at, cl.resolved_amount, cl.resolution_notes,
            r.name as rider_name, r.phone as rider_phone,
            o.order_number,
            u.name as resolved_by_name
     FROM cash_logs cl
     LEFT JOIN riders r ON cl.rider_id = r.id
     LEFT JOIN orders o ON cl.order_id = o.id
     LEFT JOIN users u ON cl.resolved_by = u.id
     WHERE cl.status IN ('disputed', 'resolved') ${dateFilter}
     ORDER BY cl.created_at DESC`,
    queryParams
  );

  const stillDisputed = exceptionsRes.rows.filter(r => r.status === 'disputed');
  const resolved = exceptionsRes.rows.filter(r => r.status === 'resolved');
  const totalDisputedAmount = stillDisputed.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

  return {
    period: useCustomRange ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    total_exceptions: exceptionsRes.rows.length,
    still_disputed_count: stillDisputed.length,
    resolved_count: resolved.length,
    total_disputed_amount_outstanding: totalDisputedAmount,
    exceptions: exceptionsRes.rows,
  };
};

const getExceptionsReport = async (req, res) => {
  try {
    const data = await getExceptionsData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getExceptionsReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   STAFF ACTION AUDIT TRAIL — aggregates the real audit_logs table
   (already populated by the audit middleware on create/update/delete
   actions) into an action breakdown, top actors, and a full detail
   log. Capped at 500 detail rows so exports stay reasonable; the
   summary counts always reflect the true totals for the period.
   ───────────────────────────────────────────────────────────────── */
const getAuditTrailData = async ({ period = '30', start_date, end_date }) => {
  const useCustomRange = !!(start_date && end_date);
  const queryParams = useCustomRange ? [start_date, end_date] : [];

  const dateFilter = useCustomRange
    ? `AND DATE(al.created_at) >= $1 AND DATE(al.created_at) <= $2`
    : `AND al.created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const totalRes = await pool.query(
    `SELECT COUNT(*) as total FROM audit_logs al WHERE 1=1 ${dateFilter}`,
    queryParams
  );

  const byActionRes = await pool.query(
    `SELECT action, COUNT(*) as count FROM audit_logs al WHERE 1=1 ${dateFilter} GROUP BY action ORDER BY count DESC`,
    queryParams
  );

  const byUserRes = await pool.query(
    `SELECT u.name as user_name, u.role as user_role, COUNT(*) as count
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE 1=1 ${dateFilter}
     GROUP BY u.name, u.role
     ORDER BY count DESC
     LIMIT 10`,
    queryParams
  );

  const logsRes = await pool.query(
    `SELECT al.action, al.entity, al.entity_id, al.description, al.ip_address, al.created_at,
            u.name as user_name, u.role as user_role
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE 1=1 ${dateFilter}
     ORDER BY al.created_at DESC
     LIMIT 500`,
    queryParams
  );

  return {
    period: useCustomRange ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    total_actions: parseInt(totalRes.rows[0].total),
    by_action: byActionRes.rows,
    by_user: byUserRes.rows,
    logs: logsRes.rows,
    logs_capped: parseInt(totalRes.rows[0].total) > 500,
  };
};

const getAuditTrailReport = async (req, res) => {
  try {
    const data = await getAuditTrailData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getAuditTrailReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   CASH RECONCILIATION VARIANCE — every rider's expected cash
   (delivered, cash-on-delivery orders) vs actual cash logged, for
   the whole period, sorted worst-shortage-first. Same expected/actual
   definition as the existing per-day getRiderReconciliation in
   cashController — this is that same logic aggregated across all
   riders and over a real date range instead of one rider/one day.
   ───────────────────────────────────────────────────────────────── */
const getCashReconciliationData = async ({ period = '30', start_date, end_date }) => {
  const useCustomRange = !!(start_date && end_date);
  const queryParams = useCustomRange ? [start_date, end_date] : [];

  const deliveryDateFilter = useCustomRange
    ? `AND DATE(d.delivered_at) >= $1 AND DATE(d.delivered_at) <= $2`
    : `AND d.delivered_at >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const cashDateFilter = useCustomRange
    ? `AND DATE(cl.created_at) >= $1 AND DATE(cl.created_at) <= $2`
    : `AND cl.created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const result = await pool.query(
    `SELECT
      r.id, r.name as rider_name, r.phone,
      COALESCE(expected.expected_amount, 0) as expected_amount,
      COALESCE(actual.actual_amount, 0) as actual_amount
     FROM riders r
     LEFT JOIN (
       SELECT d.rider_id, SUM(o.total_amount) as expected_amount
       FROM deliveries d
       JOIN orders o ON d.order_id = o.id
       WHERE o.status = 'delivered' AND o.payment_method = 'cash' ${deliveryDateFilter}
       GROUP BY d.rider_id
     ) expected ON expected.rider_id = r.id
     LEFT JOIN (
       SELECT cl.rider_id, SUM(cl.amount) as actual_amount
       FROM cash_logs cl
       WHERE 1=1 ${cashDateFilter}
       GROUP BY cl.rider_id
     ) actual ON actual.rider_id = r.id
     WHERE COALESCE(expected.expected_amount, 0) > 0 OR COALESCE(actual.actual_amount, 0) > 0
     ORDER BY (COALESCE(expected.expected_amount, 0) - COALESCE(actual.actual_amount, 0)) DESC`,
    queryParams
  );

  const riders = result.rows.map(r => {
    const expected = parseFloat(r.expected_amount);
    const actual = parseFloat(r.actual_amount);
    const variance = expected - actual;
    return {
      rider_name: r.rider_name,
      phone: r.phone,
      expected_amount: expected,
      actual_amount: actual,
      variance,
      status: Math.abs(variance) < 0.01 ? 'balanced' : variance > 0 ? 'shortage' : 'surplus',
    };
  });

  const totalExpected = riders.reduce((sum, r) => sum + r.expected_amount, 0);
  const totalActual = riders.reduce((sum, r) => sum + r.actual_amount, 0);

  return {
    period: useCustomRange ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    total_expected: totalExpected,
    total_actual: totalActual,
    total_variance: totalExpected - totalActual,
    riders_with_shortage: riders.filter(r => r.status === 'shortage').length,
    riders,
  };
};

const getCashReconciliationReport = async (req, res) => {
  try {
    const data = await getCashReconciliationData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getCashReconciliationReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   LOGIN ANOMALIES — flags two real patterns from login_attempts:
   (1) repeated failed attempts for the same email on the same day
   (2) successful logins outside configured business hours, ONLY if
       business_hours_start/end are actually set in Report Settings.
   No anomaly is invented — both are visible, mechanical patterns in
   real rows, and off-hours flagging is skipped entirely (not guessed)
   until the business-hours setting exists.
   ───────────────────────────────────────────────────────────────── */
const getLoginAnomaliesData = async ({ period = '30', start_date, end_date }) => {
  const useCustomRange = !!(start_date && end_date);
  const queryParams = useCustomRange ? [start_date, end_date] : [];

  const dateFilter = useCustomRange
    ? `AND DATE(la.created_at) >= $1 AND DATE(la.created_at) <= $2`
    : `AND la.created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;

  // Repeated failures: matched to a user by email (works even when the
  // account exists but the password was wrong — user_id is null on
  // invalid_email attempts, so the join is on email instead), with the
  // individual attempts included so you can see exactly what happened,
  // not just a count. succeeded_after_failures flags the real red flag:
  // someone got in on the same day after 3+ failed tries.
  const repeatedFailuresRes = await pool.query(
    `WITH failures AS (
       SELECT la.email_attempted, DATE(la.created_at) as day, la.created_at, la.failure_reason, la.ip_address
       FROM login_attempts la
       WHERE la.success = false ${dateFilter}
     ),
     failure_summary AS (
       SELECT email_attempted, day,
              COUNT(*) as failure_count,
              MAX(created_at) as last_attempt,
              COUNT(DISTINCT ip_address) as distinct_ip_count,
              json_agg(
                json_build_object('time', created_at, 'reason', failure_reason, 'ip', ip_address)
                ORDER BY created_at DESC
              ) as attempts
       FROM failures
       GROUP BY email_attempted, day
       HAVING COUNT(*) >= 3
     )
     SELECT fs.*, u.name as user_name, u.role as user_role,
            EXISTS (
              SELECT 1 FROM login_attempts la2
              WHERE la2.email_attempted = fs.email_attempted
                AND la2.success = true
                AND DATE(la2.created_at) = fs.day
                AND la2.created_at > fs.last_attempt
            ) as succeeded_after_failures
     FROM failure_summary fs
     LEFT JOIN users u ON u.email = fs.email_attempted
     ORDER BY fs.failure_count DESC, fs.last_attempt DESC`,
    queryParams
  );

  // Credential-stuffing pattern: same IP hitting several *different*
  // emails with failed attempts — a distinct signal from one person
  // forgetting their own password (which is what repeated_failures
  // above already catches, grouped by email instead of by IP).
  const suspiciousIpsRes = await pool.query(
    `SELECT la.ip_address,
            COUNT(DISTINCT la.email_attempted) as distinct_emails,
            COUNT(*) as attempt_count,
            MIN(la.created_at) as first_attempt,
            MAX(la.created_at) as last_attempt,
            json_agg(DISTINCT la.email_attempted) as emails_targeted
     FROM login_attempts la
     WHERE la.success = false AND la.ip_address IS NOT NULL ${dateFilter}
     GROUP BY la.ip_address
     HAVING COUNT(DISTINCT la.email_attempted) >= 3
     ORDER BY distinct_emails DESC, attempt_count DESC`,
    queryParams
  );

  const settingsRes = await pool.query(
    `SELECT setting_key, setting_value FROM report_settings WHERE setting_key IN ('business_hours_start', 'business_hours_end')`
  );
  const s = {};
  settingsRes.rows.forEach(r => { s[r.setting_key] = r.setting_value; });
  const businessHoursConfigured = s.business_hours_start !== null && s.business_hours_start !== undefined
    && s.business_hours_end !== null && s.business_hours_end !== undefined;

  let offHoursLogins = [];
  if (businessHoursConfigured) {
    const startHour = parseInt(s.business_hours_start);
    const endHour = parseInt(s.business_hours_end);
    const offHoursRes = await pool.query(
      `SELECT la.email_attempted, la.created_at, la.ip_address, u.name as user_name, u.role as user_role
       FROM login_attempts la
       LEFT JOIN users u ON la.user_id = u.id
       WHERE la.success = true ${dateFilter}
       AND (EXTRACT(HOUR FROM la.created_at) < $${queryParams.length + 1} OR EXTRACT(HOUR FROM la.created_at) >= $${queryParams.length + 2})
       ORDER BY la.created_at DESC`,
      [...queryParams, startHour, endHour]
    );
    offHoursLogins = offHoursRes.rows;
  }

  return {
    period: useCustomRange ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    business_hours_configured: businessHoursConfigured,
    business_hours_start: businessHoursConfigured ? parseInt(s.business_hours_start) : null,
    business_hours_end: businessHoursConfigured ? parseInt(s.business_hours_end) : null,
    repeated_failures: repeatedFailuresRes.rows,
    off_hours_logins: offHoursLogins,
    suspicious_ips: suspiciousIpsRes.rows,
    total_anomalies: repeatedFailuresRes.rows.length + offHoursLogins.length + suspiciousIpsRes.rows.length,
  };
};

const getLoginAnomaliesReport = async (req, res) => {
  try {
    const data = await getLoginAnomaliesData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getLoginAnomaliesReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   PERMISSION-CHANGE LOG — real audit_logs rows scoped to the actions
   that change who can do what: role/detail updates, activation
   toggles, account deletions, and RBAC permission-matrix changes.
   Reuses the same audit_logs table as Staff Action Audit Trail,
   filtered to just these action types.
   ───────────────────────────────────────────────────────────────── */
const getPermissionChangeData = async ({ period = '30', start_date, end_date }) => {
  const useCustomRange = !!(start_date && end_date);
  const queryParams = useCustomRange ? [start_date, end_date] : [];

  const dateFilter = useCustomRange
    ? `AND DATE(al.created_at) >= $1 AND DATE(al.created_at) <= $2`
    : `AND al.created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const changesRes = await pool.query(
    `SELECT al.action, al.entity_id, al.description, al.created_at, al.ip_address,
            u.name as actor_name, u.role as actor_role
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE al.action IN ('UPDATE_USER', 'TOGGLE_USER_STATUS', 'DELETE_USER', 'UPDATE_PERMISSION', 'RESET_ROLE_PERMISSIONS') ${dateFilter}
     ORDER BY al.created_at DESC`,
    queryParams
  );

  return {
    period: useCustomRange ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    total_changes: changesRes.rows.length,
    changes: changesRes.rows,
  };
};

const getPermissionChangeReport = async (req, res) => {
  try {
    const data = await getPermissionChangeData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getPermissionChangeReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   CASHIER / VERIFIER PERFORMANCE — real data from cash_logs.verified_by
   and verified_at, which already record who verified each cash
   collection and when. Shows volume and value verified per staff
   member, plus how many of what they verified later ended up disputed
   (a quality signal, not just a speed one).
   ───────────────────────────────────────────────────────────────── */
const getCashierPerformanceData = async ({ period = '30', start_date, end_date }) => {
  const useCustomRange = !!(start_date && end_date);
  const queryParams = useCustomRange ? [start_date, end_date] : [];

  const dateFilter = useCustomRange
    ? `AND DATE(cl.verified_at) >= $1 AND DATE(cl.verified_at) <= $2`
    : `AND cl.verified_at >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const result = await pool.query(
    `SELECT
      u.id, u.name as staff_name, u.role,
      COUNT(cl.id) as total_verified,
      COALESCE(SUM(cl.amount), 0) as total_amount_verified
     FROM cash_logs cl
     JOIN users u ON cl.verified_by = u.id
     WHERE cl.verified_by IS NOT NULL ${dateFilter}
     GROUP BY u.id, u.name, u.role
     ORDER BY total_verified DESC`,
    queryParams
  );

  return {
    period: useCustomRange ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    staff: result.rows.map(r => ({
      staff_name: r.staff_name,
      role: r.role,
      total_verified: parseInt(r.total_verified),
      total_amount_verified: parseFloat(r.total_amount_verified),
    })),
  };
};

const getCashierPerformanceReport = async (req, res) => {
  try {
    const data = await getCashierPerformanceData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getCashierPerformanceReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   TRUE MARGIN PER PRODUCT — real per-SKU profitability using the
   same cost_price data the P&L trusts. Products with no cost_price
   set are shown separately with a clear flag rather than silently
   treated as GHS 0 cost (which would overstate their margin).
   ───────────────────────────────────────────────────────────────── */
const getTrueMarginData = async ({ period = '30', start_date, end_date }) => {
  const useCustomRange = !!(start_date && end_date);
  const queryParams = useCustomRange ? [start_date, end_date] : [];

  const dateFilter = useCustomRange
    ? `AND DATE(o.created_at) >= $1 AND DATE(o.created_at) <= $2`
    : `AND o.created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const result = await pool.query(
    `SELECT
      p.id, p.name, p.category, p.cost_price,
      SUM(oi.quantity) as units_sold,
      SUM(oi.total_price) as revenue,
      SUM(oi.quantity * COALESCE(p.cost_price, 0)) as cost
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     JOIN products p ON oi.product_id = p.id
     WHERE o.status = 'delivered' ${dateFilter}
     GROUP BY p.id, p.name, p.category, p.cost_price
     ORDER BY (SUM(oi.total_price) - SUM(oi.quantity * COALESCE(p.cost_price, 0))) DESC`,
    queryParams
  );

  const withCost = [];
  const missingCost = [];

  result.rows.forEach(r => {
    const revenue = parseFloat(r.revenue);
    const cost = parseFloat(r.cost);
    const margin = revenue - cost;
    const entry = {
      name: r.name,
      category: r.category,
      units_sold: parseInt(r.units_sold),
      revenue,
      cost,
      margin,
      margin_percent: revenue > 0 ? (margin / revenue) * 100 : 0,
    };
    if (r.cost_price === null) missingCost.push(entry);
    else withCost.push(entry);
  });

  return {
    period: useCustomRange ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    products: withCost,
    products_missing_cost: missingCost,
  };
};

const getTrueMarginReport = async (req, res) => {
  try {
    const data = await getTrueMarginData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getTrueMarginReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   CASH FLOW STATEMENT — cash actually collected vs cash actually
   spent, not accrual-based revenue like the P&L. Cash In is verified
   cash_logs only (status verified/resolved) — pending or disputed
   amounts aren't real cash in hand yet, so they're excluded. Cash Out
   reuses the same cost_price_includes_landed_cost exclusion logic as
   the P&L, so the two statements never disagree on the import expense.
   Scope note: this reflects cash collected via rider cash_logs — if
   MoMo settlements are tracked elsewhere, they aren't in this view yet.
   ───────────────────────────────────────────────────────────────── */
const getCashFlowData = async ({ period = '30', start_date, end_date }) => {
  const useCustomRange = !!(start_date && end_date);
  const queryParams = useCustomRange ? [start_date, end_date] : [];

  const cashLogDateFilter = useCustomRange
    ? `AND DATE(created_at) >= $1 AND DATE(created_at) <= $2`
    : `AND created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const expenseDateFilter = useCustomRange
    ? `expense_date >= $1 AND expense_date <= $2`
    : `expense_date >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const cashInRes = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM cash_logs
     WHERE status IN ('verified', 'resolved') ${cashLogDateFilter}`,
    queryParams
  );
  const cashIn = parseFloat(cashInRes.rows[0].total);

  const settingsRes = await pool.query(
    `SELECT setting_value FROM report_settings WHERE setting_key = 'cost_price_includes_landed_cost'`
  );
  const rawSetting = settingsRes.rows[0]?.setting_value;
  const costPriceIncludesLandedCost = rawSetting !== null && rawSetting !== undefined && parseFloat(rawSetting) === 1;
  const categoryExclusion = costPriceIncludesLandedCost ? `AND category != 'import'` : '';

  const cashOutByCategoryRes = await pool.query(
    `SELECT category, COALESCE(SUM(amount), 0) as total
     FROM expenses
     WHERE ${expenseDateFilter} ${categoryExclusion}
     GROUP BY category ORDER BY total DESC`,
    queryParams
  );
  const cashOut = cashOutByCategoryRes.rows.reduce((sum, r) => sum + parseFloat(r.total), 0);

  return {
    period: useCustomRange ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    cost_price_includes_landed_cost: costPriceIncludesLandedCost,
    cash_in: cashIn,
    cash_out: cashOut,
    cash_out_by_category: cashOutByCategoryRes.rows,
    net_cash_flow: cashIn - cashOut,
  };
};

const getCashFlowReport = async (req, res) => {
  try {
    const data = await getCashFlowData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getCashFlowReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   CASH RUNWAY — cash_on_hand is an ALL-TIME cumulative balance
   (verified/resolved cash_logs minus expenses, same double-count
   exclusion as Cash Flow), independent of the period selector.
   Burn rate is computed over the selected period/date-range, same
   as Cash Flow. Runway is only meaningful when net cash flow over
   that window is negative (i.e. the business is actually burning);
   otherwise we report is_burning: false rather than an infinite or
   negative "runway" number, which would be meaningless.
   ───────────────────────────────────────────────────────────────── */
const getCashRunwayData = async ({ period = '30', start_date, end_date }) => {
  const useCustomRange = !!(start_date && end_date);
  const queryParams = useCustomRange ? [start_date, end_date] : [];

  const settingsRes = await pool.query(
    `SELECT setting_value FROM report_settings WHERE setting_key = 'cost_price_includes_landed_cost'`
  );
  const rawSetting = settingsRes.rows[0]?.setting_value;
  const costPriceIncludesLandedCost = rawSetting !== null && rawSetting !== undefined && parseFloat(rawSetting) === 1;
  const categoryExclusion = costPriceIncludesLandedCost ? `AND category != 'import'` : '';

  // All-time cash on hand — not windowed by period.
  const allTimeCashInRes = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM cash_logs WHERE status IN ('verified', 'resolved')`
  );
  const allTimeCashOutRes = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE 1=1 ${categoryExclusion}`
  );
  const cashOnHand = parseFloat(allTimeCashInRes.rows[0].total) - parseFloat(allTimeCashOutRes.rows[0].total);

  // Windowed burn rate — same date-filter pattern as Cash Flow.
  const cashLogDateFilter = useCustomRange
    ? `AND DATE(created_at) >= $1 AND DATE(created_at) <= $2`
    : `AND created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;
  const expenseDateFilter = useCustomRange
    ? `expense_date >= $1 AND expense_date <= $2`
    : `expense_date >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const windowCashInRes = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM cash_logs WHERE status IN ('verified', 'resolved') ${cashLogDateFilter}`,
    queryParams
  );
  const windowCashOutRes = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE ${expenseDateFilter} ${categoryExclusion}`,
    queryParams
  );
  const windowCashIn = parseFloat(windowCashInRes.rows[0].total);
  const windowCashOut = parseFloat(windowCashOutRes.rows[0].total);

  const windowDays = useCustomRange
    ? Math.max(1, Math.round((new Date(end_date) - new Date(start_date)) / 86400000) + 1)
    : parseInt(period);

  const netWindow = windowCashIn - windowCashOut;
  const isBurning = netWindow < 0;
  const dailyBurnRate = isBurning ? Math.abs(netWindow) / windowDays : 0;
  const runwayDays = isBurning && dailyBurnRate > 0 ? cashOnHand / dailyBurnRate : null;

  return {
    period: useCustomRange ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    cost_price_includes_landed_cost: costPriceIncludesLandedCost,
    cash_on_hand: cashOnHand,
    window_days: windowDays,
    window_cash_in: windowCashIn,
    window_cash_out: windowCashOut,
    net_window_cash_flow: netWindow,
    is_burning: isBurning,
    daily_burn_rate: dailyBurnRate,
    monthly_burn_rate: dailyBurnRate * 30,
    runway_days: runwayDays,
    runway_months: runwayDays !== null ? runwayDays / 30 : null,
  };
};

const getCashRunwayReport = async (req, res) => {
  try {
    const data = await getCashRunwayData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getCashRunwayReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   REORDER POINT / WEEKS OF SUPPLY — sales velocity comes from
   delivered order_items only (same filter as Product Performance,
   so the two reports always agree). Lead time comes from the
   avg_import_lead_time_days setting; low_stock_threshold doubles
   as the safety-stock buffer per product (no new setting needed).
   Products with zero sales in the window get weeks_of_supply: null
   (flagged separately) rather than a misleading infinite number.
   ───────────────────────────────────────────────────────────────── */
const getReorderPointData = async ({ period = '30', start_date, end_date }) => {
  const useCustomRange = !!(start_date && end_date);
  const queryParams = useCustomRange ? [start_date, end_date] : [];

  // Date filter lives in the JOIN condition, not WHERE — this is a LEFT JOIN
  // so products with zero orders in the window must still come back with
  // units_sold = 0, not get silently dropped.
  const orderJoinDateFilter = useCustomRange
    ? `AND DATE(o.created_at) >= $1 AND DATE(o.created_at) <= $2`
    : `AND o.created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const windowDays = useCustomRange
    ? Math.max(1, Math.round((new Date(end_date) - new Date(start_date)) / 86400000) + 1)
    : parseInt(period);

  const settingsRes = await pool.query(
    `SELECT setting_value FROM report_settings WHERE setting_key = 'avg_import_lead_time_days'`
  );
  const rawLeadTime = settingsRes.rows[0]?.setting_value;
  const leadTimeConfigured = rawLeadTime !== null && rawLeadTime !== undefined;
  const leadTimeDays = leadTimeConfigured ? parseFloat(rawLeadTime) : 0;

  const productsRes = await pool.query(
    `SELECT
      p.id, p.sku, p.name, p.category, p.stock_quantity, p.low_stock_threshold,
      COALESCE(SUM(oi.quantity), 0) as units_sold
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id AND o.status = 'delivered' ${orderJoinDateFilter}
     WHERE p.is_active = true
     GROUP BY p.id, p.sku, p.name, p.category, p.stock_quantity, p.low_stock_threshold
     ORDER BY p.name`,
    queryParams
  );

  const products = productsRes.rows.map(p => {
    const unitsSold = parseInt(p.units_sold, 10);
    const hasSalesData = unitsSold > 0;
    const avgDailySales = hasSalesData ? unitsSold / windowDays : 0;
    const weeksOfSupply = hasSalesData ? (p.stock_quantity / avgDailySales) * 7 : null;
    const safetyStock = p.low_stock_threshold || 0;
    const reorderPoint = hasSalesData
      ? Math.ceil(avgDailySales * leadTimeDays + safetyStock)
      : safetyStock;
    const needsReorder = p.stock_quantity <= reorderPoint;

    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      stock_quantity: p.stock_quantity,
      low_stock_threshold: p.low_stock_threshold,
      units_sold: unitsSold,
      has_sales_data: hasSalesData,
      avg_daily_sales: avgDailySales,
      weeks_of_supply: weeksOfSupply,
      reorder_point: reorderPoint,
      needs_reorder: needsReorder,
    };
  });

  // Reordering-needed first, then lowest weeks of supply, no-sales-data last.
  products.sort((a, b) => {
    if (a.needs_reorder !== b.needs_reorder) return a.needs_reorder ? -1 : 1;
    if (a.weeks_of_supply === null) return 1;
    if (b.weeks_of_supply === null) return -1;
    return a.weeks_of_supply - b.weeks_of_supply;
  });

  return {
    period: useCustomRange ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    window_days: windowDays,
    lead_time_configured: leadTimeConfigured,
    lead_time_days: leadTimeDays,
    products,
    needs_reorder_count: products.filter(p => p.needs_reorder).length,
    no_sales_data_count: products.filter(p => !p.has_sales_data).length,
  };
};

const getReorderPointReport = async (req, res) => {
  try {
    const data = await getReorderPointData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getReorderPointReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   SUPPLIER SCORECARD — three independent dimensions, each only
   scored when there's actual data to support it (a supplier with
   no purchase orders yet isn't penalized on PO cancellation rate):
     1. On-time delivery — expected_arrival vs received_at, only
        counted where both dates exist on a received shipment.
     2. Cost accuracy — actual_* landed cost fields vs the planned
        shipping_cost/customs_duty/clearing_agent_fee/inland_
        transport_cost/other_fees, only on received shipments.
     3. PO fulfillment — cancelled vs total purchase_orders.
   overall_score is the average of whichever components have data;
   null if none do (brand new or completely inactive supplier).
   ───────────────────────────────────────────────────────────────── */
const getSupplierScorecardData = async ({ period = '90', start_date, end_date }) => {
  const useCustomRange = !!(start_date && end_date);
  const queryParams = useCustomRange ? [start_date, end_date] : [];

  const shipmentJoinDateFilter = useCustomRange
    ? `AND DATE(ish.created_at) >= $1 AND DATE(ish.created_at) <= $2`
    : `AND ish.created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const shipmentsRes = await pool.query(
    `SELECT
      s.id, s.name, s.country,
      COUNT(ish.id) as total_shipments,
      COUNT(ish.id) FILTER (WHERE ish.status = 'received') as received_shipments,
      COUNT(ish.id) FILTER (WHERE ish.status = 'cancelled') as cancelled_shipments,
      COUNT(ish.id) FILTER (
        WHERE ish.status = 'received' AND ish.expected_arrival IS NOT NULL AND ish.received_at IS NOT NULL
      ) as trackable_shipments,
      COUNT(ish.id) FILTER (
        WHERE ish.status = 'received' AND ish.expected_arrival IS NOT NULL AND ish.received_at IS NOT NULL
        AND DATE(ish.received_at) <= ish.expected_arrival
      ) as on_time_shipments,
      SUM(ish.shipping_cost + ish.customs_duty + ish.clearing_agent_fee + ish.inland_transport_cost + ish.other_fees)
        FILTER (WHERE ish.status = 'received') as planned_cost,
      SUM(
        COALESCE(ish.actual_shipping_cost, ish.shipping_cost)
        + COALESCE(ish.actual_customs_duty, ish.customs_duty)
        + COALESCE(ish.actual_clearing_agent_fee, ish.clearing_agent_fee)
        + COALESCE(ish.actual_inland_transport_cost, ish.inland_transport_cost)
        + COALESCE(ish.actual_other_fees, ish.other_fees)
      ) FILTER (WHERE ish.status = 'received') as actual_cost
     FROM suppliers s
     LEFT JOIN import_shipments ish ON ish.supplier_id = s.id ${shipmentJoinDateFilter}
     WHERE s.is_active = true
     GROUP BY s.id, s.name, s.country
     ORDER BY s.name`,
    queryParams
  );

  const poJoinDateFilter = useCustomRange
    ? `AND DATE(created_at) >= $1 AND DATE(created_at) <= $2`
    : `AND created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const poRes = await pool.query(
    `SELECT
      supplier_id,
      COUNT(*) as total_pos,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_pos
     FROM purchase_orders
     WHERE supplier_id IS NOT NULL ${poJoinDateFilter}
     GROUP BY supplier_id`,
    queryParams
  );
  const poBySupplier = {};
  poRes.rows.forEach(r => { poBySupplier[r.supplier_id] = r; });

  const suppliers = shipmentsRes.rows.map(s => {
    const totalShipments = parseInt(s.total_shipments, 10);
    const trackableShipments = parseInt(s.trackable_shipments, 10);
    const onTimeShipments = parseInt(s.on_time_shipments, 10);
    const plannedCost = parseFloat(s.planned_cost || 0);
    const actualCost = parseFloat(s.actual_cost || 0);
    const po = poBySupplier[s.id];

    const onTimeRate = trackableShipments > 0 ? (onTimeShipments / trackableShipments) * 100 : null;
    const costVariancePct = plannedCost > 0 ? ((actualCost - plannedCost) / plannedCost) * 100 : null;
    const totalPOs = po ? parseInt(po.total_pos, 10) : 0;
    const cancelledPOs = po ? parseInt(po.cancelled_pos, 10) : 0;
    const poCancellationRate = totalPOs > 0 ? (cancelledPOs / totalPOs) * 100 : null;

    const scoreComponents = [];
    if (onTimeRate !== null) scoreComponents.push(onTimeRate);
    if (costVariancePct !== null) scoreComponents.push(Math.max(0, 100 - Math.abs(costVariancePct)));
    if (poCancellationRate !== null) scoreComponents.push(100 - poCancellationRate);
    const overallScore = scoreComponents.length > 0
      ? scoreComponents.reduce((a, b) => a + b, 0) / scoreComponents.length
      : null;

    return {
      id: s.id,
      name: s.name,
      country: s.country,
      total_shipments: totalShipments,
      received_shipments: parseInt(s.received_shipments, 10),
      cancelled_shipments: parseInt(s.cancelled_shipments, 10),
      on_time_rate: onTimeRate,
      planned_cost: plannedCost,
      actual_cost: actualCost,
      cost_variance_pct: costVariancePct,
      total_purchase_orders: totalPOs,
      cancelled_purchase_orders: cancelledPOs,
      po_cancellation_rate: poCancellationRate,
      overall_score: overallScore,
      has_activity: totalShipments > 0 || totalPOs > 0,
    };
  });

  suppliers.sort((a, b) => {
    if (a.overall_score === null) return 1;
    if (b.overall_score === null) return -1;
    return b.overall_score - a.overall_score;
  });

  return {
    period: useCustomRange ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    suppliers,
  };
};

const getSupplierScorecardReport = async (req, res) => {
  try {
    const data = await getSupplierScorecardData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getSupplierScorecardReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   CUSTOMER ANALYTICS — lifetime value is naturally an all-time
   metric (like Cash Runway), not windowed by period; only "new
   customers in period" uses the period/date-range filter. Only
   delivered orders count toward spend, same convention as Revenue
   and Product Performance. at_risk_days is a query param (default
   45) rather than a new report_settings row, since it's a single
   tunable number specific to this one report.
   ───────────────────────────────────────────────────────────────── */
const getCustomerAnalyticsData = async ({ period = '30', start_date, end_date, at_risk_days = '45' }) => {
  const useCustomRange = !!(start_date && end_date);
  const atRiskDays = parseInt(at_risk_days, 10);

  const customersRes = await pool.query(
    `SELECT
      c.id, c.name, c.phone, c.created_at as customer_since,
      COUNT(o.id) FILTER (WHERE o.status = 'delivered') as total_orders,
      COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'delivered'), 0) as total_spent,
      MAX(o.created_at) FILTER (WHERE o.status = 'delivered') as last_order_date,
      MIN(o.created_at) FILTER (WHERE o.status = 'delivered') as first_order_date
     FROM customers c
     LEFT JOIN orders o ON o.customer_id = c.id
     GROUP BY c.id, c.name, c.phone, c.created_at
     ORDER BY c.name`
  );

  // Whether each customer counts as "new in period" — computed in JS
  // rather than baked into the SQL above to keep the date-filter logic
  // in one place (matches the pattern used elsewhere in this file).
  const isNewInPeriod = (customerSince) => {
    if (useCustomRange) {
      const d = new Date(customerSince);
      return d >= new Date(start_date) && d <= new Date(end_date);
    }
    const cutoff = new Date(Date.now() - parseInt(period) * 86400000);
    return new Date(customerSince) >= cutoff;
  };

  const customers = customersRes.rows.map(c => {
    const totalOrders = parseInt(c.total_orders, 10);
    const totalSpent = parseFloat(c.total_spent);
    const hasOrdered = totalOrders > 0;
    const avgOrderValue = hasOrdered ? totalSpent / totalOrders : 0;
    const daysSinceLastOrder = c.last_order_date
      ? Math.floor((Date.now() - new Date(c.last_order_date).getTime()) / 86400000)
      : null;
    const isAtRisk = hasOrdered && daysSinceLastOrder !== null && daysSinceLastOrder > atRiskDays;

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      customer_since: c.customer_since,
      total_orders: totalOrders,
      total_spent: totalSpent,
      avg_order_value: avgOrderValue,
      last_order_date: c.last_order_date,
      days_since_last_order: daysSinceLastOrder,
      has_ordered: hasOrdered,
      is_repeat_customer: totalOrders > 1,
      is_at_risk: isAtRisk,
      is_new_in_period: isNewInPeriod(c.customer_since),
    };
  });

  customers.sort((a, b) => b.total_spent - a.total_spent);

  const customersWithOrders = customers.filter(c => c.has_ordered);
  const repeatCustomers = customersWithOrders.filter(c => c.is_repeat_customer);

  return {
    period: useCustomRange ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    at_risk_days: atRiskDays,
    total_customers: customers.length,
    customers_with_orders: customersWithOrders.length,
    repeat_customer_count: repeatCustomers.length,
    repeat_rate: customersWithOrders.length > 0 ? (repeatCustomers.length / customersWithOrders.length) * 100 : null,
    avg_ltv: customersWithOrders.length > 0
      ? customersWithOrders.reduce((sum, c) => sum + c.total_spent, 0) / customersWithOrders.length
      : 0,
    at_risk_count: customers.filter(c => c.is_at_risk).length,
    new_customers_in_period: customers.filter(c => c.is_new_in_period).length,
    customers,
  };
};

const getCustomerAnalyticsReport = async (req, res) => {
  try {
    const data = await getCustomerAnalyticsData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getCustomerAnalyticsReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   DEMAND FORECAST PER SKU — compares the current period against the
   immediately prior period of equal length to classify trend
   (growing/declining/stable/new demand/no data), then projects a
   DAMPENED forecast for the next period (half the trend rate is
   applied, not the full rate) rather than either a naive "next
   period = this period" copy or an overconfident full-trend
   extrapolation. Only supports the period selector, not custom
   date ranges — trend comparison needs two equal-length windows,
   which an arbitrary custom range can't cleanly provide.
   ───────────────────────────────────────────────────────────────── */
const getDemandForecastData = async ({ period = '30' }) => {
  const periodDays = parseInt(period, 10);

  const productsRes = await pool.query(
    `SELECT
      p.id, p.sku, p.name, p.category, p.stock_quantity,
      COALESCE(SUM(oi.quantity) FILTER (
        WHERE o.created_at >= NOW() - INTERVAL '${periodDays} days'
      ), 0) as recent_units,
      COALESCE(SUM(oi.quantity) FILTER (
        WHERE o.created_at >= NOW() - INTERVAL '${periodDays * 2} days'
          AND o.created_at < NOW() - INTERVAL '${periodDays} days'
      ), 0) as prior_units
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id AND o.status = 'delivered'
     WHERE p.is_active = true
     GROUP BY p.id, p.sku, p.name, p.category, p.stock_quantity
     ORDER BY p.name`
  );

  const products = productsRes.rows.map(p => {
    const recentUnits = parseInt(p.recent_units, 10);
    const priorUnits = parseInt(p.prior_units, 10);

    let trend, trendPct, forecastUnits;
    if (recentUnits === 0 && priorUnits === 0) {
      trend = 'no_data';
      trendPct = null;
      forecastUnits = 0;
    } else if (priorUnits === 0) {
      trend = 'new_demand';
      trendPct = null;
      forecastUnits = recentUnits; // can't compute a trend yet, carry forward as-is
    } else {
      trendPct = ((recentUnits - priorUnits) / priorUnits) * 100;
      trend = trendPct > 15 ? 'growing' : trendPct < -15 ? 'declining' : 'stable';
      // Dampened projection: half the observed trend rate, not the full rate —
      // avoids overreacting to a single short window's swing.
      forecastUnits = Math.max(0, Math.round(recentUnits * (1 + (trendPct * 0.5) / 100)));
    }

    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      stock_quantity: p.stock_quantity,
      recent_units: recentUnits,
      prior_units: priorUnits,
      trend,
      trend_pct: trendPct,
      forecast_units_next_period: forecastUnits,
    };
  });

  // Top movers first — highest current-period volume, so the report
  // leads with what actually matters day-to-day.
  products.sort((a, b) => b.recent_units - a.recent_units);

  const trendCounts = { growing: 0, declining: 0, stable: 0, new_demand: 0, no_data: 0 };
  products.forEach(p => { trendCounts[p.trend]++; });

  return {
    period: periodDays,
    trend_counts: trendCounts,
    products,
  };
};

const getDemandForecastReport = async (req, res) => {
  try {
    const data = await getDemandForecastData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getDemandForecastReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   NEW PRODUCT SCORECARD — since-launch performance for products
   created within new_product_days (default 60, a query param like
   at_risk_days on Customer Analytics — not a new report_settings
   row, since it's a single tunable specific to this report). Sales
   are all-time-since-launch, not period-windowed, since the whole
   point is "how has it done since it arrived", not a recent slice.
   min_weekly_velocity (default 1 unit/week) sets the underperforming
   bar; also a query param for the same reason.
   ───────────────────────────────────────────────────────────────── */
const getNewProductScorecardData = async ({ new_product_days = '60', min_weekly_velocity = '1' }) => {
  const newProductDays = parseInt(new_product_days, 10);
  const minWeeklyVelocity = parseFloat(min_weekly_velocity);

  const productsRes = await pool.query(
    `SELECT
      p.id, p.sku, p.name, p.category, p.stock_quantity, p.created_at,
      COALESCE(SUM(oi.quantity) FILTER (WHERE o.status = 'delivered'), 0) as units_sold,
      COALESCE(SUM(oi.total_price) FILTER (WHERE o.status = 'delivered'), 0) as revenue
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id
     WHERE p.is_active = true
       AND p.created_at >= NOW() - INTERVAL '${newProductDays} days'
     GROUP BY p.id, p.sku, p.name, p.category, p.stock_quantity, p.created_at
     ORDER BY p.created_at DESC`
  );

  const products = productsRes.rows.map(p => {
    const daysSinceLaunch = Math.max(1, Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000));
    const unitsSold = parseInt(p.units_sold, 10);
    const revenue = parseFloat(p.revenue);
    const weeklyVelocity = (unitsSold / daysSinceLaunch) * 7;

    let status;
    if (daysSinceLaunch < 14) status = 'too_early';
    else if (unitsSold === 0) status = 'no_traction';
    else if (weeklyVelocity < minWeeklyVelocity) status = 'underperforming';
    else status = 'performing';

    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      stock_quantity: p.stock_quantity,
      launched_at: p.created_at,
      days_since_launch: daysSinceLaunch,
      units_sold_since_launch: unitsSold,
      revenue_since_launch: revenue,
      weekly_velocity: weeklyVelocity,
      status,
    };
  });

  const statusCounts = { too_early: 0, no_traction: 0, underperforming: 0, performing: 0 };
  products.forEach(p => { statusCounts[p.status]++; });

  return {
    new_product_days: newProductDays,
    min_weekly_velocity: minWeeklyVelocity,
    status_counts: statusCounts,
    products,
  };
};

const getNewProductScorecardReport = async (req, res) => {
  try {
    const data = await getNewProductScorecardData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getNewProductScorecardReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   PRODUCT VIABILITY SURVEY — an interactive calculator, not a
   static report. Called two ways:
   1. No inputs (category/cost_price/selling_price/quantity missing)
      → just returns the list of existing categories, so the
      frontend can populate a dropdown before the user fills the form.
   2. Full inputs → returns the full viability calculation, using
      category benchmarks (avg price, avg margin, avg weekly
      velocity across existing active products in that category)
      so the proposed numbers are checked against real data, not
      just internal math. Velocity benchmark is averaged across ALL
      active products in the category (including zero-sales ones),
      not just movers — averaging only sellers would overstate
      expected demand for a new, unproven entrant.
   ───────────────────────────────────────────────────────────────── */
const getProductViabilityData = async ({ category, cost_price, selling_price, quantity, lead_time_days }) => {
  const categoriesRes = await pool.query(
    `SELECT DISTINCT category FROM products WHERE is_active = true AND category IS NOT NULL ORDER BY category`
  );
  const categories = categoriesRes.rows.map(r => r.category);

  const hasFullInput = category && cost_price !== undefined && selling_price !== undefined && quantity !== undefined;
  if (!hasFullInput) {
    return { ready: false, categories };
  }

  const costPrice = parseFloat(cost_price);
  const sellingPrice = parseFloat(selling_price);
  const qty = parseInt(quantity, 10);
  const marginPerUnit = sellingPrice - costPrice;
  const marginPercent = sellingPrice > 0 ? (marginPerUnit / sellingPrice) * 100 : null;
  const totalInvestment = costPrice * qty;
  const unitsToBreakeven = marginPerUnit > 0 ? Math.ceil(totalInvestment / marginPerUnit) : null;

  const settingsRes = await pool.query(
    `SELECT setting_value FROM report_settings WHERE setting_key = 'avg_import_lead_time_days'`
  );
  const defaultLeadTime = parseFloat(settingsRes.rows[0]?.setting_value) || null;
  const leadTimeDays = lead_time_days !== undefined ? parseInt(lead_time_days, 10) : defaultLeadTime;

  const benchmarkRes = await pool.query(
    `SELECT
      COUNT(*) as product_count,
      AVG(price) as avg_price,
      AVG(cost_price) FILTER (WHERE cost_price IS NOT NULL) as avg_cost_price,
      AVG(CASE WHEN cost_price IS NOT NULL AND price > 0 THEN ((price - cost_price) / price) * 100 END) as avg_margin_percent
     FROM products
     WHERE category = $1 AND is_active = true`,
    [category]
  );
  const benchmark = benchmarkRes.rows[0];
  const productCount = parseInt(benchmark.product_count, 10);

  const velocityRes = await pool.query(
    `SELECT p.id,
      COALESCE(SUM(oi.quantity) FILTER (WHERE o.status = 'delivered' AND o.created_at >= NOW() - INTERVAL '90 days'), 0) as units_90d
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id
     WHERE p.category = $1 AND p.is_active = true
     GROUP BY p.id`,
    [category]
  );
  const avgWeeklyVelocity = velocityRes.rows.length > 0
    ? velocityRes.rows.reduce((sum, r) => sum + parseInt(r.units_90d, 10), 0) / velocityRes.rows.length / (90 / 7)
    : 0;

  const weeksToSellThrough = avgWeeklyVelocity > 0 ? qty / avgWeeklyVelocity : null;

  const avgCategoryMargin = benchmark.avg_margin_percent !== null ? parseFloat(benchmark.avg_margin_percent) : null;
  const avgCategoryPrice = benchmark.avg_price !== null ? parseFloat(benchmark.avg_price) : null;

  const riskFlags = [];
  if (productCount < 3) {
    riskFlags.push('Only ' + productCount + ' existing product(s) in this category — benchmarks below are low-confidence.');
  }
  if (marginPercent !== null && avgCategoryMargin !== null && marginPercent < avgCategoryMargin - 5) {
    riskFlags.push('Proposed margin (' + marginPercent.toFixed(1) + '%) is more than 5 points below the category average (' + avgCategoryMargin.toFixed(1) + '%).');
  }
  if (avgCategoryPrice !== null && avgCategoryPrice > 0) {
    const priceDeltaPct = ((sellingPrice - avgCategoryPrice) / avgCategoryPrice) * 100;
    if (Math.abs(priceDeltaPct) > 25) {
      riskFlags.push('Proposed price is ' + (priceDeltaPct >= 0 ? priceDeltaPct.toFixed(0) + '% above' : Math.abs(priceDeltaPct).toFixed(0) + '% below') + ' the category average (GHS ' + avgCategoryPrice.toFixed(2) + ') — may face price resistance or look suspiciously cheap.');
    }
  }
  if (weeksToSellThrough !== null && weeksToSellThrough > 12) {
    riskFlags.push('At the category\'s typical sales pace, this order would take about ' + weeksToSellThrough.toFixed(0) + ' weeks to sell through — consider a smaller initial order.');
  }
  if (marginPerUnit <= 0) {
    riskFlags.push('Proposed selling price does not exceed cost price — this product would lose money on every unit as priced.');
  }

  return {
    ready: true,
    categories,
    input: { category, cost_price: costPrice, selling_price: sellingPrice, quantity: qty, lead_time_days: leadTimeDays },
    margin_per_unit: marginPerUnit,
    margin_percent: marginPercent,
    total_investment: totalInvestment,
    units_to_breakeven: unitsToBreakeven,
    category_benchmark: {
      product_count: productCount,
      avg_price: avgCategoryPrice,
      avg_cost_price: benchmark.avg_cost_price !== null ? parseFloat(benchmark.avg_cost_price) : null,
      avg_margin_percent: avgCategoryMargin,
      avg_weekly_velocity: avgWeeklyVelocity,
    },
    weeks_to_sell_through: weeksToSellThrough,
    risk_flags: riskFlags,
  };
};

const getProductViabilityReport = async (req, res) => {
  try {
    const data = await getProductViabilityData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getProductViabilityReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   MANAGER PERFORMANCE — scoped to role = 'manager' only, since the
   actual role list in this system has no separate 'supervisor' role
   (confirmed against real data: accountant, admin, auditor, cashier,
   customer_support, dispatcher, manager, rider, super_admin,
   warehouse). Uses cash dispute resolution as the activity signal —
   the one place manager-level resolution work is genuinely tracked
   today (cash_logs.resolved_by/resolved_at). This is a narrower
   proxy than a full "manages people" scorecard, not a complete
   picture of managerial work — flagged honestly in the report note.
   ───────────────────────────────────────────────────────────────── */
const getManagerPerformanceData = async ({ period = '90', start_date, end_date }) => {
  const useCustomRange = !!(start_date && end_date);
  const queryParams = useCustomRange ? [start_date, end_date] : [];

  const resolvedDateFilter = useCustomRange
    ? `AND DATE(cl.resolved_at) >= $1 AND DATE(cl.resolved_at) <= $2`
    : `AND cl.resolved_at >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const managersRes = await pool.query(
    `SELECT
      u.id, u.name,
      COUNT(cl.id) as disputes_resolved,
      AVG(EXTRACT(EPOCH FROM (cl.resolved_at - cl.created_at)) / 3600) as avg_resolution_hours,
      COALESCE(SUM(cl.amount), 0) as total_disputed_amount,
      COALESCE(SUM(COALESCE(cl.resolved_amount, cl.amount)), 0) as total_resolved_amount
     FROM users u
     LEFT JOIN cash_logs cl ON cl.resolved_by = u.id AND cl.status = 'resolved' ${resolvedDateFilter}
     WHERE u.role = 'manager'
     GROUP BY u.id, u.name
     ORDER BY disputes_resolved DESC`,
    queryParams
  );

  const managers = managersRes.rows.map(m => {
    const disputesResolved = parseInt(m.disputes_resolved, 10);
    const totalDisputed = parseFloat(m.total_disputed_amount);
    const totalResolved = parseFloat(m.total_resolved_amount);
    return {
      id: m.id,
      name: m.name,
      disputes_resolved: disputesResolved,
      has_activity: disputesResolved > 0,
      avg_resolution_hours: m.avg_resolution_hours !== null ? parseFloat(m.avg_resolution_hours) : null,
      total_disputed_amount: totalDisputed,
      total_resolved_amount: totalResolved,
      resolution_variance: totalResolved - totalDisputed,
    };
  });

  // System-wide snapshot, not attributed to any one manager — how many
  // disputes are sitting unresolved right now, regardless of period.
  const pendingRes = await pool.query(
    `SELECT COUNT(*) as pending_count FROM cash_logs WHERE status = 'disputed'`
  );

  return {
    period: useCustomRange ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    pending_disputes_count: parseInt(pendingRes.rows[0].pending_count, 10),
    managers,
  };
};

const getManagerPerformanceReport = async (req, res) => {
  try {
    const data = await getManagerPerformanceData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getManagerPerformanceReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   VAT & LEVY ESTIMATE — backs out VAT/NHIL/GETFund/COVID levy from
   tax-inclusive order totals (confirmed: total_amount already
   includes these). Each levy is calculated on the same net base,
   matching the decoupled (non-compounding) post-reform structure.
   Withholding tax is deliberately NOT estimated here — it applies to
   payments made to suppliers/contractors, not sales revenue, and the
   correct rate depends on what's being paid for (goods/services/rent
   all differ). That requires case-by-case review, not automation.
   Any rate left unset in Report Settings is treated as 0 and flagged,
   not silently assumed.
   ───────────────────────────────────────────────────────────────── */
const getVatEstimateData = async ({ period = '30', start_date, end_date }) => {
  const useCustomRange = !!(start_date && end_date);
  const queryParams = useCustomRange ? [start_date, end_date] : [];

  const orderDateFilter = useCustomRange
    ? `AND DATE(created_at) >= $1 AND DATE(created_at) <= $2`
    : `AND created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const revenueRes = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0) as revenue
     FROM orders WHERE status = 'delivered' ${orderDateFilter}`,
    queryParams
  );
  const revenue = parseFloat(revenueRes.rows[0].revenue);

  const settingsRes = await pool.query(
    `SELECT setting_key, setting_value FROM report_settings
     WHERE setting_key IN ('vat_rate_percent', 'nhil_rate_percent', 'getfund_rate_percent', 'covid_levy_percent')`
  );
  const s = {};
  settingsRes.rows.forEach(r => { s[r.setting_key] = r.setting_value; });

  const rates = {
    vat: s.vat_rate_percent !== null && s.vat_rate_percent !== undefined ? parseFloat(s.vat_rate_percent) : 0,
    nhil: s.nhil_rate_percent !== null && s.nhil_rate_percent !== undefined ? parseFloat(s.nhil_rate_percent) : 0,
    getfund: s.getfund_rate_percent !== null && s.getfund_rate_percent !== undefined ? parseFloat(s.getfund_rate_percent) : 0,
    covid: s.covid_levy_percent !== null && s.covid_levy_percent !== undefined ? parseFloat(s.covid_levy_percent) : 0,
  };
  const unsetRates = Object.entries({
    vat_rate_percent: s.vat_rate_percent, nhil_rate_percent: s.nhil_rate_percent,
    getfund_rate_percent: s.getfund_rate_percent, covid_levy_percent: s.covid_levy_percent,
  }).filter(([, v]) => v === null || v === undefined).map(([k]) => k);

  const combinedRate = rates.vat + rates.nhil + rates.getfund + rates.covid;
  const netBase = combinedRate > 0 ? revenue / (1 + combinedRate / 100) : revenue;

  return {
    period: useCustomRange ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    gross_revenue: revenue,
    net_base: netBase,
    unset_rates: unsetRates,
    breakdown: [
      { label: 'VAT', rate: rates.vat, amount: netBase * (rates.vat / 100) },
      { label: 'NHIL', rate: rates.nhil, amount: netBase * (rates.nhil / 100) },
      { label: 'GETFund', rate: rates.getfund, amount: netBase * (rates.getfund / 100) },
      { label: 'COVID Levy', rate: rates.covid, amount: netBase * (rates.covid / 100) },
    ],
    total_tax_estimate: revenue - netBase,
  };
};

const getVatEstimateReport = async (req, res) => {
  try {
    const data = await getVatEstimateData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getVatEstimateReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   UNIT ECONOMICS PER ORDER — true average profit per delivery:
   revenue minus real COGS (order_items × cost_price) minus MoMo fee
   (only applied to momo-paid orders, using momo_fee_percent) minus
   average rider cost per delivery. The two new settings this depends
   on are surfaced as missing (not silently zero) if unset, same
   pattern as every other formula-driven report in this hub.
   ───────────────────────────────────────────────────────────────── */
const getUnitEconomicsData = async ({ period = '30', start_date, end_date }) => {
  const useCustomRange = !!(start_date && end_date);
  const queryParams = useCustomRange ? [start_date, end_date] : [];

  const orderDateFilter = useCustomRange
    ? `AND DATE(o.created_at) >= $1 AND DATE(o.created_at) <= $2`
    : `AND o.created_at >= NOW() - INTERVAL '${parseInt(period)} days'`;

  const ordersRes = await pool.query(
    `SELECT o.id, o.total_amount, o.payment_method,
            COALESCE(SUM(oi.quantity * p.cost_price), 0) as cogs
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE o.status = 'delivered' ${orderDateFilter}
     GROUP BY o.id, o.total_amount, o.payment_method`,
    queryParams
  );

  const settingsRes = await pool.query(
    `SELECT setting_key, setting_value FROM report_settings
     WHERE setting_key IN ('momo_fee_percent', 'avg_rider_cost_per_delivery')`
  );
  const s = {};
  settingsRes.rows.forEach(r => { s[r.setting_key] = r.setting_value; });
  const momoFeeConfigured = s.momo_fee_percent !== null && s.momo_fee_percent !== undefined;
  const riderCostConfigured = s.avg_rider_cost_per_delivery !== null && s.avg_rider_cost_per_delivery !== undefined;
  const momoFeePercent = momoFeeConfigured ? parseFloat(s.momo_fee_percent) : 0;
  const riderCost = riderCostConfigured ? parseFloat(s.avg_rider_cost_per_delivery) : 0;

  const perOrder = ordersRes.rows.map(o => {
    const revenue = parseFloat(o.total_amount);
    const cogs = parseFloat(o.cogs);
    const isMomo = (o.payment_method || '').toLowerCase().includes('momo');
    const momoFee = isMomo ? revenue * (momoFeePercent / 100) : 0;
    const netProfit = revenue - cogs - momoFee - riderCost;
    return { revenue, cogs, momo_fee: momoFee, rider_cost: riderCost, net_profit: netProfit, payment_method: o.payment_method, is_momo: isMomo };
  });

  const totalOrders = perOrder.length;
  const avg = (key) => totalOrders > 0 ? perOrder.reduce((sum, o) => sum + o[key], 0) / totalOrders : 0;

  const byPaymentMethod = {};
  perOrder.forEach(o => {
    const key = o.payment_method || 'unknown';
    if (!byPaymentMethod[key]) byPaymentMethod[key] = { count: 0, total_net_profit: 0 };
    byPaymentMethod[key].count += 1;
    byPaymentMethod[key].total_net_profit += o.net_profit;
  });
  const paymentMethodBreakdown = Object.entries(byPaymentMethod).map(([method, v]) => ({
    payment_method: method,
    order_count: v.count,
    avg_net_profit: v.count > 0 ? v.total_net_profit / v.count : 0,
  }));

  return {
    period: useCustomRange ? 'custom' : parseInt(period),
    start_date: start_date || null,
    end_date: end_date || null,
    momo_fee_configured: momoFeeConfigured,
    rider_cost_configured: riderCostConfigured,
    total_orders: totalOrders,
    avg_revenue: avg('revenue'),
    avg_cogs: avg('cogs'),
    avg_momo_fee: avg('momo_fee'),
    avg_rider_cost: avg('rider_cost'),
    avg_net_profit: avg('net_profit'),
    by_payment_method: paymentMethodBreakdown,
  };
};

const getUnitEconomicsReport = async (req, res) => {
  try {
    const data = await getUnitEconomicsData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getUnitEconomicsReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
const getBudgetVsActualData = async ({ month }) => {
  const targetMonth = month || new Date().toISOString().slice(0, 7); // 'YYYY-MM'

  const financials = await getMonthlyFinancials(targetMonth);

  const settingsRes = await pool.query(
    `SELECT setting_key, setting_value FROM report_settings
     WHERE setting_key IN ('monthly_revenue_budget', 'monthly_expense_budget',
       'target_gross_margin_percent', 'target_net_margin_percent')`
  );
  const s = {};
  settingsRes.rows.forEach(r => { s[r.setting_key] = r.setting_value; });

  const revenue = financials.revenue;
  const actualExpenses = financials.expenses;

  const revenueBudget = s.monthly_revenue_budget !== null && s.monthly_revenue_budget !== undefined ? parseFloat(s.monthly_revenue_budget) : null;
  const expenseBudget = s.monthly_expense_budget !== null && s.monthly_expense_budget !== undefined ? parseFloat(s.monthly_expense_budget) : null;
  const targetGrossMargin = s.target_gross_margin_percent !== null && s.target_gross_margin_percent !== undefined ? parseFloat(s.target_gross_margin_percent) : null;
  const targetNetMargin = s.target_net_margin_percent !== null && s.target_net_margin_percent !== undefined ? parseFloat(s.target_net_margin_percent) : null;

  return {
    month: targetMonth,
    revenue,
    cogs: financials.cogs,
    gross_profit: financials.gross_profit,
    gross_margin_percent: financials.gross_margin_percent,
    actual_expenses: actualExpenses,
    net_profit: financials.net_profit,
    net_margin_percent: financials.net_margin_percent,
    revenue_budget: revenueBudget,
    revenue_variance: revenueBudget !== null ? revenue - revenueBudget : null,
    revenue_variance_percent: revenueBudget ? ((revenue - revenueBudget) / revenueBudget) * 100 : null,
    expense_budget: expenseBudget,
    expense_variance: expenseBudget !== null ? actualExpenses - expenseBudget : null,
    expense_variance_percent: expenseBudget ? ((actualExpenses - expenseBudget) / expenseBudget) * 100 : null,
    target_gross_margin_percent: targetGrossMargin,
    target_net_margin_percent: targetNetMargin,
  };
};

const getBudgetVsActualReport = async (req, res) => {
  try {
    const data = await getBudgetVsActualData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getBudgetVsActualReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   EXPRESS HANDLERS — unchanged behavior, just now call the data functions above
   ───────────────────────────────────────────────────────────────── */

const getRevenueReport = async (req, res) => {
  try {
    const data = await getRevenueData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getRevenueReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getProductReport = async (req, res) => {
  try {
    const data = await getProductData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getProductReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getRiderReport = async (req, res) => {
  try {
    const data = await getRiderData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getRiderReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   ORDER JOURNEY — full lifecycle trace for a single order: line
   items, the cash-log timeline (who collected, verified, disputed,
   and resolved — and when), and the delivery timeline (who was
   assigned, accepted, picked up, and delivered it). A lookup tool
   keyed by order_number, not a period report.
   ───────────────────────────────────────────────────────────────── */
const getOrderJourneyData = async ({ order_number }) => {
  if (!order_number) {
    return { found: false, message: 'Enter an order number to search' };
  }

  const orderRes = await pool.query(
    `SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
            u.name as created_by_name
     FROM orders o
     LEFT JOIN customers c ON o.customer_id = c.id
     LEFT JOIN users u ON o.created_by = u.id
     WHERE o.order_number = $1`,
    [order_number]
  );

  if (!orderRes.rows.length) {
    return { found: false, message: `No order found with number "${order_number}"` };
  }
  const order = orderRes.rows[0];

  const itemsRes = await pool.query(
    `SELECT oi.quantity, oi.unit_price, oi.total_price, p.name as product_name, p.category as product_category
     FROM order_items oi
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1
     ORDER BY oi.id`,
    [order.id]
  );

  // Every cash log tied to this order, in chronological order — covers
  // the original collection plus any dispute/top-up/resolve activity,
  // each with the actual person's name at every step.
  const cashLogsRes = await pool.query(
    `SELECT cl.*, r.name as rider_name,
            uv.name as verified_by_name, ur.name as resolved_by_name
     FROM cash_logs cl
     LEFT JOIN riders r ON cl.rider_id = r.id
     LEFT JOIN users uv ON cl.verified_by = uv.id
     LEFT JOIN users ur ON cl.resolved_by = ur.id
     WHERE cl.order_id = $1
     ORDER BY cl.created_at ASC`,
    [order.id]
  );

  const deliveryRes = await pool.query(
    `SELECT d.*, r.name as rider_name, r.phone as rider_phone
     FROM deliveries d
     LEFT JOIN riders r ON d.rider_id = r.id
     WHERE d.order_id = $1
     ORDER BY d.assigned_at ASC`,
    [order.id]
  );

  return {
    found: true,
    order,
    items: itemsRes.rows,
    cash_logs: cashLogsRes.rows,
    deliveries: deliveryRes.rows,
  };
};

const getOrderJourneyReport = async (req, res) => {
  try {
    const data = await getOrderJourneyData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getOrderJourneyReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────
   DAILY SALES REGISTER — every order placed on a single day, broken
   down to individual line items: customer, product, qty, unit price,
   line total, order-level discount, delivery address. Single-date
   report, not a period report.
   ───────────────────────────────────────────────────────────────── */
const getDailySalesRegisterData = async ({ date }) => {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const ordersRes = await pool.query(
    `SELECT o.id, o.order_number, o.status, o.payment_method, o.payment_status,
            o.total_amount, o.delivery_fee, o.discount, o.discount_reason, o.created_at,
            o.delivery_address, c.name as customer_name, c.phone as customer_phone
     FROM orders o
     LEFT JOIN customers c ON o.customer_id = c.id
     WHERE DATE(o.created_at) = $1
     ORDER BY o.created_at ASC`,
    [targetDate]
  );
  const orderIds = ordersRes.rows.map(o => o.id);
  const itemsByOrder = {};
  if (orderIds.length) {
    const itemsRes = await pool.query(
      `SELECT oi.order_id, oi.quantity, oi.unit_price, oi.total_price, p.name as product_name
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ANY($1)
       ORDER BY oi.id`,
      [orderIds]
    );
    itemsRes.rows.forEach(it => {
      if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
      itemsByOrder[it.order_id].push(it);
    });
  }
  const orders = ordersRes.rows.map(o => ({ ...o, items: itemsByOrder[o.id] || [] }));
  const summary = {
    total_orders: orders.length,
    total_items: orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0),
    total_revenue: orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0),
    total_discount: orders.reduce((sum, o) => sum + parseFloat(o.discount || 0), 0),
  };
  return { date: targetDate, orders, summary };
};

const getDailySalesRegisterReport = async (req, res) => {
  try {
    const data = await getDailySalesRegisterData(req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('getDailySalesRegisterReport error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getRevenueReport, getProductReport, getRiderReport, getPnLReport, getBudgetVsActualReport, getMarginTrendReport, getExceptionsReport, getAuditTrailReport, getCashReconciliationReport, getLoginAnomaliesReport, getPermissionChangeReport, getCashierPerformanceReport, getTrueMarginReport, getCashFlowReport, getVatEstimateReport, getUnitEconomicsReport, getCashRunwayReport, getReorderPointReport, getSupplierScorecardReport, getCustomerAnalyticsReport, getDemandForecastReport, getNewProductScorecardReport, getProductViabilityReport, getManagerPerformanceReport, getOrderJourneyReport, getDailySalesRegisterReport,
  getRevenueData, getProductData, getRiderData, getPnLData, getBudgetVsActualData, getMarginTrendData, getExceptionsData, getAuditTrailData, getCashReconciliationData, getLoginAnomaliesData, getPermissionChangeData, getCashierPerformanceData, getTrueMarginData, getCashFlowData, getVatEstimateData, getUnitEconomicsData, getCashRunwayData, getReorderPointData, getSupplierScorecardData, getCustomerAnalyticsData, getDemandForecastData, getNewProductScorecardData, getProductViabilityData, getManagerPerformanceData, getOrderJourneyData, getDailySalesRegisterData,
};
