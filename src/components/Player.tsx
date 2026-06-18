import React, { useEffect, useRef, useState, useCallback } from 'react';
import { notify } from '../lib/notify';
import { Film, User } from '../types';
import { ArrowLeft, Play, Pause, Maximize, Volume2, VolumeX, Download, Settings, Users, Subtitles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  film: Film;
  activeUser: User;
  onClose: () => void;
}

export default function Player({ film, activeUser, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showCast, setShowCast] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [playbackError, setPlaybackError] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (seconds: number): string => {
      if (isNaN(seconds) || seconds === Infinity) return '0:00';
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);

      if (hrs > 0) {
          return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isMkv = film.filename?.toLowerCase().endsWith('.mkv') || film.originalName?.toLowerCase().endsWith('.mkv');

  useEffect(() => {
    if (isMkv) {
        notify("L'écran risque de rester noir.\n\nLes navigateurs Web ne supportent pas nativement le format .MKV. Téléchargez le fichier pour le lire avec VLC.", "Format Vidéo Incompatible");
    }

    if (videoRef.current) {
        // Fetch progress
        fetch(`/api/progress/${activeUser.id}/${film.id}`)
            .then(r => r.json())
            .then(data => {
                if (videoRef.current && data.time > 0) {
                    videoRef.current.currentTime = data.time;
                }
                videoRef.current?.play().catch(e => console.error("Auto-play prevented", e));
                setIsPlaying(true);
            })
            .catch(console.error);
    }

    // Save progress periodically
    const interval = setInterval(() => {
        if (videoRef.current && !videoRef.current.paused) {
            fetch('/api/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: activeUser.id, filmId: film.id, time: videoRef.current.currentTime })
            }).catch(console.error);
        }
    }, 10000); // save every 10 seconds

    return () => {
        clearInterval(interval);
        if (videoRef.current) {
            fetch('/api/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: activeUser.id, filmId: film.id, time: videoRef.current.currentTime }),
                keepalive: true
            }).catch(console.error);
        }
    };
  }, [activeUser.id, film.id]);

  const isPlayingRef = useRef(false);

  useEffect(() => {
      isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
        if (isPlayingRef.current && !showCast) setShowControls(false);
    }, 3000);
  }, [showCast]);

  const togglePlay = useCallback((e?: React.MouseEvent | KeyboardEvent) => {
      e?.stopPropagation();
      e?.preventDefault();
      
      // Prevent focus-triggered double calls if spacebar was pressed while a button was focused
      if (document.activeElement instanceof HTMLElement && e?.type === 'keydown') {
          document.activeElement.blur();
      }

      if (!videoRef.current) return;
      
      if (videoRef.current.paused) {
          videoRef.current.play().then(() => {
              setIsPlaying(true);
          }).catch((err) => {
              console.error(err);
              setIsPlaying(false);
          });
      } else {
          videoRef.current.pause();
          setIsPlaying(false);
      }
      resetControlsTimeout();
  }, [resetControlsTimeout]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Verify typing in inputs isn't caught
          if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
          
          if (e.code === 'Space') {
              e.preventDefault();
              togglePlay(e);
          }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);

  const toggleMute = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!videoRef.current) return;
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
      resetControlsTimeout();
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!document.fullscreenElement) {
          containerRef.current?.requestFullscreen().catch(e => console.error(e));
      } else {
          if (document.exitFullscreen) {
              document.exitFullscreen();
          }
      }
      resetControlsTimeout();
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (!videoRef.current || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const newTime = (clickX / width) * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
  };

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);

  return (
    <div 
        ref={containerRef}
        className="fixed inset-0 bg-black z-50 flex items-center justify-center cursor-default select-none group"
        onMouseMove={resetControlsTimeout}
        onClick={togglePlay}
    >
        {playbackError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-zinc-950/80 z-20 space-y-4">
                <Settings className="w-16 h-16 text-zinc-500 mb-4 animate-pulse" />
                <h2 className="text-xl font-bold">Erreur de lecture</h2>
                <p className="text-zinc-400 text-center max-w-lg px-4">
                    Ce format n'est pas supporté par votre navigateur actuel ou la conversion a échoué.
                </p>
                <div className="flex gap-4">
                    <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition">
                        Retour
                    </button>
                    {!film.jellyfinId && (
                        <button onClick={(e) => { 
                            e.stopPropagation();
                            fetch(`/api/films/${film.id}/remux`, { method: 'POST' })
                              .then(() => notify("Une demande de conversion en MP4 a été envoyée au serveur. Revenez plus tard.", "Conversion en cours"))
                              .catch(() => notify("Erreur de connexion", "Erreur"));
                        }} className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition text-white">
                            Convertir en MP4 (Serveur)
                        </button>
                    )}
                </div>
            </div>
        )}

        {/* Real video player pointing to the Express static /videos route or secure Jellyfin proxy stream */}
        <video 
            ref={videoRef}
            src={film.jellyfinId ? `/api/stream/${film.jellyfinId}` : `/videos/${film.filename}`}
            className="w-full h-full object-contain"
            onError={() => {
                setPlaybackError(true);
                notify("Le format de ce fichier n'est pas pris en charge par votre navigateur, ou le fichier est en cours de traitement vidéo.", "Erreur de Lecture");
            }}
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={() => {
                if (videoRef.current) {
                    setCurrentTime(videoRef.current.currentTime);
                }
            }}
            onDurationChange={() => {
                if (videoRef.current) {
                    setDuration(videoRef.current.duration);
                }
            }}
            onLoadedMetadata={() => {
                if (videoRef.current) {
                    setDuration(videoRef.current.duration);
                }
            }}
        >
            Votre navigateur ne supporte pas la balise vidéo.
        </video>

        {/* UI Overlay */}
        <AnimatePresence>
            {showControls && (
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 flex flex-col justify-between p-6 pointer-events-auto"
                >
                    {/* Top Bar */}
                    <div className="flex items-center justify-between">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onClose(); }} 
                            className="text-white flex items-center gap-2 hover:opacity-80 transition-opacity p-2"
                        >
                            <ArrowLeft className="w-8 h-8" />
                            <span className="text-xl font-medium">Retour</span>
                        </button>
                    </div>

                    {/* Bottom Controls */}
                    <div className="w-full max-w-7xl mx-auto mb-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-6 text-white text-shadow-md">
                                <h2 className="text-2xl font-bold font-sans drop-shadow-md">{film.title}</h2>
                                {film.director && <span className="text-sm text-zinc-300">Réal: {film.director}</span>}
                            </div>
                            
                            {/* Top Right Action tools */}
                            <div className="flex items-center gap-4 text-white relative">
                                <button className="hover:text-gold-500 transition-colors p-2" title="Sous-titres & Audio" onClick={(e) => { e.stopPropagation(); notify("Les options de sous-titres et langues seront gérées intelligemment par le transcodage de votre VPS cible (nécessite Jellyfin complet ou FFmpeg exhaustif).", "Sous-titres & Audio"); }}>
                                    <Subtitles className="w-5 h-5" />
                                </button>
                                <button className={`transition-colors p-2 rounded ${showSettings ? 'bg-zinc-800 text-gold-500' : 'hover:text-gold-500'}`} title="Paramètres" onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}>
                                    <Settings className="w-5 h-5" />
                                </button>
                                {showSettings && (
                                    <div className="absolute bottom-full right-16 mb-2 bg-zinc-900 border border-zinc-800 rounded-lg p-2 shadow-2xl z-50 w-48 text-sm">
                                        <div className="text-zinc-400 font-medium px-2 py-1 mb-1 shadow-sm border-b border-zinc-800">Vitesse de lecture</div>
                                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                                            <button 
                                                key={rate} 
                                                onClick={(e) => { e.stopPropagation(); setPlaybackRate(rate); setShowSettings(false); }}
                                                className={`w-full text-left px-3 py-2 rounded transition-colors ${playbackRate === rate ? 'bg-gold-500/20 text-gold-400' : 'hover:bg-zinc-800 text-white'}`}
                                            >
                                                {rate}x {rate === 1 && '(Normal)'}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {film.cast && film.cast.length > 0 && (
                                    <button 
                                        onClick={() => setShowCast(!showCast)} 
                                        className={`p-2 transition-colors rounded ${showCast ? 'bg-gold-500 text-black' : 'hover:text-gold-500'}`}
                                        title="Voir le casting (TMDB)"
                                    >
                                        <Users className="w-5 h-5" />
                                    </button>
                                )}
                                <a 
                                    href={`/api/download/${film.id}`} 
                                    download={film.originalName || film.title} 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const key = `downloads_${activeUser.id}`;
                                        const stored = JSON.parse(localStorage.getItem(key) || '[]');
                                        if (!stored.includes(film.id)) {
                                            localStorage.setItem(key, JSON.stringify([...stored, film.id]));
                                        }
                                        notify("Le fichier source est en cours de téléchargement.\n\nNote Technique : Sur ce prototype (sans transcoding FFmpeg), la taille du fichier est la taille d'origine du fichier uploadé.\nSur le serveur complet avec Jellyfin, un transcodage compressé pourra être proposé pour les mobiles.", "Mode Hors-Ligne");
                                    }} 
                                    title="Télécharger pour visionnage hors-ligne" 
                                    className="hover:text-gold-500 transition-colors p-2 bg-white/10 rounded-full"
                                >
                                    <Download className="w-5 h-5" />
                                </a>
                            </div>
                        </div>

                        {showCast && film.cast && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-6 flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-500"
                            >
                                {film.cast.map(actor => (
                                    <div key={actor.name} className="flex flex-col items-center gap-2 w-24 shrink-0">
                                        <div className="w-16 h-16 rounded-full overflow-hidden bg-zinc-800 border-2 border-zinc-700 shadow-md">
                                            {actor.profilePath ? (
                                                <img src={actor.profilePath} alt={actor.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">?</div>
                                            )}
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-white font-medium line-clamp-1">{actor.name}</p>
                                            <p className="text-[10px] text-zinc-400 line-clamp-1">{actor.character}</p>
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        <div 
                            className="w-full h-1.5 bg-zinc-600/60 rounded-full cursor-pointer mb-4 hover:h-2 transition-all relative"
                            onClick={handleProgressClick}
                        >
                            <div 
                                className="h-full bg-gold-400 rounded-full relative"
                                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                            >
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg border-2 border-gold-400" />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <button onClick={togglePlay} className="hover:scale-110 transition-transform shadow-lg drop-shadow">
                                    {isPlaying ? <Pause className="w-8 h-8 fill-white text-white" /> : <Play className="w-8 h-8 fill-white text-white" />}
                                </button>
                                <button onClick={toggleMute} className="hover:text-gold-500 transition-colors drop-shadow">
                                    {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                                </button>
                                <span className="text-sm font-mono text-zinc-300">
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                </span>
                            </div>
                            
                            <button onClick={toggleFullscreen} className="hover:text-gold-500 transition-colors drop-shadow">
                                <Maximize className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
}
