import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Settings, Moon, Sun, Monitor, Type, KeyRound, Loader2 } from 'lucide-react';

interface Props {
    onClose: () => void;
    themeMode: 'light' | 'dark' | 'system';
    setThemeMode: (m: 'light' | 'dark' | 'system') => void;
    amoledUnlocked: boolean;
    amoledActive: boolean;
    setAmoledActive: (a: boolean) => void;
    onTriggerEasterEgg?: () => void;
    userId: string;
}

export default function SettingsModal({ onClose, themeMode, setThemeMode, amoledUnlocked, amoledActive, setAmoledActive, onTriggerEasterEgg, userId }: Props) {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg('');
        setErr('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, oldPassword, newPassword })
            });
            const data = await res.json();
            if (res.ok) {
                setMsg('Mot de passe mis à jour avec succès.');
                setOldPassword('');
                setNewPassword('');
            } else {
                setErr(data.error || 'Erreur lors de la mise à jour.');
            }
        } catch (error) {
            setErr('Erreur réseau.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden text-zinc-900 dark:text-white"
            >
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Settings className="w-5 h-5 text-red-600" />
                        Paramètres
                    </h2>
                </div>

                <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
                    <div>
                        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">Affichage</h3>
                        <div className="grid grid-cols-3 gap-3">
                            <button 
                                onClick={() => setThemeMode('light')}
                                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition ${themeMode === 'light' ? 'border-red-500 bg-red-50 dark:bg-red-500/10 text-red-600' : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                            >
                                <Sun className="w-5 h-5 mb-2" />
                                <span className="text-sm font-medium">Clair</span>
                            </button>
                            <button 
                                onClick={() => setThemeMode('dark')}
                                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition ${themeMode === 'dark' ? 'border-red-500 bg-red-50 dark:bg-red-500/10 text-red-600' : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                            >
                                <Moon className="w-5 h-5 mb-2" />
                                <span className="text-sm font-medium">Sombre</span>
                            </button>
                            <button 
                                onClick={() => setThemeMode('system')}
                                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition ${themeMode === 'system' ? 'border-red-500 bg-red-50 dark:bg-red-500/10 text-red-600' : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                            >
                                <Monitor className="w-5 h-5 mb-2" />
                                <span className="text-sm font-medium">Système</span>
                            </button>
                        </div>
                    </div>

                    {amoledUnlocked && (
                        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                            <label className="flex items-center justify-between cursor-pointer group">
                                <div>
                                    <h4 className="font-medium text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                                        <Type className="w-4 h-4 text-purple-500" /> Mode AMOLED (Secret)
                                    </h4>
                                    <p className="text-xs text-zinc-500 mt-1">Active un fond d'écran noir absolu (économie de batterie).</p>
                                </div>
                                <div className={`w-12 h-6 rounded-full transition-colors relative ${amoledActive ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                                    <div className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all ${amoledActive ? 'left-7' : 'left-1'}`} />
                                </div>
                                <input type="checkbox" className="hidden" checked={amoledActive} onChange={() => setAmoledActive(!amoledActive)} />
                            </label>
                        </div>
                    )}

                    <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <KeyRound className="w-4 h-4" /> Sécurité
                        </h3>
                        <form onSubmit={handleChangePassword} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Ancien mot de passe</label>
                                <input 
                                    type="password"
                                    value={oldPassword}
                                    onChange={e => setOldPassword(e.target.value)}
                                    required
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 focus:ring-1 focus:ring-red-500 outline-none text-zinc-900 dark:text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Nouveau mot de passe</label>
                                <input 
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 focus:ring-1 focus:ring-red-500 outline-none text-zinc-900 dark:text-white text-sm"
                                />
                            </div>
                            {err && <p className="text-red-500 text-xs font-medium">{err}</p>}
                            {msg && <p className="text-green-500 text-xs font-medium">{msg}</p>}
                            <button 
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black py-2 rounded font-medium text-sm transition hover:opacity-90 flex justify-center items-center"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Changer le mot de passe"}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                    <button 
                        onClick={() => {
                            if (onTriggerEasterEgg) {
                                onTriggerEasterEgg();
                                onClose();
                            }
                        }}
                        className="w-8 h-8 opacity-0 cursor-default"
                        aria-hidden="true"
                    />
                    <button onClick={onClose} className="px-5 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium rounded hover:opacity-80 transition">
                        Fermer
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
