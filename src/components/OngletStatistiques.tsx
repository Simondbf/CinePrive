import React from "react";
import { BarChart3 } from "lucide-react";

// Onglet extrait de ContributeApp. Aucun etat propre : tout arrive par les props.
interface Props {
  stats: any | null;
}

export default function OngletStatistiques({
  stats,
}: Props) {
  return (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-medium text-primary-600 dark:text-primary-500 mb-1 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> Fréquentation
            </h3>
            <p className="text-xs text-zinc-500 mb-6">
              Comptage anonyme : uniquement des nombres, jamais qui a regardé quoi.
            </p>

            {!stats ? (
              <p className="text-sm text-zinc-500">Chargement...</p>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { libelle: "Visiteurs aujourd'hui", valeur: stats.aujourdhui?.visiteurs ?? 0 },
                    { libelle: "Lectures aujourd'hui", valeur: stats.aujourdhui?.lectures ?? 0 },
                    { libelle: "Lectures sur 7 jours", valeur: stats.septJours?.lectures ?? 0 },
                    { libelle: "Membres actifs inscrits", valeur: stats.membresInscrits ?? 0 },
                  ].map((c) => (
                    <div key={c.libelle} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                      <p className="text-2xl font-semibold text-zinc-900 dark:text-white">{c.valeur}</p>
                      <p className="text-xs text-zinc-500 mt-1">{c.libelle}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid sm:grid-cols-2 gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                    <p><span className="font-medium text-zinc-900 dark:text-white">{stats.septJours?.pointeVisiteurs ?? 0}</span> visiteurs le jour le plus frequenté des 7 derniers.</p>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                    <p><span className="font-medium text-zinc-900 dark:text-white">{stats.trenteJours?.lectures ?? 0}</span> lectures sur 30 jours, pointe à {stats.trenteJours?.pointeVisiteurs ?? 0} visiteurs.</p>
                  </div>
                </div>

                {Array.isArray(stats.courbe) && stats.courbe.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">Lectures par jour (30 jours)</h4>
                    <div className="flex items-end gap-1 h-28">
                      {stats.courbe.map((j: any) => {
                        const max = Math.max(1, ...stats.courbe.map((x: any) => x.lectures || 0));
                        return (
                          <div
                            key={j.jour}
                            className="flex-1 bg-primary-500/70 hover:bg-primary-500 rounded-t transition-colors min-h-[2px]"
                            style={{ height: `${((j.lectures || 0) / max) * 100}%` }}
                            title={`${j.jour} : ${j.lectures || 0} lecture(s), ${j.visiteurs || 0} visiteur(s)`}
                          />
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-2">Survolez une barre pour le détail du jour.</p>
                  </div>
                )}

                {Array.isArray(stats.topFilms) && stats.topFilms.length > 0 && (
                  <div className="mt-8">
                    <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">Films les plus lancés</h4>
                    <ol className="space-y-1.5">
                      {stats.topFilms.map((f: any, i: number) => (
                        <li key={f.titre + i} className="flex items-center justify-between text-sm border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                          <span className="text-zinc-700 dark:text-zinc-300 truncate pr-4">{i + 1}. {f.titre}</span>
                          <span className="text-zinc-500 shrink-0">{f.lectures}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
  );
}
