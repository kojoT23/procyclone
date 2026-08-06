import React, { useState, useEffect, useCallback } from 'react';
import { quickLinksAPI } from '../utils/api';

// A small, growable list of external bookmarks (ICUMS portal, GRA site,
// forwarder tracking pages, etc.) — add as many as you need over time.
// Nothing here talks to those sites directly; it's just a saved list
// of links that open in a new tab.
export default function QuickLinksBar() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchLinks = useCallback(() => {
    quickLinksAPI.getAll()
      .then(res => setLinks(res.data.links || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const handleAdd = async () => {
    if (!label.trim() || !url.trim()) return alert('Enter both a name and a URL');
    setSaving(true);
    try {
      await quickLinksAPI.create({ label: label.trim(), url: url.trim() });
      setLabel(''); setUrl(''); setAdding(false);
      fetchLinks();
    } catch (err) {
      alert(err.response?.data?.message || 'Error adding link');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (link) => {
    if (!window.confirm(`Remove "${link.label}" from Quick Links?`)) return;
    try {
      await quickLinksAPI.delete(link.id);
      fetchLinks();
    } catch (err) {
      alert(err.response?.data?.message || 'Error removing link');
    }
  };

  if (loading) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      {links.map(link => (
        <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f3f4f6', borderRadius: 20, padding: '4px 4px 4px 12px' }}>
          <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: '#1a1a18', textDecoration: 'none' }}>
            🔗 {link.label}
          </a>
          <button
            onClick={() => handleDelete(link)}
            title="Remove"
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}
          >
            ✕
          </button>
        </div>
      ))}

      {adding ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            className="form-input"
            placeholder="Name (e.g. ICUMS)"
            value={label}
            onChange={e => setLabel(e.target.value)}
            style={{ width: 140, padding: '6px 8px', fontSize: 12 }}
          />
          <input
            className="form-input"
            placeholder="https://..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            style={{ width: 200, padding: '6px 8px', fontSize: 12 }}
          />
          <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving}>{saving ? '...' : 'Add'}</button>
          <button className="btn btn-sm" onClick={() => { setAdding(false); setLabel(''); setUrl(''); }}>Cancel</button>
        </div>
      ) : (
        <button className="btn btn-sm" onClick={() => setAdding(true)} style={{ borderStyle: 'dashed' }}>
          + Add Link
        </button>
      )}
    </div>
  );
}
