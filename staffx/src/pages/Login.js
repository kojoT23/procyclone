import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f9f8', padding: 20 }}>
      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 360, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a18', margin: '0 0 4px', textAlign: 'center' }}>StaffX</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 24px', textAlign: 'center' }}>Shorewinds Staff Portal</p>

        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@shorewinds.com"
          required
          style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }}
        />

        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, marginBottom: 20, boxSizing: 'border-box' }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
        >
          {loading ? 'Logging in…' : 'Log In'}
        </button>
      </form>
    </div>
  );
}
