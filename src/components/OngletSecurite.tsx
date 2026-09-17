import React from "react";
import { Server } from "lucide-react";
import { ReglagesServeur, User } from "../types";
import { hasRole } from "../lib/roles";
import { notify } from "../lib/notify";

// Onglet extrait de ContributeApp. Aucun etat propre : tout arrive par les props.
interface Props {
  activeUser: User;
  settings: ReglagesServeur;
  webhookUrlInput: string;
  setWebhookUrlInput: React.Dispatch<React.SetStateAction<string>>;
  securityCodeInput: string;
  setSecurityCodeInput: React.Dispatch<React.SetStateAction<string>>;
  showSecurityCodeInput: boolean;
  setShowSecurityCodeInput: React.Dispatch<React.SetStateAction<boolean>>;
  isSavingServer: boolean;
  setIsSavingServer: React.Dispatch<React.SetStateAction<boolean>>;
  isSavingSecurityCode: boolean;
  setIsSavingSecurityCode: React.Dispatch<React.SetStateAction<boolean>>;
  isRegeneratingSecurityCode: boolean;
  setIsRegeneratingSecurityCode: React.Dispatch<React.SetStateAction<boolean>>;
  fetchData: () => void;
}

export default function OngletSecurite({
  activeUser,
  settings,
  webhookUrlInput,
  setWebhookUrlInput,
  securityCodeInput,
  setSecurityCodeInput,
  showSecurityCodeInput,
  setShowSecurityCodeInput,
  isSavingServer,
  setIsSavingServer,
  isSavingSecurityCode,
  setIsSavingSecurityCode,
  isRegeneratingSecurityCode,
  setIsRegeneratingSecurityCode,
  fetchData,
}: Props) {
  return (
          <div className="space-y-6">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                  <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                      <Server className="w-5 h-5" /> Intégrations Systèmes
                  </h3>
                  <div className="space-y-4 max-w-xl">
                      <div>
                          <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2 flex items-center gap-1">
                              Webhook Discord (Notifications Bug & Upload)
                          </label>
                          <input 
                              type="url"
                              placeholder="https://discord.com/api/webhooks/..."
                              value={webhookUrlInput}
                              onChange={e => setWebhookUrlInput(e.target.value)}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-2.5 focus:ring-1 focus:ring-primary-500 outline-none text-zinc-900 dark:text-white text-sm"
                          />
                      </div>
                      <button 
                          type="button"
                          disabled={isSavingServer}
                          onClick={async () => {
                              setIsSavingServer(true);
                              try {
                                  await fetch('/api/settings', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ webhookUrl: webhookUrlInput })
                                  });
                                  notify("Webhook sauvegardé avec succès", "Succès");
                                  fetchData();
                              } catch (e) {
                                  notify("Erreur de sauvegarde", "Erreur");
                              }
                              setIsSavingServer(false);
                          }}
                          className="bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-2 rounded-lg font-medium text-sm transition hover:opacity-90 disabled:opacity-50"
                      >
                          Sauvegarder
                      </button>
                  </div>
              </div>

              {hasRole(activeUser, 'owner') && (
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                      <h3 className="text-lg font-medium text-primary-600 mb-6 flex items-center gap-2">
                          Sécurité du Studio (Code de Validation)
                      </h3>
                      <div className="space-y-6 max-w-xl">
                          <div>
                              <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                                  Code de sécurité actuel (6 chiffres)
                              </label>
                              <div className="flex gap-2">
                                  <input 
                                      type={showSecurityCodeInput ? "text" : "password"}
                                      maxLength={6}
                                      value={securityCodeInput}
                                      onChange={e => {
                                          const val = e.target.value.replace(/\D/g, '').substring(0, 6);
                                          setSecurityCodeInput(val);
                                      }}
                                      className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-2.5 focus:ring-1 focus:ring-primary-500 outline-none text-zinc-900 dark:text-white text-sm tracking-[0.5em] font-mono text-center font-bold"
                                  />
                                  <button 
                                      type="button"
                                      onClick={() => setShowSecurityCodeInput(!showSecurityCodeInput)}
                                      className="px-4 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm hover:opacity-80 font-medium"
                                  >
                                      {showSecurityCodeInput ? "Masquer" : "Afficher"}
                                  </button>
                              </div>
                              <p className="text-xs text-zinc-500 mt-2">Ce code est requis pour valider les actions de destruction définitive.</p>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-3">
                              <button 
                                  type="button"
                                  disabled={isSavingSecurityCode || securityCodeInput.length !== 6}
                                  onClick={async () => {
                                      setIsSavingSecurityCode(true);
                                      try {
                                          const res = await fetch('/api/settings', {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ securityCode: securityCodeInput })
                                          });
                                          if (res.ok) {
                                              notify("Code de sécurité mis à jour", "Succès");
                                              fetchData();
                                          } else {
                                              notify("Erreur d'enregistrement", "Erreur");
                                          }
                                      } catch (e) {
                                          notify("Erreur réseau", "Erreur");
                                      }
                                      setIsSavingSecurityCode(false);
                                  }}
                                  className="flex-1 bg-zinc-900 dark:bg-white text-white dark:text-black py-2.5 rounded-lg font-medium text-sm transition hover:opacity-90 disabled:opacity-50"
                              >
                                  Sauvegarder le code manuellement
                              </button>
                              
                              <button 
                                  type="button"
                                  disabled={isRegeneratingSecurityCode}
                                  onClick={async () => {
                                      if (!window.confirm("Êtes-vous sûr de vouloir régénérer un nouveau code ? L'ancien code sera immédiatement révoqué.")) return;
                                      setIsRegeneratingSecurityCode(true);
                                      try {
                                          const res = await fetch('/api/settings/security/regenerate', { method: 'POST' });
                                          const data = await res.json();
                                          if (res.ok) {
                                              setSecurityCodeInput(data.securityCode);
                                              let msg = "Nouveau code généré ! ";
                                              if (data.sentToDiscord) msg += "Envoyé sur Discord.";
                                              else if (data.sentToEmail) msg += `Envoyé par e-mail à ${data.emailSentTo}.`;
                                              notify(msg, "Succès");
                                              fetchData();
                                          } else {
                                              notify(data.error || "Erreur de régénération", "Erreur");
                                          }
                                      } catch (e) {
                                          notify("Erreur réseau", "Erreur");
                                      }
                                      setIsRegeneratingSecurityCode(false);
                                  }}
                                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-lg font-medium text-sm transition disabled:opacity-50 text-center"
                              >
                                  Régénérer & Envoyer
                              </button>
                          </div>
                      </div>
                  </div>
              )}
          </div>
  );
}
