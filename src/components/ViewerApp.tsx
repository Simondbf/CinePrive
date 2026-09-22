import React, { useState, useMemo, useEffect } from 'react';
import { apiGet } from '../lib/api';
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

// Tris des grilles de resultats. A annee egale, ou sans annee connue, on
// retombe sur le titre ; les films sans annee passent a la fin.
const parTitre = (a: Film, b: Film) => (a.title || '').localeCompare(b.title || '', 'fr');
const parAnnee = (a: Film, b: Film) => {
    const ya = Number(a.year) || Infinity;
    const yb = Number(b.year) || Infinity;
    return ya !== yb ? ya - yb : parTitre(a, b);
};

// Ces deux rubriques ont leur propre ordre, qui fait leur sens : la date d'ajout.
const RUBRIQUES_PAR_DATE_AJOUT = ["🎬 Nouveautés", "⏳ Bientôt disponible"];

export default function ViewerApp({ activeUser, films, onPlay, onUpdateUser, transcodingStatuses, searchQuery, setSearchQuery, selectedGenre, setSelectedGenre }: Props) {
    const [progress, setProgress] = useState<Record<string, number>>({});

    // apiGet controle res.ok : sans lui, un 403 remplacait la table de progression
    // par un objet d'erreur.
    useEffect(() => {
        let annule = false;
        apiGet<Record<string, number>>('/api/progress', {}).then(data => {
            if (!annule) setProgress(data || {});
        });
        return () => { annule = true; };
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

    const toggleSeen = async (filmId: string) => {
        try {
            const res = await fetch(`/api/films/${filmId}/seen`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                onUpdateUser({ ...activeUser, seenFilms: data.seenFilms });
            }
        } catch (e) {
            console.error("Toggle seen error", e);
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

        const isProcessing = (f: Film) => f.status === 'PROCESSING' || (f.filename?.toLowerCase().endsWith('.mkv') || f.originalName?.toLowerCase().endsWith('.mkv'));

        // Nouveautes : dix jours, pas davantage — au-dela ce n'est plus une nouveaute.
        const dixJours = new Date();
        dixJours.setDate(dixJours.getDate() - 10);
        
        const bientotDisponibleFilms = films
            .filter(f => isProcessing(f))
            .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

        const nouveautes = films
            .filter(f => !isProcessing(f))
            .filter(f => new Date(f.addedAt) >= dixJours)
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
        films.filter(f => !isProcessing(f)).forEach(f => {
            const filmGenres = f.genres || [f.genre];
            filmGenres.forEach((g: string) => {
                if (!categories.has(g)) categories.set(g, []);
                categories.get(g)!.push(f);
            });
        });

        // Structure d'affichage pour iterer facilement (Structural prototype)
        // Catalogue complet, trie par titre, pour retrouver un film sans
        // passer par les genres.
        const tousLesFilms = films
            .filter(f => !isProcessing(f))
            .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'fr'));

        const blocs = [
            { title: "🎬 Reprendre la lecture", films: reprendreFilms, alwaysShow: false, isContinueWatching: true },
            { title: "🎬 Nouveautés", films: nouveautes, alwaysShow: false, isCategory: true },
            { title: "⏳ Bientôt disponible", films: bientotDisponibleFilms, alwaysShow: false, isCategory: true },
            { title: "📌 Ma Liste", films: maListeFilms, alwaysShow: false, isCategory: true },
            { title: "🎞️ Tous les films", films: tousLesFilms, alwaysShow: false, isCategory: true },
            { title: "👁️ Déjà vus", films: films.filter(f => (activeUser.seenFilms || []).includes(f.id) && !isProcessing(f)), alwaysShow: false, isCategory: true }
        ];

        Array.from(categories.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([genre, gFilms]) => {
            blocs.push({ title: genre, films: gFilms, alwaysShow: false, isCategory: true });
        });

        return blocs;
    }, [films, activeUser.myList, activeUser.seenFilms, searchQuery, selectedGenre, progress]);

    // Tri choisi par le membre et memorise sur cet appareil. Lu une fois a
    // l'initialisation, ecrit dans le gestionnaire du bouton : pas d'Effect.
    const cleTri = `triFilms_${activeUser.id}`;
    const [tri, setTri] = useState<'alpha' | 'annee'>(() => {
        try { return localStorage.getItem(cleTri) === 'annee' ? 'annee' : 'alpha'; } catch { return 'alpha'; }
    });
    const choisirTri = (t: 'alpha' | 'annee') => {
        setTri(t);
        try { localStorage.setItem(cleTri, t); } catch { /* stockage indisponible : le choix vaut pour la session */ }
    };
    const vueTriable = !!searchQuery || (!!selectedGenre && !RUBRIQUES_PAR_DATE_AJOUT.includes(selectedGenre));

    const displayedFilms = useMemo(() => {
        const trier = (liste: Film[]) => [...liste].sort(tri === 'annee' ? parAnnee : parTitre);
        const isProcessing = (f: Film) => f.status === 'PROCESSING' || (f.filename?.toLowerCase().endsWith('.mkv') || f.originalName?.toLowerCase().endsWith('.mkv'));
        
        if (searchQuery) return trier(films.filter(f => f.title.toLowerCase().includes(searchQuery.toLowerCase())));
        if (selectedGenre) {
            if (selectedGenre === "📌 Ma Liste") return trier(films.filter(f => activeUser.myList?.includes(f.id)));
            if (selectedGenre === "🎬 Nouveautés") {
                const limite = new Date();
                limite.setDate(limite.getDate() - 10);
                return films.filter(f => !isProcessing(f) && new Date(f.addedAt) >= limite).sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
            }
            if (selectedGenre === "⏳ Bientôt disponible") {
                return films.filter(f => isProcessing(f)).sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
            }
            if (selectedGenre === "👁️ Déjà vus") {
                return trier(films.filter(f => (activeUser.seenFilms || []).includes(f.id) && !isProcessing(f)));
            }
            if (selectedGenre === "🎞️ Tous les films") {
                return trier(films.filter(f => !isProcessing(f)));
            }
            return trier(films.filter(f => !isProcessing(f) && (f.genres || [f.genre]).includes(selectedGenre)));
        }
        return [];
    }, [films, searchQuery, selectedGenre, activeUser.myList, activeUser.seenFilms, tri]);

    return (
        <div className="p-6 lg:p-12 pb-24 max-w-[1600px] mx-auto space-y-8 lg:space-y-10">
            {/* Corps de l'interface */}
            {(searchQuery || selectedGenre) ? (
                <div>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                        <h3 className="text-xl font-medium text-zinc-900 dark:text-white">
                            {searchQuery ? `Résultats pour "${searchQuery}" (${displayedFilms.length})` : `Catégorie : ${selectedGenre} (${displayedFilms.length})`}
                        </h3>
                        <div className="flex items-center gap-4">
                        {vueTriable && displayedFilms.length > 1 && (
                            <div role="group" aria-label="Ordre d'affichage" className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5 text-sm">
                                {([['alpha', 'A → Z'], ['annee', 'Par année']] as const).map(([valeur, libelle]) => (
                                    <button
                                        key={valeur}
                                        onClick={() => choisirTri(valeur)}
                                        aria-pressed={tri === valeur}
                                        className={`px-3 py-1 rounded-md transition ${tri === valeur
                                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                                    >
                                        {libelle}
                                    </button>
                                ))}
                            </div>
                        )}
                        {selectedGenre && (
                            <button 
                                onClick={() => setSelectedGenre(null)}
                                className="text-sm font-medium text-primary-600 hover:text-primary-500"
                            >
                                Retour à l'accueil
                            </button>
                        )}
                        </div>
                    </div>
                    {displayedFilms.length > 0 ? (
                         <MovieGrid films={displayedFilms} activeUser={activeUser} onPlay={onPlay} onToggleList={toggleMyList} onToggleSeen={toggleSeen} transcodingStatuses={transcodingStatuses} isCompleteGrid={true} />
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
                                 className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white font-medium rounded-full transition shadow-lg"
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
                                            className="text-sm font-medium text-zinc-500 hover:text-primary-500 transition-colors"
                                        >
                                            Tout voir
                                        </button>
                                    )}
                                </div>
                                {list.films.length > 0 ? (
                                    <MovieGrid films={list.films} activeUser={activeUser} onPlay={onPlay} onToggleList={toggleMyList} onToggleSeen={toggleSeen} transcodingStatuses={transcodingStatuses} onRemoveFromContinueWatching={list.isContinueWatching ? handleRemoveProgress : undefined} />
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
