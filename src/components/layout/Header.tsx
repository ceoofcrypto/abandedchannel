import React, { useState } from 'react';
import { Search, Star, Moon, Sun, Menu, X, Shield, Tv, Globe } from 'lucide-react';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string, param?: string) => void;
  favoritesCount: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isAdminAuthenticated: boolean;
  selectedCountry?: string;
  onOpenCountrySidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  favoritesCount,
  theme,
  onToggleTheme,
  isAdminAuthenticated,
  selectedCountry = 'all',
  onOpenCountrySidebar,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (view: string, param?: string) => {
    onNavigate(view, param);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0B0D11]/95 backdrop-blur-md border-b border-neutral-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          onClick={() => handleNav('home')}
          className="flex items-center gap-2.5 text-left group shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-sm shadow-red-950/60">
            <Tv className="w-4 h-4" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white group-hover:text-red-400 transition-colors whitespace-nowrap">
            तपाईंको TV
          </span>
        </button>

        {/* Zone 2: 5 Single-line Navigation Links (Home, Live TV, Countries, Sports, Favorites) */}
        <nav
          aria-label="Main Navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-neutral-300"
        >
          <button
            onClick={() => handleNav('home')}
            className={`whitespace-nowrap transition-colors py-1 cursor-pointer ${
              currentView === 'home'
                ? 'text-white border-b-2 border-red-500 font-semibold'
                : 'hover:text-white'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => handleNav('channels')}
            className={`whitespace-nowrap transition-colors py-1 cursor-pointer ${
              currentView === 'channels'
                ? 'text-white border-b-2 border-red-500 font-semibold'
                : 'hover:text-white'
            }`}
          >
            Live TV
          </button>
          <button
            onClick={() => {
              if (onOpenCountrySidebar) {
                onOpenCountrySidebar();
              } else {
                handleNav('channels');
              }
            }}
            className={`whitespace-nowrap flex items-center gap-1.5 transition-colors py-1 cursor-pointer ${
              selectedCountry && selectedCountry !== 'all'
                ? 'text-red-400 font-semibold'
                : 'hover:text-white text-neutral-300'
            }`}
            title="Browse Channels by Country (250 Countries A to Z)"
          >
            <Globe className="w-3.5 h-3.5 text-red-500" />
            <span>
              {selectedCountry && selectedCountry !== 'all'
                ? `Countries · ${selectedCountry.toUpperCase()}`
                : 'Countries'}
            </span>
          </button>
          <button
            onClick={() => handleNav('category', 'sports')}
            className={`whitespace-nowrap transition-colors py-1 cursor-pointer ${
              currentView === 'category'
                ? 'text-white border-b-2 border-red-500 font-semibold'
                : 'hover:text-white'
            }`}
          >
            Sports
          </button>
          <button
            onClick={() => handleNav('favorites')}
            className={`whitespace-nowrap flex items-center gap-1.5 transition-colors py-1 cursor-pointer ${
              currentView === 'favorites'
                ? 'text-white border-b-2 border-red-500 font-semibold'
                : 'hover:text-white text-neutral-300'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-400" />
            <span>{favoritesCount > 0 ? `Favorites (${favoritesCount})` : 'Favorites'}</span>
          </button>
        </nav>

        {/* Zone 3: Search, Theme Toggle, Admin Portal */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => handleNav('search')}
            aria-label="Search channels and events"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs border border-neutral-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-neutral-400" />
            <span className="hidden sm:inline">Search channels...</span>
          </button>

          <button
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => handleNav('admin')}
            aria-label="Admin Portal"
            title="Administrator Portal (Google Sign-In)"
            className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              isAdminAuthenticated
                ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/60'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden lg:inline text-[11px] font-medium whitespace-nowrap">
              {isAdminAuthenticated ? 'Admin Active' : 'Admin'}
            </span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            className="md:hidden p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#12141a] border-b border-neutral-800 px-4 py-4 space-y-1.5">
          <button
            onClick={() => handleNav('home')}
            className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:text-white hover:bg-neutral-800 rounded-lg font-medium"
          >
            Home
          </button>
          <button
            onClick={() => handleNav('channels')}
            className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:text-white hover:bg-neutral-800 rounded-lg font-medium"
          >
            Live TV Channels
          </button>
          <button
            onClick={() => {
              if (onOpenCountrySidebar) {
                onOpenCountrySidebar();
              }
              setMobileMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:text-white hover:bg-neutral-800 rounded-lg font-medium flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-red-500" />
              <span>Countries (A–Z)</span>
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              {selectedCountry && selectedCountry !== 'all' ? selectedCountry.toUpperCase() : '250 Countries'}
            </span>
          </button>
          <button
            onClick={() => handleNav('category', 'sports')}
            className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:text-white hover:bg-neutral-800 rounded-lg font-medium"
          >
            Sports Broadcasts
          </button>
          <button
            onClick={() => handleNav('favorites')}
            className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:text-white hover:bg-neutral-800 rounded-lg font-medium flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" />
              <span>Favorites</span>
            </span>
            <span className="text-xs font-mono text-neutral-400">({favoritesCount})</span>
          </button>
          <button
            onClick={() => handleNav('admin')}
            className="w-full text-left px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg font-medium flex items-center gap-2 border-t border-neutral-800 pt-3 mt-2"
          >
            <Shield className="w-4 h-4" />
            <span>Administrator Google Sign-In</span>
          </button>
        </div>
      )}
    </header>
  );
};
