import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Film } from 'lucide-react';

interface Props {
    onClose: () => void;
}

const quotes = [
    "Que la Force soit avec toi.",
    "Je suis le roi du monde !",
    "Houston, nous avons un problème.",
    "Un anneau pour les gouverner tous.",
    "Vers l'infini et au-delà !",
    "Je s'appelle Groot.",
    "Je reviendrai.",
    "La vie, c'est comme une boîte de chocolats.",
    "C'est à moi que tu parles ?",
    "Hasta la vista, baby.",
    "On ne laisse pas Bébé dans un coin.",
    "Le précieux..."
];

export default function EasterEgg({ onClose }: Props) {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        setCurrentIndex(Math.floor(Math.random() * quotes.length));
        const interval = setInterval(() => {
            setCurrentIndex(prev => {
                let next = Math.floor(Math.random() * quotes.length);
                while (next === prev) {
                    next = Math.floor(Math.random() * quotes.length);
                }
                return next;
            });
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden">
            <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white z-50 transition p-2 rounded-full hover:bg-white/10">
                <X className="w-8 h-8" />
            </button>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <div className="w-[100vw] h-[100vw] sm:w-[50vw] sm:h-[50vw] border-[1px] border-red-500/30 rounded-full animate-[spin_10s_linear_infinite]" />
                <div className="absolute w-[80vw] h-[80vw] sm:w-[40vw] sm:h-[40vw] border-[1px] border-red-500/20 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
            </div>
            <div className="relative z-10 p-8 flex flex-col items-center max-w-2xl text-center">
                <Film className="w-16 h-16 text-red-600 mb-8 animate-pulse" />
                <AnimatePresence mode="wait">
                    <motion.h2 
                        key={currentIndex}
                        initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                        transition={{ duration: 0.8 }}
                        className="text-4xl md:text-5xl lg:text-7xl font-bold text-white tracking-tight italic"
                    >
                        "{quotes[currentIndex]}"
                    </motion.h2>
                </AnimatePresence>
            </div>
        </div>
    );
}
