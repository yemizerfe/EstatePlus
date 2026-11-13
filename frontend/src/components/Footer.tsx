import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Instagram } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/10 bg-slate-900/50 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-12">
          {/* Brand Section */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/30 rounded-2xl blur-lg animate-pulse-glow" />
                <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  <Building2 className="w-7 h-7 text-white" />
                </div>
              </div>
              <span className="text-2xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                EstatePlus
              </span>
            </Link>
            <p className="text-gray-400 leading-relaxed">
              Next-Generation Real Estate Market Intelligence. Transforming data into actionable insights for smarter property decisions.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/50 flex items-center justify-center text-gray-400 hover:text-blue-400 transition-all duration-300"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/50 flex items-center justify-center text-gray-400 hover:text-blue-400 transition-all duration-300"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/50 flex items-center justify-center text-gray-400 hover:text-blue-400 transition-all duration-300"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/50 flex items-center justify-center text-gray-400 hover:text-blue-400 transition-all duration-300"
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-bold text-lg mb-6">Quick Links</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/explore"
                  className="text-gray-400 hover:text-blue-400 transition-colors duration-300 flex items-center gap-2 group"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-600 group-hover:bg-blue-400 transition-colors duration-300" />
                  Explore Market
                </Link>
              </li>
              <li>
                <Link
                  to="/properties"
                  className="text-gray-400 hover:text-blue-400 transition-colors duration-300 flex items-center gap-2 group"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-600 group-hover:bg-blue-400 transition-colors duration-300" />
                  Properties
                </Link>
              </li>
              <li>
                <Link
                  to="/neighborhoods"
                  className="text-gray-400 hover:text-blue-400 transition-colors duration-300 flex items-center gap-2 group"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-600 group-hover:bg-blue-400 transition-colors duration-300" />
                  Neighborhoods
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-white font-bold text-lg mb-6">Contact Us</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-gray-400">
                <MapPin className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <span>Addis Ababa, Ethiopia</span>
              </li>
              <li className="flex items-start gap-3 text-gray-400">
                <Mail className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <a href="mailto:info@estateplus.com" className="hover:text-blue-400 transition-colors duration-300">
                  info@estateplus.com
                </a>
              </li>
              <li className="flex items-start gap-3 text-gray-400">
                <Phone className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <a href="tel:+251911234567" className="hover:text-blue-400 transition-colors duration-300">
                  +251 911 234 567
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm text-center md:text-left">
              © {currentYear} EstatePlus. All rights reserved.
            </p>
            <p className="text-gray-500 text-sm text-center md:text-right">
              Built with ❤️ in Ethiopia
            </p>
          </div>
        </div>
      </div>

      {/* Animated gradient line at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse" />
    </footer>
  );
};

export default Footer;
