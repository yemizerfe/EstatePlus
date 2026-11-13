import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Building2, Menu, ChevronDown, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';

const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN': return '🛡️';
      case 'ANALYST': return '📊';
      case 'PROPERTY_OWNER': return '🏠';
      default: return '👤';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] transition-colors duration-300">
      {/* Animated background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,1),rgba(0,0,0,1))]" />
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Floating orbs */}
      <div className="fixed top-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-float-slow pointer-events-none" />
      <div className="fixed bottom-20 left-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float pointer-events-none" />

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="relative z-10 lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 shadow-2xl">
          <div className="flex items-center justify-between px-3 sm:px-5 lg:px-5 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6 text-gray-300" />
              </button>

              {/* Logo (mobile only) */}
              <Link to="/app" className="lg:hidden flex items-center gap-2 group">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  EstatePlus
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              {/* Explore Public Market */}
              <Link
                to="/explore"
                className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 border border-blue-500/30 hover:border-blue-400/50 text-blue-300 hover:text-blue-200 text-sm font-semibold rounded-xl transition-all duration-300"
              >
                <Globe className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
                <span className="hidden sm:inline">Explore Market</span>
              </Link>

              {/* Notifications */}
              <NotificationBell />

              {/* User Menu */}
              {user && (
                <Link
                  to="/app/profile"
                  className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-xl transition-all duration-300 group"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full blur-sm opacity-50 group-hover:opacity-100 transition-opacity" />
                    <div className="relative w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-sm ring-2 ring-slate-700 group-hover:ring-blue-400 transition-all">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        getRoleIcon(user.role)
                      )}
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">
                      {user.name.split(' ')[0]}
                    </div>
                    <div className="text-xs text-gray-400 capitalize">
                      {user.role.toLowerCase().replace('_', ' ')}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-blue-300 transition-colors" />
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-h-screen px-3 pb-6 pt-3 sm:px-5 sm:pt-4 lg:px-5 lg:pt-4">
          <div key={location.pathname} className="page-enter w-full max-w-none lg:pr-2">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;