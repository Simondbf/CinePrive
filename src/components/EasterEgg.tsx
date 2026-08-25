import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
    onClose: () => void;
}

const quotes = [
    { texte: "Que la Force soit avec toi.", film: "Star Wars" },
    { texte: "Non, je suis ton père.", film: "Star Wars : L'Empire contre-attaque" },
    { texte: "Je suis le roi du monde !", film: "Titanic" },
    { texte: "Houston, nous avons un problème.", film: "Apollo 13" },
    { texte: "Un anneau pour les gouverner tous.", film: "Le Seigneur des anneaux" },
    { texte: "Le précieux...", film: "Le Seigneur des anneaux" },
    { texte: "Vers l'infini et au-delà !", film: "Toy Story" },
    { texte: "Je s'appelle Groot.", film: "Les Gardiens de la Galaxie" },
    { texte: "Je reviendrai.", film: "Terminator" },
    { texte: "Hasta la vista, baby.", film: "Terminator 2 : Le Jugement dernier" },
    { texte: "La vie, c'est comme une boîte de chocolats.", film: "Forrest Gump" },
    { texte: "C'est à moi que tu parles ?", film: "Taxi Driver" },
    { texte: "On ne laisse pas Bébé dans un coin.", film: "Dirty Dancing" },
    { texte: "Hakuna Matata !", film: "Le Roi Lion" },
    { texte: "Je vais lui faire une offre qu'il ne pourra pas refuser.", film: "Le Parrain" },
    { texte: "La vie trouve toujours un chemin.", film: "Jurassic Park" },
    { texte: "Nom de Zeus !", film: "Retour vers le futur" },
    { texte: "E.T. téléphone maison.", film: "E.T. l'extra-terrestre" },
    { texte: "Il nous faudrait un plus gros bateau.", film: "Les Dents de la mer" },
    { texte: "Adrienne !", film: "Rocky" },
    { texte: "Il n'y a pas de cuillère.", film: "Matrix" },
    { texte: "Pourquoi le rhum a-t-il disparu ?", film: "Pirates des Caraïbes" },
    { texte: "Force et honneur.", film: "Gladiator" },
    { texte: "Ô Capitaine, mon Capitaine !", film: "Le Cercle des poètes disparus" },
    { texte: "Tout le monde peut cuisiner.", film: "Ratatouille" },
    { texte: "Libérée, délivrée !", film: "La Reine des neiges" },
    { texte: "Pas de bras, pas de chocolat.", film: "Intouchables" },
    { texte: "Jusqu'ici tout va bien.", film: "La Haine" },
    { texte: "Il s'appelle Juste Leblanc.", film: "Le Dîner de cons" },
];

const repliques = quotes;

export default function EasterEgg({ onClose }: Props) {
    const [currentIndex, setCurrentIndex] = useState(() => Math.floor(Math.random() * repliques.length));
    // Faux aleatoire : les 3 derniers tirages sont ecartes pour qu'une meme
    // replique ne revienne pas dans la foulee.
    const recentsRef = useRef<number[]>([]);

    useEffect(() => {
        const tirer = () => {
            let i = Math.floor(Math.random() * repliques.length);
            while (recentsRef.current.includes(i)) {
                i = Math.floor(Math.random() * repliques.length);
            }
            recentsRef.current = [...recentsRef.current, i].slice(-3);
            return i;
        };
        setCurrentIndex(tirer());
        const interval = setInterval(() => setCurrentIndex(tirer()), 3500);
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
                            "{repliques[currentIndex].texte}"
                        </h2>
                        <p className="mt-6 text-sm md:text-base font-serif italic text-zinc-400 tracking-wide">
                            {repliques[currentIndex].film}
                        </p>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
