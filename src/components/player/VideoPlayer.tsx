import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Channel, StreamQualityLevel } from '../../types/index.ts';
import {
  detectStreamType,
  getFriendlyStreamError,
  calculateBackoffDelay,
  getProxiedStreamUrl,
  shouldPreferStreamProxy,
} from '../../utils/streaming.ts';
import { sanitizeLogoUrl, getChannelMonogram } from '../../utils/channels.ts';
import { reportBrokenChannel } from '../../services/api.ts';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RefreshCw,
  Settings,
  Share2,
  Star,
  Check,
  AlertTriangle,
  Radio,
  ArrowLeft,
  PictureInPicture,
  SkipForward,
} from 'lucide-react';

interface VideoPlayerProps {
  channel: Channel;
  streamUrlOverride?: string | null;
  onBack: () => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  relatedChannels: Channel[];
  onSelectChannel: (channel: Channel) => void;
  onChannelBroken?: (channelId: string) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  streamUrlOverride,
  onBack,
  isFavorite,
  onToggleFavorite,
  relatedChannels,
  onSelectChannel,
  onChannelBroken,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const usingProxyRef = useRef<boolean>(false);
  const reportedBrokenRef = useRef<boolean>(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [availableQualities, setAvailableQualities] = useState<StreamQualityLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const effectiveStreamUrl = streamUrlOverride || channel.streamUrl;
  const streamFormat = detectStreamType(effectiveStreamUrl);
  const cleanLogo = sanitizeLogoUrl(channel.logoUrl);
  const { initials, paletteClass } = getChannelMonogram(channel.name);

  const nextAvailableChannel = relatedChannels.find(
    (c) => c.id !== channel.id && c.isActive && c.verificationStatus !== 'failing'
  );

  const cleanupPlayer = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
  }, []);

  const handleFatalStreamFailure = useCallback(
    (friendlyMessage: string) => {
      setErrorDetails(friendlyMessage);
      setIsLoading(false);
      cleanupPlayer();

      if (!streamUrlOverride && !reportedBrokenRef.current) {
        reportedBrokenRef.current = true;
        reportBrokenChannel(channel.id)
          .then((res) => {
            if (res.deactivated && onChannelBroken) {
              onChannelBroken(channel.id);
            }
          })
          .catch(() => {
            // Ignore background reporting errors
          });
      }
    },
    [channel.id, streamUrlOverride, cleanupPlayer, onChannelBroken]
  );

  const loadStream = useCallback(
    (forceProxy: boolean = false) => {
      cleanupPlayer();
      setErrorDetails(null);
      setIsLoading(true);

      const video = videoRef.current;
      if (!video || !effectiveStreamUrl) return;

      video.muted = isMuted;

      const useProxy = forceProxy || usingProxyRef.current || shouldPreferStreamProxy(effectiveStreamUrl);
      usingProxyRef.current = useProxy;
      const sourceToLoad = useProxy ? getProxiedStreamUrl(effectiveStreamUrl) : effectiveStreamUrl;

      if (streamFormat === 'hls') {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 30,
            manifestLoadingTimeOut: 10000,
            manifestLoadingMaxRetry: 1,
            levelLoadingTimeOut: 10000,
            levelLoadingMaxRetry: 1,
          });

          hlsRef.current = hls;
          hls.loadSource(sourceToLoad);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
            setIsLoading(false);
            setErrorDetails(null);
            retryCountRef.current = 0;
            const levels: StreamQualityLevel[] = data.levels.map((lvl, index) => ({
              id: index,
              height: lvl.height,
              width: lvl.width,
              bitrate: lvl.bitrate,
              label: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)}k`,
            }));
            setAvailableQualities(levels);

            video.play().catch(() => {
              video.muted = true;
              setIsMuted(true);
              video.play().catch(() => setIsPlaying(false));
            });
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
            setSelectedQuality(hls.autoLevelEnabled ? -1 : data.level);
          });

          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  if (!usingProxyRef.current) {
                    usingProxyRef.current = true;
                    retryCountRef.current = 0;
                    loadStream(true);
                    return;
                  }

                  if (retryCountRef.current < 1) {
                    const nextAttempt = retryCountRef.current + 1;
                    retryCountRef.current = nextAttempt;
                    const delay = calculateBackoffDelay(nextAttempt);
                    retryTimeoutRef.current = setTimeout(() => {
                      if (hlsRef.current) {
                        hlsRef.current.startLoad();
                      } else {
                        loadStream(usingProxyRef.current);
                      }
                    }, delay);
                  } else {
                    handleFatalStreamFailure(getFriendlyStreamError('network', data.details));
                  }
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  handleFatalStreamFailure(getFriendlyStreamError(data.type, data.details));
                  break;
              }
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = sourceToLoad;
          video.addEventListener('loadedmetadata', () => {
            setIsLoading(false);
            video.play().catch(() => {
              video.muted = true;
              setIsMuted(true);
              video.play().catch(() => setIsPlaying(false));
            });
          });
          video.addEventListener('error', () => {
            if (!usingProxyRef.current) {
              usingProxyRef.current = true;
              loadStream(true);
            } else {
              handleFatalStreamFailure('Native player encountered a playback error for this stream.');
            }
          });
        } else {
          handleFatalStreamFailure('HLS playback is not supported by your current browser.');
        }
      } else {
        video.src = sourceToLoad;
        video.onloadeddata = () => {
          setIsLoading(false);
          video.play().catch(() => {
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => setIsPlaying(false));
          });
        };
        video.onerror = () => {
          handleFatalStreamFailure('Direct video source could not be played.');
        };
      }
    },
    [effectiveStreamUrl, streamFormat, isMuted, cleanupPlayer, handleFatalStreamFailure]
  );

  useEffect(() => {
    retryCountRef.current = 0;
    usingProxyRef.current = false;
    reportedBrokenRef.current = false;
    loadStream(false);
    return () => cleanupPlayer();
  }, [channel.id, effectiveStreamUrl, loadStream, cleanupPlayer]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
    if (!newMuted && videoRef.current.volume === 0) {
      videoRef.current.volume = 0.8;
      setVolume(0.8);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newVol = parseFloat(e.target.value);
    videoRef.current.volume = newVol;
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handlePictureInPicture = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch {
      // Ignore PiP unsupported
    }
  };

  const handleSelectQuality = (levelId: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelId;
    setSelectedQuality(levelId);
    setQualityMenuOpen(false);
  };

  const handleCopyLink = () => {
    const url = window.location.origin + `?channel=${channel.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3500);
  };

  return (
    <div className="space-y-6">
      {/* Top navigation & actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Channels</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            aria-label="Share channel link"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Link Copied!' : 'Share'}</span>
          </button>

          <button
            onClick={() => onToggleFavorite(channel.id)}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <Star className={`w-3.5 h-3.5 ${isFavorite ? 'text-amber-400 fill-amber-400' : 'text-neutral-500'}`} />
            <span>{isFavorite ? 'Saved' : 'Favorite'}</span>
          </button>
        </div>
      </div>

      {/* Video Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        className="relative aspect-video w-full rounded-2xl bg-black overflow-hidden shadow-2xl border border-neutral-800 group"
      >
        <video
          ref={videoRef}
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => setIsLoading(false)}
          onClick={handlePlayPause}
          className="w-full h-full object-contain cursor-pointer"
        />

        {/* Loading Overlay */}
        {isLoading && !errorDetails && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 pointer-events-none">
            <RefreshCw className="w-8 h-8 text-red-500 animate-spin mb-3" />
            <p className="text-xs font-medium text-neutral-300 tracking-wide uppercase">
              Connecting Live Broadcast...
            </p>
          </div>
        )}

        {/* Unmute Overlay Notice when autoplay muted */}
        {isMuted && isPlaying && !errorDetails && (
          <div className="absolute top-4 left-4 z-20">
            <button
              onClick={handleToggleMute}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold shadow-lg backdrop-blur-sm transition-transform active:scale-95 cursor-pointer"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Tap to Unmute</span>
            </button>
          </div>
        )}

        {/* Playback Error Overlay */}
        {errorDetails && (
          <div className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center p-6 text-center z-30">
            <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
            <h3 className="text-base font-semibold text-white mb-2">
              Stream Offline — Automatically Removed from Active Lineup
            </h3>
            <p className="text-xs text-neutral-400 max-w-md mb-5 leading-relaxed">
              {errorDetails}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {nextAvailableChannel && (
                <button
                  onClick={() => onSelectChannel(nextAvailableChannel)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Watch Next Working Channel ({nextAvailableChannel.name})</span>
                </button>
              )}
              <button
                onClick={() => {
                  retryCountRef.current = 0;
                  usingProxyRef.current = true;
                  loadStream(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Stream</span>
              </button>
              <button
                onClick={onBack}
                className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Return to Directory
              </button>
            </div>
          </div>
        )}

        {/* Custom Player Controls Bar */}
        <div
          className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 transition-opacity duration-300 flex items-center justify-between gap-4 z-20 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={handlePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            <div className="flex items-center gap-2 group/vol">
              <button
                onClick={handleToggleMute}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Volume slider"
                className="w-16 sm:w-20 accent-red-600 cursor-pointer h-1.5 rounded-lg bg-neutral-700"
              />
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-red-400 uppercase tracking-wider">
              <Radio className="w-3.5 h-3.5 text-red-500" />
              <span>LIVE</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {availableQualities.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setQualityMenuOpen(!qualityMenuOpen)}
                  aria-label="Stream quality selector"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>
                    {selectedQuality === -1 ? 'Auto' : availableQualities[selectedQuality]?.label || 'Quality'}
                  </span>
                </button>

                {qualityMenuOpen && (
                  <div className="absolute bottom-10 right-0 bg-neutral-900 border border-neutral-800 rounded-xl py-1 shadow-xl min-w-[120px] text-xs z-30">
                    <button
                      onClick={() => handleSelectQuality(-1)}
                      className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-neutral-800 ${
                        selectedQuality === -1 ? 'text-red-400 font-bold' : 'text-neutral-300'
                      }`}
                    >
                      <span>Auto</span>
                      {selectedQuality === -1 && <Check className="w-3 h-3" />}
                    </button>
                    {availableQualities.map((lvl) => (
                      <button
                        key={lvl.id}
                        onClick={() => handleSelectQuality(lvl.id)}
                        className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-neutral-800 ${
                          selectedQuality === lvl.id ? 'text-red-400 font-bold' : 'text-neutral-300'
                        }`}
                      >
                        <span>{lvl.label}</span>
                        {selectedQuality === lvl.id && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handlePictureInPicture}
              aria-label="Picture in Picture"
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <PictureInPicture className="w-4 h-4" />
            </button>

            <button
              onClick={handleToggleFullscreen}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Channel Information Details */}
      <div className="bg-[#13151b] border border-neutral-800/80 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-xl border flex items-center justify-center overflow-hidden shrink-0 ${
              cleanLogo ? 'bg-neutral-900 border-neutral-800' : `bg-gradient-to-br ${paletteClass}`
            }`}
          >
            {cleanLogo ? (
              <img
                src={cleanLogo}
                alt={channel.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain p-1.5"
              />
            ) : (
              <span className="text-lg font-extrabold font-mono tracking-wider">{initials}</span>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">{channel.name}</h2>
              {channel.nepaliName && (
                <span className="text-sm text-neutral-400 font-normal">· {channel.nepaliName}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
              <span>{channel.categoryName}</span>
              <span>·</span>
              <span>{channel.country}</span>
              <span>·</span>
              <span>Language: {channel.language}</span>
              <span>·</span>
              <span className="font-mono text-neutral-500 uppercase">{channel.streamType}</span>
            </div>
          </div>
        </div>

        {channel.description && (
          <p className="text-xs text-neutral-400 max-w-md leading-relaxed">
            {channel.description}
          </p>
        )}
      </div>

      {/* Related / Next Channels Row */}
      {relatedChannels.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            More in {channel.categoryName}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {relatedChannels
              .filter((c) => c.id !== channel.id && c.isActive && c.verificationStatus !== 'failing')
              .slice(0, 4)
              .map((rel) => {
                const relLogo = sanitizeLogoUrl(rel.logoUrl);
                const relMono = getChannelMonogram(rel.name);
                return (
                  <button
                    key={rel.id}
                    onClick={() => onSelectChannel(rel)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#13151b] hover:bg-[#191c24] border border-neutral-800 transition-colors text-left cursor-pointer"
                  >
                    <div
                      className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden ${
                        relLogo ? 'bg-neutral-900 border-neutral-800' : `bg-gradient-to-br ${relMono.paletteClass}`
                      }`}
                    >
                      {relLogo ? (
                        <img
                          src={relLogo}
                          alt={rel.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <span className="text-[11px] font-bold font-mono">{relMono.initials}</span>
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-white truncate">{rel.name}</p>
                      <p className="text-[10px] text-neutral-400 truncate">{rel.categoryName}</p>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};
