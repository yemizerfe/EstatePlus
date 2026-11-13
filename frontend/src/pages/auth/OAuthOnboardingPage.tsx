import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, TrendingUp, Home } from 'lucide-react';
import { apiClient } from '../../api/client';

export default function OAuthOnboardingPage() {
  const [selectedRole, setSelectedRole] = useState<'user' | 'property_owner'>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      await apiClient.post('/auth/onboarding', { accountType: selectedRole });
      navigate('/app');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-slate-900">EstatePlus</span>
            </div>
            <h1 className="text-3xl font-semibold text-slate-900 mb-2">Welcome to EstatePlus!</h1>
            <p className="text-slate-600">How will you use our platform?</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Role Selection */}
          <div className="space-y-4 mb-8">
            <label
              className={`flex items-start gap-4 p-6 border-2 rounded-2xl cursor-pointer transition-all ${
                selectedRole === 'user'
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 hover:border-white/20 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="role"
                value="user"
                checked={selectedRole === 'user'}
                onChange={(e) => setSelectedRole(e.target.value as 'user')}
                className="sr-only"
              />
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                selectedRole === 'user' ? 'bg-slate-900' : 'bg-slate-100'
              }`}>
                <TrendingUp className={`w-6 h-6 ${selectedRole === 'user' ? 'text-white' : 'text-slate-600'}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">📊 Explore Market</h3>
                <p className="text-sm text-slate-600 mb-2">USER</p>
                <p className="text-slate-600">
                  Analyze market trends, explore properties, and get AI-powered insights for investment decisions.
                </p>
                <div className="mt-3 text-sm text-slate-500">
                  • View market analytics and trends
                  • Access neighborhood intelligence
                  • Use AI assistant for market insights
                  • Run scenario analysis
                </div>
              </div>
            </label>

            <label
              className={`flex items-start gap-4 p-6 border-2 rounded-2xl cursor-pointer transition-all ${
                selectedRole === 'property_owner'
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 hover:border-white/20 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="role"
                value="property_owner"
                checked={selectedRole === 'property_owner'}
                onChange={(e) => setSelectedRole(e.target.value as 'property_owner')}
                className="sr-only"
              />
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                selectedRole === 'property_owner' ? 'bg-slate-900' : 'bg-slate-100'
              }`}>
                <Home className={`w-6 h-6 ${selectedRole === 'property_owner' ? 'text-white' : 'text-slate-600'}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">🏠 Manage Properties</h3>
                <p className="text-sm text-slate-600 mb-2">PROPERTY OWNER</p>
                <p className="text-slate-600">
                  List and manage your properties, get valuations, and access owner-specific analytics.
                </p>
                <div className="mt-3 text-sm text-slate-500">
                  • Add and manage your properties
                  • Get automated property valuations
                  • Track property performance
                  • Access all market analysis features
                </div>
              </div>
            </label>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Setting up your account...
              </span>
            ) : (
              'Continue'
            )}
          </button>

          <p className="mt-6 text-center text-sm text-slate-500">
            You can always change your role later in your profile settings.
          </p>
        </div>
      </div>

      {/* Right Side - Hero Image/Gradient */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 items-center justify-center p-12">
        <div className="max-w-md text-white">
          <h2 className="text-4xl font-bold mb-4">Choose Your Path</h2>
          <p className="text-slate-300 text-lg leading-relaxed mb-8">
            Whether you're exploring investment opportunities or managing your property portfolio, 
            EstatePlus adapts to your needs.
          </p>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-lg mb-1">Market Explorers</h4>
                <p className="text-slate-400 text-sm">Perfect for investors, researchers, and anyone interested in market analysis</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Home className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-lg mb-1">Property Owners</h4>
                <p className="text-slate-400 text-sm">Ideal for landlords, developers, and property managers</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
