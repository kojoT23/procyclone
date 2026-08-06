import React, { useState, useEffect, useCallback } from 'react';
import API, { productsAPI, reportSettingsAPI } from '../utils/api';

const reportsAPI = {
  getRevenue:  (params) => API.get('/reports/revenue',  { params }),
  getPnL:      (params) => API.get('/reports/pnl',      { params }),
  getBudget:   (params) => API.get('/reports/budget',   { params }),
  getMarginTrend: (params) => API.get('/reports/margin-trend', { params }),
  getExceptions: (params) => API.get('/reports/exceptions', { params }),
  getAuditTrail: (params) => API.get('/reports/audit-trail', { params }),
  getCashReconciliation: (params) => API.get('/reports/cash-reconciliation', { params }),
  getLoginAnomalies: (params) => API.get('/reports/login-anomalies', { params }),
  getPermissionChanges: (params) => API.get('/reports/permission-changes', { params }),
  getCashierPerformance: (params) => API.get('/reports/cashier-performance', { params }),
  getTrueMargin: (params) => API.get('/reports/true-margin', { params }),
  getCashFlow: (params) => API.get('/reports/cash-flow', { params }),
  getCashRunway: (params) => API.get('/reports/cash-runway', { params }),
  getReorderPoint: (params) => API.get('/reports/reorder-point', { params }),
  getSupplierScorecard: (params) => API.get('/reports/supplier-scorecard', { params }),
  getCustomerAnalytics: (params) => API.get('/reports/customer-analytics', { params }),
  getDemandForecast: (params) => API.get('/reports/demand-forecast', { params }),
  getNewProductScorecard: (params) => API.get('/reports/new-product-scorecard', { params }),
  getProductViability: (params) => API.get('/reports/product-viability', { params }),
  getManagerPerformance: (params) => API.get('/reports/manager-performance', { params }),
  getOrderJourney: (params) => API.get('/reports/order-journey', { params }),
  getVatEstimate: (params) => API.get('/reports/vat-estimate', { params }),
  getUnitEconomics: (params) => API.get('/reports/unit-economics', { params }),
  getProducts: (params) => API.get('/reports/products', { params }),
  getRiders:   (params) => API.get('/reports/riders',   { params }),
  getDailySalesRegister: (params) => API.get('/reports/daily-sales-register', { params }),
};

const CATEGORIES = [
  {
    key: 'financial',
    label: 'Financial Statements',
    icon: '\u{1F4CA}',
    reports: [
      {
        key: 'revenue',
        label: 'Revenue Report',
        icon: '\u{1F4B0}',
        note: 'Daily and total revenue, order counts, and payment method breakdown. Check this first for overall sales health.',
      },
      {
        key: 'pnl',
        label: 'Profit & Loss',
        icon: '\u{1F4C9}',
        note: 'Revenue minus COGS minus operating expenses, using real formulas off your actual order and expense data. Set cost_price_includes_landed_cost in Report Settings for this to be accurate.',
      },
      {
        key: 'cash-flow',
        label: 'Cash Flow Statement',
        icon: '\u{1F4B8}',
        note: 'Cash actually collected (verified rider collections) vs cash actually spent — different from P&L, which counts revenue whether or not it\'s been collected yet.',
      },
      {
        key: 'vat-estimate',
        label: 'VAT & Levy Estimate',
        icon: '\u{1F9FE}',
        note: 'Backs out VAT/NHIL/GETFund/COVID levy from tax-inclusive sales. Withholding tax is not estimated — it applies to supplier payments, not sales.',
      },
    ],
  },
  { key: 'analysis', label: 'Financial Analysis & Advisory', icon: '\u{1F4C8}', reports: [
      {
        key: 'budget',
        label: 'Budget vs Actual',
        icon: '\u{1F3AF}',
        note: 'Compares one real month\'s revenue, expenses, and margins against the targets you set in Report Settings.',
      },
      {
        key: 'margin-trend',
        label: 'Margin Trend',
        icon: '\u{1F4C9}',
        note: 'Gross and net margin over the last several months, so you can see whether profitability is improving or slipping.',
      },
      {
        key: 'unit-economics',
        label: 'Unit Economics per Order',
        icon: '\u{1F9EE}',
        note: 'True average profit per delivery — revenue minus COGS, MoMo fee, and rider cost. Set momo_fee_percent and avg_rider_cost_per_delivery in Report Settings for this to be accurate.',
      },
      {
        key: 'cash-runway',
        label: 'Cash Runway',
        icon: '\u{23F3}',
        note: 'How much cash you have on hand and, if you\'re currently spending more than you\'re collecting, how many days/months that cash lasts at the current burn rate.',
      },
      {
        key: 'customer-analytics',
        label: 'Customer Analytics',
        icon: '\u{1F9D1}',
        note: 'Lifetime value, repeat-purchase rate, and at-risk customers (no order in the last 45+ days). The period selector controls the "new customers" window only, not the at-risk threshold.',
      },
    ] },
  {
    key: 'operations',
    label: 'Operations & Daily Admin',
    icon: '\u{1F4E6}',
    reports: [
      {
        key: 'products',
        label: 'Product Performance',
        icon: '\u{1F4E6}',
        note: 'Top sellers, low stock, and out-of-stock items. Use this to decide what to restock and what to stop carrying.',
      },
      {
        key: 'supplier-scorecard',
        label: 'Supplier Scorecard',
        icon: '\u{1F6A2}',
        note: 'On-time delivery rate, cost accuracy (planned vs actual landed cost), and purchase order cancellation rate per supplier. A supplier with no history in a given dimension isn\'t penalized for it.',
      },
      {
        key: 'daily-sales-register',
        label: 'Daily Sales Register',
        icon: '\u{1F9FE}',
        note: 'Every order placed on a single day, broken down to individual line items — customer, product, qty, price, and delivery address. Pick a date to see the full register.',
      },
    ],
  },
  {
    key: 'staff',
    label: 'Staff Performance',
    icon: '\u{1F465}',
    reports: [
      {
        key: 'riders',
        label: 'Rider Performance',
        icon: '\u{1F3CD}',
        note: 'Delivery success rate, cash collected, and disputes per rider. Use this for performance reviews and payout checks.',
      },
      {
        key: 'cashier-performance',
        label: 'Cashier / Verifier Performance',
        icon: '\u{1F9FE}',
        note: 'Volume and value of cash collections each staff member has verified — real data from who actually clicked Verify.',
      },
      {
        key: 'manager-performance',
        label: 'Manager Performance',
        icon: '\u{1F3E2}',
        note: 'Cash dispute resolution activity per manager — count resolved and average resolution time. Note: this is one real signal of managerial work, not a complete performance picture; there\'s no supervisor role in this system, and no dedicated escalation/reassignment tracking yet.',
      },
    ],
  },
  { key: 'audit', label: 'Audit & Controls', icon: '\u{1F50D}', reports: [
      {
        key: 'exceptions',
        label: 'Exceptions Report',
        icon: '\u{26A0}',
        note: 'Every disputed and resolved cash log in one place — the shortfalls, the auto-flags, and how they were closed out.',
      },
      {
        key: 'audit-trail',
        label: 'Staff Action Audit Trail',
        icon: '\u{1F4DC}',
        note: 'Every create/update/delete action logged system-wide, broken down by action type and by who did it.',
      },
      {
        key: 'cash-reconciliation',
        label: 'Cash Reconciliation Variance',
        icon: '\u{1F4B5}',
        note: 'Every rider\'s expected cash (delivered COD orders) vs what they actually logged, sorted worst-shortage-first.',
      },
      {
        key: 'login-anomalies',
        label: 'Login Anomalies',
        icon: '\u{1F6A8}',
        note: 'Repeated failed login attempts, and off-hours logins if business hours are set in Report Settings.',
      },
      {
        key: 'permission-changes',
        label: 'Permission-Change Log',
        icon: '\u{1F510}',
        note: 'Every role change, status toggle, and account deletion — who changed it and when.',
      },
      {
        key: 'compliance-calendar',
        label: 'Compliance Calendar',
        icon: '\u{1F4C5}',
        note: 'Tax, customs, permit, insurance, and internal deadlines in one place — add deadlines, set recurrence, and mark items filed. Recurring items auto-generate their next occurrence when filed.',
      },
      {
        key: 'order-journey',
        label: 'Order Journey',
        icon: '\u{1F9ED}',
        note: 'Search any order by order number to see its full trail — items, who verified the cash and when, and the delivery timeline from assignment to drop-off.',
      },
    ] },
  { key: 'forecasting', label: 'Forecasting & Product Intelligence', icon: '\u{1F52E}', reports: [
      {
        key: 'true-margin',
        label: 'True Margin per Product',
        icon: '\u{1F4B0}',
        note: 'Real profit per product using cost_price, sorted most-profitable-first. Products missing a cost_price are flagged separately, not silently assumed free.',
      },
      {
        key: 'reorder-point',
        label: 'Reorder Point / Weeks of Supply',
        icon: '\u{1F4E6}',
        note: 'How many weeks of stock each product has left based on real sales velocity, plus which products have already crossed their reorder point. Set avg_import_lead_time_days in Report Settings for the reorder math to include lead-time buffer.',
      },
      {
        key: 'demand-forecast',
        label: 'Demand Forecast per SKU',
        icon: '\u{1F52E}',
        note: 'Compares this period to the prior equal-length period to flag growing/declining/stable demand, with a dampened forecast for next period. A planning signal, not a guarantee — only uses the period selector, not custom date ranges.',
      },
      {
        key: 'new-product-scorecard',
        label: 'New Product Scorecard',
        icon: '\u{1F195}',
        note: 'Since-launch performance for products added recently — units sold, revenue, and weekly velocity, flagged as Too Early / No Traction / Underperforming / Performing. Products under 14 days old are never penalized for lack of data.',
      },
      {
        key: 'product-viability',
        label: 'Product Viability Survey',
        icon: '\u{1F9EA}',
        note: 'Before you bring in a new product: enter proposed cost, price, and order quantity, and see margin, breakeven units, and how it stacks up against similar products already in your catalog.',
      },
    ] },
];

const BarChart = ({ data }) => {
  if (!data?.length) return null;
  const maxVal = Math.max(...data.map(d => parseFloat(d.revenue || 0)), 1);
  const W = 600, H = 180, PAD = 40;
  const barW = Math.max(6, Math.floor((W - PAD * 2) / data.length) - 4);

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = PAD + H - frac * H;
        return (
          <g key={frac}>
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={PAD - 4} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {(frac * maxVal / 1000).toFixed(0)}k
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const val   = parseFloat(d.revenue || 0);
        const barH  = (val / maxVal) * H;
        const x     = PAD + i * ((W - PAD * 2) / data.length) + 2;
        const y     = PAD + H - barH;
        const isMax = val === Math.max(...data.map(dd => parseFloat(dd.revenue || 0)));
        const isMin = val === Math.min(...data.map(dd => parseFloat(dd.revenue || 0)));
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx="3"
              fill={isMax ? '#22c55e' : isMin ? '#ef4444' : '#3b82f6'} opacity="0.85" />
            {data.length <= 14 && (
              <text x={x + barW / 2} y={H + PAD + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">
                {new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

const MarginTrendChart = ({ months }) => {
  if (!months?.length) return null;
  const W = 600, H = 200, PAD = 40;
  const allVals = months.flatMap(m => [m.gross_margin_percent, m.net_margin_percent]);
  const maxVal = Math.max(...allVals, 10);
  const minVal = Math.min(...allVals, 0);
  const range = maxVal - minVal || 1;
  const stepX = (W - PAD * 2) / Math.max(months.length - 1, 1);

  const yFor = (val) => PAD + H - ((val - minVal) / range) * H;
  const pathFor = (key) => months.map((m, i) => `${i === 0 ? 'M' : 'L'} ${PAD + i * stepX} ${yFor(m[key])}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.5, 1].map(frac => {
        const y = PAD + H - frac * H;
        return <line key={frac} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
      })}
      <path d={pathFor('gross_margin_percent')} fill="none" stroke="#3b82f6" strokeWidth="2" />
      <path d={pathFor('net_margin_percent')} fill="none" stroke="#22c55e" strokeWidth="2" />
      {months.map((m, i) => (
        <g key={i}>
          <circle cx={PAD + i * stepX} cy={yFor(m.gross_margin_percent)} r="3" fill="#3b82f6" />
          <circle cx={PAD + i * stepX} cy={yFor(m.net_margin_percent)} r="3" fill="#22c55e" />
          <text x={PAD + i * stepX} y={H + PAD + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">{m.month.slice(5)}</text>
        </g>
      ))}
      <text x={W - PAD - 150} y={12} fontSize="10" fill="#3b82f6">● Gross Margin</text>
      <text x={W - PAD - 60} y={12} fontSize="10" fill="#22c55e">● Net Margin</text>
    </svg>
  );
};

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f472b6', '#84cc16', '#0ea5e9', '#a855f7'];

const PieChart = ({ data }) => {
  if (!data?.length) return null;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total <= 0) return null;
  const R = 80, CX = 100, CY = 100;
  let cumulativeAngle = -90;
  const toRad = a => (a * Math.PI) / 180;

  const slices = data.map((d, i) => {
    const angle = (d.value / total) * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;
    const x1 = CX + R * Math.cos(toRad(startAngle));
    const y1 = CY + R * Math.sin(toRad(startAngle));
    const x2 = CX + R * Math.cos(toRad(endAngle));
    const y2 = CY + R * Math.sin(toRad(endAngle));
    const largeArc = angle > 180 ? 1 : 0;
    return {
      path: `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: PIE_COLORS[i % PIE_COLORS.length],
      label: d.label,
      percent: (d.value / total) * 100,
    };
  });

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 200 200" style={{ width: '180px', height: '180px', flexShrink: 0 }}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="1.5" />)}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span style={{ width: '10px', height: '10px', background: s.color, borderRadius: '2px', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ color: 'var(--text-2)', textTransform: 'capitalize' }}>{s.label}</span>
            <span style={{ fontWeight: '700' }}>{s.percent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const GroupedBarChart = ({ groups }) => {
  if (!groups?.length) return null;
  const maxVal = Math.max(...groups.flatMap(g => [g.target || 0, g.actual || 0]), 1);
  const W = 500, H = 180, PAD = 50;
  const groupWidth = (W - PAD * 2) / groups.length;
  const barWidth = groupWidth / 3.5;

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.5, 1].map(f => {
        const y = PAD + H - f * H;
        return <line key={f} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
      })}
      {groups.map((g, i) => {
        const gx = PAD + i * groupWidth;
        const targetH = ((g.target || 0) / maxVal) * H;
        const actualH = ((g.actual || 0) / maxVal) * H;
        return (
          <g key={i}>
            <rect x={gx + barWidth * 0.3} y={PAD + H - targetH} width={barWidth} height={targetH} fill="#94a3b8" rx="2" />
            <rect x={gx + barWidth * 1.7} y={PAD + H - actualH} width={barWidth} height={actualH} fill="#3b82f6" rx="2" />
            <text x={gx + groupWidth / 2} y={H + PAD + 16} textAnchor="middle" fontSize="10" fill="#64748b">{g.label}</text>
          </g>
        );
      })}
      <rect x={W - PAD - 140} y={4} width="8" height="8" fill="#94a3b8" />
      <text x={W - PAD - 128} y={12} fontSize="10" fill="#64748b">Target</text>
      <rect x={W - PAD - 70} y={4} width="8" height="8" fill="#3b82f6" />
      <text x={W - PAD - 58} y={12} fontSize="10" fill="#64748b">Actual</text>
    </svg>
  );
};

const SimpleBarChart = ({ data, valueKey = 'value', labelKey = 'label', color = '#3b82f6', multiColor = false }) => {
  if (!data?.length) return null;
  const maxVal = Math.max(...data.map(d => d[valueKey] || 0), 1);
  const W = 600, H = 180, PAD = 40;
  const barW = Math.max(6, Math.floor((W - PAD * 2) / data.length) - 8);

  return (
    <svg viewBox={`0 0 ${W} ${H + 40}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.5, 1].map(f => {
        const y = PAD + H - f * H;
        return <line key={f} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
      })}
      {data.map((d, i) => {
        const val = d[valueKey] || 0;
        const barH = (val / maxVal) * H;
        const x = PAD + i * ((W - PAD * 2) / data.length) + 4;
        const y = PAD + H - barH;
        const barColor = multiColor ? PIE_COLORS[i % PIE_COLORS.length] : color;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx="3" fill={barColor} opacity="0.9" />
            <text x={x + barW / 2} y={H + PAD + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">
              {String(d[labelKey]).length > 10 ? String(d[labelKey]).slice(0, 9) + '…' : d[labelKey]}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const SETTINGS_FIELDS = [
  { key: 'vat_rate_percent',            label: 'VAT Rate (%)' },
  { key: 'nhil_rate_percent',           label: 'NHIL Levy (%)' },
  { key: 'getfund_rate_percent',        label: 'GETFund Levy (%)' },
  { key: 'covid_levy_percent',          label: 'COVID-19 Levy (%)' },
  { key: 'withholding_tax_percent',     label: 'Withholding Tax (%)' },
  { key: 'gra_import_duty_percent',     label: 'Default GRA Import Duty (%)' },
  { key: 'low_stock_threshold_default', label: 'Default Low-Stock Threshold (units)' },
  { key: 'target_gross_margin_percent', label: 'Target Gross Margin (%)' },
  { key: 'target_net_margin_percent',   label: 'Target Net Margin (%)' },
  { key: 'avg_import_lead_time_days',   label: 'Avg Import Lead Time (days)' },
  { key: 'monthly_revenue_budget',      label: 'Monthly Revenue Budget (GHS)' },
  { key: 'monthly_expense_budget',      label: 'Monthly Expense Budget (GHS)' },
  {
    key: 'cost_price_includes_landed_cost',
    label: 'Does cost_price include landed cost (duty/freight)?',
    type: 'select',
    options: [
      { value: '', label: 'Not set' },
      { value: '1', label: 'Yes — includes landed cost' },
      { value: '0', label: 'No — raw supplier price only' },
    ],
  },
  { key: 'business_hours_start', label: 'Business Hours Start (0-23, e.g. 7 for 7am)' },
  { key: 'business_hours_end',   label: 'Business Hours End (0-23, e.g. 20 for 8pm)' },
  { key: 'momo_fee_percent',            label: 'MoMo Transaction Fee (%)' },
  { key: 'avg_rider_cost_per_delivery', label: 'Avg Rider Cost per Delivery (GHS)' },
];

const SettingsPanel = ({ onClose }) => {
  const [values, setValues]   = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    reportSettingsAPI.get().then(res => {
      const map = {};
      res.data.settings.forEach(s => { map[s.setting_key] = s.setting_value ?? s.setting_text ?? ''; });
      setValues(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleChange = (key, val) => setValues(v => ({ ...v, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await reportSettingsAPI.update(values);
      setSaved(true);
    } catch {
      alert('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '560px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Report Settings</h3>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
      </div>
      <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: '0 0 16px' }}>
        These numbers feed every formula across the Reports Hub. Nothing is hardcoded in the app; whatever you set here is what gets used.
      </p>

      {loading ? (
        <div className="loading"><div className="loading-spinner" /><span className="loading-text">Loading settings...</span></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {SETTINGS_FIELDS.map(f => (
            <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-2)', flex: 1 }}>{f.label}</label>
              {f.type === 'select' ? (
                <select
                  className="form-input"
                  style={{ width: '220px' }}
                  value={values[f.key] ?? ''}
                  onChange={e => handleChange(f.key, e.target.value)}
                >
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  style={{ width: '140px' }}
                  value={values[f.key] ?? ''}
                  onChange={e => handleChange(f.key, e.target.value)}
                  placeholder="Not set"
                />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
            <button className="btn btn-success btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {saved && <span style={{ color: 'var(--accent, #22c55e)', fontSize: '13px' }}>Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
};

const ReportCard = ({ report, onClick }) => (
  <button
    onClick={onClick}
    className="card"
    style={{
      textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border, #e5e7eb)',
      display: 'flex', flexDirection: 'column', gap: '8px', width: '100%',
    }}
  >
    <span style={{ fontSize: '22px' }}>{report.icon}</span>
    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>{report.label}</h4>
    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.4 }}>{report.note}</p>
  </button>
);

const ExportButtons = ({ reportKey, exporting, onExport }) => (
  <div style={{ display: 'flex', gap: '8px' }}>
    <button className="btn btn-secondary btn-sm" onClick={() => onExport(reportKey, 'docx')} disabled={exporting === `${reportKey}-docx`}>
      {exporting === `${reportKey}-docx` ? 'Generating...' : 'Export Word'}
    </button>
    <button className="btn btn-secondary btn-sm" onClick={() => onExport(reportKey, 'xlsx')} disabled={exporting === `${reportKey}-xlsx`}>
      {exporting === `${reportKey}-xlsx` ? 'Generating...' : 'Export Excel'}
    </button>
  </div>
);

/* ── Compliance Calendar (Audit & Controls) ──
   Merged in-file rather than kept as a separate component file, to match
   the rest of the hub's convention of everything living in ReportsHub.js.
   Unlike the other reports, this one owns full CRUD, so it manages its
   own local state/fetching instead of using the hub's shared report state. */
const complianceAPI = {
  list:   (params) => API.get('/compliance', { params }),
  get:    (id) => API.get(`/compliance/${id}`),
  create: (body) => API.post('/compliance', body),
  update: (id, body) => API.put(`/compliance/${id}`, body),
  file:   (id) => API.put(`/compliance/${id}/file`),
  remove: (id) => API.delete(`/compliance/${id}`),
};

const COMPLIANCE_CATEGORY_LABELS = {
  tax: 'Tax',
  customs: 'Customs',
  permits: 'Permits',
  insurance: 'Insurance',
  internal: 'Internal',
};

const COMPLIANCE_RECURRENCE_LABELS = {
  none: 'One-time',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

const COMPLIANCE_STATUS_BADGE = {
  overdue: 'badge-red',
  due_soon: 'badge-amber',
  upcoming: 'badge-green',
  filed: 'badge-green',
};

const COMPLIANCE_STATUS_LABEL = {
  overdue: 'Overdue',
  due_soon: 'Due Soon',
  upcoming: 'Upcoming',
  filed: 'Filed',
};

const COMPLIANCE_EMPTY_FORM = {
  title: '', category: 'tax', due_date: '', recurrence: 'none',
  reminder_days_before: 14, notes: '',
};

const complianceLabelStyle = { fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '4px' };

const ComplianceCalendar = () => {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(COMPLIANCE_EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actioningId, setActioningId] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await complianceAPI.list(params);
      setItems(res.data.items || []);
      setSummary(res.data.summary || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openAddForm = () => {
    setForm(COMPLIANCE_EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEditForm = (item) => {
    setForm({
      title: item.title,
      category: item.category,
      due_date: item.due_date?.slice(0, 10) || '',
      recurrence: item.recurrence,
      reminder_days_before: item.reminder_days_before,
      notes: item.notes || '',
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.category || !form.due_date) return;
    setSaving(true);
    try {
      if (editingId) {
        await complianceAPI.update(editingId, form);
      } else {
        await complianceAPI.create(form);
      }
      setShowForm(false);
      setForm(COMPLIANCE_EMPTY_FORM);
      setEditingId(null);
      fetchItems();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error saving compliance item');
    } finally {
      setSaving(false);
    }
  };

  const handleFile = async (id) => {
    setActioningId(id);
    try {
      const res = await complianceAPI.file(id);
      if (res.data.next_item) {
        alert(`Marked filed. Next occurrence created for ${res.data.next_item.due_date}.`);
      }
      fetchItems();
    } catch (err) {
      console.error(err);
      alert('Error marking item filed');
    } finally {
      setActioningId(null);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    setActioningId(id);
    try {
      await complianceAPI.remove(id);
      fetchItems();
    } catch (err) {
      console.error(err);
      alert('Error deleting compliance item');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <div className="card" style={{ borderLeft: '4px solid #ef4444', background: '#fef2f2' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Overdue</div>
            <div style={{ fontSize: '22px', fontWeight: '700' }}>{summary.overdue}</div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Due Soon</div>
            <div style={{ fontSize: '22px', fontWeight: '700' }}>{summary.due_soon}</div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid #22c55e', background: '#f0fdf4' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Upcoming</div>
            <div style={{ fontSize: '22px', fontWeight: '700' }}>{summary.upcoming}</div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid #94a3b8', background: '#f8fafc' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Filed</div>
            <div style={{ fontSize: '22px', fontWeight: '700' }}>{summary.filed}</div>
          </div>
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
        <div>
          <label style={complianceLabelStyle}>Category</label>
          <select className="form-input" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {Object.entries(COMPLIANCE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label style={complianceLabelStyle}>Status</label>
          <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="pending">Pending (not yet filed)</option>
            <option value="filed">Filed</option>
            <option value="">All</option>
          </select>
        </div>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={openAddForm}>
          + Add Deadline
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>
            {editingId ? 'Edit Deadline' : 'New Deadline'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={complianceLabelStyle}>Title</label>
              <input
                className="form-input" placeholder="e.g. Monthly VAT Return"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label style={complianceLabelStyle}>Category</label>
              <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {Object.entries(COMPLIANCE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={complianceLabelStyle}>Due Date</label>
              <input
                type="date" className="form-input"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div>
              <label style={complianceLabelStyle}>Recurrence</label>
              <select className="form-input" value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}>
                {Object.entries(COMPLIANCE_RECURRENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={complianceLabelStyle}>Remind (days before due)</label>
              <input
                type="number" className="form-input"
                value={form.reminder_days_before}
                onChange={e => setForm(f => ({ ...f, reminder_days_before: e.target.value }))}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={complianceLabelStyle}>Notes (optional)</label>
              <input
                className="form-input" placeholder="e.g. Filed via GRA online portal"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              className="btn btn-primary"
              disabled={saving || !form.title || !form.due_date}
              onClick={handleSave}
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Deadline'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowForm(false); setEditingId(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Due Date</th>
              <th>Recurrence</th>
              <th>Status</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ color: 'var(--text-2)' }}>Loading...</td></tr>
            ) : !items.length ? (
              <tr><td colSpan={7} style={{ color: 'var(--text-2)' }}>No compliance items for this filter.</td></tr>
            ) : items.map(item => (
              <tr key={item.id}>
                <td style={{ fontWeight: '600' }}>{item.title}</td>
                <td>{COMPLIANCE_CATEGORY_LABELS[item.category] || item.category}</td>
                <td>{item.due_date?.slice(0, 10)}</td>
                <td style={{ color: 'var(--text-2)' }}>{COMPLIANCE_RECURRENCE_LABELS[item.recurrence] || item.recurrence}</td>
                <td>
                  <span className={`badge ${COMPLIANCE_STATUS_BADGE[item.computed_status] || 'badge-amber'}`}>
                    {COMPLIANCE_STATUS_LABEL[item.computed_status] || item.computed_status}
                    {item.computed_status !== 'filed' && item.days_until_due !== undefined
                      ? ` (${item.days_until_due}d)` : ''}
                  </span>
                </td>
                <td style={{ color: 'var(--text-2)' }}>{item.notes || '-'}</td>
                <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {item.computed_status !== 'filed' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={actioningId === item.id}
                      onClick={() => handleFile(item.id)}
                    >
                      Mark Filed
                    </button>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => openEditForm(item)}>Edit</button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={actioningId === item.id}
                    onClick={() => handleDelete(item.id, item.title)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ReportsHub = () => {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].key);
  const [activeReport,   setActiveReport]   = useState(null);
  const [showSettings,   setShowSettings]   = useState(false);

  const [period,      setPeriod]      = useState('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');
  const [loading,     setLoading]     = useState(false);
  const [revenue,     setRevenue]     = useState(null);
  const [pnl,         setPnl]         = useState(null);
  const [budget,      setBudget]      = useState(null);
  const [marginTrend, setMarginTrend] = useState(null);
  const [exceptions,  setExceptions]  = useState(null);
  const [auditTrail,  setAuditTrail]  = useState(null);
  const [cashRecon,   setCashRecon]   = useState(null);
  const [loginAnomalies, setLoginAnomalies] = useState(null);
  const [permissionChanges, setPermissionChanges] = useState(null);
  const [cashierPerformance, setCashierPerformance] = useState(null);
  const [trueMargin, setTrueMargin] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);
  const [cashRunway, setCashRunway] = useState(null);
  const [reorderPoint, setReorderPoint] = useState(null);
  const [supplierScorecard, setSupplierScorecard] = useState(null);
  const [customerAnalytics, setCustomerAnalytics] = useState(null);
  const [demandForecast, setDemandForecast] = useState(null);
  const [newProductScorecard, setNewProductScorecard] = useState(null);
  const [productViability, setProductViability] = useState(null);
  const [viabilityForm, setViabilityForm] = useState({ category: '', cost_price: '', selling_price: '', quantity: '', lead_time_days: '' });
  const [viabilityLoading, setViabilityLoading] = useState(false);
  const [managerPerformance, setManagerPerformance] = useState(null);
  const [orderJourney, setOrderJourney] = useState(null);
  const [orderJourneySearch, setOrderJourneySearch] = useState('');
  const [orderJourneyLoading, setOrderJourneyLoading] = useState(false);
  const [vatEstimate, setVatEstimate] = useState(null);
  const [unitEconomics, setUnitEconomics] = useState(null);
  const [monthsCount, setMonthsCount] = useState('6');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [products,    setProducts]    = useState(null);
  const [riders,      setRiders]      = useState(null);
  const [restocked,   setRestocked]   = useState(new Set());
  const [dailySalesRegister, setDailySalesRegister] = useState(null);
  const [selectedSalesDate, setSelectedSalesDate] = useState(new Date().toISOString().slice(0, 10));
  const [quarterYear, setQuarterYear] = useState(new Date().getFullYear());
  const [quarterNum,  setQuarterNum]  = useState(Math.floor(new Date().getMonth() / 3) + 1);

  const buildParams = useCallback(() => {
    if (period === 'today') {
      const today = new Date().toISOString().slice(0, 10);
      return { start_date: today, end_date: today };
    }
    if (period === 'quarterly') {
      const startMonth = (quarterNum - 1) * 3; // 0-indexed month the quarter starts in
      const start = new Date(quarterYear, startMonth, 1);
      const end = new Date(quarterYear, startMonth + 3, 0); // day 0 of next month = last day of quarter
      return { start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) };
    }
    if (period === 'custom' && customStart && customEnd) {
      return { start_date: customStart, end_date: customEnd };
    }
    return { period };
  }, [period, customStart, customEnd, quarterYear, quarterNum]);

  const fetchReport = useCallback(async (reportKey) => {
    if (reportKey === 'compliance-calendar') {
      // Self-contained tool — it fetches and manages its own data via its
      // own useEffect, so there's nothing for the hub to load here.
      return;
    }
    if (reportKey === 'order-journey') {
      // Search-triggered, like product-viability — nothing to load until
      // the user actually enters an order number and searches.
      return;
    }
    if (reportKey === 'product-viability') {
      setLoading(true);
      try {
        setProductViability((await reportsAPI.getProductViability()).data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (reportKey === 'budget') {
      setLoading(true);
      try {
        setBudget((await reportsAPI.getBudget({ month: selectedMonth })).data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (reportKey === 'daily-sales-register') {
      setLoading(true);
      try {
        setDailySalesRegister((await reportsAPI.getDailySalesRegister({ date: selectedSalesDate })).data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (reportKey === 'margin-trend') {
      setLoading(true);
      try {
        setMarginTrend((await reportsAPI.getMarginTrend({ months: monthsCount })).data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (period === 'custom' && (!customStart || !customEnd)) return;
    setLoading(true);
    try {
      const params = buildParams();
      if (reportKey === 'revenue') setRevenue((await reportsAPI.getRevenue(params)).data);
      if (reportKey === 'pnl') setPnl((await reportsAPI.getPnL(params)).data);
      if (reportKey === 'products') setProducts((await reportsAPI.getProducts(params)).data);
      if (reportKey === 'riders') setRiders((await reportsAPI.getRiders(params)).data);
      if (reportKey === 'exceptions') setExceptions((await reportsAPI.getExceptions(params)).data);
      if (reportKey === 'audit-trail') setAuditTrail((await reportsAPI.getAuditTrail(params)).data);
      if (reportKey === 'cash-reconciliation') setCashRecon((await reportsAPI.getCashReconciliation(params)).data);
      if (reportKey === 'login-anomalies') setLoginAnomalies((await reportsAPI.getLoginAnomalies(params)).data);
      if (reportKey === 'permission-changes') setPermissionChanges((await reportsAPI.getPermissionChanges(params)).data);
      if (reportKey === 'cashier-performance') setCashierPerformance((await reportsAPI.getCashierPerformance(params)).data);
      if (reportKey === 'true-margin') setTrueMargin((await reportsAPI.getTrueMargin(params)).data);
      if (reportKey === 'cash-flow') setCashFlow((await reportsAPI.getCashFlow(params)).data);
      if (reportKey === 'cash-runway') setCashRunway((await reportsAPI.getCashRunway(params)).data);
      if (reportKey === 'reorder-point') setReorderPoint((await reportsAPI.getReorderPoint(params)).data);
      if (reportKey === 'supplier-scorecard') setSupplierScorecard((await reportsAPI.getSupplierScorecard(params)).data);
      if (reportKey === 'customer-analytics') setCustomerAnalytics((await reportsAPI.getCustomerAnalytics(params)).data);
      if (reportKey === 'demand-forecast') setDemandForecast((await reportsAPI.getDemandForecast(params)).data);
      if (reportKey === 'new-product-scorecard') setNewProductScorecard((await reportsAPI.getNewProductScorecard()).data);
      if (reportKey === 'manager-performance') setManagerPerformance((await reportsAPI.getManagerPerformance(params)).data);
      if (reportKey === 'vat-estimate') setVatEstimate((await reportsAPI.getVatEstimate(params)).data);
      if (reportKey === 'unit-economics') setUnitEconomics((await reportsAPI.getUnitEconomics(params)).data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd, buildParams, selectedMonth, monthsCount, selectedSalesDate]);

  useEffect(() => {
    if (activeReport) fetchReport(activeReport);
  }, [activeReport, fetchReport]);

  const handleCalculateViability = async () => {
    if (!viabilityForm.category || viabilityForm.cost_price === '' || viabilityForm.selling_price === '' || viabilityForm.quantity === '') return;
    setViabilityLoading(true);
    try {
      const params = {
        category: viabilityForm.category,
        cost_price: viabilityForm.cost_price,
        selling_price: viabilityForm.selling_price,
        quantity: viabilityForm.quantity,
      };
      if (viabilityForm.lead_time_days !== '') params.lead_time_days = viabilityForm.lead_time_days;
      setProductViability((await reportsAPI.getProductViability(params)).data);
    } catch (err) {
      console.error(err);
    } finally {
      setViabilityLoading(false);
    }
  };

  const handleSearchOrderJourney = async () => {
    if (!orderJourneySearch.trim()) return;
    setOrderJourneyLoading(true);
    try {
      setOrderJourney((await reportsAPI.getOrderJourney({ order_number: orderJourneySearch.trim() })).data);
    } catch (err) {
      console.error(err);
    } finally {
      setOrderJourneyLoading(false);
    }
  };

  const handleRestock = async (productId) => {
    try {
      await productsAPI.updateStock(productId, { stock_quantity: 999, action: 'set' });
      setRestocked(s => new Set(s).add(productId));
    } catch {
      alert('Error updating stock');
    }
  };

  const [exporting, setExporting] = useState(null); // e.g. 'revenue-docx'

  const handleExport = async (reportKey, format) => {
    setExporting(`${reportKey}-${format}`);
    try {
      const exportParams = reportKey === 'budget' ? { month: selectedMonth }
        : reportKey === 'margin-trend' ? { months: monthsCount }
        : reportKey === 'product-viability' ? { ...viabilityForm }
        : reportKey === 'daily-sales-register' ? { date: selectedSalesDate }
        : buildParams();
      const params = new URLSearchParams({ ...exportParams, format }).toString();
      const res = await API.get(`/reports/${reportKey}/export?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportKey}-report.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      // err.response.data is a Blob (since responseType: 'blob'), even for
      // JSON error bodies — read it as text so the real backend message shows.
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          alert(parsed.message || 'Error generating export');
        } catch {
          alert('Error generating export');
        }
      } else {
        alert('Error generating export');
      }
    } finally {
      setExporting(null);
    }
  };

  const currentCategory = CATEGORIES.find(c => c.key === activeCategory);
  const periodLabel = period === 'custom' ? `${customStart} -> ${customEnd}`
    : period === 'today' ? 'Today'
    : period === 'quarterly' ? `Q${quarterNum} ${quarterYear}`
    : `Last ${period} days`;

  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

      <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div className="page-header" style={{ marginBottom: '8px' }}>
          <div>
            <h1 className="page-title">Reports Hub</h1>
          </div>
        </div>
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => { setActiveCategory(cat.key); setActiveReport(null); setShowSettings(false); }}
            className={`tab-btn${activeCategory === cat.key && !showSettings ? ' active' : ''}`}
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
        <button
          onClick={() => setShowSettings(true)}
          className={`tab-btn${showSettings ? ' active' : ''}`}
          style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', marginTop: '12px' }}
        >
          <span>{'\u2699'}</span><span>Report Settings</span>
        </button>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {showSettings ? (
          <SettingsPanel onClose={() => setShowSettings(false)} />
        ) : activeReport ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveReport(null)}>Back</button>

              {activeReport !== 'compliance-calendar' && activeReport !== 'order-journey' && (activeReport !== 'product-viability' || productViability?.ready) && (
                <ExportButtons reportKey={activeReport} exporting={exporting} onExport={handleExport} />
              )}

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {activeReport === 'budget' ? (
                  <input
                    type="month"
                    className="form-input"
                    style={{ width: 'auto' }}
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                  />
                ) : activeReport === 'margin-trend' ? (
                  <select className="form-input" style={{ width: 'auto' }} value={monthsCount} onChange={e => setMonthsCount(e.target.value)}>
                    <option value="3">Last 3 months</option>
                    <option value="6">Last 6 months</option>
                    <option value="12">Last 12 months</option>
                  </select>
                ) : activeReport === 'order-journey' ? (
                  <>
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: 'auto' }}
                      placeholder="Enter order number..."
                      value={orderJourneySearch}
                      onChange={e => setOrderJourneySearch(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSearchOrderJourney(); }}
                    />
                    <button className="btn btn-primary btn-sm" disabled={orderJourneyLoading || !orderJourneySearch.trim()} onClick={handleSearchOrderJourney}>
                      {orderJourneyLoading ? 'Searching...' : 'Search'}
                    </button>
                  </>
                ) : activeReport === 'daily-sales-register' ? (
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 'auto' }}
                    value={selectedSalesDate}
                    onChange={e => setSelectedSalesDate(e.target.value)}
                  />
                ) : activeReport === 'product-viability' || activeReport === 'compliance-calendar' ? null : (
                  <>
                    <select className="form-input" style={{ width: 'auto' }} value={period}
                      onChange={e => { setPeriod(e.target.value); setCustomStart(''); setCustomEnd(''); }}>
                      <option value="today">Today</option>
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 90 days</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="custom">Custom range</option>
                    </select>
                    {period === 'quarterly' && (
                      <>
                        <select className="form-input" style={{ width: 'auto' }} value={quarterYear} onChange={e => setQuarterYear(parseInt(e.target.value, 10))}>
                          {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                        <select className="form-input" style={{ width: 'auto' }} value={quarterNum} onChange={e => setQuarterNum(parseInt(e.target.value, 10))}>
                          <option value={1}>Q1 (Jan-Mar)</option>
                          <option value={2}>Q2 (Apr-Jun)</option>
                          <option value={3}>Q3 (Jul-Sep)</option>
                          <option value={4}>Q4 (Oct-Dec)</option>
                        </select>
                      </>
                    )}
                    {period === 'custom' && (
                      <>
                        <input type="date" className="form-input" style={{ width: 'auto' }} value={customStart} onChange={e => setCustomStart(e.target.value)} />
                        <span style={{ color: 'var(--text-3)' }}>-&gt;</span>
                        <input type="date" className="form-input" style={{ width: 'auto' }} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {loading ? (
              <div className="loading"><div className="loading-spinner" /><span className="loading-text">Loading report...</span></div>
            ) : (
              <>
                {activeReport === 'revenue' && revenue && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4B0}'}</span>
                        <p className="stat-label">Total Revenue</p>
                        <p className="stat-value" style={{ color: 'var(--accent, #22c55e)' }}>
                          GHS {parseFloat(revenue.summary?.total_revenue || 0).toFixed(2)}
                        </p>
                        <p className="stat-sub">{periodLabel}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4E6}'}</span>
                        <p className="stat-label">Total Orders</p>
                        <p className="stat-value" style={{ color: '#3b82f6' }}>{revenue.summary?.total_orders || 0}</p>
                        <p className="stat-sub">{revenue.summary?.delivered || 0} delivered</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4C8}'}</span>
                        <p className="stat-label">Avg Order Value</p>
                        <p className="stat-value" style={{ color: '#8b5cf6' }}>
                          GHS {parseFloat(revenue.summary?.avg_order_value || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u274C'}</span>
                        <p className="stat-label">Failed Orders</p>
                        <p className="stat-value" style={{ color: '#ef4444' }}>{revenue.summary?.failed || 0}</p>
                        <p className="stat-sub">{revenue.summary?.returned || 0} returned</p>
                      </div>
                    </div>

                    {revenue.daily?.length > 0 && (
                      <div className="card">
                        <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Revenue Trend</h3>
                        <BarChart data={[...revenue.daily].reverse()} />
                      </div>
                    )}

                    {revenue.payment_breakdown?.length > 0 && (
                      <div className="card">
                        <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Payment Methods</h3>
                        <PieChart data={revenue.payment_breakdown.map(p => ({ label: p.payment_method, value: parseFloat(p.total || 0) }))} />
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '16px' }}>
                          {revenue.payment_breakdown.map(p => (
                            <div key={p.payment_method} style={{ minWidth: '140px' }}>
                              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)', textTransform: 'capitalize' }}>{p.payment_method}</p>
                              <p style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>GHS {parseFloat(p.total || 0).toFixed(2)}</p>
                              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-3)' }}>{p.count} orders</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeReport === 'pnl' && pnl && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {!pnl.setting_configured && (
                      <div className="card" style={{ borderLeft: '4px solid #ef4444', background: '#fef2f2' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#991b1b', fontWeight: '600' }}>
                          "Does cost_price include landed cost?" is not set in Report Settings. Import costs may be double-counted or missing until you set it.
                        </p>
                      </div>
                    )}
                    {pnl.products_missing_cost > 0 && (
                      <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#92400e', fontWeight: '600' }}>
                          {pnl.products_missing_cost} product(s) sold in this period have no cost_price set — COGS is understated for those items.
                        </p>
                      </div>
                    )}

                    <div className="stats-grid">
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4B0}'}</span>
                        <p className="stat-label">Revenue</p>
                        <p className="stat-value" style={{ color: '#3b82f6' }}>GHS {pnl.revenue.toFixed(2)}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4E6}'}</span>
                        <p className="stat-label">COGS</p>
                        <p className="stat-value" style={{ color: '#ef4444' }}>GHS {pnl.cogs.toFixed(2)}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4C8}'}</span>
                        <p className="stat-label">Gross Profit</p>
                        <p className="stat-value" style={{ color: 'var(--accent, #22c55e)' }}>GHS {pnl.gross_profit.toFixed(2)}</p>
                        <p className="stat-sub">{pnl.gross_margin_percent.toFixed(1)}% margin</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F3C6}'}</span>
                        <p className="stat-label">Net Profit</p>
                        <p className="stat-value" style={{ color: pnl.net_profit >= 0 ? 'var(--accent, #22c55e)' : '#ef4444' }}>
                          GHS {pnl.net_profit.toFixed(2)}
                        </p>
                        <p className="stat-sub">{pnl.net_margin_percent.toFixed(1)}% margin</p>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Operating Expenses by Category</h3>
                      {!pnl.expenses_by_category?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F4CB}'}</div>
                          <h3>No expenses in this period</h3>
                        </div>
                      ) : (
                        <>
                          <div style={{ marginBottom: '20px' }}>
                            <PieChart data={pnl.expenses_by_category.map(e => ({ label: e.category, value: parseFloat(e.total) }))} />
                          </div>
                          <div className="table-wrapper">
                          <table>
                            <thead><tr><th>Category</th><th>Amount</th><th>Count</th></tr></thead>
                            <tbody>
                              {pnl.expenses_by_category.map((e, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: '600', textTransform: 'capitalize' }}>{e.category}</td>
                                  <td style={{ fontWeight: '700', color: '#ef4444' }}>GHS {parseFloat(e.total).toFixed(2)}</td>
                                  <td style={{ color: 'var(--text-3)' }}>{e.count}</td>
                                </tr>
                              ))}
                              <tr>
                                <td style={{ fontWeight: '700' }}>Total Operating Expenses</td>
                                <td style={{ fontWeight: '700', color: '#ef4444' }}>GHS {pnl.total_operating_expenses.toFixed(2)}</td>
                                <td></td>
                              </tr>
                            </tbody>
                          </table>
                          </div>
                        </>
                      )}
                      {pnl.cost_price_includes_landed_cost && (
                        <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '12px' }}>
                          "Import" category is excluded above since cost_price already includes landed cost.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeReport === 'budget' && budget && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {budget.revenue_budget === null && (
                      <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#92400e', fontWeight: '600' }}>
                          No monthly_revenue_budget set in Report Settings — variance can't be calculated yet.
                        </p>
                      </div>
                    )}
                    {(budget.revenue_budget !== null || budget.expense_budget !== null) && (
                      <div className="card">
                        <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Target vs Actual</h3>
                        <GroupedBarChart groups={[
                          { label: 'Revenue', target: budget.revenue_budget, actual: budget.revenue },
                          { label: 'Expenses', target: budget.expense_budget, actual: budget.actual_expenses },
                        ]} />
                      </div>
                    )}
                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>{budget.month}</h3>
                      <div className="table-wrapper">
                        <table>
                          <thead><tr><th>Metric</th><th>Target</th><th>Actual</th><th>Variance</th></tr></thead>
                          <tbody>
                            <tr>
                              <td style={{ fontWeight: '600' }}>Revenue</td>
                              <td>{budget.revenue_budget !== null ? `GHS ${budget.revenue_budget.toFixed(2)}` : 'Not set'}</td>
                              <td style={{ fontWeight: '700' }}>GHS {budget.revenue.toFixed(2)}</td>
                              <td style={{ color: budget.revenue_variance > 0 ? 'var(--accent, #22c55e)' : budget.revenue_variance < 0 ? '#ef4444' : 'inherit' }}>
                                {budget.revenue_variance !== null ? `${budget.revenue_variance >= 0 ? '+' : ''}GHS ${budget.revenue_variance.toFixed(2)} (${budget.revenue_variance_percent.toFixed(1)}%)` : '-'}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ fontWeight: '600' }}>Operating Expenses</td>
                              <td>{budget.expense_budget !== null ? `GHS ${budget.expense_budget.toFixed(2)}` : 'Not set'}</td>
                              <td style={{ fontWeight: '700' }}>GHS {budget.actual_expenses.toFixed(2)}</td>
                              <td style={{ color: budget.expense_variance > 0 ? '#ef4444' : budget.expense_variance < 0 ? 'var(--accent, #22c55e)' : 'inherit' }}>
                                {budget.expense_variance !== null ? `${budget.expense_variance >= 0 ? '+' : ''}GHS ${budget.expense_variance.toFixed(2)} (${budget.expense_variance_percent.toFixed(1)}%)` : '-'}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ fontWeight: '600' }}>Gross Margin %</td>
                              <td>{budget.target_gross_margin_percent !== null ? `${budget.target_gross_margin_percent.toFixed(1)}%` : 'Not set'}</td>
                              <td style={{ fontWeight: '700' }}>{budget.gross_margin_percent.toFixed(1)}%</td>
                              <td>-</td>
                            </tr>
                            <tr>
                              <td style={{ fontWeight: '600' }}>Net Margin %</td>
                              <td>{budget.target_net_margin_percent !== null ? `${budget.target_net_margin_percent.toFixed(1)}%` : 'Not set'}</td>
                              <td style={{ fontWeight: '700' }}>{budget.net_margin_percent.toFixed(1)}%</td>
                              <td>-</td>
                            </tr>
                            <tr>
                              <td style={{ fontWeight: '700' }}>Net Profit</td>
                              <td>-</td>
                              <td style={{ fontWeight: '700', color: budget.net_profit >= 0 ? 'var(--accent, #22c55e)' : '#ef4444' }}>GHS {budget.net_profit.toFixed(2)}</td>
                              <td>-</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {activeReport === 'margin-trend' && marginTrend && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Margin Trend</h3>
                      <MarginTrendChart months={marginTrend.months} />
                    </div>
                    <div className="card">
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr><th>Month</th><th>Revenue</th><th>Gross Profit</th><th>Gross Margin %</th><th>Net Profit</th><th>Net Margin %</th></tr>
                          </thead>
                          <tbody>
                            {marginTrend.months.map((m, i) => (
                              <tr key={i}>
                                <td style={{ fontWeight: '600' }}>{m.month}</td>
                                <td>GHS {m.revenue.toFixed(2)}</td>
                                <td>GHS {m.gross_profit.toFixed(2)}</td>
                                <td>
                                  <span className={`badge ${m.gross_margin_percent >= 30 ? 'badge-green' : m.gross_margin_percent >= 15 ? 'badge-amber' : 'badge-red'}`}>
                                    {m.gross_margin_percent.toFixed(1)}%
                                  </span>
                                </td>
                                <td style={{ color: m.net_profit >= 0 ? 'var(--accent, #22c55e)' : '#ef4444', fontWeight: '600' }}>
                                  GHS {m.net_profit.toFixed(2)}
                                </td>
                                <td>
                                  <span className={`badge ${m.net_margin_percent >= 15 ? 'badge-green' : m.net_margin_percent >= 5 ? 'badge-amber' : 'badge-red'}`}>
                                    {m.net_margin_percent.toFixed(1)}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {activeReport === 'products' && products && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Top Selling Products</h3>
                      {!products.top_products?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F4E6}'}</div>
                          <h3>No sales data yet</h3>
                          <p>Sales will appear here once orders are delivered</p>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
                            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                              <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '0 0 8px', fontWeight: '600' }}>Revenue by Product</p>
                              <SimpleBarChart
                                data={products.top_products.map(p => ({ name: p.name, revenue: parseFloat(p.total_revenue || 0) }))}
                                valueKey="revenue" labelKey="name" multiColor
                              />
                            </div>
                            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                              <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '0 0 8px', fontWeight: '600' }}>Revenue Share</p>
                              <PieChart data={products.top_products.map(p => ({ label: p.name, value: parseFloat(p.total_revenue || 0) }))} />
                            </div>
                          </div>
                          <div className="table-wrapper">
                          <table>
                            <thead>
                              <tr><th>Product</th><th>Category</th><th>Units Sold</th><th>Revenue</th><th>Current Stock</th></tr>
                            </thead>
                            <tbody>
                              {products.top_products.map((p, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: '600' }}>{p.name}</td>
                                  <td style={{ color: 'var(--text-2)' }}>{p.category || '-'}</td>
                                  <td style={{ fontWeight: '600' }}>{p.total_sold}</td>
                                  <td style={{ fontWeight: '700', color: 'var(--accent, #22c55e)' }}>
                                    GHS {parseFloat(p.total_revenue || 0).toFixed(2)}
                                  </td>
                                  <td>
                                    <span className={`badge ${p.current_stock === 0 ? 'badge-red' : p.current_stock <= 5 ? 'badge-amber' : 'badge-green'}`}>
                                      {p.current_stock}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </div>
                        </>
                      )}
                    </div>

                    {products.low_stock?.length > 0 && (
                      <div className="card">
                        <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px' }}>Low Stock Alert</h3>
                        <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: '0 0 16px' }}>
                          {products.low_stock.length} products need restocking
                        </p>
                        <div className="table-wrapper">
                          <table>
                            <thead>
                              <tr><th>Product</th><th>Category</th><th>Current Stock</th><th>Threshold</th><th>Action</th></tr>
                            </thead>
                            <tbody>
                              {products.low_stock.map((p, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: '600' }}>{p.name}</td>
                                  <td style={{ color: 'var(--text-2)' }}>{p.category || '-'}</td>
                                  <td>
                                    <span className={`badge ${p.stock_quantity === 0 ? 'badge-red' : 'badge-amber'}`}>{p.stock_quantity}</span>
                                  </td>
                                  <td style={{ color: 'var(--text-3)' }}>{p.low_stock_threshold}</td>
                                  <td>
                                    {restocked.has(p.id) ? (
                                      <span className="badge badge-green">Restocked</span>
                                    ) : (
                                      <button className="btn btn-success btn-sm" onClick={() => handleRestock(p.id)}>Mark Restocked</button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeReport === 'supplier-scorecard' && supplierScorecard && (
                  <div className="card">
                    <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px' }}>Supplier Scorecard</h3>
                    <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: '0 0 16px' }}>
                      Score averages only the dimensions with real data for that supplier — no history in a dimension means it's simply not counted, not penalized.
                    </p>
                    {!supplierScorecard.suppliers?.length ? (
                      <div className="empty-state">
                        <div className="empty-icon">{'\u{1F6A2}'}</div>
                        <h3>No active suppliers yet</h3>
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Supplier</th><th>Country</th><th>Shipments</th>
                              <th>On-Time</th><th>Cost Variance</th><th>PO Cancel %</th><th>Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {supplierScorecard.suppliers.map((s, i) => (
                              <tr key={i}>
                                <td style={{ fontWeight: '600' }}>{s.name}</td>
                                <td style={{ color: 'var(--text-2)' }}>{s.country || '-'}</td>
                                <td>{s.total_shipments}</td>
                                <td>
                                  {s.on_time_rate !== null
                                    ? <span className={`badge ${s.on_time_rate >= 80 ? 'badge-green' : s.on_time_rate >= 50 ? 'badge-amber' : 'badge-red'}`}>{s.on_time_rate.toFixed(0)}%</span>
                                    : <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>No data</span>}
                                </td>
                                <td>
                                  {s.cost_variance_pct !== null
                                    ? <span style={{ color: Math.abs(s.cost_variance_pct) <= 10 ? 'var(--accent, #22c55e)' : '#ef4444', fontWeight: '600' }}>
                                        {s.cost_variance_pct >= 0 ? '+' : ''}{s.cost_variance_pct.toFixed(1)}%
                                      </span>
                                    : <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>No data</span>}
                                </td>
                                <td>
                                  {s.po_cancellation_rate !== null
                                    ? s.po_cancellation_rate.toFixed(0) + '%'
                                    : <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>No data</span>}
                                </td>
                                <td>
                                  {s.overall_score !== null
                                    ? <span className={`badge ${s.overall_score >= 80 ? 'badge-green' : s.overall_score >= 50 ? 'badge-amber' : 'badge-red'}`}>{s.overall_score.toFixed(0)}</span>
                                    : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeReport === 'riders' && riders && (
                  <div className="card">
                    <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Rider Performance</h3>
                    {!riders.riders?.length ? (
                      <div className="empty-state">
                        <div className="empty-icon">{'\u{1F3CD}'}</div>
                        <h3>No riders yet</h3>
                        <p>Add riders to see their performance</p>
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Rider</th><th>Deliveries</th><th>Successful</th><th>Failed</th>
                              <th>Success Rate</th><th>Cash Collected</th><th>Disputes</th><th>Resolved</th>
                            </tr>
                          </thead>
                          <tbody>
                            {riders.riders.map((r, i) => {
                              const rate = r.total_deliveries > 0 ? ((r.successful / r.total_deliveries) * 100).toFixed(0) : 0;
                              return (
                                <tr key={i}>
                                  <td>
                                    <div style={{ fontWeight: '600' }}>{r.rider_name}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{r.phone}</div>
                                  </td>
                                  <td style={{ fontWeight: '600' }}>{r.total_deliveries}</td>
                                  <td style={{ color: 'var(--accent, #22c55e)', fontWeight: '600' }}>{r.successful}</td>
                                  <td style={{ color: '#ef4444', fontWeight: '600' }}>{r.failed}</td>
                                  <td>
                                    <span className={`badge ${rate >= 80 ? 'badge-green' : rate >= 60 ? 'badge-amber' : 'badge-red'}`}>{rate}%</span>
                                  </td>
                                  <td style={{ fontWeight: '700', color: 'var(--accent, #22c55e)' }}>
                                    GHS {parseFloat(r.total_cash_collected || 0).toFixed(2)}
                                  </td>
                                  <td style={{ color: r.disputed_collections > 0 ? '#ef4444' : 'var(--text-3)', fontWeight: r.disputed_collections > 0 ? '700' : '400' }}>
                                    {r.disputed_collections}
                                  </td>
                                  <td style={{ color: '#1d4ed8', fontWeight: r.resolved_collections > 0 ? '700' : '400' }}>
                                    {r.resolved_collections || 0}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeReport === 'exceptions' && exceptions && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <span className="stat-icon">{'\u26A0'}</span>
                        <p className="stat-label">Total Exceptions</p>
                        <p className="stat-value" style={{ color: '#f59e0b' }}>{exceptions.total_exceptions}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F534}'}</span>
                        <p className="stat-label">Still Disputed</p>
                        <p className="stat-value" style={{ color: '#ef4444' }}>{exceptions.still_disputed_count}</p>
                        <p className="stat-sub">GHS {exceptions.total_disputed_amount_outstanding.toFixed(2)} outstanding</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u2705'}</span>
                        <p className="stat-label">Resolved</p>
                        <p className="stat-value" style={{ color: 'var(--accent, #22c55e)' }}>{exceptions.resolved_count}</p>
                      </div>
                    </div>

                    {exceptions.total_exceptions > 0 && (
                      <div className="card">
                        <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Disputed vs Resolved</h3>
                        <PieChart data={[
                          { label: 'still disputed', value: exceptions.still_disputed_count },
                          { label: 'resolved', value: exceptions.resolved_count },
                        ].filter(d => d.value > 0)} />
                      </div>
                    )}

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>All Exceptions</h3>
                      {!exceptions.exceptions?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u2705'}</div>
                          <h3>No exceptions in this period</h3>
                          <p>No disputed or resolved cash logs — clean record.</p>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table>
                            <thead>
                              <tr><th>Date</th><th>Rider</th><th>Order</th><th>Amount</th><th>Status</th><th>Notes</th></tr>
                            </thead>
                            <tbody>
                              {exceptions.exceptions.map((e, i) => (
                                <tr key={i}>
                                  <td style={{ color: 'var(--text-3)' }}>{new Date(e.created_at).toLocaleDateString('en-GB')}</td>
                                  <td style={{ fontWeight: '600' }}>{e.rider_name || '-'}</td>
                                  <td>{e.order_number || '-'}</td>
                                  <td style={{ fontWeight: '700' }}>GHS {parseFloat(e.amount || 0).toFixed(2)}</td>
                                  <td>
                                    <span className={`badge ${e.status === 'disputed' ? 'badge-red' : 'badge-green'}`}>{e.status}</span>
                                  </td>
                                  <td style={{ fontSize: '12px', color: 'var(--text-2)', maxWidth: '260px' }}>{e.notes || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeReport === 'audit-trail' && auditTrail && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4DC}'}</span>
                        <p className="stat-label">Total Actions</p>
                        <p className="stat-value" style={{ color: '#3b82f6' }}>{auditTrail.total_actions}</p>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Actions by Type</h3>
                      {!auditTrail.by_action?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F4DC}'}</div>
                          <h3>No logged actions in this period</h3>
                        </div>
                      ) : (
                        <PieChart data={auditTrail.by_action.map(a => ({ label: a.action, value: parseInt(a.count) }))} />
                      )}
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Top Actors</h3>
                      {!auditTrail.by_user?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F464}'}</div>
                          <h3>No attributed actions in this period</h3>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table>
                            <thead><tr><th>Staff Member</th><th>Role</th><th>Actions</th></tr></thead>
                            <tbody>
                              {auditTrail.by_user.map((u, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: '600' }}>{u.user_name || 'Unknown'}</td>
                                  <td style={{ color: 'var(--text-2)', textTransform: 'capitalize' }}>{u.user_role || '-'}</td>
                                  <td style={{ fontWeight: '700' }}>{u.count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px' }}>Detail Log</h3>
                      {auditTrail.logs_capped && (
                        <p style={{ color: 'var(--text-3)', fontSize: '12px', margin: '0 0 16px' }}>
                          Showing the most recent 500 of {auditTrail.total_actions} actions. Export Word/Excel to see all in the export (capped separately there too).
                        </p>
                      )}
                      {!auditTrail.logs?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F4DC}'}</div>
                          <h3>No logged actions in this period</h3>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table>
                            <thead><tr><th>Date</th><th>Staff</th><th>Action</th><th>Entity</th><th>Description</th></tr></thead>
                            <tbody>
                              {auditTrail.logs.map((l, i) => (
                                <tr key={i}>
                                  <td style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString('en-GB')}</td>
                                  <td style={{ fontWeight: '600' }}>{l.user_name || 'Unknown'}</td>
                                  <td><span className="badge badge-green">{l.action}</span></td>
                                  <td style={{ color: 'var(--text-2)' }}>{l.entity || '-'}</td>
                                  <td style={{ fontSize: '12px', color: 'var(--text-2)' }}>{l.description || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeReport === 'cash-reconciliation' && cashRecon && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4B5}'}</span>
                        <p className="stat-label">Total Expected</p>
                        <p className="stat-value" style={{ color: '#3b82f6' }}>GHS {cashRecon.total_expected.toFixed(2)}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u2705'}</span>
                        <p className="stat-label">Total Actual</p>
                        <p className="stat-value" style={{ color: 'var(--accent, #22c55e)' }}>GHS {cashRecon.total_actual.toFixed(2)}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u26A0'}</span>
                        <p className="stat-label">Total Variance</p>
                        <p className="stat-value" style={{ color: cashRecon.total_variance > 0 ? '#ef4444' : 'var(--accent, #22c55e)' }}>
                          GHS {cashRecon.total_variance.toFixed(2)}
                        </p>
                        <p className="stat-sub">{cashRecon.riders_with_shortage} rider(s) short</p>
                      </div>
                    </div>

                    {cashRecon.riders?.length > 0 && (
                      <div className="card">
                        <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Status Breakdown</h3>
                        <PieChart data={
                          ['shortage', 'surplus', 'balanced']
                            .map(status => ({ label: status, value: cashRecon.riders.filter(r => r.status === status).length }))
                            .filter(d => d.value > 0)
                        } />
                      </div>
                    )}

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>By Rider</h3>
                      {!cashRecon.riders?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F4B5}'}</div>
                          <h3>No cash activity in this period</h3>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table>
                            <thead><tr><th>Rider</th><th>Expected</th><th>Actual</th><th>Variance</th><th>Status</th></tr></thead>
                            <tbody>
                              {cashRecon.riders.map((r, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: '600' }}>{r.rider_name}</td>
                                  <td>GHS {r.expected_amount.toFixed(2)}</td>
                                  <td>GHS {r.actual_amount.toFixed(2)}</td>
                                  <td style={{ fontWeight: '700', color: r.status === 'shortage' ? '#ef4444' : r.status === 'surplus' ? '#3b82f6' : 'var(--text-3)' }}>
                                    GHS {r.variance.toFixed(2)}
                                  </td>
                                  <td>
                                    <span className={`badge ${r.status === 'shortage' ? 'badge-red' : r.status === 'surplus' ? 'badge-amber' : 'badge-green'}`}>
                                      {r.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeReport === 'login-anomalies' && loginAnomalies && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {!loginAnomalies.business_hours_configured && (
                      <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#92400e', fontWeight: '600' }}>
                          Business hours not set in Report Settings — off-hours login flagging is skipped. Repeated-failure anomalies below are still real.
                        </p>
                      </div>
                    )}
                    <div className="stats-grid">
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F6A8}'}</span>
                        <p className="stat-label">Total Anomalies</p>
                        <p className="stat-value" style={{ color: '#ef4444' }}>{loginAnomalies.total_anomalies}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F510}'}</span>
                        <p className="stat-label">Repeated Failures</p>
                        <p className="stat-value" style={{ color: '#f59e0b' }}>{loginAnomalies.repeated_failures.length}</p>
                      </div>
                      {loginAnomalies.business_hours_configured && (
                        <div className="stat-card">
                          <span className="stat-icon">{'\u{1F319}'}</span>
                          <p className="stat-label">Off-Hours Logins</p>
                          <p className="stat-value" style={{ color: '#8b5cf6' }}>{loginAnomalies.off_hours_logins.length}</p>
                        </div>
                      )}
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F575}'}</span>
                        <p className="stat-label">Suspicious IPs</p>
                        <p className="stat-value" style={{ color: '#dc2626' }}>{loginAnomalies.suspicious_ips?.length || 0}</p>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Repeated Failed Logins (3+ same day)</h3>
                      {!loginAnomalies.repeated_failures?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u2705'}</div>
                          <h3>No repeated failures in this period</h3>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table>
                            <thead><tr><th>User</th><th>Day</th><th>Failures</th><th>Distinct IPs</th><th>Last Attempt</th><th>Outcome</th><th>Attempts</th></tr></thead>
                            <tbody>
                              {loginAnomalies.repeated_failures.map((f, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: '600' }}>
                                    {f.user_name || f.email_attempted || 'unknown'}
                                    {f.user_role && <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'capitalize', fontWeight: '400' }}>{f.user_role}</div>}
                                  </td>
                                  <td>{f.day}</td>
                                  <td><span className="badge badge-red">{f.failure_count}</span></td>
                                  <td style={{ color: 'var(--text-3)' }}>
                                    {f.distinct_ip_count}{f.distinct_ip_count > 1 ? ' (multiple sources)' : ''}
                                  </td>
                                  <td style={{ color: 'var(--text-3)' }}>{new Date(f.last_attempt).toLocaleString('en-GB')}</td>
                                  <td>
                                    {f.succeeded_after_failures
                                      ? <span className="badge badge-red">Later succeeded {'\u26A0'}</span>
                                      : <span className="badge badge-amber">Still locked out</span>}
                                  </td>
                                  <td>
                                    <details>
                                      <summary style={{ cursor: 'pointer', color: 'var(--text-3)', fontSize: '12px' }}>View {f.attempts?.length || 0}</summary>
                                      <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        {(f.attempts || []).map((a, ai) => (
                                          <div key={ai} style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                                            {new Date(a.time).toLocaleTimeString('en-GB')} — {a.reason || 'unknown'} — {a.ip || 'no ip'}
                                          </div>
                                        ))}
                                      </div>
                                    </details>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Suspicious IPs (Same Source, Multiple Accounts)</h3>
                      <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-3)' }}>
                        One IP address failing to log into 3 or more different accounts — a credential-stuffing pattern, distinct from one person forgetting their own password.
                      </p>
                      {!loginAnomalies.suspicious_ips?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u2705'}</div>
                          <h3>No suspicious IP activity in this period</h3>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table>
                            <thead><tr><th>IP Address</th><th>Distinct Accounts</th><th>Total Attempts</th><th>First Attempt</th><th>Last Attempt</th><th>Accounts Targeted</th></tr></thead>
                            <tbody>
                              {loginAnomalies.suspicious_ips.map((ip, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: '600' }}>{ip.ip_address}</td>
                                  <td><span className="badge badge-red">{ip.distinct_emails}</span></td>
                                  <td>{ip.attempt_count}</td>
                                  <td style={{ color: 'var(--text-3)' }}>{new Date(ip.first_attempt).toLocaleString('en-GB')}</td>
                                  <td style={{ color: 'var(--text-3)' }}>{new Date(ip.last_attempt).toLocaleString('en-GB')}</td>
                                  <td>
                                    <details>
                                      <summary style={{ cursor: 'pointer', color: 'var(--text-3)', fontSize: '12px' }}>View {ip.emails_targeted?.length || 0}</summary>
                                      <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        {(ip.emails_targeted || []).map((email, ei) => (
                                          <div key={ei} style={{ fontSize: '11px', color: 'var(--text-3)' }}>{email}</div>
                                        ))}
                                      </div>
                                    </details>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {loginAnomalies.business_hours_configured && (
                      <div className="card">
                        <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Off-Hours Logins</h3>
                        {!loginAnomalies.off_hours_logins?.length ? (
                          <div className="empty-state">
                            <div className="empty-icon">{'\u2705'}</div>
                            <h3>No off-hours logins in this period</h3>
                          </div>
                        ) : (
                          <div className="table-wrapper">
                            <table>
                              <thead><tr><th>User</th><th>Role</th><th>Time</th><th>IP</th></tr></thead>
                              <tbody>
                                {loginAnomalies.off_hours_logins.map((l, i) => (
                                  <tr key={i}>
                                    <td style={{ fontWeight: '600' }}>{l.user_name || l.email_attempted || 'unknown'}</td>
                                    <td style={{ textTransform: 'capitalize', color: 'var(--text-2)' }}>{l.user_role || '-'}</td>
                                    <td>{new Date(l.created_at).toLocaleString('en-GB')}</td>
                                    <td style={{ color: 'var(--text-3)' }}>{l.ip_address || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeReport === 'permission-changes' && permissionChanges && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F510}'}</span>
                        <p className="stat-label">Total Changes</p>
                        <p className="stat-value" style={{ color: '#3b82f6' }}>{permissionChanges.total_changes}</p>
                      </div>
                    </div>
                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>All Permission Changes</h3>
                      {!permissionChanges.changes?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F510}'}</div>
                          <h3>No permission changes in this period</h3>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table>
                            <thead><tr><th>Date</th><th>Action</th><th>Changed By</th><th>Role</th><th>Description</th></tr></thead>
                            <tbody>
                              {permissionChanges.changes.map((c, i) => (
                                <tr key={i}>
                                  <td style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{new Date(c.created_at).toLocaleString('en-GB')}</td>
                                  <td><span className="badge badge-amber">{c.action}</span></td>
                                  <td style={{ fontWeight: '600' }}>{c.actor_name || 'Unknown'}</td>
                                  <td style={{ textTransform: 'capitalize', color: 'var(--text-2)' }}>{c.actor_role || '-'}</td>
                                  <td style={{ fontSize: '12px', color: 'var(--text-2)' }}>{c.description || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeReport === 'cashier-performance' && cashierPerformance && (
                  <div className="card">
                    <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Cashier / Verifier Performance</h3>
                    {!cashierPerformance.staff?.length ? (
                      <div className="empty-state">
                        <div className="empty-icon">{'\u{1F9FE}'}</div>
                        <h3>No verifications in this period</h3>
                      </div>
                    ) : (
                      <>
                        <div style={{ marginBottom: '20px' }}>
                          <SimpleBarChart
                            data={cashierPerformance.staff.map(s => ({ name: s.staff_name, amount: s.total_amount_verified }))}
                            valueKey="amount" labelKey="name" multiColor
                          />
                        </div>
                        <div className="table-wrapper">
                          <table>
                            <thead><tr><th>Staff Member</th><th>Role</th><th>Verified Count</th><th>Total Amount</th></tr></thead>
                            <tbody>
                              {cashierPerformance.staff.map((s, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: '600' }}>{s.staff_name}</td>
                                  <td style={{ textTransform: 'capitalize', color: 'var(--text-2)' }}>{s.role}</td>
                                  <td style={{ fontWeight: '700' }}>{s.total_verified}</td>
                                  <td style={{ fontWeight: '700', color: 'var(--accent, #22c55e)' }}>GHS {s.total_amount_verified.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeReport === 'manager-performance' && managerPerformance && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="card" style={{ borderLeft: '4px solid #94a3b8', background: '#f8fafc' }}>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-2)' }}>
                        Based on cash dispute resolution activity — the one place manager-level resolution work is currently tracked. Not a complete measure of managerial performance; there's no supervisor role or dedicated escalation tracking in this system.
                      </p>
                    </div>
                    {managerPerformance.pending_disputes_count > 0 && (
                      <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#92400e', fontWeight: '600' }}>
                          {managerPerformance.pending_disputes_count} cash dispute(s) currently unresolved, system-wide.
                        </p>
                      </div>
                    )}
                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Dispute Resolution by Manager</h3>
                      {!managerPerformance.managers?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F3E2}'}</div>
                          <h3>No managers found</h3>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table>
                            <thead><tr><th>Manager</th><th>Disputes Resolved</th><th>Avg Resolution Time</th><th>Resolution Variance</th></tr></thead>
                            <tbody>
                              {managerPerformance.managers.map((m, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: '600' }}>{m.name}</td>
                                  <td>{m.disputes_resolved}</td>
                                  <td>{m.avg_resolution_hours !== null ? m.avg_resolution_hours.toFixed(1) + ' hrs' : <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>No data</span>}</td>
                                  <td>
                                    {m.has_activity
                                      ? <span style={{ color: m.resolution_variance >= 0 ? 'var(--accent, #22c55e)' : '#ef4444', fontWeight: '600' }}>GHS {m.resolution_variance.toFixed(2)}</span>
                                      : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeReport === 'true-margin' && trueMargin && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {trueMargin.products_missing_cost?.length > 0 && (
                      <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#92400e', fontWeight: '600' }}>
                          {trueMargin.products_missing_cost.length} product(s) sold with no cost_price set — shown separately below, excluded from margin totals rather than assumed free.
                        </p>
                      </div>
                    )}
                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>True Margin per Product</h3>
                      {!trueMargin.products?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F4B0}'}</div>
                          <h3>No priced sales in this period</h3>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table>
                            <thead><tr><th>Product</th><th>Category</th><th>Units Sold</th><th>Revenue</th><th>Cost</th><th>Margin</th><th>Margin %</th></tr></thead>
                            <tbody>
                              {trueMargin.products.map((p, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: '600' }}>{p.name}</td>
                                  <td style={{ color: 'var(--text-2)' }}>{p.category || '-'}</td>
                                  <td>{p.units_sold}</td>
                                  <td>GHS {p.revenue.toFixed(2)}</td>
                                  <td style={{ color: '#ef4444' }}>GHS {p.cost.toFixed(2)}</td>
                                  <td style={{ fontWeight: '700', color: p.margin >= 0 ? 'var(--accent, #22c55e)' : '#ef4444' }}>GHS {p.margin.toFixed(2)}</td>
                                  <td>
                                    <span className={`badge ${p.margin_percent >= 30 ? 'badge-green' : p.margin_percent >= 15 ? 'badge-amber' : 'badge-red'}`}>
                                      {p.margin_percent.toFixed(1)}%
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {trueMargin.products_missing_cost?.length > 0 && (
                      <div className="card">
                        <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Missing Cost Price</h3>
                        <div className="table-wrapper">
                          <table>
                            <thead><tr><th>Product</th><th>Category</th><th>Units Sold</th><th>Revenue</th></tr></thead>
                            <tbody>
                              {trueMargin.products_missing_cost.map((p, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: '600' }}>{p.name}</td>
                                  <td style={{ color: 'var(--text-2)' }}>{p.category || '-'}</td>
                                  <td>{p.units_sold}</td>
                                  <td>GHS {p.revenue.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeReport === 'reorder-point' && reorderPoint && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {!reorderPoint.lead_time_configured && (
                      <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#92400e', fontWeight: '600' }}>
                          avg_import_lead_time_days not set in Report Settings — reorder points below use safety stock only, with no lead-time buffer.
                        </p>
                      </div>
                    )}
                    <div className="stats-grid">
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F6A8}'}</span>
                        <p className="stat-label">Needs Reorder</p>
                        <p className="stat-value" style={{ color: reorderPoint.needs_reorder_count > 0 ? '#ef4444' : 'var(--accent, #22c55e)' }}>
                          {reorderPoint.needs_reorder_count}
                        </p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u2753'}</span>
                        <p className="stat-label">No Recent Sales Data</p>
                        <p className="stat-value">{reorderPoint.no_sales_data_count}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F69A}'}</span>
                        <p className="stat-label">Lead Time</p>
                        <p className="stat-value">{reorderPoint.lead_time_days} days</p>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>All Products</h3>
                      {!reorderPoint.products?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F4E6}'}</div>
                          <h3>No active products found</h3>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table>
                            <thead><tr><th>SKU</th><th>Product</th><th>Stock</th><th>Weeks of Supply</th><th>Reorder Point</th><th>Needs Reorder</th></tr></thead>
                            <tbody>
                              {reorderPoint.products.map((p, i) => (
                                <tr key={i}>
                                  <td style={{ color: 'var(--text-2)' }}>{p.sku || '-'}</td>
                                  <td style={{ fontWeight: '600' }}>{p.name}</td>
                                  <td>{p.stock_quantity}</td>
                                  <td>
                                    {p.weeks_of_supply !== null
                                      ? p.weeks_of_supply.toFixed(1) + 'w'
                                      : <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>No sales data</span>}
                                  </td>
                                  <td>{p.reorder_point}</td>
                                  <td>
                                    {p.needs_reorder
                                      ? <span className="badge badge-red">Reorder Now</span>
                                      : <span className="badge badge-green">OK</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeReport === 'demand-forecast' && demandForecast && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {period === 'custom' && (
                      <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#92400e', fontWeight: '600' }}>
                          Demand Forecast only supports the 30/60/90-day period options, not a custom date range — showing the default {demandForecast.period}-day window instead. Trend comparison needs two equal-length windows, which a custom range can't provide.
                        </p>
                      </div>
                    )}
                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px' }}>Trend Overview</h3>
                      <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: '0 0 16px' }}>
                        Last {demandForecast.period} days vs. the prior {demandForecast.period} days
                      </p>
                      <div className="stats-grid">
                        <div className="stat-card">
                          <span className="stat-icon">{'\u{1F4C8}'}</span>
                          <p className="stat-label">Growing</p>
                          <p className="stat-value" style={{ color: 'var(--accent, #22c55e)' }}>{demandForecast.trend_counts.growing}</p>
                        </div>
                        <div className="stat-card">
                          <span className="stat-icon">{'\u{1F4C9}'}</span>
                          <p className="stat-label">Declining</p>
                          <p className="stat-value" style={{ color: '#ef4444' }}>{demandForecast.trend_counts.declining}</p>
                        </div>
                        <div className="stat-card">
                          <span className="stat-icon">{'\u2796'}</span>
                          <p className="stat-label">Stable</p>
                          <p className="stat-value">{demandForecast.trend_counts.stable}</p>
                        </div>
                        <div className="stat-card">
                          <span className="stat-icon">{'\u2728'}</span>
                          <p className="stat-label">New Demand</p>
                          <p className="stat-value">{demandForecast.trend_counts.new_demand}</p>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px' }}>Forecast by Product</h3>
                      <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: '0 0 16px' }}>
                        Dampened trend projection — a planning signal, not a guarantee
                      </p>
                      {!demandForecast.products?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F52E}'}</div>
                          <h3>No active products found</h3>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table>
                            <thead>
                              <tr>
                                <th>SKU</th><th>Product</th><th>This Period</th><th>Prior Period</th>
                                <th>Trend</th><th>Forecast Next Period</th>
                              </tr>
                            </thead>
                            <tbody>
                              {demandForecast.products.map((p, i) => (
                                <tr key={i}>
                                  <td style={{ color: 'var(--text-2)' }}>{p.sku || '-'}</td>
                                  <td style={{ fontWeight: '600' }}>{p.name}</td>
                                  <td>{p.recent_units}</td>
                                  <td style={{ color: 'var(--text-3)' }}>{p.prior_units}</td>
                                  <td>
                                    {p.trend === 'growing' && <span className="badge badge-green">Growing{p.trend_pct !== null ? ' (+' + p.trend_pct.toFixed(0) + '%)' : ''}</span>}
                                    {p.trend === 'declining' && <span className="badge badge-red">Declining ({p.trend_pct.toFixed(0)}%)</span>}
                                    {p.trend === 'stable' && <span className="badge badge-amber">Stable</span>}
                                    {p.trend === 'new_demand' && <span className="badge badge-green">New Demand</span>}
                                    {p.trend === 'no_data' && <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>No data</span>}
                                  </td>
                                  <td style={{ fontWeight: '600' }}>{p.forecast_units_next_period}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeReport === 'new-product-scorecard' && newProductScorecard && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="card" style={{ borderLeft: '4px solid #94a3b8', background: '#f8fafc' }}>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-2)' }}>
                        Showing products launched in the last {newProductScorecard.new_product_days} days. This report tracks since-launch performance and doesn't use the period selector above.
                      </p>
                    </div>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <span className="stat-icon">{'\u2705'}</span>
                        <p className="stat-label">Performing</p>
                        <p className="stat-value" style={{ color: 'var(--accent, #22c55e)' }}>{newProductScorecard.status_counts.performing}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u26A0'}</span>
                        <p className="stat-label">Underperforming</p>
                        <p className="stat-value" style={{ color: '#f59e0b' }}>{newProductScorecard.status_counts.underperforming}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F6D1}'}</span>
                        <p className="stat-label">No Traction</p>
                        <p className="stat-value" style={{ color: '#ef4444' }}>{newProductScorecard.status_counts.no_traction}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u23F1'}</span>
                        <p className="stat-label">Too Early to Judge</p>
                        <p className="stat-value">{newProductScorecard.status_counts.too_early}</p>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px' }}>New Products</h3>
                      <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: '0 0 16px' }}>
                        Underperforming threshold: below {newProductScorecard.min_weekly_velocity} units/week
                      </p>
                      {!newProductScorecard.products?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F195}'}</div>
                          <h3>No new products in this window</h3>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table>
                            <thead>
                              <tr>
                                <th>SKU</th><th>Product</th><th>Days Since Launch</th>
                                <th>Units Sold</th><th>Revenue</th><th>Weekly Velocity</th><th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {newProductScorecard.products.map((p, i) => (
                                <tr key={i}>
                                  <td style={{ color: 'var(--text-2)' }}>{p.sku || '-'}</td>
                                  <td style={{ fontWeight: '600' }}>{p.name}</td>
                                  <td>{p.days_since_launch}</td>
                                  <td>{p.units_sold_since_launch}</td>
                                  <td>GHS {p.revenue_since_launch.toFixed(2)}</td>
                                  <td>{p.weekly_velocity.toFixed(1)}/wk</td>
                                  <td>
                                    {p.status === 'performing' && <span className="badge badge-green">Performing</span>}
                                    {p.status === 'underperforming' && <span className="badge badge-amber">Underperforming</span>}
                                    {p.status === 'no_traction' && <span className="badge badge-red">No Traction</span>}
                                    {p.status === 'too_early' && <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Too Early</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeReport === 'product-viability' && productViability && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Proposed Product</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Category</label>
                          <select
                            className="form-input"
                            value={viabilityForm.category}
                            onChange={e => setViabilityForm(f => ({ ...f, category: e.target.value }))}
                          >
                            <option value="">Select category</option>
                            {productViability.categories.map((c, i) => <option key={i} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Proposed Cost Price (GHS)</label>
                          <input
                            type="number" className="form-input" placeholder="0.00"
                            value={viabilityForm.cost_price}
                            onChange={e => setViabilityForm(f => ({ ...f, cost_price: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Proposed Selling Price (GHS)</label>
                          <input
                            type="number" className="form-input" placeholder="0.00"
                            value={viabilityForm.selling_price}
                            onChange={e => setViabilityForm(f => ({ ...f, selling_price: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Initial Order Quantity</label>
                          <input
                            type="number" className="form-input" placeholder="0"
                            value={viabilityForm.quantity}
                            onChange={e => setViabilityForm(f => ({ ...f, quantity: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Lead Time (days, optional)</label>
                          <input
                            type="number" className="form-input" placeholder="Uses Report Settings default"
                            value={viabilityForm.lead_time_days}
                            onChange={e => setViabilityForm(f => ({ ...f, lead_time_days: e.target.value }))}
                          />
                        </div>
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: '16px' }}
                        disabled={viabilityLoading || !viabilityForm.category || viabilityForm.cost_price === '' || viabilityForm.selling_price === '' || viabilityForm.quantity === ''}
                        onClick={handleCalculateViability}
                      >
                        {viabilityLoading ? 'Calculating...' : 'Calculate Viability'}
                      </button>
                    </div>

                    {productViability.ready && (
                      <>
                        <div className="stats-grid">
                          <div className="stat-card">
                            <span className="stat-icon">{'\u{1F4B0}'}</span>
                            <p className="stat-label">Margin per Unit</p>
                            <p className="stat-value" style={{ color: productViability.margin_per_unit > 0 ? 'var(--accent, #22c55e)' : '#ef4444' }}>
                              GHS {productViability.margin_per_unit.toFixed(2)}
                            </p>
                            <p className="stat-sub">{productViability.margin_percent !== null ? productViability.margin_percent.toFixed(1) + '% margin' : ''}</p>
                          </div>
                          <div className="stat-card">
                            <span className="stat-icon">{'\u{1F4B5}'}</span>
                            <p className="stat-label">Total Investment</p>
                            <p className="stat-value">GHS {productViability.total_investment.toFixed(2)}</p>
                          </div>
                          <div className="stat-card">
                            <span className="stat-icon">{'\u2696'}</span>
                            <p className="stat-label">Units to Breakeven</p>
                            <p className="stat-value">{productViability.units_to_breakeven !== null ? productViability.units_to_breakeven : 'N/A'}</p>
                          </div>
                          <div className="stat-card">
                            <span className="stat-icon">{'\u{1F4C5}'}</span>
                            <p className="stat-label">Est. Sell-Through</p>
                            <p className="stat-value">
                              {productViability.weeks_to_sell_through !== null ? productViability.weeks_to_sell_through.toFixed(1) + 'w' : 'No data'}
                            </p>
                          </div>
                        </div>

                        <div className="card">
                          <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>
                            Category Benchmark: {productViability.input.category} ({productViability.category_benchmark.product_count} existing products)
                          </h3>
                          <div className="table-wrapper">
                            <table>
                              <thead><tr><th>Metric</th><th>Your Proposal</th><th>Category Average</th></tr></thead>
                              <tbody>
                                <tr>
                                  <td style={{ fontWeight: '600' }}>Selling Price</td>
                                  <td>GHS {productViability.input.selling_price.toFixed(2)}</td>
                                  <td>{productViability.category_benchmark.avg_price !== null ? 'GHS ' + productViability.category_benchmark.avg_price.toFixed(2) : 'No data'}</td>
                                </tr>
                                <tr>
                                  <td style={{ fontWeight: '600' }}>Margin %</td>
                                  <td>{productViability.margin_percent !== null ? productViability.margin_percent.toFixed(1) + '%' : '-'}</td>
                                  <td>{productViability.category_benchmark.avg_margin_percent !== null ? productViability.category_benchmark.avg_margin_percent.toFixed(1) + '%' : 'No data'}</td>
                                </tr>
                                <tr>
                                  <td style={{ fontWeight: '600' }}>Avg Weekly Velocity</td>
                                  <td colSpan={2}>{productViability.category_benchmark.avg_weekly_velocity.toFixed(1)} units/week (category average)</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {productViability.risk_flags.length > 0 && (
                          <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 12px', color: '#92400e' }}>Things to Consider</h3>
                            <ul style={{ margin: 0, paddingLeft: '20px' }}>
                              {productViability.risk_flags.map((flag, i) => (
                                <li key={i} style={{ fontSize: '13px', color: '#92400e', marginBottom: '6px' }}>{flag}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}


                {activeReport === 'cash-flow' && cashFlow && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4B0}'}</span>
                        <p className="stat-label">Cash In</p>
                        <p className="stat-value" style={{ color: 'var(--accent, #22c55e)' }}>GHS {cashFlow.cash_in.toFixed(2)}</p>
                        <p className="stat-sub">Verified collections only</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4B8}'}</span>
                        <p className="stat-label">Cash Out</p>
                        <p className="stat-value" style={{ color: '#ef4444' }}>GHS {cashFlow.cash_out.toFixed(2)}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u2696'}</span>
                        <p className="stat-label">Net Cash Flow</p>
                        <p className="stat-value" style={{ color: cashFlow.net_cash_flow >= 0 ? 'var(--accent, #22c55e)' : '#ef4444' }}>
                          GHS {cashFlow.net_cash_flow.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Cash Out by Category</h3>
                      {!cashFlow.cash_out_by_category?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F4B8}'}</div>
                          <h3>No cash expenses in this period</h3>
                        </div>
                      ) : (
                        <>
                          <PieChart data={cashFlow.cash_out_by_category.map(c => ({ label: c.category, value: parseFloat(c.total) }))} />
                          <div className="table-wrapper" style={{ marginTop: '20px' }}>
                            <table>
                              <thead><tr><th>Category</th><th>Amount</th></tr></thead>
                              <tbody>
                                {cashFlow.cash_out_by_category.map((c, i) => (
                                  <tr key={i}>
                                    <td style={{ fontWeight: '600', textTransform: 'capitalize' }}>{c.category}</td>
                                    <td style={{ fontWeight: '700', color: '#ef4444' }}>GHS {parseFloat(c.total).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                      {cashFlow.cost_price_includes_landed_cost && (
                        <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '12px' }}>
                          "Import" category excluded above since cost_price already includes landed cost.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeReport === 'cash-runway' && cashRunway && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4B0}'}</span>
                        <p className="stat-label">Cash on Hand</p>
                        <p className="stat-value" style={{ color: 'var(--accent, #22c55e)' }}>GHS {cashRunway.cash_on_hand.toFixed(2)}</p>
                        <p className="stat-sub">All-time balance</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{cashRunway.is_burning ? '\u{1F525}' : '\u2705'}</span>
                        <p className="stat-label">Status</p>
                        <p className="stat-value" style={{ color: cashRunway.is_burning ? '#ef4444' : 'var(--accent, #22c55e)' }}>
                          {cashRunway.is_burning ? 'Burning Cash' : 'Not Burning'}
                        </p>
                        <p className="stat-sub">GHS {cashRunway.monthly_burn_rate.toFixed(2)}/mo</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u23F3'}</span>
                        <p className="stat-label">Runway</p>
                        <p className="stat-value" style={{ color: cashRunway.runway_days !== null ? '#ef4444' : 'var(--accent, #22c55e)' }}>
                          {cashRunway.runway_days !== null
                            ? Math.round(cashRunway.runway_days) + ' days'
                            : 'N/A'}
                        </p>
                        <p className="stat-sub">
                          {cashRunway.runway_months !== null ? '~' + cashRunway.runway_months.toFixed(1) + ' months' : 'Flat or growing cash'}
                        </p>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>
                        Burn Rate Window ({cashRunway.window_days} days)
                      </h3>
                      <div className="table-wrapper">
                        <table>
                          <thead><tr><th>Line</th><th>Amount</th></tr></thead>
                          <tbody>
                            <tr>
                              <td style={{ fontWeight: '600' }}>Cash In</td>
                              <td style={{ fontWeight: '700', color: 'var(--accent, #22c55e)' }}>GHS {cashRunway.window_cash_in.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td style={{ fontWeight: '600' }}>Cash Out</td>
                              <td style={{ fontWeight: '700', color: '#ef4444' }}>GHS {cashRunway.window_cash_out.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td style={{ fontWeight: '700' }}>Net Cash Flow</td>
                              <td style={{ fontWeight: '700', color: cashRunway.net_window_cash_flow >= 0 ? 'var(--accent, #22c55e)' : '#ef4444' }}>
                                GHS {cashRunway.net_window_cash_flow.toFixed(2)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {cashRunway.cost_price_includes_landed_cost === false && (
                        <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '12px' }}>
                          "Import" expenses are excluded from Cash Out above to avoid double-counting with product cost price.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeReport === 'customer-analytics' && customerAnalytics && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F465}'}</span>
                        <p className="stat-label">Total Customers</p>
                        <p className="stat-value">{customerAnalytics.total_customers}</p>
                        <p className="stat-sub">{customerAnalytics.customers_with_orders} with orders</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F501}'}</span>
                        <p className="stat-label">Repeat Rate</p>
                        <p className="stat-value" style={{ color: 'var(--accent, #22c55e)' }}>
                          {customerAnalytics.repeat_rate !== null ? customerAnalytics.repeat_rate.toFixed(0) + '%' : 'N/A'}
                        </p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4B0}'}</span>
                        <p className="stat-label">Average LTV</p>
                        <p className="stat-value">GHS {customerAnalytics.avg_ltv.toFixed(2)}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u26A0'}</span>
                        <p className="stat-label">At Risk</p>
                        <p className="stat-value" style={{ color: customerAnalytics.at_risk_count > 0 ? '#ef4444' : 'var(--accent, #22c55e)' }}>
                          {customerAnalytics.at_risk_count}
                        </p>
                        <p className="stat-sub">No order in {customerAnalytics.at_risk_days}+ days</p>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px' }}>Top Customers by Lifetime Value</h3>
                      <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: '0 0 16px' }}>
                        {customerAnalytics.new_customers_in_period} new customers in this window
                      </p>
                      {!customerAnalytics.customers?.filter(c => c.has_ordered).length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F465}'}</div>
                          <h3>No customer orders yet</h3>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table>
                            <thead>
                              <tr>
                                <th>Customer</th><th>Orders</th><th>Total Spent</th>
                                <th>Avg Order</th><th>Days Since Last</th><th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {customerAnalytics.customers.filter(c => c.has_ordered).slice(0, 50).map((c, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: '600' }}>{c.name}</td>
                                  <td>{c.total_orders}</td>
                                  <td style={{ fontWeight: '700', color: 'var(--accent, #22c55e)' }}>GHS {c.total_spent.toFixed(2)}</td>
                                  <td>GHS {c.avg_order_value.toFixed(2)}</td>
                                  <td>{c.days_since_last_order !== null ? c.days_since_last_order : '-'}</td>
                                  <td>
                                    {c.is_at_risk
                                      ? <span className="badge badge-red">At Risk</span>
                                      : c.is_repeat_customer
                                        ? <span className="badge badge-green">Repeat</span>
                                        : <span className="badge badge-amber">One-time</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {customerAnalytics.customers.filter(c => c.has_ordered).length > 50 && (
                            <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '12px' }}>
                              Showing top 50 of {customerAnalytics.customers.filter(c => c.has_ordered).length} customers with orders. Full list in the Excel export.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeReport === 'vat-estimate' && vatEstimate && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {vatEstimate.unset_rates.length > 0 && (
                      <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#92400e', fontWeight: '600' }}>
                          Not set in Report Settings (treated as 0%): {vatEstimate.unset_rates.join(', ')}
                        </p>
                      </div>
                    )}
                    <div className="stats-grid">
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4B0}'}</span>
                        <p className="stat-label">Gross Revenue</p>
                        <p className="stat-value" style={{ color: '#3b82f6' }}>GHS {vatEstimate.gross_revenue.toFixed(2)}</p>
                        <p className="stat-sub">Tax-inclusive</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u2696'}</span>
                        <p className="stat-label">Net Base</p>
                        <p className="stat-value" style={{ color: 'var(--text-2)' }}>GHS {vatEstimate.net_base.toFixed(2)}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F9FE}'}</span>
                        <p className="stat-label">Total Tax Estimate</p>
                        <p className="stat-value" style={{ color: '#ef4444' }}>GHS {vatEstimate.total_tax_estimate.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Breakdown by Levy</h3>
                      <div className="table-wrapper">
                        <table>
                          <thead><tr><th>Levy</th><th>Rate</th><th>Amount</th></tr></thead>
                          <tbody>
                            {vatEstimate.breakdown.map((b, i) => (
                              <tr key={i}>
                                <td style={{ fontWeight: '600' }}>{b.label}</td>
                                <td>{b.rate.toFixed(2)}%</td>
                                <td style={{ fontWeight: '700', color: '#ef4444' }}>GHS {b.amount.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '16px', fontStyle: 'italic' }}>
                        Withholding tax is not estimated here — it applies to supplier/contractor payments, not sales revenue, and depends on payment type. Review separately with your accountant.
                      </p>
                    </div>
                  </div>
                )}

                {activeReport === 'unit-economics' && unitEconomics && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {(!unitEconomics.momo_fee_configured || !unitEconomics.rider_cost_configured) && (
                      <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#92400e', fontWeight: '600' }}>
                          {!unitEconomics.momo_fee_configured && 'MoMo fee % not set — assumed 0. '}
                          {!unitEconomics.rider_cost_configured && 'Avg rider cost per delivery not set — assumed GHS 0.'}
                          {' '}Set these in Report Settings for accurate numbers.
                        </p>
                      </div>
                    )}
                    <div className="stats-grid">
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4B0}'}</span>
                        <p className="stat-label">Avg Revenue</p>
                        <p className="stat-value" style={{ color: '#3b82f6' }}>GHS {unitEconomics.avg_revenue.toFixed(2)}</p>
                        <p className="stat-sub">per order</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4E6}'}</span>
                        <p className="stat-label">Avg COGS</p>
                        <p className="stat-value" style={{ color: '#ef4444' }}>GHS {unitEconomics.avg_cogs.toFixed(2)}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F9EE}'}</span>
                        <p className="stat-label">Avg MoMo Fee + Rider Cost</p>
                        <p className="stat-value" style={{ color: '#f59e0b' }}>GHS {(unitEconomics.avg_momo_fee + unitEconomics.avg_rider_cost).toFixed(2)}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F3C6}'}</span>
                        <p className="stat-label">Net Profit per Order</p>
                        <p className="stat-value" style={{ color: unitEconomics.avg_net_profit >= 0 ? 'var(--accent, #22c55e)' : '#ef4444' }}>
                          GHS {unitEconomics.avg_net_profit.toFixed(2)}
                        </p>
                        <p className="stat-sub">{unitEconomics.total_orders} orders</p>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>By Payment Method</h3>
                      {!unitEconomics.by_payment_method?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F9EE}'}</div>
                          <h3>No delivered orders in this period</h3>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table>
                            <thead><tr><th>Payment Method</th><th>Order Count</th><th>Avg Net Profit</th></tr></thead>
                            <tbody>
                              {unitEconomics.by_payment_method.map((m, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: '600', textTransform: 'capitalize' }}>{m.payment_method}</td>
                                  <td>{m.order_count}</td>
                                  <td style={{ fontWeight: '700', color: m.avg_net_profit >= 0 ? 'var(--accent, #22c55e)' : '#ef4444' }}>
                                    GHS {m.avg_net_profit.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeReport === 'compliance-calendar' && <ComplianceCalendar />}

                {activeReport === 'order-journey' && orderJourney && !orderJourney.found && (
                  <div className="empty-state">
                    <div className="empty-icon">{'\u{1F50D}'}</div>
                    <h3>{orderJourney.message || 'No order found'}</h3>
                  </div>
                )}

                {activeReport === 'order-journey' && orderJourney?.found && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>
                        Order {orderJourney.order.order_number}
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '13px' }}>
                        <div><span style={{ color: 'var(--text-3)' }}>Customer</span><div style={{ fontWeight: '600' }}>{orderJourney.order.customer_name || '-'}</div></div>
                        <div><span style={{ color: 'var(--text-3)' }}>Phone</span><div style={{ fontWeight: '600' }}>{orderJourney.order.customer_phone || '-'}</div></div>
                        <div><span style={{ color: 'var(--text-3)' }}>Delivery Address</span><div style={{ fontWeight: '600' }}>{orderJourney.order.delivery_address || '-'}</div></div>
                        <div><span style={{ color: 'var(--text-3)' }}>Status</span><div><span className="badge badge-amber">{orderJourney.order.status}</span></div></div>
                        <div><span style={{ color: 'var(--text-3)' }}>Payment</span><div style={{ fontWeight: '600' }}>{orderJourney.order.payment_method} — {orderJourney.order.payment_status}</div></div>
                        <div><span style={{ color: 'var(--text-3)' }}>Placed By</span><div style={{ fontWeight: '600' }}>{orderJourney.order.created_by_name || '-'}</div></div>
                        <div><span style={{ color: 'var(--text-3)' }}>Placed At</span><div style={{ fontWeight: '600' }}>{new Date(orderJourney.order.created_at).toLocaleString('en-GB')}</div></div>
                        {orderJourney.order.discount > 0 && (
                          <div><span style={{ color: 'var(--text-3)' }}>Discount</span><div style={{ fontWeight: '600' }}>GH{'\u20B5'}{parseFloat(orderJourney.order.discount).toFixed(2)} {orderJourney.order.discount_reason ? `(${orderJourney.order.discount_reason})` : ''}</div></div>
                        )}
                        <div><span style={{ color: 'var(--text-3)' }}>Delivery Fee</span><div style={{ fontWeight: '600' }}>GH{'\u20B5'}{parseFloat(orderJourney.order.delivery_fee || 0).toFixed(2)}</div></div>
                        <div><span style={{ color: 'var(--text-3)' }}>Total</span><div style={{ fontWeight: '700' }}>GH{'\u20B5'}{parseFloat(orderJourney.order.total_amount).toFixed(2)}</div></div>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Items</h3>
                      <div className="table-wrapper">
                        <table>
                          <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead>
                          <tbody>
                            {(orderJourney.items || []).map((it, i) => (
                              <tr key={i}>
                                <td style={{ fontWeight: '600' }}>{it.product_name || 'Unknown product'}</td>
                                <td>{it.quantity}</td>
                                <td>GH{'\u20B5'}{parseFloat(it.unit_price).toFixed(2)}</td>
                                <td>GH{'\u20B5'}{parseFloat(it.total_price).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Cash Timeline</h3>
                      {!orderJourney.cash_logs?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F4B5}'}</div>
                          <h3>No cash logs recorded for this order</h3>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {orderJourney.cash_logs.map((cl, i) => (
                            <div key={i} style={{ borderLeft: '3px solid var(--border)', paddingLeft: '12px', fontSize: '13px' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span className={`badge ${cl.status === 'verified' ? 'badge-green' : cl.status === 'disputed' ? 'badge-red' : cl.status === 'resolved' ? 'badge-green' : 'badge-amber'}`}>{cl.status}</span>
                                <span style={{ fontWeight: '600' }}>GH{'\u20B5'}{parseFloat(cl.amount).toFixed(2)}</span>
                                <span style={{ color: 'var(--text-3)' }}>collected by {cl.rider_name || 'unknown rider'} on {new Date(cl.collected_at || cl.created_at).toLocaleString('en-GB')}</span>
                              </div>
                              {cl.verified_by_name && (
                                <div style={{ color: 'var(--text-3)', marginTop: '2px' }}>Verified by {cl.verified_by_name} on {new Date(cl.verified_at).toLocaleString('en-GB')}</div>
                              )}
                              {cl.resolved_by_name && (
                                <div style={{ color: 'var(--text-3)', marginTop: '2px' }}>
                                  Resolved by {cl.resolved_by_name} on {new Date(cl.resolved_at).toLocaleString('en-GB')}
                                  {cl.resolution_notes ? ` — ${cl.resolution_notes}` : ''}
                                </div>
                              )}
                              {cl.notes && <div style={{ color: 'var(--text-3)', marginTop: '2px' }}>Note: {cl.notes}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Delivery Timeline</h3>
                      {!orderJourney.deliveries?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F6F5}'}</div>
                          <h3>No delivery assigned yet</h3>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {orderJourney.deliveries.map((d, i) => (
                            <div key={i} style={{ borderLeft: '3px solid var(--border)', paddingLeft: '12px', fontSize: '13px' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span className={`badge ${d.status === 'delivered' ? 'badge-green' : d.status === 'failed' || d.status === 'rejected' ? 'badge-red' : 'badge-amber'}`}>{d.status}</span>
                                <span style={{ fontWeight: '600' }}>{d.rider_name || 'Unassigned'}</span>
                                {d.rider_phone && <span style={{ color: 'var(--text-3)' }}>{d.rider_phone}</span>}
                              </div>
                              <div style={{ color: 'var(--text-3)', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                {d.assigned_at && <span>Assigned: {new Date(d.assigned_at).toLocaleString('en-GB')}</span>}
                                {d.accepted_at && <span>Accepted: {new Date(d.accepted_at).toLocaleString('en-GB')}</span>}
                                {d.rejected_at && <span>Rejected: {new Date(d.rejected_at).toLocaleString('en-GB')}{d.rejection_reason ? ` — ${d.rejection_reason}` : ''}</span>}
                                {d.picked_up_at && <span>Picked up: {new Date(d.picked_up_at).toLocaleString('en-GB')}</span>}
                                {d.delivered_at && <span>Delivered: {new Date(d.delivered_at).toLocaleString('en-GB')}</span>}
                                {d.failure_reason && <span>Failure reason: {d.failure_reason}</span>}
                                {d.recipient_name && <span>Received by: {d.recipient_name}</span>}
                                {d.delivery_notes && <span>Notes: {d.delivery_notes}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeReport === 'daily-sales-register' && dailySalesRegister && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4E6}'}</span>
                        <p className="stat-label">Total Orders</p>
                        <p className="stat-value" style={{ color: '#3b82f6' }}>{dailySalesRegister.summary?.total_orders || 0}</p>
                        <p className="stat-sub">{dailySalesRegister.date}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F9FE}'}</span>
                        <p className="stat-label">Total Items</p>
                        <p className="stat-value" style={{ color: '#8b5cf6' }}>{dailySalesRegister.summary?.total_items || 0}</p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F4B0}'}</span>
                        <p className="stat-label">Total Revenue</p>
                        <p className="stat-value" style={{ color: 'var(--accent, #22c55e)' }}>
                          GH{'\u20B5'}{parseFloat(dailySalesRegister.summary?.total_revenue || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="stat-card">
                        <span className="stat-icon">{'\u{1F3F7}'}</span>
                        <p className="stat-label">Total Discount</p>
                        <p className="stat-value" style={{ color: '#ef4444' }}>
                          GH{'\u20B5'}{parseFloat(dailySalesRegister.summary?.total_discount || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Orders & Line Items</h3>
                      {!dailySalesRegister.orders?.length ? (
                        <div className="empty-state">
                          <div className="empty-icon">{'\u{1F9FE}'}</div>
                          <h3>No orders placed on {dailySalesRegister.date}</h3>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table>
                            <thead>
                              <tr>
                                <th>Order #</th>
                                <th>Customer</th>
                                <th>Phone</th>
                                <th>Delivery Address</th>
                                <th>Product</th>
                                <th>Qty</th>
                                <th>Unit Price</th>
                                <th>Line Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dailySalesRegister.orders.map((o) => {
                                const items = o.items?.length ? o.items : [{ product_name: '-', quantity: '', unit_price: null, total_price: null }];
                                return items.map((it, idx) => (
                                  <tr key={`${o.id}-${idx}`} style={idx === 0 ? { borderTop: '2px solid var(--border)' } : undefined}>
                                    <td style={{ fontWeight: '600' }}>{idx === 0 ? o.order_number : ''}</td>
                                    <td>{idx === 0 ? (o.customer_name || 'Walk-in') : ''}</td>
                                    <td>{idx === 0 ? (o.customer_phone || '-') : ''}</td>
                                    <td>{idx === 0 ? (o.delivery_address || '-') : ''}</td>
                                    <td>{it.product_name || 'Unknown product'}</td>
                                    <td>{it.quantity}</td>
                                    <td>{it.unit_price !== null && it.unit_price !== undefined ? `GH${'\u20B5'}${parseFloat(it.unit_price).toFixed(2)}` : ''}</td>
                                    <td>{it.total_price !== null && it.total_price !== undefined ? `GH${'\u20B5'}${parseFloat(it.total_price).toFixed(2)}` : ''}</td>
                                  </tr>
                                ));
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div>
            <div className="page-header">
              <div>
                <h2 className="page-title" style={{ fontSize: '20px' }}>{currentCategory.icon} {currentCategory.label}</h2>
              </div>
            </div>

            {currentCategory.reports.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">{currentCategory.icon}</div>
                <h3>First report for this category is in progress</h3>
                <p>Nothing to show yet - check back once it's built.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                {currentCategory.reports.map(r => (
                  <ReportCard key={r.key} report={r} onClick={() => setActiveReport(r.key)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsHub;
