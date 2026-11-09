import { FeaturedEvent } from '../types/index.ts';

export function getEligibleFeaturedEvents(
  events: FeaturedEvent[],
  includeEnded: boolean = false
): FeaturedEvent[] {
  if (!events || !Array.isArray(events)) return [];

  const filtered = events.filter((ev) => {
    if (!ev.isActive || !ev.isPublished) return false;
    if (!includeEnded && (ev.status === 'ENDED' || ev.status === 'CANCELLED')) {
      return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
    if (b.status === 'LIVE' && a.status !== 'LIVE') return 1;

    const timeA = new Date(a.startTime).getTime() || 0;
    const timeB = new Date(b.startTime).getTime() || 0;
    return timeA - timeB;
  });
}

export function getPrimaryFeaturedEvent(events: FeaturedEvent[]): FeaturedEvent | null {
  const eligible = getEligibleFeaturedEvents(events, false);
  return eligible.length > 0 ? eligible[0] : null;
}

export function formatNepalDateTime(isoDateString: string): string {
  try {
    const date = new Date(isoDateString);
    if (isNaN(date.getTime())) return isoDateString;

    return (
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kathmandu',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(date) + ' (NPT)'
    );
  } catch {
    return isoDateString;
  }
}

export const formatEventTime = formatNepalDateTime;
