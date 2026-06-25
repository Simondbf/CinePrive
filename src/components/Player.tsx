import React, { useEffect, useRef, useState, useCallback } from 'react';
import { notify } from '../lib/notify';
import { Film, User } from '../types';
import { ArrowLeft, Settings, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Plyr } from 'plyr-react';
import 'plyr-react/plyr.css';

interface Props {
  film: Film;
  activeUser: User;
  onClose: () => void;
}

export default function Player({ film, activeUser, onClose }: Props) {
  const [showCast, setShowCast] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const playerRef = useRef<any>(null);
  const saveProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isMkv = film.filename?.toLowerCase().endsWith('.mkv') || film.originalName?.toLowerCase().endsWith('.mkv');

  useEffect(() => {
    if (isMkv) {
        notify("L'écran risque de rester noir.\n\nLes navigateurs Web ne supportent pas nativement le format .MKV. Téléchargez le fichier pour le lire avec VLC.", "Format Vidéo Incompatible");
    }

    // Fetch initial progress
    fetch(`/api/progress/${activeUser.id}/${film.id}`)
        .then(r => r.json())
        .then(data => {
            if (playerRef.current?.plyr && data.time > 0) {
                playerRef.current.plyr.currentTime = data.time;
            }
        })
        .catch(console.error);

    // Save progress periodically
    saveProgressIntervalRef.current = setInterval(() => {
        const player = playerRef.current?.plyr;
        if (player && player.playing) {
            fetch('/api/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: activeUser.id, filmId: film.id, time: player.currentTime })
            }).catch(console.error);
        }
    }, 10000); // save every 10 seconds

    return () => {
        if (saveProgressIntervalRef.current) clearInterval(saveProgressIntervalRef.current);
        const player = playerRef.current?.plyr;
        if (player) {
            fetch('/api/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: activeUser.id, filmId: film.id, time: player.currentTime }),
                keepalive: true
            }).catch(console.error);
        }
    };
  }, [activeUser.id, film.id, isMkv]);

  useEffect(() => {
      const player = playerRef.current?.plyr;
      if (player) {
          player.on('ready', () => {
              // Attempt to select French audio track if browser exposes audioTracks API (like Safari)
              const media = player.media;
              if (media && media.audioTracks) {
                  const tracks = media.audioTracks;
                  for (let i = 0; i < tracks.length; i++) {
                      if (tracks[i].language.toLowerCase().startsWith('fr')) {
                          tracks[i].enabled = true;
                          break;
                      }
                  }
              }
              // Attempt to select French subtitles
              player.language = 'fr';
          });
      }
  }, []);

  const plyrSource = {
      type: 'video' as const,
      sources: [
          {
              src: film.jellyfinId ? `/api/stream/${film.jellyfinId}` : `/videos/${film.filename}`,
              type: 'video/mp4',
          }
      ],
      title: film.title
  };

  const plyrOptions = {
      controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'],
      settings: ['captions', 'quality', 'speed', 'loop'],
      captions: { active: true, update: true, language: 'fr' },
      autoplay: true,
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col justify-center select-none group">
        
        {/* Back Button Overlay */}
        <div className="absolute top-0 left-0 right-0 p-6 z-50 pointer-events-none flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button 
                onClick={(e) => { e.stopPropagation(); onClose(); }} 
                className="text-white flex items-center gap-2 hover:text-gold-500 transition-colors pointer-events-auto bg-black/40 backdrop-blur px-4 py-2 rounded-full border border-white/10"
            >
                <ArrowLeft className="w-6 h-6" />
                <span className="text-lg font-medium">Retour</span>
            </button>

            {film.cast && film.cast.length > 0 && (
                <button 
                    onClick={(e) => { e.stopPropagation(); setShowCast(!showCast); }} 
                    className={`pointer-events-auto flex items-center gap-2 px-4 py-2 transition-colors rounded-full backdrop-blur border border-white/10 ${showCast ? 'bg-gold-500 text-black border-gold-500' : 'bg-black/40 text-white hover:text-gold-500'}`}
                    title="Voir le casting (TMDB)"
                >
                    <Users className="w-5 h-5" />
                    <span className="font-medium">Casting</span>
                </button>
            )}
        </div>

        {playbackError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-zinc-950/90 z-40 space-y-4">
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

        <div className="w-full h-full relative z-10 flex items-center justify-center bg-black">
            <div className="w-full h-full [&>.plyr]:h-full [&>.plyr]:w-full [&_video]:max-h-screen">
                <Plyr
                    ref={playerRef}
                    source={plyrSource}
                    options={plyrOptions}
                />
            </div>
        </div>

        {/* Cast Overlay */}
        <AnimatePresence>
            {showCast && film.cast && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 bg-black/80 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl max-w-4xl w-full flex gap-4 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-500 shadow-2xl"
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
        </AnimatePresence>
    </div>
  );
}
