import { Link } from 'react-router-dom';
import { 
  Building2, 
  TrendingUp, 
  MapPin, 
  Bot, 
  ArrowRight,
  Sparkles,
  Home,
  LineChart,
  Globe,
  Target,
  Rocket,
  CheckCircle,
  Users,
  Shield,
  Zap,
  Clock
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';

export default function LandingPage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const features = [
    {
      icon: TrendingUp,
      title: 'Market Trends',
      description: 'Real-time analytics with price trends, rental yields, and growth predictions across all neighborhoods.',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Building2,
      title: 'Property Analysis',
      description: 'Comprehensive valuations and comparable analysis for smart investment decisions.',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: MapPin,
      title: 'Neighborhood Insights',
      description: 'Deep dive into demographics, amenities, and development potential of every area.',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      icon: Bot,
      title: 'AI Assistant',
      description: 'Ask questions and get instant AI-powered market intelligence and recommendations.',
      gradient: 'from-orange-500 to-red-500',
    },
  ];

  const stats = [
    { number: '10K+', label: 'Properties Analyzed', icon: Home },
    { number: '50+', label: 'Neighborhoods', icon: MapPin },
    { number: '98%', label: 'Accuracy Rate', icon: Target },
    { number: '24/7', label: 'Market Monitoring', icon: Globe },
  ];

  const benefits = [
    { icon: Shield, title: 'Data Security', description: 'Bank-level encryption for all your data' },
    { icon: Zap, title: 'Real-Time Updates', description: 'Get instant market insights as they happen' },
    { icon: Users, title: 'Expert Support', description: '24/7 support from real estate professionals' },
    { icon: Clock, title: 'Save Time', description: 'Automated analysis saves hours of research' },
  ];

  const useCases = [
    {
      title: 'For Investors',
      description: 'Identify high-potential properties and neighborhoods before the market catches on.',
      features: ['ROI Predictions', 'Market Trends', 'Investment Scoring'],
    },
    {
      title: 'For Property Owners',
      description: 'Maximize your property value with data-driven pricing and marketing strategies.',
      features: ['Property Valuation', 'Performance Tracking', 'Market Positioning'],
    },
    {
      title: 'For Analysts',
      description: 'Access comprehensive market data and powerful analytics tools in one platform.',
      features: ['Data Imports', 'Custom Reports', 'Economic Indicators'],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,1),rgba(0,0,0,1))]" />
      <div className="fixed inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
      </div>
      
      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center px-4 pt-32 pb-20">
        {/* Animated orbs */}
        <div
          className="absolute w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-float-slow pointer-events-none"
          style={{
            top: '10%',
            left: '10%',
            transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)`,
          }}
        />
        <div
          className="absolute w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-float pointer-events-none"
          style={{
            top: '20%',
            right: '10%',
            transform: `translate(${mousePosition.x * -0.02}px, ${mousePosition.y * -0.02}px)`,
          }}
        />
        <div
          className="absolute w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-float-slow pointer-events-none"
          style={{
            bottom: '10%',
            left: '50%',
            transform: `translate(${mousePosition.x * 0.015}px, ${mousePosition.y * 0.015}px)`,
            animationDelay: '1s',
          }}
        />

        {/* Floating decorative elements */}
        <div className="absolute top-1/4 left-[15%] animate-float-slow opacity-10 pointer-events-none">
          <Building2 className="w-24 h-24 text-blue-400" strokeWidth={0.5} />
        </div>
        <div className="absolute top-1/3 right-[12%] animate-float opacity-10 pointer-events-none" style={{ animationDelay: '1.5s' }}>
          <Home className="w-32 h-32 text-purple-400" strokeWidth={0.5} />
        </div>
        <div className="absolute bottom-1/4 right-[25%] animate-float-slow opacity-10 pointer-events-none" style={{ animationDelay: '0.5s' }}>
          <LineChart className="w-20 h-20 text-cyan-400" strokeWidth={0.5} />
        </div>

        {/* Hero Content */}
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="animate-fade-in-up opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-xl border border-blue-500/30 text-blue-300 px-6 py-2 rounded-full text-sm font-semibold mb-8 hover:scale-105 transition-transform duration-300">
              <Sparkles className="w-4 h-4 animate-pulse" />
              Next-Generation Market Intelligence Platform
            </div>
          </div>

          <h1 className="text-6xl md:text-8xl font-black mb-8 leading-tight animate-fade-in-up opacity-0" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent animate-gradient-text">
              Transform
            </span>
            <br />
            <span className="text-white">Real Estate Data</span>
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent animate-gradient-text-reverse">
              Into Intelligence
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in-up opacity-0" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>
            Analyze properties, predict market trends, and make data-driven decisions with{' '}
            <span className="text-blue-400 font-semibold">AI-powered insights</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center animate-fade-in-up opacity-0" style={{ animationDelay: '0.8s', animationFillMode: 'forwards' }}>
            {isAuthenticated ? (
              <Link
                to="/app"
                className="group relative px-10 py-5 overflow-hidden rounded-2xl font-bold text-lg"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600" />
                <span className="relative z-10 flex items-center justify-center gap-3 text-white">
                  Go to Dashboard
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
                </span>
              </Link>
            ) : (
              <Link 
                to="/register"
                className="group relative px-10 py-5 overflow-hidden rounded-2xl font-bold text-lg"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 animate-gradient-xy" />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute inset-0 -z-10 blur-2xl bg-gradient-to-r from-blue-500 to-cyan-500 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                <span className="relative z-10 flex items-center justify-center gap-3">
                  Get Started Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
                </span>
              </Link>
            )}
            <Link 
              to="/explore"
              className="group relative px-10 py-5 overflow-hidden rounded-2xl font-bold text-lg"
            >
              <div className="absolute inset-0 bg-white/10 backdrop-blur-xl border-2 border-white/20 group-hover:border-blue-400/50 transition-colors duration-300 rounded-2xl" />
              <span className="relative z-10 flex items-center justify-center gap-3 text-white group-hover:text-blue-300 transition-colors duration-300">
                <Rocket className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
                Explore Market
              </span>
            </Link>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 border-2 border-blue-400/50 rounded-full flex items-start justify-center p-2">
              <div className="w-1 h-3 bg-blue-400 rounded-full animate-scroll" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-20 px-4 border-y border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="text-center group animate-fade-in-up opacity-0"
                style={{ animationDelay: `${1 + index * 0.1}s`, animationFillMode: 'forwards' }}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 border border-white/10">
                  <stat.icon className="w-8 h-8 text-blue-400" />
                </div>
                <div className="text-4xl md:text-5xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-400 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-black text-white mb-6">
              Powerful <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Features</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Everything you need to make intelligent real estate decisions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative p-8 rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 hover:border-blue-500/50 transition-all duration-500 hover:scale-105 animate-fade-in-up opacity-0"
                style={{ animationDelay: `${1.5 + index * 0.1}s`, animationFillMode: 'forwards' }}
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-10 rounded-3xl blur-xl transition-opacity duration-500`} />
                
                <div className="relative z-10">
                  <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl mb-6 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 shadow-lg`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-blue-300 transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed text-lg">
                    {feature.description}
                  </p>
                </div>

                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/20 to-transparent rounded-bl-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="relative py-32 px-4 bg-gradient-to-b from-transparent via-blue-500/5 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-black text-white mb-6">
              Built for <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Everyone</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Whether you're an investor, owner, or analyst, we've got you covered
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {useCases.map((useCase, index) => (
              <div
                key={index}
                className="relative p-8 rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 hover:border-purple-500/50 transition-all duration-500"
              >
                <h3 className="text-2xl font-bold text-white mb-4">{useCase.title}</h3>
                <p className="text-gray-400 mb-6 leading-relaxed">{useCase.description}</p>
                <ul className="space-y-3">
                  {useCase.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-gray-300">
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-black text-white mb-6">
              Why Choose <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">EstatePlus</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="text-center group"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 border border-white/10">
                  <benefit.icon className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{benefit.title}</h3>
                <p className="text-gray-400">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative p-12 md:p-20 rounded-3xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-cyan-500/20 backdrop-blur-xl border border-white/20 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 animate-gradient-xy" />
            
            <div className="relative z-10">
              <Sparkles className="w-16 h-16 text-yellow-400 mx-auto mb-6 animate-pulse" />
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
                Ready to Get Started?
              </h2>
              <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
                Join thousands of investors, analysts, and property owners making smarter decisions with EstatePlus
              </p>
              {isAuthenticated ? (
                <Link
                  to="/app"
                  className="group inline-flex items-center gap-3 px-12 py-6 bg-white text-slate-900 rounded-2xl font-bold text-lg hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-white/20"
                >
                  Go to Dashboard
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" />
                </Link>
              ) : (
                <Link 
                  to="/register"
                  className="group inline-flex items-center gap-3 px-12 py-6 bg-white text-slate-900 rounded-2xl font-bold text-lg hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-white/20"
                >
                  Start Free Today
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      <style>{`
        @keyframes gradient-text {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes gradient-text-reverse {
          0%, 100% { background-position: 100% 50%; }
          50% { background-position: 0% 50%; }
        }
        @keyframes gradient-xy {
          0%, 100% { background-position: 0% 0%; }
          25% { background-position: 100% 0%; }
          50% { background-position: 100% 100%; }
          75% { background-position: 0% 100%; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-30px); }
        }
        @keyframes scroll {
          0% { transform: translateY(0); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translateY(20px); opacity: 0; }
        }
        .animate-gradient-text {
          background-size: 200% 200%;
          animation: gradient-text 3s ease infinite;
        }
        .animate-gradient-text-reverse {
          background-size: 200% 200%;
          animation: gradient-text-reverse 3s ease infinite;
        }
        .animate-gradient-xy {
          background-size: 200% 200%;
          animation: gradient-xy 4s ease infinite;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out;
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }
        .animate-scroll {
          animation: scroll 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
