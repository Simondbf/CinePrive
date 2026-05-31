import React, { useEffect, useRef, useState } from 'react';
import { notify } from '../lib/notify';
import { Film, User } from '../types';
import { ArrowLeft, Play, Pause, Maximize, Volume2, VolumeX, Download, Settings, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  film: Film;
  activeUser: User;
  onClose: () => void;
}

export default function Player({ film, activeUser, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showCast, setShowCast] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
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

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying && !showCast) setShowControls(false);
    }, 3000);
  };

  const togglePlay = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!videoRef.current) return;
      
      if (videoRef.current.paused) {
          videoRef.current.play();
          setIsPlaying(true);
      } else {
          videoRef.current.pause();
          setIsPlaying(false);
      }
      resetControlsTimeout();
  };

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
          document.documentElement.requestFullscreen().catch(e => console.error(e));
      } else {
          if (document.exitFullscreen) {
              document.exitFullscreen();
          }
      }
      resetControlsTimeout();
  };

  return (
    <div 
        className="fixed inset-0 bg-black z-50 flex items-center justify-center cursor-default select-none"
        onMouseMove={resetControlsTimeout}
        onClick={togglePlay}
    >
        {/* Real video player pointing to the Express static /videos route */}
        <video 
            ref={videoRef}
            src={`/videos/${film.filename}`}
            className="w-full h-full object-contain"
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
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
                            <div className="flex items-center gap-4 text-white">
                                <button className="hover:text-gold-500 transition-colors p-2" title="Sous-titres & Audio (Bientôt disponible sur serveur complet)" onClick={() => notify("Le multiplexage (Sous-titres & multi-audio) nécessite un transcodage côté serveur (via FFmpeg comme sur Jellyfin complet). Dans ce prototype, seul le flux par défaut est streamé.", "Information Technique")}>
                                    <Settings className="w-5 h-5" />
                                </button>
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
                                    href={`/videos/${film.filename}`} 
                                    download={film.originalName} 
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

                        <div className="w-full h-1 bg-zinc-600 rounded cursor-pointer mb-4 hover:h-2 transition-all">
                            {/* Dummy progress bar to show intent */}
                            <div className="h-full bg-gold-500 w-[15%] rounded relative">
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-gold-500 rounded-full shadow" />
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
