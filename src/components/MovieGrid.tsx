import React, { useState, useEffect, useRef } from 'react';
import { Film, User } from '../types';
import { Play, Heart, Loader2, Download, Info, X, ChevronLeft, ChevronRight, Edit2, Check, Youtube, Eye, EyeOff } from 'lucide-react';
import { notify } from '../lib/notify';
import { AnimatePresence, motion } from 'motion/react';
import { hasRole, primaryRole } from '../lib/roles';

interface Props {
  films: Film[];
  activeUser: User;
  onPlay: (film: Film) => void;
  onToggleList: (filmId: string) => void;
  transcodingStatuses?: Record<string, any>;
  onRemoveFromContinueWatching?: (filmId: string) => void;
  isCompleteGrid?: boolean;
  onToggleSeen?: (filmId: string) => void;
}

export default function MovieGrid({ films, activeUser, onPlay, onToggleList, transcodingStatuses, onRemoveFromContinueWatching, isCompleteGrid, onToggleSeen }: Props) {
  const [chargementBA, setChargementBA] = useState(false);
  const [cleBA, setCleBA] = useState<string | null>(null);
  const [erreurBA, setErreurBA] = useState<string | null>(null);

  // On recharge la bande-annonce a chaque ouverture de fiche.
  const chargerBandeAnnonce = async (film: Film) => {
    setChargementBA(true);
    setErreurBA(null);
    try {
      const res = await fetch(`/api/films/${film.id}/trailer`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.key) {
        setCleBA(data.key);
      } else {
        setErreurBA(data.error || "Aucune bande-annonce trouvée.");
      }
    } catch {
      setErreurBA("Impossible de contacter le serveur.");
    } finally {
      setChargementBA(false);
    }
  };
  const [loadingListId, setLoadingListId] = useState<string | null>(null);
  const [infoFilm, setInfoFilm] = useState<Film | null>(null);

  // Fermer la fiche arrete aussi la bande-annonce : l'iframe est demontee.
  const fermerFiche = () => { setInfoFilm(null); setCleBA(null); setErreurBA(null); };

  // Seule la file nocturne impose d'attendre le lendemain ; la file rapide
  // tourne en permanence.
  const messageIndisponible = (film: Film): string => {
    const status = transcodingStatuses?.[film.id];
    if (status?.file === 'nuit') {
      return status.state === 'active'
        ? "Le réencodage de ce film est en cours. Il devrait être disponible d'ici demain matin."
        : "Ce format demande un réencodage complet, fait la nuit pour ne pas gêner les autres. Le film sera disponible demain matin.";
    }
    if (status?.state === 'active') return "La conversion de ce film est en cours. Encore quelques minutes.";
    return "Le film est en cours de préparation. Réessayez dans quelques minutes.";
  };
  const [editingGenre, setEditingGenre] = useState(false);
  const [newGenre, setNewGenre] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
      if (scrollRef.current) {
          const amount = direction === 'left' ? -600 : 600;
          scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
      }
  };

  const handleToggle = async (e: React.MouseEvent, filmId: string) => {
      e.stopPropagation();
      setLoadingListId(filmId);
      await onToggleList(filmId);
      setLoadingListId(null);
  };

  const handleUpdateGenre = async () => {
      if (!infoFilm || !newGenre.trim()) return;
      try {
          const res = await fetch(`/api/films/${infoFilm.id}/genre`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ genre: newGenre.trim() })
          });
          if (res.ok) {
              const { film } = await res.json();
              setInfoFilm(film);
              setEditingGenre(false);
              notify("Le genre a été mis à jour avec succès.", "Succès");
          } else {
              notify("Erreur lors de la mise à jour du genre.", "Erreur");
          }
      } catch (err) {
          notify("Erreur de connexion.", "Erreur");
      }
  };

  const handleDownload = (e: React.MouseEvent, film: Film) => {
      e.stopPropagation();
      if (film.status !== 'AVAILABLE') {
          e.preventDefault();
          notify("Le film est en cours de traitement et n'est pas encore téléchargeable.", "Non disponible");
          return;
      }
      const key = `downloads_${activeUser.id}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      if (!stored.includes(film.id)) {
          localStorage.setItem(key, JSON.stringify([...stored, film.id]));
      }
      notify("Le téléchargement du film a commencé. Le fichier est à sa taille d'origine.", "Mode Hors-Ligne");
  };

  return (
    <div className="relative group/grid">
        {/* Left Arrow */}
        {!isCompleteGrid && (
            <button 
                onClick={(e) => { e.preventDefault(); scroll('left'); }}
                className="hidden lg:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center bg-black/30 opacity-0 group-hover/grid:opacity-100 transition-opacity backdrop-blur-sm rounded-full hover:bg-black/60 shadow-md"
            >
                <ChevronLeft className="w-5 h-5 text-white" />
            </button>
        )}

        <div ref={scrollRef} className={isCompleteGrid ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4 md:gap-6 pb-4" : "flex overflow-x-auto gap-4 md:gap-6 pb-4 snap-x snap-mandatory hide-scrollbar"}>
      {films.map((film) => {
        const inList = (activeUser.myList || []).includes(film.id);
        const dejaVu = (activeUser.seenFilms || []).includes(film.id);
        // Le marqueur peut etre masque depuis les reglages ; actif par defaut.
        const afficherDejaVu = activeUser.showSeenBadge !== false;

        return (
            <div key={film.id} className={`group relative flex flex-col gap-2 shrink-0 snap-start ${isCompleteGrid ? "w-full" : "w-28 sm:w-32 md:w-36 lg:w-44"}`}>
                {/* Poster Box */}
                <div 
                    onClick={() => {
                        // La rangee "Reprendre la lecture" relance directement, comme
                        // sur les plateformes de streaming. Partout ailleurs, le clic
                        // ouvre la fiche : synopsis, bande-annonce, bouton Lecture.
                        if (onRemoveFromContinueWatching && film.status === 'AVAILABLE') {
                            onPlay(film);
                        } else {
                            setInfoFilm(film);
                        }
                    }}
                    className={`aspect-[2/3] bg-zinc-800 rounded-lg overflow-hidden relative border border-zinc-200 dark:border-zinc-800 transition-colors shadow-sm cursor-pointer hover:border-primary-500 ${film.status !== 'AVAILABLE' ? 'opacity-80' : ''}`}
                >
                    {film.posterUrl ? (
                        <img src={film.posterUrl} alt={film.title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-zinc-100 dark:bg-zinc-900 text-zinc-500">
                            <span className="font-bold text-lg mb-2 text-zinc-900 dark:text-zinc-300">{film.title}</span>
                            <span className="text-xs">Aucune affiche</span>
                        </div>
                    )}
                    
                    {film.status !== 'AVAILABLE' && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 p-4 text-center backdrop-blur-[2px]">
                            {transcodingStatuses?.[film.id]?.state === 'active' ? (
                                <>
                                    <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
                                    <span className="text-gold-400 font-bold text-sm tracking-wider uppercase bg-gold-400/10 px-3 py-1.5 rounded shadow-sm border border-gold-400/20">🎬 En salle de montage</span>
                                    {transcodingStatuses[film.id].progress !== undefined && (
                                        <div className="text-xs text-zinc-300 mt-2 flex flex-col items-center w-full px-4">
                                            <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-1 max-w-[120px]">
                                                <div className="bg-gold-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${transcodingStatuses[film.id].progress}%` }}></div>
                                            </div>
                                            <span className="font-medium text-gold-300">{transcodingStatuses[film.id].progress}%</span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="text-4xl mb-2 animate-bounce opacity-80">🌙</div>
                                    <span className="text-blue-300 font-bold text-sm tracking-wider uppercase bg-blue-500/20 px-3 py-1.5 rounded shadow-sm border border-blue-400/30">Prêt demain matin</span>
                                </>
                            )}
                        </div>
                    )}
                    
                    {/* Marqueur "deja vu" : une simple pastille en coin.
                        L'affiche n'est pas assombrie : elle doit rester lisible. */}
                    {afficherDejaVu && dejaVu && film.status === 'AVAILABLE' && (
                        <div className="absolute top-2 right-2 z-10 pointer-events-none bg-primary-600 text-white rounded-full p-1.5 shadow-lg" title="Déjà vu">
                            <Eye className="w-3.5 h-3.5" />
                        </div>
                    )}

                    {/* Hover actions */}
                    {film.status === 'AVAILABLE' && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4">
                            <button className="bg-white text-black w-12 h-12 flex items-center justify-center rounded-full hover:scale-105 transition-transform shadow-lg">
                                <Play className="w-6 h-6 fill-black ml-1" />
                            </button>
                        </div>
                    )}
                    
                    {/* Version Badge */}
                    {film.versionType && (
                        <div className="absolute top-2 left-2 flex justify-start pointer-events-none">
                            <span className="bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                                {film.versionType}
                            </span>
                        </div>
                    )}
                    
                    {onRemoveFromContinueWatching && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRemoveFromContinueWatching(film.id); }}
                            className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white z-40 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Meta details (Classic prototype structurally organized data) */}
                <div>
                   <div className="flex items-start justify-between gap-1">
                       <h4
                           onClick={(e) => { e.stopPropagation(); setInfoFilm(film); }}
                           className="font-medium text-zinc-900 dark:text-zinc-100 text-sm line-clamp-2 leading-tight pr-2 grow cursor-pointer hover:text-primary-600 dark:hover:text-primary-500 transition-colors"
                           title="Voir la fiche"
                       >
                           {film.title}
                       </h4>
                       <div className="flex items-center gap-2 shrink-0">
                           <button 
                               onClick={(e) => { e.stopPropagation(); setInfoFilm(film); }}
                               className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white shrink-0 mt-0.5 transition-colors"
                               title="Informations"
                           >
                               <Info className="w-4 h-4" />
                           </button>
                           <a 
                               href={film.status !== 'AVAILABLE' ? '#' : `/api/download/${film.id}`}
                               download={film.status !== 'AVAILABLE' ? undefined : (film.originalName || film.title)}
                               onClick={(e) => handleDownload(e, film)}
                               className={`shrink-0 mt-0.5 transition-colors ${film.status !== 'AVAILABLE' ? 'text-zinc-600 dark:text-zinc-700 cursor-not-allowed' : 'text-zinc-400 hover:text-gold-500'}`}
                               title={film.status !== 'AVAILABLE' ? "Téléchargement indisponible" : "Télécharger"}
                           >
                               <Download className="w-4 h-4" />
                           </a>
                           <button 
                               onClick={(e) => handleToggle(e, film.id)}
                               className={`shrink-0 mt-0.5 transition-colors ${inList ? 'text-primary-500 hover:text-primary-600' : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                               title={inList ? "Retirer de ma liste" : "Ajouter à ma liste"}
                           >
                               {loadingListId === film.id ? (
                                   <Loader2 className="w-4 h-4 animate-spin" />
                               ) : (
                                   <Heart className="w-4 h-4" fill={inList ? "currentColor" : "none"} />
                               )}
                           </button>
                       </div>
                   </div>
                   <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-900 dark:text-zinc-400 mt-1 font-medium">
                       <span>{film.year}</span>
                       <span className="w-1 h-1 bg-zinc-400 dark:bg-zinc-600 rounded-full" />
                       <span className="truncate">{(film.genres || [film.genre]).join(', ')}</span>
                       {film.duration && film.duration !== '~120m' && (
                           <>
                               <span className="w-1 h-1 bg-zinc-400 dark:bg-zinc-600 rounded-full" />
                               <span>{film.duration}</span>
                           </>
                       )}
                   </div>
                </div>
            </div>
        );
      })}
    </div>

        {/* Right Arrow */}
        {!isCompleteGrid && (
            <button 
                onClick={(e) => { e.preventDefault(); scroll('right'); }}
                className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center bg-black/30 opacity-0 group-hover/grid:opacity-100 transition-opacity backdrop-blur-sm rounded-full hover:bg-black/60 shadow-md"
            >
                <ChevronRight className="w-5 h-5 text-white" />
            </button>
        )}

    <AnimatePresence>
        {infoFilm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={fermerFiche} />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden"
                >
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">À propos du film</h2>
                        <button onClick={fermerFiche} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-6">
                        <div className="flex gap-6">
                            {infoFilm.posterUrl && (
                                <img src={infoFilm.posterUrl} alt={infoFilm.title} className="w-24 h-36 object-cover rounded shadow-md shrink-0" />
                            )}
                            <div>
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">{infoFilm.title}</h3>
                                <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 mb-4">
                                    <span>{infoFilm.year}</span>
                                    <span className="w-1 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
                                    {editingGenre ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="text"
                                                value={newGenre}
                                                onChange={(e) => setNewGenre(e.target.value)}
                                                className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-900 dark:text-white"
                                            />
                                            <button onClick={handleUpdateGenre} className="text-green-500 hover:text-green-600">
                                                <Check className="w-3 h-3" />
                                            </button>
                                            <button onClick={() => setEditingGenre(false)} className="text-primary-500 hover:text-primary-600">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap items-center gap-1">
                                            <span>{(infoFilm.genres || [infoFilm.genre]).join(', ')}</span>
                                            {(hasRole(activeUser, 'admin') || hasRole(activeUser, 'owner')) && (
                                                <button onClick={() => { setEditingGenre(true); setNewGenre(infoFilm.genre); }} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                                                    <Edit2 className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {infoFilm.duration && infoFilm.duration !== '~120m' && (
                                        <>
                                            <span className="w-1 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
                                            <span>{infoFilm.duration}</span>
                                        </>
                                    )}
                                </div>
                                {infoFilm.versionType && (
                                    <span className="bg-primary-50 dark:bg-primary-500/10 text-primary-600 border border-primary-200 dark:border-primary-500/20 text-xs font-bold px-2 py-1 rounded inline-block mb-4">
                                        {infoFilm.versionType}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="mt-4">
                            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-300 mb-2">Synopsis</h4>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                {infoFilm.synopsis || "Aucun synopsis disponible pour ce film."}
                            </p>
                        </div>
                        {/* Lecture : l'action principale de la fiche. */}
                        <div className="mt-5">
                            <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => { const film = infoFilm; fermerFiche(); onPlay(film); }}
                                disabled={infoFilm.status !== 'AVAILABLE'}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 hover:bg-zinc-700 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black px-8 py-3 text-base font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Play className="w-5 h-5" fill="currentColor" />
                                Lecture
                            </button>
                            {/* Meme lien que l'icone de la grille : le serveur envoie le
                                fichier en piece jointe, le navigateur l'enregistre. */}
                            <a
                                href={infoFilm.status !== 'AVAILABLE' ? '#' : `/api/download/${infoFilm.id}`}
                                download={infoFilm.status !== 'AVAILABLE' ? undefined : (infoFilm.originalName || infoFilm.title)}
                                onClick={(e) => handleDownload(e, infoFilm)}
                                aria-disabled={infoFilm.status !== 'AVAILABLE'}
                                className={`inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 px-6 py-3 text-base font-medium transition ${infoFilm.status !== 'AVAILABLE' ? 'opacity-40 cursor-not-allowed' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}
                            >
                                <Download className="w-5 h-5" />
                                Télécharger
                            </a>
                            </div>
                            {infoFilm.status !== 'AVAILABLE' && (
                                <p className="mt-2 text-xs text-zinc-500">{messageIndisponible(infoFilm)}</p>
                            )}
                        </div>

                        {/* Bande-annonce integree : l'ancienne version ouvrait un
                            onglet, souvent bloque par le navigateur. */}
                        <div className="mt-5">
                            {cleBA ? (
                                <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                                    <iframe
                                        src={`https://www.youtube-nocookie.com/embed/${cleBA}?rel=0&autoplay=1`}
                                        title={`Bande-annonce de ${infoFilm.title}`}
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        onClick={() => chargerBandeAnnonce(infoFilm)}
                                        disabled={chargementBA}
                                        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 px-4 py-2 text-sm font-medium transition disabled:opacity-60"
                                    >
                                        {chargementBA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Youtube className="w-4 h-4" />}
                                        Bande-annonce
                                    </button>
                                    {erreurBA && (
                                        <a
                                            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${infoFilm.title} ${infoFilm.year || ''} bande-annonce`)}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs text-zinc-500 hover:text-primary-600 underline"
                                        >
                                            {erreurBA} Chercher sur YouTube.
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Vu / pas vu et favoris : c'est ici qu'on declare avoir
                            vu un film ailleurs que sur la plateforme. */}
                        <div className="mt-5 flex flex-wrap items-center gap-3">
                            {onToggleSeen && (
                                <button
                                    onClick={() => onToggleSeen(infoFilm.id)}
                                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition border ${
                                        (activeUser.seenFilms || []).includes(infoFilm.id)
                                            ? 'bg-primary-600 border-primary-600 text-white hover:bg-primary-700'
                                            : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                                    }`}
                                >
                                    {(activeUser.seenFilms || []).includes(infoFilm.id)
                                        ? <><Eye className="w-4 h-4" /> Déjà vu</>
                                        : <><EyeOff className="w-4 h-4" /> Pas encore vu</>}
                                </button>
                            )}
                            <button
                                onClick={(e) => handleToggle(e as any, infoFilm.id)}
                                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition border ${
                                    (activeUser.myList || []).includes(infoFilm.id)
                                        ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-400'
                                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                                }`}
                            >
                                <Heart className="w-4 h-4" fill={(activeUser.myList || []).includes(infoFilm.id) ? "currentColor" : "none"} />
                                {(activeUser.myList || []).includes(infoFilm.id) ? "Dans ma liste" : "Ajouter à ma liste"}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        )}
    </AnimatePresence>
    </div>
  );
}
