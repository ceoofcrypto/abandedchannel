import { Channel } from '../src/types/index.ts';

interface ParsedM3UItem {
  id: string;
  name: string;
  nepaliName?: string;
  logo: string;
  url: string;
  category: string;
  country: string;
  language: string;
}

export function parseM3U(content: string, defaultCountry = 'Nepal', defaultLang = 'Nepali'): ParsedM3UItem[] {
  const items: ParsedM3UItem[] = [];
  const lines = content.split('\n');
  let currentMeta: Partial<ParsedM3UItem> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      const nameMatch = line.match(/,(.+)$/);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const groupMatch = line.match(/group-title="([^"]+)"/);
      const idMatch = line.match(/tvg-id="([^"]+)"/);

      const rawName = nameMatch ? nameMatch[1].trim() : 'Channel';
      // Clean "(1080p)", "(720p)", "[Geo-blocked]"
      const cleanName = rawName.replace(/\s*\(\d+p\)/i, '').replace(/\s*\[.*?\]/g, '').trim();

      currentMeta = {
        id: idMatch ? idMatch[1].toLowerCase().replace(/[^a-z0-9_-]/g, '-') : 'iptv-' + Math.random().toString(36).substring(2, 8),
        name: cleanName,
        logo: logoMatch ? logoMatch[1] : '',
        category: groupMatch ? groupMatch[1].split(';')[0].trim() : 'General',
        country: defaultCountry,
        language: defaultLang,
      };
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      if (currentMeta && currentMeta.name) {
        items.push({
          id: currentMeta.id || 'ch-' + items.length,
          name: currentMeta.name,
          logo: currentMeta.logo || '',
          url: line,
          category: currentMeta.category || 'General',
          country: currentMeta.country || defaultCountry,
          language: currentMeta.language || defaultLang,
        });
      }
      currentMeta = null;
    }
  }

  return items;
}

export async function testStreamPlayability(url: string, timeoutMs = 4000): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) return false;
    const textSample = await res.text().catch(() => '');
    return textSample.includes('#EXTM3U') || textSample.includes('#EXTINF') || textSample.length > 50;
  } catch {
    return false;
  }
}
