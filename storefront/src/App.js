import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const WHATSAPP_NUMBER = process.env.REACT_APP_WHATSAPP_NUMBER || '233244000000';
const SHOP_NAME = process.env.REACT_APP_SHOP_NAME || 'ProCyclone Shop';

const App = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, [search, category]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = { limit: 50, search, category };
      const res = await axios.get(`${API_URL}/products/public`, { params });
      const prods = res.data.products || [];
      setProducts(prods);

      // Extract unique categories
      const cats = [...new Set(prods.map(p => p.category).filter(Boolean))];
      setCategories(cats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { ...product, quantity }];
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateQty = (id, qty) => {
    if (qty < 1) return removeFromCart(id);
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  };

  const cartTotal = cart.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const orderViaWhatsApp = () => {
    if (cart.length === 0) return;
    const items = cart.map(i => `• ${i.name} x${i.quantity} — GH₵ ${(parseFloat(i.price) * i.quantity).toFixed(2)}`).join('\n');
    const msg = `Hello ${SHOP_NAME}! 👋\n\nI'd like to order:\n\n${items}\n\n*Total: GH₵ ${cartTotal.toFixed(2)}*\n\nPlease confirm my order. Thank you!`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const quickOrder = (product) => {
    const msg = `Hello ${SHOP_NAME}! 👋\n\nI'd like to order:\n\n• ${product.name} x1 — GH₵ ${parseFloat(product.price).toFixed(2)}\n\nPlease confirm my order. Thank you!`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🚲</span>
            <span className="logo-text">{SHOP_NAME}</span>
          </div>
          <div className="header-right">
            <button className="cart-btn" onClick={() => setShowCart(true)}>
              🛒 Cart
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="hero">
        <h1 className="hero-title">Shop Online, Order via WhatsApp</h1>
        <p className="hero-sub">Browse our products, add to cart and send your order in one tap</p>
      </div>

      {/* Search + filters */}
      <div className="filters-bar">
        <input
          className="search-input"
          placeholder="🔍 Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="category-pills">
          <button
            className={`pill ${category === '' ? 'active' : ''}`}
            onClick={() => setCategory('')}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`pill ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products grid */}
      <div className="products-section">
        {loading ? (
          <div className="loading">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="empty">
            <p>No products found</p>
          </div>
        ) : (
          <div className="products-grid">
            {products.map(product => (
              <div key={product.id} className="product-card">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="product-image" />
                ) : (
                  <div className="product-image-placeholder">📦</div>
                )}
                <div className="product-info">
                  {product.category && <span className="product-category">{product.category}</span>}
                  <h3 className="product-name" onClick={() => setSelectedProduct(product)}>{product.name}</h3>
                  {product.description && <p className="product-desc">{product.description}</p>}
                  <div className="product-footer">
                    <span className="product-price">GH₵ {parseFloat(product.price).toFixed(2)}</span>
                    {product.stock_quantity === 0 ? (
                      <span className="out-of-stock">Out of stock</span>
                    ) : (
                      <div className="product-actions">
                        <button className="btn-add" onClick={() => addToCart(product)}>+ Add</button>
                        <button className="btn-whatsapp" onClick={() => quickOrder(product)}>💬 Order</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <div className="float-cart" onClick={() => setShowCart(true)}>
          🛒 {cartCount} items — GH₵ {cartTotal.toFixed(2)}
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div className="overlay" onClick={() => setShowCart(false)}>
          <div className="cart-drawer" onClick={e => e.stopPropagation()}>
            <div className="cart-header">
              <h2>Your Cart</h2>
              <button onClick={() => setShowCart(false)} className="close-btn">✕</button>
            </div>

            {cart.length === 0 ? (
              <div className="empty" style={{ padding: '40px 20px' }}>
                <p>Your cart is empty</p>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map(item => (
                    <div key={item.id} className="cart-item">
                      <div className="cart-item-info">
                        <p className="cart-item-name">{item.name}</p>
                        <p className="cart-item-price">GH₵ {parseFloat(item.price).toFixed(2)} each</p>
                      </div>
                      <div className="cart-item-qty">
                        <button onClick={() => updateQty(item.id, item.quantity - 1)}>−</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, item.quantity + 1)}>+</button>
                      </div>
                      <div className="cart-item-total">
                        GH₵ {(parseFloat(item.price) * item.quantity).toFixed(2)}
                      </div>
                      <button className="remove-btn" onClick={() => removeFromCart(item.id)}>✕</button>
                    </div>
                  ))}
                </div>

                <div className="cart-footer">
                  <div className="cart-total">
                    <span>Total</span>
                    <span>GH₵ {cartTotal.toFixed(2)}</span>
                  </div>
                  <button className="whatsapp-order-btn" onClick={orderViaWhatsApp}>
                    💬 Order via WhatsApp
                  </button>
                  <p className="cart-note">
                    Clicking this will open WhatsApp with your order details pre-filled
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Product detail modal */}
      {selectedProduct && (
        <div className="overlay" onClick={() => setSelectedProduct(null)}>
          <div className="product-modal" onClick={e => e.stopPropagation()}>
            <button className="close-btn" style={{ alignSelf: 'flex-end' }} onClick={() => setSelectedProduct(null)}>✕</button>
            {selectedProduct.image_url && (
              <img src={selectedProduct.image_url} alt={selectedProduct.name} style={{ width: '100%', borderRadius: '8px', marginBottom: '16px' }} />
            )}
            <h2 style={{ margin: '0 0 8px' }}>{selectedProduct.name}</h2>
            {selectedProduct.category && <span className="product-category">{selectedProduct.category}</span>}
            {selectedProduct.description && <p style={{ color: '#666', margin: '12px 0' }}>{selectedProduct.description}</p>}
            <p style={{ fontSize: '24px', fontWeight: '700', color: '#25D366', margin: '12px 0' }}>
              GH₵ {parseFloat(selectedProduct.price).toFixed(2)}
            </p>
            {selectedProduct.stock_quantity === 0 ? (
              <p style={{ color: '#e74c3c', fontWeight: '600' }}>Out of stock</p>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-add" style={{ flex: 1, padding: '12px' }} onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}>+ Add to Cart</button>
                <button className="btn-whatsapp" style={{ flex: 1, padding: '12px' }} onClick={() => quickOrder(selectedProduct)}>💬 Order Now</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <p>© 2024 {SHOP_NAME} — Order via WhatsApp</p>
      </footer>
    </div>
  );
};

export default App;
