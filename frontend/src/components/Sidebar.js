import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const links = [
    { to: '/', label: '📊 Overview', exact: true },
    { to: '/orders', label: '🛍️ Orders' },
    { to: '/customers', label: '👥 Customers' },
    { to: '/products', label: '📦 Products' },
    { to: '/riders', label: '🏍️ Riders' },
    { to: '/cash', label: '💰 Cash Control' },
  ];

  return (
    <div style={{width:'240px',minHeight:'100vh',background:'#1a1a2e',display:'flex',flexDirection:'column',position:'fixed',left:0,top:0}}>
      <div style={{padding:'24px 20px',borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
        <h2 style={{color:'white',margin:'0 0 4px',fontSize:'20px',fontWeight:'bold'}}>Pro Cyclone</h2>
        <p style={{color:'rgba(255,255,255,0.5)',margin:0,fontSize:'12px'}}>Business Dashboard</p>
      </div>
      <nav style={{flex:1,padding:'16px 0'}}>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.exact} style={({ isActive }) => ({ display:'block', padding:'12px 20px', color: isActive ? 'white' : 'rgba(255,255,255,0.7)', textDecoration:'none', fontSize:'14px', background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent', borderLeft: isActive ? '3px solid #4CAF50' : '3px solid transparent' })}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div style={{padding:'20px',borderTop:'1px solid rgba(255,255,255,0.1)'}}>
        <p style={{color:'white',margin:'0 0 2px',fontSize:'14px',fontWeight:'500'}}>{user?.name}</p>
        <p style={{color:'rgba(255,255,255,0.5)',margin:'0 0 12px',fontSize:'12px',textTransform:'capitalize'}}>{user?.role}</p>
        <button onClick={handleLogout} style={{width:'100%',padding:'8px',background:'rgba(255,255,255,0.1)',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'14px'}}>Logout</button>
      </div>
    </div>
  );
};

export default Sidebar;