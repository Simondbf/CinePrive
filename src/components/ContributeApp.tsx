import React, { useState, useEffect } from 'react';
import { notify } from '../lib/notify';
import { Film, User } from '../types';
import { UploadCloud, Search, CheckCircle, Database, Server, X } from 'lucide-react';

interface Props {
  activeUser: User;
  films: Film[];
  onRefresh: () => void;
  mode: 'upload' | 'admin';
}

export default function ContributeApp({ activeUser, films, onRefresh, mode }: Props) {
  const [tab, setTab] = useState<'upload' | 'library' | 'users' | 'requests' | 'polls' | 'funding'>(mode === 'upload' ? 'upload' : 'users');
  const [usersList, setUsersList] = useState<User[]>([]);
  const [requestsList, setRequestsList] = useState<any[]>([]);
  const [invitesList, setInvitesList] = useState<{code: string, used: boolean, maxUses?: number, currentUses?: number}[]>([]);
  const [pollResults, setPollResults] = useState<any>({});
  const [settings, setSettings] = useState<{ allowRegistrations: boolean, fundingCurrent?: number, fundingGoal?: number }>({ allowRegistrations: true });
  const [dialogState, setDialogState] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void, isAlert?: boolean, closeOnConfirm?: boolean}>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Nouveaux états locaux pour les super-codes
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [maxUsesInput, setMaxUsesInput] = useState('');

  const [pollsConfig, setPollsConfig] = useState<any[]>([]);
  const [editingPollId, setEditingPollId] = useState<string | null>(null);

  const fetchData = React.useCallback(() => {
     fetch('/api/users').then(r => r.json()).then(setUsersList).catch(console.error);
     fetch('/api/requests').then(r => r.json()).then(setRequestsList).catch(console.error);
     fetch('/api/settings').then(r => r.json()).then(setSettings).catch(console.error);
     fetch('/api/invites').then(r => r.json()).then(setInvitesList).catch(console.error);
     fetch('/api/polls/results').then(r => r.json()).then(setPollResults).catch(console.error);
     fetch('/api/polls/config').then(r => r.json()).then(setPollsConfig).catch(console.error);
  }, []);

  useEffect(() => {
     fetchData();
  }, [fetchData]);

  useEffect(() => {
     setTab(mode === 'upload' ? 'upload' : 'users');
  }, [mode]);

  const generateInvite = async () => {
      try {
          const bodyPayload: any = {};
          if (customCodeInput.trim()) bodyPayload.customCode = customCodeInput.trim();
          if (maxUsesInput && parseInt(maxUsesInput) > 0) bodyPayload.maxUses = parseInt(maxUsesInput);

          const res = await fetch('/api/invites', { 
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(bodyPayload)
          });
          
          if (!res.ok) {
              const err = await res.json();
              notify(err.error, "Erreur");
          } else {
              setCustomCodeInput('');
              setMaxUsesInput('');
              fetchData();
          }
      } catch(e) { console.error(e); }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
      try {
          await fetch(`/api/users/${userId}/role`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role: newRole })
          });
          fetchData();
      } catch(e) { console.error(e); }
  };

  const deleteInvite = async (code: string) => {
      try {
          await fetch(`/api/invites/${code}`, { method: 'DELETE' });
          fetchData();
      } catch(e) { console.error(e); }
  };

  const [securityModal, setSecurityModal] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      operation: 'delete_film' | 'delete_user';
      targetId: string;
      targetLabel: string;
      code: string;
      error: string;
      demoNotice?: string;
      onSuccess: () => Promise<void>;
  }>({
      isOpen: false,
      title: '',
      message: '',
      operation: 'delete_film',
      targetId: '',
      targetLabel: '',
      code: '',
      error: '',
      onSuccess: async () => {}
  });

  const triggerSecurityValidation = async (
      operation: 'delete_film' | 'delete_user',
      targetId: string,
      targetLabel: string,
      title: string,
      message: string,
      onSuccess: () => Promise<void>
  ) => {
      // 1. Ouvrir le modal immédiatement avec un message de chargement/génération
      setSecurityModal({
          isOpen: true,
          title,
          message,
          operation,
          targetId,
          targetLabel,
          code: '',
          error: '',
          demoNotice: "🔑 Envoi d'un code de sécurité temporaire à 6 chiffres...",
          onSuccess
      });

      try {
          const requestLabel = operation === 'delete_film' 
              ? `Suppression définitive du film "${targetLabel}"` 
              : `Bannissement définitif de l'utilisateur "${targetLabel}"`;
              
          const res = await fetch('/api/security/request-code', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ operation, targetId, label: requestLabel })
          });
          
          if (!res.ok) {
              const err = await res.json();
              setSecurityModal(prev => ({
                  ...prev,
                  demoNotice: `⚠️ Impossible de générer un code temporaire : ${err.error || 'Erreur serveur'}. Vous pouvez toujours utiliser votre code Patron permanent si configuré.`
              }));
              return;
          }
          
          const data = await res.json();
          let demoNotice = "";
          
          if (data.discordConfigured && data.smtpConfigured) {
              demoNotice = `💬📧 Un code de sécurité temporaire vous a été envoyé instantanément sur Discord et par e-mail.`;
          } else if (data.discordConfigured) {
              demoNotice = `💬 Un code de sécurité temporaire vous a été envoyé instantanément sur votre Discord (via Webhook).`;
          } else if (data.smtpConfigured) {
              demoNotice = `📧 Un code de sécurité temporaire vous a été envoyé par e-mail (${data.emailSentTo}).`;
          } else if (data.codeShownInDemo) {
              demoNotice = `🔑 (Mode Démo) Aucun canal configuré. Utilisez votre code permanent ou ce code de sécurité temporaire : ${data.codeShownInDemo}`;
          } else {
              demoNotice = `🔑 Saisissez votre code de sécurité Patron (permanent ou reçu) pour confirmer cette action.`;
          }

          setSecurityModal(prev => ({
              ...prev,
              demoNotice
          }));
      } catch (err) {
          console.error(err);
          setSecurityModal(prev => ({
              ...prev,
              demoNotice: "⚠️ Erreur de communication de sécurité. Saisissez votre code Patron permanent pour valider."
          }));
      }
  };

  const handleConfirmSecurityAction = async () => {
      if (securityModal.code.trim().length !== 6) {
          setSecurityModal(prev => ({ ...prev, error: "Veuillez entrer le code de sécurité à 6 chiffres." }));
          return;
      }
      
      try {
          const method = 'DELETE';
          const url = securityModal.operation === 'delete_film'
              ? `/api/films/${securityModal.targetId}?code=${securityModal.code}`
              : `/api/users/${securityModal.targetId}?code=${securityModal.code}`;
              
          const res = await fetch(url, { method });
          if (res.ok) {
              setSecurityModal(prev => ({ ...prev, isOpen: false }));
              await securityModal.onSuccess();
              notify("L'opération a été validée et exécutée avec succès.", "Succès");
          } else {
              const err = await res.json();
              setSecurityModal(prev => ({ ...prev, error: err.error || "Opération refusée (code incorrect ou expiré)." }));
          }
      } catch (e) {
          console.error(e);
          setSecurityModal(prev => ({ ...prev, error: "Erreur de communication avec le serveur." }));
      }
  };

  const handleRestoreFilm = async (filmId: string) => {
      try {
          const res = await fetch(`/api/films/${filmId}/restore`, { method: 'POST' });
          if (res.ok) {
              notify("Le film a été rétabli avec succès.", "Succès");
              onRefresh();
          } else {
              const err = await res.json();
              notify(err.error || "Erreur de restauration des droits du film.", "Erreur");
          }
      } catch (e) {
          console.error(e);
          notify("Échec de connexion.", "Erreur");
      }
  };

  const handleRestoreUser = async (userId: string) => {
      try {
          const res = await fetch(`/api/users/${userId}/restore`, { method: 'POST' });
          if (res.ok) {
              notify("Le compte de l'utilisateur a été réactivé avec succès.", "Succès");
              fetchData();
          } else {
              const err = await res.json();
              notify(err.error || "Erreur de réactivation de l'utilisateur.", "Erreur");
          }
      } catch (e) {
          console.error(e);
          notify("Échec de connexion.", "Erreur");
      }
  };

  const handleDeleteUser = async (userId: string, targetName: string) => {
      if (activeUser.role === 'admin') {
          // Si simple admin -> suspension temporaire sans code
          setDialogState({
              isOpen: true,
              title: "Suspendre l'utilisateur",
              message: `Êtes-vous sûr de vouloir suspendre temporairement "${targetName}" ? Son compte sera bloqué et masqué, et le Patron devra valider son bannissement définitif.`,
              onConfirm: async () => {
                  try {
                      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
                      if (res.ok) {
                          notify(`La suspension de ${targetName} a été enregistrée.`, "Succès");
                          fetchData();
                      } else {
                          const err = await res.json();
                          notify(err.error || "Impossible de suspendre l'utilisateur", "Erreur");
                      }
                  } catch (e) {
                      console.error(e);
                      notify("Erreur de connexion", "Erreur");
                  }
              }
          });
      } else {
          // Si Patron (owner) -> code de sécurité requis
          triggerSecurityValidation(
              'delete_user',
              userId,
              targetName,
              'Bannir un utilisateur',
              `Saisissez le code de validation reçu (par e-mail ou code Maître) pour confirmer la suppression définitive de l'utilisateur "${targetName}" et de tous ses accès.`,
              async () => {
                  fetchData();
              }
          );
      }
  };

  const handleDeleteFilm = async (filmId: string, filmTitle: string) => {
      if (activeUser.role === 'admin') {
          // Si simple admin -> suppression temporaire sans code
          setDialogState({
              isOpen: true,
              title: "Suspendre le film",
              message: `Êtes-vous sûr de vouloir suspendre le film "${filmTitle}" ? Il sera masqué pour les membres, et le Patron devra de valider sa destruction définitive.`,
              onConfirm: async () => {
                  try {
                      const res = await fetch(`/api/films/${filmId}`, { method: 'DELETE' });
                      if (res.ok) {
                          notify(`Le film "${filmTitle}" a été suspendu temporairement.`, "Succès");
                          onRefresh();
                      } else {
                          const err = await res.json();
                          notify(err.error || "Impossible de suspendre le film", "Erreur");
                      }
                  } catch (e) {
                      console.error(e);
                      notify("Erreur de connexion", "Erreur");
                  }
              }
          });
      } else {
          // Si Patron (owner) -> code de sécurité requis
          triggerSecurityValidation(
              'delete_film',
              filmId,
              filmTitle,
              'Supprimer définitivement un film',
              `Saisissez le code de validation reçu (par e-mail ou code Maître) pour confirmer la destruction définitive du film "${filmTitle}" et de son fichier vidéo sur le serveur.`,
              async () => {
                  onRefresh();
              }
          );
      }
  };

  const handleToggleRegistration = async () => {
      try {
          const res = await fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ allowRegistrations: !settings.allowRegistrations })
          });
          const newSettings = await res.json();
          setSettings(newSettings);
      } catch (e) { console.error(e); }
  };

  const handleApproveUser = async (userId: string) => {
      try {
          await fetch(`/api/users/${userId}/approve`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({})
          });
          fetchData();
      } catch (e) { console.error(e); }
  };

  const handleDeleteRequest = async (requestId: string) => {
      try {
          await fetch(`/api/requests/${requestId}`, { method: 'DELETE' });
          fetchData();
      } catch (e) { console.error(e); }
  };
  
  // Upload State
  interface UploadTask {
      id: string;
      file: File;
      tmdbQuery: string;
      tmdbResults: any[];
      selectedMeta: any | null;
      status: 'waiting' | 'uploading' | 'success' | 'error';
      progress: number;
      isSearching: boolean;
  }
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isUploadingGlobal, setIsUploadingGlobal] = useState(false);

  useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
          if (isUploadingGlobal) {
              e.preventDefault();
              e.returnValue = "Un téléchargement est en cours. Si vous quittez la page, il sera annulé !";
              return e.returnValue;
          }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploadingGlobal]);

  const searchTMDBForTask = async (taskId: string, query: string) => {
      if (!query || query.length < 2) return;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isSearching: true } : t));
      try {
          const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(query)}`);
          const data = await res.json();
          setTasks(prev => prev.map(t => {
              if (t.id === taskId) {
                  const results = data.results || [];
                  return {
                      ...t,
                      isSearching: false,
                      tmdbResults: results,
                      selectedMeta: results.length > 0 ? results[0] : null
                  };
              }
              return t;
          }));
      } catch (e) {
          setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isSearching: false } : t));
      }
  };

  const manualSearch = (taskId: string, query: string) => {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, tmdbQuery: query } : t));
      searchTMDBForTask(taskId, query);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      const newTasks: UploadTask[] = [];

      for (const f of selectedFiles) {
          const nameWithoutExt = f.name.replace(/\.[^/.]+$/, "");
          let cleanName = nameWithoutExt.replace(/[\._-]/g, ' ')
                                          .replace(/[\[\(].*?[\]\)]/g, '')
                                          .replace(/\b(1080p|720p|480p|mp4|avi|mov|wmv|av1|x264|x265|bluray|webrip|hdrip|dvdrip|cam|fr|vostfr|truefrench|b1|t00|t01|t02|t03)\b/gi, '')
                                          .replace(/^[0-9rn]+\s*/, '') // Supprime les nombres au début (comme "1 ", "2 ")
                                          .trim();
          
          // "HP" to "Harry Potter" as a nice standardisation for known acronyms if needed, though manual search is preferred
          if (cleanName.toUpperCase().includes('HP AND THE')) {
              cleanName = cleanName.replace(/HP/i, 'Harry Potter');
          }
          newTasks.push({
              id: Date.now().toString() + Math.random().toString().slice(2),
              file: f,
              tmdbQuery: cleanName,
              tmdbResults: [],
              selectedMeta: null,
              status: 'waiting',
              progress: 0,
              isSearching: false
          });
      }

      if (newTasks.length > 0) {
          setTasks(prev => [...prev, ...newTasks]);
          newTasks.forEach(task => searchTMDBForTask(task.id, task.tmdbQuery));
      }
      e.target.value = '';
  };

  const updateTaskMeta = (taskId: string, meta: any) => {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, selectedMeta: meta } : t));
  };

  const removeTask = (taskId: string) => {
      setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const resetUpload = () => {
      if (isUploadingGlobal) {
          if (!window.confirm("Couper la connexion : Un transfert est en cours vers le serveur. Êtes-vous sûr de vouloir l'annuler ?")) {
              return;
          }
      }
      setTasks([]);
      setIsUploadingGlobal(false);
  };

  const submitUploadQueue = async () => {
      const pendingTasks = tasks.filter(t => t.status === 'waiting' && t.selectedMeta);
      if (pendingTasks.length === 0) return;
      
      setIsUploadingGlobal(true);

      for (const task of pendingTasks) {
          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'uploading', progress: 0 } : t));

          try {
              const uploadId = Date.now().toString() + Math.random().toString().slice(2);
              const chunkSize = 50 * 1024 * 1024; // 50MB
              const totalChunks = Math.ceil(task.file.size / chunkSize);

              let failed = false;
              for (let i = 0; i < totalChunks; i++) {
                  const start = i * chunkSize;
                  const end = Math.min(start + chunkSize, task.file.size);
                  const chunk = task.file.slice(start, end);

                  const formData = new FormData();
                  formData.append('chunk', chunk);
                  formData.append('uploadId', uploadId);

                  const res = await fetch('/api/films/upload-chunk', {
                      method: 'POST',
                      body: formData
                  });

                  if (!res.ok) {
                      failed = true;
                      break;
                  }
                  
                  setTasks(prev => prev.map(t => t.id === task.id ? { ...t, progress: Math.round(((i + 1) / totalChunks) * 100) } : t));
              }

              if (failed) throw new Error("Chunk upload failed");

              const finRes = await fetch('/api/films/upload-finalize', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      uploadId,
                      filename: task.file.name,
                      originalName: task.file.name,
                      metadata: task.selectedMeta,
                      user: activeUser.id
                  })
              });

              if (finRes.ok) {
                  setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'success' } : t));
                  onRefresh(); // reload global library
              } else {
                  setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'error' } : t));
              }
          } catch (err) {
              setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'error' } : t));
          }
      }

      setIsUploadingGlobal(false);
  };


  const AdminPanelNav = () => (
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-800 mb-8 pb-4">
          {mode === 'upload' ? (
              <button 
                 className={`px-4 py-2 font-medium rounded transition-colors bg-zinc-800 dark:bg-white text-white dark:text-black`}
              >
                 Plateforme de Transfert
              </button>
          ) : (
              <>
                  {(activeUser.role === 'owner' || activeUser.role === 'admin') && (
                      <button 
                         className={`px-4 py-2 font-medium rounded transition-colors ${tab === 'users' ? 'bg-zinc-800 dark:bg-white text-white dark:text-black' : 'text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300'}`}
                         onClick={() => setTab('users')}
                      >
                         Membres ({usersList.filter(u => u.status === 'pending').length} en attente)
                      </button>
                  )}
                  <button 
                     className={`px-4 py-2 font-medium rounded transition-colors ${tab === 'requests' ? 'bg-zinc-800 dark:bg-white text-white dark:text-black' : 'text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300'}`}
                     onClick={() => setTab('requests')}
                  >
                     Demandes ({requestsList.length})
                  </button>
                  {(activeUser.role === 'owner' || activeUser.role === 'admin') && (
                      <button 
                         className={`px-4 py-2 font-medium rounded transition-colors ${tab === 'funding' ? 'bg-zinc-800 dark:bg-white text-white dark:text-black' : 'text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300'}`}
                         onClick={() => setTab('funding')}
                      >
                         Financement
                      </button>
                  )}
                  <button 
                     className={`px-4 py-2 font-medium rounded transition-colors ${tab === 'polls' ? 'bg-zinc-800 dark:bg-white text-white dark:text-black' : 'text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300'}`}
                     onClick={() => setTab('polls')}
                  >
                     Sondages
                  </button>
                  <button 
                     className={`px-4 py-2 font-medium rounded transition-colors ${tab === 'library' ? 'bg-zinc-800 dark:bg-white text-white dark:text-black' : 'text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300'}`}
                     onClick={() => setTab('library')}
                  >
                     Historique ({films.length})
                  </button>
              </>
          )}
      </div>
  );

  return (
    <div className="p-6 md:p-12 pb-24 max-w-[1200px] mx-auto">
        <div className="flex justify-between items-start mb-8 p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-transparent border-l-4 border-l-red-600 rounded-r shadow-sm">
             <div>
                 <h2 className="text-xl font-medium text-zinc-900 dark:text-white mb-2">
                    {mode === 'upload' ? 'Espace Contributeur' : 'Administration'}
                 </h2>
                 <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                     {mode === 'upload' ? 'Ici, vous pouvez ajouter vos films à la bibliothèque partagée CinéPrivé depuis votre ordinateur.' : 'Gérez les accès, les demandes et les paramètres globaux de la plateforme.'}
                 </p>
             </div>
             {mode === 'admin' && (
                 <button onClick={fetchData} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded text-sm font-medium transition flex items-center gap-2">
                     Actualiser
                 </button>
             )}
        </div>

        <AdminPanelNav />

        {tab === 'upload' && (
            activeUser.status === 'pending' ? (
                <div className="p-12 text-center bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-xl font-medium text-red-600 mb-2">Accès Restreint</h3>
                    <p className="text-zinc-600 dark:text-zinc-400">
                       Votre compte est en attente de vérification par un administrateur. L'ajout de contenu est temporairement bloqué, mais vous pouvez totalement écumer la bibliothèque et visionner les films !
                    </p>
                </div>
            ) : (
            <>
                <div className="flex flex-col gap-6">
                    {/* Zone de Drop / Selection Multiple */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <label className={`block border-2 border-dashed border-zinc-700 bg-zinc-950 rounded-lg p-8 relative cursor-pointer hover:border-zinc-500 transition text-center`}>
                            <input type="file" multiple accept="video/*,.mkv" className="hidden" onChange={handleFileSelect} />
                            <UploadCloud className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                            <p className="font-medium text-white mb-1">Cliquez pour ajouter un ou plusieurs films</p>
                            <p className="text-xs text-zinc-500">Formats supportés : MP4, MKV, AVI, etc. Les vidéos seront automatiquement optimisées en MP4 sur le serveur en arrière-plan.</p>
                        </label>
                    </div>

                    {/* Liste des films en attente */}
                    {tasks.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                            <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
                                <h3 className="font-medium text-white flex items-center gap-2">
                                    <Database className="w-4 h-4 text-zinc-400" /> File d'attente ({tasks.length})
                                </h3>
                                <button onClick={resetUpload} className="text-xs text-zinc-400 hover:text-white transition">Tout vider</button>
                            </div>
                            <div className="divide-y divide-zinc-800">
                                {tasks.map((task) => (
                                    <div key={task.id} className="p-4 flex flex-col md:flex-row gap-4">
                                        <div className="md:w-1/3 flex flex-col gap-1">
                                            <div className="flex items-start justify-between">
                                                <p className="font-medium text-sm text-white line-clamp-1 flex-1" title={task.file.name}>{task.file.name}</p>
                                                {task.status === 'waiting' && <button onClick={() => removeTask(task.id)} className="text-zinc-600 hover:text-red-500 transition ml-2"><X className="w-4 h-4" /></button>}
                                            </div>
                                            <p className="text-xs text-zinc-500">{(task.file.size / (1024*1024)).toFixed(0)} Mo</p>
                                            
                                            {task.status === 'uploading' && (
                                                <div className="mt-2 text-xs font-medium text-blue-400 flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${task.progress}%` }} />
                                                    </div>
                                                    {task.progress}%
                                                </div>
                                            )}
                                            {task.status === 'success' && <p className="text-xs text-green-500 mt-2 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Envoyé avec succès</p>}
                                            {task.status === 'error' && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><X className="w-3 h-3"/> Erreur lors de l'envoi</p>}
                                        </div>

                                        <div className="md:w-2/3">
                                            {task.status === 'waiting' && !task.selectedMeta ? (
                                                <div className="space-y-3">
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            value={task.tmdbQuery} 
                                                            onChange={(e) => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, tmdbQuery: e.target.value } : t))}
                                                            onKeyDown={(e) => e.key === 'Enter' && searchTMDBForTask(task.id, task.tmdbQuery)}
                                                            className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
                                                            placeholder="Rechercher un autre titre..."
                                                        />
                                                        <button onClick={() => searchTMDBForTask(task.id, task.tmdbQuery)} className="px-3 bg-zinc-800 rounded text-xs font-medium text-white hover:bg-zinc-700 transition">Rechercher</button>
                                                    </div>
                                                    
                                                    {task.isSearching ? (
                                                        <p className="text-xs text-zinc-500">Recherche TMDB en cours...</p>
                                                    ) : task.tmdbResults.length > 0 ? (
                                                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                                                            {task.tmdbResults.map((res: any) => (
                                                                <div key={res.id} onClick={() => updateTaskMeta(task.id, res)} className="w-[90px] shrink-0 cursor-pointer group">
                                                                    {res.poster_path ? (
                                                                        <img src={`https://image.tmdb.org/t/p/w92${res.poster_path}`} className="w-full h-[135px] object-cover rounded bg-zinc-800 group-hover:ring-2 ring-gold-500 ring-offset-2 ring-offset-zinc-900 transition" />
                                                                    ) : (
                                                                        <div className="w-full h-[135px] bg-zinc-800 rounded flex items-center justify-center p-2 text-center text-[10px] text-zinc-400 group-hover:ring-2 ring-gold-500 ring-offset-2 ring-offset-zinc-900 transition">{res.title}</div>
                                                                    )}
                                                                    <p className="text-[10px] text-zinc-400 mt-1 truncate group-hover:text-white transition">{res.title}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-zinc-500">Aucun résultat trouvé. Modifiez le titre pour chercher à nouveau.</p>
                                                    )}
                                                </div>
                                            ) : task.selectedMeta ? (
                                                <div className="flex items-start gap-4 p-3 bg-zinc-950 rounded border border-green-900/30 line-clamp-2">
                                                    {task.selectedMeta.poster_path ? (
                                                        <img src={`https://image.tmdb.org/t/p/w92${task.selectedMeta.poster_path}`} className="w-12 h-18 object-cover rounded shadow-sm" />
                                                    ) : <div className="w-12 h-18 bg-zinc-800 rounded shadow-sm" />}
                                                    <div className="flex-1">
                                                        <p className="text-gold-500 font-medium text-xs mb-0.5 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> {task.status === 'success' ? 'Importé' : 'Métadonnées liées'}</p>
                                                        <h4 className="font-bold text-white text-sm line-clamp-1">{task.selectedMeta.title} <span className="text-zinc-500 font-normal">({task.selectedMeta.release_date?.split('-')[0]})</span></h4>
                                                        <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">{task.selectedMeta.overview}</p>
                                                    </div>
                                                    {task.status === 'waiting' && <button onClick={() => updateTaskMeta(task.id, null)} className="text-[10px] font-medium text-zinc-400 hover:text-white px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded transition shrink-0">Modifier</button>}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex justify-end gap-3">
                                <button
                                    onClick={submitUploadQueue}
                                    disabled={isUploadingGlobal || tasks.filter(t => t.status === 'waiting' && t.selectedMeta).length === 0}
                                    className="bg-red-600 text-white font-medium px-6 py-2.5 rounded hover:bg-red-500 transition disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isUploadingGlobal ? 'Transfert en cours...' : 'Lancer le téléchargement'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </>
            )
        )}

        {tab === 'library' && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
                    <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="px-6 py-4 font-medium">Titre (TMDB)</th>
                            <th className="px-6 py-4 font-medium">Uploader</th>
                            <th className="px-6 py-4 font-medium">Date d'import</th>
                            <th className="px-6 py-4 font-medium">Fichier d'origine</th>
                            {(activeUser.role === 'owner' || activeUser.role === 'admin') && <th className="px-6 py-4 font-medium text-right">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {films.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-8">Base de données vide.</td></tr>
                        ) : films.map(f => {
                            const uploader = usersList.find(u => u.id === f.addedBy);
                            return (
                                <tr key={f.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white">{f.title}</td>
                                    <td className="px-6 py-4">{uploader?.name || f.addedBy}</td>
                                    <td className="px-6 py-4">{new Date(f.addedAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 max-w-[200px] truncate" title={f.originalName}>
                                        {f.originalName ? f.originalName.replace(/\.[^/.]+$/, "") : ""}
                                    </td>
                                    {(activeUser.role === 'owner' || activeUser.role === 'admin') && (
                                        <td className="px-6 py-4 text-right">
                                            {f.pendingDeletion ? (
                                                <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2">
                                                    <span className="text-[10px] bg-amber-500/10 text-amber-500 font-semibold px-2 py-1 rounded border border-amber-500/10 whitespace-nowrap">
                                                        ⚠️ Suspendu par {f.requestedDeletionBy || 'Admin'}
                                                    </span>
                                                    <div className="flex gap-1.5 mt-1 sm:mt-0">
                                                        {activeUser.role === 'owner' && (
                                                            <button 
                                                                onClick={() => handleDeleteFilm(f.id, f.title)}
                                                                className="text-white hover:bg-red-500 transition-all font-semibold text-[11px] bg-red-600 hover:shadow-sm px-2.5 py-1.5 rounded tracking-wide uppercase"
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
                                                <button 
                                                    onClick={() => handleDeleteFilm(f.id, f.title)}
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-950/60 transition-all font-medium text-xs bg-red-50 dark:bg-red-950/30 px-2.5 py-1.5 rounded"
                                                >
                                                    Supprimer
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        )}

        {tab === 'requests' && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
                    <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="px-6 py-4 font-medium">Titre demandé</th>
                            <th className="px-6 py-4 font-medium">Demandeur</th>
                            <th className="px-6 py-4 font-medium">Date</th>
                            <th className="px-6 py-4 font-medium">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {requestsList.length === 0 ? (
                            <tr><td colSpan={4} className="text-center py-8">Aucune demande en cours.</td></tr>
                        ) : requestsList.map(r => (
                            <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white">{r.title}</td>
                                <td className="px-6 py-4">{r.userName}</td>
                                <td className="px-6 py-4">{new Date(r.createdAt).toLocaleDateString()}</td>
                                <td className="px-6 py-4">
                                    {(activeUser.role === 'owner' || activeUser.role === 'admin' || r.userId === activeUser.id) && (
                                        <button onClick={() => handleDeleteRequest(r.id)} className="text-red-500 hover:text-red-600 underline text-xs">Supprimer</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {tab === 'users' && (activeUser.role === 'owner' || activeUser.role === 'admin') && (
            <div className="space-y-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-6">Paramètres Globaux</h3>
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between pb-6 border-b border-zinc-100 dark:border-zinc-800">
                            <div>
                                <p className="font-medium text-zinc-800 dark:text-zinc-200">Ouverture des inscriptions</p>
                                <p className="text-sm text-zinc-500">Autoriser ou non les nouvelles demandes de compte. Même si ouvert, les comptes doivent être approuvés manuellement par la suite.</p>
                            </div>
                            <button 
                                onClick={handleToggleRegistration}
                                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${settings.allowRegistrations ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                            >
                                <span className={`${settings.allowRegistrations ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between pb-6 border-b border-zinc-100 dark:border-zinc-800">
                            <div>
                                <p className="font-medium text-zinc-800 dark:text-zinc-200">Synchronisation du Serveur Local</p>
                                <p className="text-sm text-zinc-500">Recherche automatiquement les nouveaux ajouts locaux (films, séries, parodies) présents sur le serveur multimédia pour les importer à la bibliothèque de CinéPrivé.</p>
                            </div>
                            <button 
                                onClick={async () => {
                                    setDialogState({
                                        isOpen: true,
                                        title: 'Synchronisation du Serveur Local',
                                        message: 'Voulez-vous synchroniser le catalogue du serveur multimédia ?',
                                        onConfirm: async () => {
                                            try {
                                                const res = await fetch('/api/jellyfin/sync', { method: 'POST' });
                                                const data = await res.json();
                                                if(data.success) {
                                                    setDialogState(prev => ({...prev, isOpen: true, title: 'Synchronisation terminée', message: `${data.count} nouveautés importées !`, isAlert: true}));
                                                } else {
                                                    setDialogState(prev => ({...prev, isOpen: true, title: 'Erreur', message: data.error, isAlert: true}));
                                                }
                                            } catch (e) {
                                                setDialogState(prev => ({...prev, isOpen: true, title: 'Erreur', message: 'Erreur de requête', isAlert: true}));
                                            }
                                        }
                                    });
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-sm transition"
                            >
                                Forcer la synchro
                            </button>
                        </div>
                    </div>
                </div>

                {activeUser.role === 'owner' && (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
                            <h3 className="text-lg font-medium text-zinc-900 dark:text-white">Codes d'Invitation</h3>
                            <div className="flex flex-wrap items-center gap-2">
                                <input 
                                    type="text"
                                    placeholder="Code personnalisé (optionnel)"
                                    value={customCodeInput}
                                    onChange={e => setCustomCodeInput(e.target.value)}
                                    className="px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded"
                                />
                                <div className="flex bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded">
                                    <select
                                        value={maxUsesInput}
                                        onChange={e => setMaxUsesInput(e.target.value)}
                                        className="px-3 py-2 text-sm bg-transparent outline-none text-zinc-900 dark:text-white border-r border-zinc-200 dark:border-zinc-800"
                                    >
                                        <option value="1">1 utilisation</option>
                                        {Array.from({length: 4}).map((_, i) => (
                                            <option key={i+2} value={i+2}>{i+2} utilisations</option>
                                        ))}
                                        <option value="10">10 utilisations</option>
                                        <option value="custom">Val. perso</option>
                                    </select>
                                    {maxUsesInput === 'custom' ? (
                                        <input 
                                            type="number"
                                            min="1"
                                            placeholder="Valeur libre"
                                            onChange={(e) => setMaxUsesInput(e.target.value)}
                                            className="px-3 py-2 text-sm w-24 bg-transparent outline-none text-zinc-900 dark:text-white"
                                        />
                                    ) : null}
                                </div>
                                <button onClick={generateInvite} className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded text-sm font-medium">Générer</button>
                            </div>
                        </div>
                        {invitesList.length > 0 ? (
                            <ul className="space-y-2">
                                {invitesList.map(inv => (
                                    <li key={inv.code} className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded">
                                        <span className="font-mono text-lg font-bold tracking-widest text-zinc-900 dark:text-white">{inv.code}</span>
                                        <span className="flex items-center gap-4">
                                            {inv.used ? (
                                                <span className="text-red-500 text-sm font-medium">Épuisé</span>
                                            ) : (
                                                <span className="text-green-500 text-sm font-medium">
                                                    Actif ({inv.currentUses || 0}/{inv.maxUses || 1})
                                                </span>
                                            )}
                                            <button onClick={() => deleteInvite(inv.code)} className="text-zinc-500 hover:text-red-500 text-xs underline">Supprimer</button>
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
                            {usersList.map(u => (
                                <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                                        <span className={`w-3 h-3 rounded-full ${u.color}`} />
                                        {u.name}
                                    </td>
                                    <td className="px-6 py-4">{u.username}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-2">
                                            <span className="uppercase text-xs font-semibold">{u.role === 'owner' ? 'Patron' : (u.role === 'admin' ? 'Admin' : 'Membre')}</span>
                                            {activeUser.role === 'owner' && u.id !== activeUser.id && (
                                                <div className="flex items-center gap-1">
                                                    {u.role === 'admin' ? (
                                                        <button 
                                                            onClick={() => handleChangeRole(u.id, 'user')}
                                                            className="text-[10px] sm:text-xs text-red-500 hover:underline"
                                                        >
                                                            Rétrograder à User
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => {
                                                                setDialogState({
                                                                    isOpen: true,
                                                                    title: 'Promouvoir Admin',
                                                                    message: `Voulez-vous vraiment donner les droits d'administration à ${u.username} ?`,
                                                                    onConfirm: () => handleChangeRole(u.id, 'admin')
                                                                });
                                                            }}
                                                            className="text-[10px] sm:text-xs text-purple-600 hover:underline"
                                                        >
                                                            Promouvoir Admin
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {u.status === 'pending' ? (
                                                <>
                                                    <button 
                                                        onClick={() => handleApproveUser(u.id)}
                                                        className="px-3 py-1 bg-green-500/10 text-green-600 font-medium rounded hover:bg-green-500/20"
                                                    >
                                                        Approuver
                                                    </button>
                                                    {(activeUser.role === 'owner' || activeUser.role === 'admin') && u.id !== activeUser.id && (
                                                        <button
                                                            onClick={() => handleDeleteUser(u.id, u.name || u.username)}
                                                            className="px-3 py-1 bg-red-500/10 text-red-600 font-medium rounded hover:bg-red-500/20 text-xs ml-2"
                                                        >
                                                            Refuser
                                                        </button>
                                                    )}
                                                </>
                                            ) : u.status === 'pending_ban' ? (
                                                <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2">
                                                    <span className="text-[10px] bg-red-500/10 text-red-500 font-semibold px-2 py-1 rounded border border-red-500/15 whitespace-nowrap">
                                                        ⚠️ Suspendu par {u.requestedBanBy || 'Admin'}
                                                    </span>
                                                    <div className="flex gap-1.5 mt-1 sm:mt-0">
                                                        {activeUser.role === 'owner' && (
                                                            <button 
                                                                onClick={() => handleDeleteUser(u.id, u.name || u.username)}
                                                                className="text-white hover:bg-red-500 transition-all font-semibold text-[11px] bg-red-600 hover:shadow-sm px-2.5 py-1.5 rounded tracking-wide uppercase"
                                                            >
                                                                Bannir déf.
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => handleRestoreUser(u.id)}
                                                            className="text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-805 transition-all font-medium text-[11px] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 rounded"
                                                        >
                                                            Réactiver
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-zinc-400 cursor-default">Actif</span>
                                                    {(activeUser.role === 'owner' || activeUser.role === 'admin') && u.id !== activeUser.id && (
                                                        <button
                                                            onClick={() => handleDeleteUser(u.id, u.name || u.username)}
                                                            className="px-3 py-1 bg-red-500/10 text-red-600 font-medium rounded hover:bg-red-500/20 text-xs ml-2"
                                                        >
                                                            Bannir
                                                        </button>
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
        )}

        {tab === 'funding' && (activeUser.role === 'owner' || activeUser.role === 'admin') && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-6">Gestion Financière du Serveur</h3>
                <div className="max-w-md space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Montant actuel de la cagnotte (€)</label>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                value={settings.fundingCurrent || 0}
                                onChange={e => setSettings(s => ({ ...s, fundingCurrent: parseFloat(e.target.value) }))}
                                className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Objectif mensuel (€)</label>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                value={settings.fundingGoal || 12}
                                onChange={e => setSettings(s => ({ ...s, fundingGoal: parseFloat(e.target.value) }))}
                                className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                            />
                        </div>
                    </div>
                    <button 
                        onClick={() => {
                            fetch('/api/settings', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ fundingCurrent: settings.fundingCurrent, fundingGoal: settings.fundingGoal })
                            }).then(() => notify('Modifications sauvegardées avec succès !', 'Cagnotte mise à jour'));
                        }}
                        className="mt-4 w-full bg-red-600 text-white font-medium py-2 rounded hover:bg-red-500 transition"
                    >
                        Valider les modifications
                    </button>
                    <p className="text-xs text-zinc-500 mt-4">
                        Ces valeurs s'affichent publiquement dans la modal "Soutenir". Note: N'ayant pas d'intégration externe vers une banque, l'incrémentation doit être mise à jour manuellement par les soins de l'administrateur lors de l'arrivée de dons pour CinéPrivé.
                    </p>
                </div>
            </div>
        )}

        {tab === 'polls' && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl mx-auto shadow-sm">
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-medium">Résultats des sondages</h3>
                </div>
                <div className="p-6 space-y-8">
                    {pollsConfig.length === 0 ? (
                        <p className="text-zinc-500 text-center py-8">Aucun sondage actif.</p>
                    ) : (
                        pollsConfig.map((config: any) => {
                            const pollId = config.id;
                            const data = pollResults[pollId] || { options: {}, custom: [], userVotes: {} };
                            const title = config.title;
                            const totalVotes = Object.values(data.options).reduce((a: any, b: any) => a + b, 0) as number;
                            return editingPollId === pollId ? (
                                <form key={pollId} className="space-y-4 pb-6 border-b border-zinc-100 dark:border-zinc-800 last:border-0 last:pb-0" onSubmit={async (e) => {
                                    e.preventDefault();
                                    const formData = new FormData(e.currentTarget);
                                    const updatedPoll = {
                                        id: pollId,
                                        title: formData.get('title'),
                                        desc: formData.get('desc'),
                                        allowMultiple: formData.get('allowMultiple') === 'on',
                                        allowCustom: formData.get('allowCustom') === 'on',
                                        options: formData.get('options')?.toString().split('\n').filter(s => s.trim()).map((s, i) => {
                                            const existingConfig = config.options[i];
                                            return { id: existingConfig ? existingConfig.id : 'o' + (i + 1), label: s.trim() };
                                        }) || []
                                    };
                                    const updatedConfig = pollsConfig.map((p: any) => p.id === pollId ? updatedPoll : p);
                                    await fetch('/api/polls/config', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(updatedConfig)
                                    });
                                    setEditingPollId(null);
                                    fetchData();
                                }}>
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-medium">Modifier le sondage</h4>
                                        <button type="button" onClick={() => setEditingPollId(null)} className="text-zinc-500 hover:text-zinc-900">Annuler</button>
                                    </div>
                                    <input name="title" defaultValue={config.title} required className="w-full border rounded px-3 py-2" placeholder="Titre" />
                                    <textarea name="desc" defaultValue={config.desc} className="w-full border rounded px-3 py-2" placeholder="Description" rows={2} />
                                    <textarea name="options" defaultValue={config.options.map((o:any)=>o.label).join('\n')} className="w-full border rounded px-3 py-2" placeholder="Options (1 par ligne)" rows={4} />
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowMultiple" defaultChecked={config.allowMultiple} /> Choix multiples</label>
                                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowCustom" defaultChecked={config.allowCustom} /> Saisie libre</label>
                                    </div>
                                    <button className="bg-zinc-900 text-white px-4 py-2 rounded">Sauvegarder</button>
                                </form>
                            ) : (
                                <div key={pollId} className="space-y-4 pb-6 border-b border-zinc-100 dark:border-zinc-800 last:border-0 last:pb-0">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-medium text-zinc-900 dark:text-white capitalize">{title} ({totalVotes} votes)</h4>
                                        {(activeUser.role === 'owner' || activeUser.role === 'admin') && (
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
                                                            title: 'Vider les résultats',
                                                            message: 'Voulez-vous réinitialiser les résultats de ce sondage ?',
                                                            onConfirm: async () => {
                                                                await fetch(`/api/polls/reset/${pollId}`, { method: 'DELETE' });
                                                                fetch('/api/polls/results').then(r => r.json()).then(setPollResults);
                                                            }
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
                                                            title: 'Supprimer ce sondage',
                                                            message: 'Voulez-vous supprimer définitivement ce sondage ?',
                                                            onConfirm: async () => {
                                                                await fetch(`/api/polls/${pollId}`, { method: 'DELETE' });
                                                                fetchData();
                                                            }
                                                        });
                                                    }}
                                                    className="text-xs text-red-600 hover:underline px-2 py-1 bg-red-50 dark:bg-red-900/10 rounded"
                                                >
                                                    Supprimer
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {Object.entries(data.options).map(([optionId, count]: [string, any]) => {
                                            const percentage = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
                                            const optionConfig = config?.options?.find((o:any) => o.id === optionId);
                                            const label = optionConfig ? optionConfig.label : optionId;
                                            return (
                                                <div key={optionId} className="flex flex-col gap-1">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-zinc-700 dark:text-zinc-300 capitalize">
  {label}
  {data.userVotes && Object.keys(data.userVotes).filter(uid => data.userVotes[uid] === optionId).length > 0 && (
      <span className="block text-[11px] text-zinc-500 font-normal mt-0.5" style={{ textTransform: 'none' }}>
          Votants : {Object.keys(data.userVotes).filter(uid => data.userVotes[uid] === optionId).map(uid => usersList.find((u:any) => u.id === uid)?.username || uid).join(", ")}
      </span>
  )}
</span>
                                                        <span className="font-medium">{count} ({percentage}%)</span>
                                                    </div>
                                                    <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-red-600 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {data.custom && data.custom.length > 0 && (
                                        <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
                                            <h5 className="text-sm font-medium mb-2">Suggestions des membres :</h5>
                                            <ul className="list-disc pl-4 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                                                {data.custom.map((text: string, i: number) => (
                                                    <li key={i}>{text}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        )}
            
        {(activeUser.role === 'owner' || activeUser.role === 'admin') && tab === 'polls' && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl mx-auto shadow-sm mt-8">
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-medium">Créer un nouveau sondage</h3>
                </div>
                <form className="p-6 space-y-4" onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const newPoll = {
                        id: 'p' + Date.now(),
                        title: formData.get('title'),
                        desc: formData.get('desc'),
                        allowMultiple: formData.get('allowMultiple') === 'on',
                        allowCustom: formData.get('allowCustom') === 'on',
                        options: formData.get('options')?.toString().split('\n').filter(s => s.trim()).map((s, i) => ({ id: 'o' + (i + 1), label: s.trim() })) || []
                    };
                    const updatedConfig = [...pollsConfig, newPoll];
                    await fetch('/api/polls/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedConfig)
                    });
                    fetchData();
                    (e.target as HTMLFormElement).reset();
                }}>
                    <div>
                        <label className="block text-sm font-medium mb-1">Titre du sondage</label>
                        <input name="title" required className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded p-2 text-zinc-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <input name="desc" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded p-2 text-zinc-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Options (une par ligne)</label>
                        <textarea name="options" rows={4} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded p-2 resize-none text-zinc-900 dark:text-white" placeholder="Option 1&#10;Option 2..." />
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" name="allowMultiple" id="allowMultiple" className="w-4 h-4 rounded border-zinc-300" />
                            <label htmlFor="allowMultiple" className="text-sm">Autoriser les choix multiples</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" name="allowCustom" id="allowCustom" defaultChecked className="w-4 h-4 rounded border-zinc-300" />
                            <label htmlFor="allowCustom" className="text-sm">Autoriser le choix "Autre suggestion"</label>
                        </div>
                    </div>
                    <button type="submit" className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded font-medium text-sm">
                        Générer le sondage
                    </button>
                </form>
            </div>
        )}

        {/* Modal de confirmation / alert generic */}
        {dialogState.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-sm border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">{dialogState.title}</h3>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">{dialogState.message}</p>
                    <div className="flex items-center justify-end gap-3">
                        {!dialogState.isAlert && (
                            <button 
                                onClick={() => setDialogState(prev => ({...prev, isOpen: false}))}
                                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition"
                            >
                                Annuler
                            </button>
                        )}
                        <button 
                            onClick={() => {
                                if(!dialogState.isAlert) {
                                    dialogState.onConfirm();
                                }
                                if (dialogState.closeOnConfirm !== false) {
                                    setDialogState(prev => ({...prev, isOpen: false}));
                                }
                            }}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded shadow-sm transition"
                        >
                            {dialogState.isAlert ? 'OK' : 'Confirmer'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Modal de Validation de Sécurité par Code */}
        {securityModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <div className="bg-white dark:bg-zinc-920 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-red-500/20 dark:border-red-500/10 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3 mb-4 text-red-600">
                        <span className="p-2 bg-red-500/10 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        </span>
                        <div>
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{securityModal.title}</h3>
                            <p className="text-xs text-red-600 dark:text-red-400 font-semibold uppercase tracking-wider">Autorisation requise</p>
                        </div>
                    </div>

                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed bg-zinc-50 dark:bg-zinc-900/40 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        {securityModal.message}
                    </p>

                    {securityModal.demoNotice && (
                        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                                Notification de Sécurité
                            </div>
                            <p className="font-medium leading-relaxed">{securityModal.demoNotice}</p>
                        </div>
                    )}

                    <div className="space-y-4 mb-6">
                        <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-center">
                            Code de sécurité à 6 chiffres
                        </label>
                        <div className="relative max-w-[240px] mx-auto">
                            <input 
                                type="text" 
                                maxLength={6} 
                                value={securityModal.code} 
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    setSecurityModal(prev => ({ ...prev, code: val, error: '' }));
                                }} 
                                className="w-full tracking-[0.4em] text-center font-mono text-3xl font-extrabold bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-zinc-900 dark:text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all select-all placeholder:text-zinc-300 dark:placeholder:text-zinc-700 placeholder:opacity-30" 
                                placeholder="000000" 
                                autoFocus
                            />
                        </div>

                        {securityModal.error && (
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium text-center bg-red-500/10 border border-red-500/20 py-2 px-3 rounded-lg animate-shake">
                                ⚠️ {securityModal.error}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            type="button"
                            onClick={() => setSecurityModal(prev => ({ ...prev, isOpen: false }))}
                            className="flex-1 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition-all"
                        >
                            Annuler
                        </button>
                        <button 
                            type="button"
                            onClick={handleConfirmSecurityAction}
                            disabled={securityModal.code.length !== 6}
                            className="flex-1 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 rounded-xl shadow-md transition-all uppercase tracking-wide"
                        >
                            Valider et Détruire
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
