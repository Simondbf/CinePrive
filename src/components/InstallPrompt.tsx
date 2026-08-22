import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

/**
 * Bandeau discret proposant d'installer CinéPrivé sur l'écran d'accueil.
 * Ne s'affiche jamais si l'application est déjà installée, ni si l'utilisateur
 * l'a écarté une fois.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Déjà installé : rien à proposer.
    const enAppli =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (enAppli) return;

    if (localStorage.getItem('cine_install_dismissed') === 'true') return;

    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      // Safari n'implémente pas beforeinstallprompt : on affiche la marche
      // à suivre manuelle, après un court délai pour ne pas gêner l'arrivée.
      const t = setTimeout(() => {
        setIsIos(true);
        setVisible(true);
      }, 4000);
      return () => clearTimeout(t);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const ecarter = () => {
    localStorage.setItem('cine_install_dismissed', 'true');
    setVisible(false);
  };

  const installer = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xl">
      <button
        onClick={ecarter}
        aria-label="Fermer"
        className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
      >
        <X className="w-4 h-4" />
      </button>

      {isIos ? (
        <div className="pr-6">
          <p className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
            Installer CinéPrivé
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 flex-wrap">
            Touchez <Share className="w-4 h-4 inline" /> puis
            <span className="font-medium">« Sur l&rsquo;écran d&rsquo;accueil »</span>.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 pr-6">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              Installer CinéPrivé
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Accès direct depuis votre écran d&rsquo;accueil.
            </p>
          </div>
          <button
            onClick={installer}
            className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
          >
            <Download className="w-4 h-4" />
            Installer
          </button>
        </div>
      )}
    </div>
  );
}
