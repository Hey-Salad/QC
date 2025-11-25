/**
 * HeySalad QC - Layout Component
 * 
 * Main layout with header, navigation, and footer.
 * Modern white design with HeySalad branding.
 * Requirements: 6.1, 6.2
 */

import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const navLinkClass = (path: string) => {
    const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200';
    return isActive(path)
      ? `${base} bg-gray-900 text-white`
      : `${base} text-gray-600 hover:bg-gray-100 hover:text-gray-900`;
  };

  const mobileNavLinkClass = (path: string) => {
    const base = 'block px-4 py-3 rounded-lg text-base font-medium transition-all duration-200';
    return isActive(path)
      ? `${base} bg-gray-900 text-white`
      : `${base} text-gray-600 hover:bg-gray-100`;
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] flex flex-col">
      {/* Modern White Header with HeySalad branding */}
      <header className="bg-white border-b border-gray-200/80 sticky top-0 z-50 backdrop-blur-sm bg-white/95">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link 
              to="/admin" 
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              onClick={closeMobileMenu}
            >
              {/* HeySalad Logo - Using the black logo */}
              <img 
                src="/HeySalad Logo Black.png" 
                alt="HeySalad" 
                className="h-8 sm:h-10 w-auto"
              />
              <div className="hidden sm:block">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quality Control
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden sm:flex items-center gap-2">
              <Link to="/admin" className={navLinkClass('/admin')}>
                Stations
              </Link>
              <Link to="/generate" className={navLinkClass('/generate')}>
                Generate Mat
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="sm:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
              onClick={toggleMobileMenu}
              aria-expanded={isMobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <nav className="sm:hidden mt-4 pt-4 border-t border-gray-100 space-y-2">
              <Link 
                to="/admin" 
                className={mobileNavLinkClass('/admin')}
                onClick={closeMobileMenu}
              >
                Stations
              </Link>
              <Link 
                to="/generate" 
                className={mobileNavLinkClass('/generate')}
                onClick={closeMobileMenu}
              >
                Generate Mat
              </Link>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content - Soft white background */}
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1">
        {children}
      </main>

      {/* Modern Footer */}
      <footer className="bg-white border-t border-gray-200/80 py-4 sm:py-6">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img 
              src="/HeySalad_Launchericon.jpg" 
              alt="HeySalad" 
              className="h-6 w-6 rounded-md"
            />
            <span className="text-sm text-gray-500">
              © 2024 HeySalad QC
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Quality Control Station Management
          </p>
        </div>
      </footer>
    </div>
  );
}
