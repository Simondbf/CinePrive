import React, { useState, useEffect } from 'react';
import { CheckCircle, BarChart3, Edit3 } from 'lucide-react';
import { User } from '../types';

export default function Polls({ activeUser }: { activeUser: User }) {
    const [votes, setVotes] = useState<Record<string, string>>({});
    const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
    const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

    const handleVote = (pollId: string, optionId: string) => {
        setVotes(v => ({ ...v, [pollId]: optionId }));
    };
    
    const handleCustomInput = (pollId: string, text: string) => {
        setCustomInputs(prev => ({ ...prev, [pollId]: text }));
        if (text) {
            handleVote(pollId, 'custom');
        }
    };

    const [pollsConfig, setPollsConfig] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/polls/config').then(r => r.json()).then(setPollsConfig).catch(console.error);
    }, []);

    const submitVote = async (pollId: string) => {
        const optionId = votes[pollId];
        const customText = customInputs[pollId];
        
        try {
            const res = await fetch('/api/polls/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pollId, vote: optionId, customText, userId: activeUser?.id })
            });
            if (res.ok) {
                setSubmitted(v => ({ ...v, [pollId]: true }));
            }
        } catch (e) { console.error(e) }
    };

    return (
        <div className="p-6 md:p-12 pb-24 max-w-[800px] mx-auto">
            <div className="mb-8 p-6 bg-red-600 border border-red-500 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    <BarChart3 className="w-6 h-6" />
                    Sondages Fondateurs
                </h2>
                <p className="text-red-100 text-sm max-w-xl">
                    Participez à la construction de la plateforme. En tant qu'utilisateur de la première heure, votre avis compte sur la Direction Artistique et les prochaines fonctionnalités.
                </p>
            </div>

            <div className="space-y-6">
                {pollsConfig.length === 0 ? (
                    <div className="text-center p-12 text-zinc-500">Chargement...</div>
                ) : pollsConfig.map(poll => (
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
                                
                                {poll.options.length > 0 && (
                                    <label className={`flex flex-col p-4 border rounded cursor-pointer transition ${votes[poll.id] === 'custom' ? 'border-red-500 bg-red-50 dark:bg-red-500/10' : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                                        <div className="flex items-center">
                                            <input 
                                                type="radio" name={poll.id} 
                                                checked={votes[poll.id] === 'custom'} 
                                                onChange={() => handleVote(poll.id, 'custom')}
                                                className="w-4 h-4 text-red-600 border-zinc-300 focus:ring-red-500 mt-1"
                                            />
                                            <span className="ml-3 font-medium text-zinc-900 dark:text-white flex items-center gap-2"><Edit3 className="w-4 h-4"/> Autre suggestion :</span>
                                        </div>
                                        <input 
                                            type="text"
                                            value={customInputs[poll.id] || ''}
                                            onChange={(e) => handleCustomInput(poll.id, e.target.value)}
                                            onClick={() => handleVote(poll.id, 'custom')}
                                            placeholder="Votre proposition..."
                                            className="mt-3 ml-7 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-sm text-zinc-900 dark:text-white"
                                        />
                                    </label>
                                )}
                                
                                {poll.options.length === 0 && (
                                    <div className="pt-2">
                                        <textarea 
                                            value={customInputs[poll.id] || ''}
                                            onChange={(e) => handleCustomInput(poll.id, e.target.value)}
                                            placeholder="Saisissez vos idées de noms de domaine ici..."
                                            className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded p-4 text-sm text-zinc-900 dark:text-white min-h-[100px] resize-none"
                                        />
                                    </div>
                                )}
                                
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
