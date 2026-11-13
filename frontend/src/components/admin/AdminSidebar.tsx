import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Shield, 
  X,
  LayoutDashboard,
  Users,
  Database,
  Plug,
  FileText,
  Activity,
  Bell,
  User,
  LogOut,
  ClipboardCheck,
  Upload
} from 'lucide-react';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen, onClose, onLogout }) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const navigation = [
    { 
      name: 'Dashboard', 
      path: '/admin/dashboard', 
      icon: LayoutDashboard
    },
    {
      section: 'USER MANAGEMENT'
    },
    { 
      name: 'Users', 
      path: '/admin/users', 
      icon: Users 
    },
    {
      section: 'MARKETPLACE'
    },
    {
      name: 'Property Approvals',
      path: '/admin/property-approvals',
      icon: ClipboardCheck
    },
    {
      section: 'DATA & INTEGRATIONS'
    },
    { 
      name: 'Data Sources', 
      path: '/admin/data-sources', 
      icon: Database 
    },
    { 
      name: 'Import Data', 
      path: '/admin/import', 
      icon: Upload 
    },
    { 
      name: 'Integrations', 
      path: '/admin/integrations', 
      icon: Plug 
    },
    {
      section: 'MONITORING'
    },
    { 
      name: 'Audit Logs', 
      path: '/admin/audit-logs', 
      icon: FileText 
    },
    { 
      name: 'System Health', 
      path: '/admin/system-health', 
      icon: Activity 
    },
    { 
      name: 'Notifications', 
      path: '/admin/notifications', 
      icon: Bell 
    },
    {
      section: 'ACCOUNT'
    },
    { 
      name: 'Admin Profile', 
      path: '/admin/profile', 
      icon: User 
    }
  ];

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900/95 backdrop-blur-xl border-r border-white/10 transform transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} overflow-y-auto custom-scrollbar`}>
      {/* Sidebar Header */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-white/10">
        <div className="flex items-center gap-3 group">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/30 rounded-xl blur-lg animate-pulse-glow" />
            <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              <Shield className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-sm font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Admin</h1>
            <p className="text-xs text-gray-500 font-semibold tracking-wider">CONTROL CENTER</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {navigation.map((item, index) => {
          if ('section' in item) {
            return (
              <div key={index} className="pt-4 pb-2 px-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {item.section}
                </h3>
              </div>
            );
          }

          const Icon = item.icon!;
          const active = isActive(item.path!);

          return (
            <Link
              key={item.path}
              to={item.path!}
              onClick={onClose}
              className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                active
                  ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 border border-blue-500/30 shadow-lg shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className={`transition-all duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="flex-1">{item.name}</span>
              {active && (
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              )}
            </Link>
          );
        })}

        {/* Sign Out */}
        <button
          onClick={onLogout}
          className="w-full group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-300 mt-4"
        >
          <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
          <span>Sign Out</span>
        </button>
      </nav>
    </aside>
  );
};

export default AdminSidebar;
