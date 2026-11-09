export type StreamType = 'hls' | 'dash' | 'direct';

export type EventStatus = 'UPCOMING' | 'LIVE' | 'ENDED' | 'CANCELLED';

export type VerificationStatus = 'verified' | 'untested' | 'failing';

export interface Country {
  name: string;
  code: string; // ISO 2-letter uppercase, e.g. 'NP', 'IN', 'US'
  flag: string; // Emoji flag, e.g. '🇳🇵', '🇮🇳', '🇺🇸'
  languages?: string[];
  channelCount?: number;
}

export interface Channel {
  id: string;
  name: string;
  nepaliName?: string;
  logoUrl: string;
  streamUrl: string;
  streamType: StreamType;
  categoryId: string;
  categoryName: string;
  country: string;
  countryCode?: string; // e.g. 'NP', 'IN', 'US'
  language: string;
  description: string;
  isActive: boolean;
  isPublished: boolean;
  isFeatured: boolean;
  priority: number; // lower number = higher priority
  sourceType: 'manual' | 'iptv-org';
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeaturedEvent {
  id: string;
  title: string;
  nepaliTitle?: string;
  subtitle: string;
  description: string;
  thumbnailUrl: string;
  bannerUrl: string;
  channelId: string;
  channelName?: string;
  streamUrlOverride?: string | null;
  status: EventStatus;
  startTime: string; // ISO 8601
  endTime?: string | null;
  priority: number; // 1 is highest priority
  isActive: boolean;
  isPublished: boolean;
  buttonLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  nepaliName: string;
  slug: string;
  icon?: string;
  isActive: boolean;
  displayOrder: number;
  channelCount?: number;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  nepaliMessage?: string;
  isActive: boolean;
  isPublished: boolean;
  startTime?: string | null;
  endTime?: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  appName: string;
  tagline: string;
  nepaliTagline: string;
  logoUrl: string;
  maintenanceMode: boolean;
  showFeaturedEvent: boolean;
  defaultTheme: 'dark' | 'light';
  updatedAt: string;
}

export interface AdminUser {
  email: string;
  name: string;
  role: 'admin' | 'superadmin';
  token?: string;
}

export interface StreamQualityLevel {
  id: number;
  height: number;
  width: number;
  bitrate: number;
  label: string;
}
