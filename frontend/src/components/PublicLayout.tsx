import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import PublicNavbar from './PublicNavbar';

const PublicLayout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] transition-colors duration-300">
      <PublicNavbar />
      <main className="relative z-10">
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default PublicLayout;
