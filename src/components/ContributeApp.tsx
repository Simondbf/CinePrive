import React, { useState, useEffect } from 'react';
import { Film, User } from '../types';
import { UploadCloud, Search, CheckCircle, Database, Server } from 'lucide-react';

interface Props {
  activeUser: User;
  films: Film[];
  onRefresh: () => void;
}

export default function ContributeApp({ activeUser, films, onRefresh }: Props) {
  const [tab, setTab] = useState<'upload' | 'library' | 'users' | 'requests'>('upload');
  const [usersList, setUsersList] = useState<User[]>([]);
  const [requestsList, setRequestsList] = useState<any[]>([]);
  const [invitesList, setInvitesList] = useState<{code: string, used: boolean, maxUses?: number, currentUses?: number}[]>([]);
  const [settings, setSettings] = useState<{ allowRegistrations: boolean }>({ allowRegistrations: true });
  
  // Nouveaux états locaux pour les super-codes
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [maxUsesInput, setMaxUsesInput] = useState('');

  const fetchData = React.useCallback(() => {
     fetch('/api/users').then(r => r.json()).then(setUsersList).catch(console.error);
     fetch('/api/requests').then(r => r.json()).then(setRequestsList).catch(console.error);
     fetch('/api/settings').then(r => r.json()).then(setSettings).catch(console.error);
     fetch('/api/invites').then(r => r.json()).then(setInvitesList).catch(console.error);
  }, []);

  useEffect(() => {
     fetchData();
  }, [fetchData]);

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
              alert(err.error);
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
              body: JSON.stringify({ adminId: activeUser.id })
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
  const [tmdbQuery, setTmdbQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState<any[]>([]);
  const [selectedMeta, setSelectedMeta] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const searchTMDB = async () => {
      if (!tmdbQuery) return;
      try {
          const res = await fetch(`/api/tmdb/search?query=${tmdbQuery}`);
          const data = await res.json();
          setTmdbResults(data.results || []);
      } catch (e) {
          console.error(e);
      }
  };

  const submitUpload = async () => {
      if (!file || !selectedMeta) return;
      setIsUploading(true);
      setUploadStatus('idle');

      const formData = new FormData();
      formData.append('video', file);
      formData.append('metadata', JSON.stringify(selectedMeta));
      formData.append('user', activeUser.id);

      try {
          const res = await fetch('/api/films/upload', {
              method: 'POST',
              body: formData
          });
          if (res.ok) {
              setUploadStatus('success');
              setFile(null);
              setSelectedMeta(null);
              setTmdbQuery('');
              setTmdbResults([]);
              onRefresh(); // reload global library
          } else {
              setUploadStatus('error');
          }
      } catch (err) {
          setUploadStatus('error');
      } finally {
          setIsUploading(false);
      }
  };

  const AdminPanelNav = () => (
      <div className="flex gap-4 border-b border-zinc-800 mb-8 pb-4">
          <button 
             className={`px-4 py-2 font-medium rounded transition-colors ${tab === 'upload' ? 'bg-zinc-800 dark:bg-white text-white dark:text-black' : 'text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300'}`}
             onClick={() => setTab('upload')}
          >
             Plateforme d'Upload
          </button>
          <button 
             className={`px-4 py-2 font-medium rounded transition-colors ${tab === 'library' ? 'bg-zinc-800 dark:bg-white text-white dark:text-black' : 'text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300'}`}
             onClick={() => setTab('library')}
          >
             Historique Serveur ({films.length})
          </button>
          <button 
             className={`px-4 py-2 font-medium rounded transition-colors ${tab === 'requests' ? 'bg-zinc-800 dark:bg-white text-white dark:text-black' : 'text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300'}`}
             onClick={() => setTab('requests')}
          >
             Demandes ({requestsList.length})
          </button>
          {(activeUser.role === 'owner' || activeUser.role === 'admin') && (
              <button 
                 className={`px-4 py-2 font-medium rounded transition-colors ${tab === 'users' ? 'bg-zinc-800 dark:bg-white text-white dark:text-black' : 'text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300'}`}
                 onClick={() => setTab('users')}
              >
                 Membres ({usersList.filter(u => u.status === 'pending').length} en attente)
              </button>
          )}
      </div>
  );

  return (
    <div className="p-6 md:p-12 pb-24 max-w-[1200px] mx-auto">
        <div className="mb-8 p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-transparent border-l-4 border-l-red-600 rounded-r shadow-sm">
             <h2 className="text-xl font-medium text-zinc-900 dark:text-white mb-2">Espace Contributeur</h2>
             <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                 Ici, vous pouvez ajouter vos films à la bibliothèque partagée CinéPrivé depuis votre ordinateur.
             </p>
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
            <div className="grid md:grid-cols-2 gap-8">
                {/* ETAPE 1: METADATA */}
                <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                    <h3 className="font-medium text-lg text-white flex items-center gap-2 mb-4">
                        <Database className="w-5 h-5 text-zinc-400" />
                        1. Lier les données du film (TMDB)
                    </h3>
                    
                    <div className="flex gap-2 mb-6">
                        <input 
                           type="text" 
                           placeholder="Ex: Matrix, Inception..." 
                           value={tmdbQuery} 
                           onChange={e => setTmdbQuery(e.target.value)}
                           onKeyDown={(e) => e.key === 'Enter' && searchTMDB()}
                           className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
                        />
                        <button onClick={searchTMDB} className="bg-zinc-800 border border-zinc-700 px-4 rounded hover:bg-zinc-700 flex items-center justify-center">
                            <Search className="w-4 h-4" />
                        </button>
                    </div>

                    {tmdbResults.length > 0 && !selectedMeta && (
                        <div className="max-h-80 overflow-y-auto pr-2 space-y-2">
                           {tmdbResults.map(res => (
                               <div key={res.id} onClick={() => setSelectedMeta(res)} className="flex items-start gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded cursor-pointer transition">
                                   {res.poster_path ? (
                                       <img src={`https://image.tmdb.org/t/p/w92${res.poster_path}`} alt="poster" className="w-10 h-14 object-cover rounded bg-black" />
                                   ) : <div className="w-10 h-14 bg-zinc-900 rounded shrink-0" />}
                                   <div>
                                       <p className="font-medium text-white text-sm">
                                           {res.title} <span className="text-zinc-500 font-normal">({res.release_date?.split('-')[0]})</span>
                                       </p>
                                       <p className="text-xs text-zinc-400 line-clamp-2 mt-1">{res.overview}</p>
                                   </div>
                               </div>
                           ))}
                        </div>
                    )}

                    {selectedMeta && (
                         <div className="p-4 bg-zinc-950 border border-green-900/50 rounded relative">
                             <button onClick={() => setSelectedMeta(null)} className="absolute top-4 right-4 text-xs text-red-400 hover:underline">Changer</button>
                             <div className="flex gap-4">
                                 {selectedMeta.poster_path && <img src={`https://image.tmdb.org/t/p/w92${selectedMeta.poster_path}`} className="w-16 rounded" />}
                                 <div>
             <p className="text-gold-500 font-medium text-sm mb-1 flex items-center gap-1"><CheckCircle className="w-4 h-4"/> Métadonnées validées</p>
                                    <h4 className="font-bold text-white mb-1">{selectedMeta.title}</h4>
                                    <p className="text-xs text-zinc-500">{selectedMeta.overview?.substring(0,100)}...</p>
                                 </div>
                             </div>
                         </div>
                    )}
                </div>

                {/* ETAPE 2: FICHIER LOCAL */}
                <div className={`bg-zinc-900 p-6 rounded-xl border transition-colors ${selectedMeta ? 'border-zinc-800' : 'border-zinc-800 opacity-50 pointer-events-none'}`}>
                    <h3 className="font-medium text-lg text-white flex items-center gap-2 mb-4">
                        <UploadCloud className="w-5 h-5 text-zinc-400" />
                        2. Fichier Vidéo (Rip Local)
                    </h3>
                    
                    <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                        Le navigateur web ne peut pas directement "ripper" un lecteur DVD (sécurité système).
                        Vous devez utiliser un logiciel de conversion comme MakeMKV ou Handbrake afin d'obtenir un fichier MP4/MKV sur votre ordinateur, puis l'importer ici.
                    </p>

                    <label className={`block border-2 border-dashed ${file ? 'border-zinc-500 bg-zinc-800/50' : 'border-zinc-700 bg-zinc-950'} rounded-lg p-8 relative cursor-pointer hover:border-zinc-500 transition`}>
                        <input type="file" accept="video/mp4,video/webm,video/mkv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                        <div className="text-center">
                            {file ? (
                                <div>
                                    <CheckCircle className="w-8 h-8 text-white mx-auto mb-2" />
                                    <p className="font-medium text-white text-sm truncate">{file.name}</p>
                                    <p className="text-xs text-zinc-500 mt-1">{(file.size / (1024*1024)).toFixed(0)} Mo</p>
                                </div>
                            ) : (
                                <div>
                                    <UploadCloud className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                                    <p className="font-medium text-zinc-400 text-sm">Cliquez pour importer la vidéo</p>
                                </div>
                            )}
                        </div>
                    </label>

                    <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                        {uploadStatus === 'success' && <p className="text-green-500 text-sm font-medium mb-3 text-center">✓ Upload du fichier terminé avec succès.</p>}
                        {uploadStatus === 'error' && <p className="text-red-500 text-sm font-medium mb-3 text-center">❌ Erreur de transfert (serveur).</p>}
                        
                        <button 
                           onClick={submitUpload}
                           disabled={!file || !selectedMeta || isUploading}
                           className="w-full bg-red-600 text-white font-semibold py-3 rounded hover:bg-red-500 transition disabled:opacity-50 flex justify-center"
                        >
                            {isUploading ? 'Transfert et Traitement en cours...' : 'Envoyer vers CinéPrivé Serveur'}
                        </button>
                    </div>
                </div>
            </div>
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
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {films.length === 0 ? (
                            <tr><td colSpan={4} className="text-center py-8">Base de données vide.</td></tr>
                        ) : films.map(f => {
                            const uploader = usersList.find(u => u.id === f.addedBy);
                            return (
                                <tr key={f.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white">{f.title}</td>
                                    <td className="px-6 py-4">{uploader?.name || f.addedBy}</td>
                                    <td className="px-6 py-4">{new Date(f.addedAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 max-w-[200px] truncate" title={f.originalName}>{f.originalName}</td>
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
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">Paramètres Globaux</h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-zinc-800 dark:text-zinc-200">Ouverture des inscriptions</p>
                            <p className="text-sm text-zinc-500">Autoriser ou non les nouvelles demandes de compte. Même si ouvert, les comptes doivent être approuvés manuellement par la suite.</p>
                        </div>
                        <button 
                            onClick={handleToggleRegistration}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${settings.allowRegistrations ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                        >
                            <span className={`${settings.allowRegistrations ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>
                </div>

                {activeUser.role === 'owner' && (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
                            <h3 className="text-lg font-medium text-zinc-900 dark:text-white">Codes d'Invitation (Pass Maison)</h3>
                            <div className="flex flex-wrap items-center gap-2">
                                <input 
                                    type="text"
                                    placeholder="Code personnalisé (optionnel)"
                                    value={customCodeInput}
                                    onChange={e => setCustomCodeInput(e.target.value)}
                                    className="px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded"
                                />
                                <input 
                                    type="number"
                                    placeholder="Nombre max d'utilisations"
                                    value={maxUsesInput}
                                    min="1"
                                    onChange={e => setMaxUsesInput(e.target.value)}
                                    className="px-3 py-2 text-sm w-48 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded"
                                />
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
                                    <td className="px-6 py-4 uppercase text-xs">
                                        {u.role}
                                        {activeUser.role === 'owner' && u.id !== activeUser.id && (
                                            <select 
                                                value={u.role}
                                                onChange={(e) => handleChangeRole(u.id, e.target.value)}
                                                className="ml-2 bg-transparent text-zinc-500 border-none outline-none cursor-pointer underline"
                                            >
                                                <option value="user" className="text-black">Devient Utilisateur</option>
                                                <option value="admin" className="text-black">Déléguer Admin</option>
                                            </select>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {u.status === 'pending' ? (
                                            <button 
                                                onClick={() => handleApproveUser(u.id)}
                                                className="px-3 py-1 bg-green-500/10 text-green-600 font-medium rounded hover:bg-green-500/20"
                                            >
                                                Approuver l'accès
                                            </button>
                                        ) : (
                                            <span className="text-zinc-400 cursor-default">Actif</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
  );
}
