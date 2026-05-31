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
}

export default function ViewerApp({ activeUser, films, onPlay, onUpdateUser }: Props) {
    const [searchQuery, setSearchQuery] = useState('');

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
    const [downloadedIds, setDownloadedIds] = useState<string[]>([]);
    
    useEffect(() => {
        try {
            setDownloadedIds(JSON.parse(localStorage.getItem(`downloads_${activeUser.id}`) || '[]'));
        } catch (e) {
            setDownloadedIds([]);
        }
    }, [activeUser.id]);

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
        const mesTelechargements = films.filter(f => downloadedIds.includes(f.id));

        // Grouping genres
        const categories = new Map<string, Film[]>();
        films.forEach(f => {
            if (!categories.has(f.genre)) categories.set(f.genre, []);
            categories.get(f.genre)!.push(f);
        });

        // Structure d'affichage pour iterer facilement (Structural prototype)
        const blocs = [
            { title: "🎬 Nouveautés", films: nouveautes, alwaysShow: false },
            { title: "📌 Ma Liste", films: maListeFilms, alwaysShow: true },
            { title: "⬇️ Mes Téléchargements", films: mesTelechargements, alwaysShow: true }
        ];

        Array.from(categories.entries()).forEach(([genre, gFilms]) => {
            blocs.push({ title: `Genre : ${genre}`, films: gFilms, alwaysShow: false });
        });

        return blocs;
    }, [films, activeUser.myList, searchQuery]);

    return (
        <div className="p-6 md:p-12 pb-24 max-w-[1600px] mx-auto space-y-12">
            
            {/* Header / Search Prototype */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex flex-col md:flex-row items-center gap-6 shadow-sm">
                 <div className="flex-1 w-full">
                     <h2 className="text-xl text-white font-medium mb-2">Espace de Visionnage</h2>
                     <p className="text-sm text-zinc-400">Parcourez la bibliothèque privée et construisez votre liste.</p>
                 </div>
                 <div className="w-full md:w-96 relative">
                     <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                     <input 
                         type="text" 
                         value={searchQuery}
                         onChange={(e) => setSearchQuery(e.target.value)}
                         placeholder="Rechercher un titre..."
                         className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all"
                     />
                 </div>
            </div>

            {/* Corps de l'interface */}
            {searchQuery ? (
                <div>
                    <h3 className="text-xl font-medium text-white mb-6">Résultats pour "{searchQuery}" ({filteredFilms.length})</h3>
                    {filteredFilms.length > 0 ? (
                         <MovieGrid films={filteredFilms} activeUser={activeUser} onPlay={onPlay} onToggleList={toggleMyList} />
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
                <div className="space-y-12">
                    {lists.map((list, idx) => {
                        if (list.films.length === 0 && !list.alwaysShow) return null;
                        
                        return (
                            <div key={idx} className="space-y-4">
                                <h3 className="text-xl font-medium text-white">{list.title}</h3>
                                {list.films.length > 0 ? (
                                    <MovieGrid films={list.films} activeUser={activeUser} onPlay={onPlay} onToggleList={toggleMyList} />
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
