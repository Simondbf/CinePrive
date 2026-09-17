import React from "react";
import { AlertTriangle, Bell, Video } from "lucide-react";
import { Film, User } from "../types";
import { hasRole } from "../lib/roles";
import { notify } from "../lib/notify";

// Onglet extrait de ContributeApp. Aucun etat propre : tout arrive par les props.
interface Props {
  activeUser: User;
  films: Film[];
  onRefresh: (bg?: boolean) => void;
  notifsGlobales: any[];
  setNotifsGlobales: React.Dispatch<React.SetStateAction<any[]>>;
  setPreviewVideo: React.Dispatch<React.SetStateAction<{ url: string, timecode: number } | null>>;
  handleRestoreFilm: (filmId: string) => void;
  handleDeleteFilm: (filmId: string, filmTitle: string) => void;
  formatTimecode: (t: any) => string;
}

export default function OngletModeration({
  activeUser,
  films,
  onRefresh,
  notifsGlobales,
  setNotifsGlobales,
  setPreviewVideo,
  handleRestoreFilm,
  handleDeleteFilm,
  formatTimecode,
}: Props) {
  return (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-8">
            <div>
              <h3 className="text-lg font-medium text-primary-600 dark:text-primary-500 mb-1 flex items-center gap-2">
                <Bell className="w-5 h-5" /> Notifications diffusées
              </h3>
              <p className="text-xs text-zinc-500 mb-4">
                Vider sa boîte ne concerne que soi. Ici, la suppression retire
                l'annonce pour tous les membres — utile quand le titre annoncé
                pose lui-même problème.
              </p>
              {notifsGlobales.length === 0 ? (
                <p className="text-sm text-zinc-500">Aucune notification diffusée.</p>
              ) : (
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-64 overflow-y-auto">
                  {notifsGlobales.map((n) => (
                    <li key={n.id} className="flex items-start justify-between gap-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{n.type}</p>
                        <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{n.message}</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!window.confirm("Retirer cette notification pour tous les membres ?")) return;
                          const res = await fetch(`/api/notifications/${n.id}/global`, { method: "DELETE" });
                          if (res.ok) {
                            setNotifsGlobales((prev) => prev.filter((x) => x.id !== n.id));
                            onRefresh(true);
                          } else {
                            notify("Suppression impossible.", "Erreur");
                          }
                        }}
                        className="shrink-0 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded px-3 py-1.5 transition"
                      >
                        Retirer pour tous
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
            <h3 className="text-lg font-medium text-primary-600 dark:text-primary-500 mb-6 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Films signalés
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500">
                    <th className="px-6 py-4 font-medium">Film</th>
                    <th className="px-6 py-4 font-medium">Signalements</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {films.filter((f: any) => f.isQuarantined).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-zinc-500">
                        Aucun film en quarantaine.
                      </td>
                    </tr>
                  ) : (
                    films.filter((f: any) => f.isQuarantined).map((f: any) => (
                      <tr key={f.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                {f.posterUrl ? (
                                    <img src={f.posterUrl} alt={f.title} className="w-10 h-14 object-cover rounded shadow" />
                                ) : (
                                    <div className="w-10 h-14 bg-zinc-200 dark:bg-zinc-800 rounded flex items-center justify-center">
                                        <Video className="w-4 h-4 text-zinc-500" />
                                    </div>
                                )}
                                <div>
                                    <p className="font-medium text-zinc-900 dark:text-white">{f.title}</p>
                                    <p className="text-xs text-zinc-500">{f.year} • {f.originalName}</p>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
                                {f.reports && f.reports.map((r: any) => (
                                    <div key={r.id} className="bg-primary-50 dark:bg-primary-950/30 p-2 rounded border border-primary-100 dark:border-primary-900/50 flex justify-between items-center gap-2">
                                        <div>
                                            <p className="text-xs text-primary-800 dark:text-primary-400 font-medium">Par {r.userName}</p>
                                            <p className="text-xs text-primary-600 dark:text-primary-500 mt-1">Timecode: <span className="font-mono bg-primary-100 dark:bg-primary-900/50 px-1 py-0.5 rounded">{formatTimecode(r.timecode)}</span></p>
                                        </div>
                                        <button
                                            onClick={() => setPreviewVideo({ url: f.jellyfinId ? `/api/stream/${f.jellyfinId}` : `/videos/${f.filename}`, timecode: Number.isFinite(r.timecode) ? r.timecode : 0 })}
                                            className="text-xs font-medium bg-primary-200 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 px-3 py-1.5 rounded hover:bg-primary-300 dark:hover:bg-primary-900/60 transition-colors shrink-0 flex items-center gap-1"
                                        >
                                            <Video className="w-3 h-3" />
                                            Aperçu
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleRestoreFilm(f.id)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-950/60 font-medium text-xs bg-green-50 dark:bg-green-950/30 px-3 py-1.5 rounded transition-all"
                              >
                                Rétablir le film
                              </button>
                              <button
                                onClick={() => handleDeleteFilm(f.id, f.title)}
                                disabled={!hasRole(activeUser, "owner")}
                                className="text-primary-600 hover:text-primary-700 hover:bg-primary-100 dark:hover:bg-primary-950/60 font-medium text-xs bg-primary-50 dark:bg-primary-950/30 px-3 py-1.5 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                title={!hasRole(activeUser, "owner") ? "Seul le Patron peut détruire un fichier" : "Détruire définitivement"}
                              >
                                Détruire le Fichier
                              </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </div>
          </div>
  );
}
