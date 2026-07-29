import React, { useState, useEffect } from 'react';
import { notify } from '../lib/notify';
import { motion } from 'motion/react';
import { Heart, X, Server, Coins, History } from 'lucide-react';
import { hasRole } from '../lib/roles';

interface Props {
    activeUser: any;
    onClose: () => void;
}

export default function FundingModal({ activeUser, onClose }: Props) {
    const [monthlyCost, setMonthlyCost] = useState(12.00);
    const [currentFunds, setCurrentFunds] = useState(0.00);
    const [contribution, setContribution] = useState('');
    const [showThanks, setShowThanks] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/settings').then(r => r.json()).then(data => {
            if (data.fundingGoal !== undefined) setMonthlyCost(data.fundingGoal);
            if (data.fundingCurrent !== undefined) setCurrentFunds(data.fundingCurrent);
        }).catch(err => console.error(err));

        if (hasRole(activeUser, 'owner')) {
            fetch('/api/settings/funding-history').then(r => r.json()).then(data => {
                setHistory(data);
            }).catch(err => console.error(err));
        }
    }, [activeUser]);

    const handleContribute = async () => {
        const amount = parseFloat(contribution);
        if (isNaN(amount) || amount <= 0) return;

        try {
            const res = await fetch('/api/settings/contribute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });
            const data = await res.json();
            if (data.success) {
                setCurrentFunds(data.fundingCurrent);
                setContribution('');
                setShowThanks(true);
                setTimeout(() => setShowThanks(false), 5000);
                
                if (hasRole(activeUser, 'owner')) {
                    fetch('/api/settings/funding-history').then(r => r.json()).then(data => {
                        setHistory(data);
                    }).catch(err => console.error(err));
                }
            } else {
                notify(data.error || 'Erreur', 'Erreur');
            }
        } catch (err) {
            console.error(err);
            notify('Erreur réseau', 'Erreur');
        }
    };

    const progress = Math.min((currentFunds / monthlyCost) * 100, 100);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden max-h-[90vh] flex flex-col"
            >
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-pink-600 dark:text-pink-500">
                        <Heart className="w-5 h-5 fill-pink-600 dark:fill-pink-500" />
                        Soutenir le Serveur
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    <div className="text-center">
                        <Server className="w-12 h-12 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
                        <p className="text-zinc-700 dark:text-zinc-300 text-sm">
                            CinéPrivé est hébergé sur un serveur privé pour vous garantir une qualité optimale sans publicité.
                        </p>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <div className="flex justify-between text-sm mb-2 font-medium">
                            <span className="text-zinc-500 dark:text-zinc-400">Objectif Mensuel</span>
                            <span className="text-zinc-900 dark:text-white">{currentFunds}€ / {monthlyCost}€</span>
                        </div>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-3 mb-2 overflow-hidden">
                            <div className="bg-pink-500 h-3 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                        </div>
                        <p className="text-xs text-zinc-500 text-center">
                            Il manque {(monthlyCost - currentFunds).toFixed(2)}€ ce mois-ci.
                        </p>
                    </div>

                    <p className="text-xs text-zinc-500 text-center">
                        Si vous aimez le service, vous pouvez participer librement aux frais d'hébergement. Aucune obligation !
                    </p>

                    <div className="flex flex-col gap-3">
                        <a 
                            href="https://revolut.me/simondeboeuf" 
                            target="_blank" rel="noopener noreferrer"
                            className="w-full bg-blue-600 text-white font-semibold py-3 rounded hover:bg-blue-500 transition flex items-center justify-center gap-2"
                        >
                            <Coins className="w-5 h-5" />
                            Participer via Revolut
                        </a>
                        <button 
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText('+33600000000'); // TODO: L'admin changera ce numéro en production
                                    notify('Numéro Wero copié dans le presse-papier !', 'Succès');
                                } catch (err) {
                                    notify('Copie manuelle : +33 6 XX XX XX XX', 'Information');
                                }
                            }}
                            className="w-full bg-purple-600 text-white font-semibold py-3 rounded hover:bg-purple-500 transition flex items-center justify-center gap-2"
                        >
                            <Heart className="w-5 h-5" />
                            Participer via Wero
                        </button>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-zinc-700 dark:text-zinc-300 whitespace-nowrap">J'ai participé de</span>
                            <input 
                                type="number" 
                                value={contribution}
                                onChange={e => setContribution(e.target.value)}
                                className="w-20 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-zinc-900 dark:text-white focus:outline-none focus:border-pink-500"
                                placeholder="0"
                                min="0"
                                step="1"
                            />
                            <span className="text-zinc-700 dark:text-zinc-300">euros</span>
                            <button 
                                onClick={handleContribute}
                                disabled={!contribution || parseFloat(contribution) <= 0}
                                className="ml-auto px-3 py-1 bg-pink-600 text-white rounded text-sm hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                Valider
                            </button>
                        </div>
                        {showThanks && (
                            <p className="text-xs text-green-600 dark:text-green-400 text-center font-medium">
                                Merci ! N'oubliez pas d'effectuer le transfert via l'application choisie.
                            </p>
                        )}
                    </div>
                    
                    {hasRole(activeUser, 'owner') && (
                        <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                                <History className="w-4 h-4 text-zinc-500" />
                                Historique des contributions
                            </h3>
                            {history.length === 0 ? (
                                <p className="text-xs text-zinc-500 italic">Aucune contribution pour le moment.</p>
                            ) : (
                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                    {history.slice().reverse().map((entry) => (
                                        <div key={entry.id} className="flex items-center justify-between text-xs bg-zinc-50 dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-zinc-900 dark:text-white">{entry.username}</span>
                                                <span className="text-zinc-500">{new Date(entry.date).toLocaleDateString()}</span>
                                            </div>
                                            <span className="font-bold text-pink-600 dark:text-pink-400">+{entry.amount}€</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </motion.div>
        </div>
    );
}
