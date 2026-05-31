import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Heart, X, Server, Coins } from 'lucide-react';

interface Props {
    onClose: () => void;
}

export default function FundingModal({ onClose }: Props) {
    const [monthlyCost, setMonthlyCost] = useState(12.00);
    const [currentFunds, setCurrentFunds] = useState(0.00); // requested default

    useEffect(() => {
        fetch('/api/settings').then(r => r.json()).then(data => {
            if (data.fundingGoal !== undefined) setMonthlyCost(data.fundingGoal);
            if (data.fundingCurrent !== undefined) setCurrentFunds(data.fundingCurrent);
        }).catch(err => console.error(err));
    }, []);

    const progress = Math.min((currentFunds / monthlyCost) * 100, 100);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden"
            >
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-gold-500">
                        <Heart className="w-5 h-5 fill-gold-500" />
                        Soutenir le Serveur
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="text-center">
                        <Server className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                        <p className="text-zinc-300 text-sm">
                            CinéPrivé est hébergé sur un serveur privé pour vous garantir une qualité optimale sans publicité.
                        </p>
                    </div>

                    <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                        <div className="flex justify-between text-sm mb-2 font-medium">
                            <span className="text-zinc-400">Objectif Mensuel</span>
                            <span className="text-white">{currentFunds}€ / {monthlyCost}€</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-3 mb-2 overflow-hidden">
                            <div className="bg-gold-500 h-3 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                        </div>
                        <p className="text-xs text-zinc-500 text-center">
                            Il manque {(monthlyCost - currentFunds).toFixed(2)}€ ce mois-ci.
                        </p>
                    </div>

                    <p className="text-xs text-zinc-500 text-center dark:text-zinc-400">
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
                        {/* 
                            Participation Wero
                        */}
                        <button 
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText('+33600000000'); // TODO: L'admin changera ce numéro en production
                                    alert('Numéro Wero de Simon copié dans le presse-papier !');
                                } catch (err) {
                                    alert('Copie manuelle : +33 6 XX XX XX XX');
                                }
                            }}
                            className="w-full bg-purple-600 text-white font-semibold py-3 rounded hover:bg-purple-500 transition flex items-center justify-center gap-2"
                        >
                            <Heart className="w-5 h-5" />
                            Participer via Wero (Copier le n°)
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
