import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

const API_BASE = 'http://localhost:5001';
const WA_NUMBER = '233XXXXXXXXX';

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

const NAV_LINKS = ['Home', 'Categories', 'Deals', 'New Arrivals', 'Top Brands', 'Track Order', 'Help'];

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

const renderStars = (rating) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <i key={i} className={`ti ti-star${i <= Math.round(rating) ? '-filled' : ''} fs-star${i <= Math.round(rating) ? '' : ' empty'}`} />
    );
  }
  return stars;
};

// ── TOP NAVBAR ──
const TopNav = ({ cartCount, onCartOpen, search, onSearch }) => (
  <header className="fs-topnav">
    <div className="fs-logo">
      <span className="fs-logo-icon">🛍️</span>
      Fleppystore
    </div>
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
      <button className="fs-search-btn">
        <i className="ti ti-search" aria-hidden="true" />
      </button>
    </div>
    <div className="fs-topnav-actions">
      <button className="fs-topnav-btn">
        <i className="ti ti-user" aria-hidden="true" />
        Account
      </button>
      <button className="fs-topnav-btn">
        <i className="ti ti-heart" aria-hidden="true" />
        Wishlist
      </button>
      <button className="fs-topnav-btn">
        <i className="ti ti-bell" aria-hidden="true" />
        Alerts
      </button>
      <button className="fs-topnav-btn" onClick={onCartOpen}>
        <i className="ti ti-shopping-cart" aria-hidden="true" />
        Cart
        {cartCount > 0 && <span className="fs-cart-badge">{cartCount}</span>}
      </button>
    </div>
  </header>
);

// ── SUB NAVBAR ──
const SubNav = ({ activeNav, onNavChange }) => (
  <nav className="fs-subnav">
    {NAV_LINKS.map(link => (
      <button
        key={link}
        className={`fs-subnav-link ${activeNav === link ? 'active' : ''}`}
        onClick={() => onNavChange(link)}
      >{link}</button>
    ))}
    <button className="fs-currency-btn">GH₵ ▾</button>
  </nav>
);

// ── HERO SLIDER ──
const HeroSlider = ({ productCount }) => {
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
                <button className="fs-hero-btn-primary">Shop Now</button>
                <button className="fs-hero-btn-secondary">Explore Deals</button>
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
const StockBadge = ({ qty, threshold }) => {
  if (qty === 0) return <div className="fs-stock-out">🔴 Out of Stock</div>;
  if (qty <= threshold) return <div className="fs-stock-low">🟡 Low Stock</div>;
  return null;
};

// ── PRODUCT CARD ──
const ProductCard = ({ product, onAdd, onClick, wishlist, onWishlist }) => {
  const isOut = product.stock_quantity === 0;
  const emoji = getEmoji(product);
  const isImg = product.image_url && product.image_url.startsWith('http');
  const discount = getDiscount(parseFloat(product.price), parseFloat(product.compare_price));
  const isWishlisted = wishlist.includes(product.id);

  return (
    <div className="fs-card" onClick={() => onClick(product)}>
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
          className="fs-card-add"
          disabled={isOut}
          onClick={e => { e.stopPropagation(); onAdd(product); }}
        >
          <i className="ti ti-shopping-cart" aria-hidden="true" />
          {isOut ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
};

// ── CART DRAWER ──
const CartDrawer = ({ open, onClose, items, onQty, onRemove, total }) => {
  const handleCheckout = () => {
    if (!items.length) return;
    window.open(buildWAMessage(items, total), '_blank');
  };

  return (
    <>
      <div className={`fs-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`fs-cart-drawer ${open ? 'open' : ''}`}>
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
          <button className="fs-wa-checkout-btn" onClick={handleCheckout} disabled={!items.length}>
            <i className="ti ti-brand-whatsapp" aria-hidden="true" />
            Checkout on WhatsApp
          </button>
          <div className="fs-cart-trust">
            <span>🔒 100% Secure</span>
            <span>📱 MoMo Accepted</span>
          </div>
        </div>
      </div>
    </>
  );
};

// ── PRODUCT MODAL ──
const ProductModal = ({ product, onClose, onAdd }) => {
  const [qty, setQty] = useState(1);
  const [selectedPay, setSelectedPay] = useState('momo');

  if (!product) return null;

  const isOut = product.stock_quantity === 0;
  const emoji = getEmoji(product);
  const isImg = product.image_url && product.image_url.startsWith('http');
  const discount = getDiscount(parseFloat(product.price), parseFloat(product.compare_price));

  const handleAdd = () => {
    for (let i = 0; i < qty; i++) onAdd(product);
    onClose();
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
            {isImg ? <img src={product.image_url} alt={product.name} /> : emoji}
          </div>
          <div className="fs-modal-thumbs">
            <div className="fs-modal-thumb active">
              {isImg ? <img src={product.image_url} alt="" /> : emoji}
            </div>
          </div>
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
              <i className="ti ti-shopping-cart" aria-hidden="true" />
              {isOut ? 'Out of Stock' : 'Add to Cart'}
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
const Footer = () => (
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
        {['Track Order', 'Returns', 'Shipping Info', 'FAQs'].map(l => (
          <button key={l} className="fs-footer-link">{l}</button>
        ))}
      </div>
      <div>
        <div className="fs-footer-col-title">About Us</div>
        {['Our Story', 'Contact Us', 'Terms & Conditions', 'Privacy Policy'].map(l => (
          <button key={l} className="fs-footer-link">{l}</button>
        ))}
      </div>
      <div>
        <div className="fs-footer-col-title">Get in Touch</div>
        <button className="fs-footer-link" onClick={() => window.open(`https://wa.me/${WA_NUMBER}`, '_blank')}>
          📞 +{WA_NUMBER}
        </button>
        <button className="fs-footer-link">✉️ support@fleppystore.com</button>
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
    </div>
  </footer>
);

// ── BOTTOM NAV ──
const BottomNav = ({ onCartOpen, cartCount }) => (
  <nav className="fs-bottom-nav">
    <button className="fs-bottom-nav-item active">
      <i className="ti ti-home" aria-hidden="true" />
      Home
    </button>
    <button className="fs-bottom-nav-item">
      <i className="ti ti-category" aria-hidden="true" />
      Categories
    </button>
    <button className="fs-bottom-nav-item" onClick={onCartOpen} style={{ position: 'relative' }}>
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
    <button className="fs-bottom-nav-item">
      <i className="ti ti-heart" aria-hidden="true" />
      Wishlist
    </button>
    <button className="fs-bottom-nav-item">
      <i className="ti ti-user" aria-hidden="true" />
      Account
    </button>
  </nav>
);

// ── ROOT APP ──
export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeNav, setActiveNav] = useState('Home');
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

  const removeItem = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const toggleWishlist = (id) => setWishlist(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.category || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || (p.category || '').toLowerCase() === activeCategory.toLowerCase();
    return matchSearch && matchCat;
  });

  const deals = products.filter(p => p.is_deal);

  return (
    <div className="fs-app">
      <TopNav cartCount={cartCount} onCartOpen={() => setCartOpen(true)} search={search} onSearch={setSearch} />
      <SubNav activeNav={activeNav} onNavChange={setActiveNav} />
      <HeroSlider productCount={products.length} />
      <CategoryStrip active={activeCategory} onChange={setActiveCategory} />

      {/* Deals of the Day */}
      {deals.length > 0 && (
        <div className="fs-section">
          <div className="fs-section-header">
            <div className="fs-section-title">🔥 Deals of the Day</div>
            <button className="fs-section-link">View All Deals</button>
          </div>
          <div className="fs-product-grid">
            {deals.map(p => (
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
        </div>
      )}

      {/* All Products */}
      <div className="fs-section">
        <div className="fs-section-header">
          <div className="fs-section-title">
            {search ? `Results for "${search}"` : activeCategory === 'All' ? '🛍️ All Products' : activeCategory}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{filtered.length} items</div>
        </div>

        {loading ? (
          <div className="fs-loading">
            <div className="fs-spinner" />
            <span>Loading products...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="fs-empty">
            <i className="ti ti-mood-empty" />
            <p>No products found</p>
          </div>
        ) : (
          <div className="fs-product-grid">
            {filtered.map(p => (
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

      <WhyShop />
      <Footer />

      <BottomNav onCartOpen={() => setCartOpen(true)} cartCount={cartCount} />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onQty={updateQty}
        onRemove={removeItem}
        total={cartTotal}
      />

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={addToCart}
        />
      )}

      <button
        className="fs-wa-float"
        onClick={() => window.open(`https://wa.me/${WA_NUMBER}`, '_blank')}
        aria-label="WhatsApp"
      >
        <i className="ti ti-brand-whatsapp" aria-hidden="true" />
      </button>
    </div>
  );
}