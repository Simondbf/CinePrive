import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Bug, X, Monitor, Smartphone, Check, Send } from 'lucide-react';

interface Props {
    onClose: () => void;
}

export default function BugReportModal({ onClose }: Props) {
    const [osFamily, setOsFamily] = useState('');
    const [osVersion, setOsVersion] = useState('');
    const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
    const [isUploadRelated, setIsUploadRelated] = useState(false);
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const submitBug = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        
        const finalOs = osFamily ? `${osFamily} - ${osVersion}` : osVersion;
        
        try {
            const res = await fetch('/api/bugs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ os: finalOs, device, isUploadRelated, description })
            });
            if (res.ok) {
                setStatus('success');
                setTimeout(() => {
                    onClose();
                }, 2000);
            } else {
                setStatus('error');
            }
        } catch {
            setStatus('error');
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden text-zinc-900 dark:text-white"
            >
                <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-100 dark:bg-primary-500/10 text-primary-600 rounded-lg">
                            <Bug className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold">Signaler un problème</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-primary-500 transition rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {status === 'success' ? (
                    <div className="p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto">
                            <Check className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-medium">Merci pour votre signalement !</h3>
                        <p className="text-zinc-500 text-sm">Le problème a été transmis à l'équipe de développement.</p>
                    </div>
                ) : (
                    <form onSubmit={submitBug} className="p-4 sm:p-6 space-y-6">
                        
                        <div className="space-y-3">
                            <label className="text-sm font-medium">Quel type d'appareil utilisez-vous ?</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    type="button"
                                    onClick={() => { setDevice('desktop'); setOsFamily(''); }}
                                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition ${device === 'desktop' ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-500 text-primary-600' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                                >
                                    <Monitor className="w-5 h-5" /> Ordinateur
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => { setDevice('mobile'); setOsFamily(''); }}
                                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition ${device === 'mobile' ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-500 text-primary-600' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                                >
                                    <Smartphone className="w-5 h-5" /> Smartphone / Tablette
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-medium flex items-center justify-between">
                                Système d'exploitation (OS)
                                {osFamily && <span className="text-xs font-normal text-primary-500">{osFamily} sélectionné</span>}
                            </label>
                            <div className="flex gap-2">
                                {device === 'desktop' ? (
                                    <>
                                        <button type="button" onClick={() => setOsFamily('Windows')} className={`flex-1 py-1.5 text-sm rounded border transition ${osFamily === 'Windows' ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-500 text-primary-600 font-medium' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}>Windows</button>
                                        <button type="button" onClick={() => setOsFamily('macOS')} className={`flex-1 py-1.5 text-sm rounded border transition ${osFamily === 'macOS' ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-500 text-primary-600 font-medium' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}>macOS</button>
                                        <button type="button" onClick={() => setOsFamily('Linux')} className={`flex-1 py-1.5 text-sm rounded border transition ${osFamily === 'Linux' ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-500 text-primary-600 font-medium' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}>Linux / Autre</button>
                                    </>
                                ) : (
                                    <>
                                        <button type="button" onClick={() => setOsFamily('Apple (iOS)')} className={`flex-1 py-1.5 text-sm rounded border transition ${osFamily === 'Apple (iOS)' ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-500 text-primary-600 font-medium' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}>Apple (iOS)</button>
                                        <button type="button" onClick={() => setOsFamily('Android')} className={`flex-1 py-1.5 text-sm rounded border transition ${osFamily === 'Android' ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-500 text-primary-600 font-medium' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}>Android / Autre</button>
                                    </>
                                )}
                            </div>
                            <input 
                                value={osVersion} onChange={(e) => setOsVersion(e.target.value)} required={!osFamily}
                                placeholder="Précisez la version (ex: 11, iOS 17, 13...)"
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-2.5 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none text-zinc-900 dark:text-white"
                            />
                        </div>

                        <label className="flex items-start gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition">
                            <div className="mt-0.5">
                                <input 
                                    type="checkbox" 
                                    checked={isUploadRelated} 
                                    onChange={(e) => setIsUploadRelated(e.target.checked)}
                                    className="w-4 h-4 text-primary-600 rounded border-zinc-300 focus:ring-primary-600 dark:border-zinc-700 dark:bg-zinc-900"
                                />
                            </div>
                            <div className="flex-1">
                                <span className="block text-sm font-medium">Ce problème est-il lié à l'upload de film ?</span>
                                <span className="block text-xs text-zinc-500 mt-0.5">Cochez cette case si le bug concerne la création ou d'upload de contenu.</span>
                            </div>
                        </label>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Description du problème</label>
                            <textarea 
                                value={description} onChange={(e) => setDescription(e.target.value)} required
                                placeholder="Expliquez ce qu'il se passe..."
                                rows={4}
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none text-zinc-900 dark:text-white resize-none"
                            />
                        </div>

                        {status === 'error' && (
                            <p className="text-primary-500 text-sm font-medium">Une erreur est survenue lors de l'envoi.</p>
                        )}
                        
                        <div className="pt-2">
                            <button 
                                type="submit" 
                                disabled={status === 'loading'}
                                className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-500 text-white font-medium py-3 rounded-lg transition disabled:opacity-50"
                            >
                                {status === 'loading' ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <><Send className="w-4 h-4" /> Envoyer le rapport</>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </motion.div>
        </div>
    );
}
