import React from "react";
import { CheckCircle, X } from "lucide-react";
import { UploadTask } from "../types";

// Extrait de ContributeApp : 289 lignes d'affichage pur pour une tache d'envoi.
// Ne detient aucun etat, tout arrive par les props.
interface Props {
  task: UploadTask;
  searchTMDBForTask: (taskId: string, query: string, year?: string) => void;
  setTasks: React.Dispatch<React.SetStateAction<UploadTask[]>>;
  updateTaskMeta: (taskId: string, meta: any) => void;
  removeTask: (taskId: string) => void;
  corrigerFiche: (taskId: string, meta: any) => void;
  cancelActiveUpload: (taskId: string) => void;
}

export default function CarteTache({
  task,
  searchTMDBForTask,
  setTasks,
  updateTaskMeta,
  removeTask,
  corrigerFiche,
  cancelActiveUpload,
}: Props) {
  return (
    <div key={task.id} className="p-4 flex flex-col lg:flex-row gap-4">
      <div className="lg:w-1/3 flex flex-col gap-1">
        <div className="flex items-start justify-between">
          <p
            className="font-medium text-sm text-white line-clamp-1 flex-1"
            title={task.file.name}
          >
            {task.file.name}
          </p>
          {(task.status === "waiting" || task.status === "duplicate") && (
            <button
              onClick={() => removeTask(task.id)}
              className="text-zinc-600 hover:text-primary-500 transition ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          {(task.file.size / (1024 * 1024)).toFixed(0)} Mo
        </p>

        {task.status === "uploading" && (
          <div className="mt-2 text-xs font-medium text-blue-400 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              {task.progress}%
            </div>
            {task.finalisation && (
              <p className="text-zinc-400 font-normal">
                Envoi terminé — le serveur assemble et vérifie le fichier...
              </p>
            )}
            {!task.finalisation && task.etaSeconds !== null && task.etaSeconds !== undefined && (
              <div className="flex justify-between items-center bg-zinc-900/50 rounded px-2 py-1.5 mt-1 border border-zinc-800">
                <span className="text-zinc-500 font-normal">
                  Temps estimé restant
                </span>
                <span className="text-zinc-300">
                  {Math.floor(task.etaSeconds / 60)}m {task.etaSeconds % 60}s
                </span>
              </div>
            )}
            <button
              onClick={() => cancelActiveUpload(task.id)}
              className="mt-2 text-xs text-primary-400 hover:text-primary-300 transition w-full py-1.5 bg-primary-400/10 rounded border border-primary-400/20"
            >
              Annuler l'upload en cours
            </button>
          </div>
        )}
        {task.status === "success" && (
          <p className="text-xs text-green-500 mt-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Envoyé avec succès
          </p>
        )}
        {task.status === "error" && (
          <p className="text-xs text-primary-500 mt-2 flex items-center gap-1">
            <X className="w-3 h-3" /> Erreur lors de l'envoi
          </p>
        )}
        {task.status === "duplicate" && (
          <p className="text-xs text-orange-500 mt-2 flex items-center gap-1">
            <X className="w-3 h-3" /> Film déjà présent
          </p>
        )}
      </div>

      <div className="lg:w-2/3">
        {(task.status === "waiting" || task.status === "duplicate") && !task.selectedMeta ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={task.tmdbQuery}
                onChange={(e) =>
                  setTasks((prev) =>
                    prev.map((t) =>
                      t.id === task.id ? { ...t, tmdbQuery: e.target.value } : t,
                    ),
                  )
                }
                onKeyDown={(e) =>
                  e.key === "Enter" && searchTMDBForTask(task.id, task.tmdbQuery, task.tmdbYear)
                }
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
                placeholder="Rechercher un autre titre..."
              />
              <input
                type="text"
                value={task.tmdbYear || ""}
                onChange={(e) =>
                  setTasks((prev) =>
                    prev.map((t) =>
                      t.id === task.id ? { ...t, tmdbYear: e.target.value } : t,
                    ),
                  )
                }
                onKeyDown={(e) =>
                  e.key === "Enter" && searchTMDBForTask(task.id, task.tmdbQuery, task.tmdbYear)
                }
                className="w-20 bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
                placeholder="Année"
              />
              <button
                onClick={() => searchTMDBForTask(task.id, task.tmdbQuery, task.tmdbYear)}
                className="px-3 bg-zinc-800 rounded text-xs font-medium text-white hover:bg-zinc-700 transition"
              >
                Rechercher
              </button>
            </div>

            {task.isSearching ? (
              <p className="text-xs text-zinc-500">Recherche TMDB en cours...</p>
            ) : task.tmdbResults.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                {task.tmdbResults.map((res: any) => (
                  <div
                    key={res.id}
                    onClick={() => updateTaskMeta(task.id, res)}
                    className="w-[90px] shrink-0 cursor-pointer group"
                  >
                    {res.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${res.poster_path}`}
                        className="w-full h-[135px] object-cover rounded bg-zinc-800 group-hover:ring-2 ring-gold-500 ring-offset-2 ring-offset-zinc-900 transition"
                      />
                    ) : (
                      <div className="w-full h-[135px] bg-zinc-800 rounded flex items-center justify-center p-2 text-center text-[10px] text-zinc-400 group-hover:ring-2 ring-gold-500 ring-offset-2 ring-offset-zinc-900 transition">
                        {res.title}
                      </div>
                    )}
                    <p className="text-[10px] text-zinc-400 mt-1 truncate group-hover:text-white transition">
                      {res.title}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                Aucun résultat trouvé. Modifiez le titre pour chercher à nouveau.
              </p>
            )}
          </div>
        ) : task.selectedMeta ? (
          <div className="flex items-start gap-4 p-3 bg-zinc-950 rounded border border-green-900/30 line-clamp-2">
            {task.selectedMeta.poster_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w92${task.selectedMeta.poster_path}`}
                className="w-12 h-18 object-cover rounded shadow-sm"
              />
            ) : (
              <div className="w-12 h-18 bg-zinc-800 rounded shadow-sm" />
            )}
            <div className="flex-1">
              <p className="text-gold-500 font-medium text-xs mb-0.5 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />{" "}
                {task.status === "success" ? "Importé" : "Métadonnées liées"}
              </p>
              <h4 className="font-bold text-white text-sm line-clamp-1">
                {task.selectedMeta.title}{" "}
                <span className="text-zinc-500 font-normal">
                  ({task.selectedMeta.release_date?.split("-")[0]})
                </span>
              </h4>
              <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">
                {task.selectedMeta.overview}
              </p>
            </div>
            {(task.status === "waiting" || task.status === "duplicate") && (
              <button
                onClick={() => updateTaskMeta(task.id, null)}
                className="text-[10px] font-medium text-zinc-400 hover:text-white px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded transition shrink-0"
              >
                Modifier
              </button>
            )}
            {task.status === "success" && task.filmId && (
              <button
                onClick={() => {
                  setTasks((prev) =>
                    prev.map((t) =>
                      t.id === task.id
                        ? {
                            ...t,
                            correctionOuverte: !t.correctionOuverte,
                            tmdbQuery: t.correctionOuverte ? t.tmdbQuery : (t.selectedMeta?.title || t.tmdbQuery),
                            tmdbResults: [],
                          }
                        : t,
                    ),
                  );
                }}
                className="text-[10px] font-medium text-zinc-300 hover:text-white px-2 py-1 bg-primary-900/50 hover:bg-primary-800/60 border border-primary-700/50 rounded transition shrink-0"
                title="La fiche ne correspond pas au film ? Choisissez la bonne."
              >
                {task.correctionOuverte ? "Annuler" : "Mauvais film ?"}
              </button>
            )}
          </div>
        ) : null}

        {/* Correction de la correspondance APRES import : le fichier video est
            deja en place, on ne remplace que les metadonnees. */}
        {task.status === "success" && task.filmId && task.correctionOuverte && (
          <div className="mt-3 p-3 bg-zinc-950 rounded border border-primary-800/40 space-y-3">
            <p className="text-[11px] text-zinc-400">
              Cherchez le bon film puis cliquez sur son affiche. Titre, affiche,
              synopsis, genres et casting seront remplacés. Le fichier vidéo,
              lui, ne bouge pas. Ajoutez l'année si le titre est ambigu.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={task.tmdbQuery || ""}
                onChange={(e) =>
                  setTasks((prev) =>
                    prev.map((t) => (t.id === task.id ? { ...t, tmdbQuery: e.target.value } : t)),
                  )
                }
                onKeyDown={(e) =>
                  e.key === "Enter" && searchTMDBForTask(task.id, task.tmdbQuery, task.tmdbYear)
                }
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary-500"
                placeholder="Titre du film"
              />
              <input
                type="text"
                value={task.tmdbYear || ""}
                onChange={(e) =>
                  setTasks((prev) =>
                    prev.map((t) => (t.id === task.id ? { ...t, tmdbYear: e.target.value } : t)),
                  )
                }
                onKeyDown={(e) =>
                  e.key === "Enter" && searchTMDBForTask(task.id, task.tmdbQuery, task.tmdbYear)
                }
                className="w-20 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary-500"
                placeholder="Année"
              />
              <button
                onClick={() => searchTMDBForTask(task.id, task.tmdbQuery, task.tmdbYear)}
                className="px-3 bg-primary-600 hover:bg-primary-700 rounded text-xs font-medium text-white transition"
              >
                Rechercher
              </button>
            </div>

            {task.isSearching ? (
              <p className="text-xs text-zinc-500">Recherche TMDB en cours...</p>
            ) : task.tmdbResults.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                {task.tmdbResults.map((res: any) => (
                  <div
                    key={res.id}
                    onClick={() => corrigerFiche(task.id, res)}
                    className="w-[90px] shrink-0 cursor-pointer group"
                  >
                    {res.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${res.poster_path}`}
                        className="w-full h-[135px] object-cover rounded bg-zinc-800 group-hover:ring-2 ring-primary-500 ring-offset-2 ring-offset-zinc-950 transition"
                      />
                    ) : (
                      <div className="w-full h-[135px] bg-zinc-800 rounded flex items-center justify-center p-2 text-center text-[10px] text-zinc-400 group-hover:ring-2 ring-primary-500 ring-offset-2 ring-offset-zinc-950 transition">
                        {res.title}
                      </div>
                    )}
                    <p className="text-[10px] text-zinc-400 mt-1 truncate group-hover:text-white transition">
                      {res.title}
                    </p>
                    <p className="text-[10px] text-zinc-600">
                      {res.release_date?.split("-")[0]}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-600">Aucun résultat pour l'instant.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
