import React, { useState, useEffect } from 'react';
import { Film, User } from '../types';
import { Play, Plus, Check, Loader2, Download } from 'lucide-react';
import { notify } from '../lib/notify';

interface Props {
  films: Film[];
  activeUser: User;
  onPlay: (film: Film) => void;
  onToggleList: (filmId: string) => void;
}

export default function MovieGrid({ films, activeUser, onPlay, onToggleList }: Props) {
  const [loadingListId, setLoadingListId] = useState<string | null>(null);

  const handleToggle = async (e: React.MouseEvent, filmId: string) => {
      e.stopPropagation();
      setLoadingListId(filmId);
      await onToggleList(filmId);
      setLoadingListId(null);
  };

  const handleDownload = (e: React.MouseEvent, film: Film) => {
      e.stopPropagation();
      const key = `downloads_${activeUser.id}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      if (!stored.includes(film.id)) {
          localStorage.setItem(key, JSON.stringify([...stored, film.id]));
      }
      notify("Le fichier source est en cours de téléchargement.\n\nNote Technique : Sur ce prototype (sans transcoding FFmpeg), la taille du fichier est la taille d'origine du fichier uploadé.\nSur le serveur complet avec Jellyfin, un transcodage compressé pourra être proposé pour les mobiles.", "Mode Hors-Ligne");
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
      {films.map((film) => {
        const inList = (activeUser.myList || []).includes(film.id);

        return (
            <div key={film.id} className="group relative flex flex-col gap-2">
                {/* Poster Box */}
                <div 
                    onClick={() => onPlay(film)}
                    className="aspect-[2/3] bg-zinc-800 rounded-lg overflow-hidden relative cursor-pointer border border-zinc-800 hover:border-zinc-500 transition-colors shadow-sm"
                >
                    {film.posterUrl ? (
                        <img src={film.posterUrl} alt={film.title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-zinc-900 text-zinc-500">
                            <span className="font-bold text-lg mb-2 text-zinc-300">{film.title}</span>
                            <span className="text-xs">Aucune affiche</span>
                        </div>
                    )}
                    
                    {/* Hover actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4">
                        <button className="bg-white text-black w-12 h-12 flex items-center justify-center rounded-full hover:scale-105 transition-transform shadow-lg">
                            <Play className="w-6 h-6 fill-black ml-1" />
                        </button>
                    </div>
                </div>

                {/* Meta details (Classic prototype structurally organized data) */}
                <div>
                   <div className="flex items-start justify-between gap-1">
                       <h4 className="font-medium text-zinc-100 text-sm truncate pr-2 grow" title={film.title}>
                           {film.title}
                       </h4>
                       <div className="flex items-center gap-2 shrink-0">
                           <a 
                               href={`/api/download/${film.id}`}
                               download={film.originalName || film.title}
                               onClick={(e) => handleDownload(e, film)}
                               className="text-zinc-500 hover:text-gold-500 shrink-0 mt-0.5 transition-colors"
                               title="Télécharger"
                           >
                               <Download className="w-4 h-4" />
                           </a>
                           <button 
                               onClick={(e) => handleToggle(e, film.id)}
                               className="text-zinc-500 hover:text-white shrink-0 mt-0.5 transition-colors"
                               title={inList ? "Retirer de ma liste" : "Ajouter à ma liste"}
                           >
                               {loadingListId === film.id ? (
                                   <Loader2 className="w-4 h-4 animate-spin" />
                               ) : inList ? (
                                   <Check className="w-4 h-4 text-green-500" />
                               ) : (
                                   <Plus className="w-4 h-4" />
                               )}
                           </button>
                       </div>
                   </div>
                   <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                       <span>{film.year}</span>
                       <span className="w-1 h-1 bg-zinc-600 rounded-full" />
                       <span className="truncate">{film.genre}</span>
                   </div>
                </div>
            </div>
        );
      })}
    </div>
  );
}
