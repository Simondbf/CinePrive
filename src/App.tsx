import React, { useState, useEffect } from 'react';
import { Film, User } from './types';
import { Monitor, Settings, Home, LogOut, UploadCloud, Heart, ListChecks, Inbox } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import AuthScreen from './components/AuthScreen';
import Player from './components/Player';
import ViewerApp from './components/ViewerApp';
import ContributeApp from './components/ContributeApp';
import FundingModal from './components/FundingModal';
import EasterEgg from './components/EasterEgg';
import SettingsModal from './components/SettingsModal';
import Polls from './components/Polls';

export default function App() {
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [films, setFilms] = useState<Film[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Routing Local Mode: 'viewer', 'upload', 'polls'
  const [viewMode, setViewMode] = useState<'viewer' | 'upload' | 'polls'>('viewer');
  const [playingFilm, setPlayingFilm] = useState<Film | null>(null);
  const [showFunding, setShowFunding] = useState(false);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInbox, setShowInbox] = useState(false);

  // Theme & Amoled States
  const [themeMode, setThemeMode] = useState<'light'|'dark'|'system'>('system');
  const [amoledUnlocked, setAmoledUnlocked] = useState(false);
  const [amoledActive, setAmoledActive] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);

  useEffect(() => {
     // Retrieve saved settings
     const savedAmoledUnlocked = localStorage.getItem('amoledUnlocked') === 'true';
     const savedAmoledActive = localStorage.getItem('amoledActive') === 'true';
     const savedTheme = localStorage.getItem('themeMode') as 'light'|'dark'|'system' || 'system';
     
     if (savedAmoledUnlocked) setAmoledUnlocked(true);
     if (savedAmoledActive && savedAmoledUnlocked) setAmoledActive(true);
     setThemeMode(savedTheme);
  }, []);

  // Theme Applier Effect
  useEffect(() => {
      localStorage.setItem('themeMode', themeMode);
      localStorage.setItem('amoledActive', amoledActive.toString());

      const root = window.document.documentElement;
      
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = themeMode === 'dark' || (themeMode === 'system' && isSystemDark);
      
      if (shouldBeDark) {
          root.classList.add('dark');
      } else {
          root.classList.remove('dark');
      }

      if (amoledActive && shouldBeDark && amoledUnlocked) {
          root.classList.add('amoled');
      } else {
          root.classList.remove('amoled');
      }
  }, [themeMode, amoledActive, amoledUnlocked]);

  const handleLogoClick = () => {
      const newTaps = logoTaps + 1;
      setLogoTaps(newTaps);
      if (newTaps === 7 && !amoledUnlocked) {
          setAmoledUnlocked(true);
          setAmoledActive(true);
          localStorage.setItem('amoledUnlocked', 'true');
          alert("Option Développeur Déverrouillée : Mode AMOLED ! Vos paramètres ont été mis à jour.");
          setLogoTaps(0);
      }
      
      // Réinitialiser le compteur si l'utilisateur ne clique pas rapidement
      setTimeout(() => setLogoTaps(0), 1000);
  };

  useEffect(() => {
    fetchFilms();

    // -- EASTER EGG FALLBACK --
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIndex = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === konamiCode[konamiIndex]) {
            konamiIndex++;
            if (konamiIndex === konamiCode.length) {
                setShowEasterEgg(true);
                konamiIndex = 0;
            }
        } else {
            konamiIndex = 0;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);

  }, []);

  const fetchFilms = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/films');
      if (res.ok) setFilms(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  if (playingFilm) {
    return <Player film={playingFilm} activeUser={activeUser} onClose={() => setPlayingFilm(null)} />;
  }

  // Auth Screen
  if (!activeUser) {
    return <AuthScreen onLogin={setActiveUser} />;
  }

  // Navbar shared between Viewer and Admin
  const Navbar = () => (
      <nav className="sticky top-0 w-full z-40 bg-zinc-50/90 dark:bg-[#111315]/90 dark:amoled:bg-black/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-900 flex items-center px-6 md:px-12 py-4 transition-colors">
        <div 
           className="text-xl font-bold tracking-tight mr-10 flex items-center gap-2 text-red-600 cursor-pointer select-none"
           onClick={handleLogoClick}
        >
            <Monitor className="w-6 h-6" /> CinéPrivé
        </div>
        
        <div className="flex items-center gap-3 md:gap-4 ml-auto">
            <button 
                onClick={() => setShowInbox(true)}
                className="relative p-1.5 text-zinc-500 hover:text-red-600 transition"
            >
                <Inbox className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-black"></span>
            </button>

            <button 
                onClick={() => setViewMode('polls')}
                className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full border transition ${viewMode === 'polls' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 border-red-500/20' : 'text-zinc-600 dark:text-zinc-400 hover:text-red-600 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}
            >
                <ListChecks className="w-4 h-4" /> <span className="hidden md:inline">Sondages</span>
            </button>

            <button 
                onClick={() => setShowFunding(true)}
                className="flex items-center gap-2 text-sm font-medium text-pink-600 dark:text-pink-500/80 hover:text-pink-500 dark:hover:text-pink-400 bg-pink-50 dark:bg-pink-500/10 px-3 py-1.5 rounded-full border border-pink-200 dark:border-pink-500/20 transition"
            >
                <Heart className="w-4 h-4" /> <span className="hidden md:inline">Soutenir</span>
            </button>

            <button 
                onClick={() => setViewMode(viewMode === 'viewer' ? 'upload' : 'viewer')}
                className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-red-600 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded border border-zinc-200 dark:border-zinc-800 transition"
            >
                {viewMode === 'viewer' ? (
                    <><UploadCloud className="w-4 h-4"/> Ajouter un film</>
                ) : (
                    <><Home className="w-4 h-4"/> Retour aux films</>
                )}
            </button>

            <button 
                onClick={() => setShowSettings(true)}
                className="p-1.5 text-zinc-500 hover:text-red-600 transition"
            >
                <Settings className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pl-4 border-l border-zinc-200 dark:border-zinc-800 group relative">
                {activeUser.status === 'pending' && (
                    <span className="hidden md:inline text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-500 px-2 py-0.5 rounded border border-yellow-200 dark:border-yellow-700/50 mr-2">
                        Compte en attente de vérification
                    </span>
                )}
                <div className={`w-8 h-8 rounded shrink-0 ${activeUser.color || 'bg-red-600'} flex items-center justify-center font-bold text-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700`}>
                    {(activeUser.name || activeUser.username || '?').charAt(0).toUpperCase()}
                </div>
                <button 
                   onClick={() => { setActiveUser(null); setViewMode('viewer'); }}
                   className="absolute right-0 opacity-0 group-hover:opacity-100 translate-x-12 group-hover:translate-x-10 px-3 py-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium text-xs rounded transition-all shadow border border-zinc-300 dark:border-zinc-700 whitespace-nowrap z-50 flex items-center gap-1"
                >
                   <LogOut className="w-3 h-3" /> Quitter
                </button>
            </div>
        </div>
      </nav>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#111315] dark:amoled:bg-black text-zinc-900 dark:text-white font-sans selection:bg-red-500/30 transition-colors">
      <Navbar />
      
      <main>
        {viewMode === 'polls' ? (
           <Polls />
        ) : viewMode === 'viewer' ? (
           <ViewerApp 
               activeUser={activeUser} 
               films={films} 
               onPlay={(f) => setPlayingFilm(f)} 
               onUpdateUser={setActiveUser}
           />
        ) : (
           <ContributeApp activeUser={activeUser} films={films} onRefresh={fetchFilms} />
        )}
      </main>

      <AnimatePresence>
          {showInbox && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowInbox(false)} />
                  <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: -20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -20 }}
                      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden text-zinc-900 dark:text-white"
                  >
                      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                          <Inbox className="w-5 h-5 text-red-600" />
                          <h2 className="text-lg font-bold">Nouveautés</h2>
                      </div>
                      <div className="p-4 space-y-4 max-h-[300px] overflow-y-auto">
                          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 rounded-lg">
                              <span className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1 block">Aujourd'hui</span>
                              <h3 className="font-semibold text-sm mb-1">Mise à jour v1.2</h3>
                              <p className="text-sm text-zinc-600 dark:text-zinc-400">Ajout du mode AMOLED et personnalisation des profils.</p>
                          </div>
                          <div className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 p-8 text-center rounded-lg text-sm">
                              Il vous est possible de recevoir des notifications sur votre appareil, c'est ce qu'on appelle le Web Push, qui sera activé plus tard ! 🚀
                          </div>
                      </div>
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 text-right">
                          <button onClick={() => setShowInbox(false)} className="px-4 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-medium rounded text-sm hover:opacity-80 transition">Fermer</button>
                      </div>
                  </motion.div>
              </div>
          )}
          {showSettings && (
              <SettingsModal 
                 onClose={() => setShowSettings(false)}
                 themeMode={themeMode}
                 setThemeMode={setThemeMode}
                 amoledUnlocked={amoledUnlocked}
                 amoledActive={amoledActive}
                 setAmoledActive={setAmoledActive}
                 onTriggerEasterEgg={() => setShowEasterEgg(true)}
                 userId={activeUser.id}
              />
          )}
          {showFunding && <FundingModal onClose={() => setShowFunding(false)} />}
      </AnimatePresence>
      
      {showEasterEgg && <EasterEgg onClose={() => setShowEasterEgg(false)} />}
    </div>
  );
}
