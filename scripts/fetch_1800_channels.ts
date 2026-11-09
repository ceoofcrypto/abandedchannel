import fs from 'fs';
import path from 'path';

interface RawChannel {
  id: string;
  name: string;
  nepaliName: string;
  logoUrl: string;
  streamUrl: string;
  streamType: 'hls' | 'dash' | 'mp4';
  categoryId: string;
  categoryName: string;
  country: string;
  countryCode?: string;
  language: string;
  description: string;
  isActive: boolean;
  isPublished: boolean;
  isFeatured?: boolean;
  priority: number;
  sourceType: 'manual' | 'iptv-org';
  verificationStatus: 'verified' | 'untested' | 'failed';
}

const COUNTRY_MAP: Record<string, string> = {
  np: 'Nepal',
  in: 'India',
  us: 'USA',
  uk: 'UK',
  gb: 'UK',
  ca: 'Canada',
  au: 'Australia',
  de: 'Germany',
  fr: 'France',
  it: 'Italy',
  es: 'Spain',
  jp: 'Japan',
  kr: 'South Korea',
  br: 'Brazil',
  mx: 'Mexico',
  ar: 'Argentina',
  za: 'South Africa',
  ae: 'UAE',
  sa: 'Saudi Arabia',
  pk: 'Pakistan',
  bd: 'Bangladesh',
  lk: 'Sri Lanka',
  sg: 'Singapore',
  my: 'Malaysia',
  th: 'Thailand',
  id: 'Indonesia',
  ph: 'Philippines',
  tr: 'Turkey',
  eg: 'Egypt',
  ng: 'Nigeria',
  ke: 'Kenya',
  gh: 'Ghana',
  se: 'Sweden',
  no: 'Norway',
  dk: 'Denmark',
  fi: 'Finland',
  nl: 'Netherlands',
  be: 'Belgium',
  ch: 'Switzerland',
  at: 'Austria',
  pt: 'Portugal',
  gr: 'Greece',
  pl: 'Poland',
  cz: 'Czech Republic',
  ro: 'Romania',
  hu: 'Hungary',
  ua: 'Ukraine',
  ru: 'Russia',
  il: 'Israel',
  nz: 'New Zealand',
  ie: 'Ireland',
};

async function main() {
  console.log('Fetching open-source IPTV channels from iptv-org...');

  // 1. Fetch main index
  const res = await fetch('https://iptv-org.github.io/iptv/index.m3u');
  if (!res.ok) {
    throw new Error(`Failed to fetch index.m3u: ${res.status}`);
  }
  const text = await res.text();
  const lines = text.split('\n');

  console.log(`Fetched ${lines.length} lines from iptv-org index.m3u`);

  // Base seed channels (the 18 verified priority channels)
  const seedPath = path.resolve(process.cwd(), 'src/data/seedData.ts');
  const dbPath = path.resolve(process.cwd(), 'data/db.json');
  let currentDb: any = null;
  if (fs.existsSync(dbPath)) {
    try {
      currentDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    } catch (e) {
      console.warn('Could not read existing db.json');
    }
  }

  // Use the first 18 verified seed channels
  const verifiedSeeds = (currentDb?.channels || []).slice(0, 18);
  const existingUrls = new Set(verifiedSeeds.map((c: any) => c.streamUrl.trim()));
  const existingNames = new Set(verifiedSeeds.map((c: any) => c.name.toLowerCase().trim()));

  const newChannels: RawChannel[] = [];
  let curInfo: {
    name: string;
    logo: string;
    group: string;
    tvgId: string;
    countryCode?: string;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const lastComma = line.lastIndexOf(',');
      const name = lastComma !== -1 ? line.substring(lastComma + 1).trim() : 'Channel';
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);
      const idMatch = line.match(/tvg-id="([^"]*)"/);

      let cc: string | undefined = undefined;
      const tvgId = idMatch ? idMatch[1] : '';
      if (tvgId) {
        const base = tvgId.split('@')[0];
        const lastDot = base.lastIndexOf('.');
        if (lastDot !== -1) {
          const candidate = base.substring(lastDot + 1).toLowerCase();
          if (candidate.length === 2 && COUNTRY_MAP[candidate]) {
            cc = candidate.toUpperCase();
          }
        }
      }

      curInfo = {
        name,
        logo: logoMatch ? logoMatch[1] : '',
        group: groupMatch ? groupMatch[1] : '',
        tvgId,
        countryCode: cc,
      };
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      if (curInfo) {
        const streamUrl = line.trim();
        const normUrl = streamUrl.toLowerCase();

        // Must be HLS or stream format, and avoid duplicates
        const isValidFormat = normUrl.includes('.m3u8') || normUrl.includes('.mp4') || normUrl.includes('stream') || normUrl.includes('live');
        if (isValidFormat && !existingUrls.has(streamUrl) && !existingNames.has(curInfo.name.toLowerCase())) {
          existingUrls.add(streamUrl);
          existingNames.add(curInfo.name.toLowerCase());

          // Category classification
          const g = curInfo.group.toLowerCase();
          let catId = 'entertainment';
          let catName = 'Entertainment';

          if (curInfo.countryCode === 'NP' || curInfo.name.toLowerCase().includes('nepal')) {
            catId = 'nepali-tv';
            catName = 'Nepali TV';
          } else if (g.includes('sport') || g.includes('racing') || g.includes('football') || g.includes('cricket') || g.includes('golf')) {
            catId = 'sports';
            catName = 'Sports';
          } else if (g.includes('news') || g.includes('legislative') || g.includes('weather') || g.includes('business')) {
            catId = 'news';
            catName = 'News';
          } else if (g.includes('music')) {
            catId = 'music';
            catName = 'Music';
          } else if (g.includes('movie') || g.includes('cinema') || g.includes('classic')) {
            catId = 'movies';
            catName = 'Movies';
          } else if (g.includes('docu') || g.includes('education') || g.includes('science') || g.includes('culture') || g.includes('travel') || g.includes('outdoor')) {
            catId = 'documentary';
            catName = 'Documentary';
          } else if (g.includes('kid') || g.includes('animation') || g.includes('family')) {
            catId = 'kids';
            catName = 'Kids & Family';
          } else if (g.includes('entertain') || g.includes('general') || g.includes('comedy') || g.includes('series') || g.includes('lifestyle')) {
            catId = 'entertainment';
            catName = 'Entertainment';
          } else if (g.includes('religious')) {
            catId = 'regional-tv';
            catName = 'Regional TV';
          } else {
            catId = 'international';
            catName = 'International';
          }

          const cCode = curInfo.countryCode || 'INTL';
          const countryName = COUNTRY_MAP[cCode.toLowerCase()] || 'International';

          // Generate stable clean ID
          const cleanSlug = curInfo.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 40);
          const channelId = `ch-${cleanSlug || 'live'}-${Math.random().toString(36).substring(2, 7)}`;

          newChannels.push({
            id: channelId,
            name: curInfo.name,
            nepaliName: '',
            logoUrl: curInfo.logo || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=160&h=160&fit=crop&q=80',
            streamUrl,
            streamType: streamUrl.includes('.mp4') ? 'mp4' : 'hls',
            categoryId: catId,
            categoryName: catName,
            country: countryName,
            countryCode: cCode === 'INTL' ? undefined : cCode,
            language: countryName === 'Nepal' ? 'Nepali' : countryName === 'India' ? 'Hindi' : 'English',
            description: `${curInfo.name} broadcast live in ${countryName}. Available via open-source public IPTV feed.`,
            isActive: true,
            isPublished: true,
            isFeatured: false,
            priority: 100 + newChannels.length,
            sourceType: 'iptv-org',
            verificationStatus: 'untested',
          });
        }
      }
      curInfo = null;
    }
  }

  console.log(`Parsed ${newChannels.length} new unique channels from iptv-org index.`);

  // Combine with existing channels (keep existing verified at the top)
  // Target: 1,850+ total channels
  const targetTotal = 1880;
  const neededFromNew = Math.max(0, targetTotal - verifiedSeeds.length);
  const selectedNewChannels = newChannels.slice(0, neededFromNew);

  const combinedChannels = [...verifiedSeeds, ...selectedNewChannels];
  console.log(`Total channels after merging: ${combinedChannels.length}`);

  // Update categories to include any new ones (like movies, documentary, kids)
  const categories = [
    { id: 'nepali-tv', name: 'Nepali TV', nepaliName: 'नेपाली टिभी', slug: 'nepali-tv', icon: 'Tv', isActive: true, displayOrder: 1 },
    { id: 'sports', name: 'Sports', nepaliName: 'खेलकुद', slug: 'sports', icon: 'Trophy', isActive: true, displayOrder: 2 },
    { id: 'news', name: 'News', nepaliName: 'समाचार', slug: 'news', icon: 'Radio', isActive: true, displayOrder: 3 },
    { id: 'movies', name: 'Movies', nepaliName: 'चलचित्र', slug: 'movies', icon: 'Film', isActive: true, displayOrder: 4 },
    { id: 'entertainment', name: 'Entertainment', nepaliName: 'मनोरञ्जन', slug: 'entertainment', icon: 'Sparkles', isActive: true, displayOrder: 5 },
    { id: 'music', name: 'Music', nepaliName: 'संगीत', slug: 'music', icon: 'Music', isActive: true, displayOrder: 6 },
    { id: 'documentary', name: 'Documentary', nepaliName: 'वृत्तचित्र', slug: 'documentary', icon: 'Layers', isActive: true, displayOrder: 7 },
    { id: 'kids', name: 'Kids & Family', nepaliName: 'बालबालिका', slug: 'kids', icon: 'Heart', isActive: true, displayOrder: 8 },
    { id: 'regional-tv', name: 'Regional TV', nepaliName: 'क्षेत्रीय टिभी', slug: 'regional-tv', icon: 'Compass', isActive: true, displayOrder: 9 },
    { id: 'international', name: 'International', nepaliName: 'अन्तर्राष्ट्रिय', slug: 'international', icon: 'Globe', isActive: true, displayOrder: 10 },
  ];

  // Save back to db.json
  const updatedDb = {
    ...currentDb,
    channels: combinedChannels,
    categories,
  };

  fs.writeFileSync(dbPath, JSON.stringify(updatedDb, null, 2), 'utf-8');
  console.log(`Successfully written ${combinedChannels.length} channels and updated categories to ${dbPath}!`);
}

main().catch(console.error);
