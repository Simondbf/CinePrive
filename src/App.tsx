import React, { useState, useEffect } from 'react';
import { Film, User } from './types';
import { Monitor, Settings, Home, LogOut, UploadCloud, Heart, ListChecks, Inbox, ArrowLeft, Shield, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import AuthScreen from './components/AuthScreen';
import Player from './components/Player';
import ViewerApp from './components/ViewerApp';
import ContributeApp from './components/ContributeApp';
import FundingModal from './components/FundingModal';
import EasterEgg from './components/EasterEgg';
import SettingsModal from './components/SettingsModal';
import Polls from './components/Polls';
import Loader from './components/Loader';

export default function App() {
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [films, setFilms] = useState<Film[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Routing Local Mode: 'viewer', 'upload', 'polls', 'admin'
  const [viewMode, setViewMode] = useState<'viewer' | 'upload' | 'polls' | 'admin'>('viewer');
  const [playingFilm, setPlayingFilm] = useState<Film | null>(null);
  const [showFunding, setShowFunding] = useState(false);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [hasUnread, setHasUnread] = useState(() => localStorage.getItem('inbox_read') !== 'true');

  // Theme & Amoled States
  const [themeMode, setThemeMode] = useState<'light'|'dark'|'system'>('system');
  const [amoledUnlocked, setAmoledUnlocked] = useState(false);
  const [amoledActive, setAmoledActive] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
     // Retrieve saved settings
     const savedAmoledUnlocked = localStorage.getItem('salleObscureUnlocked') === 'true';
     const savedAmoledActive = localStorage.getItem('salleObscureActive') === 'true';
     const savedTheme = localStorage.getItem('themeMode') as 'light'|'dark'|'system' || 'system';
     
     if (savedAmoledUnlocked) setAmoledUnlocked(true);
     if (savedAmoledActive && savedAmoledUnlocked) setAmoledActive(true);
     setThemeMode(savedTheme);
  }, []);

  // Theme Applier Effect
  useEffect(() => {
      localStorage.setItem('themeMode', themeMode);
      localStorage.setItem('salleObscureActive', amoledActive.toString());

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
      if (viewMode !== 'viewer') {
          setViewMode('viewer');
          setLogoTaps(0);
          return;
      }
      
      const newTaps = logoTaps + 1;
      setLogoTaps(newTaps);
      if (newTaps === 7 && !amoledUnlocked) {
          setAmoledUnlocked(true);
          setAmoledActive(true);
          localStorage.setItem('salleObscureUnlocked', 'true');
          alert("« On ne laisse pas bébé dans un coin... » 💃\n\nFélicitations, vous avez déverrouillé le Mode Salle Obscure ! Rendez-vous dans les paramètres (engrenage).");
          setLogoTaps(0);
      }
      
      // Réinitialiser le compteur si l'utilisateur ne clique pas rapidement
      setTimeout(() => { if (logoTaps > 0) setLogoTaps(0) }, 1000);
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

  if (isLoading) {
    return <Loader />;
  }

  if (playingFilm) {
    return <Player film={playingFilm} activeUser={activeUser} onClose={() => setPlayingFilm(null)} />;
  }

  // Auth Screen
  if (!activeUser) {
    return <AuthScreen onLogin={setActiveUser} />;
  }

  // Navbar shared between Viewer and Admin
  const Navbar = () => (
      <nav className={`sticky top-0 w-full z-40 ${amoledActive ? 'bg-zinc-50/90 dark:bg-black/90' : 'bg-zinc-50/90 dark:bg-[#16181c]/90'} backdrop-blur border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 md:px-12 py-4 transition-colors`}>
        <div className="flex items-center gap-4">
            {viewMode !== 'viewer' && (
                <button 
                    onClick={() => setViewMode('viewer')}
                    className="p-2 -ml-2 text-zinc-500 hover:text-red-600 transition hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 rounded-full"
                    title="Retour"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
            )}
            <div 
               className="text-xl font-bold tracking-tight mr-2 md:mr-10 flex items-center gap-2 text-red-600 cursor-pointer select-none"
               onClick={handleLogoClick}
            >
                <Monitor className="w-6 h-6" /> CinéPrivé
            </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4 ml-auto">
            <button 
                onClick={() => {
                    setShowInbox(true);
                    setHasUnread(false);
                    localStorage.setItem('inbox_read', 'true');
                }}
                className="relative p-1.5 text-zinc-500 hover:text-red-600 transition"
            >
                <Inbox className="w-5 h-5" />
                {hasUnread && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-black"></span>}
            </button>

            <button 
                onClick={() => setViewMode('polls')}
                className={`flex items-center gap-2 text-sm font-medium p-2 md:px-3 md:py-1.5 rounded-full border transition ${viewMode === 'polls' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 border-red-500/20' : 'text-zinc-600 dark:text-zinc-400 hover:text-red-600 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}
                title="Sondages"
            >
                <ListChecks className="w-5 h-5 md:w-4 md:h-4" /> <span className="hidden md:inline">Sondages</span>
            </button>

            <button 
                onClick={() => setShowFunding(true)}
                className="flex items-center gap-2 text-sm font-medium text-pink-600 dark:text-pink-500/80 hover:text-pink-500 dark:hover:text-pink-400 bg-pink-50 dark:bg-pink-500/10 p-2 md:px-3 md:py-1.5 rounded-full border border-pink-200 dark:border-pink-500/20 transition"
                title="Soutenir"
            >
                <Heart className="w-5 h-5 md:w-4 md:h-4" /> <span className="hidden md:inline">Soutenir</span>
            </button>

            {(activeUser.role === 'owner' || activeUser.role === 'admin') && (
                <button 
                    onClick={() => setViewMode('admin')}
                    className={`flex items-center gap-2 text-sm font-medium p-2 md:px-3 md:py-1.5 rounded border transition ${viewMode === 'admin' ? 'bg-zinc-800 dark:bg-zinc-700 text-white border-zinc-700' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}
                    title="Administration"
                >
                    <Shield className="w-5 h-5 md:w-4 md:h-4"/> <span className="hidden md:inline">Administration</span>
                </button>
            )}

            <button 
                onClick={() => setViewMode('upload')}
                className={`flex items-center gap-2 text-sm font-medium p-2 md:px-3 md:py-1.5 rounded border transition ${viewMode === 'upload' ? 'bg-zinc-800 dark:bg-zinc-700 text-white border-zinc-700' : 'text-zinc-600 dark:text-zinc-400 hover:text-red-600 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}
                title="Ajouter un film"
            >
                <UploadCloud className="w-5 h-5 md:w-4 md:h-4"/> <span className="hidden lg:inline">Ajouter un film</span>
            </button>

            <button 
                onClick={() => setShowSettings(true)}
                className="p-1.5 text-zinc-500 hover:text-red-600 transition ml-2 border-l border-zinc-200 dark:border-zinc-800 pl-4"
            >
                <Settings className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pl-4 border-l border-zinc-200 dark:border-zinc-800 relative h-full">
                {activeUser.status === 'pending' && (
                    <span className="hidden md:inline text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-500 px-2 py-0.5 rounded border border-yellow-200 dark:border-yellow-700/50 mr-2">
                        Compte en attente
                    </span>
                )}
                <div 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className={`w-8 h-8 rounded shrink-0 ${activeUser.color || 'bg-red-600'} flex items-center justify-center font-bold text-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700 cursor-pointer`}
                >
                    {(activeUser.name || activeUser.username || '?').charAt(0).toUpperCase()}
                </div>
                
                {/* Netflix-style click dropdown */}
                {showUserMenu && (
                    <div className="absolute top-12 right-0 w-48 mt-2 transition-all duration-200 z-50 shadow-xl animate-in fade-in slide-in-from-top-2">
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded shadow-xl overflow-hidden flex flex-col">
                            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                                <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{activeUser.username}</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">{activeUser.role === 'owner' ? 'Fondateur' : activeUser.role}</p>
                            </div>
                            <button 
                                onClick={() => { 
                                    localStorage.removeItem('cine_remember');
                                    localStorage.removeItem('cine_remember_password');
                                    setActiveUser(null); 
                                    setViewMode('viewer'); 
                                    setShowUserMenu(false);
                                }}
                                className="w-full text-left px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center gap-2"
                            >
                               <LogOut className="w-4 h-4" /> Se déconnecter
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </nav>
  );

  return (
    <div className={`min-h-screen ${amoledActive ? 'bg-zinc-50 dark:bg-black' : 'bg-zinc-50 dark:bg-[#16181c]'} text-zinc-900 dark:text-white font-sans selection:bg-red-500/30 transition-colors`}>
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
        ) : viewMode === 'admin' ? (
           <ContributeApp activeUser={activeUser} films={films} onRefresh={fetchFilms} mode="admin" />
        ) : (
           <ContributeApp activeUser={activeUser} films={films} onRefresh={fetchFilms} mode="upload" />
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
                          <div className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 p-8 text-center rounded-lg text-sm">
                              Les notifications Web Push arriveront bientôt pour être toujours informé des nouvelles sorties ! 🚀
                          </div>
                      </div>
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex justify-between">
                          <button onClick={() => { setShowInbox(false); }} className="px-4 py-1.5 bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white font-medium rounded text-sm hover:opacity-80 transition flex items-center gap-2">
                              <Check className="w-4 h-4"/> Lu
                          </button>
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
