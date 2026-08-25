import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
    onClose: () => void;
}

const quotes = [
    { texte: "Que la Force soit avec toi.", film: "Star Wars" },
    { texte: "Je suis le roi du monde !", film: "Titanic" },
    { texte: "Houston, nous avons un problème.", film: "Apollo 13" },
    { texte: "Un anneau pour les gouverner tous.", film: "Le Seigneur des anneaux" },
    { texte: "Vers l'infini et au-delà !", film: "Toy Story" },
    { texte: "Je s'appelle Groot.", film: "Les Gardiens de la Galaxie" },
    { texte: "Je reviendrai.", film: "Terminator" },
    { texte: "La vie, c'est comme une boîte de chocolats.", film: "Forrest Gump" },
    { texte: "C'est à moi que tu parles ?", film: "Taxi Driver" },
    { texte: "Hasta la vista, baby.", film: "Terminator 2 : Le Jugement dernier" },
    { texte: "On ne laisse pas Bébé dans un coin.", film: "Dirty Dancing" },
    { texte: "Le précieux...", film: "Le Seigneur des anneaux" }
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
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.02 }}
                        transition={{ duration: 1.2, ease: "easeInOut" }}
                    >
                        <h2 className="text-3xl md:text-5xl lg:text-6xl font-serif text-white tracking-widest leading-relaxed uppercase">
                            "{quotes[currentIndex].texte}"
                        </h2>
                        <p className="mt-6 text-sm md:text-base font-serif italic text-zinc-400 tracking-wide">
                            {quotes[currentIndex].film}
                        </p>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
