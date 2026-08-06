const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, WidthType, PageNumber } = require('docx');
const ExcelJS = require('exceljs');
const pool = require('../config/db');
const { getRevenueData, getProductData, getRiderData, getPnLData, getBudgetVsActualData, getMarginTrendData, getExceptionsData, getAuditTrailData, getCashReconciliationData, getLoginAnomaliesData, getPermissionChangeData, getCashierPerformanceData, getTrueMarginData, getCashFlowData, getVatEstimateData, getUnitEconomicsData, getCashRunwayData, getReorderPointData, getSupplierScorecardData, getCustomerAnalyticsData, getDemandForecastData, getNewProductScorecardData, getProductViabilityData, getManagerPerformanceData, getDailySalesRegisterData } = require('./reportController');

const FALLBACK_COMPANY_NAME = 'Shorewinds';

// Cached so we don't hit the DB on every single export call in a session.
// Cache is process-lifetime; restart the backend (or add a TTL later) if
// business_name is changed and needs to show up immediately.
let cachedCompanyName = null;

const getCompanyName = async () => {
  if (cachedCompanyName) return cachedCompanyName;
  try {
    const result = await pool.query('SELECT business_name FROM business_profile WHERE id = 1');
    cachedCompanyName = result.rows[0]?.business_name || FALLBACK_COMPANY_NAME;
  } catch (error) {
    console.error('getCompanyName error, falling back to default:', error);
    cachedCompanyName = FALLBACK_COMPANY_NAME;
  }
  return cachedCompanyName;
};

const periodLabel = (data) =>
  data.period === 'custom'
    ? `${data.start_date} to ${data.end_date}`
    : `Last ${data.period} days`;

const docxHeader = (companyName) => new Header({
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: companyName, bold: true, size: 28 })],
    }),
  ],
});

const docxFooter = () => new Footer({
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'Generated ' + new Date().toLocaleDateString('en-GB') + ' - Page ', size: 18 }),
        new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
        new TextRun({ text: ' of ', size: 18 }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 }),
      ],
    }),
  ],
});

const docxTitleBlock = (title, subtitle) => ([
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: title, bold: true, size: 32 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [new TextRun({ text: subtitle, size: 22, color: '666666' })],
  }),
]);

const docxTable = (headers, rows) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({
      children: headers.map(h => new TableCell({
        shading: { fill: '1a1a18' },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20 })] })],
      })),
    }),
    ...rows.map(row => new TableRow({
      children: row.map(cell => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(cell === null || cell === undefined ? '' : cell), size: 20 })] })],
      })),
    })),
  ],
});

const buildDocx = async (titleBlock, tables) => {
  const companyName = await getCompanyName();
  const doc = new Document({
    sections: [{
      properties: {},
      headers: { default: docxHeader(companyName) },
      footers: { default: docxFooter() },
      children: titleBlock.concat(tables),
    }],
  });
  return Packer.toBuffer(doc);
};

const xlsxHeaderRow = (sheet, headers) => {
  const row = sheet.addRow(headers);
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A18' } };
  });
};

const buildRevenueDocx = async (data) => {
  const s = data.summary;
  const title = docxTitleBlock('Revenue Report', periodLabel(data));
  const summaryTable = docxTable(
    ['Metric', 'Value'],
    [
      ['Total Revenue', 'GHS ' + parseFloat(s.total_revenue || 0).toFixed(2)],
      ['Total Orders', s.total_orders || 0],
      ['Delivered', s.delivered || 0],
      ['Failed', s.failed || 0],
      ['Returned', s.returned || 0],
      ['Avg Order Value', 'GHS ' + parseFloat(s.avg_order_value || 0).toFixed(2)],
    ]
  );
  const dailyTable = docxTable(
    ['Date', 'Orders', 'Delivered', 'Failed', 'Revenue (GHS)'],
    data.daily.map(d => [d.date, d.total_orders, d.delivered, d.failed, parseFloat(d.revenue || 0).toFixed(2)])
  );
  const body = [
    summaryTable,
    new Paragraph({ text: '', spacing: { after: 300 } }),
    new Paragraph({ children: [new TextRun({ text: 'Daily Breakdown', bold: true, size: 24 })], spacing: { after: 150 } }),
    dailyTable,
  ];
  return buildDocx(title, body);
};

const buildRevenueXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 22 }, { width: 20 }];
  xlsxHeaderRow(summary, ['Metric', 'Value']);
  const s = data.summary;
  [
    ['Total Revenue (GHS)', parseFloat(s.total_revenue || 0)],
    ['Total Orders', s.total_orders || 0],
    ['Delivered', s.delivered || 0],
    ['Failed', s.failed || 0],
    ['Returned', s.returned || 0],
    ['Avg Order Value (GHS)', parseFloat(s.avg_order_value || 0)],
  ].forEach(r => summary.addRow(r));

  const daily = wb.addWorksheet('Daily Detail');
  daily.columns = [{ width: 14 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 16 }];
  xlsxHeaderRow(daily, ['Date', 'Orders', 'Delivered', 'Failed', 'Revenue (GHS)']);
  data.daily.forEach(d => daily.addRow([d.date, d.total_orders, d.delivered, d.failed, parseFloat(d.revenue || 0)]));

  return wb.xlsx.writeBuffer();
};

const buildProductsDocx = async (data) => {
  const title = docxTitleBlock('Product Performance Report', 'Last ' + data.period + ' days');
  const topTable = docxTable(
    ['Product', 'Category', 'Units Sold', 'Revenue (GHS)', 'Stock'],
    data.top_products.map(p => [p.name, p.category || '-', p.total_sold, parseFloat(p.total_revenue || 0).toFixed(2), p.current_stock])
  );
  const body = [
    new Paragraph({ children: [new TextRun({ text: 'Top Selling Products', bold: true, size: 24 })], spacing: { after: 150 } }),
    topTable,
  ];
  if (data.low_stock && data.low_stock.length) {
    body.push(
      new Paragraph({ text: '', spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: 'Low Stock Alert', bold: true, size: 24 })], spacing: { after: 150 } }),
      docxTable(
        ['Product', 'Category', 'Current Stock', 'Threshold'],
        data.low_stock.map(p => [p.name, p.category || '-', p.stock_quantity, p.low_stock_threshold])
      )
    );
  }
  return buildDocx(title, body);
};

const buildProductsXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const top = wb.addWorksheet('Top Products');
  top.columns = [{ width: 24 }, { width: 16 }, { width: 12 }, { width: 16 }, { width: 10 }];
  xlsxHeaderRow(top, ['Product', 'Category', 'Units Sold', 'Revenue (GHS)', 'Stock']);
  data.top_products.forEach(p => top.addRow([p.name, p.category || '-', p.total_sold, parseFloat(p.total_revenue || 0), p.current_stock]));

  if (data.low_stock && data.low_stock.length) {
    const low = wb.addWorksheet('Low Stock');
    low.columns = [{ width: 24 }, { width: 16 }, { width: 14 }, { width: 12 }];
    xlsxHeaderRow(low, ['Product', 'Category', 'Current Stock', 'Threshold']);
    data.low_stock.forEach(p => low.addRow([p.name, p.category || '-', p.stock_quantity, p.low_stock_threshold]));
  }
  return wb.xlsx.writeBuffer();
};

const buildRidersDocx = async (data) => {
  const title = docxTitleBlock('Rider Performance Report', 'Last ' + data.period + ' days');
  const table = docxTable(
    ['Rider', 'Deliveries', 'Successful', 'Failed', 'Cash Collected (GHS)', 'Disputes'],
    data.riders.map(r => [
      r.rider_name, r.total_deliveries, r.successful, r.failed,
      parseFloat(r.total_cash_collected || 0).toFixed(2), r.disputed_collections,
    ])
  );
  return buildDocx(title, [table]);
};

const buildRidersXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Rider Performance');
  sheet.columns = [{ width: 20 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 18 }, { width: 10 }];
  xlsxHeaderRow(sheet, ['Rider', 'Deliveries', 'Successful', 'Failed', 'Cash Collected (GHS)', 'Disputes']);
  data.riders.forEach(r => sheet.addRow([
    r.rider_name, r.total_deliveries, r.successful, r.failed,
    parseFloat(r.total_cash_collected || 0), r.disputed_collections,
  ]));
  return wb.xlsx.writeBuffer();
};

const buildPnLDocx = async (data) => {
  const title = docxTitleBlock('Profit & Loss Statement', periodLabel(data));
  const body = [];

  if (!data.setting_configured) {
    body.push(new Paragraph({
      children: [new TextRun({ text: 'Warning: cost_price_includes_landed_cost is not set in Report Settings — the import expense category is NOT excluded, which may double-count landed cost. Set this before relying on this P&L.', color: 'CC0000', bold: true, size: 18 })],
      spacing: { after: 300 },
    }));
  }

  const summaryTable = docxTable(
    ['Line', 'Amount (GHS)'],
    [
      ['Revenue', data.revenue.toFixed(2)],
      ['Cost of Goods Sold (COGS)', '(' + data.cogs.toFixed(2) + ')'],
      ['Gross Profit', data.gross_profit.toFixed(2)],
      ['Gross Margin %', data.gross_margin_percent.toFixed(1) + '%'],
      ['Total Operating Expenses', '(' + data.total_operating_expenses.toFixed(2) + ')'],
      ['Net Profit', data.net_profit.toFixed(2)],
      ['Net Margin %', data.net_margin_percent.toFixed(1) + '%'],
    ]
  );
  body.push(summaryTable);

  if (data.expenses_by_category?.length) {
    body.push(
      new Paragraph({ text: '', spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: 'Operating Expenses by Category', bold: true, size: 24 })], spacing: { after: 150 } }),
      docxTable(
        ['Category', 'Amount (GHS)', 'Count'],
        data.expenses_by_category.map(e => [e.category, parseFloat(e.total).toFixed(2), e.count])
      )
    );
  }
  return buildDocx(title, body);
};

const buildPnLXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('P&L Summary');
  summary.columns = [{ width: 28 }, { width: 18 }];
  xlsxHeaderRow(summary, ['Line', 'Amount (GHS)']);
  [
    ['Revenue', data.revenue],
    ['Cost of Goods Sold (COGS)', -data.cogs],
    ['Gross Profit', data.gross_profit],
    ['Gross Margin %', data.gross_margin_percent],
    ['Total Operating Expenses', -data.total_operating_expenses],
    ['Net Profit', data.net_profit],
    ['Net Margin %', data.net_margin_percent],
  ].forEach(r => summary.addRow(r));

  if (!data.setting_configured) {
    const warn = summary.addRow(['cost_price_includes_landed_cost is NOT set in Report Settings — figures may double-count import cost.']);
    warn.font = { color: { argb: 'FFCC0000' }, bold: true };
  }

  if (data.expenses_by_category?.length) {
    const exp = wb.addWorksheet('Expenses by Category');
    exp.columns = [{ width: 24 }, { width: 18 }, { width: 10 }];
    xlsxHeaderRow(exp, ['Category', 'Amount (GHS)', 'Count']);
    data.expenses_by_category.forEach(e => exp.addRow([e.category, parseFloat(e.total), e.count]));
  }
  return wb.xlsx.writeBuffer();
};

const variancePct = (v) => v === null || v === undefined ? 'N/A' : v.toFixed(1) + '%';
const moneyOrNA = (v) => v === null || v === undefined ? 'Not set' : 'GHS ' + v.toFixed(2);

const buildBudgetDocx = async (data) => {
  const title = docxTitleBlock('Budget vs Actual', data.month);
  const table = docxTable(
    ['Metric', 'Budget/Target', 'Actual', 'Variance'],
    [
      ['Revenue', moneyOrNA(data.revenue_budget), 'GHS ' + data.revenue.toFixed(2), data.revenue_variance !== null ? 'GHS ' + data.revenue_variance.toFixed(2) + ' (' + variancePct(data.revenue_variance_percent) + ')' : 'N/A'],
      ['Operating Expenses', moneyOrNA(data.expense_budget), 'GHS ' + data.actual_expenses.toFixed(2), data.expense_variance !== null ? 'GHS ' + data.expense_variance.toFixed(2) + ' (' + variancePct(data.expense_variance_percent) + ')' : 'N/A'],
      ['Gross Margin %', data.target_gross_margin_percent !== null ? data.target_gross_margin_percent.toFixed(1) + '%' : 'Not set', data.gross_margin_percent.toFixed(1) + '%', '-'],
      ['Net Margin %', data.target_net_margin_percent !== null ? data.target_net_margin_percent.toFixed(1) + '%' : 'Not set', data.net_margin_percent.toFixed(1) + '%', '-'],
      ['Net Profit', '-', 'GHS ' + data.net_profit.toFixed(2), '-'],
    ]
  );
  return buildDocx(title, [table]);
};

const buildBudgetXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Budget vs Actual');
  sheet.columns = [{ width: 22 }, { width: 18 }, { width: 18 }, { width: 22 }];
  xlsxHeaderRow(sheet, ['Metric', 'Budget/Target', 'Actual', 'Variance']);
  sheet.addRow(['Revenue', data.revenue_budget ?? 'Not set', data.revenue, data.revenue_variance ?? 'N/A']);
  sheet.addRow(['Operating Expenses', data.expense_budget ?? 'Not set', data.actual_expenses, data.expense_variance ?? 'N/A']);
  sheet.addRow(['Gross Margin %', data.target_gross_margin_percent ?? 'Not set', data.gross_margin_percent, '-']);
  sheet.addRow(['Net Margin %', data.target_net_margin_percent ?? 'Not set', data.net_margin_percent, '-']);
  sheet.addRow(['Net Profit', '-', data.net_profit, '-']);
  return wb.xlsx.writeBuffer();
};

const buildMarginTrendDocx = async (data) => {
  const title = docxTitleBlock('Margin Trend', data.months[0]?.month + ' to ' + data.months[data.months.length - 1]?.month);
  const table = docxTable(
    ['Month', 'Revenue (GHS)', 'Gross Profit (GHS)', 'Gross Margin %', 'Net Profit (GHS)', 'Net Margin %'],
    data.months.map(m => [
      m.month, m.revenue.toFixed(2), m.gross_profit.toFixed(2),
      m.gross_margin_percent.toFixed(1) + '%', m.net_profit.toFixed(2), m.net_margin_percent.toFixed(1) + '%',
    ])
  );
  return buildDocx(title, [table]);
};

const buildMarginTrendXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Margin Trend');
  sheet.columns = [{ width: 12 }, { width: 16 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 14 }];
  xlsxHeaderRow(sheet, ['Month', 'Revenue', 'Gross Profit', 'Gross Margin %', 'Net Profit', 'Net Margin %']);
  data.months.forEach(m => sheet.addRow([m.month, m.revenue, m.gross_profit, m.gross_margin_percent, m.net_profit, m.net_margin_percent]));
  return wb.xlsx.writeBuffer();
};

const buildExceptionsDocx = async (data) => {
  const title = docxTitleBlock('Exceptions Report', periodLabel(data));
  const summaryTable = docxTable(
    ['Metric', 'Value'],
    [
      ['Total Exceptions', data.total_exceptions],
      ['Still Disputed', data.still_disputed_count],
      ['Resolved', data.resolved_count],
      ['Outstanding Disputed Amount', 'GHS ' + data.total_disputed_amount_outstanding.toFixed(2)],
    ]
  );
  const detailTable = docxTable(
    ['Date', 'Rider', 'Order', 'Amount', 'Status', 'Notes'],
    data.exceptions.map(e => [
      new Date(e.created_at).toLocaleDateString('en-GB'), e.rider_name || '-', e.order_number || '-',
      'GHS ' + parseFloat(e.amount || 0).toFixed(2), e.status, e.notes || '-',
    ])
  );
  return buildDocx(title, [
    summaryTable,
    new Paragraph({ text: '', spacing: { after: 300 } }),
    new Paragraph({ children: [new TextRun({ text: 'All Exceptions', bold: true, size: 24 })], spacing: { after: 150 } }),
    detailTable,
  ]);
};

const buildExceptionsXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 28 }, { width: 18 }];
  xlsxHeaderRow(summary, ['Metric', 'Value']);
  [
    ['Total Exceptions', data.total_exceptions],
    ['Still Disputed', data.still_disputed_count],
    ['Resolved', data.resolved_count],
    ['Outstanding Disputed Amount (GHS)', data.total_disputed_amount_outstanding],
  ].forEach(r => summary.addRow(r));

  const detail = wb.addWorksheet('Exceptions Detail');
  detail.columns = [{ width: 14 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 40 }];
  xlsxHeaderRow(detail, ['Date', 'Rider', 'Order', 'Amount', 'Status', 'Notes']);
  data.exceptions.forEach(e => detail.addRow([
    new Date(e.created_at).toLocaleDateString('en-GB'), e.rider_name || '-', e.order_number || '-',
    parseFloat(e.amount || 0), e.status, e.notes || '-',
  ]));
  return wb.xlsx.writeBuffer();
};

const buildAuditTrailDocx = async (data) => {
  const title = docxTitleBlock('Staff Action Audit Trail', periodLabel(data));
  const byActionTable = docxTable(
    ['Action', 'Count'],
    data.by_action.map(a => [a.action, a.count])
  );
  const byUserTable = docxTable(
    ['Staff Member', 'Role', 'Actions'],
    data.by_user.map(u => [u.user_name || 'Unknown', u.user_role || '-', u.count])
  );
  const logTable = docxTable(
    ['Date', 'Staff', 'Action', 'Entity', 'Description'],
    data.logs.slice(0, 200).map(l => [
      new Date(l.created_at).toLocaleString('en-GB'), l.user_name || 'Unknown', l.action, l.entity || '-', l.description || '-',
    ])
  );
  const body = [
    new Paragraph({ children: [new TextRun({ text: 'Total actions: ' + data.total_actions, bold: true, size: 22 })], spacing: { after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: 'Actions by Type', bold: true, size: 24 })], spacing: { after: 150 } }),
    byActionTable,
    new Paragraph({ text: '', spacing: { after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: 'Top Actors', bold: true, size: 24 })], spacing: { after: 150 } }),
    byUserTable,
    new Paragraph({ text: '', spacing: { after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: 'Detail Log' + (data.logs_capped ? ' (first 200 of ' + data.total_actions + ')' : ''), bold: true, size: 24 })], spacing: { after: 150 } }),
    logTable,
  ];
  return buildDocx(title, body);
};

const buildAuditTrailXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const byAction = wb.addWorksheet('By Action');
  byAction.columns = [{ width: 24 }, { width: 12 }];
  xlsxHeaderRow(byAction, ['Action', 'Count']);
  data.by_action.forEach(a => byAction.addRow([a.action, a.count]));

  const byUser = wb.addWorksheet('Top Actors');
  byUser.columns = [{ width: 24 }, { width: 16 }, { width: 12 }];
  xlsxHeaderRow(byUser, ['Staff Member', 'Role', 'Actions']);
  data.by_user.forEach(u => byUser.addRow([u.user_name || 'Unknown', u.user_role || '-', u.count]));

  const log = wb.addWorksheet('Detail Log');
  log.columns = [{ width: 20 }, { width: 18 }, { width: 20 }, { width: 14 }, { width: 50 }];
  xlsxHeaderRow(log, ['Date', 'Staff', 'Action', 'Entity', 'Description']);
  data.logs.forEach(l => log.addRow([
    new Date(l.created_at).toLocaleString('en-GB'), l.user_name || 'Unknown', l.action, l.entity || '-', l.description || '-',
  ]));

  return wb.xlsx.writeBuffer();
};

const buildCashReconciliationDocx = async (data) => {
  const title = docxTitleBlock('Cash Reconciliation Variance', periodLabel(data));
  const summaryTable = docxTable(
    ['Metric', 'Value'],
    [
      ['Total Expected (GHS)', data.total_expected.toFixed(2)],
      ['Total Actual (GHS)', data.total_actual.toFixed(2)],
      ['Total Variance (GHS)', data.total_variance.toFixed(2)],
      ['Riders with Shortage', data.riders_with_shortage],
    ]
  );
  const detailTable = docxTable(
    ['Rider', 'Expected (GHS)', 'Actual (GHS)', 'Variance (GHS)', 'Status'],
    data.riders.map(r => [r.rider_name, r.expected_amount.toFixed(2), r.actual_amount.toFixed(2), r.variance.toFixed(2), r.status])
  );
  return buildDocx(title, [
    summaryTable,
    new Paragraph({ text: '', spacing: { after: 300 } }),
    new Paragraph({ children: [new TextRun({ text: 'By Rider', bold: true, size: 24 })], spacing: { after: 150 } }),
    detailTable,
  ]);
};

const buildCashReconciliationXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 24 }, { width: 18 }];
  xlsxHeaderRow(summary, ['Metric', 'Value']);
  [
    ['Total Expected (GHS)', data.total_expected],
    ['Total Actual (GHS)', data.total_actual],
    ['Total Variance (GHS)', data.total_variance],
    ['Riders with Shortage', data.riders_with_shortage],
  ].forEach(r => summary.addRow(r));

  const detail = wb.addWorksheet('By Rider');
  detail.columns = [{ width: 20 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 }];
  xlsxHeaderRow(detail, ['Rider', 'Expected (GHS)', 'Actual (GHS)', 'Variance (GHS)', 'Status']);
  data.riders.forEach(r => detail.addRow([r.rider_name, r.expected_amount, r.actual_amount, r.variance, r.status]));

  return wb.xlsx.writeBuffer();
};

const buildLoginAnomaliesDocx = async (data) => {
  const title = docxTitleBlock('Login Anomalies', periodLabel(data));
  const body = [];

  if (!data.business_hours_configured) {
    body.push(new Paragraph({
      children: [new TextRun({ text: 'Business hours not set in Report Settings — off-hours login flagging is skipped. Repeated-failure anomalies below are still real.', color: 'CC7A00', bold: true, size: 18 })],
      spacing: { after: 200 },
    }));
  }

  body.push(
    new Paragraph({ children: [new TextRun({ text: 'Repeated Failed Logins (3+ same day)', bold: true, size: 24 })], spacing: { after: 150 } }),
    docxTable(
      ['Email', 'Day', 'Failures', 'Last Attempt', 'Sample IP'],
      data.repeated_failures.map(f => [f.email_attempted || 'unknown', f.day, f.failure_count, new Date(f.last_attempt).toLocaleString('en-GB'), f.sample_ip || '-'])
    )
  );

  if (data.business_hours_configured) {
    body.push(
      new Paragraph({ text: '', spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: 'Off-Hours Logins', bold: true, size: 24 })], spacing: { after: 150 } }),
      docxTable(
        ['User', 'Role', 'Time', 'IP'],
        data.off_hours_logins.map(l => [l.user_name || l.email_attempted || 'unknown', l.user_role || '-', new Date(l.created_at).toLocaleString('en-GB'), l.ip_address || '-'])
      )
    );
  }
  return buildDocx(title, body);
};

const buildLoginAnomaliesXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const failures = wb.addWorksheet('Repeated Failures');
  failures.columns = [{ width: 24 }, { width: 14 }, { width: 12 }, { width: 20 }, { width: 16 }];
  xlsxHeaderRow(failures, ['Email', 'Day', 'Failures', 'Last Attempt', 'Sample IP']);
  data.repeated_failures.forEach(f => failures.addRow([f.email_attempted || 'unknown', f.day, f.failure_count, new Date(f.last_attempt).toLocaleString('en-GB'), f.sample_ip || '-']));

  if (data.business_hours_configured) {
    const offHours = wb.addWorksheet('Off-Hours Logins');
    offHours.columns = [{ width: 20 }, { width: 16 }, { width: 20 }, { width: 16 }];
    xlsxHeaderRow(offHours, ['User', 'Role', 'Time', 'IP']);
    data.off_hours_logins.forEach(l => offHours.addRow([l.user_name || l.email_attempted || 'unknown', l.user_role || '-', new Date(l.created_at).toLocaleString('en-GB'), l.ip_address || '-']));
  }
  return wb.xlsx.writeBuffer();
};

const buildPermissionChangeDocx = async (data) => {
  const title = docxTitleBlock('Permission-Change Log', periodLabel(data));
  const table = docxTable(
    ['Date', 'Action', 'Changed By', 'Role', 'Description'],
    data.changes.map(c => [new Date(c.created_at).toLocaleString('en-GB'), c.action, c.actor_name || 'Unknown', c.actor_role || '-', c.description || '-'])
  );
  return buildDocx(title, [table]);
};

const buildPermissionChangeXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Permission Changes');
  sheet.columns = [{ width: 20 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 50 }];
  xlsxHeaderRow(sheet, ['Date', 'Action', 'Changed By', 'Role', 'Description']);
  data.changes.forEach(c => sheet.addRow([new Date(c.created_at).toLocaleString('en-GB'), c.action, c.actor_name || 'Unknown', c.actor_role || '-', c.description || '-']));
  return wb.xlsx.writeBuffer();
};

const buildCashierPerformanceDocx = async (data) => {
  const title = docxTitleBlock('Cashier / Verifier Performance', periodLabel(data));
  const table = docxTable(
    ['Staff Member', 'Role', 'Verified Count', 'Total Amount (GHS)'],
    data.staff.map(s => [s.staff_name, s.role, s.total_verified, s.total_amount_verified.toFixed(2)])
  );
  return buildDocx(title, [table]);
};

const buildCashierPerformanceXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Cashier Performance');
  sheet.columns = [{ width: 22 }, { width: 16 }, { width: 16 }, { width: 20 }];
  xlsxHeaderRow(sheet, ['Staff Member', 'Role', 'Verified Count', 'Total Amount (GHS)']);
  data.staff.forEach(s => sheet.addRow([s.staff_name, s.role, s.total_verified, s.total_amount_verified]));
  return wb.xlsx.writeBuffer();
};

const buildTrueMarginDocx = async (data) => {
  const title = docxTitleBlock('True Margin per Product', 'Last ' + data.period + ' days');
  const body = [];
  if (data.products_missing_cost?.length) {
    body.push(new Paragraph({
      children: [new TextRun({ text: data.products_missing_cost.length + ' product(s) sold with no cost_price set — shown separately below, not included in margin totals.', color: 'CC7A00', bold: true, size: 18 })],
      spacing: { after: 200 },
    }));
  }
  body.push(docxTable(
    ['Product', 'Category', 'Units Sold', 'Revenue', 'Cost', 'Margin', 'Margin %'],
    data.products.map(p => [p.name, p.category || '-', p.units_sold, p.revenue.toFixed(2), p.cost.toFixed(2), p.margin.toFixed(2), p.margin_percent.toFixed(1) + '%'])
  ));
  if (data.products_missing_cost?.length) {
    body.push(
      new Paragraph({ text: '', spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: 'Missing Cost Price', bold: true, size: 24 })], spacing: { after: 150 } }),
      docxTable(
        ['Product', 'Category', 'Units Sold', 'Revenue'],
        data.products_missing_cost.map(p => [p.name, p.category || '-', p.units_sold, p.revenue.toFixed(2)])
      )
    );
  }
  return buildDocx(title, body);
};

const buildTrueMarginXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('True Margin');
  sheet.columns = [{ width: 24 }, { width: 16 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }];
  xlsxHeaderRow(sheet, ['Product', 'Category', 'Units Sold', 'Revenue', 'Cost', 'Margin', 'Margin %']);
  data.products.forEach(p => sheet.addRow([p.name, p.category || '-', p.units_sold, p.revenue, p.cost, p.margin, p.margin_percent]));

  if (data.products_missing_cost?.length) {
    const missing = wb.addWorksheet('Missing Cost Price');
    missing.columns = [{ width: 24 }, { width: 16 }, { width: 12 }, { width: 14 }];
    xlsxHeaderRow(missing, ['Product', 'Category', 'Units Sold', 'Revenue']);
    data.products_missing_cost.forEach(p => missing.addRow([p.name, p.category || '-', p.units_sold, p.revenue]));
  }
  return wb.xlsx.writeBuffer();
};

const buildCashFlowDocx = async (data) => {
  const title = docxTitleBlock('Cash Flow Statement', periodLabel(data));
  const summaryTable = docxTable(
    ['Line', 'Amount (GHS)'],
    [
      ['Cash In (verified collections)', data.cash_in.toFixed(2)],
      ['Cash Out (expenses)', '(' + data.cash_out.toFixed(2) + ')'],
      ['Net Cash Flow', data.net_cash_flow.toFixed(2)],
    ]
  );
  const body = [summaryTable];
  if (data.cash_out_by_category?.length) {
    body.push(
      new Paragraph({ text: '', spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: 'Cash Out by Category', bold: true, size: 24 })], spacing: { after: 150 } }),
      docxTable(
        ['Category', 'Amount (GHS)'],
        data.cash_out_by_category.map(c => [c.category, parseFloat(c.total).toFixed(2)])
      )
    );
  }
  return buildDocx(title, body);
};

const buildCashFlowXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 28 }, { width: 18 }];
  xlsxHeaderRow(summary, ['Line', 'Amount (GHS)']);
  [
    ['Cash In (verified collections)', data.cash_in],
    ['Cash Out (expenses)', -data.cash_out],
    ['Net Cash Flow', data.net_cash_flow],
  ].forEach(r => summary.addRow(r));

  const byCategory = wb.addWorksheet('Cash Out by Category');
  byCategory.columns = [{ width: 24 }, { width: 18 }];
  xlsxHeaderRow(byCategory, ['Category', 'Amount (GHS)']);
  data.cash_out_by_category.forEach(c => byCategory.addRow([c.category, parseFloat(c.total)]));
  return wb.xlsx.writeBuffer();
};

const buildCashRunwayDocx = async (data) => {
  const title = docxTitleBlock('Cash Runway', 'Burn rate window: ' + periodLabel(data));
  const summaryTable = docxTable(
    ['Metric', 'Value'],
    [
      ['Cash on Hand (all-time)', 'GHS ' + data.cash_on_hand.toFixed(2)],
      ['Status', data.is_burning ? 'Burning cash' : 'Not burning (flat or growing)'],
      ['Daily Burn Rate', 'GHS ' + data.daily_burn_rate.toFixed(2)],
      ['Monthly Burn Rate', 'GHS ' + data.monthly_burn_rate.toFixed(2)],
      ['Runway', data.runway_days !== null ? Math.round(data.runway_days) + ' days (~' + data.runway_months.toFixed(1) + ' months)' : 'N/A — not burning'],
    ]
  );
  const windowTable = docxTable(
    ['Line', 'Amount (GHS)'],
    [
      ['Cash In (window)', data.window_cash_in.toFixed(2)],
      ['Cash Out (window)', '(' + data.window_cash_out.toFixed(2) + ')'],
      ['Net Cash Flow (window)', data.net_window_cash_flow.toFixed(2)],
    ]
  );
  const body = [
    summaryTable,
    new Paragraph({ text: '', spacing: { after: 300 } }),
    new Paragraph({ children: [new TextRun({ text: 'Burn Rate Window (' + data.window_days + ' days)', bold: true, size: 24 })], spacing: { after: 150 } }),
    windowTable,
  ];
  if (!data.cost_price_includes_landed_cost) {
    body.push(
      new Paragraph({ text: '', spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: 'Note: import expenses are excluded from cash-out to avoid double-counting with product cost price (per Report Settings).', italics: true, size: 18, color: '666666' })] })
    );
  }
  return buildDocx(title, body);
};

const buildCashRunwayXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 28 }, { width: 20 }];
  xlsxHeaderRow(summary, ['Metric', 'Value']);
  [
    ['Cash on Hand (all-time, GHS)', data.cash_on_hand],
    ['Status', data.is_burning ? 'Burning cash' : 'Not burning (flat or growing)'],
    ['Daily Burn Rate (GHS)', data.daily_burn_rate],
    ['Monthly Burn Rate (GHS)', data.monthly_burn_rate],
    ['Runway (days)', data.runway_days !== null ? Math.round(data.runway_days) : 'N/A'],
    ['Runway (months)', data.runway_months !== null ? parseFloat(data.runway_months.toFixed(1)) : 'N/A'],
  ].forEach(r => summary.addRow(r));

  const windowSheet = wb.addWorksheet('Burn Rate Window (' + data.window_days + 'd)');
  windowSheet.columns = [{ width: 28 }, { width: 18 }];
  xlsxHeaderRow(windowSheet, ['Line', 'Amount (GHS)']);
  [
    ['Cash In (window)', data.window_cash_in],
    ['Cash Out (window)', -data.window_cash_out],
    ['Net Cash Flow (window)', data.net_window_cash_flow],
  ].forEach(r => windowSheet.addRow(r));
  return wb.xlsx.writeBuffer();
};

const buildReorderPointDocx = async (data) => {
  const title = docxTitleBlock('Reorder Point / Weeks of Supply', 'Sales velocity window: ' + periodLabel(data));
  const body = [];
  if (!data.lead_time_configured) {
    body.push(new Paragraph({
      children: [new TextRun({ text: 'avg_import_lead_time_days not set in Report Settings — reorder point uses safety stock only, with no lead-time buffer.', color: 'CC7A00', bold: true, size: 18 })],
      spacing: { after: 200 },
    }));
  }
  const summaryTable = docxTable(
    ['Metric', 'Value'],
    [
      ['Lead Time (days)', data.lead_time_days],
      ['Products Needing Reorder', data.needs_reorder_count],
      ['Products with No Recent Sales', data.no_sales_data_count],
    ]
  );
  const productsTable = docxTable(
    ['SKU', 'Product', 'Stock', 'Weeks of Supply', 'Reorder Point', 'Needs Reorder'],
    data.products.map(p => [
      p.sku || '-',
      p.name,
      p.stock_quantity,
      p.weeks_of_supply !== null ? p.weeks_of_supply.toFixed(1) : 'No sales data',
      p.reorder_point,
      p.needs_reorder ? 'YES' : 'No',
    ])
  );
  body.push(
    summaryTable,
    new Paragraph({ text: '', spacing: { after: 300 } }),
    new Paragraph({ children: [new TextRun({ text: 'All Products', bold: true, size: 24 })], spacing: { after: 150 } }),
    productsTable
  );
  return buildDocx(title, body);
};

const buildReorderPointXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 28 }, { width: 18 }];
  xlsxHeaderRow(summary, ['Metric', 'Value']);
  [
    ['Lead Time (days)', data.lead_time_days],
    ['Lead Time Configured', data.lead_time_configured ? 'Yes' : 'No — using safety stock only'],
    ['Products Needing Reorder', data.needs_reorder_count],
    ['Products with No Recent Sales', data.no_sales_data_count],
  ].forEach(r => summary.addRow(r));

  const products = wb.addWorksheet('Products');
  products.columns = [
    { width: 14 }, { width: 26 }, { width: 16 }, { width: 12 },
    { width: 16 }, { width: 14 }, { width: 14 },
  ];
  xlsxHeaderRow(products, ['SKU', 'Product', 'Category', 'Stock', 'Weeks of Supply', 'Reorder Point', 'Needs Reorder']);
  data.products.forEach(p => products.addRow([
    p.sku || '-',
    p.name,
    p.category || '-',
    p.stock_quantity,
    p.weeks_of_supply !== null ? parseFloat(p.weeks_of_supply.toFixed(1)) : 'No sales data',
    p.reorder_point,
    p.needs_reorder ? 'YES' : 'No',
  ]));
  return wb.xlsx.writeBuffer();
};

const buildSupplierScorecardDocx = async (data) => {
  const title = docxTitleBlock('Supplier Scorecard', periodLabel(data));
  const table = docxTable(
    ['Supplier', 'Country', 'Shipments', 'On-Time %', 'Cost Variance %', 'PO Cancel %', 'Score'],
    data.suppliers.map(s => [
      s.name,
      s.country || '-',
      s.total_shipments,
      s.on_time_rate !== null ? s.on_time_rate.toFixed(1) + '%' : 'No data',
      s.cost_variance_pct !== null ? (s.cost_variance_pct >= 0 ? '+' : '') + s.cost_variance_pct.toFixed(1) + '%' : 'No data',
      s.po_cancellation_rate !== null ? s.po_cancellation_rate.toFixed(1) + '%' : 'No data',
      s.overall_score !== null ? s.overall_score.toFixed(0) : '-',
    ])
  );
  return buildDocx(title, [
    new Paragraph({ children: [new TextRun({ text: 'Note: Score averages only the dimensions with real data for that supplier — a supplier with no purchase order history isn\'t penalized on PO Cancel %.', italics: true, size: 18, color: '666666' })], spacing: { after: 200 } }),
    table,
  ]);
};

const buildSupplierScorecardXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Supplier Scorecard');
  sheet.columns = [
    { width: 24 }, { width: 14 }, { width: 12 }, { width: 12 },
    { width: 16 }, { width: 14 }, { width: 10 },
  ];
  xlsxHeaderRow(sheet, ['Supplier', 'Country', 'Shipments', 'On-Time %', 'Cost Variance %', 'PO Cancel %', 'Score']);
  data.suppliers.forEach(s => sheet.addRow([
    s.name,
    s.country || '-',
    s.total_shipments,
    s.on_time_rate !== null ? parseFloat(s.on_time_rate.toFixed(1)) : 'No data',
    s.cost_variance_pct !== null ? parseFloat(s.cost_variance_pct.toFixed(1)) : 'No data',
    s.po_cancellation_rate !== null ? parseFloat(s.po_cancellation_rate.toFixed(1)) : 'No data',
    s.overall_score !== null ? Math.round(s.overall_score) : '-',
  ]));
  return wb.xlsx.writeBuffer();
};

const buildCustomerAnalyticsDocx = async (data) => {
  const title = docxTitleBlock('Customer Analytics', 'New-customer window: ' + periodLabel(data));
  const summaryTable = docxTable(
    ['Metric', 'Value'],
    [
      ['Total Customers', data.total_customers],
      ['Customers with Orders', data.customers_with_orders],
      ['Repeat Customer Rate', data.repeat_rate !== null ? data.repeat_rate.toFixed(1) + '%' : 'N/A'],
      ['Average LTV', 'GHS ' + data.avg_ltv.toFixed(2)],
      ['At-Risk Customers (>' + data.at_risk_days + ' days since last order)', data.at_risk_count],
      ['New Customers in Window', data.new_customers_in_period],
    ]
  );
  const customersTable = docxTable(
    ['Customer', 'Orders', 'Total Spent', 'Avg Order', 'Days Since Last Order', 'Status'],
    data.customers.filter(c => c.has_ordered).slice(0, 100).map(c => [
      c.name,
      c.total_orders,
      'GHS ' + c.total_spent.toFixed(2),
      'GHS ' + c.avg_order_value.toFixed(2),
      c.days_since_last_order !== null ? c.days_since_last_order : '-',
      c.is_at_risk ? 'At Risk' : (c.is_repeat_customer ? 'Repeat' : 'One-time'),
    ])
  );
  const body = [
    summaryTable,
    new Paragraph({ text: '', spacing: { after: 300 } }),
    new Paragraph({ children: [new TextRun({ text: 'Top Customers by Lifetime Value', bold: true, size: 24 })], spacing: { after: 150 } }),
    customersTable,
  ];
  if (data.customers.filter(c => c.has_ordered).length > 100) {
    body.push(new Paragraph({
      children: [new TextRun({ text: 'Showing top 100 of ' + data.customers.filter(c => c.has_ordered).length + ' customers with orders. Full list available in the Excel export.', italics: true, size: 18, color: '666666' })],
      spacing: { before: 200 },
    }));
  }
  return buildDocx(title, body);
};

const buildCustomerAnalyticsXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 34 }, { width: 18 }];
  xlsxHeaderRow(summary, ['Metric', 'Value']);
  [
    ['Total Customers', data.total_customers],
    ['Customers with Orders', data.customers_with_orders],
    ['Repeat Customer Rate (%)', data.repeat_rate !== null ? parseFloat(data.repeat_rate.toFixed(1)) : 'N/A'],
    ['Average LTV (GHS)', parseFloat(data.avg_ltv.toFixed(2))],
    ['At-Risk Threshold (days)', data.at_risk_days],
    ['At-Risk Customers', data.at_risk_count],
    ['New Customers in Window', data.new_customers_in_period],
  ].forEach(r => summary.addRow(r));

  const customers = wb.addWorksheet('Customers');
  customers.columns = [
    { width: 26 }, { width: 16 }, { width: 10 }, { width: 14 },
    { width: 14 }, { width: 12 }, { width: 12 }, { width: 12 },
  ];
  xlsxHeaderRow(customers, ['Name', 'Phone', 'Orders', 'Total Spent', 'Avg Order', 'Days Since Last', 'Repeat', 'At Risk']);
  data.customers.forEach(c => customers.addRow([
    c.name,
    c.phone,
    c.total_orders,
    c.total_spent,
    c.avg_order_value,
    c.days_since_last_order !== null ? c.days_since_last_order : 'Never ordered',
    c.is_repeat_customer ? 'Yes' : 'No',
    c.is_at_risk ? 'Yes' : 'No',
  ]));
  return wb.xlsx.writeBuffer();
};

const TREND_LABELS = { growing: 'Growing', declining: 'Declining', stable: 'Stable', new_demand: 'New Demand', no_data: 'No Data' };

const buildDemandForecastDocx = async (data) => {
  const title = docxTitleBlock('Demand Forecast per SKU', periodLabel(data) + ' vs. prior equal period');
  const summaryTable = docxTable(
    ['Trend', 'Product Count'],
    Object.entries(data.trend_counts).map(([k, v]) => [TREND_LABELS[k], v])
  );
  const productsTable = docxTable(
    ['SKU', 'Product', 'This Period', 'Prior Period', 'Trend', 'Forecast Next Period'],
    data.products.map(p => [
      p.sku || '-',
      p.name,
      p.recent_units,
      p.prior_units,
      TREND_LABELS[p.trend] + (p.trend_pct !== null ? ' (' + (p.trend_pct >= 0 ? '+' : '') + p.trend_pct.toFixed(0) + '%)' : ''),
      p.forecast_units_next_period,
    ])
  );
  return buildDocx(title, [
    new Paragraph({ children: [new TextRun({ text: 'Forecast is a dampened trend projection (half the observed trend rate), not a guarantee — treat as a planning signal, not a committed number.', italics: true, size: 18, color: '666666' })], spacing: { after: 200 } }),
    summaryTable,
    new Paragraph({ text: '', spacing: { after: 300 } }),
    new Paragraph({ children: [new TextRun({ text: 'All Products', bold: true, size: 24 })], spacing: { after: 150 } }),
    productsTable,
  ]);
};

const buildDemandForecastXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 20 }, { width: 16 }];
  xlsxHeaderRow(summary, ['Trend', 'Product Count']);
  Object.entries(data.trend_counts).forEach(([k, v]) => summary.addRow([TREND_LABELS[k], v]));

  const products = wb.addWorksheet('Products');
  products.columns = [
    { width: 14 }, { width: 26 }, { width: 16 }, { width: 14 },
    { width: 12 }, { width: 12 }, { width: 18 },
  ];
  xlsxHeaderRow(products, ['SKU', 'Product', 'Category', 'This Period', 'Prior Period', 'Trend', 'Forecast Next Period']);
  data.products.forEach(p => products.addRow([
    p.sku || '-',
    p.name,
    p.category || '-',
    p.recent_units,
    p.prior_units,
    TREND_LABELS[p.trend],
    p.forecast_units_next_period,
  ]));
  return wb.xlsx.writeBuffer();
};

const NEW_PRODUCT_STATUS_LABELS = { too_early: 'Too Early to Judge', no_traction: 'No Traction', underperforming: 'Underperforming', performing: 'Performing' };

const buildNewProductScorecardDocx = async (data) => {
  const title = docxTitleBlock('New Product Scorecard', 'Launched in the last ' + data.new_product_days + ' days');
  const summaryTable = docxTable(
    ['Status', 'Product Count'],
    Object.entries(data.status_counts).map(([k, v]) => [NEW_PRODUCT_STATUS_LABELS[k], v])
  );
  const productsTable = docxTable(
    ['SKU', 'Product', 'Days Since Launch', 'Units Sold', 'Revenue', 'Weekly Velocity', 'Status'],
    data.products.map(p => [
      p.sku || '-',
      p.name,
      p.days_since_launch,
      p.units_sold_since_launch,
      'GHS ' + p.revenue_since_launch.toFixed(2),
      p.weekly_velocity.toFixed(1) + '/wk',
      NEW_PRODUCT_STATUS_LABELS[p.status],
    ])
  );
  return buildDocx(title, [
    new Paragraph({ children: [new TextRun({ text: 'Underperforming threshold: below ' + data.min_weekly_velocity + ' units/week. Products under 14 days old are marked "Too Early to Judge" rather than penalized for lack of data.', italics: true, size: 18, color: '666666' })], spacing: { after: 200 } }),
    summaryTable,
    new Paragraph({ text: '', spacing: { after: 300 } }),
    new Paragraph({ children: [new TextRun({ text: 'All New Products', bold: true, size: 24 })], spacing: { after: 150 } }),
    productsTable,
  ]);
};

const buildNewProductScorecardXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 24 }, { width: 16 }];
  xlsxHeaderRow(summary, ['Status', 'Product Count']);
  Object.entries(data.status_counts).forEach(([k, v]) => summary.addRow([NEW_PRODUCT_STATUS_LABELS[k], v]));

  const products = wb.addWorksheet('Products');
  products.columns = [
    { width: 14 }, { width: 26 }, { width: 16 }, { width: 16 },
    { width: 14 }, { width: 14 }, { width: 16 }, { width: 18 },
  ];
  xlsxHeaderRow(products, ['SKU', 'Product', 'Category', 'Days Since Launch', 'Units Sold', 'Revenue (GHS)', 'Weekly Velocity', 'Status']);
  data.products.forEach(p => products.addRow([
    p.sku || '-',
    p.name,
    p.category || '-',
    p.days_since_launch,
    p.units_sold_since_launch,
    p.revenue_since_launch,
    parseFloat(p.weekly_velocity.toFixed(1)),
    NEW_PRODUCT_STATUS_LABELS[p.status],
  ]));
  return wb.xlsx.writeBuffer();
};

const buildProductViabilityDocx = async (data) => {
  if (!data.ready) {
    return buildDocx(
      docxTitleBlock('Product Viability Survey', 'No calculation performed'),
      [new Paragraph({ children: [new TextRun({ text: 'This export was requested before a full proposal (category, cost price, selling price, quantity) was submitted. Fill out the form in the Reports Hub and try exporting again.', italics: true })] })]
    );
  }
  const title = docxTitleBlock('Product Viability Survey', 'Category: ' + data.input.category);
  const proposalTable = docxTable(
    ['Metric', 'Value'],
    [
      ['Cost Price', 'GHS ' + data.input.cost_price.toFixed(2)],
      ['Selling Price', 'GHS ' + data.input.selling_price.toFixed(2)],
      ['Initial Order Quantity', data.input.quantity],
      ['Margin per Unit', 'GHS ' + data.margin_per_unit.toFixed(2)],
      ['Margin %', data.margin_percent !== null ? data.margin_percent.toFixed(1) + '%' : '-'],
      ['Total Investment', 'GHS ' + data.total_investment.toFixed(2)],
      ['Units to Breakeven', data.units_to_breakeven !== null ? data.units_to_breakeven : 'N/A'],
      ['Est. Weeks to Sell Through', data.weeks_to_sell_through !== null ? data.weeks_to_sell_through.toFixed(1) : 'No category sales data'],
    ]
  );
  const benchmarkTable = docxTable(
    ['Metric', 'Your Proposal', 'Category Average (' + data.category_benchmark.product_count + ' products)'],
    [
      ['Selling Price', 'GHS ' + data.input.selling_price.toFixed(2), data.category_benchmark.avg_price !== null ? 'GHS ' + data.category_benchmark.avg_price.toFixed(2) : 'No data'],
      ['Margin %', data.margin_percent !== null ? data.margin_percent.toFixed(1) + '%' : '-', data.category_benchmark.avg_margin_percent !== null ? data.category_benchmark.avg_margin_percent.toFixed(1) + '%' : 'No data'],
    ]
  );
  const body = [
    proposalTable,
    new Paragraph({ text: '', spacing: { after: 300 } }),
    new Paragraph({ children: [new TextRun({ text: 'Category Benchmark', bold: true, size: 24 })], spacing: { after: 150 } }),
    benchmarkTable,
  ];
  if (data.risk_flags.length > 0) {
    body.push(
      new Paragraph({ text: '', spacing: { after: 300 } }),
      new Paragraph({ children: [new TextRun({ text: 'Things to Consider', bold: true, size: 24 })], spacing: { after: 150 } }),
      ...data.risk_flags.map(flag => new Paragraph({ children: [new TextRun({ text: '• ' + flag })], spacing: { after: 100 } }))
    );
  }
  return buildDocx(title, body);
};

const buildProductViabilityXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  if (!data.ready) {
    const sheet = wb.addWorksheet('Product Viability');
    sheet.addRow(['No calculation performed — fill out the form in the Reports Hub and try exporting again.']);
    return wb.xlsx.writeBuffer();
  }
  const proposal = wb.addWorksheet('Proposal');
  proposal.columns = [{ width: 28 }, { width: 20 }];
  xlsxHeaderRow(proposal, ['Metric', 'Value']);
  [
    ['Category', data.input.category],
    ['Cost Price (GHS)', data.input.cost_price],
    ['Selling Price (GHS)', data.input.selling_price],
    ['Initial Order Quantity', data.input.quantity],
    ['Margin per Unit (GHS)', parseFloat(data.margin_per_unit.toFixed(2))],
    ['Margin %', data.margin_percent !== null ? parseFloat(data.margin_percent.toFixed(1)) : 'N/A'],
    ['Total Investment (GHS)', data.total_investment],
    ['Units to Breakeven', data.units_to_breakeven !== null ? data.units_to_breakeven : 'N/A'],
    ['Est. Weeks to Sell Through', data.weeks_to_sell_through !== null ? parseFloat(data.weeks_to_sell_through.toFixed(1)) : 'No category sales data'],
  ].forEach(r => proposal.addRow(r));

  const benchmark = wb.addWorksheet('Category Benchmark');
  benchmark.columns = [{ width: 28 }, { width: 20 }];
  xlsxHeaderRow(benchmark, ['Metric', 'Value']);
  [
    ['Existing Products in Category', data.category_benchmark.product_count],
    ['Avg Price (GHS)', data.category_benchmark.avg_price !== null ? parseFloat(data.category_benchmark.avg_price.toFixed(2)) : 'No data'],
    ['Avg Margin %', data.category_benchmark.avg_margin_percent !== null ? parseFloat(data.category_benchmark.avg_margin_percent.toFixed(1)) : 'No data'],
    ['Avg Weekly Velocity (units)', parseFloat(data.category_benchmark.avg_weekly_velocity.toFixed(1))],
  ].forEach(r => benchmark.addRow(r));

  if (data.risk_flags.length > 0) {
    const risks = wb.addWorksheet('Things to Consider');
    risks.columns = [{ width: 90 }];
    xlsxHeaderRow(risks, ['Flag']);
    data.risk_flags.forEach(flag => risks.addRow([flag]));
  }
  return wb.xlsx.writeBuffer();
};

const buildManagerPerformanceDocx = async (data) => {
  const title = docxTitleBlock('Manager Performance', periodLabel(data));
  const body = [];
  body.push(new Paragraph({
    children: [new TextRun({ text: 'Based on cash dispute resolution activity — the one place manager-level resolution work is currently tracked. Not a complete measure of managerial performance.', italics: true, size: 18, color: '666666' })],
    spacing: { after: 200 },
  }));
  if (data.pending_disputes_count > 0) {
    body.push(new Paragraph({
      children: [new TextRun({ text: data.pending_disputes_count + ' cash dispute(s) currently unresolved, system-wide.', bold: true, color: 'CC7A00', size: 18 })],
      spacing: { after: 200 },
    }));
  }
  const table = docxTable(
    ['Manager', 'Disputes Resolved', 'Avg Resolution Time', 'Resolution Variance'],
    data.managers.map(m => [
      m.name,
      m.disputes_resolved,
      m.avg_resolution_hours !== null ? m.avg_resolution_hours.toFixed(1) + ' hrs' : 'No data',
      m.has_activity ? 'GHS ' + m.resolution_variance.toFixed(2) : '-',
    ])
  );
  body.push(table);
  return buildDocx(title, body);
};

const buildManagerPerformanceXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Manager Performance');
  sheet.columns = [{ width: 22 }, { width: 18 }, { width: 18 }, { width: 18 }];
  xlsxHeaderRow(sheet, ['Manager', 'Disputes Resolved', 'Avg Resolution Hours', 'Resolution Variance (GHS)']);
  data.managers.forEach(m => sheet.addRow([
    m.name,
    m.disputes_resolved,
    m.avg_resolution_hours !== null ? parseFloat(m.avg_resolution_hours.toFixed(1)) : 'No data',
    m.has_activity ? parseFloat(m.resolution_variance.toFixed(2)) : '-',
  ]));
  sheet.addRow([]);
  sheet.addRow(['Pending disputes (system-wide, unresolved)', data.pending_disputes_count]);
  return wb.xlsx.writeBuffer();
};

const buildVatEstimateDocx = async (data) => {
  const title = docxTitleBlock('VAT & Levy Estimate', periodLabel(data));
  const body = [];
  if (data.unset_rates.length) {
    body.push(new Paragraph({
      children: [new TextRun({ text: 'Not set in Report Settings (treated as 0%): ' + data.unset_rates.join(', '), color: 'CC7A00', bold: true, size: 18 })],
      spacing: { after: 200 },
    }));
  }
  const summaryTable = docxTable(
    ['Line', 'Amount (GHS)'],
    [
      ['Gross Revenue (tax-inclusive)', data.gross_revenue.toFixed(2)],
      ['Net Base', data.net_base.toFixed(2)],
      ['Total Tax Estimate', data.total_tax_estimate.toFixed(2)],
    ]
  );
  const breakdownTable = docxTable(
    ['Levy', 'Rate', 'Amount (GHS)'],
    data.breakdown.map(b => [b.label, b.rate.toFixed(2) + '%', b.amount.toFixed(2)])
  );
  return buildDocx(title, [
    summaryTable,
    new Paragraph({ text: '', spacing: { after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: 'Breakdown by Levy', bold: true, size: 24 })], spacing: { after: 150 } }),
    breakdownTable,
    new Paragraph({ text: '', spacing: { after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: 'Note: Withholding tax is not estimated here — it applies to supplier/contractor payments, not sales revenue, and depends on payment type. Review separately with your accountant.', italics: true, size: 18, color: '666666' })] }),
  ]);
};

const buildVatEstimateXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('VAT & Levy Estimate');
  sheet.columns = [{ width: 24 }, { width: 14 }, { width: 18 }];
  xlsxHeaderRow(sheet, ['Line', 'Rate', 'Amount (GHS)']);
  sheet.addRow(['Gross Revenue (tax-inclusive)', '-', data.gross_revenue]);
  sheet.addRow(['Net Base', '-', data.net_base]);
  data.breakdown.forEach(b => sheet.addRow([b.label, b.rate + '%', b.amount]));
  sheet.addRow(['Total Tax Estimate', '-', data.total_tax_estimate]);
  if (data.unset_rates.length) {
    sheet.addRow([]);
    sheet.addRow(['Not set (treated as 0%): ' + data.unset_rates.join(', ')]);
  }
  return wb.xlsx.writeBuffer();
};

const buildUnitEconomicsDocx = async (data) => {
  const title = docxTitleBlock('Unit Economics per Order', periodLabel(data));
  const body = [];
  const warnings = [];
  if (!data.momo_fee_configured) warnings.push('momo_fee_percent not set — MoMo fee assumed 0');
  if (!data.rider_cost_configured) warnings.push('avg_rider_cost_per_delivery not set — rider cost assumed 0');
  if (warnings.length) {
    body.push(new Paragraph({
      children: [new TextRun({ text: warnings.join('; '), color: 'CC7A00', bold: true, size: 18 })],
      spacing: { after: 200 },
    }));
  }
  const summaryTable = docxTable(
    ['Metric', 'Avg per Order (GHS)'],
    [
      ['Revenue', data.avg_revenue.toFixed(2)],
      ['COGS', '(' + data.avg_cogs.toFixed(2) + ')'],
      ['MoMo Fee', '(' + data.avg_momo_fee.toFixed(2) + ')'],
      ['Rider Cost', '(' + data.avg_rider_cost.toFixed(2) + ')'],
      ['Net Profit per Order', data.avg_net_profit.toFixed(2)],
    ]
  );
  const byMethodTable = docxTable(
    ['Payment Method', 'Order Count', 'Avg Net Profit (GHS)'],
    data.by_payment_method.map(m => [m.payment_method, m.order_count, m.avg_net_profit.toFixed(2)])
  );
  return buildDocx(title, [
    summaryTable,
    new Paragraph({ text: '', spacing: { after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: 'By Payment Method', bold: true, size: 24 })], spacing: { after: 150 } }),
    byMethodTable,
  ]);
};

const buildUnitEconomicsXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 24 }, { width: 20 }];
  xlsxHeaderRow(summary, ['Metric', 'Avg per Order (GHS)']);
  [
    ['Revenue', data.avg_revenue],
    ['COGS', -data.avg_cogs],
    ['MoMo Fee', -data.avg_momo_fee],
    ['Rider Cost', -data.avg_rider_cost],
    ['Net Profit per Order', data.avg_net_profit],
  ].forEach(r => summary.addRow(r));

  const byMethod = wb.addWorksheet('By Payment Method');
  byMethod.columns = [{ width: 20 }, { width: 14 }, { width: 20 }];
  xlsxHeaderRow(byMethod, ['Payment Method', 'Order Count', 'Avg Net Profit (GHS)']);
  data.by_payment_method.forEach(m => byMethod.addRow([m.payment_method, m.order_count, m.avg_net_profit]));
  return wb.xlsx.writeBuffer();
};

// Flattens { date, orders: [{ ...order, items: [...] }] } into one row per
// line item, with order-level fields (order #, customer, phone, discount,
// delivery address) shown only on that order's first row and left blank on
// subsequent item rows for the same order — matches a print-style register.
const flattenDailySalesRegisterRows = (data) => {
  const rows = [];
  data.orders.forEach(o => {
    const items = o.items.length ? o.items : [{ product_name: '-', quantity: '', unit_price: '', total_price: '' }];
    items.forEach((item, idx) => {
      rows.push({
        order_number: idx === 0 ? o.order_number : '',
        customer_name: idx === 0 ? (o.customer_name || 'Walk-in') : '',
        customer_phone: idx === 0 ? (o.customer_phone || '-') : '',
        product_name: item.product_name || '-',
        quantity: item.quantity,
        unit_price: item.unit_price !== '' ? parseFloat(item.unit_price || 0).toFixed(2) : '',
        total_price: item.total_price !== '' ? parseFloat(item.total_price || 0).toFixed(2) : '',
        discount: idx === 0 ? parseFloat(o.discount || 0).toFixed(2) : '',
        delivery_address: idx === 0 ? (o.delivery_address || '-') : '',
      });
    });
  });
  return rows;
};

const buildDailySalesRegisterDocx = async (data) => {
  const s = data.summary;
  const title = docxTitleBlock('Daily Sales Register', data.date);
  const summaryTable = docxTable(
    ['Metric', 'Value'],
    [
      ['Total Orders', s.total_orders || 0],
      ['Total Items', s.total_items || 0],
      ['Total Revenue', 'GHS ' + parseFloat(s.total_revenue || 0).toFixed(2)],
      ['Total Discount', 'GHS ' + parseFloat(s.total_discount || 0).toFixed(2)],
    ]
  );
  const rows = flattenDailySalesRegisterRows(data);
  const itemsTable = docxTable(
    ['Order #', 'Customer', 'Phone', 'Product', 'Qty', 'Unit Price (GHS)', 'Line Total (GHS)', 'Discount (GHS)', 'Delivery Address'],
    rows.map(r => [r.order_number, r.customer_name, r.customer_phone, r.product_name, r.quantity, r.unit_price, r.total_price, r.discount, r.delivery_address])
  );
  const body = [
    summaryTable,
    new Paragraph({ text: '', spacing: { after: 300 } }),
    new Paragraph({ children: [new TextRun({ text: 'Orders & Line Items', bold: true, size: 24 })], spacing: { after: 150 } }),
    itemsTable,
  ];
  return buildDocx(title, body);
};

const buildDailySalesRegisterXlsx = async (data) => {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 22 }, { width: 20 }];
  xlsxHeaderRow(summary, ['Metric', 'Value']);
  const s = data.summary;
  [
    ['Date', data.date],
    ['Total Orders', s.total_orders || 0],
    ['Total Items', s.total_items || 0],
    ['Total Revenue (GHS)', parseFloat(s.total_revenue || 0)],
    ['Total Discount (GHS)', parseFloat(s.total_discount || 0)],
  ].forEach(r => summary.addRow(r));

  const detail = wb.addWorksheet('Line Items');
  detail.columns = [
    { width: 16 }, { width: 20 }, { width: 14 }, { width: 22 },
    { width: 8 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 30 },
  ];
  xlsxHeaderRow(detail, ['Order #', 'Customer', 'Phone', 'Product', 'Qty', 'Unit Price (GHS)', 'Line Total (GHS)', 'Discount (GHS)', 'Delivery Address']);
  flattenDailySalesRegisterRows(data).forEach(r => detail.addRow([
    r.order_number, r.customer_name, r.customer_phone, r.product_name,
    r.quantity, r.unit_price, r.total_price, r.discount, r.delivery_address,
  ]));

  return wb.xlsx.writeBuffer();
};

const REPORT_MAP = {
  revenue:       { getData: getRevenueData, docx: buildRevenueDocx, xlsx: buildRevenueXlsx, filename: 'revenue-report' },
  products:      { getData: getProductData, docx: buildProductsDocx, xlsx: buildProductsXlsx, filename: 'product-performance-report' },
  riders:        { getData: getRiderData, docx: buildRidersDocx, xlsx: buildRidersXlsx, filename: 'rider-performance-report' },
  pnl:           { getData: getPnLData, docx: buildPnLDocx, xlsx: buildPnLXlsx, filename: 'profit-and-loss-statement' },
  budget:        { getData: getBudgetVsActualData, docx: buildBudgetDocx, xlsx: buildBudgetXlsx, filename: 'budget-vs-actual' },
  'margin-trend': { getData: getMarginTrendData, docx: buildMarginTrendDocx, xlsx: buildMarginTrendXlsx, filename: 'margin-trend' },
  exceptions:    { getData: getExceptionsData, docx: buildExceptionsDocx, xlsx: buildExceptionsXlsx, filename: 'exceptions-report' },
  'audit-trail': { getData: getAuditTrailData, docx: buildAuditTrailDocx, xlsx: buildAuditTrailXlsx, filename: 'staff-audit-trail' },
  'cash-reconciliation': { getData: getCashReconciliationData, docx: buildCashReconciliationDocx, xlsx: buildCashReconciliationXlsx, filename: 'cash-reconciliation' },
  'login-anomalies': { getData: getLoginAnomaliesData, docx: buildLoginAnomaliesDocx, xlsx: buildLoginAnomaliesXlsx, filename: 'login-anomalies' },
  'permission-changes': { getData: getPermissionChangeData, docx: buildPermissionChangeDocx, xlsx: buildPermissionChangeXlsx, filename: 'permission-change-log' },
  'cashier-performance': { getData: getCashierPerformanceData, docx: buildCashierPerformanceDocx, xlsx: buildCashierPerformanceXlsx, filename: 'cashier-performance' },
  'true-margin': { getData: getTrueMarginData, docx: buildTrueMarginDocx, xlsx: buildTrueMarginXlsx, filename: 'true-margin-per-product' },
  'cash-flow':   { getData: getCashFlowData, docx: buildCashFlowDocx, xlsx: buildCashFlowXlsx, filename: 'cash-flow-statement' },
  'cash-runway': { getData: getCashRunwayData, docx: buildCashRunwayDocx, xlsx: buildCashRunwayXlsx, filename: 'cash-runway' },
  'reorder-point': { getData: getReorderPointData, docx: buildReorderPointDocx, xlsx: buildReorderPointXlsx, filename: 'reorder-point-weeks-of-supply' },
  'supplier-scorecard': { getData: getSupplierScorecardData, docx: buildSupplierScorecardDocx, xlsx: buildSupplierScorecardXlsx, filename: 'supplier-scorecard' },
  'customer-analytics': { getData: getCustomerAnalyticsData, docx: buildCustomerAnalyticsDocx, xlsx: buildCustomerAnalyticsXlsx, filename: 'customer-analytics' },
  'demand-forecast': { getData: getDemandForecastData, docx: buildDemandForecastDocx, xlsx: buildDemandForecastXlsx, filename: 'demand-forecast' },
  'new-product-scorecard': { getData: getNewProductScorecardData, docx: buildNewProductScorecardDocx, xlsx: buildNewProductScorecardXlsx, filename: 'new-product-scorecard' },
  'product-viability': { getData: getProductViabilityData, docx: buildProductViabilityDocx, xlsx: buildProductViabilityXlsx, filename: 'product-viability-survey' },
  'manager-performance': { getData: getManagerPerformanceData, docx: buildManagerPerformanceDocx, xlsx: buildManagerPerformanceXlsx, filename: 'manager-performance' },
  'vat-estimate': { getData: getVatEstimateData, docx: buildVatEstimateDocx, xlsx: buildVatEstimateXlsx, filename: 'vat-levy-estimate' },
  'unit-economics': { getData: getUnitEconomicsData, docx: buildUnitEconomicsDocx, xlsx: buildUnitEconomicsXlsx, filename: 'unit-economics-per-order' },
  'daily-sales-register': { getData: getDailySalesRegisterData, docx: buildDailySalesRegisterDocx, xlsx: buildDailySalesRegisterXlsx, filename: 'daily-sales-register' },
};

const exportReport = async (req, res) => {
  const { reportType } = req.params;
  const { format } = req.query;

  const config = REPORT_MAP[reportType];
  if (!config) {
    return res.status(400).json({ success: false, message: 'Unknown report type: ' + reportType });
  }
  if (format !== 'docx' && format !== 'xlsx') {
    return res.status(400).json({ success: false, message: 'format must be docx or xlsx' });
  }

  try {
    const data = await config.getData(req.query);
    const buffer = format === 'docx' ? await config.docx(data) : await config.xlsx(data);

    const mimeType = format === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'attachment; filename="' + config.filename + '-' + Date.now() + '.' + format + '"');
    res.send(buffer);
  } catch (error) {
    console.error('exportReport error:', error);
    res.status(500).json({ success: false, message: 'Server error generating export' });
  }
};

module.exports = { exportReport };
