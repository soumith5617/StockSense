import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-wrapper">
        <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <main className="content-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
