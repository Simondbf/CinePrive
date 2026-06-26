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
}

export default function ViewerApp({ activeUser, films, onPlay, onUpdateUser, transcodingStatuses, searchQuery, setSearchQuery }: Props) {
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
        if (searchQuery) return []; // En mode recherche on n'affiche que les resultats

        const nouveautes = [...films]
            .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
            .slice(0, 12); // Garde les 12 derniers

        const maListeFilms = films.filter(f => activeUser.myList?.includes(f.id));

        // Grouping genres
        const categories = new Map<string, Film[]>();
        films.forEach(f => {
            if (!categories.has(f.genre)) categories.set(f.genre, []);
            categories.get(f.genre)!.push(f);
        });

        // Structure d'affichage pour iterer facilement (Structural prototype)
        const blocs = [
            { title: "🎬 Nouveautés", films: nouveautes, alwaysShow: false },
            { title: "📌 Ma Liste", films: maListeFilms, alwaysShow: true }
        ];

        Array.from(categories.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([genre, gFilms]) => {
            blocs.push({ title: `Genre : ${genre}`, films: gFilms, alwaysShow: false });
        });

        return blocs;
    }, [films, activeUser.myList, searchQuery]);

    return (
        <div className="p-6 md:p-12 pb-24 max-w-[1600px] mx-auto space-y-12">
            {/* Corps de l'interface */}
            {searchQuery ? (
                <div>
                    <h3 className="text-xl font-medium text-zinc-900 dark:text-white mb-6">Résultats pour "{searchQuery}" ({filteredFilms.length})</h3>
                    {filteredFilms.length > 0 ? (
                         <MovieGrid films={filteredFilms} activeUser={activeUser} onPlay={onPlay} onToggleList={toggleMyList} transcodingStatuses={transcodingStatuses} />
                    ) : (
                         <div className="p-12 flex flex-col items-center gap-4 justify-center text-center text-zinc-500 bg-zinc-900/50 rounded-xl border border-zinc-800 border-dashed">
                             <p>Le film "{searchQuery}" n'est pas (encore) dans la bibliothèque.</p>
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
                         </div>
                    )}
                </div>
            ) : (
                <div className="space-y-8 md:space-y-10">
                    {lists.map((list, idx) => {
                        if (list.films.length === 0 && !list.alwaysShow) return null;
                        
                        return (
                            <div key={idx} className="space-y-4 md:space-y-6">
                                <h3 className="text-xl md:text-2xl font-medium text-zinc-900 dark:text-white px-2">{list.title}</h3>
                                {list.films.length > 0 ? (
                                    <MovieGrid films={list.films} activeUser={activeUser} onPlay={onPlay} onToggleList={toggleMyList} transcodingStatuses={transcodingStatuses} />
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
