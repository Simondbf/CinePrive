import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Film, User } from './types';
import { notify } from './lib/notify';
import { Settings, Home, LogOut, UploadCloud, ListChecks, Inbox, ArrowLeft, Shield, Check, MessageSquare, X, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import AuthScreen from './components/AuthScreen';
import Player from './components/Player';
import ViewerApp from './components/ViewerApp';
import ContributeApp from './components/ContributeApp';
import InstallPrompt from './components/InstallPrompt';
import Logo from './components/Logo';
import EasterEgg from './components/EasterEgg';
import SettingsModal from './components/SettingsModal';
import BugReportModal from './components/BugReportModal';
import Polls from './components/Polls';
import Loader from './components/Loader';
import NotFoundPage from './components/NotFoundPage';
import GardeFou from './components/GardeFou';
import { ArrowUp } from 'lucide-react';
import { hasRole, primaryRole } from './lib/roles';

const ScrollToTop = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const toggleVisibility = () => {
            if (window.scrollY > 300) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };
        window.addEventListener('scroll', toggleVisibility);
        return () => window.removeEventListener('scroll', toggleVisibility);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={scrollToTop}
                    className="fixed bottom-6 right-6 p-3 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 hover:shadow-xl transition-all z-40"
                    title="Remonter en haut"
                >
                    <ArrowUp className="w-5 h-5" />
                </motion.button>
            )}
        </AnimatePresence>
    );
};

export default function App() {
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [films, setFilms] = useState<Film[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adminNotifs, setAdminNotifs] = useState<any[]>([]);

  const location = useLocation();
  const navigate = useNavigate();

  const [isUploading, setIsUploading] = useState(false);
  const [transcodingStatuses, setTranscodingStatuses] = useState<Record<string, any>>({});
  
  const viewMode = location.pathname === '/serveurs' ? 'admin' : location.pathname === '/upload' ? 'upload' : 'viewer';

  const setViewMode = (mode: 'viewer' | 'upload' | 'admin') => {
      if (isUploading && viewMode !== 'viewer') {
          if (!window.confirm("Un téléchargement est en cours. Si vous quittez la page, il sera annulé ! Êtes-vous sûr ?")) {
              return;
          }
      }
      if (mode === 'admin') navigate('/serveurs');
      else if (mode === 'upload') navigate('/upload');
      else navigate('/');
  };

  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPolls, setShowPolls] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [hasUnread, setHasUnread] = useState(() => localStorage.getItem('inbox_read') !== 'true');

  // Theme & Amoled States
  const [themeMode, setThemeMode] = useState<'light'|'dark'|'system'>('system');
  const [amoledUnlocked, setAmoledUnlocked] = useState(false);
  const [amoledActive, setAmoledActive] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [notification, setNotification] = useState<{title: string, message: string, action?: {label: string, onClick: () => void}} | null>(null);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     const handleClickOutside = (event: MouseEvent) => {
         if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
             setShowUserMenu(false);
         }
         if (categoriesRef.current && !categoriesRef.current.contains(event.target as Node)) {
             setShowCategories(false);
         }
     };
     document.addEventListener('mousedown', handleClickOutside);
     return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
     const handleNotify = (e: Event) => {
         const customEvent = e as CustomEvent;
         setNotification(customEvent.detail);
         if ((window as any)._notifyTimeout) clearTimeout((window as any)._notifyTimeout);
         if (!customEvent.detail.action) {
             (window as any)._notifyTimeout = setTimeout(() => setNotification(null), 5000);
         }
     };
     window.addEventListener('app-notify', handleNotify);
     return () => window.removeEventListener('app-notify', handleNotify);
  }, []);

  useEffect(() => {
     if (!activeUser) {
         setAmoledUnlocked(false);
         setAmoledActive(false);
         setThemeMode('system');
         return;
     }
     // Retrieve saved settings
     const savedAmoledUnlocked = localStorage.getItem(`salleObscureUnlocked_${activeUser.id}`) === 'true';
     const savedAmoledActive = localStorage.getItem(`salleObscureActive_${activeUser.id}`) === 'true';
     const savedTheme = localStorage.getItem(`themeMode_${activeUser.id}`) as 'light'|'dark'|'system' || 'system';
     
     setAmoledUnlocked(savedAmoledUnlocked);
     setAmoledActive(savedAmoledActive && savedAmoledUnlocked);
     setThemeMode(savedTheme);
  }, [activeUser]);

  // Theme Applier Effect
  useEffect(() => {
      if (!activeUser) return;
      localStorage.setItem(`themeMode_${activeUser.id}`, themeMode);
      localStorage.setItem(`salleObscureActive_${activeUser.id}`, amoledActive.toString());

      const root = window.document.documentElement;
      
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = themeMode === 'dark' || (themeMode === 'system' && isSystemDark);
      const forceAmoled = amoledActive && amoledUnlocked;

      if (shouldBeDark) {
          root.classList.add('dark');
      } else {
          root.classList.remove('dark');
      }

      if (forceAmoled) {
          root.classList.add('amoled');
      } else {
          root.classList.remove('amoled');
      }
  }, [themeMode, amoledActive, amoledUnlocked]);

  const handleLogoClick = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (viewMode !== 'viewer') {
          setViewMode('viewer');
          setLogoTaps(0);
      } else {
          setSearchQuery('');
          setSelectedGenre(null);
      }
      
      const newTaps = logoTaps + 1;
      setLogoTaps(newTaps);
      if (newTaps === 7 && !amoledUnlocked) {
          setAmoledUnlocked(true);
          setAmoledActive(true);
          localStorage.setItem(`salleObscureUnlocked_${activeUser?.id}`, 'true');
          window.dispatchEvent(new CustomEvent('app-notify', { detail: {
              title: "Cinéma déverrouillé",
              message: "« Il va faire tout noir ! » 💃\nFélicitations, vous avez déverrouillé le Mode Salle Obscure ! Rendez-vous dans les paramètres (engrenage)."
          }}));
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

  const fetchFilms = async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const res = await fetch('/api/films');
      if (res.ok) setFilms(await res.json());
      if (activeUser && (hasRole(activeUser, 'owner') || hasRole(activeUser, 'admin'))) {
          const nres = await fetch('/api/notifications');
          if (nres.ok) {
              const ndata = await nres.json();
              setAdminNotifs(ndata.reverse());
              const unread = ndata.filter((n: any) => !n.readBy.includes(activeUser.id));
              if (unread.length > 0) {
                  setHasUnread(true);
                  const firstActionable = unread.find((n: any) => n.type === 'register' || n.type === 'request');
                  if (firstActionable && firstActionable.referenceId) {
                      notify(firstActionable.message, "Action Requise", {
                          label: "Voir (Admin)", 
                          onClick: () => {
                              setViewMode('admin');
                              // Automatically mark as read if they click the action
                              fetch(`/api/notifications/${firstActionable.id}/read`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({userId: activeUser.id})});
                          }
                      });
                  }
              } else {
                  setHasUnread(false);
              }
          }
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!background) setIsLoading(false);
    }
  };

  useEffect(() => {
     if (activeUser) fetchFilms();
  }, [activeUser]);

  useEffect(() => {
     const hasTranscoding = films.some(f => f.status === 'PROCESSING');
     if (hasTranscoding) {
         const interval = setInterval(async () => {
             fetchFilms(true);
             try {
                 const res = await fetch('/api/films/transcoding-status');
                 if (res.ok) setTranscodingStatuses(await res.json());
             } catch (e) {}
         }, 5000);
         return () => clearInterval(interval);
     } else {
         if (Object.keys(transcodingStatuses).length > 0) {
             setTranscodingStatuses({});
         }
     }
  }, [films, activeUser]);

  if (isLoading) {
    return <Loader />;
  }

  const globalModals = (
      <AnimatePresence>
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
                 userRole={primaryRole(activeUser)}
              />
          )}
          {showBugReport && <BugReportModal onClose={() => setShowBugReport(false)} />}
          <InstallPrompt />
          {showPolls && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPolls(false)} />
                  <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: -20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -20 }}
                      className="bg-white dark:bg-[#16181c] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] relative z-10 flex flex-col"
                  >
                     <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                         <div className="flex items-center gap-2 text-primary-600">
                             <ListChecks className="w-5 h-5" />
                             <h2 className="text-lg font-bold">Sondages</h2>
                         </div>
                         <button onClick={() => setShowPolls(false)} className="text-zinc-500 hover:text-white transition">
                             <X className="w-5 h-5" />
                         </button>
                     </div>
                     <div className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
                        <Polls activeUser={activeUser} />
                     </div>
                  </motion.div>
              </div>
          )}
          
          {notification && (
              <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999]">
                  <motion.div 
                     initial={{ opacity: 0, scale: 0.95, y: -20, x: 0 }}
                     animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                     exit={{ opacity: 0, scale: 0.95, y: -20, x: 0 }}
                     className="bg-zinc-900 border border-zinc-800 text-white rounded-xl shadow-2xl p-4 w-80 text-center flex flex-col gap-3 pointer-events-auto"
                  >
                      <div className="flex flex-col items-center">
                          <h3 className={`font-bold text-sm mb-1 ${notification.title.toLowerCase().includes('erreur') ? 'text-primary-500' : 'text-blue-400'}`}>{notification.title}</h3>
                          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{notification.message}</p>
                      </div>
                      
                      <div className="flex gap-2 justify-center mt-2">
                          {notification.action && (
                              <button 
                                  onClick={() => {
                                      notification.action!.onClick();
                                      setNotification(null);
                                  }} 
                                  className="px-4 py-1.5 bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold rounded transition cursor-pointer"
                              >
                                  {notification.action.label}
                              </button>
                          )}
                          <button onClick={() => setNotification(null)} className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded transition cursor-pointer">
                              Fermer
                          </button>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>
  );

  const FilmPlayerRoute = () => {
      const { id } = useParams();
      const film = films.find(f => f.id === id);
      if (!film) {
          useEffect(() => { navigate('/', { replace: true }) }, []);
          return null;
      }
      return (
        <div className={`min-h-[100dvh] w-full overflow-x-hidden ${amoledActive ? 'bg-white dark:bg-black' : 'bg-zinc-50 dark:bg-[#16181c]'} text-zinc-900 dark:text-white font-sans selection:bg-primary-500/30 transition-colors`}>
           <Player film={film} activeUser={activeUser} onClose={() => navigate(-1)} />
           {globalModals}
        </div>
      );
  };

  // Auth Screen
  if (!activeUser) {
    return <AuthScreen onLogin={setActiveUser} />;
  }

  // Navbar shared between Viewer and Admin
  const navbarContent = (
      <nav className={`sticky top-0 w-full z-50 ${amoledActive ? 'bg-white/90 dark:bg-black/90' : 'bg-zinc-50/90 dark:bg-[#16181c]/90'} backdrop-blur border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 xl:px-12 py-4 transition-colors`}>
        <div className="flex items-center gap-4 shrink-0">
            {viewMode !== 'viewer' && (
                <button 
                    onClick={() => setViewMode('viewer')}
                    className="p-2 -ml-2 text-zinc-500 hover:text-primary-600 transition hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 rounded-full max-lg:portrait:hidden"
                    title="Retour"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
            )}
            <div 
               className="text-xl font-bold tracking-tight mr-2 xl:mr-10 flex items-center gap-2 text-primary-600 cursor-pointer select-none"
               onClick={handleLogoClick}
            >
                <Logo className="w-7 h-7 shrink-0" /> <span className="hidden sm:inline">CinéPrivé</span>
            </div>
        </div>
        
        <div className="flex items-center gap-2 xl:gap-4 ml-auto pb-1 pr-1 flex-1 justify-end">
            {viewMode === 'viewer' && (
                <div className="flex relative items-center max-lg:portrait:flex-1 max-lg:portrait:mx-2 max-lg:portrait:w-full">
                    <Search className="w-4 h-4 absolute left-3 text-zinc-500" />
                    <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher..."
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full pl-9 pr-4 py-1.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all w-32 xl:w-48 focus:w-48 xl:focus:w-64 max-lg:portrait:w-full max-lg:portrait:focus:w-full"
                    />
                </div>
            )}
            
            {viewMode === 'viewer' && (
                <div className="relative max-lg:portrait:hidden" ref={categoriesRef}>
                    <button 
                        onClick={() => { setShowCategories(!showCategories); setShowUserMenu(false); }}
                        className="text-sm font-medium px-3 py-1.5 text-zinc-600 dark:text-zinc-400 hover:text-primary-600 transition"
                    >
                        Catégories
                    </button>
                    <AnimatePresence>
                        {showCategories && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-40 py-2"
                            >
                                <button 
                                    onClick={() => { setSelectedGenre(null); setShowCategories(false); }}
                                    className="w-full text-left px-4 py-2 text-sm text-zinc-900 dark:text-white hover:bg-primary-50 dark:hover:bg-primary-500/10 hover:text-primary-600 transition"
                                >
                                    Toutes les catégories
                                </button>
                                {Array.from(new Set(films.flatMap(f => f.genres || [f.genre]))).filter(Boolean).sort().map(genre => (
                                    <button 
                                        key={genre}
                                        onClick={() => { setSelectedGenre(genre); setShowCategories(false); }}
                                        className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                                    >
                                        {genre}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            <button 
                onClick={() => {
                    setShowInbox(true);
                    setHasUnread(false);
                    localStorage.setItem('inbox_read', 'true');
                }}
                className="relative p-1.5 text-zinc-500 hover:text-primary-600 transition max-lg:portrait:hidden"
            >
                <Inbox className="w-5 h-5" />
                {hasUnread && <span className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full border border-white dark:border-black"></span>}
            </button>

            <button 
                onClick={() => setShowPolls(true)}
                className={`hidden xl:flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full transition ${showPolls ? 'text-primary-600 bg-primary-50 dark:bg-primary-500/10 border border-primary-500/20' : 'text-zinc-600 dark:text-zinc-400 hover:text-primary-600 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'}`}
                title="Sondages"
            >
                <ListChecks className="w-4 h-4" /> <span>Sondages</span>
            </button>

            {hasRole(activeUser, 'owner') && (
                <button 
                    onClick={() => setViewMode('admin')}
                    className={`hidden xl:flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded transition ${viewMode === 'admin' ? 'text-white bg-primary-600 border border-primary-600' : 'text-zinc-600 dark:text-zinc-400 hover:text-primary-600 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'}`}
                    title="Salle des Serveurs"
                >
                    <Shield className="w-4 h-4"/> <span>Salle des Serveurs</span>
                </button>
            )}

            {(hasRole(activeUser, 'owner') || hasRole(activeUser, 'admin') || hasRole(activeUser, 'technician')) && (
                <button 
                    onClick={() => setViewMode('upload')}
                    className={`hidden xl:flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded transition ${viewMode === 'upload' ? 'text-zinc-900 dark:text-white bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700' : 'text-zinc-600 dark:text-zinc-400 hover:text-primary-600 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'}`}
                    title="Ajouter un film"
                >
                    <UploadCloud className="w-4 h-4"/> <span className="hidden xl:inline">Ajouter un film</span>
                </button>
            )}

            <div ref={userMenuRef} className="flex items-center gap-3 pl-4 border-l border-zinc-200 dark:border-zinc-800 relative h-full">
                {activeUser.status === 'pending' && (
                    <span className="hidden xl:inline text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-500 px-2 py-0.5 rounded border border-yellow-200 dark:border-yellow-700/50 mr-2">
                        Compte en attente
                    </span>
                )}
                <div 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className={`w-9 h-9 rounded-full shrink-0 ${activeUser.color || 'bg-primary-600'} flex items-center justify-center font-bold text-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700 cursor-pointer overflow-hidden bg-cover bg-center`}
                    style={(activeUser as any).avatarUrl ? { backgroundImage: `url(${(activeUser as any).avatarUrl})` } : {}}
                >
                    {!(activeUser as any).avatarUrl && (activeUser.name || activeUser.username || '?').charAt(0).toUpperCase()}
                </div>
                
                {/* Netflix-style click dropdown */}
                {showUserMenu && (
                    <div className="absolute top-12 right-0 w-48 mt-2 transition-all duration-200 z-50 shadow-xl animate-in fade-in slide-in-from-top-2">
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded shadow-xl overflow-hidden flex flex-col">
                            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                                <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{activeUser.username}</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">{hasRole(activeUser, 'owner') ? 'Patron' : (hasRole(activeUser, 'admin') ? 'Admin' : 'Membre')}</p>
                            </div>
                            
                            {/* Navigation menu items */}
                            <div className="xl:hidden border-b border-zinc-100 dark:border-zinc-800 py-1">
                                <button onClick={() => { setShowPolls(true); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-primary-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center gap-3">
                                     <ListChecks className="w-4 h-4" /> Sondages
                                </button>
                                {hasRole(activeUser, 'owner') && (
                                     <button onClick={() => { setViewMode('admin'); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-primary-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center gap-3">
                                         <Shield className="w-4 h-4" /> Salle des Serveurs
                                     </button>
                                )}
                            </div>

                            <div className="border-b border-zinc-100 dark:border-zinc-800 py-1">
                                <button onClick={() => { setShowSettings(true); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-primary-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center gap-3">
                                     <Settings className="w-4 h-4" /> Paramètres
                                </button>
                                <button onClick={() => { setShowBugReport(true); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-primary-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center gap-3">
                                     <MessageSquare className="w-4 h-4" /> Signaler un problème
                                </button>
                            </div>
                            <button 
                                onClick={async () => { 
                                    await fetch('/api/logout', { method: 'POST' });
                                    localStorage.removeItem('cine_auth');
                                    sessionStorage.removeItem('cine_auth');
                                    localStorage.removeItem('cine_remember');
                                    localStorage.removeItem('cine_remember_username');
                                    sessionStorage.removeItem('cine_session');
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

  const isPlayerRoute = location.pathname.startsWith('/film/');

  if (isPlayerRoute) {
      return (
          <>
            <Routes>
                <Route path="/film/:id" element={<FilmPlayerRoute />} />
            </Routes>
            {globalModals}
          </>
      );
  }

  return (
    <div className={`min-h-[100dvh] w-full overflow-x-hidden ${amoledActive ? 'bg-white dark:bg-black' : 'bg-zinc-50 dark:bg-[#16181c]'} text-zinc-900 dark:text-white font-sans selection:bg-primary-500/30 transition-colors`}>
      {navbarContent}
      <ScrollToTop />
      
      <main>
        <GardeFou>
        <Routes>
          <Route path="/" element={
            <ViewerApp 
               activeUser={activeUser} 
               films={films} 
               onPlay={(f) => navigate('/film/' + f.id)} 
               onUpdateUser={setActiveUser}
               searchQuery={searchQuery}
               setSearchQuery={setSearchQuery}
               selectedGenre={selectedGenre}
               setSelectedGenre={setSelectedGenre}
            />
          } />
          <Route path="/serveurs" element={
            <ContributeApp activeUser={activeUser} films={films} onRefresh={fetchFilms} mode="admin" onUploadStateChange={setIsUploading} />
          } />
          <Route path="/upload" element={
            <ContributeApp activeUser={activeUser} films={films} onRefresh={fetchFilms} mode="upload" onUploadStateChange={setIsUploading} />
          } />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </GardeFou>
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
                          <Inbox className="w-5 h-5 text-primary-600" />
                          <h2 className="text-lg font-bold">Nouveautés</h2>
                      </div>
                      <div className="p-4 space-y-4 max-h-[300px] overflow-y-auto">
                           {(hasRole(activeUser, 'owner') || hasRole(activeUser, 'admin')) && adminNotifs.length > 0 ? (
                               adminNotifs.map(n => (
                                   <div key={n.id} className={`p-4 rounded-lg border ${!n.readBy.includes(activeUser.id) ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-900/50' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'}`}>
                                       <div className="flex justify-between items-start mb-1">
                                           <span className="text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">{n.type}</span>
                                           <div className="flex items-center gap-2">
                                               <span className="text-[10px] text-zinc-500">{new Date(n.createdAt).toLocaleDateString()}</span>
                                               <button onClick={async (e) => {
                                                   e.stopPropagation();
                                                   await fetch(`/api/notifications/${n.id}`, { method: 'DELETE' });
                                                   fetchFilms(true);
                                               }} className="text-zinc-500 hover:text-primary-500 transition-colors ml-2 -mr-1">
                                                   <X className="w-3 h-3" />
                                               </button>
                                           </div>
                                       </div>
                                       <p className="text-sm font-medium">{n.message}</p>
                                   </div>
                               ))
                           ) : (
                               <div className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 p-8 text-center rounded-lg text-sm">
                                   Les notifications Web Push arriveront bientôt pour être toujours informé des nouvelles sorties ! 🚀
                               </div>
                           )}
                      </div>
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex justify-between">
                           <button onClick={async () => {
                               setShowInbox(false);
                               if (hasRole(activeUser, 'owner')) {
                                   await fetch('/api/notifications/read-all', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({userId: activeUser.id}) });
                                   setHasUnread(false);
                                   fetchFilms(true);
                               }
                           }} className="px-4 py-1.5 bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white font-medium rounded text-sm hover:opacity-80 transition flex items-center gap-2">
                               <Check className="w-4 h-4"/> Lu
                           </button>
                          <button onClick={() => setShowInbox(false)} className="px-4 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-medium rounded text-sm hover:opacity-80 transition">Fermer</button>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {globalModals}
      
      {showEasterEgg && <EasterEgg onClose={() => setShowEasterEgg(false)} />}
    </div>
  );
}
