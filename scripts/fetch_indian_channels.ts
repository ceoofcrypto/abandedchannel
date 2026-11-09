import fs from 'fs';
import path from 'path';

interface Channel {
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

async function main() {
  console.log('Fetching all Indian TV channels from iptv-org/countries/in.m3u...');

  const res = await fetch('https://iptv-org.github.io/iptv/countries/in.m3u');
  if (!res.ok) {
    throw new Error(`Failed to fetch in.m3u: ${res.status}`);
  }

  const text = await res.text();
  const lines = text.split('\n');

  console.log(`Fetched ${lines.length} lines from India playlist.`);

  const dbPath = path.resolve(process.cwd(), 'data/db.json');
  let currentDb: any = { channels: [], categories: [] };
  if (fs.existsSync(dbPath)) {
    try {
      currentDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    } catch (e) {
      console.warn('Could not read existing db.json');
    }
  }

  const existingChannels: Channel[] = currentDb.channels || [];
  const existingUrls = new Set(existingChannels.map((c) => c.streamUrl.trim()));
  const existingNames = new Set(existingChannels.map((c) => c.name.toLowerCase().trim()));

  const newIndianChannels: Channel[] = [];
  let curInfo: {
    name: string;
    logo: string;
    group: string;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const lastComma = line.lastIndexOf(',');
      const name = lastComma !== -1 ? line.substring(lastComma + 1).trim() : 'Indian Channel';
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);

      curInfo = {
        name,
        logo: logoMatch ? logoMatch[1] : '',
        group: groupMatch ? groupMatch[1] : 'General',
      };
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      if (curInfo) {
        const streamUrl = line.trim();
        const normUrl = streamUrl.toLowerCase();

        const isValidFormat =
          normUrl.includes('.m3u8') ||
          normUrl.includes('.mp4') ||
          normUrl.includes('stream') ||
          normUrl.includes('live') ||
          normUrl.includes('playlist');

        if (isValidFormat && !existingUrls.has(streamUrl) && !existingNames.has(curInfo.name.toLowerCase())) {
          existingUrls.add(streamUrl);
          existingNames.add(curInfo.name.toLowerCase());

          // Language detection from name
          let lang = 'Hindi';
          const lowerName = curInfo.name.toLowerCase();
          if (lowerName.includes('bengali') || lowerName.includes('bangla')) lang = 'Bengali';
          else if (lowerName.includes('tamil')) lang = 'Tamil';
          else if (lowerName.includes('telugu')) lang = 'Telugu';
          else if (lowerName.includes('punjabi')) lang = 'Punjabi';
          else if (lowerName.includes('malayalam')) lang = 'Malayalam';
          else if (lowerName.includes('kannada')) lang = 'Kannada';
          else if (lowerName.includes('marathi')) lang = 'Marathi';
          else if (lowerName.includes('gujarati')) lang = 'Gujarati';
          else if (lowerName.includes('english')) lang = 'English';

          // Category classification
          const g = curInfo.group.toLowerCase();
          let catId = 'indian-tv';
          let catName = 'Indian TV';

          if (g.includes('sport') || g.includes('cricket') || lowerName.includes('sport') || lowerName.includes('cricket')) {
            catId = 'sports';
            catName = 'Sports';
          } else if (g.includes('news') || lowerName.includes('news') || lowerName.includes('samachar') || lowerName.includes('khabar')) {
            catId = 'news';
            catName = 'News';
          } else if (g.includes('music') || lowerName.includes('music') || lowerName.includes('gana') || lowerName.includes('jalwa') || lowerName.includes('9xm')) {
            catId = 'music';
            catName = 'Music';
          } else if (g.includes('movie') || lowerName.includes('cinema') || lowerName.includes('movies') || lowerName.includes('talkies')) {
            catId = 'movies';
            catName = 'Movies';
          } else if (g.includes('kid') || lowerName.includes('kids') || lowerName.includes('cartoon')) {
            catId = 'kids';
            catName = 'Kids & Family';
          } else if (g.includes('religious') || lowerName.includes('aastha') || lowerName.includes('bhajan') || lowerName.includes('satsang') || lowerName.includes('shanti')) {
            catId = 'regional-tv';
            catName = 'Regional TV';
          } else {
            catId = 'indian-tv';
            catName = 'Indian TV';
          }

          const cleanSlug = curInfo.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 40);
          const channelId = `ch-in-${cleanSlug || 'live'}-${Math.random().toString(36).substring(2, 7)}`;

          newIndianChannels.push({
            id: channelId,
            name: curInfo.name,
            nepaliName: '',
            logoUrl: curInfo.logo || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=160&h=160&fit=crop&q=80',
            streamUrl,
            streamType: streamUrl.includes('.mp4') ? 'mp4' : 'hls',
            categoryId: catId,
            categoryName: catName,
            country: 'India',
            countryCode: 'IN',
            language: lang,
            description: `${curInfo.name} live television broadcast from India. Audio in ${lang}. Available via open-source IPTV.`,
            isActive: true,
            isPublished: true,
            isFeatured: false,
            priority: 50 + newIndianChannels.length,
            sourceType: 'iptv-org',
            verificationStatus: 'untested',
          });
        }
      }
      curInfo = null;
    }
  }

  console.log(`Parsed ${newIndianChannels.length} new unique Indian channels from iptv-org in.m3u.`);

  // Prioritize top popular Indian channels (Aaj Tak, ABP, 9XM, NDTV, DD Sports, etc.)
  const topPriorityKeywords = ['aaj tak', 'abp', 'ndtv', '9xm', 'dd sports', 'dd national', 'india tv', 'news18', 'republic', 'zee news', 'jalwa', 'zing', 'mastiii', '&tv'];
  newIndianChannels.sort((a, b) => {
    const aTop = topPriorityKeywords.some((k) => a.name.toLowerCase().includes(k));
    const bTop = topPriorityKeywords.some((k) => b.name.toLowerCase().includes(k));
    if (aTop && !bTop) return -1;
    if (!aTop && bTop) return 1;
    return a.name.localeCompare(b.name);
  });

  // Reassign priorities
  newIndianChannels.forEach((ch, idx) => {
    ch.priority = 25 + idx;
  });

  // Merge into database: Keep the 18 verified base channels at the very top, then the new Indian channels, then the rest
  const verifiedSeeds = existingChannels.slice(0, 18);
  const remainingChannels = existingChannels.slice(18);

  const mergedChannels = [...verifiedSeeds, ...newIndianChannels, ...remainingChannels];
  console.log(`Total channels after adding Indian channels: ${mergedChannels.length}`);

  // Ensure Indian TV category is added to categories
  const categories = [
    { id: 'nepali-tv', name: 'Nepali TV', nepaliName: 'नेपाली टिभी', slug: 'nepali-tv', icon: 'Tv', isActive: true, displayOrder: 1 },
    { id: 'indian-tv', name: 'Indian TV', nepaliName: 'भारतीय टिभी', slug: 'indian-tv', icon: 'Radio', isActive: true, displayOrder: 2 },
    { id: 'sports', name: 'Sports', nepaliName: 'खेलकुद', slug: 'sports', icon: 'Trophy', isActive: true, displayOrder: 3 },
    { id: 'news', name: 'News', nepaliName: 'समाचार', slug: 'news', icon: 'Radio', isActive: true, displayOrder: 4 },
    { id: 'movies', name: 'Movies', nepaliName: 'चलचित्र', slug: 'movies', icon: 'Film', isActive: true, displayOrder: 5 },
    { id: 'entertainment', name: 'Entertainment', nepaliName: 'मनोरञ्जन', slug: 'entertainment', icon: 'Sparkles', isActive: true, displayOrder: 6 },
    { id: 'music', name: 'Music', nepaliName: 'संगीत', slug: 'music', icon: 'Music', isActive: true, displayOrder: 7 },
    { id: 'documentary', name: 'Documentary', nepaliName: 'वृत्तचित्र', slug: 'documentary', icon: 'Layers', isActive: true, displayOrder: 8 },
    { id: 'kids', name: 'Kids & Family', nepaliName: 'बालबालिका', slug: 'kids', icon: 'Heart', isActive: true, displayOrder: 9 },
    { id: 'regional-tv', name: 'Regional TV', nepaliName: 'क्षेत्रीय टिभी', slug: 'regional-tv', icon: 'Compass', isActive: true, displayOrder: 10 },
    { id: 'international', name: 'International', nepaliName: 'अन्तर्राष्ट्रिय', slug: 'international', icon: 'Globe', isActive: true, displayOrder: 11 },
  ];

  const updatedDb = {
    ...currentDb,
    channels: mergedChannels,
    categories,
  };

  fs.writeFileSync(dbPath, JSON.stringify(updatedDb, null, 2), 'utf-8');
  console.log(`Successfully written ${mergedChannels.length} channels with Indian channels into ${dbPath}!`);
}

main().catch(console.error);
