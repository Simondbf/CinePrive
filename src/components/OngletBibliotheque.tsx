import React from "react";
import { AlertTriangle, FileUp, Layers, Loader2, RefreshCw, Search, X } from "lucide-react";
import { Film, User } from "../types";
import { hasRole } from "../lib/roles";
import { notify } from "../lib/notify";
import CarteVersionsSecours from "./CarteVersionsSecours";

// Onglet extrait de ContributeApp. Aucun etat propre : tout arrive par les props.
interface Props {
  activeUser: User;
  films: Film[];
  filmsFiltres: Film[];
  usersList: User[];
  onRefresh: (bg?: boolean) => void;
  rechercheFilm: string;
  setRechercheFilm: React.Dispatch<React.SetStateAction<string>>;
  verifEnCours: boolean;
  resultatVerif: { count: number; films: any[] } | null;
  isRefreshingAll: boolean;
  lotInputRef: React.RefObject<HTMLInputElement>;
  replaceInputRef: React.RefObject<HTMLInputElement>;
  setReplacingFilm: React.Dispatch<React.SetStateAction<{id: string, title: string, tmdbId?: number} | null>>;
  handleVerifierFichiers: () => void;
  handleRefreshAllMetadata: () => void;
  handleRestoreFilm: (filmId: string) => void;
  handleDeleteFilm: (filmId: string, filmTitle: string) => void;
  handleSetAsideFilm: (filmId: string, filmTitle: string) => void;
  formatDateSure: (valeur: any) => string;
}

export default function OngletBibliotheque({
  activeUser,
  films,
  filmsFiltres,
  usersList,
  onRefresh,
  rechercheFilm,
  setRechercheFilm,
  verifEnCours,
  resultatVerif,
  isRefreshingAll,
  lotInputRef,
  replaceInputRef,
  setReplacingFilm,
  handleVerifierFichiers,
  handleRefreshAllMetadata,
  handleRestoreFilm,
  handleDeleteFilm,
  handleSetAsideFilm,
  formatDateSure,
}: Props) {
  // Preparation de la version de secours d'un film choisi a la main. Meme route
  // que la demande d'un visiteur sous Linux : pas de doublon possible.
  const preparerPourLinux = async (film: Film) => {
    try {
      const r = await fetch(`/api/films/${film.id}/webm`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        notify(
          d.statut === "pret"
            ? `« ${film.title} » est déjà prêt pour les navigateurs sans H.264.`
            : `« ${film.title} » est en préparation pour les navigateurs sans H.264.`,
          "Versions pour Linux",
        );
        onRefresh(true);
      } else {
        notify(d.error || "La préparation n'a pas pu être lancée.", "Erreur");
      }
    } catch {
      notify("Erreur de connexion", "Erreur");
    }
  };

  return (
        <div className="flex flex-col gap-4">
          {hasRole(activeUser, "owner") && <CarteVersionsSecours />}
          {(hasRole(activeUser, "owner") || hasRole(activeUser, "admin") || hasRole(activeUser, "technician")) && (
              <div className="flex justify-end">
                <button
                   onClick={handleRefreshAllMetadata}
                   disabled={isRefreshingAll}
                   className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                   {isRefreshingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                   {isRefreshingAll ? "Rafraîchissement en cours..." : "Rafraîchir tout le catalogue"}
                </button>
                <button
                   onClick={handleVerifierFichiers}
                   disabled={verifEnCours}
                   title="Detecte les films dont le fichier a disparu du serveur"
                   className="ml-3 bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-900/20 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                   {verifEnCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                   {verifEnCours ? "Verification en cours..." : "Verifier les fichiers"}
                </button>
                <button
                   onClick={() => lotInputRef.current?.click()}
                   title="Selectionner plusieurs fichiers et les associer automatiquement aux films indisponibles"
                   className="ml-3 bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition flex items-center gap-2 shadow-sm"
                >
                   <Layers className="w-4 h-4" />
                   Remplacer en lot
                </button>
              </div>
          )}

          {resultatVerif && (
            <div className={`rounded-xl border p-4 text-sm ${resultatVerif.count === 0
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"}`}>
              {resultatVerif.count === 0 ? (
                <p>Tous les fichiers du catalogue sont bien presents sur le serveur.</p>
              ) : (
                <>
                  <p className="font-medium mb-2">
                    {resultatVerif.count} film(s) sans fichier, marques comme indisponibles :
                  </p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {resultatVerif.films.map((f: any) => (
                      <li key={f.id}>{f.title} <span className="opacity-60">({f.filename})</span></li>
                    ))}
                  </ul>
                  <p className="mt-2 opacity-80">
                    Ces films doivent etre renvoyes depuis l'espace contributeur.
                  </p>
                </>
              )}
            </div>
          )}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={rechercheFilm}
              onChange={(e) => setRechercheFilm(e.target.value)}
              placeholder="Rechercher un titre, un fichier ou un contributeur..."
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition shadow-sm"
            />
            {rechercheFilm && (
              <button
                onClick={() => setRechercheFilm("")}
                title="Effacer la recherche"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {rechercheFilm && (
            <p className="-mt-2 text-xs text-zinc-500">
              {filmsFiltres.length} film(s) sur {films.length}
            </p>
          )}

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium">Titre (TMDB)</th>
                <th className="px-6 py-4 font-medium">Uploader</th>
                <th className="px-6 py-4 font-medium">Date d'import</th>
                <th className="px-6 py-4 font-medium">Fichier d'origine</th>
                {(hasRole(activeUser, "owner") ||
                  hasRole(activeUser, "admin") ||
                  hasRole(activeUser, "technician")) && (
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filmsFiltres.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8">
                    {films.length === 0
                      ? "Base de données vide."
                      : "Aucun film ne correspond à cette recherche."}
                  </td>
                </tr>
              ) : (
                filmsFiltres.map((f) => {
                  const uploader = usersList.find((u) => u.id === f.addedBy);
                  return (
                    <tr
                      key={f.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white">
                        {f.title}
                      </td>
                      <td className="px-6 py-4">
                        {uploader?.name || f.addedBy}
                        {(f as any).modifiedBy && (
                            <span className="block text-[10px] text-zinc-500 mt-0.5">
                                (Mis à jour par {(f as any).modifiedBy})
                            </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {formatDateSure(f.addedAt)}
                      </td>
                      <td
                        className="px-6 py-4 max-w-[200px] truncate"
                        title={f.originalName}
                      >
                        {f.originalName
                          ? f.originalName.replace(/\.[^/.]+$/, "")
                          : ""}
                      </td>
                      {(hasRole(activeUser, "owner") ||
                        hasRole(activeUser, "admin") ||
                        hasRole(activeUser, "technician")) && (
                        <td className="px-6 py-4 text-right">
                          {f.pendingDeletion ? (
                            <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2">
                              <span className="text-[10px] bg-amber-500/10 text-amber-500 font-semibold px-2 py-1 rounded border border-amber-500/10 whitespace-nowrap">
                                ⚠️ Mis de côté par{" "}
                                {f.requestedDeletionBy || "Admin"}
                              </span>
                              <div className="flex gap-1.5 mt-1 sm:mt-0">
                                {hasRole(activeUser, "owner") && (
                                  <button
                                    onClick={() =>
                                      handleDeleteFilm(f.id, f.title)
                                    }
                                    className="text-white hover:bg-primary-500 transition-all font-semibold text-[11px] bg-primary-600 hover:shadow-sm px-2.5 py-1.5 rounded tracking-wide uppercase"
                                  >
                                    Détruire
                                  </button>
                                )}
                                <button
                                  onClick={() => handleRestoreFilm(f.id)}
                                  className="text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-805 transition-all font-medium text-[11px] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 rounded"
                                  title="Rétablir le film"
                                >
                                  Rétablir
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                    setReplacingFilm({ id: f.id, title: f.title, tmdbId: f.tmdbId });
                                    replaceInputRef.current?.click();
                                }}
                                className="text-zinc-500 hover:text-green-600 transition-all font-medium text-xs px-2.5 py-1.5 rounded flex items-center justify-center border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                                title="Remplacer la vidéo"
                              >
                                <FileUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/films/${f.id}/refresh-metadata`, { method: 'POST' });
                                    const data = await res.json();
                                    if (data.success) {
                                      notify(`Métadonnées mises à jour pour ${f.title}`, 'Succès');
                                      onRefresh(true);
                                    } else {
                                      notify(data.error || 'Erreur lors de la mise à jour', 'Erreur');
                                    }
                                  } catch (e) {
                                    notify('Erreur réseau', 'Erreur');
                                  }
                                }}
                                title="Rechercher l'affiche / Rafraîchir les métadonnées"
                                className="text-zinc-500 hover:text-blue-600 transition-all font-medium text-xs px-2.5 py-1.5 rounded flex items-center justify-center border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              {hasRole(activeUser, "owner", "admin") && (
                                f.webm?.statut === "pret" ? (
                                  <span className="text-[11px] font-medium text-green-600 dark:text-green-500 whitespace-nowrap" title="Version de secours prête pour les navigateurs sans H.264">
                                    Linux ✓
                                  </span>
                                ) : f.webm?.statut === "attente" ? (
                                  <span className="text-[11px] text-zinc-500 whitespace-nowrap">Linux : en préparation</span>
                                ) : (
                                  <button
                                    onClick={() => preparerPourLinux(f)}
                                    className="text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all font-medium text-xs border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 rounded whitespace-nowrap"
                                    title="Préparer une version lisible par les navigateurs sans H.264, fréquents sous Linux"
                                  >
                                    {f.webm?.statut === "erreur" ? "Réessayer (Linux)" : "Préparer pour Linux"}
                                  </button>
                                )
                              )}
                              {hasRole(activeUser, "owner", "admin") && (
                                <button
                                  onClick={() => handleSetAsideFilm(f.id, f.title)}
                                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-all font-medium text-xs bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 rounded"
                                  title="Masquer aux membres — réversible"
                                >
                                  Mettre de côté
                                </button>
                              )}
                              {hasRole(activeUser, "owner") && (
                                <button
                                  onClick={() => handleDeleteFilm(f.id, f.title)}
                                  className="text-primary-500 hover:text-primary-700 hover:bg-primary-100 dark:hover:bg-primary-950/60 transition-all font-medium text-xs bg-primary-50 dark:bg-primary-950/30 px-2.5 py-1.5 rounded"
                                  title="Suppression définitive, fichier vidéo compris"
                                >
                                  Supprimer
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
  );
}
