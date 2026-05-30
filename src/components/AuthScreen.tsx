import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Monitor, Loader2, KeyRound, Eye, EyeOff, LogIn } from 'lucide-react';

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
        if (localStorage.getItem('cine_remember') === 'true') {
            setRememberMe(true);
            setUsername(localStorage.getItem('cine_remember_username') || '');
        }

        fetch('/api/settings')
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
        const body = isLogin ? { username, password } : { username, password, name: username, inviteCode, email };

        try {
          const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
          });
          const data = await res.json();

          if (res.ok) {
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
      <div className="min-h-screen bg-zinc-50 dark:bg-[#111315] dark:amoled:bg-black flex flex-col items-center justify-center text-zinc-900 dark:text-white px-4 transition-colors">
          <div className="w-full max-w-md">
              <h1 className="text-4xl md:text-5xl font-bold font-sans tracking-tight text-center mb-12 text-zinc-900 dark:text-zinc-100 flex items-center justify-center gap-3">
                  <Monitor className="w-10 h-10 text-red-600" />
                  CinéPrivé
              </h1>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-xl shadow-xl">
                  <h2 className="text-2xl font-semibold mb-6 flex flex-col gap-1 text-center">
                    {isForgotPassword ? 'Mot de passe oublié' : (isLogin ? 'Connexion' : 'Créer un compte privé')}
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
                                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 focus:ring-1 focus:ring-red-500 outline-none text-zinc-900 dark:text-white"
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
                                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 focus:ring-1 focus:ring-red-500 outline-none text-zinc-900 dark:text-white"
                                          />
                                      </div>
                                      {settings && !settings.allowRegistrations && (
                                          <div>
                                              <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1 flex items-center gap-2">
                                                  <KeyRound className="w-4 h-4"/> Code d'invitation
                                              </label>
                                              <p className="text-xs text-zinc-500 mb-2">Obligatoire car les inscriptions publiques sont fermées. Cela valide votre compte !</p>
                                              <input 
                                                  value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                                                  placeholder="Ex: XYZ-123"
                                                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 focus:ring-1 focus:ring-red-500 outline-none text-zinc-900 dark:text-white placeholder-zinc-500/30 font-mono uppercase"
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
                                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 focus:ring-1 focus:ring-red-500 outline-none text-zinc-900 dark:text-white"
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">Mot de passe</label>
                                  <div className="relative">
                                      <input 
                                          type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 pr-10 focus:ring-1 focus:ring-red-500 outline-none text-zinc-900 dark:text-white"
                                      />
                                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
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
                                              className="w-4 h-4 rounded border-zinc-300 text-red-600 focus:ring-red-500 cursor-pointer" 
                                          />
                                          Se souvenir de moi
                                      </label>
                                      <button 
                                          type="button" 
                                          onClick={() => { setIsForgotPassword(true); setError(''); setMessage(''); }} 
                                          className="text-red-600 dark:text-red-500 hover:underline font-medium"
                                      >
                                          Mot de passe oublié ?
                                      </button>
                                  </div>
                              )}
                          </>
                      )}

                      {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
                      {message && <p className="text-green-500 text-sm font-medium bg-green-500/10 p-3 rounded">{message}</p>}

                      <button 
                          type="submit" disabled={isLoading}
                          className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-2 rounded mt-4 transition flex justify-center items-center gap-2 disabled:opacity-50"
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
                  {!isLogin && !isForgotPassword && (
                      <p className="mt-4 text-xs text-zinc-500 text-center">
                          Note : L'activation de compte est soumise à l'approbation de l'administrateur.
                      </p>
                  )}
              </div>
          </div>
      </div>
  );
}
