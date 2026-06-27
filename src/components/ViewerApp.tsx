import React, { useState, useMemo, useEffect } from 'react';
import { notify } from '../lib/notify';
import { Film, User } from '../types';
import MovieGrid from './MovieGrid';
import { Search } from 'lucide-react';

interface Props {
    activeUser: User;
    films: Film[];
    onPlay: (film: Film) => void;
    onUpdateUser: (u: User) => void;
    transcodingStatuses?: Record<string, any>;
    searchQuery: string;
    setSearchQuery: (s: string) => void;
    selectedGenre: string | null;
    setSelectedGenre: (s: string | null) => void;
}

export default function ViewerApp({ activeUser, films, onPlay, onUpdateUser, transcodingStatuses, searchQuery, setSearchQuery, selectedGenre, setSelectedGenre }: Props) {
    const [progress, setProgress] = useState<Record<string, number>>({});

    useEffect(() => {
        fetch('/api/progress')
            .then(res => res.json())
            .then(data => setProgress(data))
            .catch(console.error);
    }, [activeUser.id]);

    const handleRemoveProgress = async (filmId: string) => {
        try {
            await fetch(`/api/progress/${filmId}`, { method: 'DELETE' });
            setProgress(prev => {
                const next = { ...prev };
                delete next[filmId];
                return next;
            });
        } catch (e) {
            console.error(e);
        }
    };

    const toggleMyList = async (filmId: string) => {
        const action = (activeUser.myList || []).includes(filmId) ? 'remove' : 'add';
        try {
            const res = await fetch(`/api/users/${activeUser.id}/mylist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filmId, action })
            });
            if (res.ok) {
                const updated = await res.json();
                onUpdateUser(updated);
            }
        } catch (e) {
            console.error("Update list error", e);
        }
    };

    // --- Computed Data ---
    const filteredFilms = useMemo(() => {
        if (!searchQuery) return films;
        return films.filter(f => f.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [films, searchQuery]);

    const lists = useMemo(() => {
        if (searchQuery || selectedGenre) return []; // En mode recherche/genre on n'affiche que les resultats

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const nouveautes = films
            .filter(f => new Date(f.addedAt) >= thirtyDaysAgo)
            .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
            .slice(0, 12);

        const maListeFilms = films.filter(f => activeUser.myList?.includes(f.id));
        
        const reprendreFilms = films.filter(f => {
            const time = progress[f.id];
            if (!time || time <= 15) return false;
            
            let totalSeconds = 0;
            if (f.runtime) {
                totalSeconds = f.runtime * 60;
            } else if (f.duration) {
                const parts = f.duration.split(' ');
                let hours = 0;
                let minutes = 0;
                parts.forEach(p => {
                    if (p.includes('h')) hours = parseInt(p);
                    if (p.includes('m')) minutes = parseInt(p);
                });
                totalSeconds = (hours * 3600) + (minutes * 60);
            }
            if (totalSeconds === 0) return true; // Si pas de durée, on affiche
            
            const percentage = (time / totalSeconds) * 100;
            return percentage < 95;
        });

        // Grouping genres
        const categories = new Map<string, Film[]>();
        films.forEach(f => {
            if (!categories.has(f.genre)) categories.set(f.genre, []);
            categories.get(f.genre)!.push(f);
        });

        // Structure d'affichage pour iterer facilement (Structural prototype)
        const blocs = [
            { title: "🎬 Reprendre la lecture", films: reprendreFilms, alwaysShow: false, isContinueWatching: true },
            { title: "🎬 Nouveautés", films: nouveautes, alwaysShow: false, isCategory: true },
            { title: "📌 Ma Liste", films: maListeFilms, alwaysShow: false, isCategory: true }
        ];

        Array.from(categories.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([genre, gFilms]) => {
            blocs.push({ title: genre, films: gFilms, alwaysShow: false, isCategory: true });
        });

        return blocs;
    }, [films, activeUser.myList, searchQuery, selectedGenre, progress]);

    const displayedFilms = useMemo(() => {
        if (searchQuery) return films.filter(f => f.title.toLowerCase().includes(searchQuery.toLowerCase()));
        if (selectedGenre) {
            if (selectedGenre === "📌 Ma Liste") return films.filter(f => activeUser.myList?.includes(f.id));
            if (selectedGenre === "🎬 Nouveautés") {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                return films.filter(f => new Date(f.addedAt) >= thirtyDaysAgo).sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
            }
            return films.filter(f => f.genre === selectedGenre);
        }
        return [];
    }, [films, searchQuery, selectedGenre, activeUser.myList]);

    return (
        <div className="p-6 lg:p-12 pb-24 max-w-[1600px] mx-auto space-y-8 lg:space-y-10">
            {/* Corps de l'interface */}
            {(searchQuery || selectedGenre) ? (
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-medium text-zinc-900 dark:text-white">
                            {searchQuery ? `Résultats pour "${searchQuery}" (${displayedFilms.length})` : `Catégorie : ${selectedGenre} (${displayedFilms.length})`}
                        </h3>
                        {selectedGenre && (
                            <button 
                                onClick={() => setSelectedGenre(null)}
                                className="text-sm font-medium text-red-600 hover:text-red-500"
                            >
                                Retour à l'accueil
                            </button>
                        )}
                    </div>
                    {displayedFilms.length > 0 ? (
                         <MovieGrid films={displayedFilms} activeUser={activeUser} onPlay={onPlay} onToggleList={toggleMyList} transcodingStatuses={transcodingStatuses} isCompleteGrid={true} />
                    ) : (
                         <div className="p-12 flex flex-col items-center gap-4 justify-center text-center text-zinc-500 bg-zinc-900/50 rounded-xl border border-zinc-800 border-dashed">
                             <p>{searchQuery ? `Le film "${searchQuery}" n'est pas (encore) dans la bibliothèque.` : `Cette catégorie est vide.`}</p>
                             {searchQuery && (
                                 <button
                                     onClick={async () => {
                                     try {
                                         await fetch('/api/requests', {
                                             method: 'POST',
                                             headers: { 'Content-Type': 'application/json' },
                                             body: JSON.stringify({ userId: activeUser.id, userName: activeUser.name, title: searchQuery })
                                         });
                                         notify('Votre demande a bien été envoyée à l\'administrateur !', 'Succès');
                                         setSearchQuery('');
                                     } catch (e) {
                                         notify('Erreur lors de la demande.', 'Erreur');
                                     }
                                 }}
                                 className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-full transition shadow-lg"
                             >
                                 Demander l'ajout du film
                             </button>
                             )}
                         </div>
                    )}
                </div>
            ) : (
                <div className="space-y-8 lg:space-y-10">
                    {lists.map((list, idx) => {
                        if (list.films.length === 0 && !list.alwaysShow) return null;
                        
                        return (
                            <div key={idx} className="space-y-4 lg:space-y-6">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-xl lg:text-2xl font-medium text-zinc-900 dark:text-white">{list.title}</h3>
                                    {list.isCategory && (
                                        <button 
                                            onClick={() => setSelectedGenre(list.title)}
                                            className="text-sm font-medium text-zinc-500 hover:text-red-500 transition-colors"
                                        >
                                            Tout voir
                                        </button>
                                    )}
                                </div>
                                {list.films.length > 0 ? (
                                    <MovieGrid films={list.films} activeUser={activeUser} onPlay={onPlay} onToggleList={toggleMyList} transcodingStatuses={transcodingStatuses} onRemoveFromContinueWatching={list.isContinueWatching ? handleRemoveProgress : undefined} />
                                ) : (
                                    <div className="p-8 text-center text-zinc-500 bg-zinc-900/20 rounded-xl border border-zinc-800 border-dashed text-sm">
                                        Cette catégorie est vide pour le moment.
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            
        </div>
    );
}
