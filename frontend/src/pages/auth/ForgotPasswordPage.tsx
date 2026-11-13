import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, CheckCircle, Info } from 'lucide-react';
import { apiClient } from '../../api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data } = await apiClient.post<{ data?: { exists?: boolean; isValid?: boolean; authProvider?: string; hasLocalPassword?: boolean } }>('/auth/verify-email', {
        email,
      });

      const accountInfo = data?.data;
      const exists = !!accountInfo?.exists;
      const isValid = accountInfo?.isValid !== false;

      if (!isValid) {
        setError('Please enter a valid email address.');
        return;
      }

      if (!exists) {
        setSuccess('If your email is registered, reset instructions will be sent to your email address.');
        return;
      }

      if (accountInfo?.authProvider === 'google' || !accountInfo?.hasLocalPassword) {
        setError('This account was created with Google Sign-In, so password reset is not allowed. Please continue using Google to sign in.');
        return;
      }

      await apiClient.post('/auth/forgot-password', { email });
      setSuccess('Password reset instructions have been sent to your email address.');
    } catch (err: any) {
      if (err.response?.status === 404 || err.response?.status === 401) {
        setError('This email is not registered for email/password sign-in.');
        return;
      }
      setError(err.response?.data?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
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
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </Link>

            <div className="mt-8 mb-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 via-cyan-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-semibold text-white">EstatePlus</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-2">Forgot password?</h1>
              <p className="text-base text-gray-400">No worries, we’ll send you reset instructions.</p>
            </div>

            <div className="mb-6 p-4 bg-slate-800/60 border border-white/10 rounded-xl text-gray-300 text-sm flex items-center gap-2">
              <Info className="w-4 h-4 flex-shrink-0" />
              Google sign-in accounts do not have a password to reset. If you signed up with Google, use Google to continue signing in.
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

              <div className="hidden">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value=""
                    readOnly
                    className="w-full px-3.5 py-3 pr-11 bg-slate-900/50 border border-white/15 rounded-xl opacity-0 pointer-events-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? 'Hide' : 'Show'}
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
                    Sending...
                  </span>
                ) : (
                  'Reset password'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-400">
              Remember your password?{' '}
              <Link to="/login" className="text-blue-300 font-semibold hover:text-blue-200 transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          <div className="hidden lg:flex rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 xl:p-10 items-center">
            <div className="max-w-md text-white">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-300 px-4 py-2 rounded-full text-sm font-semibold mb-6">
                <CheckCircle className="w-4 h-4" />
                Secure recovery
              </div>

              <h2 className="text-4xl font-black tracking-tight mb-4">Need help getting back in?</h2>
              <p className="text-lg leading-relaxed text-slate-300">
                Enter your email and we’ll verify whether your account uses local password sign-in before sending a reset link.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  'Secure reset link verification',
                  'Google account protection',
                  'Quick, simple recovery flow',
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-slate-300">{feature}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
