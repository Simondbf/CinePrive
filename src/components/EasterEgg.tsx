import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

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
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden cursor-pointer"
            onClick={onClose}
        >
            <div className="relative z-10 p-8 flex flex-col items-center max-w-4xl text-center">
                <AnimatePresence mode="wait">
                    <motion.h2 
                        key={currentIndex}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.02 }}
                        transition={{ duration: 1.2, ease: "easeInOut" }}
                        className="text-3xl md:text-5xl lg:text-6xl font-serif text-white tracking-widest leading-relaxed uppercase"
                    >
                        "{quotes[currentIndex]}"
                    </motion.h2>
                </AnimatePresence>
            </div>
        </div>
    );
}
