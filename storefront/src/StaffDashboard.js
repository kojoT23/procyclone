import React, { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = 'http://localhost:5001';

// Asks the backend for a new access token using the long-lived refresh
// token — so an expired session can usually be healed silently instead
// of forcing staff to type their password again mid-shift. Returns null
// (never throws) if the refresh token itself is invalid/expired.
const refreshAccessToken = async (refreshToken) => {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) return null;
    return data.accessToken;
  } catch {
    return null;
  }
};

// Builds a single `request(url, options)` used for every authenticated
// staff call. It injects the Authorization header itself (always off a
// ref, so it's never stale right after a refresh), and on a 401 tries
// ONE silent refresh + retry before giving up and signing out. This is
// what lets a staff member re-open the dashboard mid-shift and land
// straight on the register instead of hitting a login screen.
const useAuthenticatedRequest = (token, refreshToken, onNewToken, onLogout) => {
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  return useCallback(async (url, options = {}) => {
    const withAuth = (t) => ({ ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${t}` } });
    let res = await fetch(url, withAuth(tokenRef.current));
    if (res.status === 401 && refreshToken) {
      const newToken = await refreshAccessToken(refreshToken);
      if (newToken) {
        tokenRef.current = newToken;
        onNewToken(newToken);
        res = await fetch(url, withAuth(newToken));
      }
    }
    if (res.status === 401) {
      onLogout();
      throw new Error('Your session expired — please sign in again.');
    }
    return res;
  }, [refreshToken, onNewToken, onLogout]);
};

/* ─── Auth ──────────────────────────────────────────────────────── */
const useStaffAuth = () => {
  const [token, setToken] = useState(() => localStorage.getItem('staffToken'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('staffRefreshToken'));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('staffUser') || 'null'); } catch { return null; }
  });

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Login failed');
    localStorage.setItem('staffToken', data.accessToken);
    localStorage.setItem('staffRefreshToken', data.refreshToken);
    localStorage.setItem('staffUser', JSON.stringify(data.user));
    setToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
  }, []);

  // Called by useAuthenticatedRequest right after a silent refresh
  // succeeds, so the new access token survives a page reload too.
  // Stable identity (useCallback, no deps) — request() depends on this,
  // and an unstable identity here would rebuild request() every render
  // and re-trigger every polling effect that depends on it.
  const updateToken = useCallback((newToken) => {
    localStorage.setItem('staffToken', newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('staffToken');
    localStorage.removeItem('staffRefreshToken');
    localStorage.removeItem('staffUser');
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  return { token, refreshToken, user, login, logout, updateToken };
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
const EditProductModal = ({ product, request, onClose, onSaved }) => {
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
      const res = await request(`${API_BASE}/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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

/* ─── Checkout modal ─────────────────────────────────────────────── */
const CheckoutModal = ({ cart, request, onClose, onCompleted }) => {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountAmount = parseFloat(discount) || 0;
  const total = Math.max(subtotal - discountAmount, 0);

  const handleComplete = async () => {
    if (paymentMethod === 'momo' && !paymentReference.trim()) {
      setError('MoMo reference is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await request(`${API_BASE}/api/pos/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(i => ({ product_id: i.id, quantity: i.quantity })),
          payment_method: paymentMethod,
          payment_reference: paymentReference || null,
          discount: discountAmount,
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Sale failed');
      onCompleted(data.sale);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 420, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px' }}>Checkout</h3>

        <div style={{ marginBottom: 16 }}>
          {cart.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
              <span>{item.quantity}x {item.name}</span>
              <span>GH₵ {(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Payment Method</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {['cash', 'momo', 'card'].map(m => (
            <button key={m} onClick={() => setPaymentMethod(m)}
              style={{
                padding: 10, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', textTransform: 'uppercase',
                border: paymentMethod === m ? '2px solid #111827' : '1px solid #e5e7eb',
                background: paymentMethod === m ? '#111827' : '#fff',
                color: paymentMethod === m ? '#fff' : '#374151',
              }}>{m}</button>
          ))}
        </div>

        {paymentMethod === 'momo' && (
          <>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>MoMo Reference</label>
            <input value={paymentReference} onChange={e => setPaymentReference(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 12, boxSizing: 'border-box' }} />
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Customer (optional)</label>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Name"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>&nbsp;</label>
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
          </div>
        </div>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Discount (GH₵)</label>
        <input type="number" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0.00"
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 16, boxSizing: 'border-box' }} />

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280' }}>
            <span>Subtotal</span><span>GH₵ {subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#dc2626' }}>
              <span>Discount</span><span>-GH₵ {discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, marginTop: 4 }}>
            <span>Total</span><span>GH₵ {total.toFixed(2)}</span>
          </div>
        </div>

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleComplete} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Processing…' : `Complete Sale`}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Receipt ────────────────────────────────────────────────────── */
const Receipt = ({ sale, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }} onClick={onClose}>
    <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 340, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
      <h3 style={{ margin: '0 0 4px' }}>Sale Complete</h3>
      <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>{sale.sale_number}</p>
      <div style={{ textAlign: 'left', marginBottom: 16 }}>
        {(typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items).map((item, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
            <span>{item.quantity}x {item.product_name}</span>
            <span>GH₵ {parseFloat(item.subtotal).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>GH₵ {parseFloat(sale.total_amount).toFixed(2)}</div>
        <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase' }}>{sale.payment_method}</div>
      </div>
      <button onClick={onClose} style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
        New Sale
      </button>
    </div>
  </div>
);

/* ─── Product dashboard ─────────────────────────────────────────── */
/* ─── Register panel — running tally as a cashier rings up a sale ── */
const RegisterPanel = ({ cart, cartTotal, cartCount, onQty, onRemove, onClear, onCheckout }) => (
  <div
    style={{
      width: 340, flexShrink: 0, position: 'sticky', top: 20,
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
      display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)',
    }}
  >
    <div style={{ padding: '16px 18px', borderBottom: '1px solid #e5e7eb' }}>
      <div style={{ fontWeight: 800, fontSize: 15 }}>🧾 Current Sale</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
        {cartCount} item{cartCount === 1 ? '' : 's'} tallied
      </div>
    </div>

    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
      {cart.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '28px 10px' }}>
          Scan or tap "+ Cart" on a product to start a sale.
        </div>
      ) : (
        cart.map(item => (
          <div
            key={item.id}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 8px', borderBottom: '1px solid #f3f4f6', gap: 8,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>GH₵ {item.price.toFixed(2)} each</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => onQty(item.id, item.quantity - 1)} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>−</button>
              <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 700, fontSize: 13 }}>{item.quantity}</span>
              <button onClick={() => onQty(item.id, item.quantity + 1)} disabled={item.quantity >= item.maxStock} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: item.quantity >= item.maxStock ? 'not-allowed' : 'pointer', fontSize: 14, lineHeight: 1, opacity: item.quantity >= item.maxStock ? 0.4 : 1 }}>+</button>
            </div>
            <div style={{ width: 64, textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
              GH₵ {(item.price * item.quantity).toFixed(2)}
            </div>
            <button onClick={() => onRemove(item.id)} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>✕</button>
          </div>
        ))
      )}
    </div>

    <div style={{ padding: '14px 18px', borderTop: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
        <span>Items</span><span>{cartCount}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
        <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>GH₵ {cartTotal.toFixed(2)}</span>
      </div>
      <button
        onClick={onCheckout}
        disabled={!cart.length}
        style={{
          width: '100%', padding: 14, borderRadius: 10, border: 'none', marginBottom: 8,
          background: cart.length ? '#16a34a' : '#e5e7eb', color: cart.length ? '#fff' : '#9ca3af',
          fontWeight: 800, fontSize: 15, cursor: cart.length ? 'pointer' : 'not-allowed',
        }}
      >
        Checkout →
      </button>
      <button
        onClick={onClear}
        disabled={!cart.length}
        style={{
          width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff',
          color: '#6b7280', fontWeight: 600, fontSize: 13, cursor: cart.length ? 'pointer' : 'not-allowed',
        }}
      >
        Clear Sale
      </button>
    </div>
  </div>
);

// Staff screens sign out after this long with no touch, click or typing, so a
// tablet left logged in (or lent to someone) can't be used for long. A
// barcode scanner counts as typing, so normal checkout work never trips it.
const IDLE_LIMIT_MS = 30 * 60 * 1000; // change 30 to however many minutes you want
const IDLE_WARN_MS = 60 * 1000;       // countdown banner shows for the last minute

const useIdleLogout = (onLogout) => {
  const [secondsLeft, setSecondsLeft] = useState(null); // null = no warning showing
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const touch = () => { lastActivity.current = Date.now(); };
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, touch, { passive: true }));
    // Checks the clock every second rather than trusting one long timer, so a
    // laptop that slept still signs out the moment it wakes up.
    const timer = setInterval(() => {
      const remaining = IDLE_LIMIT_MS - (Date.now() - lastActivity.current);
      if (remaining <= 0) { onLogout(); return; }
      setSecondsLeft(remaining <= IDLE_WARN_MS ? Math.ceil(remaining / 1000) : null);
    }, 1000);
    return () => {
      events.forEach(e => window.removeEventListener(e, touch));
      clearInterval(timer);
    };
  }, [onLogout]);

  return secondsLeft;
};

const ProductDashboard = ({ token, refreshToken, user, onLogout, onNewToken }) => {
  const request = useAuthenticatedRequest(token, refreshToken, onNewToken, onLogout);
  const idleSecondsLeft = useIdleLogout(onLogout);
  const [view, setView] = useState('products'); // 'products' | 'tickets' | 'barcodes' | 'assistance'
  const [assistCount, setAssistCount] = useState(0);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [cart, setCart] = useState([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      const currentQty = existing ? existing.quantity : 0;
      if (currentQty + 1 > product.stock_quantity) return prev; // can't exceed stock
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: product.id, name: product.name, price: parseFloat(product.price), quantity: 1, maxStock: product.stock_quantity }];
    });
  };

  const updateCartQty = (id, qty) => {
    setCart(prev => {
      if (qty <= 0) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, quantity: Math.min(qty, i.maxStock) } : i);
    });
  };

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  // Badge count on the Assistance tab — polls independently of whether
  // that tab is open, so a teller on the Products tab still sees it.
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await request(`${API_BASE}/api/assistance?status=pending`);
        const data = await res.json();
        if (!cancelled && data.success) setAssistCount((data.requests || []).length);
      } catch (e) { /* badge is best-effort, don't surface errors */ }
    };
    poll();
    const interval = setInterval(poll, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [request]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      const res = await request(`${API_BASE}/api/products?${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to load products');
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [request, search]);

  useEffect(() => {
    const t = setTimeout(fetchProducts, 300); // debounce search
    return () => clearTimeout(t);
  }, [fetchProducts]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb', fontFamily: 'system-ui, sans-serif' }}>
      {idleSecondsLeft !== null && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 3000, background: '#111827', color: '#fff', padding: '12px 18px', borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,.3)', fontSize: 14, display: 'flex', gap: 14, alignItems: 'center' }}>
          <span>Signing out in {idleSecondsLeft}s because of inactivity</span>
          <button type="button" style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#fff', color: '#111827', fontWeight: 700, cursor: 'pointer' }}>
            Stay signed in
          </button>
        </div>
      )}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18 }}>Product Dashboard</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Signed in as {user?.name} ({user?.role})</p>
        </div>
        <button onClick={onLogout} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
          Sign Out
        </button>
      </div>

      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px', display: 'flex', gap: 4 }}>
        {['products', 'tickets', 'barcodes', 'assistance'].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, textTransform: 'capitalize',
              color: view === v ? '#111827' : '#9ca3af',
              borderBottom: view === v ? '2px solid #111827' : '2px solid transparent',
            }}
          >
            {v === 'products' ? 'Products' : v === 'tickets' ? 'Self-Checkout Tickets' : v === 'barcodes' ? 'Barcode Labels' : (
              <>Assistance{assistCount > 0 && <span style={{ marginLeft: 6, background: '#dc2626', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11 }}>{assistCount}</span>}</>
            )}
          </button>
        ))}
      </div>

      {view === 'barcodes' ? (
        <BarcodeLabels request={request} />
      ) : view === 'tickets' ? (
        <PendingTickets request={request} />
      ) : view === 'assistance' ? (
        <AssistanceRequests request={request} />
      ) : (
      <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, padding: 24, maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
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
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => addToCart(p)}
                          disabled={p.stock_quantity <= 0}
                          style={{
                            padding: '6px 12px', borderRadius: 6, border: 'none',
                            background: p.stock_quantity > 0 ? '#16a34a' : '#e5e7eb',
                            color: p.stock_quantity > 0 ? '#fff' : '#9ca3af',
                            cursor: p.stock_quantity > 0 ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 600,
                          }}
                        >
                          + Cart
                        </button>
                        <button onClick={() => setEditing(p)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <RegisterPanel
        cart={cart}
        cartTotal={cartTotal}
        cartCount={cartCount}
        onQty={updateCartQty}
        onRemove={(id) => updateCartQty(id, 0)}
        onClear={() => setCart([])}
        onCheckout={() => setCheckingOut(true)}
      />
      </div>

      {editing && (
        <EditProductModal
          product={editing}
          request={request}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
            setEditing(null);
          }}
        />
      )}

      {checkingOut && (
        <CheckoutModal
          cart={cart}
          request={request}
          onClose={() => setCheckingOut(false)}
          onCompleted={(sale) => {
            setCheckingOut(false);
            setCart([]);
            setReceipt(sale);
            fetchProducts(); // stock just changed — refresh the table
          }}
        />
      )}

      {receipt && (
        <Receipt sale={receipt} onClose={() => setReceipt(null)} />
      )}
      </>
      )}
    </div>
  );
};

/* ─── Pending self-checkout tickets ─────────────────────────────── */
/* ─── Assistance requests (customer called for help) ───────────── */
const AssistanceRequests = ({ request }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [loadError, setLoadError] = useState('');

  // Failures are shown on screen, not swallowed — a wrong-role 403, a rate
  // limit 429 or a server error used to look identical to "no requests".
  const fetchRequests = useCallback(async () => {
    try {
      const res = await request(`${API_BASE}/api/assistance?status=pending`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setLoadError(`Could not load requests (HTTP ${res.status}${data.message ? ` — ${data.message}` : ''})`);
      } else {
        setLoadError('');
        setRequests(data.requests || []);
      }
    } catch (e) {
      console.error(e);
      setLoadError(`Could not load requests — ${e.message}`);
    }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 8000); // same cadence as Pending Tickets
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const act = async (id, action) => {
    setBusyId(id);
    try {
      const res = await request(`${API_BASE}/api/assistance/${id}/${action}`, {
        method: 'PUT',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not update request');
      setRequests(prev => action === 'resolve' ? prev.filter(r => r.id !== id) : prev.map(r => r.id === id ? data.request : r));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const timeAgo = (iso) => {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    return mins < 1 ? 'just now' : `${mins} min ago`;
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>🙋 Assistance Requests</h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Customers calling for help at a self-checkout kiosk. Refreshes automatically.</p>
      {loadError && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
          {loadError}
        </div>
      )}
      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : requests.length === 0 ? (
        !loadError && <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>No open requests right now.</div>
      ) : (
        requests.map(r => (
          <div
            key={r.id}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 16px', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 10,
              background: r.status === 'acknowledged' ? '#f9fafb' : '#fffbeb',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{r.reason || 'Needs assistance'}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {timeAgo(r.requested_at)}{r.status === 'acknowledged' ? ' · being handled' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {r.status === 'pending' && (
                <button
                  onClick={() => act(r.id, 'acknowledge')}
                  disabled={busyId === r.id}
                  style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  On my way
                </button>
              )}
              <button
                onClick={() => act(r.id, 'resolve')}
                disabled={busyId === r.id}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Resolved
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const ConfirmTicketModal = ({ ticket, request, onClose, onConfirmed }) => {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (paymentMethod === 'momo' && !paymentReference.trim()) {
      setError('MoMo reference is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await request(`${API_BASE}/api/pos/sales/${ticket.id}/confirm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: paymentMethod, payment_reference: paymentReference || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not confirm payment');
      onConfirmed();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const items = typeof ticket.items === 'string' ? JSON.parse(ticket.items) : ticket.items;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 380, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px' }}>{ticket.sale_number}</h3>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 16px' }}>Confirm payment received</p>

        <div style={{ marginBottom: 16 }}>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
              <span>{item.quantity}x {item.product_name}</span>
              <span>GH₵ {parseFloat(item.subtotal).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, borderTop: '1px solid #e5e7eb', marginTop: 8, paddingTop: 8 }}>
            <span>Total</span><span>GH₵ {parseFloat(ticket.total_amount).toFixed(2)}</span>
          </div>
        </div>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Payment Method</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {['cash', 'momo', 'card'].map(m => (
            <button key={m} onClick={() => setPaymentMethod(m)}
              style={{
                padding: 10, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', textTransform: 'uppercase',
                border: paymentMethod === m ? '2px solid #111827' : '1px solid #e5e7eb',
                background: paymentMethod === m ? '#111827' : '#fff',
                color: paymentMethod === m ? '#fff' : '#374151',
              }}>{m}</button>
          ))}
        </div>

        {paymentMethod === 'momo' && (
          <input value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="MoMo reference"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 12, boxSizing: 'border-box' }} />
        )}

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleConfirm} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Confirming…' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Barcode Labels ─────────────────────────────────────────────── */
// EAN-13 codes starting with 20-29 are internationally reserved for
// internal/in-store use — never assigned to real retail products
// globally — so they're exactly right for our own inventory and will
// still scan correctly on any standard barcode reader.
const generateEAN13 = (productId) => {
  const body = '20' + String(productId).padStart(10, '0'); // 12 digits
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(body[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return body + checkDigit;
};

const printLabel = (product) => {
  const win = window.open('', '_blank', 'width=400,height=300');
  win.document.write(`
    <html><head><title>${product.name} label</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js"></script>
    <style>
      body { font-family: system-ui, sans-serif; text-align: center; padding: 16px; }
      .name { font-weight: 700; font-size: 14px; margin-bottom: 2px; }
      .price { font-size: 18px; font-weight: 800; margin-bottom: 8px; }
    </style></head>
    <body>
      <div class="name">${product.name}</div>
      <div class="price">GH₵ ${parseFloat(product.price).toFixed(2)}</div>
      <svg id="barcode"></svg>
      <script>
        JsBarcode("#barcode", "${product.barcode}", { format: "EAN13", height: 60, fontSize: 14 });
        window.onload = () => window.print();
      </script>
    </body></html>
  `);
  win.document.close();
};

const BarcodeLabels = ({ request }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [search, setSearch] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request(`${API_BASE}/api/products?limit=200`);
      const data = await res.json();
      if (data.success) setProducts(data.products || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleGenerate = async (product) => {
    setGenerating(product.id);
    try {
      const barcode = generateEAN13(product.id);
      const res = await request(`${API_BASE}/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not assign barcode');
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, barcode } : p));
    } catch (err) {
      alert(err.message);
    } finally {
      setGenerating(null);
    }
  };

  const filtered = products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));
  const missingCount = products.filter(p => !p.barcode).length;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      {missingCount > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
          ⚠ {missingCount} product{missingCount === 1 ? '' : 's'} still need{missingCount === 1 ? 's' : ''} a barcode before they can be scanned.
        </div>
      )}
      <input
        type="text" placeholder="Search products…" value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 16, boxSizing: 'border-box', fontSize: 14 }}
      />

      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px' }}>Name</th>
                <th style={{ padding: '10px 14px' }}>Barcode</th>
                <th style={{ padding: '10px 14px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: p.barcode ? '#111827' : '#d1d5db' }}>
                    {p.barcode || 'No barcode'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {p.barcode ? (
                      <button onClick={() => printLabel(p)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        🖨 Print Label
                      </button>
                    ) : (
                      <button onClick={() => handleGenerate(p)} disabled={generating === p.id}
                        style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        {generating === p.id ? 'Generating…' : 'Generate Barcode'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const PendingTickets = ({ request }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request(`${API_BASE}/api/pos/sales?status=pending_payment`);
      const data = await res.json();
      if (data.success) setTickets(data.sales || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 8000); // poll — new tickets can appear from the storefront anytime
    return () => clearInterval(interval);
  }, [fetchTickets]);

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : tickets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎫</div>
          No pending tickets right now.
        </div>
      ) : (
        tickets.map(t => {
          const items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items;
          return (
            <div key={t.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{t.sale_number}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                  {items.map(i => `${i.quantity}x ${i.product_name}`).join(', ')}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{new Date(t.created_at).toLocaleTimeString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>GH₵ {parseFloat(t.total_amount).toFixed(2)}</div>
                <button onClick={() => setConfirming(t)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                  Confirm
                </button>
              </div>
            </div>
          );
        })
      )}

      {confirming && (
        <ConfirmTicketModal
          ticket={confirming}
          request={request}
          onClose={() => setConfirming(null)}
          onConfirmed={() => { setConfirming(null); fetchTickets(); }}
        />
      )}
    </div>
  );
};

/* ─── Entry point ────────────────────────────────────────────────── */
// Staff tools (register panel, product table, barcode labels) are laid out
// for tablet/desktop screens only. Below this width — i.e. phones — show a
// notice instead of a cramped, unusable register. 768px matches the
// storefront's own phone/tablet breakpoint. Tracks live width so rotating
// a tablet or resizing a desktop window switches views immediately, and
// never touches the saved session, so nothing is lost either way.
const STAFF_MIN_WIDTH = 768;

const useIsPhoneWidth = () => {
  const [isPhone, setIsPhone] = useState(() => window.innerWidth < STAFF_MIN_WIDTH);
  useEffect(() => {
    const onResize = () => setIsPhone(window.innerWidth < STAFF_MIN_WIDTH);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return isPhone;
};

const StaffDashboard = () => {
  // All hooks first, THEN any early return — returning before a hook runs
  // would change the hook count when the window is resized.
  const { token, refreshToken, user, login, logout, updateToken } = useStaffAuth();
  const isPhone = useIsPhoneWidth();

  if (isPhone) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f9fafb', textAlign: 'center' }}>
        <div style={{ maxWidth: 340 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🖥️</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Staff tools need a bigger screen</h2>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
            The register and staff dashboard work on a tablet or desktop. Please switch to one of those devices, or rotate your tablet to landscape.
          </p>
          <a href="/" style={{ fontSize: 14, color: '#111827', fontWeight: 700 }}>← Back to the store</a>
        </div>
      </div>
    );
  }

  if (!token || !user) return <StaffLogin onLogin={login} />;
  return <ProductDashboard token={token} refreshToken={refreshToken} user={user} onLogout={logout} onNewToken={updateToken} />;
};

export default StaffDashboard;
