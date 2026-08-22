import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Monitor, Loader2, KeyRound, Eye, EyeOff, LogIn } from 'lucide-react';

// Nouvelle adresse publique de CinéPrivé, et detection de l'ancienne.
const NOUVEAU_DOMAINE = 'cineprive.soleiljaune.be';
const ancienDomaine =
    typeof window !== 'undefined' &&
    window.location.hostname !== NOUVEAU_DOMAINE &&
    !window.location.hostname.startsWith('127.0.0.1') &&
    !window.location.hostname.startsWith('localhost');

interface Props {
  onLogin: (user: User) => void;
}

export default function AuthScreen({ onLogin }: Props) {
    const [isLogin, setIsLogin] = useState(true);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [settings, setSettings] = useState<{allowRegistrations: boolean} | null>(null);

    useEffect(() => {
        // Clear insecure storages if they exist (cleanup legacy)
        localStorage.removeItem('cine_remember_password');
        
        let storedAuth = localStorage.getItem('cine_auth') || sessionStorage.getItem('cine_auth');
        let token = '';
        if (storedAuth) {
            try {
                const parsed = JSON.parse(storedAuth);
                token = parsed.token;
            } catch (e) {}
        } else {
            // Fix for mobile session cookies persisting: if no token in storage, force logout
            fetch('/api/logout', { method: 'POST' }).catch(() => {});
        }
        
        // Auto login attempt using explicit Bearer or HttpOnly cookie session
        fetch('/api/me', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Not logged in');
            })
            .then(data => {
                if (data.id) {
                    if (token) data.token = token;
                    onLogin(data);
                }
            })
            .catch(() => {
                // Not logged in via cookie, fallback to remembering username visually if checked
                if (localStorage.getItem('cine_remember') === 'true') {
                    const savedUsername = localStorage.getItem('cine_remember_username') || '';
                    setRememberMe(true);
                    setUsername(savedUsername);
                }
            });

        fetch('/api/public/settings')
            .then(res => res.json())
            .then(data => setSettings(data))
            .catch(console.error);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setIsLoading(true);

        if (isForgotPassword) {
            try {
                const res = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });
                const data = await res.json();
                if (res.ok) {
                    setMessage("Si cette adresse existe, un lien de réinitialisation vous sera envoyé.");
                } else {
                    setError(data.error || 'Erreur lors de la réinitialisation');
                }
            } catch (err) {
                setError('Erreur réseau');
            } finally {
                setIsLoading(false);
            }
            return;
        }

        const endpoint = isLogin ? '/api/login' : '/api/register';
        const body = isLogin ? { username, password, rememberMe } : { username, password, name: username, inviteCode, email, rememberMe };

        try {
          const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
          });
          const data = await res.json();

          if (res.ok) {
              const authData = JSON.stringify(data);
              if (rememberMe) {
                  localStorage.setItem('cine_auth', authData);
                  localStorage.setItem('cine_remember', 'true');
                  localStorage.setItem('cine_remember_username', username);
                  sessionStorage.removeItem('cine_auth');
              } else {
                  sessionStorage.setItem('cine_auth', authData);
                  localStorage.removeItem('cine_auth');
                  localStorage.removeItem('cine_remember');
                  localStorage.removeItem('cine_remember_username');
              }
              onLogin(data);
          } else {
              setError(data.error || 'Erreur lors de la connexion');
          }
      } catch (err) {
          setError('Erreur réseau');
      } finally {
          setIsLoading(false);
      }
  };

  return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#16181c] dark:amoled:bg-black flex flex-col items-center justify-center text-zinc-900 dark:text-white px-4 transition-colors">
          <div className="w-full max-w-md">
              <h1 className="text-4xl md:text-5xl font-bold font-sans tracking-tight text-center mb-12 text-zinc-900 dark:text-zinc-100 flex items-center justify-center gap-3">
                  <Monitor className="w-10 h-10 text-primary-600" />
                  CinéPrivé
              </h1>

              {/* Le site a demenage : message affiche uniquement sur l'ancien
                  domaine, detecte a partir du nom d'hote courant. */}
              {ancienDomaine && (
                  <div className="mb-6 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-900 dark:text-amber-200">
                      <p className="font-semibold mb-1">Cette adresse va fermer</p>
                      <p className="mb-3">
                          CinéPrivé a démenagé. Merci de mettre à jour votre favori et
                          de vous connecter désormais sur la nouvelle adresse.
                      </p>
                      <a
                          href={`https://${NOUVEAU_DOMAINE}`}
                          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 font-medium text-white transition hover:bg-amber-700"
                      >
                          Aller sur {NOUVEAU_DOMAINE}
                      </a>
                  </div>
              )}

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-xl shadow-xl">
                  <h2 className="text-2xl font-semibold mb-6 flex flex-col gap-1 text-center">
                    {isForgotPassword ? 'Mot de passe oublié' : (isLogin ? 'Connexion' : 'Créer un compte')}
                  </h2>

                  <form onSubmit={handleSubmit} className="space-y-4">
                      {isForgotPassword ? (
                          <div>
                              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 text-center">
                                  Entrez l'adresse email associée à votre compte, nous vous enverrons un lien de réinitialisation sécurisé.
                              </p>
                              <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">Email</label>
                              <input 
                                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                                  placeholder="exemple@email.com"
                                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-4 py-3 pr-10 focus:ring-1 focus:ring-primary-500 outline-none text-zinc-900 dark:text-white truncate"
                              />
                          </div>
                      ) : (
                          <>
                              {!isLogin && (
                                  <>

                                      <div>
                                          <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">Email <span className="text-xs text-zinc-500 font-normal">(pour récupération de mot de passe)</span></label>
                                          <input 
                                              type="email" value={email} onChange={e => setEmail(e.target.value)} required
                                              placeholder="exemple@email.com"
                                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-4 py-3 pr-10 focus:ring-1 focus:ring-primary-500 outline-none text-zinc-900 dark:text-white truncate"
                                          />
                                      </div>
                                      {settings && settings.allowRegistrations === false && (
                                          <div>
                                              <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1 flex items-center gap-2">
                                                  <KeyRound className="w-4 h-4"/> Code d'invitation
                                              </label>
                                              <p className="text-xs text-zinc-500 mb-2">Obligatoire car les inscriptions publiques sont fermées. Cela valide votre compte !</p>
                                              <input 
                                                  value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                                                  placeholder="Ex: XYZ-123"
                                                  required
                                                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-4 py-3 pr-10 focus:ring-1 focus:ring-primary-500 outline-none text-zinc-900 dark:text-white placeholder-zinc-500/30 font-mono uppercase truncate"
                                              />
                                          </div>
                                      )}
                                  </>
                              )}
                              <div>
                                  <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                      {isLogin ? "Adresse e-mail ou Nom" : "Nom d'utilisateur"}
                                  </label>
                                  <input 
                                      value={username} onChange={e => setUsername(e.target.value)} required
                                      placeholder={!isLogin ? "Ex: Simon" : "Votre nom ou email"}
                                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-4 py-3 pr-10 focus:ring-1 focus:ring-primary-500 outline-none text-zinc-900 dark:text-white truncate"
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">Mot de passe</label>
                                  <div className="relative">
                                      <input 
                                          type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-4 py-3 pr-20 focus:ring-1 focus:ring-primary-500 outline-none text-zinc-900 dark:text-white truncate"
                                      />
                                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                      </button>
                                  </div>
                              </div>
                              
                              {isLogin && (
                                  <div className="flex items-center justify-between text-sm pt-2">
                                      <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-700 dark:text-zinc-300">
                                          <input 
                                              type="checkbox" 
                                              checked={rememberMe} 
                                              onChange={e => setRememberMe(e.target.checked)} 
                                              className="w-4 h-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500 cursor-pointer" 
                                          />
                                          Se souvenir de moi
                                      </label>
                                      <button 
                                          type="button" 
                                          onClick={() => { setIsForgotPassword(true); setError(''); setMessage(''); }} 
                                          className="text-primary-600 dark:text-primary-500 hover:underline font-medium"
                                      >
                                          Mot de passe oublié ?
                                      </button>
                                  </div>
                              )}
                          </>
                      )}

                      {error && <p className="text-primary-500 text-sm font-medium">{error}</p>}
                      {message && <p className="text-green-500 text-sm font-medium bg-green-500/10 p-3 rounded">{message}</p>}

                      <button 
                          type="submit" disabled={isLoading}
                          className="w-full bg-primary-600 hover:bg-primary-500 text-white font-semibold py-2 rounded mt-4 transition flex justify-center items-center gap-2 disabled:opacity-50"
                      >
                          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isForgotPassword ? 'Envoyer le lien' : (isLogin ? <><LogIn className="w-5 h-5" /> Se connecter</> : 'S\'inscrire'))}
                      </button>
                  </form>

                  <div className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      {isForgotPassword ? (
                          <button type="button" onClick={() => { setIsForgotPassword(false); setError(''); setMessage(''); }} className="text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white underline">
                              Retour à la connexion
                          </button>
                      ) : (
                          <>
                              {isLogin ? "Pas de compte ?" : "Déjà un compte ?"}
                              <button type="button" onClick={() => { setIsLogin(!isLogin); setError(''); }} className="ml-2 text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white underline">
                                  {isLogin ? "S'inscrire" : "Se connecter"}
                              </button>
                          </>
                      )}
                  </div>
              </div>
          </div>
      </div>
  );
}
