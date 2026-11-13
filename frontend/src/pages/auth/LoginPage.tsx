import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { BASE_URL } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { Building2, CheckCircle, ArrowLeft, Info, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.message) {
      setSuccess(location.state.message);
    }
    // Feedback after returning from an OAuth provider (cancel or failure).
    const params = new URLSearchParams(location.search);
    if (params.get('oauth') === 'cancelled') {
      setNotice('Sign-in with Google was cancelled. You can pick up right where you left off.');
    }
    if (params.get('error') === 'oauth_failed') {
      setError("Couldn't complete sign-in with Google. Please try again.");
    }
    if (params.get('oauth') === 'email_exists') {
      setError('This email is already registered. Please sign in with your password below.');
    }
    if (params.get('oauth') === 'signup_required') {
      setError('No account was found for this Google sign-in. Please sign up first, then sign in with Google.');
    }
    if (params.get('reason') === 'session-timeout') {
      setNotice('You were signed out after a period of inactivity.');
    }
  }, [location]);

  // Return users to the page where they originally requested sign-in.
  // `from` can be a router location object (set by ProtectedRoute) or a plain
  // path string (set by public pages); falls back to the home page.
  const getPostAuthRedirect = (): string => {
    // OAuth round-trips deliver the intended destination back via query param.
    const qRedirect = new URLSearchParams(location.search).get('redirect');
    if (qRedirect && qRedirect.startsWith('/') && !qRedirect.startsWith('//')) {
      return qRedirect;
    }
    const from = (location.state as { from?: unknown } | null)?.from;
    if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) {
      return from;
    }
    if (from && typeof from === 'object') {
      const { pathname, search } = from as { pathname?: string; search?: string };
      if (pathname && pathname.startsWith('/') && !pathname.startsWith('//')) {
        return `${pathname}${search ?? ''}`;
      }
    }
    // `/app` resolves to the right dashboard for the signed-in role.
    return '/app';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(getPostAuthRedirect(), { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Carry this page (for Cancel) and the user's destination (for success)
    // through the OAuth round-trip so they always land back where expected.
    const params = new URLSearchParams({
      redirect: getPostAuthRedirect(),
      returnTo: `${location.pathname}${location.search}`,
      intent: 'login',
    });
    window.location.href = `${BASE_URL}/auth/google?${params.toString()}`;
  };

  const handleBack = () => {
    const from = (location.state as any)?.from;
    if (from) {
      navigate(from);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,1),rgba(0,0,0,1))]" />
      <div className="fixed inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="fixed top-20 left-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-float-slow pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] items-stretch gap-8">
          <div className="rounded-[2rem] border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-2xl shadow-blue-950/20 p-6 sm:p-8 lg:p-10">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="mt-8 mb-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 via-cyan-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-semibold text-white">EstatePlus</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-2">Welcome back</h1>
              <p className="text-base text-gray-400">Please sign in to your account.</p>
            </div>

            {success && (
              <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {success}
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            {notice && (
              <div className="mb-6 p-4 bg-slate-800/60 border border-white/10 rounded-xl text-gray-300 text-sm flex items-center gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />
                {notice}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-900/60 border border-white/15 rounded-xl hover:bg-slate-800/70 hover:border-white/30 transition-all font-medium text-white mb-6"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-900/40 text-slate-400">or</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-3 bg-slate-900/50 border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white placeholder:text-slate-500"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-3 pr-11 bg-slate-900/50 border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white placeholder:text-slate-500"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6 shadow-lg shadow-blue-500/25"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <div className="mt-5 text-center">
              <Link to="/forgot-password" className="text-sm text-gray-400 hover:text-white font-medium transition-colors">
                Forgot your password?
              </Link>
            </div>

            <p className="mt-6 text-center text-sm text-gray-400">
              Don't have an account?{' '}
              <Link
                to="/register"
                state={{ from: getPostAuthRedirect() }}
                className="text-blue-300 font-semibold hover:text-blue-200 transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>

          <div className="hidden lg:flex rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 xl:p-10 items-center">
            <div className="max-w-md text-white">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-300 px-4 py-2 rounded-full text-sm font-semibold mb-6">
                <CheckCircle className="w-4 h-4" />
                Trusted insights
              </div>

              <h2 className="text-4xl font-black tracking-tight mb-4">Welcome back to EstatePlus</h2>
              <p className="text-lg leading-relaxed text-slate-300">
                Continue your property journey with live market intelligence, smarter searches, and actionable recommendations.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  'Secure access to your dashboard',
                  'Real-time market updates and pricing signals',
                  'AI-powered property and neighborhood insights',
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-slate-300">{feature}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10 grid grid-cols-2 gap-4 text-left">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-2xl font-black text-white">24/7</div>
                  <div className="text-sm text-slate-400">Market monitoring</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-2xl font-black text-white">AI</div>
                  <div className="text-sm text-slate-400">Smart recommendations</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
