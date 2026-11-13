import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Building2, Menu, X, LayoutDashboard, User, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';

const PublicNavbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const authFromState = { from: `${location.pathname}${location.search}` };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/explore', label: 'Explore Market' },
    { path: '/properties', label: 'Properties' },
    { path: '/neighborhoods', label: 'Neighborhoods' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/80 text-slate-900 shadow-2xl border-b border-slate-200/80 dark:bg-slate-900/95 dark:text-white dark:border-blue-500/20'
          : 'bg-white/70 text-slate-900 backdrop-blur-lg dark:bg-slate-900/80 dark:text-white'
      }`}
    >
      {/* Animated gradient border */}
      <div className="absolute bottom-0 left-0 right-0 h-px">
        <div className="h-full bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-border-flow" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo with floating animation */}
          <Link to="/" className="flex items-center space-x-3 group relative">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/30 rounded-2xl blur-xl group-hover:bg-blue-400/50 transition-all duration-500 animate-pulse-glow" />
              <div className="relative z-10 w-12 h-12 bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg shadow-blue-500/50">
                <Building2 className="h-7 w-7 text-white animate-float" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent animate-gradient-text">
                EstatePlus
              </span>
              <span className="text-xs text-blue-400/70 font-semibold tracking-widest uppercase">
                Market Intelligence
              </span>
            </div>
            <Sparkles className="h-4 w-4 text-yellow-400 absolute -top-1 -right-2 animate-sparkle" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  `relative group px-5 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                    isActive
                      ? 'text-blue-500 dark:text-blue-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-gray-300 dark:hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative z-10">{link.label}</span>
                    {isActive && (
                      <>
                        <div className="absolute inset-0 bg-blue-500/10 rounded-xl backdrop-blur-sm dark:bg-blue-500/20" />
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full animate-pulse" />
                      </>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/10 group-hover:to-cyan-500/10 rounded-xl transition-all duration-300 scale-95 group-hover:scale-100" />
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Right Side - Auth or Profile */}
          <div className="hidden lg:flex items-center gap-3">
            {isAuthenticated && user ? (
              <>
                {/* Notifications */}
                <NotificationBell />

                {/* Dashboard Button */}
                <Link
                  to="/app"
                  className="group relative px-5 py-2.5 overflow-hidden rounded-xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-cyan-600/10 group-hover:from-blue-600/20 group-hover:to-cyan-600/20 transition-all duration-300 dark:from-blue-600/20 dark:to-cyan-600/20" />
                  <div className="flex items-center space-x-2 relative z-10">
                    <LayoutDashboard className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    <span className="text-slate-700 group-hover:text-slate-900 font-semibold transition-colors dark:text-gray-200 dark:group-hover:text-white">
                      Dashboard
                    </span>
                  </div>
                </Link>

                {/* Profile Avatar */}
                <button
                  onClick={() => {
                    // Redirect admin users to admin profile, others to app profile
                    if (user.role === 'ADMIN') {
                      navigate('/admin/profile');
                    } else {
                      navigate('/app/profile');
                    }
                  }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full animate-spin-slow blur-sm opacity-75 group-hover:opacity-100 transition-opacity" />
                  <div className="relative w-11 h-11 rounded-full overflow-hidden ring-2 ring-slate-300 group-hover:ring-blue-400 transition-all duration-300 dark:ring-slate-700">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white">
                        {getInitials(user.name)}
                      </div>
                    )}
                  </div>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  state={authFromState}
                  className="group relative px-5 py-2.5 overflow-hidden rounded-xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 to-cyan-600/0 group-hover:from-blue-600/20 group-hover:to-cyan-600/20 transition-all duration-300" />
                  <span className="relative z-10 text-slate-700 group-hover:text-slate-900 font-semibold transition-colors dark:text-gray-200 dark:group-hover:text-white">
                    Login
                  </span>
                </Link>
                <Link
                  to="/register"
                  state={authFromState}
                  className="group relative px-6 py-2.5 overflow-hidden rounded-xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 animate-gradient-xy" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative z-10 font-bold text-white">
                    Get Started
                  </span>
                  <div className="absolute inset-0 -z-10 blur-xl bg-gradient-to-r from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-70 transition-opacity duration-500" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-700 hover:text-slate-900 transition-colors dark:text-gray-300 dark:hover:text-white"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-white/95 text-slate-900 border-b border-slate-200/80 backdrop-blur-xl animate-slideDown shadow-2xl dark:bg-slate-900/98 dark:text-white dark:border-blue-500/20">
          <div className="px-4 py-6 space-y-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-3 rounded-xl font-semibold transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 text-blue-500 border border-blue-500/30 dark:text-blue-400'
                      : 'text-slate-700 hover:bg-blue-500/10 hover:text-slate-900 dark:text-gray-300 dark:hover:text-white'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <div className="pt-4 space-y-3 border-t border-gray-700/50">
              {isAuthenticated && user ? (
                <>
                  <Link
                    to="/app"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center space-x-3 px-4 py-3 text-slate-700 hover:text-slate-900 hover:bg-blue-500/10 rounded-xl font-semibold transition-all dark:text-gray-300 dark:hover:text-white"
                  >
                    <LayoutDashboard className="h-5 w-5" />
                    <span>Dashboard</span>
                  </Link>
                  <Link
                    to={user.role === 'ADMIN' ? '/admin/profile' : '/app/profile'}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center space-x-3 px-4 py-3 text-slate-700 hover:text-slate-900 hover:bg-blue-500/10 rounded-xl font-semibold transition-all dark:text-gray-300 dark:hover:text-white"
                  >
                    <User className="h-5 w-5" />
                    <span>Profile & Settings</span>
                  </Link>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center space-x-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl font-semibold transition-all"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    state={authFromState}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-3 text-center text-slate-700 hover:text-slate-900 hover:bg-blue-500/10 rounded-xl font-semibold transition-all dark:text-gray-300 dark:hover:text-white"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    state={authFromState}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-3 text-center bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl font-bold text-white hover:shadow-lg hover:shadow-blue-500/50 transition-all"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes gradient-text {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes gradient-xy {
          0%, 100% { background-position: 0% 0%; }
          25% { background-position: 100% 0%; }
          50% { background-position: 100% 100%; }
          75% { background-position: 0% 100%; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes border-flow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }
        .animate-gradient-text {
          background-size: 200% 200%;
          animation: gradient-text 3s ease infinite;
        }
        .animate-gradient-xy {
          background-size: 200% 200%;
          animation: gradient-xy 4s ease infinite;
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-sparkle {
          animation: sparkle 2s ease-in-out infinite;
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .animate-border-flow {
          animation: border-flow 2s ease-in-out infinite;
        }
        .animate-wiggle:hover {
          animation: wiggle 0.5s ease-in-out;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </nav>
  );
};

export default PublicNavbar;
