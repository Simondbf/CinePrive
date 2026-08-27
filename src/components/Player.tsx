import React, { useEffect, useRef, useState } from 'react';
import { notify } from '../lib/notify';
import { Film, User } from '../types';
import { ArrowLeft, Settings, Users, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import { hasRole, primaryRole } from '../lib/roles';

interface Props {
  film: Film;
  activeUser: User;
  onClose: () => void;
}

export default function Player({ film, activeUser, onClose }: Props) {
  const [showCast, setShowCast] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [pistesSousTitres, setPistesSousTitres] = useState<Array<{ index: number; srclang: string; label: string; url: string }>>([]);
  const [sousTitresCharges, setSousTitresCharges] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  const saveProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tapsRef = useRef(0);
  const [doubleTapInfo, setDoubleTapInfo] = useState<{ side: 'left' | 'right', seconds: number, visible: boolean }>({ side: 'left', seconds: 0, visible: false });
  const [showReportModal, setShowReportModal] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  const handleClose = () => {
      try {
          if (document.fullscreenElement && document.exitFullscreen) {
              document.exitFullscreen();
          }
          if (screen.orientation && screen.orientation.unlock) {
              screen.orientation.unlock();
          }
      } catch (e) {
          console.error(e);
      }
      onClose();
  };

  const handleTap = (side: 'left' | 'right' | 'center') => {
      tapsRef.current += 1;
      
      if (tapTimeoutRef.current) {
          clearTimeout(tapTimeoutRef.current);
      }

      if (tapsRef.current >= 2) {
          if (side !== 'center') {
              const skipAmount = (tapsRef.current - 1) * 15;
              setDoubleTapInfo({ side, seconds: skipAmount, visible: true });
              
              if (playerRef.current) {
                  const player = playerRef.current;
                  if (side === 'left') {
                      player.currentTime -= 15;
                  } else {
                      player.currentTime += 15;
                  }
              }
          }
      }

      tapTimeoutRef.current = setTimeout(() => {
          if (tapsRef.current === 1) {
              if (playerRef.current) {
                  (playerRef.current as any).toggleControls();
              }
          }
          tapsRef.current = 0;
          setDoubleTapInfo(prev => ({ ...prev, visible: false }));
      }, 250);
  };

  const isMkv = film.filename?.toLowerCase().endsWith('.mkv') || film.originalName?.toLowerCase().endsWith('.mkv');

  const handleReport = async () => {
      if (!playerRef.current) return;
      setIsReporting(true);
      try {
          const timecode = Math.floor(playerRef.current.currentTime);
          const res = await fetch(`/api/films/${film.id}/report`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ timecode })
          });
          if (res.ok) {
              notify("Le signalement a été envoyé avec succès. Le film a été mis en quarantaine.", "Bouclier Communautaire");
              handleClose();
          } else {
              notify("Erreur lors du signalement.", "Erreur");
          }
      } catch (e) {
          notify("Erreur de connexion.", "Erreur");
      } finally {
          setIsReporting(false);
          setShowReportModal(false);
      }
  };

  // Plyr construit son menu de sous-titres au moment de l'initialisation :
  // les <track> doivent donc etre dans le DOM AVANT. On charge la liste
  // d'abord, et le lecteur n'est monte qu'ensuite.
  useEffect(() => {
    let annule = false;
    fetch(`/api/films/${film.id}/subtitles`)
      .then((r) => (r.ok ? r.json() : []))
      .then((pistes) => {
        if (!annule) setPistesSousTitres(Array.isArray(pistes) ? pistes : []);
      })
      .catch(() => { if (!annule) setPistesSousTitres([]); })
      .finally(() => { if (!annule) setSousTitresCharges(true); });
    return () => { annule = true; };
  }, [film.id]);

  useEffect(() => {
    if (!sousTitresCharges) return;
    if (isMkv) {
        notify("L'écran risque de rester noir.\n\nLes navigateurs Web ne supportent pas nativement le format .MKV. Téléchargez le fichier pour le lire avec VLC.", "Format Vidéo Incompatible");
    }

    if (!videoRef.current) return;

    // Initialize Plyr
    const player = new Plyr(videoRef.current, {
      controls: ['play-large', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'],
      settings: ['captions', 'quality', 'speed', 'loop', 'audio'],
      captions: { active: false, update: true, language: 'fr' },
      autoplay: true,
      seekTime: 15,
      keyboard: { focused: true, global: true },
      clickToPlay: true,
      fullscreen: { enabled: true, fallback: true, iosNative: false },
      i18n: { speed: 'Vitesse', normal: 'Normale' }
      // To prevent Plyr's default double click:
      // (Plyr doesn't have an explicit option, but doubleClick is handled internally. We added absolute tap zones on top which will intercept clicks on mobile).
    });
    
    playerRef.current = player;

    const readyTimeout = setTimeout(() => {
        if (playerRef.current && (playerRef.current as any).media && (playerRef.current as any).media.readyState === 0) {
            setPlaybackError(true);
        }
    }, 8000);

    // Handle global keyboard shortcuts for closing the player
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.key === 'Backspace') {
            handleClose();
        }
    };
    window.addEventListener('keydown', handleKeyDown);

    const tryFullscreen = async () => {
        try {
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }
            if (screen.orientation && (screen.orientation as any).lock) {
                await (screen.orientation as any).lock('landscape').catch(() => {});
            }
        } catch (e) {
            console.warn("Fullscreen/Orientation lock failed:", e);
        }
    };

    // Comptabiliser une lecture, une seule fois par ouverture du lecteur.
    let lectureComptee = false;
    player.on('play', () => {
        if (!lectureComptee) {
            lectureComptee = true;
            fetch(`/api/films/${film.id}/view`, { method: 'POST' }).catch(() => {});
        }
        if (window.innerWidth <= 768) {
             tryFullscreen();
        }
    });

    player.on('ready', () => {
        // Attempt to select French audio track if browser exposes audioTracks API (like Safari)
        const media = (player as any).media;
        if (media && (media as any).audioTracks) {
            const tracks = (media as any).audioTracks;
            for (let i = 0; i < tracks.length; i++) {
                if (tracks[i].language.toLowerCase().startsWith('fr')) {
                    tracks[i].enabled = true;
                    break;
                }
            }
        }
        player.language = 'fr';

        // Selectionner la piste francaise si elle existe, sinon laisser
        // les sous-titres eteints : personne n'aime les subir.
        const piste = pistesSousTitres.findIndex((t) => t.srclang === 'fr');
        if (piste >= 0) {
            try {
                player.currentTrack = piste;
                player.toggleCaptions(true);
            } catch (e) { /* Plyr n'expose pas toujours currentTrack */ }
        }
    });

    player.on('error', () => {
        setPlaybackError(true);
        notify("Le format de ce fichier n'est pas pris en charge par votre navigateur, ou le fichier est en cours de traitement vidéo.", "Erreur de Lecture");
    });

    let hasSeeked = false;
    
    // Fetch initial progress
    fetch(`/api/progress/${film.id}`)
        .then(r => r.json())
        .then(data => {
            if (player && data.time > 0 && !hasSeeked) {
                const seekToData = () => {
                    if (!hasSeeked) {
                        player.currentTime = data.time;
                        hasSeeked = true;
                    }
                };
                if ((player as any).media.readyState >= 1) {
                    seekToData();
                } else {
                    player.once('loadedmetadata', seekToData);
                }
            }
        })
        .catch(console.error);

    player.on('seeked', () => { hasSeeked = true; });

    // Save progress periodically
    saveProgressIntervalRef.current = setInterval(() => {
        if (player && player.playing) {
            const current = player.currentTime;
            const duration = player.duration;
            
            if (duration > 0 && current / duration >= 0.95) {
                fetch(`/api/progress/${film.id}`, { method: 'DELETE' }).catch(console.error);
                // Film termine sur la plateforme : marque comme vu sans rien demander.
                fetch(`/api/films/${film.id}/seen-auto`, { method: 'POST' }).catch(console.error);
            } else if (current > 15) {
                fetch('/api/progress', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filmId: film.id, time: current })
                }).catch(console.error);
            }
        }
    }, 10000); // save every 10 seconds

    return () => {
        if (readyTimeout) clearTimeout(readyTimeout);
        window.removeEventListener('keydown', handleKeyDown);
        if (saveProgressIntervalRef.current) clearInterval(saveProgressIntervalRef.current);
        if (playerRef.current) {
            const current = playerRef.current.currentTime;
            const duration = playerRef.current.duration;
            if (duration > 0 && current / duration >= 0.95) {
                fetch(`/api/progress/${film.id}`, { method: 'DELETE', keepalive: true }).catch(console.error);
                fetch(`/api/films/${film.id}/seen-auto`, { method: 'POST', keepalive: true }).catch(console.error);
            } else if (current > 15) {
                fetch('/api/progress', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filmId: film.id, time: current }),
                    keepalive: true
                }).catch(console.error);
            }
            playerRef.current.destroy();
        }
    };
  }, [activeUser.id, film.id, isMkv, sousTitresCharges]);


  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col justify-center select-none group" style={{ '--plyr-color-main': '#ef4444' } as React.CSSProperties}>
        <style>{`
            .plyr { touch-action: manipulation; }
            .plyr__progress { width: 100%; position: absolute; bottom: 60px; left: 0; padding: 0 20px; }
            @media (max-width: 768px) {
                .plyr__controls { padding-bottom: 20px !important; }
                .plyr__progress { bottom: 80px; }
            }
        `}</style>
        
        {/* Invisible Tap Zones for Mobile */}
        <div className="absolute inset-x-0 top-0 bottom-24 z-30 flex md:hidden">
            <div className="w-1/3" onClick={() => handleTap('left')} />
            <div className="w-1/3" onClick={() => handleTap('center')} /> {/* Center safe zone for native play/pause */}
            <div className="w-1/3" onClick={() => handleTap('right')} />
        </div>

        {/* Double Tap Feedback Overlay */}
        <AnimatePresence>
            {doubleTapInfo.visible && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`absolute top-1/2 -translate-y-1/2 z-40 bg-black/60 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 ${doubleTapInfo.side === 'left' ? 'left-1/4 -translate-x-1/2' : 'right-1/4 translate-x-1/2'}`}
                >
                    {doubleTapInfo.side === 'left' ? (
                        <><ArrowLeft className="w-5 h-5" /> - {doubleTapInfo.seconds} s</>
                    ) : (
                        <>+ {doubleTapInfo.seconds} s <ArrowLeft className="w-5 h-5 rotate-180" /></>
                    )}
                </motion.div>
            )}
        </AnimatePresence>

        {/* Back Button Overlay */}
        <div className="absolute top-0 left-0 right-0 p-6 z-50 pointer-events-none flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
            <button 
                onClick={(e) => { e.stopPropagation(); handleClose(); }} 
                className="text-white flex items-center gap-2 hover:text-primary-500 transition-colors pointer-events-auto bg-black/40 backdrop-blur px-4 py-2 rounded-full border border-white/10 shadow-lg"
            >
                <ArrowLeft className="w-6 h-6" />
                <span className="text-lg font-medium hidden sm:inline">Retour</span>
            </button>

            <div className="flex items-center gap-3">
                <button 
                    onClick={(e) => { e.stopPropagation(); setShowReportModal(true); }} 
                    className="pointer-events-auto flex items-center gap-2 px-4 py-2 transition-colors rounded-full backdrop-blur border border-white/10 bg-black/40 text-white hover:text-primary-500 hover:border-primary-500/50"
                    title="Signaler un contenu inapproprié"
                >
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium hidden sm:inline">Signaler</span>
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
        </div>

        {playbackError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-zinc-950/90 z-40 space-y-4">
                <Settings className="w-16 h-16 text-zinc-500 mb-4 animate-pulse" />
                <h2 className="text-xl font-bold">Erreur de lecture</h2>
                <p className="text-zinc-400 text-center max-w-lg px-4">
                    Ce format n'est pas supporté par votre navigateur actuel ou la conversion a échoué.
                </p>
                <div className="flex gap-4">
                    <button onClick={(e) => { e.stopPropagation(); handleClose(); }} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition">
                        Retour
                    </button>
                    {!film.jellyfinId && activeUser && (hasRole(activeUser, 'owner') || hasRole(activeUser, 'admin') || hasRole(activeUser, 'technician')) && (
                        <button onClick={(e) => { 
                            e.stopPropagation();
                            fetch(`/api/films/${film.id}/remux`, { method: 'POST' })
                              .then(() => notify("Une demande de conversion en MP4 a été envoyée au serveur. Revenez plus tard.", "Conversion en cours"))
                              .catch(() => notify("Erreur de connexion", "Erreur"));
                        }} className="px-6 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition text-white">
                            Convertir en MP4 (Serveur)
                        </button>
                    )}
                </div>
            </div>
        )}

        <div className="w-full h-full relative z-10 flex items-center justify-center bg-black">
            {!sousTitresCharges && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
                    <div className="w-10 h-10 border-[3px] border-primary-600/20 border-t-primary-600 rounded-full animate-spin" />
                </div>
            )}
            <div className="w-full h-full [&>.plyr]:h-full [&>.plyr]:w-full [&_video]:max-h-screen">
                <video
                    ref={videoRef}
                    playsInline
                    crossOrigin="anonymous"
                >
                    <source src={film.jellyfinId ? `/api/stream/${film.jellyfinId}` : `/videos/${film.filename}`} />
                    {pistesSousTitres.map((piste) => (
                        <track
                            key={piste.index}
                            kind="captions"
                            src={piste.url}
                            srcLang={piste.srclang}
                            label={piste.label}
                        />
                    ))}
                </video>
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

        {/* Report Modal */}
        <AnimatePresence>
            {showReportModal && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto"
                >
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
                        <div className="flex items-center gap-3 text-primary-500 mb-4">
                            <AlertTriangle className="w-8 h-8" />
                            <h2 className="text-xl font-bold text-white">Signaler un abus</h2>
                        </div>
                        <p className="text-zinc-300 mb-4 text-sm leading-relaxed">
                            Avez-vous repéré un contenu inapproprié (pornographie, violence extrême, ou non conforme aux règles) ? 
                        </p>
                        <p className="text-zinc-400 mb-6 text-sm">
                            Le timecode actuel sera automatiquement capturé. Le film passera immédiatement en quarantaine et sera masqué jusqu'à vérification par un Administrateur.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setShowReportModal(false)}
                                disabled={isReporting}
                                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                            >
                                Annuler
                            </button>
                            <button 
                                onClick={handleReport}
                                disabled={isReporting}
                                className="px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isReporting ? 'Envoi...' : 'Confirmer le signalement'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
}
