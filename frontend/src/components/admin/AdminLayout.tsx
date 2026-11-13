import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Compass } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AdminSidebar from './AdminSidebar';

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get current page name from the path
  const getPageName = () => {
    const path = location.pathname;

    // Detail pages end in an id, so name them from their parent segment.
    if (path.startsWith('/admin/users/')) return 'User Details';
    if (path.startsWith('/admin/data-sources/')) return 'Data Source';

    const pathParts = path.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    
    // Map of route segments to display names
    const nameMap: { [key: string]: string } = {
      'dashboard': 'Dashboard',
      'users': 'Users',
      'roles': 'Roles',
      'permissions': 'Permissions',
      'organizations': 'Organizations',
      'property-approvals': 'Property Approvals',
      'data-sources': 'Data Sources',
      'import': 'Import Data',
      'integrations': 'Integrations',
      'audit-logs': 'Audit Logs',
      'system-health': 'System Health',
      'notifications': 'Notifications',
      'settings': 'Settings',
      'profile': 'Admin Profile'
    };

    return nameMap[lastPart] || 'Admin';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Sidebar */}
      <AdminSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-white/10">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6 text-gray-300" />
              </button>
              <div>
                <h2 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  {getPageName()}
                </h2>
              </div>
            </div>

            {/* User Info */}
            {user && (
              <div className="flex items-center gap-3">
                {/* Market Explore Button */}
                <button
                  onClick={() => navigate('/app/market-explorer')}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 border border-blue-500/30 rounded-xl hover:from-blue-500/30 hover:to-cyan-500/30 transition-all duration-300 font-semibold"
                >
                  <Compass className="w-4 h-4" />
                  Market Explore
                </button>
                
                <button
                  onClick={() => navigate('/admin/profile')}
                  className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-white/5 transition-colors"
                  title="Open admin profile"
                >
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-medium text-white">{user.name}</div>
                    <div className="text-xs text-gray-400">Administrator</div>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full blur-sm opacity-50" />
                    <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-semibold ring-2 ring-slate-700">
                      {user.name.charAt(0)}
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6">
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
        />
      )}
    </div>
  );
};

export default AdminLayout;
