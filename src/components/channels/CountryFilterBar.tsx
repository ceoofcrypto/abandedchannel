import React, { useState, useMemo } from 'react';
import { Country } from '../../types/index.ts';
import { POPULAR_COUNTRIES } from '../../data/countries.ts';
import { Globe, Search, X, Check, ChevronDown, Sparkles } from 'lucide-react';

interface CountryFilterBarProps {
  countries: Country[];
  selectedCountry: string; // 'all' or 2-letter code or country name
  onSelectCountry: (countryCode: string) => void;
  channelCountsByCountry?: Record<string, number>;
  isLoading?: boolean;
  onOpenDirectory?: () => void;
}

export const CountryFilterBar: React.FC<CountryFilterBarProps> = ({
  countries,
  selectedCountry,
  onSelectCountry,
  channelCountsByCountry = {},
  isLoading = false,
  onOpenDirectory,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected country object
  const currentCountryObj = useMemo(() => {
    if (!selectedCountry || selectedCountry === 'all') return null;
    const q = selectedCountry.toUpperCase();
    return (
      countries.find((c) => c.code.toUpperCase() === q || c.name.toUpperCase() === q) || {
        name: selectedCountry,
        code: selectedCountry,
        flag: '🌐',
      }
    );
  }, [selectedCountry, countries]);

  // Filtered countries inside modal
  const filteredModalCountries = useMemo(() => {
    if (!searchQuery.trim()) {
      // Sort countries with channels first, then alphabetically
      return [...countries].sort((a, b) => {
        const countA = channelCountsByCountry[a.code.toUpperCase()] || channelCountsByCountry[a.name.toLowerCase()] || 0;
        const countB = channelCountsByCountry[b.code.toUpperCase()] || channelCountsByCountry[b.name.toLowerCase()] || 0;
        if (countA !== countB) return countB - countA;
        return a.name.localeCompare(b.name);
      });
    }

    const q = searchQuery.toLowerCase().trim();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.languages?.some((l) => l.toLowerCase().includes(q))
    );
  }, [countries, searchQuery, channelCountsByCountry]);

  return (
    <div className="space-y-3">
      {/* Country Filter Top Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-red-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
            Browse by Country
          </h3>
          <span className="text-[10px] text-neutral-500 hidden sm:inline">
            (देश अनुसार च्यानलहरू · 250 Countries Available)
          </span>

          {currentCountryObj && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-red-950/70 border border-red-800 text-red-300 text-xs font-medium">
              <span className="text-sm">{currentCountryObj.flag}</span>
              <span>{currentCountryObj.name}</span>
              <button
                onClick={() => onSelectCountry('all')}
                className="hover:text-white p-0.5 rounded transition-colors ml-0.5"
                title="Clear country filter"
                aria-label="Clear country filter"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Button to open all 250 countries directory */}
        <button
          onClick={() => {
            if (onOpenDirectory) {
              onOpenDirectory();
            } else {
              setSearchQuery('');
              setModalOpen(true);
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800/90 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition-colors shadow-sm"
          title="Open country directory with all 250 countries from iptv-org"
        >
          <Globe className="w-3.5 h-3.5 text-neutral-400" />
          <span>All 250 Countries (A–Z)</span>
          <ChevronDown className="w-3 h-3 text-neutral-400" />
        </button>
      </div>

      {/* Horizontal Scrollable Quick Country Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none">
        {/* All Countries Chip */}
        <button
          onClick={() => onSelectCountry('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border shrink-0 ${
            selectedCountry === 'all' || !selectedCountry
              ? 'bg-neutral-200 text-neutral-900 border-neutral-200 font-bold shadow-sm'
              : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white border-neutral-800'
          }`}
        >
          <span>🌐</span>
          <span>All Countries</span>
        </button>

        {/* Popular Countries Chips */}
        {POPULAR_COUNTRIES.map((country) => {
          const isSelected =
            selectedCountry?.toUpperCase() === country.code.toUpperCase() ||
            selectedCountry?.toLowerCase() === country.name.toLowerCase();

          const count =
            channelCountsByCountry[country.code.toUpperCase()] ||
            channelCountsByCountry[country.name.toLowerCase()] ||
            0;

          return (
            <button
              key={country.code}
              onClick={() => onSelectCountry(country.code)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border shrink-0 ${
                isSelected
                  ? 'bg-red-600 text-white border-red-500 font-bold shadow-sm'
                  : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border-neutral-800'
              }`}
            >
              <span className="text-sm">{country.flag}</span>
              <span>{country.name}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                    isSelected ? 'bg-black/30 text-white' : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {/* More Countries quick link */}
        <button
          onClick={() => {
            if (onOpenDirectory) {
              onOpenDirectory();
            } else {
              setSearchQuery('');
              setModalOpen(true);
            }
          }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap bg-neutral-900/60 hover:bg-neutral-800 text-red-400 hover:text-red-300 border border-neutral-800 shrink-0 transition-colors"
        >
          <Sparkles className="w-3 h-3 text-red-400" />
          <span>More Countries (A–Z)...</span>
        </button>
      </div>

      {/* Loading Indicator when on-demand fetching country */}
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-neutral-400 py-1">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <span>Verifying and loading live working streams for selected country...</span>
        </div>
      )}

      {/* MODAL: ALL 250 COUNTRIES DIRECTORY */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181a20] border border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-red-500" />
                  <h3 className="text-base font-bold text-white tracking-tight">
                    World Countries IPTV Directory
                  </h3>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Filter broadcast channels from 250 countries around the world (iptv-org/iptv)
                </p>
              </div>

              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
                aria-label="Close country directory"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 border-b border-neutral-800/80 bg-neutral-900/40">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search countries by name or ISO code (e.g. Nepal, US, Japan, Germany)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full bg-[#101114] border border-neutral-700/80 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-neutral-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Country Grid */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {/* Option to clear and view All Countries */}
              <button
                onClick={() => {
                  onSelectCountry('all');
                  setModalOpen(false);
                }}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-colors ${
                  selectedCountry === 'all' || !selectedCountry
                    ? 'bg-red-950/50 border-red-800 text-white font-semibold'
                    : 'bg-neutral-900/60 hover:bg-neutral-800/80 border-neutral-800/80 text-neutral-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🌐</span>
                  <div>
                    <p className="text-xs font-medium">All Countries</p>
                    <p className="text-[10px] text-neutral-500">View entire world feed</p>
                  </div>
                </div>
                {(selectedCountry === 'all' || !selectedCountry) && (
                  <Check className="w-3.5 h-3.5 text-red-400 shrink-0" />
                )}
              </button>

              {filteredModalCountries.map((c) => {
                const isSelected =
                  selectedCountry?.toUpperCase() === c.code.toUpperCase() ||
                  selectedCountry?.toLowerCase() === c.name.toLowerCase();

                const count =
                  channelCountsByCountry[c.code.toUpperCase()] ||
                  channelCountsByCountry[c.name.toLowerCase()] ||
                  0;

                return (
                  <button
                    key={c.code}
                    onClick={() => {
                      onSelectCountry(c.code);
                      setModalOpen(false);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-colors ${
                      isSelected
                        ? 'bg-red-950/60 border-red-800 text-white font-semibold'
                        : 'bg-neutral-900/60 hover:bg-neutral-800/80 border-neutral-800/80 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className="text-xl shrink-0">{c.flag}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{c.name}</p>
                        <p className="text-[10px] font-mono text-neutral-500 uppercase">
                          {c.code}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {count > 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
                          {count}
                        </span>
                      ) : (
                        <span className="text-[9px] text-neutral-500">Live</span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-red-400" />}
                    </div>
                  </button>
                );
              })}

              {filteredModalCountries.length === 0 && (
                <div className="col-span-full py-12 text-center text-xs text-neutral-500">
                  No countries matching &ldquo;{searchQuery}&rdquo;. Try another name or country code.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-neutral-900/80 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400 px-4">
              <span>Showing {filteredModalCountries.length} of {countries.length} countries</span>
              <button
                onClick={() => setModalOpen(false)}
                className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
