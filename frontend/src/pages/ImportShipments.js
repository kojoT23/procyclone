import React, { useState, useEffect, useCallback } from 'react';
import { importsAPI, businessProfileAPI } from '../utils/api';
import ShipmentModal from './imports/ShipmentModal';
import QuickLinksBar from './QuickLinksBar';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

const STATUSES = ['planning', 'ordered', 'shipped', 'received', 'cancelled'];
const NEXT_STATUS = { planning: 'ordered', ordered: 'shipped', shipped: 'received' };
const NEXT_LABEL = { planning: 'Mark Ordered', ordered: 'Mark Shipped', shipped: 'Mark Received' };
const statusColors = { planning: '#6b7280', ordered: '#3b82f6', shipped: '#f59e0b', received: '#22c55e', cancelled: '#ef4444' };
const healthDot = { excellent: '🟢', good: '🟡', low: '🟠', loss: '🔴' };

const ALLOWED_ROLES = ['super_admin', 'admin', 'manager', 'accountant'];

const fmt = (n) => `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

export default function ImportShipments() {
  const { user } = useAuth();
  const [tab, setTab] = useState('shipments');
  const [shipments, setShipments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [hsCodeFilter, setHsCodeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [modalShipment, setModalShipment] = useState(undefined); // undefined = closed, null = new, object = edit
  const [showHelp, setShowHelp] = useState(false);
  const [confirmingStock, setConfirmingStock] = useState(null); // shipment being stock-confirmed
  const [busyId, setBusyId] = useState(null);
  const [businessProfile, setBusinessProfile] = useState(null);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (hsCodeFilter.trim()) params.hs_code = hsCodeFilter.trim();
      const res = await importsAPI.getAll(params);
      if (res.data.success) { setShipments(res.data.shipments); setPages(res.data.pages); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [page, statusFilter, hsCodeFilter]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await importsAPI.getSummary();
      if (res.data.success) setSummary(res.data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchShipments(); fetchSummary(); }, [fetchShipments, fetchSummary]);
  useEffect(() => { businessProfileAPI.get().then(res => setBusinessProfile(res.data.profile)).catch(() => {}); }, []);

  const advanceStatus = async (shipment) => {
    const next = NEXT_STATUS[shipment.status];
    if (!next) return;
    if (next === 'received' && !window.confirm(
      `Mark shipment #${shipment.id} as received? This locks costs and creates a linked expense. You'll separately confirm actual stock quantities afterward.`
    )) return;
    setBusyId(shipment.id);
    try {
      const res = await importsAPI.updateStatus(shipment.id, { status: next });
      if (!res.data.success) alert(res.data.message);
      fetchShipments(); fetchSummary();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not update status');
    } finally { setBusyId(null); }
  };

  const cancelShipment = async (shipment) => {
    if (!window.confirm(`Cancel shipment #${shipment.id}? This can't be undone.`)) return;
    setBusyId(shipment.id);
    try { await importsAPI.updateStatus(shipment.id, { status: 'cancelled' }); fetchShipments(); fetchSummary(); }
    catch (e) { alert(e.response?.data?.message || 'Could not cancel'); }
    finally { setBusyId(null); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this shipment?')) return;
    try {
      const res = await importsAPI.delete(id);
      if (res.data.success) { fetchShipments(); fetchSummary(); } else alert(res.data.message);
    } catch (e) { alert(e.response?.data?.message || 'Could not delete'); }
  };

  const handleExportExcel = () => {
    // Shipment-level export — per-product line-item export isn't included
    // in this pass to keep scope honest; say the word if you want that too.
    const rows = shipments.map(s => ({
      'Shipment #': s.id,
      'Supplier': s.supplier_name || '',
      'Products': s.item_count,
      'Status': s.status,
      'Budgeted (GHS)': parseFloat(s.budgeted_total).toFixed(2),
      'Actual (GHS)': s.status === 'received' ? parseFloat(s.actual_total).toFixed(2) : '',
      'Projected Revenue (GHS)': parseFloat(s.projected_revenue).toFixed(2),
      'Projected Profit (GHS)': parseFloat(s.projected_profit).toFixed(2),
      'Health': s.health || '',
      'Stock Confirmed': s.stock_confirmed_at ? 'Yes' : (s.status === 'received' ? 'No' : ''),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shipments');
    XLSX.writeFile(wb, `import_shipments_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Opens a formatted, printable detail sheet for a single shipment in
  // a new tab and triggers the browser's print dialog — the person can
  // pick "Save as PDF" as the destination to get a record-keeping copy,
  // or print it physically. No new library needed; this is the same
  // mechanism as the existing page-level Print button, just scoped to
  // one shipment with full item/cost detail.
  const fmtMoney = (n) => `GH₵ ${parseFloat(n || 0).toFixed(2)}`;

  const handlePrintShipment = async (shipmentSummary) => {
    // Open the window IMMEDIATELY, before any await — pop-up blockers
    // only allow window.open() when it happens synchronously inside
    // the click handler. Fetching data first and opening the window
    // afterward (even a few ms later) gets treated as a programmatic
    // pop-up and blocked, regardless of the site's pop-up permission.
    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups for this site, then try again.'); return; }
    win.document.write('<p style="font-family: -apple-system, Arial, sans-serif; padding: 32px; color: #6b7280;">Loading shipment details…</p>');

    setBusyId(shipmentSummary.id);
    try {
      const res = await importsAPI.getOne(shipmentSummary.id);
      const s = res.data.shipment;

      const itemRows = (s.items || []).map(i => `
        <tr>
          <td>${i.product_name || ''}</td>
          <td>${i.hs_code || '—'}</td>
          <td style="text-align:right">${i.quantity_ordered}</td>
          <td style="text-align:right">${fmtMoney(i.purchase_unit_price)}</td>
          <td style="text-align:right">${fmtMoney(i.unit_cost ?? i.landed_cost_per_unit ?? 0)}</td>
          <td style="text-align:right">${fmtMoney(i.expected_selling_price_per_unit)}</td>
          <td style="text-align:right">${(i.carton_length_cm && i.carton_width_cm && i.carton_height_cm) ? `${i.carton_length_cm}×${i.carton_width_cm}×${i.carton_height_cm}` : '—'}</td>
          <td style="text-align:right">${i.carton_weight_kg || '—'}</td>
          <td style="text-align:right">${i.cartons_qty || '—'}</td>
        </tr>`).join('');

      const costRows = [
        ['Shipping', s.shipping_cost], ['Customs Duty', s.customs_duty],
        ['Clearing Agent Fee', s.clearing_agent_fee], ['Inland Transport', s.inland_transport_cost],
        ['Other Fees', s.other_fees],
      ].map(([label, val]) => `<tr><td>${label}</td><td style="text-align:right">${fmtMoney(val)}</td></tr>`).join('');

      const actualCostRows = s.status === 'received' ? [
        ['Actual Shipping', s.actual_shipping_cost], ['Actual Customs Duty', s.actual_customs_duty],
        ['Actual Clearing Agent Fee', s.actual_clearing_agent_fee], ['Actual Inland Transport', s.actual_inland_transport_cost],
        ['Actual Other Fees', s.actual_other_fees],
      ].filter(([, v]) => v != null).map(([label, val]) => `<tr><td>${label}</td><td style="text-align:right">${fmtMoney(val)}</td></tr>`).join('') : '';

      const customCostRows = (s.cost_items || []).length > 0
        ? (s.cost_items || []).map(c => `<tr><td>${c.label}</td><td style="text-align:right">${fmtMoney(c.amount)}</td></tr>`).join('')
        : '';

      const rateRows = [
        ['Import Duty %', s.duty_rate_pct], ['ECOWAS Levy %', s.ecowas_levy_pct], ['AU Levy %', s.au_levy_pct],
        ['EXIM Levy %', s.exim_levy_pct], ['Processing Fee %', s.processing_fee_pct],
        ['VAT %', s.vat_pct], ['NHIL %', s.nhil_pct], ['GETFund %', s.getfund_pct],
      ].filter(([, v]) => v != null).map(([label, val]) => `<tr><td>${label}</td><td style="text-align:right">${parseFloat(val).toFixed(2)}%</td></tr>`).join('');

      win.document.write(`
        <html>
        <head>
          <title>Shipment #${s.id}${s.name ? ` — ${s.name}` : ''}</title>
          <style>
            body { font-family: -apple-system, Arial, sans-serif; padding: 32px; color: #1a1a18; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            h2 { font-size: 13px; text-transform: uppercase; color: #6b7280; margin: 24px 0 8px; }
            .meta { color: #6b7280; font-size: 13px; margin: 0 0 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th, td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
            th { color: #6b7280; font-size: 11px; text-transform: uppercase; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
            .total-row td { font-weight: 700; border-top: 2px solid #1a1a18; }
            .brand-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #1a1a18; }
            .brand-logo { width: 44px; height: 44px; border-radius: 10px; background: #1a1a18; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; flex-shrink: 0; }
            .brand-name { font-size: 17px; font-weight: 800; margin: 0; }
            .brand-sub { font-size: 12px; color: #6b7280; margin: 1px 0 0; }
            .notes-box { background: #f9f9f8; border-radius: 8px; padding: 10px 12px; font-size: 13px; white-space: pre-wrap; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="brand-header">
            <div class="brand-logo">SW</div>
            <div>
              <p class="brand-name">Shorewinds</p>
              ${businessProfile?.address ? `<p class="brand-sub">${businessProfile.address}</p>` : ''}
              ${businessProfile?.phone ? `<p class="brand-sub">${businessProfile.phone}</p>` : ''}
            </div>
          </div>

          <h1>Shipment #${s.id}${s.name ? ` — ${s.name}` : ''}</h1>
          <p class="meta">
            Supplier: ${s.supplier_name || '—'} · Status: ${s.status} · Created: ${new Date(s.created_at).toLocaleDateString('en-GB')}
            ${s.expected_arrival ? ` · Expected Arrival: ${new Date(s.expected_arrival).toLocaleDateString('en-GB')}` : ''}
            <br/>Currency: ${s.purchase_currency}${s.purchase_currency !== 'GHS' ? ` (rate used: ${s.exchange_rate_used})` : ''}
            ${s.ucr_number ? ` · UCR: ${s.ucr_number}` : ''}${s.boe_number ? ` · BOE: ${s.boe_number}` : ''}
          </p>

          <h2>Products</h2>
          <table>
            <thead><tr>
              <th>Product</th><th>HS Code</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price</th>
              <th style="text-align:right">Landed Cost/Unit</th><th style="text-align:right">Sell Price</th>
              <th style="text-align:right">L×W×H (cm)</th><th style="text-align:right">Wt/Carton</th><th style="text-align:right">Cartons</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
          </table>

          <div class="grid">
            <div>
              <h2>Budgeted Costs</h2>
              <table><tbody>${costRows}${customCostRows}
                <tr class="total-row"><td>Total Budgeted</td><td style="text-align:right">${fmtMoney(s.budgeted_total)}</td></tr>
              </tbody></table>
            </div>
            ${actualCostRows ? `
            <div>
              <h2>Actual Costs</h2>
              <table><tbody>${actualCostRows}
                <tr class="total-row"><td>Total Actual</td><td style="text-align:right">${fmtMoney(s.actual_total)}</td></tr>
              </tbody></table>
            </div>` : ''}
          </div>

          ${rateRows ? `
          <h2>Duty & Levy Rates Applied</h2>
          <table><tbody>${rateRows}</tbody></table>` : ''}

          ${s.notes ? `
          <h2>Notes</h2>
          <div class="notes-box">${s.notes}</div>` : ''}

          <h2>Summary</h2>
          <table><tbody>
            <tr><td>Projected Revenue</td><td style="text-align:right">${fmtMoney(s.projected_revenue)}</td></tr>
            <tr><td>Projected Profit</td><td style="text-align:right">${fmtMoney(s.projected_profit)}</td></tr>
          </tbody></table>
        </body>
        </html>
      `);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    } catch (err) {
      win.document.body.innerHTML = `<p style="font-family: -apple-system, Arial, sans-serif; padding: 32px; color: #ef4444;">Error loading shipment details: ${err.response?.data?.message || 'please close this tab and try again'}</p>`;
    } finally {
      setBusyId(null);
    }
  };

  if (!ALLOWED_ROLES.includes(user?.role)) {
    return (
      <div className="empty-state" style={{ minHeight: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <h3>No access</h3>
        <p>This page is for admin, manager, and accounting staff only.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Shorewinds Imports</h1>
            <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 14 }}>Budget shipments, track them through customs, and see real profit per product</p>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            title="How to use this page"
            style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
          >
            ?
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => window.print()}>🖨️ Print</button>
          <button className="btn" onClick={handleExportExcel}>📊 Export Excel</button>
          <button className="btn btn-primary" onClick={() => setModalShipment(null)}>+ New Shipment</button>
        </div>
      </div>

      <QuickLinksBar />

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab-btn${tab === 'shipments' ? ' active' : ''}`} onClick={() => setTab('shipments')}>Shipments</button>
        <button className={`tab-btn${tab === 'reports' ? ' active' : ''}`} onClick={() => setTab('reports')}>Reports</button>
      </div>

      {/* ── Summary — one compact table instead of a wall of cards ── */}
      <table style={{ width: '100%', marginBottom: 20, background: '#f9fafb', borderRadius: 8 }}>
        <tbody>
          <tr style={{ fontSize: 12, color: '#6b7280', textAlign: 'left' }}>
            <th style={{ padding: '10px 12px' }}>Total Budgeted</th>
            <th style={{ padding: '10px 12px' }}>Actual Spent</th>
            <th style={{ padding: '10px 12px' }}>Projected Profit</th>
            <th style={{ padding: '10px 12px' }}>Planning</th>
            <th style={{ padding: '10px 12px' }}>In Transit</th>
            <th style={{ padding: '10px 12px' }}>Received</th>
            <th style={{ padding: '10px 12px' }}>Awaiting Stock Confirm</th>
          </tr>
          <tr style={{ fontSize: 15, fontWeight: 700 }}>
            <td style={{ padding: '4px 12px 12px', color: '#f59e0b' }}>{fmt(summary?.total_budgeted)}</td>
            <td style={{ padding: '4px 12px 12px', color: '#ef4444' }}>{fmt(summary?.total_actual_spent)}</td>
            <td style={{ padding: '4px 12px 12px', color: (summary?.total_projected_profit ?? 0) >= 0 ? '#16a34a' : '#ef4444' }}>{fmt(summary?.total_projected_profit)}</td>
            <td style={{ padding: '4px 12px 12px' }}>{summary?.planning_count ?? 0}</td>
            <td style={{ padding: '4px 12px 12px' }}>{summary?.in_transit_count ?? 0}</td>
            <td style={{ padding: '4px 12px 12px' }}>{summary?.received_count ?? 0}</td>
            <td style={{ padding: '4px 12px 12px', color: (summary?.awaiting_stock_confirm_count ?? 0) > 0 ? '#d97706' : undefined }}>{summary?.awaiting_stock_confirm_count ?? 0}</td>
          </tr>
        </tbody>
      </table>

      {tab === 'shipments' ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <select className="form-input" style={{ width: 200 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="all">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select>
            <input
              className="form-input"
              style={{ width: 200 }}
              placeholder="Filter by HS code…"
              value={hsCodeFilter}
              onChange={e => { setHsCodeFilter(e.target.value); setPage(1); }}
            />
          </div>

          {loading ? <div className="loading" style={{ padding: 40 }}>Loading…</div> : shipments.length === 0 ? (
            <div className="empty-state" style={{ minHeight: 200 }}><p>No shipments yet</p></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '2px solid #f3f4f6', fontSize: 12, color: '#6b7280', textAlign: 'left' }}>
                <th style={{ padding: '10px 8px' }}>#</th>
                <th style={{ padding: '10px 8px' }}>Supplier</th>
                <th style={{ padding: '10px 8px' }}>Products</th>
                <th style={{ padding: '10px 8px' }}>Budgeted</th>
                <th style={{ padding: '10px 8px' }}>Actual</th>
                <th style={{ padding: '10px 8px' }}>Profit</th>
                <th style={{ padding: '10px 8px' }}>Health</th>
                <th style={{ padding: '10px 8px' }}>Status</th>
                <th style={{ padding: '10px 8px' }}></th>
              </tr></thead>
              <tbody>
                {shipments.map(s => {
                  const finalized = ['received', 'cancelled'].includes(s.status);
                  const needsStockConfirm = s.status === 'received' && !s.stock_confirmed_at;
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 600 }}>#{s.id}{s.name ? <div style={{ fontWeight: 400, fontSize: 12, color: '#6b7280' }}>{s.name}</div> : null}</td>
                      <td style={{ padding: '10px 8px' }}>{s.supplier_name || '—'}</td>
                      <td style={{ padding: '10px 8px' }}>{s.item_count} product{s.item_count !== 1 ? 's' : ''}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 600 }}>{fmt(s.budgeted_total)}</td>
                      <td style={{ padding: '10px 8px', color: s.status === 'received' ? '#ef4444' : '#9ca3af' }}>{s.status === 'received' ? fmt(s.actual_total) : '—'}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 600, color: (s.projected_profit ?? 0) >= 0 ? '#16a34a' : '#ef4444' }}>{fmt(s.projected_profit)}</td>
                      <td style={{ padding: '10px 8px' }}>{s.health ? healthDot[s.health] : '—'}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span className="badge" style={{ background: statusColors[s.status] + '20', color: statusColors[s.status], textTransform: 'capitalize' }}>{s.status}</span>
                        {needsStockConfirm && <div style={{ fontSize: 11, color: '#d97706', marginTop: 2 }}>⚠ stock not confirmed</div>}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setModalShipment(s)}>{finalized ? 'View' : 'Edit'}</button>
                          <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} disabled={busyId === s.id} onClick={() => handlePrintShipment(s)}>{busyId === s.id ? '…' : '🖨️ Details'}</button>
                          {NEXT_STATUS[s.status] && <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} disabled={busyId === s.id} onClick={() => advanceStatus(s)}>{NEXT_LABEL[s.status]}</button>}
                          {needsStockConfirm && <button className="btn" style={{ padding: '4px 10px', fontSize: 12, background: '#fef3c7', color: '#92400e' }} onClick={() => setConfirmingStock(s)}>Confirm Stock</button>}
                          {!finalized && <button className="btn" style={{ padding: '4px 10px', fontSize: 12, color: '#ef4444' }} disabled={busyId === s.id} onClick={() => cancelShipment(s)}>Cancel</button>}
                          {s.status !== 'received' && <button className="btn" style={{ padding: '4px 10px', fontSize: 12, color: '#ef4444' }} onClick={() => handleDelete(s.id)}>Delete</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
              <button className="btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ padding: '8px 16px', fontSize: 14 }}>Page {page} of {pages}</span>
              <button className="btn" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      ) : (
        <ReportsTab />
      )}

      {modalShipment !== undefined && (
        <ShipmentModal shipment={modalShipment} onClose={() => setModalShipment(undefined)} onSaved={() => { fetchShipments(); fetchSummary(); }} />
      )}
      {confirmingStock && (
        <ConfirmStockModal shipment={confirmingStock} onClose={() => setConfirmingStock(null)} onConfirmed={() => { setConfirmingStock(null); fetchShipments(); }} />
      )}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal" style={{ maxWidth: 640, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">How to use this page</h2>
              <button className="modal-close" onClick={() => setShowHelp(false)}>✕</button>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: '#374151' }}>
              <p><strong>1. Start a shipment</strong> — click "+ New Shipment" and add each product with quantity and purchase price. This is your budget before anything ships.</p>
              <p><strong>2. Freight Calculator</strong> — fill in each product's carton dimensions, weight, and count, then enter your forwarder's rate (per CBM or per kg) to get a suggested shipping cost. Click "Use as Shipping Cost" to apply it — nothing overwrites automatically.</p>
              <p><strong>3. Ghana Duty & Levy Estimator</strong> — pre-filled from your Settings defaults (Delivery & Pricing tab), covering Import Duty, ECOWAS/AU/EXIM levies, Processing Fee, VAT, NHIL, and GETFund. Override any rate per shipment if GRA updates it or your HS code differs. Click "Apply" to fill the Customs Duty and Clearing fields.</p>
              <p><strong>4. Track status</strong> — a shipment moves through <em>planning → shipped → received</em>. Once "received," you'll confirm actual stock per item (received/damaged/missing), which updates your inventory.</p>
              <p><strong>5. Actual Costs</strong> — once your clearing agent reports back what GRA actually charged, fill in the "Actual" fields to compare against your estimate. If you have the UCR/BOE numbers from ICUMS, record them here too — this app doesn't connect to ICUMS itself (it has no public API and requires licensed Customs House Agent status), these are just for your own records.</p>
              <p><strong>Quick Links</strong> — the row under the page title is a growing bookmark list (ICUMS, GRA, your forwarder's tracking page, etc.). Click "+ Add Link" to save any page you use often.</p>
              <p style={{ margin: 0 }}><strong>Reports tab</strong> — switch views by Product, Supplier, or Month to see totals and projected profit across all your shipments.</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => setShowHelp(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Confirm Stock modal — the second gate, per-item received/damaged/
   missing entry, only reachable once a shipment is 'received'. ── */
function ConfirmStockModal({ shipment, onClose, onConfirmed }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    importsAPI.getOne(shipment.id).then(res => {
      setItems((res.data.shipment.items || []).map(i => ({
        id: i.id, product_name: i.product_name || i.legacy_description || 'Unknown product',
        quantity_ordered: i.quantity_ordered,
        quantity_received: i.quantity_received ?? i.quantity_ordered,
        quantity_damaged: i.quantity_damaged || 0,
        quantity_missing: i.quantity_missing || 0,
      })));
      setLoading(false);
    }).catch(console.error);
  }, [shipment.id]);

  const update = (idx, patch) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const res = await importsAPI.confirmStock(shipment.id, { items: items.map(i => ({ id: i.id, quantity_received: parseInt(i.quantity_received) || 0, quantity_damaged: parseInt(i.quantity_damaged) || 0, quantity_missing: parseInt(i.quantity_missing) || 0 })) });
      if (res.data.success) { onConfirmed(); } else alert(res.data.message);
    } catch (e) { alert(e.response?.data?.message || 'Could not confirm stock'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <h2 style={{ marginTop: 0 }}>Confirm Stock — Shipment #{shipment.id}</h2>
        <p style={{ fontSize: 13, color: '#6b7280' }}>Enter what actually arrived. Usable quantity (received − damaged − missing) gets added to each product's real stock count. This can only be done once.</p>
        {loading ? <div className="loading">Loading…</div> : (
          <table style={{ width: '100%' }}>
            <thead><tr style={{ fontSize: 11, color: '#6b7280', textAlign: 'left' }}><th>Product</th><th>Ordered</th><th>Received</th><th>Damaged</th><th>Missing</th><th>Usable</th></tr></thead>
            <tbody>
              {items.map((item, idx) => {
                const usable = Math.max(0, (parseInt(item.quantity_received) || 0) - (parseInt(item.quantity_damaged) || 0) - (parseInt(item.quantity_missing) || 0));
                return (
                  <tr key={item.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 4px', fontSize: 13 }}>{item.product_name}</td>
                    <td style={{ padding: '6px 4px', fontSize: 13, color: '#9ca3af' }}>{item.quantity_ordered}</td>
                    <td style={{ padding: '6px 4px' }}><input className="form-input" style={{ width: 70, padding: '4px 6px' }} type="number" value={item.quantity_received} onChange={e => update(idx, { quantity_received: e.target.value })} /></td>
                    <td style={{ padding: '6px 4px' }}><input className="form-input" style={{ width: 70, padding: '4px 6px' }} type="number" value={item.quantity_damaged} onChange={e => update(idx, { quantity_damaged: e.target.value })} /></td>
                    <td style={{ padding: '6px 4px' }}><input className="form-input" style={{ width: 70, padding: '4px 6px' }} type="number" value={item.quantity_missing} onChange={e => update(idx, { quantity_missing: e.target.value })} /></td>
                    <td style={{ padding: '6px 4px', fontWeight: 700, color: '#16a34a' }}>{usable}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleConfirm} disabled={submitting || loading}>{submitting ? 'Confirming…' : 'Confirm & Add to Inventory'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Reports — three flat tables, with date filtering, totals, and export ── */
function ReportsTab() {
  const [type, setType] = useState('product');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = { type };
    if (startDate && endDate) { params.start_date = startDate; params.end_date = endDate; }
    importsAPI.getReports(params).then(res => setRows(res.data.rows || [])).catch(console.error).finally(() => setLoading(false));
  }, [type, startDate, endDate]);

  const fmtLocal = (n) => `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

  const totals = rows.reduce((acc, r) => {
    if (type === 'product') {
      acc.total_ordered = (acc.total_ordered || 0) + parseFloat(r.total_ordered || 0);
      acc.total_received = (acc.total_received || 0) + parseFloat(r.total_received || 0);
      acc.total_cost_purchase_currency = (acc.total_cost_purchase_currency || 0) + parseFloat(r.total_cost_purchase_currency || 0);
    } else {
      acc.shipment_count = (acc.shipment_count || 0) + parseFloat(r.shipment_count || 0);
      acc.total_actual_spent = (acc.total_actual_spent || 0) + parseFloat(r.total_actual_spent || 0);
      acc.total_projected_profit = (acc.total_projected_profit || 0) + parseFloat(r.total_projected_profit || 0);
    }
    return acc;
  }, {});

  const handleExportReport = () => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type);
    XLSX.writeFile(wb, `import_report_${type}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div className="tabs">
          {['product', 'supplier', 'monthly'].map(t => (
            <button key={t} className={`tab-btn${type === t ? ' active' : ''}`} onClick={() => setType(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" className="form-input" style={{ width: 150 }} value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span style={{ color: '#6b7280', fontSize: 12 }}>to</span>
          <input type="date" className="form-input" style={{ width: 150 }} value={endDate} onChange={e => setEndDate(e.target.value)} />
          {(startDate || endDate) && <button className="btn btn-sm" onClick={() => { setStartDate(''); setEndDate(''); }}>Clear</button>}
          <button className="btn" onClick={handleExportReport} disabled={rows.length === 0}>📊 Export</button>
        </div>
      </div>

      {loading ? <div className="loading">Loading…</div> : rows.length === 0 ? <div className="empty-state"><p>No data yet</p></div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '2px solid #f3f4f6', fontSize: 12, color: '#6b7280', textAlign: 'left' }}>
            {type === 'product' && <><th style={{ padding: 8 }}>Product</th><th>Ordered</th><th>Received</th><th>Total Cost (purchase currency)</th><th>Shipments</th></>}
            {type === 'supplier' && <><th style={{ padding: 8 }}>Supplier</th><th>Country</th><th>Shipments</th><th>Actual Spent</th><th>Projected Profit</th></>}
            {type === 'monthly' && <><th style={{ padding: 8 }}>Month</th><th>Shipments</th><th>Actual Spent</th><th>Projected Profit</th></>}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                {type === 'product' && <><td style={{ padding: 8 }}>{r.product_name}</td><td>{r.total_ordered}</td><td>{r.total_received}</td><td>{parseFloat(r.total_cost_purchase_currency).toFixed(2)}</td><td>{r.shipment_count}</td></>}
                {type === 'supplier' && <><td style={{ padding: 8 }}>{r.supplier_name}</td><td>{r.country || '—'}</td><td>{r.shipment_count}</td><td>{fmtLocal(r.total_actual_spent)}</td><td style={{ color: r.total_projected_profit >= 0 ? '#16a34a' : '#ef4444' }}>{fmtLocal(r.total_projected_profit)}</td></>}
                {type === 'monthly' && <><td style={{ padding: 8 }}>{r.month}</td><td>{r.shipment_count}</td><td>{fmtLocal(r.total_actual_spent)}</td><td style={{ color: r.total_projected_profit >= 0 ? '#16a34a' : '#ef4444' }}>{fmtLocal(r.total_projected_profit)}</td></>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #1a1a18', fontWeight: 700 }}>
              {type === 'product' && <><td style={{ padding: 8 }}>Total</td><td>{totals.total_ordered}</td><td>{totals.total_received}</td><td>{totals.total_cost_purchase_currency.toFixed(2)}</td><td>—</td></>}
              {type === 'supplier' && <><td style={{ padding: 8 }}>Total</td><td>—</td><td>{totals.shipment_count}</td><td>{fmtLocal(totals.total_actual_spent)}</td><td style={{ color: totals.total_projected_profit >= 0 ? '#16a34a' : '#ef4444' }}>{fmtLocal(totals.total_projected_profit)}</td></>}
              {type === 'monthly' && <><td style={{ padding: 8 }}>Total</td><td>{totals.shipment_count}</td><td>{fmtLocal(totals.total_actual_spent)}</td><td style={{ color: totals.total_projected_profit >= 0 ? '#16a34a' : '#ef4444' }}>{fmtLocal(totals.total_projected_profit)}</td></>}
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
