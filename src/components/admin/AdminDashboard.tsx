import React, { useState } from 'react';
import { Channel, FeaturedEvent, Category, Announcement, AppSettings, AdminUser } from '../../types/index.ts';
import {
  createChannel,
  updateChannel,
  deleteChannel,
  createEvent,
  updateEvent,
  deleteEvent,
  updateSettings,
  testStreamAvailability,
  resetDemoData,
  syncIptvChannels,
} from '../../services/api.ts';
import {
  Tv,
  Calendar,
  Layers,
  Megaphone,
  Settings,
  LogOut,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertTriangle,
  Play,
  Activity,
  Radio,
  ExternalLink,
  RefreshCw,
  Search,
} from 'lucide-react';

interface AdminDashboardProps {
  user: AdminUser;
  channels: Channel[];
  events: FeaturedEvent[];
  categories: Category[];
  announcements: Announcement[];
  settings: AppSettings;
  onRefreshData: () => Promise<void>;
  onLogout: () => void;
  onViewSite: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  channels,
  events,
  categories,
  announcements,
  settings,
  onRefreshData,
  onLogout,
  onViewSite,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'channels' | 'events' | 'categories' | 'announcements' | 'tester' | 'settings'>('overview');

  // Channel Edit/New State
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Partial<Channel> | null>(null);

  // Event Edit/New State
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Partial<FeaturedEvent> | null>(null);

  // Category Edit/New State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);

  // Announcement Edit/New State
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Partial<Announcement> | null>(null);

  // Stream tester state
  const [testUrl, setTestUrl] = useState('https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8');
  const [testResult, setTestResult] = useState<{
    reachable: boolean;
    statusCode: number;
    contentType: string;
    corsHeader: string;
    hasHlsManifestHeader?: boolean;
    details: string;
  } | null>(null);
  const [isTestingStream, setIsTestingStream] = useState(false);

  // Search in admin channels
  const [channelSearch, setChannelSearch] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const showError = (msg: string) => {
    setActionError(msg);
    setTimeout(() => setActionError(null), 4000);
  };

  // Channel Form Actions
  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChannel?.name || !editingChannel?.streamUrl || !editingChannel?.categoryId) {
      showError('Please fill in required fields: Name, Stream URL, and Category');
      return;
    }

    try {
      if (editingChannel.id) {
        await updateChannel(editingChannel.id, editingChannel);
        showSuccess(`Updated channel "${editingChannel.name}"`);
      } else {
        await createChannel(editingChannel);
        showSuccess(`Created channel "${editingChannel.name}"`);
      }
      setChannelModalOpen(false);
      setEditingChannel(null);
      await onRefreshData();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to save channel');
    }
  };

  const handleDeleteChannel = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete channel "${name}"?`)) return;
    try {
      await deleteChannel(id);
      showSuccess(`Deleted channel "${name}"`);
      await onRefreshData();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to delete channel');
    }
  };

  // Event Form Actions
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent?.title || !editingEvent?.channelId) {
      showError('Please fill in required fields: Event Title and Channel');
      return;
    }

    try {
      const selectedChannel = channels.find((c) => c.id === editingEvent.channelId);
      const eventToSave = {
        ...editingEvent,
        channelName: selectedChannel ? selectedChannel.name : editingEvent.channelName,
      };

      if (editingEvent.id) {
        await updateEvent(editingEvent.id, eventToSave);
        showSuccess(`Updated event "${editingEvent.title}"`);
      } else {
        await createEvent(eventToSave);
        showSuccess(`Created event "${editingEvent.title}"`);
      }
      setEventModalOpen(false);
      setEditingEvent(null);
      await onRefreshData();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to save event');
    }
  };

  const handleDeleteEvent = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete event "${title}"?`)) return;
    try {
      await deleteEvent(id);
      showSuccess(`Deleted event "${title}"`);
      await onRefreshData();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to delete event');
    }
  };

  // Settings Actions
  const handleToggleMaintenance = async () => {
    try {
      const updated = await updateSettings({ maintenanceMode: !settings.maintenanceMode });
      showSuccess(`Maintenance mode ${updated.maintenanceMode ? 'enabled' : 'disabled'}`);
      await onRefreshData();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to update settings');
    }
  };

  const handleToggleShowFeatured = async () => {
    try {
      const updated = await updateSettings({ showFeaturedEvent: !settings.showFeaturedEvent });
      showSuccess(`Featured event visibility ${updated.showFeaturedEvent ? 'enabled' : 'hidden'}`);
      await onRefreshData();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to update settings');
    }
  };

  const handleRunStreamTest = async () => {
    if (!testUrl) return;
    setIsTestingStream(true);
    setTestResult(null);
    try {
      const res = await testStreamAvailability(testUrl);
      setTestResult(res);
    } catch (err: unknown) {
      setTestResult({
        reachable: false,
        statusCode: 0,
        contentType: 'error',
        corsHeader: 'none',
        details: err instanceof Error ? err.message : 'Probe failure',
      });
    } finally {
      setIsTestingStream(false);
    }
  };

  const [isSyncingIptv, setIsSyncingIptv] = useState(false);

  const handleSyncIptv = async () => {
    setIsSyncingIptv(true);
    try {
      const res = await syncIptvChannels();
      showSuccess(`GitHub IPTV sync complete: ${res.newlyAdded} new streams added (${res.totalChannels} total).`);
      await onRefreshData();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'IPTV Sync failed');
    } finally {
      setIsSyncingIptv(false);
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset all channels, events, and categories to default demonstration state?')) return;
    try {
      await resetDemoData();
      showSuccess('Reset to default demonstration data.');
      await onRefreshData();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to reset data');
    }
  };

  // Derived Metrics
  const activeChannelsCount = channels.filter((c) => c.isActive && c.isPublished).length;
  const inactiveChannelsCount = channels.filter((c) => !c.isActive || !c.isPublished).length;
  const publishedEventsCount = events.filter((e) => e.isActive && e.isPublished).length;
  const upcomingEventsCount = events.filter((e) => e.status === 'UPCOMING' && e.isActive && e.isPublished).length;
  const liveEventsCount = events.filter((e) => e.status === 'LIVE' && e.isActive && e.isPublished).length;
  const priorityOneEvent = events
    .filter((e) => e.isActive && e.isPublished)
    .sort((a, b) => a.priority - b.priority)[0];

  const [channelPage, setChannelPage] = useState(1);
  const CHANNELS_PER_PAGE = 30;

  const filteredChannels = channels.filter((c) => {
    if (!channelSearch) return true;
    const q = channelSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.categoryName.toLowerCase().includes(q) ||
      (c.country && c.country.toLowerCase().includes(q))
    );
  });

  const totalChannelPages = Math.ceil(filteredChannels.length / CHANNELS_PER_PAGE) || 1;
  const pagedChannels = filteredChannels.slice(
    (channelPage - 1) * CHANNELS_PER_PAGE,
    channelPage * CHANNELS_PER_PAGE
  );

  return (
    <div className="space-y-8">
      {/* Admin Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">तपाईंको TV — Control Room</h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
              Admin Session
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onViewSite}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>View Public Site</span>
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-red-950/60 text-neutral-400 hover:text-red-400 border border-neutral-800 text-xs font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-neutral-800 scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'overview' ? 'bg-neutral-200 text-neutral-900 font-bold' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>
        <button
          onClick={() => setActiveTab('channels')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'channels' ? 'bg-neutral-200 text-neutral-900 font-bold' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Tv className="w-3.5 h-3.5" />
          <span>Channels ({channels.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'events' ? 'bg-neutral-200 text-neutral-900 font-bold' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Featured Events ({events.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'categories' ? 'bg-neutral-200 text-neutral-900 font-bold' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Categories ({categories.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('announcements')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'announcements' ? 'bg-neutral-200 text-neutral-900 font-bold' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>Announcements</span>
        </button>
        <button
          onClick={() => setActiveTab('tester')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'tester' ? 'bg-neutral-200 text-neutral-900 font-bold' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Stream Tester</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'settings' ? 'bg-neutral-200 text-neutral-900 font-bold' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Settings</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#181a20] border border-neutral-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-neutral-400">Active Live Channels</p>
              <p className="text-2xl font-bold text-white tabular-nums">{activeChannelsCount}</p>
              <p className="text-[11px] text-neutral-500">Publicly discoverable</p>
            </div>
            <div className="bg-[#181a20] border border-neutral-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-neutral-400">Inactive / Draft Channels</p>
              <p className="text-2xl font-bold text-amber-400 tabular-nums">{inactiveChannelsCount}</p>
              <p className="text-[11px] text-neutral-500">Hidden from public viewers</p>
            </div>
            <div className="bg-[#181a20] border border-neutral-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-neutral-400">Live & Upcoming Events</p>
              <p className="text-2xl font-bold text-red-500 tabular-nums">
                {liveEventsCount} <span className="text-xs text-neutral-400">Live</span> / {upcomingEventsCount} <span className="text-xs text-neutral-400">Upcoming</span>
              </p>
              <p className="text-[11px] text-neutral-500">{publishedEventsCount} total published</p>
            </div>
            <div className="bg-[#181a20] border border-neutral-800 rounded-xl p-5 space-y-1">
              <p className="text-xs text-neutral-400">Maintenance Status</p>
              <p className={`text-2xl font-bold ${settings.maintenanceMode ? 'text-amber-400' : 'text-emerald-400'}`}>
                {settings.maintenanceMode ? 'MAINTENANCE' : 'NORMAL'}
              </p>
              <p className="text-[11px] text-neutral-500">Public access open</p>
            </div>
          </div>

          {/* Current Hero Featured Priority Event */}
          <div className="bg-[#181a20] border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Current Priority #1 Homepage Event</h3>
              <button
                onClick={() => setActiveTab('events')}
                className="text-xs text-red-400 hover:text-red-300 font-medium"
              >
                Manage Events →
              </button>
            </div>

            {priorityOneEvent ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-900 border border-neutral-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-500 font-mono">Priority #{priorityOneEvent.priority}</span>
                    <span className="text-neutral-600">·</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 uppercase">
                      {priorityOneEvent.status}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white">{priorityOneEvent.title}</h4>
                  <p className="text-xs text-neutral-400">{priorityOneEvent.subtitle}</p>
                </div>
                <div className="text-right text-xs text-neutral-400">
                  <p>Channel: <span className="text-white font-medium">{priorityOneEvent.channelName}</span></p>
                  <p className="text-[11px] font-mono text-neutral-500 mt-1">Button: {priorityOneEvent.buttonLabel}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-500 italic">No published featured events currently active.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CHANNELS */}
      {activeTab === 'channels' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Filter channels by name..."
                value={channelSearch}
                onChange={(e) => {
                  setChannelSearch(e.target.value);
                  setChannelPage(1);
                }}
                className="w-full bg-[#181a20] border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncIptv}
                disabled={isSyncingIptv}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-colors"
                title="Fetch and verify working streams from iptv-org GitHub repository"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingIptv ? 'animate-spin text-red-400' : 'text-neutral-400'}`} />
                <span>{isSyncingIptv ? 'Syncing...' : 'Sync from GitHub iptv-org'}</span>
              </button>

              <button
                onClick={() => {
                  setEditingChannel({
                    name: '',
                    nepaliName: '',
                    streamUrl: '',
                    streamType: 'hls',
                    categoryId: 'nepali-tv',
                    categoryName: 'Nepali TV',
                    country: 'Nepal',
                    language: 'Nepali',
                    description: '',
                    isActive: true,
                    isPublished: true,
                    priority: 10,
                    sourceType: 'manual',
                    verificationStatus: 'untested',
                  });
                  setChannelModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Channel</span>
              </button>
            </div>
          </div>

          {/* Channels Table */}
          <div className="bg-[#181a20] border border-neutral-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-900/80 text-neutral-400 border-b border-neutral-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Format</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                  {pagedChannels.map((ch) => (
                    <tr key={ch.id} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-neutral-400">
                        #{ch.priority}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden shrink-0">
                            {ch.logoUrl ? (
                              <img src={ch.logoUrl} alt={ch.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            ) : (
                              <Tv className="w-4 h-4 text-neutral-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{ch.name}</p>
                            <p className="text-[11px] text-neutral-500">{ch.country} · {ch.language}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-neutral-400">{ch.categoryName}</td>
                      <td className="py-3 px-4 font-mono text-[11px] uppercase text-neutral-400">{ch.streamType}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              ch.isActive && ch.isPublished ? 'bg-emerald-500' : 'bg-neutral-600'
                            }`}
                          />
                          <span className="text-[11px]">
                            {ch.isActive && ch.isPublished ? 'Published' : 'Hidden'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingChannel(ch);
                              setChannelModalOpen(true);
                            }}
                            className="p-1.5 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
                            aria-label={`Edit ${ch.name}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteChannel(ch.id, ch.name)}
                            className="p-1.5 rounded hover:bg-red-950 text-neutral-400 hover:text-red-400 transition-colors"
                            aria-label={`Delete ${ch.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-neutral-900/60 border-t border-neutral-800 text-xs text-neutral-400">
              <div>
                Showing <span className="text-white font-medium">{filteredChannels.length === 0 ? 0 : (channelPage - 1) * CHANNELS_PER_PAGE + 1}</span> to <span className="text-white font-medium">{Math.min(channelPage * CHANNELS_PER_PAGE, filteredChannels.length)}</span> of <span className="text-white font-medium">{filteredChannels.length.toLocaleString()}</span> channels
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={channelPage <= 1}
                  onClick={() => setChannelPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 transition-colors text-xs font-medium"
                >
                  Previous
                </button>
                <span className="font-mono text-neutral-400 px-2 text-xs">
                  Page {channelPage} of {totalChannelPages}
                </span>
                <button
                  disabled={channelPage >= totalChannelPages}
                  onClick={() => setChannelPage((p) => Math.min(totalChannelPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 transition-colors text-xs font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FEATURED EVENTS */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400">
              Featured events determine the hero broadcast on the public homepage. Lower priority number = higher ranking.
            </p>
            <button
              onClick={() => {
                setEditingEvent({
                  title: '',
                  nepaliTitle: '',
                  subtitle: '',
                  description: '',
                  thumbnailUrl: '',
                  bannerUrl: '',
                  channelId: channels[0]?.id || '',
                  channelName: channels[0]?.name || '',
                  status: 'UPCOMING',
                  startTime: new Date().toISOString(),
                  priority: 1,
                  isActive: true,
                  isPublished: true,
                  buttonLabel: 'Watch Live',
                });
                setEventModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Featured Event</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="bg-[#181a20] border border-neutral-800 rounded-xl p-5 space-y-3 relative group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-red-500 bg-red-950/60 px-2 py-0.5 rounded border border-red-900/60">
                      Priority #{ev.priority}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      ev.status === 'LIVE' ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-300'
                    }`}>
                      {ev.status}
                    </span>
                    {(!ev.isActive || !ev.isPublished) && (
                      <span className="text-[10px] text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded">
                        DRAFT
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingEvent(ev);
                        setEventModalOpen(true);
                      }}
                      className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(ev.id, ev.title)}
                      className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-neutral-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white line-clamp-1">{ev.title}</h4>
                  {ev.nepaliTitle && <p className="text-xs text-red-400">{ev.nepaliTitle}</p>}
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{ev.subtitle || ev.description}</p>
                </div>

                <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Channel: <strong className="text-neutral-200">{ev.channelName || ev.channelId}</strong></span>
                  <span className="font-mono">Button: "{ev.buttonLabel}"</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400">Manage public genre classification tabs.</p>
            <button
              onClick={() => {
                setEditingCategory({
                  name: '',
                  nepaliName: '',
                  slug: '',
                  isActive: true,
                  displayOrder: categories.length + 1,
                });
                setCategoryModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </div>

          <div className="bg-[#181a20] border border-neutral-800 rounded-xl divide-y divide-neutral-800">
            {categories.map((cat) => (
              <div key={cat.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-center font-mono text-xs text-neutral-400">
                    {cat.displayOrder}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{cat.name}</p>
                    <p className="text-xs text-neutral-400">{cat.nepaliName} · slug: <code className="text-neutral-300">{cat.slug}</code></p>
                  </div>
                </div>

                <span className={`text-[11px] px-2 py-0.5 rounded ${cat.isActive ? 'bg-emerald-950 text-emerald-400' : 'bg-neutral-800 text-neutral-400'}`}>
                  {cat.isActive ? 'Active' : 'Disabled'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: ANNOUNCEMENTS */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400">Announcements appear at the top of the public website.</p>
            <button
              onClick={() => {
                setEditingAnnouncement({
                  title: '',
                  message: '',
                  nepaliMessage: '',
                  isActive: true,
                  isPublished: true,
                  displayOrder: 1,
                });
                setAnnouncementModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Add Announcement</span>
            </button>
          </div>

          <div className="space-y-3">
            {announcements.map((ann) => (
              <div key={ann.id} className="p-4 rounded-xl bg-[#181a20] border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white">{ann.title}</h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${ann.isActive && ann.isPublished ? 'bg-emerald-950 text-emerald-400' : 'bg-neutral-800 text-neutral-400'}`}>
                    {ann.isActive && ann.isPublished ? 'ACTIVE' : 'DRAFT'}
                  </span>
                </div>
                <p className="text-xs text-neutral-300">{ann.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: STREAM TESTER */}
      {activeTab === 'tester' && (
        <div className="space-y-6 max-w-2xl">
          <div className="bg-[#181a20] border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Live Stream Diagnostic Probe</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Performs a real HTTP probe to test manifest headers, CORS accessibility, and content format.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-300">Stream URL to Validate</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  placeholder="https://example.com/playlist.m3u8"
                  className="flex-1 bg-[#101114] border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                />
                <button
                  onClick={handleRunStreamTest}
                  disabled={isTestingStream || !testUrl}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isTestingStream ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>Test Feed</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                testResult.reachable ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-red-950/40 border-red-800 text-red-300'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>Status: {testResult.reachable ? 'ONLINE & REACHABLE' : 'UNREACHABLE / RESTRICTED'}</span>
                  <span className="font-mono">HTTP {testResult.statusCode}</span>
                </div>
                <div className="text-[11px] text-neutral-300 space-y-1">
                  <p>Content-Type: <code className="font-mono">{testResult.contentType}</code></p>
                  <p>CORS Header: <code className="font-mono">{testResult.corsHeader}</code></p>
                  <p>HLS Playlist Manifest: <code className="font-mono">{testResult.hasHlsManifestHeader ? 'Verified' : 'No manifest tags'}</code></p>
                </div>
                <p className="text-xs border-t border-neutral-800/80 pt-2 font-medium">
                  {testResult.details}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: SETTINGS & MAINTENANCE */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-2xl">
          <div className="bg-[#181a20] border border-neutral-800 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-white">Platform Settings</h3>
              <p className="text-xs text-neutral-400 mt-1">Configure homepage toggles and platform emergency states.</p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-900 border border-neutral-800">
              <div>
                <p className="text-xs font-semibold text-white">Maintenance Mode</p>
                <p className="text-[11px] text-neutral-400">Shows temporary maintenance notice to public visitors while keeping admin portal accessible.</p>
              </div>
              <button
                onClick={handleToggleMaintenance}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  settings.maintenanceMode ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {settings.maintenanceMode ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-900 border border-neutral-800">
              <div>
                <p className="text-xs font-semibold text-white">Show Featured Hero Event</p>
                <p className="text-[11px] text-neutral-400">Display prominent hero broadcast section on homepage.</p>
              </div>
              <button
                onClick={handleToggleShowFeatured}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  settings.showFeaturedEvent ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {settings.showFeaturedEvent ? 'VISIBLE' : 'HIDDEN'}
              </button>
            </div>

            <div className="pt-4 border-t border-neutral-800 flex flex-wrap items-center gap-3">
              <button
                onClick={handleSyncIptv}
                disabled={isSyncingIptv}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white text-xs font-medium border border-neutral-700 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingIptv ? 'animate-spin text-red-400' : 'text-neutral-400'}`} />
                <span>{isSyncingIptv ? 'Syncing...' : 'Sync Live Channels from GitHub iptv-org'}</span>
              </button>

              <button
                onClick={handleResetDemo}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors"
              >
                Reset to Default Demo Channels & Matches
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANNEL EDIT / ADD MODAL */}
      {channelModalOpen && editingChannel && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#181a20] border border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white">
              {editingChannel.id ? `Edit Channel: ${editingChannel.name}` : 'Add New Channel'}
            </h3>

            <form onSubmit={handleSaveChannel} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-300 mb-1">Channel Name (Required)</label>
                <input
                  type="text"
                  required
                  value={editingChannel.name || ''}
                  onChange={(e) => setEditingChannel({ ...editingChannel, name: e.target.value })}
                  placeholder="e.g. Nepal Television HD"
                  className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 mb-1">Nepali Name (Optional)</label>
                <input
                  type="text"
                  value={editingChannel.nepaliName || ''}
                  onChange={(e) => setEditingChannel({ ...editingChannel, nepaliName: e.target.value })}
                  placeholder="e.g. नेपाल टेलिभिजन"
                  className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 mb-1">Stream URL (HLS / MP4 - Required)</label>
                <input
                  type="url"
                  required
                  value={editingChannel.streamUrl || ''}
                  onChange={(e) => setEditingChannel({ ...editingChannel, streamUrl: e.target.value })}
                  placeholder="https://.../master.m3u8"
                  className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 mb-1">Category</label>
                  <select
                    value={editingChannel.categoryId || 'nepali-tv'}
                    onChange={(e) => {
                      const cat = categories.find((c) => c.id === e.target.value);
                      setEditingChannel({
                        ...editingChannel,
                        categoryId: e.target.value,
                        categoryName: cat ? cat.name : 'General',
                      });
                    }}
                    className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 mb-1">Priority (1 = Highest)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editingChannel.priority || 10}
                    onChange={(e) => setEditingChannel({ ...editingChannel, priority: parseInt(e.target.value) || 10 })}
                    className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 mb-1">Country</label>
                  <input
                    type="text"
                    value={editingChannel.country || 'Nepal'}
                    onChange={(e) => setEditingChannel({ ...editingChannel, country: e.target.value })}
                    className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 mb-1">Language</label>
                  <input
                    type="text"
                    value={editingChannel.language || 'Nepali'}
                    onChange={(e) => setEditingChannel({ ...editingChannel, language: e.target.value })}
                    className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 mb-1">Logo URL (Optional)</label>
                <input
                  type="url"
                  value={editingChannel.logoUrl || ''}
                  onChange={(e) => setEditingChannel({ ...editingChannel, logoUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editingChannel.description || ''}
                  onChange={(e) => setEditingChannel({ ...editingChannel, description: e.target.value })}
                  className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingChannel.isActive ?? true}
                    onChange={(e) => setEditingChannel({ ...editingChannel, isActive: e.target.checked })}
                    className="accent-red-600 rounded"
                  />
                  <span>Active</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingChannel.isPublished ?? true}
                    onChange={(e) => setEditingChannel({ ...editingChannel, isPublished: e.target.checked })}
                    className="accent-red-600 rounded"
                  />
                  <span>Published to Public</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setChannelModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500"
                >
                  Save Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVENT EDIT / ADD MODAL */}
      {eventModalOpen && editingEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#181a20] border border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white">
              {editingEvent.id ? 'Edit Featured Event' : 'Create Featured Event'}
            </h3>

            <form onSubmit={handleSaveEvent} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-300 mb-1">Event Title (Required)</label>
                <input
                  type="text"
                  required
                  value={editingEvent.title || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  placeholder="e.g. Nepal Super League — Final Live"
                  className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 mb-1">Nepali Title</label>
                <input
                  type="text"
                  value={editingEvent.nepaliTitle || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, nepaliTitle: e.target.value })}
                  placeholder="e.g. नेपाल सुपर लिग — प्रत्यक्ष प्रसारण"
                  className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 mb-1">Subtitle / Match Info</label>
                <input
                  type="text"
                  value={editingEvent.subtitle || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, subtitle: e.target.value })}
                  placeholder="e.g. Kathmandu vs Lalitpur · Dasharath Stadium"
                  className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 mb-1">Target Broadcast Channel</label>
                  <select
                    value={editingEvent.channelId || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, channelId: e.target.value })}
                    className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white"
                  >
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 mb-1">Priority (1 = Top Homepage)</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={editingEvent.priority || 1}
                    onChange={(e) => setEditingEvent({ ...editingEvent, priority: parseInt(e.target.value) || 1 })}
                    className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 mb-1">Event Status</label>
                  <select
                    value={editingEvent.status || 'UPCOMING'}
                    onChange={(e) => setEditingEvent({ ...editingEvent, status: e.target.value as any })}
                    className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white"
                  >
                    <option value="LIVE">LIVE NOW</option>
                    <option value="UPCOMING">UPCOMING</option>
                    <option value="ENDED">ENDED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 mb-1">Button Label</label>
                  <input
                    type="text"
                    value={editingEvent.buttonLabel || 'Watch Live'}
                    onChange={(e) => setEditingEvent({ ...editingEvent, buttonLabel: e.target.value })}
                    className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 mb-1">Banner Artwork URL</label>
                <input
                  type="url"
                  value={editingEvent.bannerUrl || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, bannerUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-[#101114] border border-neutral-800 rounded-lg p-2 text-white font-mono"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingEvent.isActive ?? true}
                    onChange={(e) => setEditingEvent({ ...editingEvent, isActive: e.target.checked })}
                    className="accent-red-600 rounded"
                  />
                  <span>Active</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingEvent.isPublished ?? true}
                    onChange={(e) => setEditingEvent({ ...editingEvent, isPublished: e.target.checked })}
                    className="accent-red-600 rounded"
                  />
                  <span>Published</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
