import React, { useState } from 'react';
import { FeaturedEvent } from '../../types/index.ts';
import { getEligibleFeaturedEvents, formatEventTime } from '../../utils/events.ts';
import { Play, Calendar, Radio } from 'lucide-react';

interface FeaturedEventHeroProps {
  events: FeaturedEvent[];
  onWatchEvent: (event: FeaturedEvent) => void;
}

export const FeaturedEventHero: React.FC<FeaturedEventHeroProps> = ({
  events,
  onWatchEvent,
}) => {
  const eligibleEvents = getEligibleFeaturedEvents(events);
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (eligibleEvents.length === 0) {
    return null;
  }

  const activeEvent = eligibleEvents[selectedIndex] || eligibleEvents[0];
  const secondaryEvents = eligibleEvents.slice(0, 4);

  return (
    <section aria-label="Featured Broadcast Event" className="space-y-4">
      {/* Main Priority Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800/90 shadow-2xl min-h-[340px] sm:min-h-[400px] flex flex-col justify-end">
        {/* Background Image with Studio Scrim Overlay */}
        {activeEvent.bannerUrl && (
          <img
            src={activeEvent.bannerUrl}
            alt={activeEvent.title}
            className="absolute inset-0 w-full h-full object-cover object-center opacity-50 transition-transform duration-700"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D11] via-[#0B0D11]/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0D11] via-[#0B0D11]/60 to-transparent" />

        {/* Content Foreground */}
        <div className="relative z-10 p-6 sm:p-10 max-w-3xl space-y-4">
          {/* Unboxed Typographic Broadcast Metadata Row */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-wider uppercase">
            {activeEvent.status === 'LIVE' ? (
              <span className="inline-flex items-center gap-1.5 text-red-400 font-bold">
                <Radio className="w-3.5 h-3.5 text-red-500" />
                <span>LIVE BROADCAST</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
                <Calendar className="w-3.5 h-3.5" />
                <span>{activeEvent.status}</span>
              </span>
            )}

            <span className="text-neutral-600">·</span>
            <span className="text-neutral-300 font-mono">
              Priority #{activeEvent.priority}
            </span>

            {activeEvent.channelName && (
              <>
                <span className="text-neutral-600">·</span>
                <span className="text-neutral-200">{activeEvent.channelName}</span>
              </>
            )}
          </div>

          {/* Event Title & Nepali Subtitle */}
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              {activeEvent.title}
            </h1>
            {activeEvent.nepaliTitle && (
              <p className="text-base sm:text-lg font-medium text-red-400/95">
                {activeEvent.nepaliTitle}
              </p>
            )}
          </div>

          <p className="text-sm sm:text-base text-neutral-200 font-medium">
            {activeEvent.subtitle}
          </p>

          {activeEvent.description && (
            <p className="text-xs sm:text-sm text-neutral-400 line-clamp-2 max-w-2xl leading-relaxed">
              {activeEvent.description}
            </p>
          )}

          {/* Action CTA & Schedule Info */}
          <div className="pt-2 flex flex-wrap items-center gap-5">
            <button
              onClick={() => onWatchEvent(activeEvent)}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm shadow-lg shadow-red-950/60 transition-all cursor-pointer active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{activeEvent.buttonLabel || 'Watch Live Now'}</span>
            </button>

            <div className="text-xs text-neutral-400 font-mono">
              <span>{formatEventTime(activeEvent.startTime)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Priority Event Switcher Strip (if multiple active events exist) */}
      {secondaryEvents.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {secondaryEvents.map((ev, idx) => {
            const isSelected = ev.id === activeEvent.id;
            return (
              <button
                key={ev.id}
                onClick={() => setSelectedIndex(idx)}
                className={`flex items-center gap-3.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-neutral-800/90 border-red-500/70 shadow-sm'
                    : 'bg-[#13151b] hover:bg-neutral-900 border-neutral-800/80 opacity-85 hover:opacity-100'
                }`}
              >
                <div className="w-16 h-11 rounded-lg overflow-hidden bg-neutral-950 shrink-0 relative border border-neutral-800">
                  {ev.thumbnailUrl ? (
                    <img
                      src={ev.thumbnailUrl}
                      alt={ev.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600">
                      <Radio className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider">
                    <span
                      className={
                        ev.status === 'LIVE' ? 'text-red-400 font-bold' : 'text-amber-400 font-semibold'
                      }
                    >
                      {ev.status}
                    </span>
                    <span className="text-neutral-600">·</span>
                    <span className="text-neutral-400 truncate">{ev.channelName}</span>
                  </div>
                  <p className="text-xs font-semibold text-white truncate mt-0.5">{ev.title}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
