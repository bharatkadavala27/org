import { Outlet, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getBranding } from '../api/resources';
import { t } from '../lib/i18n';

export default function PublicLayout() {
  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: getBranding,
  });

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 font-sans">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
            ) : (
              <div className="h-10 w-10 bg-brand rounded-full flex items-center justify-center text-white font-bold text-xl">
                S
              </div>
            )}
            <span className="font-bold text-lg hidden sm:block tracking-tight">
              {branding?.trustName || 'Samuh Lagna Trust'}
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/donate" className="text-sm font-semibold text-gray-600 hover:text-brand transition-colors">
              Donate
            </Link>
            <Link to="/login" className="btn-primary text-sm px-4 py-2 shadow-sm">
              {t.login}
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow flex flex-col">
        <Outlet />
      </main>

      {/* Trust Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 mt-auto border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
          <div>
            <h3 className="text-white font-bold mb-3">{branding?.trustName || 'Samuh Lagna Trust'}</h3>
            <p className="leading-relaxed">
              Empowering communities and uniting families through mass marriage events. Your support makes dreams come true.
            </p>
          </div>
          <div>
            <h3 className="text-white font-bold mb-3">Links</h3>
            <ul className="space-y-2">
              <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/donate" className="hover:text-white transition-colors">Donate Online</Link></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Sub-Admin Login</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-bold mb-3">Contact</h3>
            <ul className="space-y-2">
              <li>Email: contact@trust.org</li>
              <li>Phone: +91 98765 43210</li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pt-8 border-t border-gray-800 text-xs text-center flex flex-col md:flex-row justify-between items-center">
          <p>&copy; {new Date().getFullYear()} {branding?.trustName || 'Samuh Lagna Trust'}. All rights reserved.</p>
          <p className="mt-2 md:mt-0 opacity-50">Powered by Samuh Lagna Platform</p>
        </div>
      </footer>
    </div>
  );
}
