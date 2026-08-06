import React, { useState, useEffect, useCallback } from 'react';
import { ridersAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function PortalRiders() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAvailable, setFilterAvailable] = useState(''); // '', 'available', 'busy'
  const [resetting, setResetting] = useState(false);

  const fetchRiders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await ridersAPI.getAll({ limit: 200 });
      setRiders(res.data.riders || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRiders(); }, [fetchRiders]);

  const resetAvailability = async () => {
    if (!window.confirm('Reset all busy riders back to available?')) return;
    setResetting(true);
    try {
      await ridersAPI.resetAvailability();
      fetchRiders();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to reset availability');
    } finally {
      setResetting(false);
    }
  };

  const filtered = riders.filter(r => {
    if (search && !r.name?.toLowerCase().includes(search.toLowerCase()) && !r.phone?.includes(search)) {
      return false;
    }
    if (filterAvailable === 'available') return r.is_available;
    if (filterAvailable === 'busy') return !r.is_available;
    return true;
  });

  const availableCount = riders.filter(r => r.is_available).length;
  const busyCount = riders.filter(r => !r.is_available).length;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a18', margin: '0 0 4px' }}>Riders</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{availableCount} available · {busyCount} on delivery</p>
      </div>

      <input
        className="form-input"
        placeholder="Search by name or phone…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 10, width: '100%' }}
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[
          { key: '', label: 'All' },
          { key: 'available', label: '🟢 Available' },
          { key: 'busy', label: '🟡 On Delivery' },
        ].map(f => (
          <button
            key={f.key || 'all'}
            onClick={() => setFilterAvailable(f.key)}
            style={{
              flex: 1, padding: '6px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: filterAvailable === f.key ? '#1a1a18' : '#fff',
              color: filterAvailable === f.key ? '#fff' : '#6b7280',
              boxShadow: filterAvailable === f.key ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isSuperAdmin && busyCount > 0 && (
        <button
          onClick={resetAvailability}
          disabled={resetting}
          style={{ width: '100%', background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, marginBottom: 14, cursor: 'pointer' }}
        >
          {resetting ? 'Resetting…' : `Reset all ${busyCount} busy rider${busyCount > 1 ? 's' : ''} to available`}
        </button>
      )}

      {loading ? (
        <div className="loading"><div className="loading-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛵</div>
          <p style={{ color: '#6b7280' }}>No riders match this filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(rider => (
            <div key={rider.id} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
              {rider.passport_photo ? (
                <img src={rider.passport_photo} alt={rider.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#1a1a18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                  {rider.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a18' }}>{rider.name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: rider.is_available ? '#dcfce7' : '#fef3c7', color: rider.is_available ? '#16a34a' : '#d97706' }}>
                    {rider.is_available ? 'Available' : 'On delivery'}
                  </span>
                  {rider.zone && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#dbeafe', color: '#1d4ed8' }}>
                      {rider.zone}
                    </span>
                  )}
                </div>
              </div>
              {rider.phone && (
                <a
                  href={`tel:${rider.phone}`}
                  style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, textDecoration: 'none' }}
                >
                  📞
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
