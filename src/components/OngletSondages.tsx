import React from "react";
import { EtatDialogue, User } from "../types";
import { hasRole } from "../lib/roles";

// Onglet extrait de ContributeApp. Aucun etat propre : tout arrive par les props.
interface Props {
  activeUser: User;
  pollsConfig: any[];
  pollResults: any;
  setPollResults: React.Dispatch<React.SetStateAction<any>>;
  editingPollId: string | null;
  setEditingPollId: React.Dispatch<React.SetStateAction<string | null>>;
  setDialogState: React.Dispatch<React.SetStateAction<EtatDialogue>>;
  usersList: User[];
  fetchData: () => void;
}

export default function OngletSondages({
  activeUser,
  pollsConfig,
  pollResults,
  setPollResults,
  editingPollId,
  setEditingPollId,
  setDialogState,
  usersList,
  fetchData,
}: Props) {
  return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl mx-auto shadow-sm">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-medium">Résultats des sondages</h3>
          </div>
          <div className="p-6 space-y-8">
            {pollsConfig.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">
                Aucun sondage actif.
              </p>
            ) : (
              pollsConfig.map((config: any) => {
                const pollId = config.id;
                const data = pollResults[pollId] || {
                  options: {},
                  custom: [],
                  userVotes: {},
                };
                const title = config.title;
                const totalVotes = Object.values(data.options).reduce(
                  (a: any, b: any) => a + b,
                  0,
                ) as number;
                return editingPollId === pollId ? (
                  <form
                    key={pollId}
                    className="space-y-4 pb-6 border-b border-zinc-100 dark:border-zinc-800 last:border-0 last:pb-0"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const updatedPoll = {
                        id: pollId,
                        title: formData.get("title"),
                        desc: formData.get("desc"),
                        allowMultiple: formData.get("allowMultiple") === "on",
                        allowCustom: formData.get("allowCustom") === "on",
                        options:
                          formData
                            .get("options")
                            ?.toString()
                            .split("\n")
                            .filter((s) => s.trim())
                            .map((s, i) => {
                              const existingConfig = config.options[i];
                              return {
                                id: existingConfig
                                  ? existingConfig.id
                                  : "o" + (i + 1),
                                label: s.trim(),
                              };
                            }) || [],
                      };
                      const updatedConfig = pollsConfig.map((p: any) =>
                        p.id === pollId ? updatedPoll : p,
                      );
                      await fetch("/api/polls/config", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(updatedConfig),
                      });
                      setEditingPollId(null);
                      fetchData();
                    }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">Modifier le sondage</h4>
                      <button
                        type="button"
                        onClick={() => setEditingPollId(null)}
                        className="text-zinc-500 hover:text-zinc-900"
                      >
                        Annuler
                      </button>
                    </div>
                    <input
                      name="title"
                      defaultValue={config.title}
                      required
                      className="w-full border rounded px-3 py-2"
                      placeholder="Titre"
                    />
                    <textarea
                      name="desc"
                      defaultValue={config.desc}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Description"
                      rows={2}
                    />
                    <textarea
                      name="options"
                      defaultValue={config.options
                        .map((o: any) => o.label)
                        .join("\n")}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Options (1 par ligne)"
                      rows={4}
                    />
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="allowMultiple"
                          defaultChecked={config.allowMultiple}
                        />{" "}
                        Choix multiples
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="allowCustom"
                          defaultChecked={config.allowCustom}
                        />{" "}
                        Saisie libre
                      </label>
                    </div>
                    <button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded transition">
                      Sauvegarder
                    </button>
                  </form>
                ) : (
                  <div
                    key={pollId}
                    className="space-y-4 pb-6 border-b border-zinc-100 dark:border-zinc-800 last:border-0 last:pb-0"
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-zinc-900 dark:text-white capitalize">
                        {title} ({totalVotes} votes)
                      </h4>
                      {/* Modifier, reinitialiser, supprimer : proprietaire seul, comme cote
                          serveur. Un admin voyait ces boutons et recevait un refus. */}
                      {hasRole(activeUser, "owner") && (
                        <div className="flex items-center gap-2">
                          {totalVotes === 0 && (
                            <button
                              onClick={() => setEditingPollId(pollId)}
                              className="text-xs text-blue-600 hover:underline px-2 py-1 bg-blue-50 dark:bg-blue-900/10 rounded"
                            >
                              Éditer
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              setDialogState({
                                isOpen: true,
                                title: "Vider les résultats",
                                message:
                                  "Voulez-vous réinitialiser les résultats de ce sondage ?",
                                onConfirm: async () => {
                                  await fetch(`/api/polls/reset/${pollId}`, {
                                    method: "DELETE",
                                  });
                                  fetch("/api/polls/results")
                                    .then((r) => r.json())
                                    .then(setPollResults);
                                },
                              });
                            }}
                            className="text-xs text-orange-600 hover:underline px-2 py-1 bg-orange-50 dark:bg-orange-900/10 rounded"
                          >
                            Vider les résultats
                          </button>
                          <button
                            onClick={async () => {
                              setDialogState({
                                isOpen: true,
                                title: "Supprimer ce sondage",
                                message:
                                  "Voulez-vous supprimer définitivement ce sondage ?",
                                onConfirm: async () => {
                                  await fetch(`/api/polls/${pollId}`, {
                                    method: "DELETE",
                                  });
                                  fetchData();
                                },
                              });
                            }}
                            className="text-xs text-primary-600 hover:underline px-2 py-1 bg-primary-50 dark:bg-primary-900/10 rounded"
                          >
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {Object.entries(data.options).map(
                        ([optionId, count]: [string, any]) => {
                          const percentage =
                            totalVotes === 0
                              ? 0
                              : Math.round((count / totalVotes) * 100);
                          const optionConfig = config?.options?.find(
                            (o: any) => o.id === optionId,
                          );
                          const label = optionConfig
                            ? optionConfig.label
                            : optionId;
                          return (
                            <div key={optionId} className="flex flex-col gap-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-zinc-700 dark:text-zinc-300 capitalize">
                                  {label}
                                  {data.userVotes &&
                                    Object.keys(data.userVotes).filter(
                                      (uid) => data.userVotes[uid] === optionId,
                                    ).length > 0 && (
                                      <span
                                        className="block text-[11px] text-zinc-500 font-normal mt-0.5"
                                        style={{ textTransform: "none" }}
                                      >
                                        Votants :{" "}
                                        {Object.keys(data.userVotes)
                                          .filter(
                                            (uid) =>
                                              data.userVotes[uid] === optionId,
                                          )
                                          .map(
                                            (uid) =>
                                              usersList.find(
                                                (u: any) => u.id === uid,
                                              )?.username || uid,
                                          )
                                          .join(", ")}
                                      </span>
                                    )}
                                </span>
                                <span className="font-medium">
                                  {count} ({percentage}%)
                                </span>
                              </div>
                              <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary-600 rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                    {data.custom && data.custom.length > 0 && (
                      <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
                        <h5 className="text-sm font-medium mb-2">
                          Suggestions des membres :
                        </h5>
                        <ul className="list-disc pl-4 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {data.custom.map((text: string, i: number) => (
                            <li key={i}>{text}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
  );
}
