import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';

export default function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="staffx-content">
        <TopHeader onMenuClick={() => setSidebarOpen(o => !o)} />
        <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
