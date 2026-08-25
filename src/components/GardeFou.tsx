import React from 'react';

/**
 * Garde-fou global : attrape toute erreur de rendu React.
 *
 * Sans lui, la moindre exception dans un composant démonte l'application
 * entière et laisse un écran noir, sans message — exactement le symptôme
 * de la Salle des Serveurs. Avec lui, l'erreur est affichée en clair et
 * un bouton permet de recharger.
 */
interface Etat {
  erreur: Error | null;
}

export default class GardeFou extends React.Component<{ children: React.ReactNode }, Etat> {
  state: Etat = { erreur: null };

  static getDerivedStateFromError(erreur: Error): Etat {
    return { erreur };
  }

  componentDidCatch(erreur: Error, infos: React.ErrorInfo) {
    console.error('[GardeFou]', erreur, infos.componentStack);
  }

  render() {
    if (!this.state.erreur) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
            Quelque chose s'est cassé sur cette page
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            L'erreur a été enregistrée dans la console du navigateur. Vous
            pouvez recharger la page ; si cela se reproduit, signalez le
            message ci-dessous.
          </p>
          <p className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-primary-700 dark:text-primary-400 rounded p-3 mb-6 break-words">
            {this.state.erreur.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 text-sm font-medium transition"
          >
            Recharger la page
          </button>
        </div>
      </div>
    );
  }
}
