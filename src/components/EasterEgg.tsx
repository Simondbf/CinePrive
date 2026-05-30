import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Film } from 'lucide-react';

interface Props {
    onClose: () => void;
}

export default function EasterEgg({ onClose }: Props) {
    const [quotes, setQuotes] = useState<string[]>([]);

    const allQuotes = [
        "May the Force be with you.",
        "I'm going to make him an offer he can't refuse.",
        "You're gonna need a bigger boat.",
        "Here's looking at you, kid.",
        "I'll be back.",
        "Houston, we have a problem.",
        "E.T. phone home.",
        "You can't handle the truth!",
        "I see dead people.",
        "Hasta la vista, baby.",
        "On ne laisse pas Bébé dans un coin.",
        "C'est à moi que tu parles ?",
        "Multipass !",
        "Vers l'infini et au-delà !",
        "Prends la pilule rouge...",
        "Je suis le maître du monde !",
        "C'est une bonne situation ça, scribe ?",
        "ALERTE GÉNÉRALE !!!",
        "Vous avez de la pâte ? Vous avez du suc' ?",
        "Pas de palais... pas de palais.",
        "Mais ils sont fous ces romains !",
        "Le gras, c'est la vie.",
        "Tu l'aimes mon rosbif ?",
        "On est pas bien là ? Paisibles... à la fraîche, décontractés du gland...",
        "Juste un doigt.",
        "Il a dit qu'il voyait pas le rapport."
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setQuotes(prev => {
                const newQuote = allQuotes[Math.floor(Math.random() * allQuotes.length)];
                return [...prev, newQuote].slice(-15);
            });
        }, 300);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden">
            <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white z-50 transition">
                <X className="w-8 h-8" />
            </button>
            
            {/* Vortex Background */}
            <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-50%] opacity-20 pointer-events-none flex items-center justify-center"
                style={{
                    background: 'conic-gradient(from 0deg, #ff0000, #ff00ff, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)',
                    filter: 'blur(100px)'
                }}
            />

            {/* Quotes */}
            <div className="absolute inset-0 pointer-events-none">
                {quotes.map((q, i) => (
                    <motion.div
                        key={i + q + Math.random()}
                        initial={{ y: -50, opacity: 0, scale: 0.5 }}
                        animate={{ y: window.innerHeight + 50, opacity: [0, 1, 1, 0], scale: [0.5, 1.5, 1, 0.5] }}
                        transition={{ duration: 3 + Math.random() * 2, ease: "linear" }}
                        className="absolute text-green-500 font-mono text-xl whitespace-nowrap font-bold text-shadow-glow"
                        style={{
                            left: `${Math.random() * 100}%`,
                            color: `hsl(${Math.random() * 360}, 100%, 70%)`
                        }}
                    >
                        {q}
                    </motion.div>
                ))}
            </div>

            <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="relative z-10 p-12 bg-white/10 backdrop-blur border border-white/20 rounded-full flex flex-col items-center shadow-[0_0_100px_rgba(255,255,255,0.5)]"
            >
                <Film className="w-24 h-24 text-white mb-4 animate-[spin_3s_linear_infinite]" />
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500">
                    CINÉMA SOUS LSD
                </h2>
                <p className="text-white mt-2 font-mono uppercase tracking-widest">Vous avez trouvé le secret !</p>
                <button onClick={onClose} className="mt-8 px-8 py-3 bg-white text-black font-bold uppercase rounded-full hover:scale-110 transition">
                    Me ramener à la réalité
                </button>
            </motion.div>

        </div>
    );
}
