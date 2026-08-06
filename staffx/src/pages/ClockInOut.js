import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { hrAPI } from '../utils/api';

const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }) : '—';

const fmtDuration = (minutes) => {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const QUICK_LINKS = [
  { to: '/attendance', icon: '🕐', label: 'Attendance History', desc: 'Past clock-ins & hours' },
  { to: '/scheduler',  icon: '📅', label: 'My Schedule',        desc: 'Upcoming shifts' },
  { to: '/payslips',   icon: '💰', label: 'Payslips',           desc: 'View & download' },
  { to: '/leave',      icon: '🌴', label: 'Leave',              desc: 'Request time off' },
  { to: '/career',     icon: '🎓', label: 'Career & Vacancies', desc: 'Growth & openings' },
  { to: '/documents',  icon: '📄', label: 'Documents',          desc: 'Letters & ID card' },
];

export default function ClockInOut() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [now, setNow] = useState(new Date());
  const tickRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await hrAPI.getMyStatus();
      setStatus(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    tickRef.current = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(tickRef.current);
  }, []);

  const isClockedIn = status?.attendance?.status === 'clocked_in';
  const onBreak = !!status?.open_break;

  const elapsedMinutes = (() => {
    if (!isClockedIn || !status?.attendance?.clock_in_at) return null;
    return Math.max(0, Math.round((now - new Date(status.attendance.clock_in_at)) / 60000));
  })();

  const handleAction = async (fn, ...args) => {
    setActing(true);
    try {
      await fn(...args);
      await fetchStatus();
    } catch (e) {
      alert(e.response?.data?.message || 'Something went wrong');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>Loading…</div>;
  }

  return (
    <div>
      {/* ═══ Hero ═══ */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 20, padding: '36px 32px', marginBottom: 24,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #1a1a18 100%)', color: '#fff',
      }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.08 }} preserveAspectRatio="none">
          <defs>
            <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.6" fill="#d4af37" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: '#d4af37', textTransform: 'uppercase', marginBottom: 6 }}>
              {onBreak ? `On ${status.open_break.break_type} break` : isClockedIn ? 'Currently clocked in' : 'Not clocked in'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              {isClockedIn ? `Since ${fmtTime(status.attendance.clock_in_at)}` : 'Ready to start your shift?'}
            </div>
            <div style={{ fontSize: 44, fontWeight: 800, marginTop: 10, fontVariantNumeric: 'tabular-nums' }}>
              {isClockedIn ? fmtDuration(elapsedMinutes) : '—'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
            {!isClockedIn && (
              <button
                onClick={() => handleAction(hrAPI.clockIn)}
                disabled={acting}
                style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 12, padding: '15px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
              >
                {acting ? 'Clocking in…' : '🟢 Clock In'}
              </button>
            )}

            {isClockedIn && !onBreak && (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleAction(hrAPI.startBreak, { break_type: 'short' })}
                    disabled={acting}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ☕ Short Break
                  </button>
                  <button
                    onClick={() => handleAction(hrAPI.startBreak, { break_type: 'lunch' })}
                    disabled={acting}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    🍽️ Lunch
                  </button>
                </div>
                <button
                  onClick={() => handleAction(hrAPI.clockOut)}
                  disabled={acting}
                  style={{ background: '#fff', color: '#1a1a18', border: 'none', borderRadius: 12, padding: '15px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
                >
                  {acting ? 'Clocking out…' : '🔴 Clock Out'}
                </button>
              </>
            )}

            {onBreak && (
              <button
                onClick={() => handleAction(hrAPI.endBreak)}
                disabled={acting}
                style={{ background: '#d4af37', color: '#1a1a18', border: 'none', borderRadius: 12, padding: '15px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
              >
                {acting ? 'Ending break…' : '▶️ End Break'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Today's breaks ═══ */}
      {status?.breaks?.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Today's Breaks</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {status.breaks.map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ textTransform: 'capitalize', color: '#374151' }}>{b.break_type === 'lunch' ? '🍽️' : '☕'} {b.break_type}</span>
                <span style={{ color: '#6b7280' }}>
                  {fmtTime(b.start_at)} – {b.end_at ? fmtTime(b.end_at) : 'ongoing'}
                  {b.duration_minutes != null ? ` (${fmtDuration(b.duration_minutes)})` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Quick links ═══ */}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Explore StaffX</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {QUICK_LINKS.map(link => (
          <Link
            key={link.to}
            to={link.to}
            style={{
              background: '#fff', borderRadius: 14, padding: '18px 16px', textDecoration: 'none', color: 'inherit',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 8,
              border: '1px solid transparent', transition: 'border-color 0.15s',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #fef9c3, #fde68a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
            }}>
              {link.icon}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{link.label}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{link.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
