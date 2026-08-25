import Logo from './Logo';

/**
 * Écran de chargement interne de l'application.
 * Reprend exactement la coquille de démarrage d'index.html : même fond,
 * même logo (anneau + triangle), même roue — le passage de l'un à l'autre
 * est invisible. L'ancien pictogramme (écran rouge) vivait encore ici.
 */
export default function Loader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#111315] text-white font-sans fixed inset-0 z-50">
      <Logo className="w-[72px] h-[72px] text-primary-500 animate-pulse" />
      <h1 className="mt-5 text-2xl font-bold tracking-tight">CinéPrivé</h1>
      <div className="mt-4 w-10 h-10 border-[3px] border-primary-600/20 border-t-primary-600 rounded-full animate-spin"></div>
    </div>
  );
}
