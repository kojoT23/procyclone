import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

const API_BASE = 'http://localhost:5001';
const THEMES = ['gold', 'red', 'green', 'black'];
const CATEGORIES = ['All', 'Electronics', 'Fashion', 'Home', 'Health', 'Sports', 'Food', 'Other'];
const WA_NUMBER = '233XXXXXXXXX';

const CATEGORY_EMOJI = {
  electronics: '📱', fashion: '👗', home: '🏠', health: '💊',
  sports: '⚽', food: '🍔', footwear: '👟', helmets: '⛑️',
  accessory: '💍', accessories: '💍', other: '📦', general: '📦',
};

const SLIDES = [
  {
    tag: '✦ New Arrivals',
    title: 'SHOP THE\nLATEST DROPS',
    sub: 'Fresh products added every week. Pay with MoMo, WhatsApp to order, or cash on delivery.',
    cta: 'Shop Now',
    emoji: '🛍️',
    bg: '#1c1c1c',
  },
  {
    tag: '✦ Best Deals',
    title: 'UNBEATABLE\nPRICES',
    sub: 'Everything you need at prices that make sense. Fast delivery across Ghana.',
    cta: 'See Deals',
    emoji: '🔥',
    bg: '#1a0a00',
  },
  {
    tag: '✦ Pay Easy',
    title: 'MOMO &\nWHATSAPP',
    sub: 'Order via WhatsApp. Pay with MTN MoMo or cash on delivery. Simple and fast.',
    cta: 'Order Now',
    emoji: '📲',
    bg: '#0a1a0a',
  },
];

const getEmoji = (product) => {
  if (product.image_url && product.image_url.startsWith('http')) return null;
  const cat = (product.category || '').toLowerCase();
  return CATEGORY_EMOJI[cat] || '📦';
};

const stockStatus = (qty, threshold) => {
  if (qty === 0) return 'out';
  if (qty <= threshold) return 'low';
  return 'ok';
};

const buildWhatsAppMessage = (cartItems, total) => {
  const lines = cartItems.map(i => `• ${i.name} x${i.qty} — GH₵ ${(i.price * i.qty).toFixed(2)}`);
  const msg = `Hello Fleppystore! I'd like to order:\n\n${lines.join('\n')}\n\nTotal: GH₵ ${total.toFixed(2)}\n\nPlease confirm availability and delivery details. Thank you!`;
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
};

// ── HERO SLIDER ──
const HeroSlider = ({ productCount }) => {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef();

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, []);

  return (
    <div className="fs-slider">
      {SLIDES.map((slide, i) => (
        <div
          key={i}
          className={`fs-slide ${i === current ? 'active' : ''}`}
          style={{ background: slide.bg }}
        >
          <div className="fs-hero-left">
            <div className="fs-hero-tag">{slide.tag}</div>
            <div className="fs-hero-title">
              {slide.title.split('\n').map((line, j) => (
                <span key={j}>{line}<br /></span>
              ))}
            </div>
            <div className="fs-hero-sub">{slide.sub}</div>
            <div className="fs-hero-actions">
              <button className="fs-hero-cta">
                {slide.cta} <i className="ti ti-arrow-right" aria-hidden="true" />
              </button>
              <button className="fs-hero-cta-secondary">View all</button>
            </div>
          </div>
          <div className="fs-slide-visual">{slide.emoji}</div>
        </div>
      ))}

      {/* Stats overlay */}
      <div style={{
        position: 'absolute', bottom: 48, left: 48,
        display: 'flex', gap: '24px', zIndex: 5,
      }}>
        <div className="fs-hero-stat" style={{ minWidth: '120px' }}>
          <div className="fs-hero-stat-label">Products</div>
          <div className="fs-hero-stat-val">{productCount}</div>
          <div className="fs-hero-stat-sub">All categories</div>
        </div>
        <div className="fs-hero-stat" style={{ minWidth: '120px' }}>
          <div className="fs-hero-stat-label">Delivery</div>
          <div className="fs-hero-stat-val">Fast</div>
          <div className="fs-hero-stat-sub">Same day available</div>
        </div>
      </div>

      {/* Dots */}
      <div className="fs-slide-dots">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            className={`fs-slide-dot ${i === current ? 'active' : ''}`}
            onClick={() => setCurrent(i)}
          />
        ))}
      </div>
    </div>
  );
};

// ── NAVBAR ──
const Navbar = ({ cartCount, onCartOpen, theme, onThemeChange, darkMode, onDarkToggle, search, onSearch }) => {
  const themeLabels = { gold: '🟡', red: '🔴', green: '🟢', black: '⚫' };
  const nextTheme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];

  return (
    <nav className="fs-nav">
      <div className="fs-logo">Fleppy<span>store</span></div>
      <div className="fs-nav-search">
        <i className="ti ti-search search-icon" aria-hidden="true" />
        <input
          placeholder="Search products..."
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>
      <div className="fs-nav-actions">
        <button className="fs-theme-btn" onClick={onThemeChange}>
          {themeLabels[nextTheme]} Kente
        </button>
        <button className="fs-theme-btn" onClick={onDarkToggle}>
          <i className={`ti ti-${darkMode ? 'sun' : 'moon'}`} aria-hidden="true" />
        </button>
        <button className="fs-cart-btn" onClick={onCartOpen} aria-label="Open cart">
          <i className="ti ti-shopping-cart" style={{ fontSize: '20px' }} aria-hidden="true" />
          {cartCount > 0 && <span className="fs-cart-badge">{cartCount}</span>}
        </button>
      </div>
    </nav>
  );
};

// ── BOTTOM NAV ──
const BottomNav = ({ onCartOpen, cartCount }) => (
  <nav className="fs-bottom-nav">
    <button className="fs-bottom-nav-item active">
      <i className="ti ti-home" aria-hidden="true" />
      Home
    </button>
    <button className="fs-bottom-nav-item">
      <i className="ti ti-search" aria-hidden="true" />
      Search
    </button>
    <button className="fs-bottom-nav-item" onClick={onCartOpen} style={{ position: 'relative' }}>
      <i className="ti ti-shopping-cart" aria-hidden="true" />
      {cartCount > 0 && (
        <span style={{
          position: 'absolute', top: 2, right: 8,
          background: 'var(--accent)', color: '#fff',
          borderRadius: '50%', width: '16px', height: '16px',
          fontSize: '10px', fontWeight: '700',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{cartCount}</span>
      )}
      Cart
    </button>
    <button className="fs-bottom-nav-item">
      <i className="ti ti-user" aria-hidden="true" />
      Account
    </button>
  </nav>
);

// ── MARQUEE ──
const Marquee = () => {
  const items = [
    '✦ Free delivery on orders over GH₵ 200',
    '🟡 Pay with MTN MoMo',
    '📲 WhatsApp us to order',
    '🔴 New arrivals every week',
    '🟢 Verified seller',
    '⚫ Easy returns',
  ];
  const text = items.join('     ');
  return (
    <div className="fs-marquee-wrap">
      <div className="fs-marquee">{text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{text}</div>
    </div>
  );
};

// ── STOCK BADGE ──
const StockBadge = ({ qty, threshold }) => {
  const status = stockStatus(qty, threshold);
  if (status === 'out') return (
    <span className="fs-stock-out">
      <i className="ti ti-x" style={{ fontSize: '10px' }} aria-hidden="true" /> Out of stock
    </span>
  );
  if (status === 'low') return (
    <span className="fs-stock-low">
      <i className="ti ti-alert-triangle" style={{ fontSize: '10px' }} aria-hidden="true" /> Low stock
    </span>
  );
  return null;
};

// ── PRODUCT CARD ──
const ProductCard = ({ product, featured, onAdd, onClick, wishlist, onWishlist }) => {
  const isOut = product.stock_quantity === 0;
  const emoji = getEmoji(product);
  const isImgUrl = product.image_url && product.image_url.startsWith('http');
  const isWishlisted = wishlist.includes(product.id);

  return (
    <div
      className={`fs-product-card ${featured ? 'featured' : ''}`}
      onClick={() => onClick(product)}
    >
      <div className="fs-product-img">
        {isImgUrl
          ? <img src={product.image_url} alt={product.name} />
          : <span>{emoji}</span>
        }
        <button
          className={`fs-wishlist-btn ${isWishlisted ? 'active' : ''}`}
          onClick={e => { e.stopPropagation(); onWishlist(product.id); }}
          aria-label="Add to wishlist"
        >
          <i className={`ti ti-heart${isWishlisted ? '-filled' : ''}`} aria-hidden="true" />
        </button>
      </div>
      <div className="fs-product-body">
        <div className="fs-product-cat">{product.category || 'General'}</div>
        <div className="fs-product-name">{product.name}</div>
        <div className="fs-product-price">GH₵ {parseFloat(product.price || 0).toFixed(2)}</div>
        <div className="fs-product-footer">
          <StockBadge qty={product.stock_quantity} threshold={product.low_stock_threshold} />
          <button
            className="fs-add-btn"
            disabled={isOut}
            aria-label="Add to cart"
            onClick={e => { e.stopPropagation(); onAdd(product); }}
          >+</button>
        </div>
      </div>
    </div>
  );
};

// ── CART DRAWER ──
const CartDrawer = ({ open, onClose, items, onQty, total }) => {
  const handleCheckout = () => {
    if (items.length === 0) return;
    window.open(buildWhatsAppMessage(items, total), '_blank');
  };

  return (
    <>
      <div className={`fs-cart-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`fs-cart-drawer ${open ? 'open' : ''}`}>
        <div className="fs-cart-header">
          <span className="fs-cart-title">
            🛒 Your Cart ({items.length})
          </span>
          <button className="fs-cart-close" onClick={onClose}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        <div className="fs-cart-items">
          {items.length === 0 ? (
            <div className="fs-empty">
              <i className="ti ti-shopping-cart" />
              <p>Your cart is empty</p>
            </div>
          ) : items.map(item => {
            const emoji = getEmoji(item);
            const isImgUrl = item.image_url && item.image_url.startsWith('http');
            return (
              <div className="fs-cart-item" key={item.id}>
                <div className="fs-cart-item-img">
                  {isImgUrl
                    ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : emoji}
                </div>
                <div className="fs-cart-item-info">
                  <div className="fs-cart-item-name">{item.name}</div>
                  <div className="fs-cart-item-price">GH₵ {(item.price * item.qty).toFixed(2)}</div>
                </div>
                <div className="fs-cart-item-qty">
                  <button className="fs-qty-btn" onClick={() => onQty(item.id, item.qty - 1)}>−</button>
                  <span className="fs-qty-num">{item.qty}</span>
                  <button className="fs-qty-btn" onClick={() => onQty(item.id, item.qty + 1)}>+</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="fs-cart-footer">
          <div className="fs-cart-total">
            <span className="fs-cart-total-label">Total</span>
            <span className="fs-cart-total-val">GH₵ {total.toFixed(2)}</span>
          </div>
          <button className="fs-wa-btn" onClick={handleCheckout} disabled={items.length === 0}>
            <i className="ti ti-brand-whatsapp" aria-hidden="true" />
            Order via WhatsApp
          </button>
        </div>
      </div>
    </>
  );
};

// ── PRODUCT MODAL ──
const ProductModal = ({ product, onClose, onAdd }) => {
  const [selectedPayment, setSelectedPayment] = useState('momo');
  if (!product) return null;
  const isOut = product.stock_quantity === 0;
  const emoji = getEmoji(product);
  const isImgUrl = product.image_url && product.image_url.startsWith('http');

  const handleWhatsApp = () => {
    const msg = `Hello Fleppystore! I'm interested in: ${product.name} — GH₵ ${parseFloat(product.price).toFixed(2)}. Is it available?`;
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleShare = () => {
    const msg = `Check out ${product.name} on Fleppystore for GH₵ ${parseFloat(product.price).toFixed(2)}! 🛍️`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <>
      <div className="fs-cart-overlay open" onClick={onClose} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', pointerEvents: 'none',
      }}>
        <div style={{
          background: 'var(--surface)',
          borderRadius: '0',
          width: '100%',
          maxWidth: '500px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
          pointerEvents: 'all',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}>
          {/* Image */}
          <div style={{
            height: '260px', background: 'var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '100px', overflow: 'hidden', position: 'relative',
          }}>
            {isImgUrl
              ? <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : emoji}
            <button
              onClick={onClose}
              style={{
                position: 'absolute', top: 12, right: 12,
                background: 'var(--surface)', border: 'none',
                borderRadius: '50%', width: '36px', height: '36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '16px', boxShadow: 'var(--shadow)',
              }}
            >
              <i className="ti ti-x" aria-hidden="true" />
            </button>
            <button
              onClick={handleShare}
              style={{
                position: 'absolute', top: 12, right: 56,
                background: 'var(--surface)', border: 'none',
                borderRadius: '50%', width: '36px', height: '36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '16px', boxShadow: 'var(--shadow)',
              }}
            >
              <i className="ti ti-share" aria-hidden="true" />
            </button>
          </div>

          <div style={{ padding: '24px' }}>
            {/* Name + category */}
            <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600', marginBottom: '4px' }}>
              {product.category || 'General'}
            </div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
              {product.name}
            </div>

            {product.description && (
              <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: '1.6', marginBottom: '12px' }}>
                {product.description}
              </p>
            )}

            {/* Price */}
            <div style={{ fontSize: '32px', fontWeight: '900', color: 'var(--accent)', letterSpacing: '-1px', marginBottom: '8px', fontFamily: "'Barlow Condensed', sans-serif" }}>
              GH₵ {parseFloat(product.price || 0).toFixed(2)}
            </div>

            <StockBadge qty={product.stock_quantity} threshold={product.low_stock_threshold} />

            {/* Payment options */}
            <div style={{ marginTop: '20px', marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Pay with
            </div>
            <div className="fs-pay-options">
              <div
                className={`fs-pay-option ${selectedPayment === 'momo' ? 'selected' : ''}`}
                onClick={() => setSelectedPayment('momo')}
              >
                <div className="fs-pay-option-icon">📱</div>
                <div className="fs-pay-option-label">MTN MoMo</div>
              </div>
              <div
                className={`fs-pay-option ${selectedPayment === 'whatsapp' ? 'selected' : ''}`}
                onClick={() => setSelectedPayment('whatsapp')}
              >
                <div className="fs-pay-option-icon">💬</div>
                <div className="fs-pay-option-label">WhatsApp</div>
              </div>
              <div
                className={`fs-pay-option ${selectedPayment === 'cash' ? 'selected' : ''}`}
                onClick={() => setSelectedPayment('cash')}
              >
                <div className="fs-pay-option-icon">💵</div>
                <div className="fs-pay-option-label">Cash on delivery</div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                style={{
                  flex: 2, background: 'var(--accent)', border: 'none',
                  borderRadius: '0', padding: '16px', color: '#fff',
                  fontSize: '15px', fontWeight: '700', cursor: isOut ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  fontFamily: 'var(--font)', opacity: isOut ? 0.5 : 1,
                }}
                disabled={isOut}
                onClick={() => { onAdd(product); onClose(); }}
              >
                <i className="ti ti-shopping-cart" aria-hidden="true" />
                {isOut ? 'Out of Stock' : 'Add to Cart'}
              </button>
              <button
                style={{
                  flex: 1, background: '#25D366', border: 'none',
                  borderRadius: '0', padding: '16px', color: '#fff',
                  fontSize: '15px', fontWeight: '700', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  fontFamily: 'var(--font)',
                }}
                onClick={handleWhatsApp}
              >
                <i className="ti ti-brand-whatsapp" aria-hidden="true" />
                Chat
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── FOOTER ──
const Footer = () => (
  <>
    <footer className="fs-footer">
      <div>
        <div className="fs-footer-logo">Fleppy<span>store</span></div>
        <p className="fs-footer-sub">Ghana's premium online shop. Everything you need, delivered to you fast.</p>
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
          <span style={{ background: '#FFB800', color: '#1c1c1c', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '4px' }}>MTN MoMo</span>
          <span style={{ background: '#25D366', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '4px' }}>WhatsApp</span>
          <span style={{ background: '#333', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '4px' }}>Cash</span>
        </div>
      </div>
      <div>
        <div className="fs-footer-col-title">Shop</div>
        <span className="fs-footer-link">All Products</span>
        <span className="fs-footer-link">Electronics</span>
        <span className="fs-footer-link">Fashion</span>
        <span className="fs-footer-link">Home & Living</span>
      </div>
      <div>
        <div className="fs-footer-col-title">Support</div>
        <span className="fs-footer-link" onClick={() => window.open(`https://wa.me/${WA_NUMBER}`, '_blank')}>
          💬 WhatsApp Us
        </span>
        <span className="fs-footer-link">Track Order</span>
        <span className="fs-footer-link">Returns Policy</span>
        <span className="fs-footer-link">Contact</span>
      </div>
    </footer>
    <div className="fs-footer-bottom">
      <p>© 2026 Fleppystore. Built with ProCyclone. All rights reserved.</p>
    </div>
  </>
);

// ── HOME ──
const Home = ({ products, loading, onAdd, onProductClick, search, onSearch, wishlist, onWishlist }) => {
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.category || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || (p.category || '').toLowerCase() === activeCategory.toLowerCase();
    return matchSearch && matchCat;
  });

  return (
    <div className="fs-page">
      <HeroSlider productCount={products.length} />
      <Marquee />

      <div className="fs-cats-wrap">
        <div className="fs-cats-title">Browse by category</div>
        <div className="fs-cats">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`fs-cat-btn ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >{cat}</button>
          ))}
        </div>
      </div>

      <div className="fs-section-header">
        <div className="fs-section-title">
          {search ? `Results for "${search}"` : activeCategory === 'All' ? 'All Products' : activeCategory}
        </div>
        <div className="fs-section-count">{filtered.length} items</div>
      </div>

      {loading ? (
        <div className="fs-loading">
          <div className="fs-spinner" />
          <span style={{ fontSize: '14px', fontWeight: '500' }}>Loading products...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="fs-empty">
          <i className="ti ti-mood-empty" />
          <p>No products found</p>
        </div>
      ) : (
        <div className="fs-bento">
          {filtered.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              featured={index === 0}
              onAdd={onAdd}
              onClick={onProductClick}
              wishlist={wishlist}
              onWishlist={onWishlist}
            />
          ))}
        </div>
      )}

      <div className="fs-trust">
        <div className="fs-trust-item">
          <div className="fs-trust-icon"><i className="ti ti-truck" aria-hidden="true" /></div>
          <div className="fs-trust-label">Fast delivery</div>
        </div>
        <div className="fs-trust-item">
          <div className="fs-trust-icon"><i className="ti ti-shield-check" aria-hidden="true" /></div>
          <div className="fs-trust-label">Verified seller</div>
        </div>
        <div className="fs-trust-item">
          <div className="fs-trust-icon"><i className="ti ti-refresh" aria-hidden="true" /></div>
          <div className="fs-trust-label">Easy returns</div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

// ── ROOT APP ──
export default function App() {
  const [theme, setTheme] = useState('gold');
  const [darkMode, setDarkMode] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [wishlist, setWishlist] = useState([]);

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

  const cycleTheme = () => setTheme(t => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) setCart(prev => prev.filter(i => i.id !== id));
    else setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
  };

  const toggleWishlist = (id) => {
    setWishlist(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  return (
    <div className="fs-app" data-theme={theme} data-mode={darkMode ? 'dark' : 'light'}>
      <Navbar
        cartCount={cartCount}
        onCartOpen={() => setCartOpen(true)}
        theme={theme}
        onThemeChange={cycleTheme}
        darkMode={darkMode}
        onDarkToggle={() => setDarkMode(d => !d)}
        search={search}
        onSearch={setSearch}
      />
      <Home
        products={products}
        loading={loading}
        onAdd={addToCart}
        onProductClick={setSelectedProduct}
        search={search}
        onSearch={setSearch}
        wishlist={wishlist}
        onWishlist={toggleWishlist}
      />
      <BottomNav onCartOpen={() => setCartOpen(true)} cartCount={cartCount} />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onQty={updateQty}
        total={cartTotal}
      />
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={addToCart}
        />
      )}

      {/* Floating WhatsApp */}
      <button
        className="fs-wa-float"
        onClick={() => window.open(`https://wa.me/${WA_NUMBER}`, '_blank')}
        aria-label="Contact us on WhatsApp"
      >
        <i className="ti ti-brand-whatsapp" aria-hidden="true" />
      </button>
    </div>
  );
}