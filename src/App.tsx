/**
 * @license
 * @spdx-license-identifier Apache-2.0
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Channel,
  FeaturedEvent,
  Category,
  Announcement,
  AppSettings,
  AdminUser,
  Country,
} from './types/index.ts';
import {
  fetchChannels,
  fetchEvents,
  fetchCategories,
  fetchAnnouncements,
  fetchSettings,
  fetchCountries,
  fetchCountryChannels,
  fetchAutoUpdateStatus,
  AutoUpdateStatus,
  getStoredAdminUser,
  clearAdminSession,
  restoreAdminSessionFromFirebaseUser,
} from './services/api.ts';
import { auth, onAuthStateChanged, signOutFirebaseAdmin } from './services/firebase.ts';
import {
  getLocalFavorites,
  toggleLocalFavorite,
  getLocalRecentChannelIds,
  addLocalRecentChannel,
  clearLocalRecentChannels,
  getSavedTheme,
  saveTheme,
} from './utils/storage.ts';
import { filterChannels, isAdminEmailAuthorized } from './utils/channels.ts';

import { Header } from './components/layout/Header.tsx';
import { Footer } from './components/layout/Footer.tsx';
import { AnnouncementBanner } from './components/layout/AnnouncementBanner.tsx';
import { FeaturedEventHero } from './components/home/FeaturedEventHero.tsx';
import { CategoryBar } from './components/channels/CategoryBar.tsx';
import { CountryFilterBar } from './components/channels/CountryFilterBar.tsx';
import { ChannelCard } from './components/channels/ChannelCard.tsx';
import { VideoPlayer } from './components/player/VideoPlayer.tsx';
import { AdminLogin } from './components/admin/AdminLogin.tsx';
import { AdminDashboard } from './components/admin/AdminDashboard.tsx';
import { CountrySidebarDrawer } from './components/layout/CountrySidebarDrawer.tsx';

import {
  Tv,
  Star,
  Clock,
  Search,
  Trash2,
  AlertCircle,
  Radio,
  ArrowRight,
  Shield,
  CheckCircle2,
} from 'lucide-react';

export default function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [countrySidebarOpen, setCountrySidebarOpen] = useState<boolean>(false);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeStreamOverride, setActiveStreamOverride] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data State
  const [channels, setChannels] = useState<Channel[]>([]);
  const [events, setEvents] = useState<FeaturedEvent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [autoUpdateStatus, setAutoUpdateStatus] = useState<AutoUpdateStatus | null>(null);
  const [isLoadingCountry, setIsLoadingCountry] = useState<boolean>(false);

  // Local Viewer Preferences
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Administrator Session (strictly verified against ceoofcrypto@gmail.com)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  const loadPlatformData = useCallback(async () => {
    try {
      const [chData, evData, catData, annData, settData, countriesData, statusData] = await Promise.all([
        fetchChannels(),
        fetchEvents(),
        fetchCategories(),
        fetchAnnouncements(),
        fetchSettings(),
        fetchCountries(),
        fetchAutoUpdateStatus().catch(() => null),
      ]);
      setChannels(chData);
      setEvents(evData);
      setCategories(catData);
      setAnnouncements(annData);
      setSettings(settData);
      setCountries(countriesData);
      if (statusData) {
        setAutoUpdateStatus(statusData);
      }
    } catch (err) {
      console.error('Failed to load platform data:', err);
    }
  }, []);

  useEffect(() => {
    // 1. Theme
    const saved = getSavedTheme();
    setTheme(saved);
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // 2. Local Viewer Data
    setFavorites(getLocalFavorites());
    setRecentIds(getLocalRecentChannelIds());

    // 3. Admin Session Check (only allow ceoofcrypto@gmail.com)
    const storedAdmin = getStoredAdminUser();
    if (storedAdmin && isAdminEmailAuthorized(storedAdmin.email)) {
      setAdminUser(storedAdmin);
    } else if (storedAdmin) {
      clearAdminSession();
    }

    // Subscribe to Firebase Google Auth state for ceoofcrypto@gmail.com
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && isAdminEmailAuthorized(fbUser.email)) {
        const restored = await restoreAdminSessionFromFirebaseUser(fbUser);
        if (restored) {
          setAdminUser(restored.user);
        }
      } else if (fbUser) {
        // Immediately sign out any non-admin Google user
        await signOutFirebaseAdmin();
        clearAdminSession();
        setAdminUser(null);
      }
    });

    // 4. Initial Route parsing from URL query / hash
    const params = new URLSearchParams(window.location.search);
    const channelParam = params.get('channel');
    if (channelParam) {
      fetchChannels().then((all) => {
        const match = all.find((c) => c.id === channelParam);
        if (match) {
          setActiveChannel(match);
          setCurrentView('player');
          addLocalRecentChannel(match.id);
          setRecentIds(getLocalRecentChannelIds());
        }
      });
    }

    if (window.location.pathname.startsWith('/admin') || window.location.hash === '#admin') {
      setCurrentView('admin');
    }

    // 5. Load Initial Data
    loadPlatformData();

    // 6. Background Auto-Update Polling (keeps working channels fresh and prunes dead channels automatically)
    const pollInterval = setInterval(async () => {
      try {
        const [freshChannels, freshCountries, freshStatus] = await Promise.all([
          fetchChannels(),
          fetchCountries(),
          fetchAutoUpdateStatus().catch(() => null),
        ]);
        setChannels(freshChannels);
        setCountries(freshCountries);
        if (freshStatus) {
          setAutoUpdateStatus(freshStatus);
        }
      } catch {
        // Ignore transient background poll errors
      }
    }, 30000);

    return () => {
      clearInterval(pollInterval);
      unsubscribeAuth();
    };
  }, [loadPlatformData]);

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    saveTheme(next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleNavigate = (view: string, param?: string) => {
    setCurrentView(view);
    if (view === 'category' && param) {
      setSelectedCategory(param);
    } else if (view === 'channels') {
      setSelectedCategory('all');
    } else if (view === 'favorites') {
      setSelectedCategory('all');
    }

    if (view !== 'player') {
      setActiveChannel(null);
      setActiveStreamOverride(null);
      window.history.pushState({}, '', window.location.pathname);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectChannel = (channel: Channel, streamOverride?: string | null) => {
    setActiveChannel(channel);
    setActiveStreamOverride(streamOverride || null);
    setCurrentView('player');

    const updatedRecents = addLocalRecentChannel(channel.id);
    setRecentIds(updatedRecents);

    window.history.pushState({}, '', `?channel=${channel.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Immediately remove broken channel from active UI state when VideoPlayer reports a dead stream
  const handleChannelBroken = useCallback((brokenChannelId: string) => {
    setChannels((prev) =>
      prev.map((c) =>
        c.id === brokenChannelId
          ? { ...c, isActive: false, verificationStatus: 'failing' }
          : c
      )
    );
  }, []);

  const handleWatchFeaturedEvent = (event: FeaturedEvent) => {
    const targetChannel = channels.find((c) => c.id === event.channelId && c.isActive);
    if (targetChannel) {
      handleSelectChannel(targetChannel, event.streamUrlOverride);
    } else if (channels.length > 0) {
      handleSelectChannel(channels[0], event.streamUrlOverride);
    }
  };

  const handleToggleFavorite = (channelId: string) => {
    const updated = toggleLocalFavorite(channelId);
    setFavorites(updated);
  };

  const handleClearHistory = () => {
    clearLocalRecentChannels();
    setRecentIds([]);
  };

  const handleSelectCountry = async (countryCode: string) => {
    setSelectedCountry(countryCode);
    if (currentView !== 'channels' && currentView !== 'player') {
      setCurrentView('channels');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (countryCode === 'all') return;

    const q = countryCode.toUpperCase();
    const existingForCountry = channels.filter(
      (c) =>
        c.isActive &&
        c.isPublished &&
        c.verificationStatus !== 'failing' &&
        ((c.countryCode && c.countryCode.toUpperCase() === q) ||
          (c.country && c.country.toUpperCase() === q) ||
          (c.country && c.country.toLowerCase() === countryCode.toLowerCase()))
    );

    if (existingForCountry.length < 4) {
      setIsLoadingCountry(true);
      try {
        const res = await fetchCountryChannels(countryCode);
        if (res.channels && res.channels.length > 0) {
          setChannels((prev) => {
            const existingUrls = new Set(prev.map((p) => p.streamUrl.trim()));
            const newlyAdded = res.channels.filter((c) => !existingUrls.has(c.streamUrl.trim()));
            return [...prev, ...newlyAdded];
          });
        }
      } catch (err) {
        console.warn('Failed to load country channels:', countryCode, err);
      } finally {
        setIsLoadingCountry(false);
      }
    }
  };

  const channelCountsByCountry = useMemo(() => {
    const counts: Record<string, number> = {};
    channels.forEach((c) => {
      if (c.isActive && c.isPublished && c.verificationStatus !== 'failing') {
        if (c.countryCode) {
          const code = c.countryCode.toUpperCase();
          counts[code] = (counts[code] || 0) + 1;
        }
        if (c.country) {
          const name = c.country.toLowerCase();
          counts[name] = (counts[name] || 0) + 1;
        }
      }
    });
    return counts;
  }, [channels]);

  const [displayLimit, setDisplayLimit] = useState<number>(48);

  useEffect(() => {
    setDisplayLimit(48);
  }, [selectedCategory, selectedCountry, searchQuery, currentView]);

  const enrichedCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ch of channels) {
      if (ch.isActive && ch.isPublished && ch.verificationStatus !== 'failing') {
        counts[ch.categoryId] = (counts[ch.categoryId] || 0) + 1;
        if (ch.categoryName) {
          counts[ch.categoryName.toLowerCase()] = (counts[ch.categoryName.toLowerCase()] || 0) + 1;
        }
      }
    }
    return categories.map((c) => ({
      ...c,
      channelCount: counts[c.id] || counts[c.slug] || counts[c.name.toLowerCase()] || 0,
    }));
  }, [categories, channels]);

  const publicChannels = filterChannels(channels, {
    categorySlug: selectedCategory,
    country: selectedCountry,
    searchQuery: currentView === 'search' ? searchQuery : undefined,
    onlyFavorites: currentView === 'favorites',
    favoriteIds: favorites,
    publicOnly: true,
  });

  const recentChannels = recentIds
    .map((id) => channels.find((c) => c.id === id))
    .filter((c): c is Channel => Boolean(c && c.isActive && c.isPublished && c.verificationStatus !== 'failing'));

  const popularChannels = channels
    .filter((c) => c.isActive && c.isPublished && c.verificationStatus !== 'failing' && (c.isFeatured || c.priority <= 5))
    .slice(0, 10);

  const sportsChannels = channels
    .filter((c) => c.isActive && c.isPublished && c.verificationStatus !== 'failing' && c.categoryId === 'sports')
    .slice(0, 8);

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0D11] text-neutral-100 antialiased selection:bg-red-600 selection:text-white">
      {currentView !== 'admin' && (
        <AnnouncementBanner announcements={announcements} />
      )}

      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        favoritesCount={favorites.length}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isAdminAuthenticated={Boolean(adminUser)}
        selectedCountry={selectedCountry}
        onOpenCountrySidebar={() => setCountrySidebarOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-10">
        {settings?.maintenanceMode && !adminUser && (
          <div className="p-8 rounded-2xl bg-amber-950/40 border border-amber-800 text-center space-y-4 max-w-xl mx-auto my-12">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">Temporary Maintenance in Progress</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              तपाईंको TV is currently undergoing scheduled platform upgrades. We will be back online shortly.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setCurrentView('admin')}
                className="text-xs text-amber-400 hover:underline flex items-center justify-center gap-1 mx-auto"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Authorized Administrator Access</span>
              </button>
            </div>
          </div>
        )}

        {/* 1. PLAYER VIEW */}
        {currentView === 'player' && activeChannel && (
          <VideoPlayer
            channel={activeChannel}
            streamUrlOverride={activeStreamOverride}
            onBack={() => handleNavigate('home')}
            isFavorite={favorites.includes(activeChannel.id)}
            onToggleFavorite={handleToggleFavorite}
            relatedChannels={channels.filter(
              (c) => c.categoryId === activeChannel.categoryId && c.isActive && c.verificationStatus !== 'failing'
            )}
            onSelectChannel={(ch) => handleSelectChannel(ch)}
            onChannelBroken={handleChannelBroken}
          />
        )}

        {/* 2. ADMIN VIEW */}
        {currentView === 'admin' && (
          adminUser ? (
            <AdminDashboard
              user={adminUser}
              channels={channels}
              events={events}
              categories={categories}
              announcements={announcements}
              settings={
                settings || {
                  appName: 'तपाईंको TV',
                  tagline: 'Your Television, Everywhere.',
                  nepaliTagline: 'तपाईंको टेलिभिजन, जताततै।',
                  logoUrl: '',
                  maintenanceMode: false,
                  showFeaturedEvent: true,
                  defaultTheme: 'dark',
                  updatedAt: new Date().toISOString(),
                }
              }
              onRefreshData={loadPlatformData}
              onLogout={() => {
                clearAdminSession();
                setAdminUser(null);
                setCurrentView('home');
              }}
              onViewSite={() => handleNavigate('home')}
            />
          ) : (
            <AdminLogin
              onLoginSuccess={(user) => setAdminUser(user)}
              onBackToSite={() => handleNavigate('home')}
            />
          )
        )}

        {/* 3. SEARCH VIEW */}
        {currentView === 'search' && (
          <div className="space-y-6">
            <div className="max-w-xl mx-auto space-y-3 text-center">
              <h2 className="text-2xl font-bold text-white tracking-tight">Search Channels & Broadcasts</h2>
              <p className="text-xs text-neutral-400">
                Type channel name, language, country, or genre to filter verified live feeds immediately.
              </p>
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-4 top-3.5" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Nepal TV, Kantipur, India, Sports, News..."
                  className="w-full bg-[#13151b] border border-neutral-800 focus:border-red-500 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Matching Working Channels ({publicChannels.length})</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-neutral-500 hover:text-white cursor-pointer"
                  >
                    Clear Search
                  </button>
                )}
              </div>

              {publicChannels.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {publicChannels.slice(0, displayLimit).map((channel) => (
                      <ChannelCard
                        key={channel.id}
                        channel={channel}
                        isFavorite={favorites.includes(channel.id)}
                        onToggleFavorite={handleToggleFavorite}
                        onSelectChannel={handleSelectChannel}
                      />
                    ))}
                  </div>

                  {publicChannels.length > displayLimit && (
                    <div className="pt-6 pb-2 text-center">
                      <button
                        onClick={() => setDisplayLimit((prev) => prev + 48)}
                        className="px-6 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold border border-neutral-800 transition-colors inline-flex items-center gap-2 cursor-pointer"
                      >
                        <span>Load More Search Results</span>
                        <span className="text-neutral-400 font-mono text-[11px]">
                          (Showing {Math.min(displayLimit, publicChannels.length)} of {publicChannels.length.toLocaleString()})
                        </span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-16 text-center text-neutral-500 space-y-2">
                  <Tv className="w-10 h-10 mx-auto text-neutral-700" />
                  <p className="text-sm font-medium text-neutral-400">No channels match "{searchQuery}"</p>
                  <p className="text-xs">Try searching by language, country, or category.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. FAVORITES VIEW */}
        {currentView === 'favorites' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  <span>Your Favorite Channels</span>
                </h2>
                <p className="text-xs text-neutral-400 mt-1">
                  Saved locally in your browser for instant access. No viewer login required.
                </p>
              </div>
            </div>

            {publicChannels.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {publicChannels.map((channel) => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    isFavorite={true}
                    onToggleFavorite={handleToggleFavorite}
                    onSelectChannel={handleSelectChannel}
                  />
                ))}
              </div>
            ) : (
              <div className="py-20 text-center text-neutral-500 space-y-3 bg-[#13151b] rounded-2xl border border-neutral-800/60 p-8">
                <Star className="w-10 h-10 mx-auto text-neutral-700" />
                <p className="text-sm font-medium text-neutral-300">No favorite channels saved yet</p>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Click the star icon on any channel card to pin it here for one-click playback.
                </p>
                <button
                  onClick={() => handleNavigate('channels')}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  Browse Live Channels
                </button>
              </div>
            )}
          </div>
        )}

        {/* 5. ALL CHANNELS & CATEGORY BROWSING */}
        {(currentView === 'channels' || currentView === 'category') && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {selectedCategory === 'all'
                    ? 'All Live TV Channels'
                    : categories.find((c) => c.slug === selectedCategory)?.name || 'Category Channels'}
                </h2>
                <p className="text-xs text-neutral-400 mt-1 flex items-center gap-2">
                  <span>Auto-verified live streams</span>
                  {autoUpdateStatus && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-mono">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{autoUpdateStatus.activeCount.toLocaleString()} Active Feeds</span>
                      </span>
                    </>
                  )}
                </p>
              </div>

              <CategoryBar
                categories={enrichedCategories}
                selectedCategory={selectedCategory}
                onSelectCategory={(slug) => setSelectedCategory(slug)}
                totalChannelsCount={
                  channels.filter((c) => c.isActive && c.isPublished && c.verificationStatus !== 'failing').length
                }
              />
            </div>

            <CountryFilterBar
              countries={countries}
              selectedCountry={selectedCountry}
              onSelectCountry={handleSelectCountry}
              channelCountsByCountry={channelCountsByCountry}
              isLoading={isLoadingCountry}
              onOpenDirectory={() => setCountrySidebarOpen(true)}
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {publicChannels.slice(0, displayLimit).map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  isFavorite={favorites.includes(channel.id)}
                  onToggleFavorite={handleToggleFavorite}
                  onSelectChannel={handleSelectChannel}
                />
              ))}
            </div>

            {publicChannels.length > displayLimit && (
              <div className="pt-8 pb-4 text-center">
                <button
                  onClick={() => setDisplayLimit((prev) => prev + 48)}
                  className="px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold border border-neutral-700 transition-colors shadow-md inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>Load More Channels</span>
                  <span className="text-neutral-400 font-mono text-[11px]">
                    (Showing {Math.min(displayLimit, publicChannels.length)} of {publicChannels.length.toLocaleString()})
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 6. HOMEPAGE VIEW */}
        {(currentView === 'home' || (currentView === 'admin' && !adminUser)) && (
          <div className="space-y-12">
            {settings?.showFeaturedEvent !== false && (
              <FeaturedEventHero
                events={events}
                onWatchEvent={handleWatchFeaturedEvent}
              />
            )}

            {recentChannels.length > 0 && (
              <section aria-label="Recently Watched" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-neutral-400" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                      Continue Watching
                    </h2>
                    <span className="text-xs font-mono text-neutral-500">
                      ({recentChannels.length})
                    </span>
                  </div>
                  <button
                    onClick={handleClearHistory}
                    className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear History</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {recentChannels.map((channel) => (
                    <ChannelCard
                      key={`recent-${channel.id}`}
                      channel={channel}
                      isFavorite={favorites.includes(channel.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onSelectChannel={handleSelectChannel}
                    />
                  ))}
                </div>
              </section>
            )}

            <section aria-label="Popular Channels" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Popular Channels</h2>
                  <p className="text-xs text-neutral-400">
                    Verified Nepali, Indian, and global broadcast networks
                  </p>
                </div>
                <button
                  onClick={() => handleNavigate('channels')}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-400 font-medium transition-colors cursor-pointer"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {popularChannels.map((channel) => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    isFavorite={favorites.includes(channel.id)}
                    onToggleFavorite={handleToggleFavorite}
                    onSelectChannel={handleSelectChannel}
                  />
                ))}
              </div>
            </section>

            {sportsChannels.length > 0 && (
              <section aria-label="Sports Broadcasts" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-red-500" />
                    <div>
                      <h2 className="text-base font-bold text-white tracking-tight">Sports & Tournaments</h2>
                      <p className="text-xs text-neutral-400">Live cricket, football, and motorsport coverage</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleNavigate('category', 'sports')}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-400 font-medium transition-colors cursor-pointer"
                  >
                    <span>More Sports</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {sportsChannels.map((channel) => (
                    <ChannelCard
                      key={`sports-${channel.id}`}
                      channel={channel}
                      isFavorite={favorites.includes(channel.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onSelectChannel={handleSelectChannel}
                    />
                  ))}
                </div>
              </section>
            )}

            <section aria-label="Browse Categories" className="space-y-4 pt-4 border-t border-neutral-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Explore Live Directory</h2>
                  <p className="text-xs text-neutral-400">
                    Filter verified channels by genre or choose from 250 countries (A–Z)
                  </p>
                </div>
                <CategoryBar
                  categories={enrichedCategories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={(slug) => setSelectedCategory(slug)}
                  totalChannelsCount={
                    channels.filter((c) => c.isActive && c.isPublished && c.verificationStatus !== 'failing').length
                  }
                />
              </div>

              <CountryFilterBar
                countries={countries}
                selectedCountry={selectedCountry}
                onSelectCountry={handleSelectCountry}
                channelCountsByCountry={channelCountsByCountry}
                isLoading={isLoadingCountry}
                onOpenDirectory={() => setCountrySidebarOpen(true)}
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {publicChannels.slice(0, displayLimit).map((channel) => (
                  <ChannelCard
                    key={`cat-${channel.id}`}
                    channel={channel}
                    isFavorite={favorites.includes(channel.id)}
                    onToggleFavorite={handleToggleFavorite}
                    onSelectChannel={handleSelectChannel}
                  />
                ))}
              </div>

              {publicChannels.length > displayLimit && (
                <div className="pt-8 pb-4 text-center">
                  <button
                    onClick={() => setDisplayLimit((prev) => prev + 48)}
                    className="px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold border border-neutral-700 transition-colors shadow-md inline-flex items-center gap-2 cursor-pointer"
                  >
                    <span>Load More Channels</span>
                    <span className="text-neutral-400 font-mono text-[11px]">
                      (Showing {Math.min(displayLimit, publicChannels.length)} of {publicChannels.length.toLocaleString()})
                    </span>
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <Footer onNavigate={handleNavigate} />

      <CountrySidebarDrawer
        isOpen={countrySidebarOpen}
        onClose={() => setCountrySidebarOpen(false)}
        countries={countries}
        selectedCountry={selectedCountry}
        onSelectCountry={handleSelectCountry}
        channelCountsByCountry={channelCountsByCountry}
      />
    </div>
  );
}
