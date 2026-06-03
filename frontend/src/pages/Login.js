import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', fontFamily: 'var(--font)',
    }}>
      {/* Background pattern */}
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.03,
        backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '26px', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(34,197,94,0.3)',
          }}>🚲</div>
          <h1 style={{ color: 'white', fontSize: '24px', fontWeight: '700', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            ProCyclone
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
            Sign in to your dashboard
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'white', borderRadius: '20px',
          padding: '32px', boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        }}>
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: '8px', padding: '12px 14px',
              color: '#dc2626', fontSize: '13px', marginBottom: '20px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@procyclone.com"
                required
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px',
                background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0f172a, #1e293b)',
                color: 'white', border: 'none', borderRadius: '10px',
                fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font)', letterSpacing: '0.2px',
                transition: 'all 0.15s', boxShadow: '0 4px 12px rgba(15,23,42,0.3)',
              }}
            >
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#94a3b8' }}>
            Forgot your password?{' '}
            <a href="/reset-password" style={{ color: '#0f172a', fontWeight: '600', textDecoration: 'none' }}>
              Reset it
            </a>
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>
          © 2024 ProCyclone — Ghana
        </p>
      </div>
    </div>
  );
};

export default Login;
