import React, { useState } from 'react';
import { CheckCircle, BarChart3 } from 'lucide-react';

export default function Polls() {
    // Simple state local pour simuler un vote.
    // Dans une vraie app, cela serait envoyé à l'API via POST /api/polls
    const [votes, setVotes] = useState<Record<string, string>>({});
    const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

    const handleVote = (pollId: string, optionId: string) => {
        setVotes(v => ({ ...v, [pollId]: optionId }));
    };

    const submitVote = (pollId: string) => {
        setSubmitted(v => ({ ...v, [pollId]: true }));
        // API call would go here
    };

    const polls = [
        {
            id: 'p1',
            title: 'Identité Visuelle & Logo',
            desc: "Quel emblème vous parle le plus pour représenter notre bibliothèque ?",
            options: [
                { id: 'o1', label: 'La pellicule classique' },
                { id: 'o2', label: 'L\'ordinateur/moniteur' },
                { id: 'o3', label: 'Une forme géométrique abstraite neutre' }
            ]
        },
        {
            id: 'p2',
            title: 'Couleur de Marque',
            desc: "Sachant qu'un mode clair et sombre existe, quelle couleur d'accent préférez-vous ?",
            options: [
                { id: 'o1', label: 'Rouge Cinéma (Netflix-like)' },
                { id: 'o2', label: 'Bleu Profond (Prime/Max)' },
                { id: 'o3', label: 'Or / Jaune (Prestige)' },
                { id: 'o4', label: 'Violet Électrique' }
            ]
        },
        {
            id: 'p3',
            title: 'Nom de domaine',
            desc: "Dans l'éventualité d'étendre la plateforme avec Gringotts (inventaire global), quel type de nom serait le meilleur ?",
            options: [
                { id: 'o1', label: 'Neutre et court (ex: nexo.uk, vault.fr)' },
                { id: 'o2', label: 'Explicite Cinéma (ex: cineprive.fr)' },
                { id: 'o3', label: 'Orienté Écosystème (ex: mediacore.net)' }
            ]
        },
        {
            id: 'p4',
            title: 'Intégration Gringotts',
            desc: "Lier la gestion de l'inventaire physique/virtuel Gringotts et le streaming CinéPrivé vous semble-t-il pertinent ?",
            options: [
                { id: 'o1', label: 'Oui, tout au même endroit sous un même nom' },
                { id: 'o2', label: 'Non, garder les deux apps séparées' },
                { id: 'o3', label: 'Peu importe' }
            ]
        }
    ];

    return (
        <div className="p-6 md:p-12 pb-24 max-w-[800px] mx-auto">
            <div className="mb-8 p-6 bg-red-600 border border-red-500 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    <BarChart3 className="w-6 h-6" />
                    Sondages Fondateurs
                </h2>
                <p className="text-red-100 text-sm max-w-xl">
                    Participez à la construction de la plateforme. En tant qu'utilisateur de la première heure, votre avis compte sur la Direction Artistique et les prochaines fonctionnalités (notamment Gringotts).
                </p>
            </div>

            <div className="space-y-8">
                {polls.map(poll => (
                    <div key={poll.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                        <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">{poll.title}</h3>
                        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">{poll.desc}</p>
                        
                        {submitted[poll.id] ? (
                            <div className="py-8 text-center text-green-600 dark:text-green-500 flex flex-col items-center justify-center">
                                <CheckCircle className="w-8 h-8 mb-2" />
                                <p className="font-medium">A voté ! Les résultats seront annoncés bientôt.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {poll.options.map(opt => (
                                    <label 
                                        key={opt.id} 
                                        className={`flex items-center p-4 border rounded cursor-pointer transition ${votes[poll.id] === opt.id ? 'border-red-500 bg-red-50 dark:bg-red-500/10' : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                                    >
                                        <input 
                                            type="radio" name={poll.id} 
                                            checked={votes[poll.id] === opt.id} 
                                            onChange={() => handleVote(poll.id, opt.id)}
                                            className="w-4 h-4 text-red-600 border-zinc-300 focus:ring-red-500"
                                        />
                                        <span className="ml-3 font-medium text-zinc-900 dark:text-white">{opt.label}</span>
                                    </label>
                                ))}
                                <button 
                                    onClick={() => submitVote(poll.id)}
                                    disabled={!votes[poll.id]}
                                    className="mt-4 w-full py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-semibold rounded disabled:opacity-50 hover:opacity-80 transition"
                                >
                                    Valider mon choix
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
