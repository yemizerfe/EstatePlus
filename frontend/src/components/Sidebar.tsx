import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  Building2,
  Map,
  MapPin,
  Calculator,
  MessageSquare,
  Home,
  PlusCircle,
  DollarSign,
  FileText,
  CheckSquare,
  Users,
  Activity,
  LogOut,
  X,
  Heart,
  BarChart3,
  Monitor,
  Sparkles,
  Bell,
  Settings,
  CalendarRange,
  Database,
  FileBarChart,
  Brain,
} from 'lucide-react';
import { useAuth, UserRole } from '../contexts/AuthContext';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

// USER Navigation
const userNavigation: NavSection[] = [
  {
    title: 'My Dashboard',
    items: [
      { path: '/app/user-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    ],
  },
  {
    items: [
      { path: '/app/saved-properties', label: 'Saved Properties', icon: <Heart className="w-5 h-5" /> },
      { path: '/app/compare', label: 'Compare Properties', icon: <BarChart3 className="w-5 h-5" /> },
      { path: '/app/my-neighborhoods', label: 'My Neighborhoods', icon: <MapPin className="w-5 h-5" /> },
      { path: '/app/scenarios', label: 'Scenarios', icon: <Calculator className="w-5 h-5" /> },
      { path: '/app/ai-assistant', label: 'AI Assistant', icon: <MessageSquare className="w-5 h-5" /> },
    ],
  },
];

// PROPERTY OWNER Navigation
const ownerNavigation: NavSection[] = [
  {
    items: [
      { path: '/app/owner-dashboard', label: 'Dashboard', icon: <Home className="w-5 h-5" /> },
    ],
  },
  {
    title: 'My Properties',
    items: [
      { path: '/app/my-properties', label: 'All Properties', icon: <Building2 className="w-5 h-5" /> },
      { path: '/app/my-properties/add', label: 'Add Property', icon: <PlusCircle className="w-5 h-5" /> },
      { path: '/app/drafts', label: 'Drafts', icon: <FileText className="w-5 h-5" /> },
    ],
  },
  {
    items: [
      { path: '/app/inquiries', label: 'Inquiries', icon: <MessageSquare className="w-5 h-5" /> },
      { path: '/app/viewings', label: 'Viewings', icon: <CalendarRange className="w-5 h-5" /> },
      { path: '/app/analytics', label: 'Analytics', icon: <BarChart3 className="w-5 h-5" /> },
      { path: '/app/saved-properties', label: 'Saved Properties', icon: <Heart className="w-5 h-5" /> },
      { path: '/app/documents', label: 'Documents', icon: <FileText className="w-5 h-5" /> },
      { path: '/app/notifications', label: 'Notifications', icon: <Bell className="w-5 h-5" /> },
    ],
  },
  {
    items: [
      { path: '/app/profile', label: 'Profile & Settings', icon: <Settings className="w-5 h-5" /> },
    ],
  },
];

// ANALYST Navigation
const analystNavigation: NavSection[] = [
  {
    items: [
      { path: '/app/analyst-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    ],
  },
  {
    title: 'Market Analysis',
    items: [
      { path: '/app/pricing-analysis', label: 'Pricing Analysis', icon: <DollarSign className="w-5 h-5" /> },
      { path: '/app/market-explorer', label: 'Market Explorer', icon: <Map className="w-5 h-5" /> },
      { path: '/app/analyst-neighborhoods', label: 'Neighborhoods', icon: <MapPin className="w-5 h-5" /> },
      { path: '/app/analyst-properties', label: 'Properties', icon: <Building2 className="w-5 h-5" /> },
    ],
  },
  {
    title: 'Data & Intelligence',
    items: [
      { path: '/app/economic-indicators', label: 'Economic Indicators', icon: <DollarSign className="w-5 h-5" /> },
      { path: '/app/data-sources', label: 'Data Sources', icon: <Database className="w-5 h-5" /> },
      { path: '/app/analyst-imports', label: 'Upload & Imports', icon: <Upload className="w-5 h-5" /> },
      { path: '/app/analyst-reports', label: 'Reports', icon: <FileBarChart className="w-5 h-5" /> },
      { path: '/app/ai-insights', label: 'AI Insights', icon: <Brain className="w-5 h-5" /> },
    ],
  },
  {
    items: [
      { path: '/app/notifications', label: 'Notifications', icon: <Bell className="w-5 h-5" /> },
      { path: '/app/analyst-settings', label: 'Profile & Settings', icon: <Settings className="w-5 h-5" /> },
    ],
  },
];

// ADMIN Navigation
const adminNavigation: NavSection[] = [
  {
    title: 'Admin Dashboard',
    items: [
      { path: '/app/admin-dashboard', label: 'Dashboard', icon: <Monitor className="w-5 h-5" /> },
    ],
  },
  {
    items: [
      { path: '/app/user-management', label: 'User Management', icon: <Users className="w-5 h-5" /> },
      { path: '/app/property-approvals', label: 'Property Approvals', icon: <CheckSquare className="w-5 h-5" /> },
      { path: '/app/audit-logs', label: 'Audit Logs', icon: <FileText className="w-5 h-5" /> },
      { path: '/app/system-monitoring', label: 'System Monitoring', icon: <Activity className="w-5 h-5" /> },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const getNavigation = (): NavSection[] => {
    if (!user) return userNavigation;
    
    switch (user.role) {
      case 'PROPERTY_OWNER':
        return ownerNavigation;
      case 'ANALYST':
        return analystNavigation;
      case 'ADMIN':
        return adminNavigation;
      default:
        return userNavigation;
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return '🛡️';
      case 'ANALYST': return '📊';
      case 'PROPERTY_OWNER': return '🏠';
      default: return '👤';
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navigation = getNavigation();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900/95 backdrop-blur-xl border-r border-white/10 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 overflow-y-auto custom-scrollbar`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/30 rounded-2xl blur-lg animate-pulse-glow" />
              <div className="relative w-11 h-11 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <Building2 className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <div className="text-lg font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                EstatePlus
              </div>
              <div className="text-xs text-gray-500 font-semibold tracking-wider">INTELLIGENCE</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* User Profile */}
        {user && (
          <div className="p-4 mx-4 mt-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full blur-sm opacity-50" />
                <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-xl ring-2 ring-slate-700">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    getRoleIcon(user.role)
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{user.name}</div>
                <div className="text-xs text-gray-400 capitalize">{user.role.toLowerCase().replace('_', ' ')}</div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-4 space-y-6">
          {navigation.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {section.title && (
                <div className="flex items-center gap-2 px-3 mb-3">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {section.title}
                  </h3>
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive =
                    location.pathname === item.path ||
                    location.pathname.startsWith(`${item.path}/`);
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => onClose()}
                      className={`group flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 border border-blue-500/30 shadow-lg shadow-blue-500/20'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className={`transition-all duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                        {item.icon}
                      </div>
                      <span className="flex-1">{item.label}</span>
                      {isActive && (
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}

          </nav>

        {/* Logout Button */}
        <div className="p-4 mt-auto border-t border-white/10">
          <button
            onClick={handleLogout}
            className="group w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-300"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;


