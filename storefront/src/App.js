import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

const API_BASE = 'http://localhost:5001';
const WA_NUMBER = '233249677484';

const CATEGORIES = [
  { name: 'All', emoji: '🛍️' },
  { name: 'Electronics', emoji: '📱' },
  { name: 'Fashion', emoji: '👗' },
  { name: 'Home', emoji: '🏠' },
  { name: 'Health', emoji: '💊' },
  { name: 'Sports', emoji: '⚽' },
  { name: 'Food', emoji: '🍔' },
  { name: 'Beauty', emoji: '💄' },
  { name: 'Other', emoji: '📦' },
];

const CATEGORY_EMOJI = {
  electronics: '📱', fashion: '👗', home: '🏠', health: '💊',
  sports: '⚽', food: '🍔', footwear: '👟', helmets: '⛑️',
  accessory: '💍', accessories: '💍', beauty: '💄', other: '📦',
};

const SLIDES = [
  {
    badge: '🔥 Best Prices in Ghana',
    title: 'Everything Profitable.\nDelivered to You.',
    sub: 'Shop the best quality products at the best prices with fast delivery across Ghana.',
    emoji: '📱',
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  },
  {
    badge: '⚡ Flash Deals',
    title: 'Unbeatable Deals\nEvery Day.',
    sub: 'New deals added daily. Pay with MoMo or cash on delivery. Fast and easy.',
    emoji: '🎧',
    bg: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #1a0a3e 100%)',
  },
  {
    badge: '📲 WhatsApp Commerce',
    title: 'Order via\nWhatsApp.',
    sub: 'Simply add to cart and checkout via WhatsApp. We confirm and deliver to you.',
    emoji: '👟',
    bg: 'linear-gradient(135deg, #0a1a2e 0%, #0f2a3e 50%, #0a1a2e 100%)',
  },
];

const NAV_LINKS = [
  { label: 'Home', action: 'home' },
  { label: 'Categories', action: 'categories' },
  { label: 'Deals', action: 'deals' },
  { label: 'Track Order', action: 'track' },
  { label: 'Help', action: 'help' },
];

const ASK_CHIPS = [
  { label: '🛍️ All Products', filter: {} },
  { label: '🎁 Gift under GH₵100', filter: { maxPrice: 100 } },
  { label: '🔥 Best deals', filter: { deals: true } },
  { label: '📱 Electronics', filter: { category: 'Electronics' } },
  { label: '👗 Fashion', filter: { category: 'Fashion' } },
  { label: '🏠 Home & Living', filter: { category: 'Home' } },
];

const WHY_ITEMS = [
  { icon: '✅', label: 'Verified Store', sub: '100% authentic products from trusted brands' },
  { icon: '🚚', label: 'Fast Delivery', sub: 'Quick delivery to all regions in Ghana' },
  { icon: '📱', label: 'MoMo Payment', sub: 'Pay securely with MTN MoMo' },
  { icon: '↩️', label: 'Easy Returns', sub: '7-day return policy for peace of mind' },
  { icon: '💬', label: 'WhatsApp Support', sub: 'Chat with us 24/7 on WhatsApp' },
];

const getEmoji = (product) => {
  if (product.image_url && product.image_url.startsWith('http')) return null;
  const cat = (product.category || '').toLowerCase();
  return CATEGORY_EMOJI[cat] || '📦';
};

const getDiscount = (price, comparePrice) => {
  if (!comparePrice || comparePrice <= price) return null;
  return Math.round((1 - price / comparePrice) * 100);
};

const buildWAMessage = (items, total) => {
  const lines = items.map(i => `• ${i.name} x${i.qty} — GH₵ ${(i.price * i.qty).toFixed(2)}`);
  const msg = `Hello Fleppystore! 🛍️\n\nI'd like to order:\n\n${lines.join('\n')}\n\n*Total: GH₵ ${total.toFixed(2)}*\n\nPlease confirm availability and delivery. Thank you!`;
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
};

// ── CUSTOMER IDENTITY (local, no backend auth) ──
const CUSTOMER_KEY = 'fs_customer';
const getCustomer = () => {
  try { return JSON.parse(localStorage.getItem(CUSTOMER_KEY)); } catch { return null; }
};
const saveCustomer = (c) => localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c));
const clearCustomer = () => localStorage.removeItem(CUSTOMER_KEY);

const CART_KEY = 'fs_cart';
const getCart = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};
const saveCart = (items) => localStorage.setItem(CART_KEY, JSON.stringify(items));
const clearCartStorage = () => localStorage.removeItem(CART_KEY);

const WISHLIST_KEY = 'fs_wishlist';
const getWishlist = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(WISHLIST_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};
const saveWishlist = (ids) => localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));

const renderStars = (rating) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <i key={i} className={`ti ti-star${i <= Math.round(rating) ? '-filled' : ''} fs-star${i <= Math.round(rating) ? '' : ' empty'}`} />
    );
  }
  return stars;
};

// ── GHANA PHONE VALIDATION (mirrors backend/src/utils/phoneValidation.js) ──
const normalizeGhanaPhone = (raw) => {
  if (!raw) return null;
  let digits = raw.trim().replace(/[\s\-().]/g, '');
  if (digits.startsWith('+233')) digits = '0' + digits.slice(4);
  else if (digits.startsWith('233') && digits.length === 12) digits = '0' + digits.slice(3);
  return /^0\d{9}$/.test(digits) ? digits : null;
};

// ── ACCOUNT MODAL (local sign-in, no backend auth) ──
const AccountModal = ({ onClose, onSave, onSignOut, onViewOrders, customer }) => {
  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [touched, setTouched] = useState(false);

  const normalizedPhone = normalizeGhanaPhone(phone);
  const phoneError = touched && phone.trim() && !normalizedPhone;

  const submit = () => {
    if (!name.trim() || !normalizedPhone) { setTouched(true); return; }
    onSave({ name: name.trim(), phone: normalizedPhone });
    onClose();
  };

  return (
    <div className="fs-modal-overlay" onClick={onClose}>
      <div className="fs-account-modal" onClick={e => e.stopPropagation()}>
        <button className="fs-modal-close" onClick={onClose}>
          <i className="ti ti-x" aria-hidden="true" />
        </button>
        <div className="fs-account-icon">👋</div>
        <h2 className="fs-account-title">{customer ? 'Update your details' : 'Welcome — who are you?'}</h2>
        <p className="fs-account-sub">Just your name and number — no password. This speeds up self-checkout and lets us find your order.</p>
        <input className="fs-account-input" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
        <input
          className="fs-account-input"
          placeholder="e.g. 0244123456"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          onBlur={() => setTouched(true)}
          style={phoneError ? { borderColor: '#ef4444' } : undefined}
        />
        {phoneError && <p style={{ color: '#ef4444', fontSize: 12, margin: '-4px 0 10px', textAlign: 'left' }}>Enter a valid Ghana number, e.g. 0244123456 or +233244123456</p>}
        <button className="fs-account-save" onClick={submit} disabled={!name.trim() || !normalizedPhone}>
          {customer ? 'Save' : "That's me — continue"}
        </button>
        {customer && (
          <button
            onClick={() => { onViewOrders(); onClose(); }}
            className="fs-account-save"
            style={{ marginTop: 8, background: 'var(--white)', color: 'var(--accent)', border: '1.5px solid var(--accent)' }}
          >
            🧾 View Order History
          </button>
        )}
        {customer && (
          <button
            onClick={() => { onSignOut(); onClose(); }}
            style={{ marginTop: 12, background: 'none', border: 'none', color: '#6b7280', fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}
          >
            Not {customer.name.split(' ')[0]}? Sign out
          </button>
        )}
      </div>
    </div>
  );
};

// ── MINI STICKY NAV (mobile/tablet only) ──
// Slim search bar that sticks to the top once the hero banner has
// scrolled out of view — standard e-commerce pattern. Hidden on
// desktop (>1024px) via the media query below; the full TopNav
// already covers that case there.
const MiniStickyNav = ({ visible, search, onSearch, onHomeClick }) => (
  <>
    <style>{`
      .fs-mini-stickynav { display: none; }
      @media (max-width: 1024px) {
        .fs-mini-stickynav.visible {
          display: flex;
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 1000;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          background: var(--white, #fff);
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
      }
    `}</style>
    <div className={`fs-mini-stickynav${visible ? ' visible' : ''}`}>
      <span
        className="fs-logo-icon"
        onClick={onHomeClick}
        role="button"
        tabIndex={0}
        style={{ cursor: 'pointer', fontSize: 20 }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onHomeClick(); }}
      >
        🛍️
      </span>
      <input
        className="fs-search-input"
        placeholder="Search for anything..."
        value={search}
        onChange={e => onSearch(e.target.value)}
        style={{ flex: 1 }}
      />
      <button
        className="fs-search-btn"
        onClick={() => {
          document.activeElement.blur();
          const grid = document.querySelector('.fs-section');
          if (grid) grid.scrollIntoView({ behavior: 'smooth' });
        }}
      >
        <i className="ti ti-search" aria-hidden="true" />
      </button>
    </div>
  </>
);

// ── TOP NAVBAR ──
const TopNav = ({ cartCount, onCartOpen, search, onSearch, customer, onAccountOpen, storeMode, onToggleStoreMode, wishlistCount, onWishlistOpen, onHomeClick }) => (
  <header className="fs-topnav">
    <div
      className="fs-logo"
      onClick={onHomeClick}
      role="button"
      tabIndex={0}
      style={{ cursor: 'pointer' }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onHomeClick(); }}
    >
      <span className="fs-logo-icon">🛍️</span>
      Fleppystore
    </div>
    {!storeMode && (
      <div className="fs-search-wrap">
        <input
          className="fs-search-input"
          placeholder="Search for anything..."
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
        <select className="fs-search-cat">
          <option>All Categories</option>
          {CATEGORIES.slice(1).map(c => <option key={c.name}>{c.name}</option>)}
        </select>
        <button
          className="fs-search-btn"
          onClick={() => {
            document.activeElement.blur();
            const grid = document.querySelector('.fs-section');
            if (grid) grid.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <i className="ti ti-search" aria-hidden="true" />
        </button>
      </div>
    )}
    <div className="fs-topnav-actions">
      <button
        className={`fs-topnav-btn fs-store-mode-btn ${storeMode ? 'active' : ''}`}
        onClick={onToggleStoreMode}
        title="Toggle self-checkout kiosk view"
      >
        <i className="ti ti-building-store" aria-hidden="true" />
        <span className="fs-store-mode-label-full">{storeMode ? 'Exit Store Mode' : "I'm in the store"}</span>
        <span className="fs-store-mode-label-short">{storeMode ? 'Exit' : 'In-Store'}</span>
      </button>
      {!storeMode && (
        <>
          <button className="fs-topnav-btn fs-topnav-hide-mobile" onClick={onAccountOpen}>
            <i className="ti ti-user" aria-hidden="true" />
            {customer ? customer.name.split(' ')[0] : 'Account'}
          </button>
          <button className="fs-topnav-btn fs-topnav-cart-btn fs-topnav-hide-mobile" onClick={onWishlistOpen}>
            <i className="ti ti-heart" aria-hidden="true" />
            Wishlist
            {wishlistCount > 0 && <span className="fs-cart-badge">{wishlistCount}</span>}
          </button>
          <button className="fs-topnav-btn fs-topnav-cart-btn fs-topnav-hide-mobile" onClick={onCartOpen}>
            <i className="ti ti-shopping-cart" aria-hidden="true" />
            Cart
            {cartCount > 0 && <span className="fs-cart-badge">{cartCount}</span>}
          </button>
        </>
      )}
    </div>
    {/* Bottom nav already covers Home/Categories/Wishlist/Cart/Account on mobile —
        hide the duplicate top-nav buttons there; kept in JSX for desktop. */}
    <style>{`
      @media (max-width: 768px) {
        .fs-topnav-hide-mobile { display: none !important; }
      }
    `}</style>
  </header>
);

// ── ASK ASSISTANT BAR ──
const AskAssistant = ({ onAsk, greetingName }) => {
  const [text, setText] = useState('');
  const submit = () => { if (text.trim()) onAsk({ text: text.trim() }); };

  return (
    <div className="fs-assistant">
      <div className="fs-assistant-greet">
        {greetingName ? `Hi ${greetingName} 👋 What are you shopping for today?` : '👋 What are you shopping for today?'}
      </div>
      <div className="fs-assistant-input-row">
        <input
          className="fs-assistant-input"
          placeholder={'e.g. "a gift for my mum under GH₵100"'}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        />
        <button className="fs-assistant-go" onClick={submit}>
          <i className="ti ti-arrow-right" aria-hidden="true" />
        </button>
      </div>
      <div className="fs-assistant-chips">
        {ASK_CHIPS.map(chip => (
          <button key={chip.label} className="fs-assistant-chip" onClick={() => onAsk({ filter: chip.filter })}>
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ── SUB NAVBAR ──
const SubNav = ({ activeNav, onAction }) => (
  <nav className="fs-subnav">
    {NAV_LINKS.map(link => (
      <button
        key={link.label}
        className={`fs-subnav-link ${activeNav === link.label ? 'active' : ''}`}
        onClick={() => onAction(link)}
      >{link.label}</button>
    ))}
    <span className="fs-currency-label">GH₵</span>
  </nav>
);

// ── HERO SLIDER ──
const HeroSlider = ({ productCount, onShopNow, onExploreDeals }) => {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef();

  useEffect(() => {
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % SLIDES.length), 5000);
    return () => clearInterval(timerRef.current);
  }, []);

  return (
    <div className="fs-hero">
      <div className="fs-hero-slides">
        {SLIDES.map((slide, i) => (
          <div
            key={i}
            className={`fs-hero-slide ${i === current ? 'active' : ''}`}
            style={{ background: slide.bg }}
          >
            <div className="fs-hero-content">
              <div className="fs-hero-badge">{slide.badge}</div>
              <div className="fs-hero-title">
                {slide.title.split('\n').map((line, j) => <span key={j}>{line}<br /></span>)}
              </div>
              <div className="fs-hero-sub">{slide.sub}</div>
              <div className="fs-hero-btns">
                <button className="fs-hero-btn-primary" onClick={onShopNow}>Shop Now</button>
                <button className="fs-hero-btn-secondary" onClick={onExploreDeals}>Explore Deals</button>
              </div>
            </div>
            <div className="fs-hero-visual">
              <div className="fs-hero-emoji">{slide.emoji}</div>
              <div className="fs-hero-pill">⭐ Best Prices in Ghana</div>
            </div>
          </div>
        ))}
        <div className="fs-hero-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`fs-hero-dot ${i === current ? 'active' : ''}`}
              onClick={() => setCurrent(i)}
            />
          ))}
        </div>
      </div>
      <div className="fs-trust-bar">
        <div className="fs-trust-bar-item">🔥 Top Deals</div>
        <div className="fs-trust-bar-item">✅ Verified Store</div>
        <div className="fs-trust-bar-item">🚚 Fast Delivery</div>
        <div className="fs-trust-bar-item">📱 MoMo Accepted</div>
      </div>
    </div>
  );
};

// ── CATEGORY STRIP ──
const CategoryStrip = ({ active, onChange }) => (
  <div className="fs-cat-strip">
    {CATEGORIES.map(cat => (
      <button
        key={cat.name}
        className={`fs-cat-card ${active === cat.name ? 'active' : ''}`}
        onClick={() => onChange(cat.name)}
      >
        <div className="fs-cat-img-wrap">{cat.emoji}</div>
        <div className="fs-cat-name">{cat.name}</div>
      </button>
    ))}
  </div>
);

// ── STOCK BADGE ──
// Related products for the product modal: same category first, then the
// best-rated other in-stock items to fill the row.
const getRelatedProducts = (product, all, limit = 4) => {
  const inStock = all.filter(p => p.id !== product.id && p.stock_quantity > 0);
  const sameCat = inStock.filter(p => p.category && p.category === product.category);
  const others = inStock.filter(p => !sameCat.includes(p)).sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return [...sameCat, ...others].slice(0, limit);
};

// Price filter boxes: blank / 0 / junk means "no limit".
const parsePrice = (v) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : null; };

const StockBadge = ({ qty, threshold }) => {
  if (qty === 0) return <div className="fs-stock-out">🔴 Out of Stock</div>;
  if (qty <= threshold) return <div className="fs-stock-low">🟡 Only {qty} left</div>;
  return null;
};

// ── PRODUCT CARD ──
const ProductCard = ({ product, onAdd, onClick, wishlist, onWishlist }) => {
  const [flipped, setFlipped] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const isOut = product.stock_quantity === 0;
  const emoji = getEmoji(product);
  const isImg = product.image_url && product.image_url.startsWith('http');
  const discount = getDiscount(parseFloat(product.price), parseFloat(product.compare_price));
  const isWishlisted = wishlist.includes(product.id);

  // Shared by both Add to Cart buttons (front and back face) — gives a
  // brief, visible confirmation, since neither button gave any feedback
  // before and the cart drawer doesn't open automatically.
  const handleAdd = () => {
    onAdd(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
  };

  // Opening the full modal from the back face shouldn't leave the card
  // stuck flipped once the modal closes and the grid is visible again.
  const handleViewFull = () => {
    setFlipped(false);
    onClick(product);
  };

  return (
    <div className={`fs-card-flip ${flipped ? 'flipped' : ''}`}>
      <div className="fs-card-flip-inner">
        {/* ── FRONT ── */}
        <div className="fs-card fs-card-face fs-card-front" onClick={() => onClick(product)}>
          <div className="fs-card-img-wrap">
            {isImg
              ? <img className="fs-card-img" src={product.image_url} alt={product.name} />
              : <div className="fs-card-emoji">{emoji}</div>
            }
            <button
              className={`fs-card-wishlist ${isWishlisted ? 'active' : ''}`}
              onClick={e => { e.stopPropagation(); onWishlist(product.id); }}
              aria-label="Wishlist"
            >
              <i className={`ti ti-heart${isWishlisted ? '-filled' : ''}`} aria-hidden="true" />
            </button>
            <button
              className="fs-card-flip-btn"
              onClick={e => { e.stopPropagation(); setFlipped(true); }}
              aria-label="View details"
            >
              <i className="ti ti-info-circle" aria-hidden="true" />
            </button>
            {discount && <div className="fs-card-discount">-{discount}%</div>}
            {product.badge && <div className="fs-card-badge-pill">{product.badge}</div>}
          </div>
          <div className="fs-card-body">
            <div className="fs-card-name">{product.name}</div>
            {product.rating > 0 && (
              <div className="fs-stars">
                {renderStars(product.rating)}
                <span className="fs-review-count">({product.review_count})</span>
              </div>
            )}
            <StockBadge qty={product.stock_quantity} threshold={product.low_stock_threshold} />
            <div className="fs-card-price-row">
              <span className="fs-card-price">GH₵ {parseFloat(product.price).toFixed(2)}</span>
              {product.compare_price && (
                <span className="fs-card-compare">GH₵ {parseFloat(product.compare_price).toFixed(2)}</span>
              )}
              {discount && <span className="fs-card-savings">-{discount}%</span>}
            </div>
            <button
              className={`fs-card-add ${justAdded ? 'added' : ''}`}
              disabled={isOut}
              onClick={e => { e.stopPropagation(); handleAdd(); }}
            >
              <i className={`ti ti-${justAdded ? 'check' : 'shopping-cart'}`} aria-hidden="true" />
              {isOut ? 'Out of Stock' : justAdded ? 'Added!' : 'Add to Cart'}
            </button>
          </div>
        </div>

        {/* ── BACK ── */}
        <div className="fs-card fs-card-face fs-card-back">
          <button className="fs-card-flip-back-btn" onClick={() => setFlipped(false)} aria-label="Back to product">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
          <div className="fs-card-back-name">{product.name}</div>
          {product.category && <div className="fs-card-back-category">{product.category}</div>}
          <div className="fs-card-back-desc">
            {product.description || 'No description available for this product yet.'}
          </div>
          <div className="fs-card-back-stock">
            {isOut ? '❌ Out of stock' : `✅ ${product.stock_quantity} in stock`}
          </div>
          <div className="fs-card-price-row" style={{ marginTop: 'auto' }}>
            <span className="fs-card-price">GH₵ {parseFloat(product.price).toFixed(2)}</span>
          </div>
          <button
            className={`fs-card-add ${justAdded ? 'added' : ''}`}
            disabled={isOut}
            onClick={handleAdd}
          >
            <i className={`ti ti-${justAdded ? 'check' : 'shopping-cart'}`} aria-hidden="true" />
            {isOut ? 'Out of Stock' : justAdded ? 'Added!' : 'Add to Cart'}
          </button>
          <button className="fs-card-back-fulldetails" onClick={handleViewFull}>
            View Full Details →
          </button>
        </div>
      </div>
    </div>
  );
};

// ── ORDER HISTORY PANEL ──
const OrderHistoryPanel = ({ phone, onClose }) => {
  const [orders, setOrders] = useState(null); // null = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/pos/order-history?phone=${encodeURIComponent(phone)}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.success) setOrders(data.orders);
        else setError(data.message || 'Could not load your orders');
      })
      .catch(() => { if (!cancelled) setError('Could not reach the server'); });
    return () => { cancelled = true; };
  }, [phone]);

  return (
    <div className="fs-modal-overlay" onClick={onClose}>
      <div className="fs-wishlist-panel" onClick={e => e.stopPropagation()}>
        <div className="fs-wishlist-header">
          <h2 className="fs-wishlist-title">🧾 Your Orders</h2>
          <button className="fs-modal-close" onClick={onClose}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: -10, marginBottom: 16 }}>
          Shows self-checkout tickets. Orders placed via WhatsApp aren't tracked here yet.
        </p>
        {orders === null && !error && (
          <div className="fs-loading"><div className="fs-spinner" /><span>Loading your orders...</span></div>
        )}
        {error && (
          <div className="fs-empty"><i className="ti ti-alert-circle" /><p>{error}</p></div>
        )}
        {orders && orders.length === 0 && (
          <div className="fs-empty"><i className="ti ti-receipt" /><p>No self-checkout orders found for this number yet</p></div>
        )}
        {orders && orders.length > 0 && (
          <div className="fs-order-history-list">
            {orders.map(o => (
              <div className="fs-order-history-row" key={o.sale_number}>
                <div>
                  <div className="fs-order-history-num">{o.sale_number}</div>
                  <div className="fs-order-history-date">{new Date(o.created_at).toLocaleString()}</div>
                  <div className="fs-order-history-items">
                    {(Array.isArray(o.items) ? o.items : []).map(i => `${i.quantity}× ${i.product_name}`).join(', ')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="fs-order-history-total">GH₵ {parseFloat(o.total_amount).toFixed(2)}</div>
                  <div className={`fs-order-history-status ${o.status}`}>{o.status.replace('_', ' ')}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── WISHLIST PANEL ──
const WishlistPanel = ({ products, wishlist, onClose, onAdd, onWishlist, onProductClick }) => {
  const items = products.filter(p => wishlist.includes(p.id));
  return (
    <div className="fs-modal-overlay" onClick={onClose}>
      <div className="fs-wishlist-panel" onClick={e => e.stopPropagation()}>
        <div className="fs-wishlist-header">
          <h2 className="fs-wishlist-title">❤️ Your Wishlist</h2>
          <button className="fs-modal-close" onClick={onClose}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        {items.length === 0 ? (
          <div className="fs-empty">
            <i className="ti ti-heart" />
            <p>Nothing saved yet — tap the heart on any product to add it here</p>
          </div>
        ) : (
          <div className="fs-product-grid fs-wishlist-grid">
            {items.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                onAdd={onAdd}
                onClick={onProductClick}
                wishlist={wishlist}
                onWishlist={onWishlist}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── CHECKOUT PANEL (delivery order, 3-step flow) ──
// Replaces the old single long form. Steps: 1 Contact → 2 Delivery →
// 3 Pay & review. Each step validates before moving on; the delivery
// zone is optional (fee is then confirmed after the order is placed).
const CHECKOUT_STEPS = ['Contact', 'Delivery', 'Pay & Review'];

const CheckoutPanel = ({ items, total, customer, onBack, onClose, onOrderPlaced }) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [zones, setZones] = useState([]);
  const [zoneName, setZoneName] = useState('');
  const [address, setAddress] = useState('');
  const [payMethod, setPayMethod] = useState('momo');
  const [momoRef, setMomoRef] = useState('');
  const [errors, setErrors] = useState({});
  // Promo code: previewed via /api/promo/validate; the server re-checks and
  // applies the real discount when the order is placed.
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState(null); // { code, discount }
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(null);
  const [snapshot, setSnapshot] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/storefront/delivery-zones`)
      .then(res => res.json())
      .then(data => { if (data.success) setZones(data.zones); })
      .catch(() => {});
  }, []);

  const zone = zones.find(z => z.name === zoneName);
  const fee = zone ? parseFloat(zone.fee) : null;
  const promoDiscount = promo ? promo.discount : 0;
  const grandTotal = total - promoDiscount + (fee || 0);
  const cleanPhone = normalizeGhanaPhone(phone);

  const validate = (s) => {
    const e = {};
    if (s === 0) {
      if (!name.trim()) e.name = 'Enter your name';
      if (!phone.trim()) e.phone = 'Enter your phone number';
      else if (!cleanPhone) e.phone = 'Use a valid Ghana number, e.g. 0244123456';
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'That doesn\'t look like a valid email';
    }
    if (s === 1) {
      if (!address.trim()) e.address = 'Tell us where to deliver';
    }
    if (s === 2) {
      if (payMethod === 'momo' && !momoRef.trim()) e.momoRef = 'Enter your MoMo transaction ID';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate(step)) setStep(step + 1); };
  const back = () => { setErrors({}); setSubmitError(''); step === 0 ? onBack() : setStep(step - 1); };

  const applyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      const res = await fetch(`${API_BASE}/api/promo/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoInput.trim(), subtotal: total }),
      });
      let data;
      try { data = await res.json(); }
      catch { throw new Error('Could not check that code right now — please try again'); }
      if (!res.ok || !data.success) throw new Error(data.message || "That promo code isn't valid");
      setPromo({ code: data.code, discount: data.discount });
      setPromoInput('');
    } catch (err) {
      setPromo(null);
      setPromoError(err.message);
    } finally {
      setPromoLoading(false);
    }
  };

  const placeOrder = async () => {
    if (!validate(2)) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${API_BASE}/api/storefront/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: name.trim(), phone: cleanPhone, email: email.trim() || undefined },
          items: items.map(i => ({ product_id: i.id, quantity: i.qty })),
          delivery_zone_name: zoneName || undefined,
          delivery_address: address.trim(),
          payment_method: payMethod,
          momo_reference: payMethod === 'momo' ? momoRef.trim() : undefined,
          promo_code: promo ? promo.code : undefined,
        }),
      });
      let data;
      try { data = await res.json(); }
      catch { throw new Error('Checkout is unavailable right now. Please try again, or message us on WhatsApp.'); }
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not place order');
      setSnapshot(items.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })));
      setPlaced(data.order);
      onOrderPlaced();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const styles = `
    .co-wrap { display: flex; flex-direction: column; height: 100%; }
    .co-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--border, #e5e7eb); }
    .co-head-title { font-weight: 800; font-size: 16px; flex: 1; }
    .co-iconbtn { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text, #111827); padding: 4px; }
    .co-steps { display: flex; padding: 14px 16px 6px; gap: 6px; }
    .co-step { flex: 1; text-align: center; font-size: 11px; color: #9ca3af; font-weight: 600; }
    .co-step .bar { height: 4px; border-radius: 4px; background: #e5e7eb; margin-bottom: 6px; }
    .co-step.done .bar, .co-step.active .bar { background: var(--accent, #7c3aed); }
    .co-step.active, .co-step.done { color: var(--text, #111827); }
    .co-body { flex: 1; overflow-y: auto; padding: 14px 16px; }
    .co-h { font-size: 18px; font-weight: 800; margin: 4px 0 2px; }
    .co-sub { font-size: 13px; color: #6b7280; margin: 0 0 14px; }
    .co-field { margin-bottom: 12px; }
    .co-label { display: block; font-size: 12px; font-weight: 700; margin-bottom: 4px; }
    .co-input { width: 100%; box-sizing: border-box; padding: 12px; border: 1.5px solid var(--border, #e5e7eb); border-radius: 10px; font: inherit; background: var(--white, #fff); }
    .co-input:focus { outline: none; border-color: var(--accent, #7c3aed); }
    .co-input.err { border-color: #dc2626; }
    .co-err { color: #dc2626; font-size: 12px; margin-top: 4px; }
    .co-opt { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1.5px solid var(--border, #e5e7eb); border-radius: 10px; margin-bottom: 8px; cursor: pointer; background: var(--white, #fff); width: 100%; text-align: left; font: inherit; }
    .co-opt.sel { border-color: var(--accent, #7c3aed); background: rgba(124,58,237,0.06); }
    .co-radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #d1d5db; flex-shrink: 0; }
    .co-opt.sel .co-radio { border-color: var(--accent, #7c3aed); background: radial-gradient(var(--accent, #7c3aed) 45%, transparent 50%); }
    .co-opt-main { flex: 1; font-weight: 600; font-size: 14px; }
    .co-opt-note { font-size: 12px; color: #6b7280; font-weight: 400; }
    .co-opt-price { font-weight: 700; font-size: 13px; }
    .co-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; margin-bottom: 12px; }
    .co-row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; gap: 8px; }
    .co-row.total { font-weight: 800; font-size: 16px; border-top: 1px solid #e5e7eb; margin-top: 6px; padding-top: 8px; }
    .co-foot { padding: 12px 16px; border-top: 1px solid var(--border, #e5e7eb); background: var(--white, #fff); }
    .co-cta { width: 100%; padding: 14px; border: none; border-radius: 12px; background: #111827; color: #fff; font-weight: 800; font-size: 15px; cursor: pointer; }
    .co-cta:disabled { opacity: 0.6; cursor: default; }
    .co-banner { background: #fef2f2; color: #b91c1c; border-radius: 10px; padding: 10px 12px; font-size: 13px; margin-bottom: 10px; }
    .co-link { background: none; border: none; color: var(--accent, #7c3aed); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; padding: 0; text-decoration: underline; }
  `;

  // ── Confirmation ──
  if (placed) {
    return (
      <div className="co-wrap">
        <style>{styles}</style>
        <div className="co-body" style={{ textAlign: 'center', paddingTop: 28 }}>
          <div style={{ fontSize: 52 }}>✅</div>
          <h2 style={{ margin: '8px 0 4px' }}>Order placed!</h2>
          <p className="co-sub">
            {placed.payment_method === 'momo'
              ? "We'll verify your MoMo payment and get your order moving."
              : "Have the exact cash ready — you'll pay the rider on delivery."}
          </p>
          <div className="co-card" style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 20, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>{placed.order_number}</div>
            {snapshot.map(i => (
              <div className="co-row" key={i.id}><span>{i.qty}× {i.name}</span><span>GH₵ {(i.price * i.qty).toFixed(2)}</span></div>
            ))}
            {parseFloat(placed.discount_amount) > 0 && (
              <div className="co-row" style={{ color: '#15803d' }}><span>Discount ({placed.promo_code})</span><span>−GH₵ {parseFloat(placed.discount_amount).toFixed(2)}</span></div>
            )}
            <div className="co-row"><span>Delivery</span><span>{placed.delivery_fee != null && parseFloat(placed.delivery_fee) > 0 ? `GH₵ ${parseFloat(placed.delivery_fee).toFixed(2)}` : 'To be confirmed'}</span></div>
            <div className="co-row total"><span>Total</span><span>GH₵ {parseFloat(placed.total_amount).toFixed(2)}</span></div>
          </div>
          {!zoneName && <p className="co-sub">We'll confirm your delivery fee with you on {phone} before dispatch.</p>}
        </div>
        <div className="co-foot">
          <button
            className="fs-wa-checkout-btn"
            style={{ marginBottom: 8 }}
            onClick={() => window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Hi, I just placed order ${placed.order_number} — following up.`)}`, '_blank')}
          >
            <i className="ti ti-brand-whatsapp" aria-hidden="true" /> Message us about this order
          </button>
          <button className="co-cta" onClick={onClose}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="co-wrap">
      <style>{styles}</style>
      <div className="co-head">
        <button className="co-iconbtn" onClick={back} aria-label="Back">←</button>
        <div className="co-head-title">Checkout</div>
        <button className="co-iconbtn" onClick={onClose} aria-label="Close"><i className="ti ti-x" aria-hidden="true" /></button>
      </div>
      <div className="co-steps">
        {CHECKOUT_STEPS.map((label, i) => (
          <div key={label} className={`co-step ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`}>
            <div className="bar" />{label}
          </div>
        ))}
      </div>

      <div className="co-body">
        {step === 0 && (
          <>
            <div className="co-h">Who's ordering?</div>
            <p className="co-sub">We'll use this to reach you about your delivery.</p>
            <div className="co-field">
              <label className="co-label">Full name</label>
              <input className={`co-input ${errors.name ? 'err' : ''}`} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ama Mensah" autoComplete="name" />
              {errors.name && <div className="co-err">{errors.name}</div>}
            </div>
            <div className="co-field">
              <label className="co-label">Phone number</label>
              <input className={`co-input ${errors.phone ? 'err' : ''}`} value={phone} onChange={e => setPhone(e.target.value)} placeholder="0244123456" inputMode="tel" autoComplete="tel" />
              {errors.phone && <div className="co-err">{errors.phone}</div>}
            </div>
            <div className="co-field">
              <label className="co-label">Email <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional — for your order receipt)</span></label>
              <input className={`co-input ${errors.email ? 'err' : ''}`} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@gmail.com" inputMode="email" autoComplete="email" />
              {errors.email && <div className="co-err">{errors.email}</div>}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="co-h">Where should we deliver?</div>
            <p className="co-sub">Pick your area to see the delivery fee — or skip it and we'll confirm the fee with you.</p>
            <button className={`co-opt ${zoneName === '' ? 'sel' : ''}`} onClick={() => setZoneName('')}>
              <span className="co-radio" />
              <span className="co-opt-main">Not sure yet<div className="co-opt-note">We'll confirm the fee before dispatch</div></span>
            </button>
            {zones.map(z => (
              <button key={z.id} className={`co-opt ${zoneName === z.name ? 'sel' : ''}`} onClick={() => setZoneName(z.name)}>
                <span className="co-radio" />
                <span className="co-opt-main">{z.name}</span>
                <span className="co-opt-price">GH₵ {parseFloat(z.fee).toFixed(2)}</span>
              </button>
            ))}
            <div className="co-field" style={{ marginTop: 14 }}>
              <label className="co-label">Delivery address</label>
              <textarea className={`co-input ${errors.address ? 'err' : ''}`} rows={3} value={address} onChange={e => setAddress(e.target.value)} placeholder="House number, street, landmark" style={{ resize: 'vertical' }} />
              {errors.address && <div className="co-err">{errors.address}</div>}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="co-h">Pay & review</div>
            <p className="co-sub">Choose how you'd like to pay.</p>
            <button className={`co-opt ${payMethod === 'momo' ? 'sel' : ''}`} onClick={() => setPayMethod('momo')}>
              <span className="co-radio" />
              <span className="co-opt-main">📱 Mobile Money<div className="co-opt-note">Pay now, then enter your transaction ID</div></span>
            </button>
            <button className={`co-opt ${payMethod === 'cod' ? 'sel' : ''}`} onClick={() => setPayMethod('cod')}>
              <span className="co-radio" />
              <span className="co-opt-main">💵 Cash on Delivery<div className="co-opt-note">Pay the rider when it arrives</div></span>
            </button>
            {payMethod === 'momo' && (
              <div className="co-field">
                <label className="co-label">MoMo transaction ID</label>
                <input className={`co-input ${errors.momoRef ? 'err' : ''}`} value={momoRef} onChange={e => setMomoRef(e.target.value)} placeholder="From your payment confirmation SMS" />
                {errors.momoRef && <div className="co-err">{errors.momoRef}</div>}
                <div style={{ marginTop: 6 }}>
                  <button className="co-link" onClick={() => window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Hi, please send me your MoMo payment details.')}`, '_blank')}>
                    Need our MoMo number? Ask on WhatsApp
                  </button>
                </div>
              </div>
            )}

            <div className="co-field" style={{ marginTop: 14 }}>
              <label className="co-label">Promo code <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
              {promo ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
                  <span style={{ color: '#15803d', fontWeight: 700 }}>✓ {promo.code} — you save GH₵ {promo.discount.toFixed(2)}</span>
                  <button className="co-link" onClick={() => { setPromo(null); setPromoError(''); }}>Remove</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className={`co-input ${promoError ? 'err' : ''}`}
                    value={promoInput}
                    onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') applyPromo(); }}
                    placeholder="Enter code"
                    autoCapitalize="characters"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={applyPromo}
                    disabled={promoLoading || !promoInput.trim()}
                    style={{ padding: '0 18px', borderRadius: 10, border: 'none', background: promoInput.trim() ? '#111827' : '#e5e7eb', color: promoInput.trim() ? '#fff' : '#9ca3af', fontWeight: 700, cursor: promoInput.trim() ? 'pointer' : 'default' }}
                  >
                    {promoLoading ? '…' : 'Apply'}
                  </button>
                </div>
              )}
              {promoError && <div className="co-err">{promoError}</div>}
            </div>

            <div className="co-card" style={{ marginTop: 12 }}>
              {items.map(i => (
                <div className="co-row" key={i.id}><span>{i.qty}× {i.name}</span><span>GH₵ {(i.price * i.qty).toFixed(2)}</span></div>
              ))}
              <div className="co-row" style={{ marginTop: 6 }}><span>Subtotal</span><span>GH₵ {total.toFixed(2)}</span></div>
              {promo && <div className="co-row" style={{ color: '#15803d' }}><span>Discount ({promo.code})</span><span>−GH₵ {promo.discount.toFixed(2)}</span></div>}
              <div className="co-row"><span>Delivery{zoneName ? ` (${zoneName})` : ''}</span><span>{fee != null ? `GH₵ ${fee.toFixed(2)}+` : 'To be confirmed'}</span></div>
              <div className="co-row total"><span>Total</span><span>GH₵ {grandTotal.toFixed(2)}{fee == null ? ' + delivery' : ''}</span></div>
            </div>
            <div className="co-card" style={{ fontSize: 13 }}>
              <div><strong>{name}</strong> · {phone}</div>
              <div style={{ color: '#6b7280', marginTop: 2 }}>{address}</div>
            </div>
          </>
        )}
      </div>

      <div className="co-foot">
        {submitError && <div className="co-banner">{submitError}</div>}
        {step < 2 ? (
          <button className="co-cta" onClick={next}>Continue</button>
        ) : (
          <button className="co-cta" onClick={placeOrder} disabled={submitting || !items.length}>
            {submitting ? 'Placing order…' : `Place Order — GH₵ ${grandTotal.toFixed(2)}`}
          </button>
        )}
      </div>
    </div>
  );
};

// ── INFO MODAL (Our Story / Terms / Privacy / Shipping) ──
// Full-screen scrollable page, reusing the fs-modal-overlay pattern.
// Shipping Info pulls real delivery-zone fees from the same endpoint
// the checkout form uses, so it never goes stale against actual rates.
const INFO_PAGES = {
  'our-story': {
    title: 'Our Story',
    emoji: '🛍️',
    render: () => (
      <>
        <p>Fleppystore started with a simple idea: Ghana deserves an online store that actually works — real stock levels, real delivery fees, and a real person on WhatsApp when something needs sorting out.</p>
        <p>We're built around Mobile Money and Cash on Delivery because that's how Ghana actually pays, and around WhatsApp because that's where our customers already are. Every order you place here is tracked, from "placed" to "on its way to you."</p>
        <p>We're still growing, and we read every message that comes through. If something's missing or doesn't work the way it should, tell us — that's exactly how this store gets better.</p>
      </>
    ),
  },
  terms: {
    title: 'Terms & Conditions',
    emoji: '📄',
    render: () => (
      <>
        <p><strong>Orders.</strong> Placing an order through Fleppystore is an offer to buy at the listed price. We confirm your order once payment is verified (MoMo) or when it's created (Cash on Delivery).</p>
        <p><strong>Pricing & stock.</strong> Prices and stock levels can change without notice. If an item sells out after you've ordered it, we'll contact you on WhatsApp to adjust or refund that item.</p>
        <p><strong>Payment.</strong> We accept Mobile Money and Cash on Delivery. For MoMo orders, your order is confirmed once we've verified the transaction. For Cash on Delivery, have the exact amount ready for the rider.</p>
        <p><strong>Delivery.</strong> Delivery fees depend on your zone and are shown at checkout, or confirmed with you directly if your zone isn't listed yet. Delivery times are estimates, not guarantees — see Shipping Info for details.</p>
        <p><strong>Cancellations & returns.</strong> Contact us on WhatsApp as soon as possible to cancel or change an order — we can only act before it's dispatched. For returns, see our Returns option in Customer Care.</p>
        <p><strong>Changes.</strong> We may update these terms as the store grows. Continuing to order from Fleppystore after a change means you accept the updated terms.</p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy Policy',
    emoji: '🔒',
    render: () => (
      <>
        <p><strong>What we collect.</strong> Your name, phone number, delivery address, and order details — only what's needed to get your order to you and follow up if something's wrong.</p>
        <p><strong>How we use it.</strong> To process and deliver your order, verify MoMo payments, contact you about order status, and keep a record for returns or support. We don't sell your information to anyone.</p>
        <p><strong>WhatsApp.</strong> Messages you send us on WhatsApp are used to help with your order and aren't shared outside that purpose.</p>
        <p><strong>Storage.</strong> Your details are stored securely and kept only as long as needed to serve you and meet our own record-keeping needs.</p>
        <p><strong>Your choices.</strong> You can ask us to update or delete your account details at any time by messaging us on WhatsApp or using Account settings in the app.</p>
      </>
    ),
  },
};

const InfoModal = ({ page, onClose }) => {
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(page === 'shipping');

  useEffect(() => {
    if (page !== 'shipping') return;
    fetch(`${API_BASE}/api/storefront/delivery-zones`)
      .then(res => res.json())
      .then(data => { if (data.success) setZones(data.zones); })
      .catch(() => {})
      .finally(() => setZonesLoading(false));
  }, [page]);

  const info = INFO_PAGES[page];

  return (
    <div className="fs-modal-overlay" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--white, #fff)', borderRadius: 16, width: '100%', maxWidth: 560,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
          <span style={{ fontSize: 22 }}>{page === 'shipping' ? '🚚' : info.emoji}</span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, flex: 1 }}>{page === 'shipping' ? 'Shipping Info' : info.title}</h2>
          <button className="fs-modal-close" onClick={onClose} style={{ position: 'static' }}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', lineHeight: 1.6, color: 'var(--text, #111827)' }}>
          {page === 'shipping' ? (
            <>
              <p>Delivery fees depend on your zone and are calculated automatically at checkout. If your area isn't listed yet, we'll confirm the fee with you directly on WhatsApp before dispatch — no surprise charges.</p>
              <p><strong>Current delivery zones:</strong></p>
              {zonesLoading ? (
                <p style={{ color: '#6b7280' }}>Loading current rates…</p>
              ) : zones.length === 0 ? (
                <p style={{ color: '#6b7280' }}>We'll confirm your delivery fee directly on WhatsApp once you place your order.</p>
              ) : (
                <div style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, overflow: 'hidden' }}>
                  {zones.map((z, idx) => (
                    <div
                      key={z.id}
                      style={{
                        display: 'flex', justifyContent: 'space-between', padding: '10px 14px', fontSize: 14,
                        borderTop: idx === 0 ? 'none' : '1px solid var(--border, #e5e7eb)',
                      }}
                    >
                      <span>{z.name}</span>
                      <span style={{ fontWeight: 700 }}>GH₵ {parseFloat(z.fee).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ marginTop: 14 }}>Orders typically leave our hands within 24 hours of confirmation. Delivery time after that depends on your zone and rider availability — message us on WhatsApp any time for a live update on your order.</p>
            </>
          ) : info.render()}
        </div>
      </div>
    </div>
  );
};


// ── CALL AN ASSISTANT (Store Mode only) ──
// Standard self-checkout kiosk pattern: a persistent floating button a
// customer can tap any time to flag down a teller, with a quick reason
// and a cooldown so one tap can't spam the staff dashboard.
const ASSIST_REASONS = ['Price check', "Can't find an item", 'Payment issue', 'Other'];
const ASSIST_COOLDOWN_MS = 60 * 1000;

const CallAssistantButton = () => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [cooling, setCooling] = useState(false);
  const [error, setError] = useState('');
  const coolTimer = useRef(null);

  // Cooldown is real state with a timer — previously it was computed from
  // Date.now() during render, so nothing re-rendered when it expired and the
  // button stayed disabled until some unrelated update happened.
  useEffect(() => () => { if (coolTimer.current) clearTimeout(coolTimer.current); }, []);

  const closeAll = () => {
    setOpen(false);
    setSentOk(false);
    setReason('');
    setCustomReason('');
    setError('');
  };

  const send = async () => {
    setSending(true);
    setError('');
    try {
      const finalReason = reason === 'Other' ? customReason.trim() : reason;
      const res = await fetch(`${API_BASE}/api/assistance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: finalReason || null }),
      });
      let data;
      try { data = await res.json(); } catch { throw new Error('Could not reach a teller — please try again'); }
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not reach a teller — please try again');
      setSentOk(true);
      setCooling(true);
      coolTimer.current = setTimeout(() => setCooling(false), ASSIST_COOLDOWN_MS);
    } catch (err) {
      setError(err.message || 'Could not reach a teller — please try again');
    } finally {
      setSending(false);
    }
  };

  const canSend = !!reason && !sending;

  return (
    <>
      <button
        type="button"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 900,
          borderRadius: 999, padding: '14px 20px', border: 'none', color: '#fff',
          background: cooling ? '#6b7280' : '#111827', fontWeight: 700, fontSize: 14,
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}
        onClick={() => setOpen(true)}
      >
        🙋 {cooling ? 'Teller notified — tap to call again' : 'Call an Assistant'}
      </button>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={closeAll}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 380, padding: 20 }}
          >
            {sentOk ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 44 }}>✅</div>
                <h2 style={{ margin: '6px 0 4px', fontSize: 18, fontWeight: 800 }}>A teller has been notified</h2>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>Someone will be with you shortly. Please stay at this kiosk.</p>
                <button type="button" onClick={closeAll} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#111827', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>🙋 Call an Assistant</h2>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6b7280' }}>A teller will come to this kiosk. What do you need help with?</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {ASSIST_REASONS.map(r => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setReason(r)}
                      style={{
                        padding: '10px 16px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                        border: reason === r ? '2px solid #7c3aed' : '2px solid #e5e7eb',
                        background: reason === r ? '#7c3aed' : '#fff',
                        color: reason === r ? '#fff' : '#111827',
                      }}
                    >
                      {reason === r ? '✓ ' : ''}{r}
                    </button>
                  ))}
                </div>
                {reason === 'Other' && (
                  <input
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                    placeholder="Briefly, what do you need?"
                    style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, marginBottom: 12 }}
                  />
                )}
                {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
                <button
                  type="button"
                  onClick={send}
                  disabled={!canSend}
                  style={{
                    width: '100%', padding: 14, borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 15,
                    background: canSend ? '#111827' : '#e5e7eb', color: canSend ? '#fff' : '#9ca3af',
                    cursor: canSend ? 'pointer' : 'not-allowed',
                  }}
                >
                  {sending ? 'Notifying…' : reason ? 'Notify a Teller' : 'Pick a reason above'}
                </button>
                <button type="button" onClick={closeAll} style={{ marginTop: 10, width: '100%', background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// ── CART DRAWER ──
const CartDrawer = ({ open, onClose, items, onQty, onRemove, total, customer, storeMode, onDone }) => {
  const [ticket, setTicket] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [selfCheckoutError, setSelfCheckoutError] = useState('');

  const [deliveryFormOpen, setDeliveryFormOpen] = useState(false);

  const handleCheckout = () => {
    if (!items.length) return;
    window.open(buildWAMessage(items, total), '_blank');
  };

  const handleSelfCheckout = async () => {
    if (!items.length) return;
    setCheckingOut(true);
    setSelfCheckoutError('');
    try {
      const res = await fetch(`${API_BASE}/api/pos/self-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ product_id: i.id, quantity: i.qty })),
          // Extra fields are harmless if posController doesn't read them yet —
          // wire these in server-side later if you want the ticket to carry
          // the customer's name/phone for the cashier.
          customer_name: customer?.name,
          customer_phone: customer?.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not create ticket');
      setTicket(data.sale);
      items.forEach(i => onRemove(i.id)); // ticket's issued — clear the cart so it can't be double-submitted
    } catch (err) {
      setSelfCheckoutError(err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <>
      <div className={`fs-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`fs-cart-drawer ${open ? 'open' : ''}`}>
        {deliveryFormOpen ? (
          <CheckoutPanel
            items={items}
            total={total}
            customer={customer}
            onBack={() => setDeliveryFormOpen(false)}
            onClose={() => { setDeliveryFormOpen(false); onClose(); }}
            onOrderPlaced={() => items.forEach(i => onRemove(i.id))}
          />
        ) : (
        <>
        <div className="fs-cart-head">
          <div className="fs-cart-head-title">🛒 My Cart ({items.reduce((s, i) => s + i.qty, 0)})</div>
          <button className="fs-cart-close" onClick={onClose}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        <div className="fs-cart-body">
          {items.length === 0 ? (
            <div className="fs-empty">
              <i className="ti ti-shopping-cart" />
              <p>Your cart is empty</p>
            </div>
          ) : items.map(item => {
            const emoji = getEmoji(item);
            const isImg = item.image_url && item.image_url.startsWith('http');
            return (
              <div className="fs-cart-item" key={item.id}>
                <div className="fs-cart-item-img">
                  {isImg ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : emoji}
                </div>
                <div className="fs-cart-item-info">
                  <div className="fs-cart-item-name">{item.name}</div>
                  <div className="fs-cart-item-price">GH₵ {(item.price * item.qty).toFixed(2)}</div>
                  <div className="fs-cart-qty">
                    <button className="fs-qty-btn" onClick={() => onQty(item.id, item.qty - 1)}>−</button>
                    <span className="fs-qty-num">{item.qty}</span>
                    <button className="fs-qty-btn" onClick={() => onQty(item.id, item.qty + 1)}>+</button>
                  </div>
                </div>
                <button className="fs-cart-del" onClick={() => onRemove(item.id)}>
                  <i className="ti ti-trash" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="fs-cart-foot">
          {(
            <>
              <div className="fs-cart-subtotal">
                <span>Subtotal</span>
                <span>GH₵ {total.toFixed(2)}</span>
              </div>
              <div className="fs-cart-subtotal">
                <span>Delivery</span>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>Calculated at checkout</span>
              </div>
              <div className="fs-cart-total">
                <span className="fs-cart-total-label">Total</span>
                <span className="fs-cart-total-val">GH₵ {total.toFixed(2)}</span>
              </div>
              <button
                className="fs-wa-checkout-btn"
                onClick={() => setDeliveryFormOpen(true)}
                disabled={!items.length}
                style={{ background: '#111827' }}
              >
                🚚 Deliver to Me
              </button>
              <button className="fs-wa-checkout-btn" onClick={handleCheckout} disabled={!items.length} style={{ marginTop: 8 }}>
                <i className="ti ti-brand-whatsapp" aria-hidden="true" />
                Ask a Question on WhatsApp
              </button>
              <button
                className="fs-wa-checkout-btn"
                onClick={handleSelfCheckout}
                disabled={!items.length || checkingOut}
                style={{ background: 'var(--white)', color: 'var(--text)', border: '1.5px solid var(--border)', marginTop: 8 }}
              >
                {checkingOut ? 'Getting your ticket…' : "🏪 I'm in the store — Self-Checkout"}
              </button>
              {selfCheckoutError && (
                <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{selfCheckoutError}</p>
              )}
              <div className="fs-cart-trust">
                <span>🔒 100% Secure</span>
                <span>📱 MoMo Accepted</span>
              </div>
            </>
          )}
        </div>
        </>
        )}

        {ticket && (
          <div style={{
            position: 'fixed', inset: 0, background: '#fff', zIndex: 2000,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
          }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🎫</div>
            <h2 style={{ margin: '0 0 4px' }}>{customer ? `Thanks, ${customer.name.split(' ')[0]}! Show this to a cashier` : 'Show this to a cashier'}</h2>
            <p style={{ color: '#6b7280', marginBottom: 24 }}>They'll ring you up and take your payment</p>
            <div style={{ background: '#f9fafb', border: '2px dashed #d1d5db', borderRadius: 12, padding: '20px 32px', marginBottom: 24 }}>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 1 }}>{ticket.sale_number}</div>
            </div>
            <div style={{ width: '100%', maxWidth: 320, marginBottom: 24, textAlign: 'left' }}>
              {(typeof ticket.items === 'string' ? JSON.parse(ticket.items) : ticket.items).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
                  <span>{item.quantity}x {item.product_name}</span>
                  <span>GH₵ {parseFloat(item.subtotal).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18, borderTop: '1px solid #e5e7eb', marginTop: 8, paddingTop: 8 }}>
                <span>Total</span><span>GH₵ {parseFloat(ticket.total_amount).toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={() => { setTicket(null); onClose(); if (storeMode) onDone?.(); }}
              style={{ padding: '12px 32px', borderRadius: 10, border: 'none', background: '#111827', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              {storeMode ? "Done — next customer" : 'Done'}
            </button>
            {storeMode && (
              <p style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>This kiosk will reset for the next shopper.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
};

// ── PRODUCT MODAL ──
const ProductModal = ({ product, onClose, onAdd, related, onSelectRelated }) => {
  const [qty, setQty] = useState(1);
  const [selectedPay, setSelectedPay] = useState('momo');
  const [activeImg, setActiveImg] = useState(0);

  if (!product) return null;

  const isOut = product.stock_quantity === 0;
  const emoji = getEmoji(product);
  // Real gallery: `images` (text[]) holds every photo for this product;
  // fall back to the single image_url, then to no photos at all (emoji).
  const gallery = (Array.isArray(product.images) && product.images.length > 0)
    ? product.images
    : (product.image_url ? [product.image_url] : []);
  const hasPhotos = gallery.length > 0;
  const currentImg = gallery[Math.min(activeImg, gallery.length - 1)];
  const discount = getDiscount(parseFloat(product.price), parseFloat(product.compare_price));

  const handleAdd = () => {
    for (let i = 0; i < qty; i++) onAdd(product);
    // "Pay with" isn't just decorative — picking WhatsApp here means the
    // person wants to talk it through, not silently add to a cart they
    // may not check.
    if (selectedPay === 'whatsapp') {
      handleWA();
    } else {
      onClose();
    }
  };

  const handleWA = () => {
    const msg = `Hello Fleppystore! 👋\n\nI'm interested in:\n*${product.name}*\nPrice: GH₵ ${parseFloat(product.price).toFixed(2)}\nQty: ${qty}\n\nIs it available?`;
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fs-modal-overlay" onClick={onClose}>
      <div className="fs-modal" onClick={e => e.stopPropagation()}>
        {/* Gallery */}
        <div className="fs-modal-gallery">
          {discount && <div className="fs-card-discount" style={{ position: 'absolute', top: 12, left: 12 }}>-{discount}%</div>}
          {product.badge && <div className="fs-card-badge-pill" style={{ position: 'absolute', top: 12, right: 52 }}>{product.badge}</div>}
          <div className="fs-modal-main-img">
            {hasPhotos ? <img src={currentImg} alt={product.name} /> : emoji}
          </div>
          {gallery.length > 1 && (
            <div className="fs-modal-thumbs">
              {gallery.map((src, i) => (
                <div
                  key={src + i}
                  className={`fs-modal-thumb ${i === activeImg ? 'active' : ''}`}
                  onClick={() => setActiveImg(i)}
                >
                  <img src={src} alt="" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="fs-modal-info">
          <button className="fs-modal-close" onClick={onClose}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>

          <div className="fs-modal-badges">
            <StockBadge qty={product.stock_quantity} threshold={product.low_stock_threshold} />
            {product.badge && <span className="fs-modal-badge best">{product.badge}</span>}
          </div>

          <div className="fs-modal-name">{product.name}</div>

          {product.rating > 0 && (
            <div className="fs-stars">
              {renderStars(product.rating)}
              <span className="fs-review-count">({product.review_count} Reviews)</span>
            </div>
          )}

          <div className="fs-modal-price-row">
            <span className="fs-modal-price">GH₵ {parseFloat(product.price).toFixed(2)}</span>
            {product.compare_price && (
              <span className="fs-modal-compare">GH₵ {parseFloat(product.compare_price).toFixed(2)}</span>
            )}
            {discount && <span className="fs-modal-savings">You save {discount}%</span>}
          </div>

          {product.description && (
            <div className="fs-modal-desc">{product.description}</div>
          )}

          {(product.sku || product.category || product.barcode) && (
            <div className="fs-modal-specs">
              {product.category && (
                <div className="fs-modal-spec-row"><span>Category</span><span>{product.category}</span></div>
              )}
              {product.sku && (
                <div className="fs-modal-spec-row"><span>SKU</span><span>{product.sku}</span></div>
              )}
              {product.barcode && (
                <div className="fs-modal-spec-row"><span>Barcode</span><span>{product.barcode}</span></div>
              )}
            </div>
          )}

          <div className="fs-pay-label">Pay with</div>
          <div className="fs-pay-options">
            {[
              { id: 'momo', icon: '📱', label: 'MoMo' },
              { id: 'whatsapp', icon: '💬', label: 'WhatsApp' },
              { id: 'cash', icon: '💵', label: 'Cash' },
            ].map(p => (
              <div
                key={p.id}
                className={`fs-pay-opt ${selectedPay === p.id ? 'active' : ''}`}
                onClick={() => setSelectedPay(p.id)}
              >
                <div className="fs-pay-opt-icon">{p.icon}</div>
                <div className="fs-pay-opt-label">{p.label}</div>
              </div>
            ))}
          </div>

          <div className="fs-modal-qty-row">
            <span className="fs-modal-qty-label">Quantity</span>
            <div className="fs-modal-qty">
              <button className="fs-modal-qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
              <span className="fs-modal-qty-num">{qty}</span>
              <button className="fs-modal-qty-btn" onClick={() => setQty(q => q + 1)}>+</button>
            </div>
          </div>

          <div className="fs-modal-actions">
            <button className="fs-modal-add-btn" disabled={isOut} onClick={handleAdd}>
              <i className={`ti ti-${selectedPay === 'whatsapp' ? 'brand-whatsapp' : 'shopping-cart'}`} aria-hidden="true" />
              {isOut ? 'Out of Stock' : selectedPay === 'whatsapp' ? 'Continue on WhatsApp' : 'Add to Cart'}
            </button>
            <button className="fs-modal-wa-btn" onClick={handleWA}>
              <i className="ti ti-brand-whatsapp" aria-hidden="true" />
              Buy on WhatsApp
            </button>
          </div>

          <div className="fs-modal-trust">
            <div className="fs-modal-trust-item"><i className="ti ti-shield-check" style={{ color: '#22c55e' }} /> 100% Authentic</div>
            <div className="fs-modal-trust-item"><i className="ti ti-truck" style={{ color: '#22c55e' }} /> Fast Delivery</div>
            <div className="fs-modal-trust-item"><i className="ti ti-refresh" style={{ color: '#22c55e' }} /> 7 Days Returns</div>
            <div className="fs-modal-trust-item"><i className="ti ti-lock" style={{ color: '#22c55e' }} /> Secure Payment</div>
          </div>

          {related && related.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>You may also like</div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
                {related.map(r => {
                  const hasImg = r.image_url && r.image_url.startsWith('http');
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onSelectRelated(r)}
                      style={{ flex: '0 0 110px', textAlign: 'left', background: 'var(--white, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, padding: 8, cursor: 'pointer' }}
                    >
                      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, background: '#f9fafb', borderRadius: 8, marginBottom: 6, overflow: 'hidden' }}>
                        {hasImg ? <img src={r.image_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }} /> : getEmoji(r)}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 700 }}>GH₵ {parseFloat(r.price).toFixed(2)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── WHY SHOP ──
const WhyShop = () => (
  <div className="fs-why">
    <div className="fs-why-title">Why Shop With Fleppystore?</div>
    <div className="fs-why-grid">
      {WHY_ITEMS.map((item, i) => (
        <div className="fs-why-item" key={i}>
          <div className="fs-why-icon">{item.icon}</div>
          <div className="fs-why-label">{item.label}</div>
          <div className="fs-why-sub">{item.sub}</div>
        </div>
      ))}
    </div>
  </div>
);

// ── FOOTER ──
const Footer = ({ onOpenInfo }) => (
  <footer className="fs-footer">
    <div className="fs-footer-grid">
      <div>
        <div className="fs-footer-logo">🛍️ Fleppystore</div>
        <p className="fs-footer-sub">Everything profitable. Delivered to you. Your trusted online store in Ghana.</p>
        <div className="fs-footer-pay-badges">
          <span className="fs-footer-pay-badge" style={{ background: '#FFB800', color: '#1a1a1a' }}>MTN MoMo</span>
          <span className="fs-footer-pay-badge" style={{ background: '#25D366', color: '#fff' }}>WhatsApp</span>
          <span className="fs-footer-pay-badge" style={{ background: '#333', color: '#fff' }}>Cash</span>
        </div>
      </div>
      <div>
        <div className="fs-footer-col-title">Shop</div>
        {['All Categories', 'Deals', 'New Arrivals', 'Top Brands'].map(l => (
          <button key={l} className="fs-footer-link">{l}</button>
        ))}
      </div>
      <div>
        <div className="fs-footer-col-title">Customer Care</div>
        {[
          { label: 'Track Order', text: "Hi, I'd like to check my order status." },
          { label: 'Returns', text: "Hi, I'd like to request a return." },
          { label: 'FAQs', text: "Hi, I have a question." },
        ].map(l => (
          <button
            key={l.label}
            className="fs-footer-link"
            onClick={() => window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(l.text)}`, '_blank')}
          >{l.label}</button>
        ))}
        <button className="fs-footer-link" onClick={() => onOpenInfo('shipping')}>Shipping Info</button>
      </div>
      <div>
        <div className="fs-footer-col-title">About Us</div>
        <button className="fs-footer-link" onClick={() => window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Hi, I'd like to know more about Fleppystore.")}`, '_blank')}>
          Contact Us
        </button>
        <button className="fs-footer-link" onClick={() => onOpenInfo('our-story')}>Our Story</button>
        <button className="fs-footer-link" onClick={() => onOpenInfo('terms')}>Terms & Conditions</button>
        <button className="fs-footer-link" onClick={() => onOpenInfo('privacy')}>Privacy Policy</button>
        {/* Staff entry — a normal footer link so it's easy to spot. Hidden below
            768px: the register/dashboard is tablet and desktop only. */}
        <a className="fs-footer-link fs-staff-link" href="/staff">Staff Login</a>
      </div>
      <div>
        <div className="fs-footer-col-title">Get in Touch</div>
        <button className="fs-footer-link" onClick={() => window.open(`https://wa.me/${WA_NUMBER}`, '_blank')}>
          📞 +{WA_NUMBER}
        </button>
        <a className="fs-footer-link" href="mailto:support@fleppystore.com">✉️ support@fleppystore.com</a>
      </div>
    </div>
    <div className="fs-footer-bottom">
      <p>© 2026 Fleppystore. All rights reserved. Made with ❤️ in Ghana.</p>
      <div className="fs-footer-socials">
        {['brand-facebook', 'brand-instagram', 'brand-tiktok', 'brand-youtube'].map(icon => (
          <button key={icon} className="fs-social-btn">
            <i className={`ti ti-${icon}`} aria-hidden="true" />
          </button>
        ))}
      </div>
      <style>{`
        @media (max-width: 767px) { .fs-staff-link { display: none !important; } }
        .fs-footer { padding-bottom: 72px; }
      `}</style>
    </div>
  </footer>
);

// ── BOTTOM NAV ──
const BottomNav = ({ onCartOpen, cartCount, onHomeClick, onCategoriesClick, onWishlistOpen, wishlistCount, onAccountOpen, activeTab }) => (
  <nav className="fs-bottom-nav">
    <button className={`fs-bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={onHomeClick}>
      <i className="ti ti-home" aria-hidden="true" />
      Home
    </button>
    <button className={`fs-bottom-nav-item ${activeTab === 'categories' ? 'active' : ''}`} onClick={onCategoriesClick}>
      <i className="ti ti-category" aria-hidden="true" />
      Categories
    </button>
    <button className={`fs-bottom-nav-item ${activeTab === 'cart' ? 'active' : ''}`} onClick={onCartOpen} style={{ position: 'relative' }}>
      <i className="ti ti-shopping-cart" aria-hidden="true" />
      {cartCount > 0 && (
        <span style={{
          position: 'absolute', top: 2, right: 10,
          background: '#FFB800', color: '#1a1a1a',
          borderRadius: '50%', width: 16, height: 16,
          fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{cartCount}</span>
      )}
      Cart
    </button>
    <button className={`fs-bottom-nav-item ${activeTab === 'wishlist' ? 'active' : ''}`} onClick={onWishlistOpen} style={{ position: 'relative' }}>
      <i className="ti ti-heart" aria-hidden="true" />
      {wishlistCount > 0 && (
        <span style={{
          position: 'absolute', top: 2, right: 10,
          background: '#FFB800', color: '#1a1a1a',
          borderRadius: '50%', width: 16, height: 16,
          fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{wishlistCount}</span>
      )}
      Wishlist
    </button>
    <button className={`fs-bottom-nav-item ${activeTab === 'account' ? 'active' : ''}`} onClick={onAccountOpen}>
      <i className="ti ti-user" aria-hidden="true" />
      Account
    </button>
  </nav>
);

// ── ROOT APP ──
// ── BARCODE SCANNER ──
// A physical USB/Bluetooth scanner acts like a keyboard: it types the
// barcode digits (fast) and sends Enter. This input just needs to be
// focused to catch that — no special scanner API or driver needed.
const BarcodeScanner = ({ onFound }) => {
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState(null); // { ok: bool, text: string }
  const [looking, setLooking] = useState(false);
  const inputRef = React.useRef();

  const lookup = async (code) => {
    if (!code.trim()) return;
    setLooking(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/products/public/barcode/${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ ok: false, text: data.message || 'Barcode not found' });
      } else if (data.product.stock_quantity <= 0) {
        setFeedback({ ok: false, text: `${data.product.name} — out of stock` });
      } else {
        onFound(data.product);
        setFeedback({ ok: true, text: `Added: ${data.product.name}` });
      }
    } catch (err) {
      setFeedback({ ok: false, text: 'Could not reach the server' });
    } finally {
      setLooking(false);
      setValue('');
      setTimeout(() => setFeedback(null), 2200);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fs-scanner">
      <i className="ti ti-barcode fs-scanner-icon" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        className="fs-scanner-input"
        placeholder="Scan a barcode or type the code…"
        value={value}
        disabled={looking}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') lookup(value); }}
      />
      {feedback && (
        <span className={`fs-scanner-feedback ${feedback.ok ? 'ok' : 'err'}`}>
          {feedback.ok ? '✅' : '⚠️'} {feedback.text}
        </span>
      )}
    </div>
  );
};

function StorefrontApp() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState(() => (
    window.location.search.includes('store=1') ? [] : getCart()
  ));
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeNav, setActiveNav] = useState('Home');
  const [wishlist, setWishlist] = useState(() => (
    window.location.search.includes('store=1') ? [] : getWishlist()
  ));
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);
  const [infoPage, setInfoPage] = useState(null); // 'our-story' | 'terms' | 'privacy' | 'shipping' | null
  // Mini sticky search bar: appears on mobile/tablet once the hero banner
  // has scrolled out of view, mirroring the standard e-commerce pattern
  // (Amazon/Jumia/AliExpress) where the full hero scrolls away and a
  // slim search bar takes over at the top.
  const [showMiniNav, setShowMiniNav] = useState(false);
  const heroSentinelRef = useRef(null);
  const [storeMode, setStoreMode] = useState(() => window.location.search.includes('store=1'));
  // Fixed once, at mount — whether THIS device's URL launches into
  // kiosk mode (e.g. a tablet bookmarked to ?store=1). Doesn't change
  // when storeMode toggles, so we can tell "this is a kiosk that's
  // currently exited into browsing" from "this was never a kiosk."
  const [launchedAsKiosk] = useState(() => window.location.search.includes('store=1'));
  // Store Mode is a shared kiosk — never carry a saved identity across
  // a page load there, even though a normal shopper's sign-in should
  // persist on their own device as usual.
  const [customer, setCustomer] = useState(() => (
    window.location.search.includes('store=1') ? null : getCustomer()
  ));
  const [accountOpen, setAccountOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState(null);
  const [minPrice, setMinPrice] = useState(null);
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  // Keep the boxes in step when the assistant/"show all" changes the numbers,
  // without overwriting what someone is mid-typing (e.g. "0.").
  useEffect(() => { if (parsePrice(minText) !== minPrice) setMinText(minPrice == null ? '' : String(minPrice)); }, [minPrice]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (parsePrice(maxText) !== maxPrice) setMaxText(maxPrice == null ? '' : String(maxPrice)); }, [maxPrice]); // eslint-disable-line react-hooks/exhaustive-deps
  const [dealsOnly, setDealsOnly] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/products/public`);
      const data = await res.json();
      setProducts(data.products || data || []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      // Cap at actual stock — without this, tapping Add to Cart
      // repeatedly builds a cart the backend will reject wholesale at
      // checkout, instead of stopping the shopper right where they are.
      if (existing) {
        const capped = Math.min(existing.qty + 1, product.stock_quantity);
        if (capped === existing.qty) return prev; // already at max, no-op
        return prev.map(i => i.id === product.id ? { ...i, qty: capped } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) { setCart(prev => prev.filter(i => i.id !== id)); return; }
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.min(qty, i.stock_quantity) } : i));
  };

  const removeItem = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const toggleWishlist = (id) => setWishlist(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.category || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || (p.category || '').toLowerCase() === activeCategory.toLowerCase();
    const matchPrice = !maxPrice || parseFloat(p.price) <= maxPrice;
    const matchMin = !minPrice || parseFloat(p.price) >= minPrice;
    const matchDeals = !dealsOnly || p.is_deal;
    return matchSearch && matchCat && matchPrice && matchMin && matchDeals;
  });

  // Sort is applied after filtering, never changes WHICH products show —
  // only their order. 'relevance' (default) leaves the backend's own
  // order untouched.
  const sorted = (() => {
    if (sortBy === 'relevance') return filtered;
    const copy = [...filtered];
    switch (sortBy) {
      case 'price_asc': return copy.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      case 'price_desc': return copy.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      case 'rating': return copy.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'newest':
        return copy.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      default: return copy;
    }
  })();

  const deals = products.filter(p => p.is_deal);

  // Ask-assistant: free text or a quick-filter chip narrows the grid the
  // same way a store assistant would, instead of the shopper hunting
  // through menus themselves.
  const handleAsk = ({ text, filter }) => {
    setMaxPrice(null);
    setMinPrice(null);
    setDealsOnly(false);
    setActiveCategory('All');
    setSearch('');

    if (filter) {
      if (filter.maxPrice) setMaxPrice(filter.maxPrice);
      if (filter.deals) setDealsOnly(true);
      if (filter.category) setActiveCategory(filter.category);
    } else if (text) {
      const priceMatch = text.match(/(?:under|below|less than)\s*(?:gh[c₵]?)?\s*(\d+)/i);
      if (priceMatch) setMaxPrice(parseFloat(priceMatch[1]));
      const cleaned = text.replace(/(?:under|below|less than)\s*(?:gh[c₵]?)?\s*\d+/i, '').trim();
      if (cleaned) setSearch(cleaned);
    }

    const grid = document.querySelector('.fs-section');
    if (grid) grid.scrollIntoView({ behavior: 'smooth' });
  };

  // Store Mode is a shared kiosk — the person after Wes shouldn't see
  // Wes's name, cart, or filters. This only fires from Store Mode's
  // "Done" button, never in normal browsing, so a signed-in shopper on
  // their own device never gets logged out mid-session.
  const resetForNextCustomer = () => {
    clearCustomer();
    setCustomer(null);
    setCart([]);
    setWishlist([]);
    setSearch('');
    setActiveCategory('All');
    setMaxPrice(null);
    setMinPrice(null);
    setDealsOnly(false);
  };

  // Kiosk auto-lock: if this device is bookmarked into Store Mode
  // (?store=1) but is currently exited into normal browsing — e.g.
  // someone placed an online order on the counter tablet — snap it
  // back to Store Mode after a stretch of no activity, so a forgotten
  // handoff doesn't leave a stranger's name sitting on the tablet for
  // whoever picks it up next.
  const IDLE_LOCK_MS = 90000;
  useEffect(() => {
    if (!launchedAsKiosk || storeMode) return;
    let timer;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        resetForNextCustomer();
        setStoreMode(true);
        setCartOpen(false);
        setAccountOpen(false);
        setSelectedProduct(null);
      }, IDLE_LOCK_MS);
    };
    const events = ['mousedown', 'touchstart', 'keydown', 'scroll'];
    events.forEach(e => window.addEventListener(e, arm));
    arm();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, arm));
    };
  }, [launchedAsKiosk, storeMode]);

  // Kiosk health reload #1: scheduled full reload every 4 hours,
  // regardless of activity. This is the defensive measure that
  // actually matters for an unattended tablet — a slow memory leak or
  // any other long-running single-page-app rot gets wiped on a timer,
  // BEFORE it has a chance to turn into a visible freeze. Unlike a
  // "Refresh" button, this doesn't depend on the page still being
  // responsive when it fires.
  const KIOSK_RELOAD_HOURS = 4;
  useEffect(() => {
    if (!launchedAsKiosk) return;
    const timer = setTimeout(() => window.location.reload(), KIOSK_RELOAD_HOURS * 60 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [launchedAsKiosk]);

  // Kiosk health reload #2: if the tablet sits completely untouched for
  // 30 minutes — no customer, no staff nearby — hard-reload rather than
  // just resetting in-memory state. Runs regardless of Store Mode (unlike
  // the 90s identity-lock above, this is about page health, not privacy),
  // so it also catches a device left idle while someone was mid-browsing.
  const KIOSK_IDLE_RELOAD_MS = 30 * 60 * 1000;
  useEffect(() => {
    if (!launchedAsKiosk) return;
    let timer;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => window.location.reload(), KIOSK_IDLE_RELOAD_MS);
    };
    const events = ['mousedown', 'touchstart', 'keydown', 'scroll'];
    events.forEach(e => window.addEventListener(e, arm));
    arm();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, arm));
    };
  }, [launchedAsKiosk]);

  // Persist the cart across reloads — except in Store Mode, where a
  // shared kiosk should never write (or resume) anyone's cart to disk.
  useEffect(() => {
    if (!storeMode) saveCart(cart);
  }, [cart, storeMode]);

  // Same reasoning, same pattern, for the wishlist — it had no
  // persistence at all before; a refresh silently emptied it.
  useEffect(() => {
    if (!storeMode) saveWishlist(wishlist);
  }, [wishlist, storeMode]);

  // Bottom nav "Home"/"Categories" — reset filters and scroll to the
  // relevant section, mirroring what the "Show all products" reset does.
  const handleHomeClick = () => {
    handleAsk({ filter: {} });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleCategoriesClick = () => {
    const strip = document.querySelector('.fs-cat-strip');
    if (strip) strip.scrollIntoView({ behavior: 'smooth' });
  };

  // Watch the sentinel placed right after the hero banner; once it
  // scrolls past the top of the viewport, show the compact sticky
  // search bar (mini nav). Skipped entirely in Store Mode, where the
  // hero isn't rendered.
  useEffect(() => {
    if (storeMode) return;
    const el = heroSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowMiniNav(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [storeMode]);

  // SubNav — every link now does something real. Track Order/Help route
  // to WhatsApp rather than a dead link, matching how checkout/support
  // already work in this app; a proper order-lookup screen is a
  // separate, bigger piece (needs the customer_id linkage surfaced).
  const handleNavAction = (link) => {
    setActiveNav(link.label);
    switch (link.action) {
      case 'home': handleHomeClick(); break;
      case 'categories': handleCategoriesClick(); break;
      case 'deals': handleAsk({ filter: { deals: true } }); break;
      case 'track':
        window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Hi, I\'d like to check my order status.')}`, '_blank');
        break;
      case 'help':
        window.open(`https://wa.me/${WA_NUMBER}`, '_blank');
        break;
      default: break;
    }
  };

  const activeTab = cartOpen ? 'cart' : wishlistOpen ? 'wishlist' : accountOpen ? 'account' : 'home';

  return (
    <div className="fs-app">
      <TopNav
        cartCount={cartCount}
        onCartOpen={() => setCartOpen(true)}
        search={search}
        onSearch={setSearch}
        customer={customer}
        onAccountOpen={() => setAccountOpen(true)}
        onHomeClick={handleHomeClick}
        storeMode={storeMode}
        onToggleStoreMode={() => setStoreMode(m => {
          const next = !m;
          // Entering Store Mode on a device that was just being used for
          // normal browsing shouldn't carry that shopper's name or cart
          // forward to the next kiosk user either.
          if (next) { setCustomer(null); setCart([]); setWishlist([]); }
          return next;
        })}
        wishlistCount={wishlist.length}
        onWishlistOpen={() => setWishlistOpen(true)}
      />

      {storeMode ? (
        // ── STORE MODE — a focused self-checkout kiosk view. Marketing and
        // browsing chrome is hidden; scanning and paying is the whole screen.
        <div className="fs-storemode">
          <div className="fs-storemode-head">
            <div className="fs-storemode-title">🏪 Self-Checkout</div>
            <div className="fs-storemode-sub">Scan each item, or search for it below. When you're done, tap "Get my ticket" and show it to a cashier.</div>
          </div>
          <BarcodeScanner onFound={addToCart} />
          <div className="fs-storemode-cart">
            <div className="fs-storemode-cart-head">🛒 Your items ({cartCount})</div>
            {cart.length === 0 ? (
              <div className="fs-empty"><i className="ti ti-shopping-cart" /><p>Nothing scanned yet</p></div>
            ) : cart.map(item => (
              <div className="fs-cart-item" key={item.id}>
                <div className="fs-cart-item-info">
                  <div className="fs-cart-item-name">{item.name}</div>
                  <div className="fs-cart-item-price">GH₵ {(item.price * item.qty).toFixed(2)}</div>
                  <div className="fs-cart-qty">
                    <button className="fs-qty-btn" onClick={() => updateQty(item.id, item.qty - 1)}>−</button>
                    <span className="fs-qty-num">{item.qty}</span>
                    <button className="fs-qty-btn" onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                  </div>
                </div>
                <button className="fs-cart-del" onClick={() => removeItem(item.id)}>
                  <i className="ti ti-trash" aria-hidden="true" />
                </button>
              </div>
            ))}
            <div className="fs-cart-total" style={{ marginTop: 12 }}>
              <span className="fs-cart-total-label">Total</span>
              <span className="fs-cart-total-val">GH₵ {cartTotal.toFixed(2)}</span>
            </div>
            <button className="fs-storemode-btn" onClick={() => setCartOpen(true)} disabled={!cart.length}>
              Get my ticket
            </button>
          </div>
          <CallAssistantButton />
        </div>
      ) : (
        <>
          <SubNav activeNav={activeNav} onAction={handleNavAction} />
          <HeroSlider
            productCount={products.length}
            onShopNow={() => {
              const grid = document.querySelector('.fs-section');
              if (grid) grid.scrollIntoView({ behavior: 'smooth' });
            }}
            onExploreDeals={() => handleAsk({ filter: { deals: true } })}
          />
          <div ref={heroSentinelRef} style={{ height: 1 }} aria-hidden="true" />
          <MiniStickyNav
            visible={showMiniNav}
            search={search}
            onSearch={setSearch}
            onHomeClick={handleHomeClick}
          />
          <AskAssistant onAsk={handleAsk} greetingName={customer?.name.split(' ')[0]} />
          <CategoryStrip active={activeCategory} onChange={setActiveCategory} />
          <BarcodeScanner onFound={addToCart} />

          <div className="fs-section">
            <div className="fs-section-header">
              <div className="fs-section-title">
                {search ? `Results for "${search}"` : activeCategory === 'All' && !maxPrice && !minPrice && !dealsOnly ? '🛍️ All Products' : activeCategory === 'All' ? 'Filtered Results' : activeCategory}
              </div>
              <div className="fs-section-header-right">
                {(search || activeCategory !== 'All' || maxPrice || minPrice || dealsOnly) && (
                  <button className="fs-clear-filters-btn" onClick={() => handleAsk({ filter: {} })}>
                    ✕ Show all products
                  </button>
                )}
                <select className="fs-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="relevance">Sort: Relevance</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                  <option value="newest">Newest</option>
                </select>
                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{sorted.length} items</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '2px 0 14px', fontSize: 13, color: 'var(--text-3)' }}>
              <span>Price (GH₵)</span>
              <input
                type="number" inputMode="decimal" min="0" placeholder="Min" value={minText}
                onChange={e => { setMinText(e.target.value); setMinPrice(parsePrice(e.target.value)); }}
                style={{ width: 84, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border, #e5e7eb)', fontSize: 13 }}
              />
              <span>–</span>
              <input
                type="number" inputMode="decimal" min="0" placeholder="Max" value={maxText}
                onChange={e => { setMaxText(e.target.value); setMaxPrice(parsePrice(e.target.value)); }}
                style={{ width: 84, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border, #e5e7eb)', fontSize: 13 }}
              />
            </div>

            {loading ? (
              <div className="fs-loading">
                <div className="fs-spinner" />
                <span>Loading products...</span>
              </div>
            ) : sorted.length === 0 ? (
              <div className="fs-empty">
                <i className="ti ti-mood-empty" />
                <p>No products found</p>
              </div>
            ) : (
              <div className="fs-product-grid">
                {sorted.map(p => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onAdd={addToCart}
                    onClick={setSelectedProduct}
                    wishlist={wishlist}
                    onWishlist={toggleWishlist}
                  />
                ))}
              </div>
            )}
          </div>

          <Footer onOpenInfo={setInfoPage} />
          {infoPage && <InfoModal page={infoPage} onClose={() => setInfoPage(null)} />}
          <BottomNav
            onCartOpen={() => setCartOpen(true)}
            cartCount={cartCount}
            onHomeClick={handleHomeClick}
            onCategoriesClick={handleCategoriesClick}
            onWishlistOpen={() => setWishlistOpen(true)}
            wishlistCount={wishlist.length}
            onAccountOpen={() => setAccountOpen(true)}
            activeTab={activeTab}
          />
        </>
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onQty={updateQty}
        onRemove={removeItem}
        total={cartTotal}
        customer={customer}
        storeMode={storeMode}
        onDone={resetForNextCustomer}
      />

      {selectedProduct && (
        <ProductModal
          key={selectedProduct.id}
          product={selectedProduct}
          related={getRelatedProducts(selectedProduct, products)}
          onSelectRelated={setSelectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={addToCart}
        />
      )}

      {accountOpen && (
        <AccountModal
          customer={customer}
          onClose={() => setAccountOpen(false)}
          onSave={c => { if (!storeMode) saveCustomer(c); setCustomer(c); }}
          onSignOut={() => { clearCustomer(); setCustomer(null); }}
          onViewOrders={() => setOrderHistoryOpen(true)}
        />
      )}

      {orderHistoryOpen && customer && (
        <OrderHistoryPanel phone={customer.phone} onClose={() => setOrderHistoryOpen(false)} />
      )}

      {wishlistOpen && (
        <WishlistPanel
          products={products}
          wishlist={wishlist}
          onClose={() => setWishlistOpen(false)}
          onAdd={addToCart}
          onWishlist={toggleWishlist}
          onProductClick={p => { setWishlistOpen(false); setSelectedProduct(p); }}
        />
      )}

      {!storeMode && (
        <>
          {/* On tablets the bottom-right corner is where the footer links end
              up (Staff Login, contact details) and the floating button was
              covering them — so on tablet widths only, it moves to the left. */}
          <style>{`
            @media (min-width: 768px) and (max-width: 1024px) {
              .fs-wa-float { right: auto !important; left: 20px !important; }
            }
          `}</style>
          <button
            className="fs-wa-float"
            onClick={() => window.open(`https://wa.me/${WA_NUMBER}`, '_blank')}
            aria-label="WhatsApp"
          >
            <i className="ti ti-brand-whatsapp" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}

// ── ERROR BOUNDARY ──
// If anything in the storefront throws while rendering, show a friendly
// recovery screen instead of a blank white page.
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error('Storefront crashed:', error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f9fafb', textAlign: 'center' }}>
        <div style={{ maxWidth: 360 }}>
          <div style={{ fontSize: 48 }}>😕</div>
          <h2 style={{ margin: '8px 0 6px' }}>Something went wrong</h2>
          <p style={{ margin: '0 0 18px', color: '#6b7280', fontSize: 14, lineHeight: 1.5 }}>
            Sorry about that — the page hit a problem. Reloading usually fixes it, and your cart is saved.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '12px 22px', borderRadius: 10, border: 'none', background: '#111827', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: 12 }}
          >
            Reload the page
          </button>
          <div>
            <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#6b7280' }}>
              Still stuck? Message us on WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <StorefrontApp />
    </ErrorBoundary>
  );
}
