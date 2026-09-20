import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:5001';

/* ─── Auth ──────────────────────────────────────────────────────── */
const useStaffAuth = () => {
  const [token, setToken] = useState(() => localStorage.getItem('staffToken'));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('staffUser') || 'null'); } catch { return null; }
  });

  const login = async (email, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Login failed');
    localStorage.setItem('staffToken', data.accessToken);
    localStorage.setItem('staffUser', JSON.stringify(data.user));
    setToken(data.accessToken);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('staffToken');
    localStorage.removeItem('staffUser');
    setToken(null);
    setUser(null);
  };

  return { token, user, login, logout };
};

/* ─── Login screen ──────────────────────────────────────────────── */
const StaffLogin = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fb', fontFamily: 'system-ui, sans-serif' }}>
      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 32, borderRadius: 16, width: 340, boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Staff Dashboard</h2>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>Sign in with your Procyclone account</p>
        <input
          type="email" placeholder="Email" value={email} required
          onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 10, boxSizing: 'border-box', fontSize: 14 }}
        />
        <input
          type="password" placeholder="Password" value={password} required
          onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 16, boxSizing: 'border-box', fontSize: 14 }}
        />
        {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
};

/* ─── Edit product modal ────────────────────────────────────────── */
const EditProductModal = ({ product, token, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: product.name || '',
    price: product.price || '',
    stock_quantity: product.stock_quantity ?? '',
    category: product.category || '',
    description: product.description || '',
    is_active: product.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Update failed');
      onSaved(data.product);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 420, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px' }}>Edit Product</h3>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Name</label>
        <input value={form.name} onChange={e => set('name', e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 12, boxSizing: 'border-box' }} />

        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Price (GH₵)</label>
            <input type="number" step="0.01" value={form.price} onChange={e => set('price', e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Stock</label>
            <input type="number" value={form.stock_quantity} onChange={e => set('stock_quantity', e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
          </div>
        </div>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Category</label>
        <input value={form.category} onChange={e => set('category', e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 12, boxSizing: 'border-box' }} />

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Description</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 12, boxSizing: 'border-box', resize: 'vertical' }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
          Active (visible/sellable)
        </label>

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Product dashboard ─────────────────────────────────────────── */
const ProductDashboard = ({ token, user, onLogout }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      const res = await fetch(`${API_BASE}/api/products?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { onLogout(); return; }
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to load products');
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, search, onLogout]);

  useEffect(() => {
    const t = setTimeout(fetchProducts, 300); // debounce search
    return () => clearTimeout(t);
  }, [fetchProducts]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18 }}>Product Dashboard</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Signed in as {user?.name} ({user?.role})</p>
        </div>
        <button onClick={onLogout} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
          Sign Out
        </button>
      </div>

      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <input
          type="text" placeholder="Search products…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 20, boxSizing: 'border-box', fontSize: 14 }}
        />

        {error && <p style={{ color: '#dc2626', marginBottom: 16 }}>{error}</p>}

        {loading ? (
          <p style={{ color: '#6b7280' }}>Loading…</p>
        ) : products.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No products found.</p>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px' }}></th>
                  <th style={{ padding: '10px 14px' }}>Name</th>
                  <th style={{ padding: '10px 14px' }}>Category</th>
                  <th style={{ padding: '10px 14px' }}>Price</th>
                  <th style={{ padding: '10px 14px' }}>Stock</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                  <th style={{ padding: '10px 14px' }}></th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px' }}>
                      {p.image_url ? (
                        <img src={p.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 6, background: '#f3f4f6' }} />
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{p.name}</td>
                    <td style={{ padding: '10px 14px', color: '#6b7280' }}>{p.category || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>GH₵ {parseFloat(p.price || 0).toFixed(2)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ color: p.stock_quantity <= (p.low_stock_threshold || 5) ? '#dc2626' : '#111827', fontWeight: p.stock_quantity <= (p.low_stock_threshold || 5) ? 700 : 400 }}>
                        {p.stock_quantity}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                        background: p.is_active ? '#dcfce7' : '#f3f4f6',
                        color: p.is_active ? '#15803d' : '#6b7280',
                      }}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => setEditing(p)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <EditProductModal
          product={editing}
          token={token}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

/* ─── Entry point ────────────────────────────────────────────────── */
const StaffDashboard = () => {
  const { token, user, login, logout } = useStaffAuth();
  if (!token || !user) return <StaffLogin onLogin={login} />;
  return <ProductDashboard token={token} user={user} onLogout={logout} />;
};

export default StaffDashboard;
