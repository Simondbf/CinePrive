import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { motion } from 'motion/react';

export default function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black text-white selection:bg-primary-500/30 overflow-hidden">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="flex flex-col items-center text-center p-6 max-w-2xl"
            >
                <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-zinc-800 dark:text-zinc-800 mb-2 select-none">
                    404
                </h1>
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-8">
                    Erreur 404
                </h2>
                
                <p className="text-xl md:text-2xl text-zinc-400 font-serif italic mb-12 tracking-wide">
                    "J'ai glissé, chef !"
                </p>

                <button 
                    onClick={() => navigate('/')}
                    className="flex items-center gap-3 px-6 py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white rounded-full transition-all duration-300 font-medium group"
                >
                    <Home className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
                    Retour à l'accueil
                </button>
            </motion.div>
        </div>
    );
}
