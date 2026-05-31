import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Film, Unlock } from 'lucide-react';

interface Props {
    onClose: () => void;
}

export default function EasterEgg({ onClose }: Props) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden font-sans">
            <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white z-50 transition p-2 rounded-full hover:bg-white/10">
                <X className="w-8 h-8" />
            </button>
            
            {/* Minimal Grid Background */}
            <div 
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}
            />

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 p-12 bg-zinc-950 border border-zinc-800 rounded-3xl flex flex-col items-center shadow-2xl max-w-md w-full text-center"
            >
                <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mb-6">
                    <Unlock className="w-10 h-10 text-red-600" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                    Accès Privilégié
                </h2>
                <p className="text-zinc-400 mb-8 leading-relaxed">
                    Vous avez découvert la zone secrète de CinéPrivé. Votre curiosité prouve votre engagement envers notre écosystème.
                </p>
                <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left mb-8">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-xs text-zinc-500 font-mono uppercase">Statut Système</span>
                    </div>
                    <code className="text-sm text-green-400 font-mono">
                        // Niveau fondateur actif.<br/>
                        // Restrictions levées.<br/>
                        // Bienvenue chez vous.
                    </code>
                </div>
                <button onClick={onClose} className="w-full py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition">
                    Verrouiller et Retourner
                </button>
            </motion.div>
        </div>
    );
}
