import test from 'node:test';
import assert from 'node:assert/strict';
import { detectStreamType, calculateBackoffDelay, isValidStreamUrl } from './streaming.ts';
import { getEligibleFeaturedEvents, getPrimaryFeaturedEvent } from './events.ts';
import {
  filterChannels,
  sanitizeLogoUrl,
  isAdminEmailAuthorized,
  getChannelMonogram,
} from './channels.ts';
import { FeaturedEvent, Channel, Country } from '../types/index.ts';
import { groupCountriesAlphabetically, searchCountries } from './countryHelpers.ts';

test('detectStreamType identifies HLS, DASH, and direct formats', () => {
  assert.equal(detectStreamType('https://live.example.com/playlist.m3u8'), 'hls');
  assert.equal(detectStreamType('https://live.example.com/manifest.mpd'), 'dash');
  assert.equal(detectStreamType('https://live.example.com/stream.mp4?token=123'), 'direct');
  assert.equal(detectStreamType('https://live.example.com/unknown'), 'hls');
});

test('calculateBackoffDelay respects exponential backoff and max cap', () => {
  assert.equal(calculateBackoffDelay(0, 1000, 8000), 1000);
  assert.equal(calculateBackoffDelay(1, 1000, 8000), 2000);
  assert.equal(calculateBackoffDelay(2, 1000, 8000), 4000);
  assert.equal(calculateBackoffDelay(3, 1000, 8000), 8000);
  assert.equal(calculateBackoffDelay(10, 1000, 8000), 8000); // capped
});

test('isValidStreamUrl correctly validates URLs', () => {
  assert.equal(isValidStreamUrl('https://stream.tv/live.m3u8'), true);
  assert.equal(isValidStreamUrl('http://stream.tv/live.m3u8'), true);
  assert.equal(isValidStreamUrl('ftp://stream.tv/live.m3u8'), false);
  assert.equal(isValidStreamUrl('not-a-url'), false);
  assert.equal(isValidStreamUrl(''), false);
});

test('getEligibleFeaturedEvents filters unpublished events and orders by priority', () => {
  const mockEvents: FeaturedEvent[] = [
    {
      id: 'ev-3',
      title: 'Lower Priority Event',
      subtitle: 'Sub',
      description: 'Desc',
      thumbnailUrl: '',
      bannerUrl: '',
      channelId: 'ch-1',
      status: 'UPCOMING',
      startTime: '2026-11-06T10:00:00Z',
      priority: 3,
      isActive: true,
      isPublished: true,
      buttonLabel: 'Watch',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'ev-draft',
      title: 'Unpublished Draft',
      subtitle: 'Sub',
      description: 'Desc',
      thumbnailUrl: '',
      bannerUrl: '',
      channelId: 'ch-1',
      status: 'LIVE',
      startTime: '2026-11-06T10:00:00Z',
      priority: 1,
      isActive: true,
      isPublished: false, // draft
      buttonLabel: 'Watch',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'ev-1',
      title: 'Highest Priority Live Event',
      subtitle: 'Sub',
      description: 'Desc',
      thumbnailUrl: '',
      bannerUrl: '',
      channelId: 'ch-1',
      status: 'LIVE',
      startTime: '2026-11-06T10:00:00Z',
      priority: 1, // lowest number = highest priority
      isActive: true,
      isPublished: true,
      buttonLabel: 'Watch Live',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'ev-2',
      title: 'Second Priority Event',
      subtitle: 'Sub',
      description: 'Desc',
      thumbnailUrl: '',
      bannerUrl: '',
      channelId: 'ch-1',
      status: 'UPCOMING',
      startTime: '2026-11-06T12:00:00Z',
      priority: 2,
      isActive: true,
      isPublished: true,
      buttonLabel: 'View Schedule',
      createdAt: '',
      updatedAt: '',
    },
  ];

  const eligible = getEligibleFeaturedEvents(mockEvents);
  assert.equal(eligible.length, 3);
  assert.equal(eligible[0].id, 'ev-1');
  assert.equal(eligible[1].id, 'ev-2');
  assert.equal(eligible[2].id, 'ev-3');

  const primary = getPrimaryFeaturedEvent(mockEvents);
  assert.equal(primary?.id, 'ev-1');
});

test('filterChannels hides unpublished and failing channels from public viewers', () => {
  const mockChannels: Channel[] = [
    {
      id: 'ch-pub',
      name: 'Nepal TV HD',
      logoUrl: '',
      streamUrl: 'https://test.m3u8',
      streamType: 'hls',
      categoryId: 'nepali-tv',
      categoryName: 'Nepali TV',
      country: 'Nepal',
      language: 'Nepali',
      description: 'Public channel',
      isActive: true,
      isPublished: true,
      isFeatured: false,
      priority: 1,
      sourceType: 'manual',
      verificationStatus: 'verified',
      lastVerifiedAt: null,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'ch-failing',
      name: 'Dead Stream TV',
      logoUrl: '',
      streamUrl: 'https://dead.m3u8',
      streamType: 'hls',
      categoryId: 'nepali-tv',
      categoryName: 'Nepali TV',
      country: 'Nepal',
      language: 'Nepali',
      description: 'Failing stream',
      isActive: true,
      isPublished: true,
      isFeatured: false,
      priority: 1,
      sourceType: 'iptv-org',
      verificationStatus: 'failing',
      lastVerifiedAt: null,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'ch-draft',
      name: 'Secret Test Channel',
      logoUrl: '',
      streamUrl: 'https://test.m3u8',
      streamType: 'hls',
      categoryId: 'nepali-tv',
      categoryName: 'Nepali TV',
      country: 'Nepal',
      language: 'Nepali',
      description: 'Unpublished channel',
      isActive: true,
      isPublished: false,
      isFeatured: false,
      priority: 2,
      sourceType: 'manual',
      verificationStatus: 'untested',
      lastVerifiedAt: null,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const publicResult = filterChannels(mockChannels, { publicOnly: true });
  assert.equal(publicResult.length, 1);
  assert.equal(publicResult[0].id, 'ch-pub');

  const adminResult = filterChannels(mockChannels, { publicOnly: false });
  assert.equal(adminResult.length, 3);
});

test('groupCountriesAlphabetically organizes countries by letter from A to Z', () => {
  const sampleCountries: Country[] = [
    { name: 'Nepal', code: 'NP', flag: '🇳🇵' },
    { name: 'India', code: 'IN', flag: '🇮🇳' },
    { name: 'Australia', code: 'AU', flag: '🇦🇺' },
    { name: 'Brazil', code: 'BR', flag: '🇧🇷' },
    { name: 'Argentina', code: 'AR', flag: '🇦🇷' },
    { name: 'United States', code: 'US', flag: '🇺🇸' },
    { name: 'United Kingdom', code: 'UK', flag: '🇬🇧' },
  ];

  const groups = groupCountriesAlphabetically(sampleCountries);
  assert.equal(groups.length, 5); // A, B, I, N, U
  assert.equal(groups[0].letter, 'A');
  assert.equal(groups[0].countries.length, 2);
  assert.equal(groups[0].countries[0].name, 'Argentina');
  assert.equal(groups[0].countries[1].name, 'Australia');

  assert.equal(groups[1].letter, 'B');
  assert.equal(groups[1].countries[0].name, 'Brazil');

  assert.equal(groups[2].letter, 'I');
  assert.equal(groups[2].countries[0].name, 'India');

  assert.equal(groups[3].letter, 'N');
  assert.equal(groups[3].countries[0].name, 'Nepal');

  assert.equal(groups[4].letter, 'U');
  assert.equal(groups[4].countries.length, 2);
});

test('searchCountries filters countries by name and ISO code', () => {
  const sampleCountries: Country[] = [
    { name: 'Nepal', code: 'NP', flag: '🇳🇵' },
    { name: 'India', code: 'IN', flag: '🇮🇳' },
    { name: 'United States', code: 'US', flag: '🇺🇸' },
  ];

  assert.equal(searchCountries(sampleCountries, 'ind').length, 1);
  assert.equal(searchCountries(sampleCountries, 'ind')[0].name, 'India');
  assert.equal(searchCountries(sampleCountries, 'np').length, 1);
  assert.equal(searchCountries(sampleCountries, 'np')[0].name, 'Nepal');
  assert.equal(searchCountries(sampleCountries, '').length, 3);
});

test('sanitizeLogoUrl strips unsplash and wikia CORP-blocked URLs', () => {
  assert.equal(
    sanitizeLogoUrl('https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=160'),
    ''
  );
  assert.equal(
    sanitizeLogoUrl('https://static.wikia.nocookie.net/logopedia/images/6/69/DD_Sports.svg'),
    ''
  );
  assert.equal(sanitizeLogoUrl('https://i.imgur.com/GzB9o1X.png'), 'https://i.imgur.com/GzB9o1X.png');
  assert.equal(sanitizeLogoUrl(''), '');
});

test('isAdminEmailAuthorized strictly permits only ceoofcrypto@gmail.com', () => {
  assert.equal(isAdminEmailAuthorized('ceoofcrypto@gmail.com'), true);
  assert.equal(isAdminEmailAuthorized('  CEOOFCRYPTO@GMAIL.COM '), true);
  assert.equal(isAdminEmailAuthorized('admin@tapaiko.tv'), false);
  assert.equal(isAdminEmailAuthorized('otheruser@gmail.com'), false);
  assert.equal(isAdminEmailAuthorized(''), false);
  assert.equal(isAdminEmailAuthorized(null), false);
});

test('getChannelMonogram generates deterministic callsign initials', () => {
  const mono1 = getChannelMonogram('Kantipur TV HD');
  assert.equal(mono1.initials, 'KT');
  const mono2 = getChannelMonogram('NDTV');
  assert.equal(mono2.initials, 'ND');
});
