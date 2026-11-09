import React from 'react';
import { Tv, Shield, ExternalLink, Globe } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: string, param?: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="mt-16 border-t border-neutral-800 bg-[#0d0e11] text-neutral-400 text-xs py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-red-600 flex items-center justify-center text-white">
                <Tv className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-bold text-white tracking-tight">तपाईंको TV</span>
              <span className="text-neutral-500">·</span>
              <span className="text-neutral-400">Your Television, Everywhere</span>
            </div>
            <p className="text-neutral-400 max-w-xl text-[13px] leading-relaxed">
              A minimalist, open live television discovery portal delivering legal, publicly available broadcast feeds.
              Viewers enjoy seamless viewing with zero registration or sign-in friction.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <button
              onClick={() => onNavigate('home')}
              className="hover:text-white transition-colors"
            >
              Home
            </button>
            <span className="text-neutral-700">·</span>
            <button
              onClick={() => onNavigate('channels')}
              className="hover:text-white transition-colors"
            >
              All Channels
            </button>
            <span className="text-neutral-700">·</span>
            <button
              onClick={() => onNavigate('favorites')}
              className="hover:text-white transition-colors"
            >
              Favorites
            </button>
            <span className="text-neutral-700">·</span>
            <button
              onClick={() => onNavigate('admin')}
              className="flex items-center gap-1 hover:text-white transition-colors text-neutral-400"
            >
              <Shield className="w-3 h-3" />
              <span>Admin Login</span>
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-neutral-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[11px] text-neutral-500">
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-neutral-400" />
            <span>Timezone: Nepal Time (Asia/Kathmandu · UTC+05:45)</span>
          </div>
          <p>
            Streams are hosted by their respective broadcasters and public content repositories.
            No content is hosted or redistributed unlawfully.
          </p>
        </div>
      </div>
    </footer>
  );
};
