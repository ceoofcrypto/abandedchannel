import React, { useState } from 'react';
import { Channel } from '../../types/index.ts';
import { getCountryFlag } from '../../data/countries.ts';
import { sanitizeLogoUrl, getChannelMonogram } from '../../utils/channels.ts';
import { Play, Star, CheckCircle2 } from 'lucide-react';

interface ChannelCardProps {
  channel: Channel;
  isFavorite: boolean;
  onToggleFavorite: (channelId: string) => void;
  onSelectChannel: (channel: Channel) => void;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  isFavorite,
  onToggleFavorite,
  onSelectChannel,
}) => {
  const [imgError, setImgError] = useState(false);
  const countryFlag = getCountryFlag(channel.countryCode || channel.country);
  const cleanLogo = sanitizeLogoUrl(channel.logoUrl);
  const { initials, paletteClass } = getChannelMonogram(channel.name);

  return (
    <div
      onClick={() => onSelectChannel(channel)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectChannel(channel);
        }
      }}
      className="group relative rounded-xl bg-[#13151b] hover:bg-[#191c24] border border-neutral-800/80 hover:border-neutral-700 transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 shadow-sm hover:shadow-xl"
    >
      {/* Top Row: Broadcast Logo / Callsign Badge & Favorite Button */}
      <div className="flex items-start justify-between gap-2 mb-3.5">
        <div
          className={`w-12 h-12 rounded-xl border flex items-center justify-center overflow-hidden shrink-0 ${
            cleanLogo && !imgError
              ? 'bg-neutral-900 border-neutral-800'
              : `bg-gradient-to-br ${paletteClass}`
          }`}
        >
          {cleanLogo && !imgError ? (
            <img
              src={cleanLogo}
              alt={channel.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <span className="text-sm font-extrabold tracking-wider font-mono select-none">
              {initials}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {channel.verificationStatus === 'verified' && (
            <span
              title="Verified Live Stream"
              className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-emerald-400/90"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>LIVE</span>
            </span>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(channel.id);
            }}
            aria-label={
              isFavorite ? `Remove ${channel.name} from favorites` : `Add ${channel.name} to favorites`
            }
            className="p-1.5 rounded-lg text-neutral-500 hover:text-amber-400 hover:bg-neutral-800/80 transition-colors cursor-pointer"
          >
            <Star
              className={`w-4 h-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Middle: Channel Name & Nepali Title */}
      <div className="space-y-0.5 mb-3">
        <h3 className="text-sm font-semibold text-white group-hover:text-red-400 transition-colors line-clamp-1">
          {channel.name}
        </h3>
        {channel.nepaliName ? (
          <p className="text-xs text-neutral-400 line-clamp-1">{channel.nepaliName}</p>
        ) : (
          <p className="text-xs text-neutral-500 line-clamp-1">{channel.description}</p>
        )}
      </div>

      {/* Bottom: Unboxed Typographic Metadata & Watch Indicator */}
      <div className="flex items-center justify-between pt-2.5 border-t border-neutral-800/60 text-[11px] text-neutral-400">
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-neutral-300 font-medium truncate">{channel.categoryName}</span>
          <span className="text-neutral-600">·</span>
          <span className="inline-flex items-center gap-1 truncate text-neutral-400">
            <span>{countryFlag}</span>
            <span className="truncate">{channel.country}</span>
          </span>
        </div>

        <span className="inline-flex items-center gap-1 text-neutral-400 group-hover:text-red-400 font-semibold transition-colors shrink-0 ml-2">
          <Play className="w-3 h-3 fill-current" />
          <span className="text-[11px]">Watch</span>
        </span>
      </div>
    </div>
  );
};
