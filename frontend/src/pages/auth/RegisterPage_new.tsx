import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BASE_URL } from '../../api/client';
import { register } from '../../api/auth';
import { Building2, Check, X } from 'lucide-react';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    accountType: 'user' as 'user' | 'property_owner',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const navigate = useNavigate();

  // Password strength validation
  const passwordRequirements = {
    minLength: formData.password.length >= 8,
    hasUpperCase: /[A-Z]/.test(formData.password),
    hasLowerCase: /[a-z]/.test(formData.password),
    hasNumber: /[0-9]/.test(formData.password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
  };

  const passwordStrength = Object.values(passwordRequirements).filter(Boolean).length;
  const isPasswordStrong = passwordStrength >= 4;

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 2) return 'bg-red-500';
    if (passwordStrength === 3) return 'bg-amber-500';
    if (passwordStrength === 4) return 'bg-emerald-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength <= 2) return 'Weak';
    if (passwordStrength === 3) return 'Fair';
    if (passwordStrength === 4) return 'Good';
    return 'Strong';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isPasswordStrong) {
      setError('Please create a stronger password that meets the requirements');
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...registerData } = formData;
      await register(registerData);
      navigate('/login', { state: { message: 'Account created successfully! Please sign in.' } });
    } catch (err: any) {
      console.error('Registration error:', err.response?.data);
      const errorMessage = err.response?.data?.message || 'Registration failed. Email may already be in use.';
      const errorFields = err.response?.data?.errors;
      if (errorFields && Array.isArray(errorFields)) {
        setError(`${errorMessage}: ${errorFields.map((e: any) => `${e.field} - ${e.message}`).join(', ')}`);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    window.location.href = `${BASE_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-slate-900">EstatePlus</span>
            </div>
            <h1 className="text-3xl font-semibold text-slate-900 mb-2">Create your account</h1>
            <p className="text-slate-600">Welcome! Please enter your details.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Google Button */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-white/20 rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all font-medium text-slate-700 mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">First name</label>
                <input
                  type="text"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Last name</label>
                <input
                  type="text"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-900"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-900"
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                placeholder="Create a password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                onFocus={() => setShowPasswordRequirements(true)}
                className="w-full px-3.5 py-2.5 bg-white border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-900"
                required
                minLength={8}
                autoComplete="new-password"
              />
              
              {/* Password Strength */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-slate-600">Strength:</span>
                    <span className={`text-xs font-semibold ${
                      passwordStrength <= 2 ? 'text-red-600' : 
                      passwordStrength === 3 ? 'text-amber-600' : 
                      'text-emerald-600'
                    }`}>
                      {getPasswordStrengthText()}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          level <= passwordStrength ? getPasswordStrengthColor() : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Password Requirements */}
              {showPasswordRequirements && formData.password && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg space-y-1.5">
                  <p className="text-xs font-medium text-slate-700 mb-2">Password must have:</p>
                  {[
                    { key: 'minLength', text: 'At least 8 characters' },
                    { key: 'hasUpperCase', text: 'One uppercase letter' },
                    { key: 'hasLowerCase', text: 'One lowercase letter' },
                    { key: 'hasNumber', text: 'One number' },
                    { key: 'hasSpecialChar', text: 'One special character (!@#$...)' },
                  ].map(({ key, text }) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      {passwordRequirements[key as keyof typeof passwordRequirements] ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span className={passwordRequirements[key as keyof typeof passwordRequirements] ? 'text-emerald-700' : 'text-slate-600'}>
                        {text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
              <input
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-900"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {/* Account Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">I'm a</label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all ${
                  formData.accountType === 'user'
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-white/20'
                }`}>
                  <input
                    type="radio"
                    name="accountType"
                    value="user"
                    checked={formData.accountType === 'user'}
                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value as 'user' })}
                    className="sr-only"
                  />
                  <span className={`text-sm font-medium ${
                    formData.accountType === 'user' ? 'text-slate-900' : 'text-slate-600'
                  }`}>
                    Market User
                  </span>
                </label>
                <label className={`flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all ${
                  formData.accountType === 'property_owner'
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-white/20'
                }`}>
                  <input
                    type="radio"
                    name="accountType"
                    value="property_owner"
                    checked={formData.accountType === 'property_owner'}
                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value as 'property_owner' })}
                    className="sr-only"
                  />
                  <span className={`text-sm font-medium ${
                    formData.accountType === 'property_owner' ? 'text-slate-900' : 'text-slate-600'
                  }`}>
                    Property Owner
                  </span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="text-slate-900 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Hero Image/Gradient */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 items-center justify-center p-12">
        <div className="max-w-md text-white">
          <h2 className="text-4xl font-bold mb-4">Welcome to EstatePlus</h2>
          <p className="text-slate-300 text-lg leading-relaxed">
            Your intelligent platform for real estate market analysis. Make data-driven decisions with powerful analytics and insights.
          </p>
          <div className="mt-8 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <p className="font-medium">Market Intelligence</p>
                <p className="text-sm text-slate-400">Real-time market trends and forecasting</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <p className="font-medium">Property Analytics</p>
                <p className="text-sm text-slate-400">Comprehensive property valuations</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <p className="font-medium">AI-Powered Insights</p>
                <p className="text-sm text-slate-400">Smart recommendations for your portfolio</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
