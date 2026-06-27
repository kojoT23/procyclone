import React, { useState, useEffect, useCallback } from 'react';
import { usersAPI } from '../utils/api';

/* ─── CSV helper ──────────────────────────────────────────────── */
const downloadCSV = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const v = r[h] ?? '';
        return typeof v === 'string' && (v.includes(',') || v.includes('"'))
          ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

/* ─── Action badge ────────────────────────────────────────────── */
const ActionBadge = ({ action }) => {
  const cls =
    action?.startsWith('CREATE')  ? 'badge badge-green'  :
    action?.startsWith('DELETE')  ? 'badge badge-red'    :
    action?.startsWith('VERIFY')  ? 'badge badge-blue'   :
    action?.startsWith('FAIL')    ? 'badge badge-red'    :
    action?.startsWith('UPDATE')  ? 'badge badge-amber'  :
    action?.startsWith('RESET')   ? 'badge badge-purple' : 'badge badge-gray';
  return (
    <span className={cls} style={{ fontSize: '11px', fontFamily: 'monospace' }}>
      {action?.replace(/_/g, ' ')}
    </span>
  );
};

/* ─── Entity badge ────────────────────────────────────────────── */
const EntityBadge = ({ entity }) => {
  const cls =
    entity === 'order'   ? 'badge badge-blue'   :
    entity === 'payment' ? 'badge badge-green'  :
    entity === 'user'    ? 'badge badge-purple' :
    entity === 'rider'   ? 'badge badge-amber'  : 'badge badge-gray';
  return entity ? <span className={cls}>{entity}</span> : null;
};

const ACTIONS = [
  'CREATE_ORDER', 'UPDATE_ORDER_STATUS', 'DELETE_ORDER',
  'VERIFY_PAYMENT', 'FAIL_PAYMENT',
  'CREATE_USER', 'DELETE_USER',
  'RESET_AVAILABILITY',
];

const AuditLog = () => {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [startDate,    setStartDate]    = useState('');
  const [endDate,      setEndDate]      = useState('');
  const [exporting,    setExporting]    = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 50 };
      if (filterAction) params.action     = filterAction;
      if (startDate)    params.start_date = startDate;
      if (endDate)      params.end_date   = endDate;
      const res = await usersAPI.getAuditLog(params);
      setLogs(res.data.logs   || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, startDate, endDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(1); }, [filterAction, startDate, endDate]);

  /* ── Export current filtered view (up to 1000 rows) ──────────── */
  const handleExport = async () => {
    try {
      setExporting(true);
      const params = { page: 1, limit: 1000 };
      if (filterAction) params.action     = filterAction;
      if (startDate)    params.start_date = startDate;
      if (endDate)      params.end_date   = endDate;
      const res = await usersAPI.getAuditLog(params);
      const allLogs = res.data.logs || [];

      if (!allLogs.length) return alert('No log entries to export for the current filters.');

      downloadCSV(
        allLogs.map(log => ({
          Time:        new Date(log.created_at).toLocaleString('en-GB'),
          User:        log.user_name || 'Unknown',
          Role:        log.user_role ? log.user_role.replace('_', ' ') : '',
          Action:      log.action?.replace(/_/g, ' ') || '',
          Entity:      log.entity || '',
          'Entity ID': log.entity_id || '',
          Description: log.description || '',
          'IP Address': log.ip_address || '',
        })),
        `audit-log-${startDate || 'all'}-to-${endDate || 'now'}.csv`
      );
    } catch (err) {
      alert('Error exporting audit log');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">{total} recorded actions · permanent record, cannot be deleted</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}>🖨️ Print</button>
          <button className="btn btn-secondary btn-sm" onClick={handleExport} disabled={exporting}>
            {exporting ? '⏳ Exporting…' : '⬇ Export CSV'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card no-print" style={{ marginBottom: '16px' }}>
        <div className="search-bar">
          <select
            className="form-input"
            style={{ width: 'auto', minWidth: '180px' }}
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
          >
            <option value="">All actions</option>
            {ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
          <input
            type="date"
            className="form-input"
            style={{ width: 'auto' }}
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            title="Start date"
          />
          <span style={{ color: 'var(--text-3)' }}>→</span>
          <input
            type="date"
            className="form-input"
            style={{ width: 'auto' }}
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            title="End date"
          />
          {(filterAction || startDate || endDate) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setFilterAction(''); setStartDate(''); setEndDate(''); }}>
              Clear
            </button>
          )}
          <span className="pagination-info" style={{ marginLeft: 'auto' }}>{total} entries</span>
        </div>
      </div>

      {/* Permanence notice */}
      <div className="alert alert-info no-print" style={{ marginBottom: '16px', fontSize: '13px' }}>
        🔒 Audit entries are permanent and cannot be deleted, even by Super Admin — this protects the integrity of the record. Export to CSV for sharing or offline backup.
      </div>

      {/* Print-only title */}
      <div className="print-area">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>Shorewinds — Audit Log</h2>
          <p style={{ color: '#666', fontSize: '12px', margin: '4px 0 0' }}>
            Printed on {new Date().toLocaleString('en-GB')} · {total} entries
          </p>
        </div>

      {/* Log table */}
      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="loading-spinner" />
            <span className="loading-text">Loading audit log…</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No audit entries yet</h3>
            <p>Actions like creating orders, verifying payments and deleting records will appear here.</p>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Description</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ color: 'var(--text-3)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </td>
                      <td>
                        <div style={{ fontWeight: '600', fontSize: '13px' }}>{log.user_name || '—'}</div>
                        {log.user_role && (
                          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'capitalize' }}>
                            {log.user_role.replace('_', ' ')}
                          </div>
                        )}
                      </td>
                      <td><ActionBadge action={log.action} /></td>
                      <td>
                        <EntityBadge entity={log.entity} />
                        {log.entity_id && (
                          <span style={{ fontSize: '11px', color: 'var(--text-3)', marginLeft: '4px' }}>
                            #{log.entity_id}
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-2)', fontSize: '13px', maxWidth: '300px' }}>
                        {log.description || '—'}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-3)' }}>
                        {log.ip_address || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="pagination no-print" style={{ marginTop: '16px' }}>
                <span className="pagination-info">Page {page} of {pages} · {total} entries</span>
                <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <button className="btn btn-secondary btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
};

export default AuditLog;
