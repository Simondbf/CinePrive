import React, { useState } from "react";
import { Check, Copy, Shield } from "lucide-react";
import { Invitation, ReglagesServeur, User } from "../types";
import { hasRole, primaryRole } from "../lib/roles";

// Onglet extrait de ContributeApp. Les donnees arrivent par les props ; le seul
// etat local est le retour visuel du bouton "Copier", qui ne concerne que cet ecran.
interface Props {
  activeUser: User;
  usersList: User[];
  invitesList: Invitation[];
  settings: ReglagesServeur;
  customCodeInput: string;
  setCustomCodeInput: React.Dispatch<React.SetStateAction<string>>;
  maxUsesInput: string;
  setMaxUsesInput: React.Dispatch<React.SetStateAction<string>>;
  pendingRoleChanges: Record<string, string>;
  setPendingRoleChanges: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  generateInvite: (role?: "admin") => void;
  deleteInvite: (code: string) => void;
  handleChangeRole: (userId: string, newRole: string) => void;
  handleRestoreUser: (userId: string) => void;
  handleDeleteUser: (userId: string, targetName: string) => void;
  handleSuspendUser: (userId: string, targetName: string) => void;
  handleToggleRegistration: () => void;
}

// Une date invalide ne doit pas faire tomber l'ecran.
function dateCourte(t?: number): string {
  if (!t) return "";
  const d = new Date(t);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

export default function OngletUtilisateurs({
  activeUser,
  usersList,
  invitesList,
  settings,
  customCodeInput,
  setCustomCodeInput,
  maxUsesInput,
  setMaxUsesInput,
  pendingRoleChanges,
  setPendingRoleChanges,
  generateInvite,
  deleteInvite,
  handleChangeRole,
  handleRestoreUser,
  handleDeleteUser,
  handleSuspendUser,
  handleToggleRegistration,
}: Props) {
  const [codeCopie, setCodeCopie] = useState<string | null>(null);

  const copier = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopie(code);
      setTimeout(() => setCodeCopie(null), 2000);
    } catch {
      // Presse-papiers refuse par le navigateur : le code reste lisible a l'ecran.
    }
  };

  const codesAdmin = invitesList.filter((i) => i.role === "admin");
  const codesMembres = invitesList.filter((i) => i.role !== "admin");

  return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-6">
                Paramètres Globaux
              </h3>
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between pb-6 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                    <p className="font-medium text-zinc-800 dark:text-zinc-200">
                      Ouverture des inscriptions
                    </p>
                    <p className="text-sm text-zinc-500">
                      Ouvert : n'importe qui peut créer un compte et accède
                      immédiatement aux films. Fermé : seules les personnes
                      munies d'un code d'invitation peuvent s'inscrire.
                    </p>
                  </div>
                  <button
                    onClick={handleToggleRegistration}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${settings.allowRegistrations ? "bg-green-500" : "bg-zinc-200 dark:bg-zinc-700"}`}
                  >
                    <span
                      className={`${settings.allowRegistrations ? "translate-x-6" : "translate-x-1"} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {hasRole(activeUser, "owner") && (
              <div className="bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700/60 rounded-xl p-6">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                      <Shield className="w-5 h-5 text-amber-500" />
                      Code administrateur
                    </h3>
                    <p className="text-sm text-zinc-500 mt-1 max-w-xl">
                      La personne qui s'inscrit avec ce code devient administratrice immédiatement, sans validation.
                      Usage unique, valable 7 jours. À transmettre par un canal privé : quiconque le possède obtient ces droits.
                    </p>
                  </div>
                  <button
                    onClick={() => generateInvite("admin")}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-medium shrink-0"
                  >
                    Créer un code administrateur
                  </button>
                </div>
                {codesAdmin.length > 0 ? (
                  <ul className="space-y-2">
                    {codesAdmin.map((inv) => {
                      const expire = !inv.used && !!inv.expiresAt && Date.now() > inv.expiresAt;
                      return (
                        <li
                          key={inv.code}
                          className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 bg-amber-50 dark:bg-amber-900/10 p-3 rounded"
                        >
                          <span className="font-mono text-lg font-bold tracking-widest text-zinc-900 dark:text-white break-all">
                            {inv.code}
                          </span>
                          <span className="flex flex-wrap items-center gap-4">
                            {inv.used ? (
                              <span className="text-zinc-500 text-sm">
                                Utilisé{inv.usedBy ? ` par ${inv.usedBy}` : ""}
                              </span>
                            ) : expire ? (
                              <span className="text-primary-500 text-sm font-medium">Expiré</span>
                            ) : (
                              <>
                                <span className="text-green-600 text-sm font-medium">
                                  Actif{inv.expiresAt ? ` jusqu'au ${dateCourte(inv.expiresAt)}` : ""}
                                </span>
                                <button
                                  onClick={() => copier(inv.code)}
                                  className="flex items-center gap-1 text-sm text-zinc-700 dark:text-zinc-300 hover:text-amber-600"
                                >
                                  {codeCopie === inv.code ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                  {codeCopie === inv.code ? "Copié" : "Copier"}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => deleteInvite(inv.code)}
                              className="text-zinc-500 hover:text-primary-500 text-xs underline"
                            >
                              Supprimer
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-zinc-500">Aucun code administrateur.</p>
                )}
              </div>
            )}

            {hasRole(activeUser, "owner") && !settings.allowRegistrations && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-4">
                  <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
                    Codes d'Invitation
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="Code personnalisé (optionnel)"
                      value={customCodeInput}
                      onChange={(e) => setCustomCodeInput(e.target.value)}
                      className="px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded"
                    />
                    <div className="flex bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded">
                      <select
                        value={maxUsesInput}
                        onChange={(e) => setMaxUsesInput(e.target.value)}
                        className="px-3 py-2 text-sm bg-transparent outline-none text-zinc-900 dark:text-white border-r border-zinc-200 dark:border-zinc-800"
                      >
                        <option value="1">1 utilisation</option>
                        {Array.from({ length: 4 }).map((_, i) => (
                          <option key={i + 2} value={i + 2}>
                            {i + 2} utilisations
                          </option>
                        ))}
                        <option value="10">10 utilisations</option>
                        <option value="custom">Val. perso</option>
                      </select>
                      {maxUsesInput === "custom" ? (
                        <input
                          type="number"
                          min="1"
                          placeholder="Valeur libre"
                          onChange={(e) => setMaxUsesInput(e.target.value)}
                          className="px-3 py-2 text-sm w-24 bg-transparent outline-none text-zinc-900 dark:text-white"
                        />
                      ) : null}
                    </div>
                    <button
                      onClick={() => generateInvite()}
                      className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded text-sm font-medium"
                    >
                      Générer
                    </button>
                  </div>
                </div>
                {codesMembres.length > 0 ? (
                  <ul className="space-y-2">
                    {codesMembres.map((inv) => (
                      <li
                        key={inv.code}
                        className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded"
                      >
                        <span className="font-mono text-lg font-bold tracking-widest text-zinc-900 dark:text-white">
                          {inv.code}
                        </span>
                        <span className="flex items-center gap-4">
                          {inv.used ? (
                            <span className="text-primary-500 text-sm font-medium">
                              Épuisé
                            </span>
                          ) : (
                            <span className="text-green-500 text-sm font-medium">
                              Actif ({inv.currentUses || 0}/{inv.maxUses || 1})
                            </span>
                          )}
                          <button
                            onClick={() => deleteInvite(inv.code)}
                            className="text-zinc-500 hover:text-primary-500 text-xs underline"
                          >
                            Supprimer
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-zinc-500">Aucun code généré.</p>
                )}
              </div>
            )}

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
                <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-4 font-medium">Nom</th>
                    <th className="px-6 py-4 font-medium">Utilisateur (ID)</th>
                    <th className="px-6 py-4 font-medium">Rôle</th>
                    <th className="px-6 py-4 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {usersList.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${u.color}`} />
                        {u.name}
                      </td>
                      <td className="px-6 py-4">{u.username}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          {hasRole(u, "owner") ? (
                              <span className="uppercase text-xs font-semibold">Patron</span>
                          ) : (
                              <div className="flex items-center gap-2">
                                <select
                                    disabled={!hasRole(activeUser, "owner")}
                                    value={pendingRoleChanges[u.id] || primaryRole(u)}
                                    onChange={(e) => setPendingRoleChanges((prev) => ({ ...prev, [u.id]: e.target.value }))}
                                    className="text-xs border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="user">Spectateur</option>
                                    <option value="technician">Technicien</option>
                                    <option value="admin">Admin</option>
                                </select>
                                {pendingRoleChanges[u.id] && pendingRoleChanges[u.id] !== primaryRole(u) && (
                                    <button
                                        onClick={() => handleChangeRole(u.id, pendingRoleChanges[u.id])}
                                        disabled={!hasRole(activeUser, "owner")}
                                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                        title="Valider le changement"
                                    >
                                        <Check className="w-3 h-3" /> Valider
                                    </button>
                                )}
                              </div>
                          )}
                          {hasRole(u, "technician") && !pendingRoleChanges[u.id] && (
                              <span className="text-[10px] text-zinc-500 block max-w-[150px] leading-tight">Peut lancer des transcodages et remplacer des fichiers vidéo</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {u.status === "pending_ban" ? (
                            <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2">
                              <span className="text-[10px] bg-primary-500/10 text-primary-500 font-semibold px-2 py-1 rounded border border-primary-500/15 whitespace-nowrap">
                                ⚠️ Suspendu par {u.requestedBanBy || "Admin"}
                              </span>
                              <div className="flex gap-1.5 mt-1 sm:mt-0">
                                {hasRole(activeUser, "owner") && (
                                  <button
                                    onClick={() =>
                                      handleDeleteUser(
                                        u.id,
                                        u.name || u.username,
                                      )
                                    }
                                    className="text-white hover:bg-primary-500 transition-all font-semibold text-[11px] bg-primary-600 hover:shadow-sm px-2.5 py-1.5 rounded tracking-wide uppercase"
                                  >
                                    Bannir déf.
                                  </button>
                                )}
                                {hasRole(activeUser, "owner") ? (
                                  <button
                                    onClick={() => handleRestoreUser(u.id)}
                                    className="text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-805 transition-all font-medium text-[11px] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 rounded"
                                  >
                                    Réactiver
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-zinc-500 whitespace-nowrap">
                                    En attente du Patron
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className="text-zinc-400 cursor-default">
                                Actif
                              </span>
                              {/* Proprietaire : bannissement definitif. Admin : suspension
                                  soumise au proprietaire, jamais sur un autre admin. */}
                              {u.id !== activeUser.id && !hasRole(u, "owner") && (
                                hasRole(activeUser, "owner") ? (
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.name || u.username)}
                                    className="px-3 py-1 bg-primary-500/10 text-primary-600 font-medium rounded hover:bg-primary-500/20 text-xs ml-2"
                                  >
                                    Bannir
                                  </button>
                                ) : hasRole(activeUser, "admin") && !hasRole(u, "admin") ? (
                                  <button
                                    onClick={() => handleSuspendUser(u.id, u.name || u.username)}
                                    className="px-3 py-1 bg-amber-500/10 text-amber-600 font-medium rounded hover:bg-amber-500/20 text-xs ml-2"
                                  >
                                    Suspendre
                                  </button>
                                ) : null
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
  );
}
