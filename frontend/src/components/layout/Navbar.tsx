import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LayoutDashboard, Building2, MapPin, TrendingUp, DollarSign, Zap, MessageSquare, Settings, LogOut } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/properties', label: 'Properties', icon: Building2 },
    { to: '/neighborhoods', label: 'Neighborhoods', icon: MapPin },
    { to: '/forecasting', label: 'Forecasting', icon: TrendingUp },
    { to: '/economics', label: 'Economics', icon: DollarSign },
    { to: '/scenarios', label: 'Scenarios', icon: Zap },
    { to: '/ai', label: 'AI Assistant', icon: MessageSquare },
  ];

  return (
    <nav className="bg-gradient-to-r from-white via-slate-50 to-white backdrop-blur-sm border-b border-slate-200/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/dashboard" className="flex items-center px-2 text-slate-800 font-bold text-xl">
              <div className="w-8 h-8 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg flex items-center justify-center mr-2">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              EstatePlus
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
              {navLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    isActive(to)
                      ? 'border-slate-600 text-slate-800 bg-gradient-to-b from-transparent to-slate-100/50'
                      : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-1.5" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {user?.role === 'admin' && (
              <Link to="/admin/users" className="text-sm text-slate-600 hover:text-slate-800 flex items-center px-3 py-1.5 rounded-lg hover:bg-slate-100/50 transition-colors">
                <Settings className="w-4 h-4 mr-1" />
                Admin
              </Link>
            )}
            <div className="text-sm text-slate-700 bg-white/60 px-3 py-1.5 rounded-lg border border-slate-200/50">
              {user?.firstName} {user?.lastName}
              <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-slate-600 to-slate-700 text-white text-xs rounded-full">{user?.role}</span>
            </div>
            <button onClick={handleLogout} className="text-slate-600 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100/50 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
