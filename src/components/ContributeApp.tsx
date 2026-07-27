import { hasRole, primaryRole } from '../lib/roles';
import React, { useState, useEffect, useRef } from "react";
import { notify } from "../lib/notify";
import { Film, User } from "../types";
import {
  UploadCloud,
  Search,
  CheckCircle,
  Database,
  Server,
  X,
  RefreshCw,
  Shield,
  Loader2,
  Trash2,
  Edit2,
  LogOut,
  Settings,
  AlertTriangle,
  Video
} from "lucide-react";

interface Props {
  activeUser: User;
  films: Film[];
  onRefresh: (bg?: boolean) => void;
  mode: "upload" | "admin";
  onUploadStateChange?: (isUploading: boolean) => void;
}

export default function ContributeApp({
  activeUser,
  films,
  onRefresh,
  mode,
  onUploadStateChange,
}: Props) {
  const [tab, setTab] = useState<
    "upload" | "library" | "users" | "requests" | "polls" | "funding" | "security" | "quarantine"
  >(mode === "upload" ? "upload" : "users");
  const [usersList, setUsersList] = useState<User[]>([]);
  const [requestsList, setRequestsList] = useState<any[]>([]);
  const [invitesList, setInvitesList] = useState<
    { code: string; used: boolean; maxUses?: number; currentUses?: number }[]
  >([]);
  const [pollResults, setPollResults] = useState<any>({});
  const [settings, setSettings] = useState<{
    allowRegistrations: boolean;
    fundingCurrent?: number;
    fundingGoal?: number;
    webhookUrl?: string;
    securityCode?: string;
  }>({ allowRegistrations: true });

  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [securityCodeInput, setSecurityCodeInput] = useState('');
  const [showSecurityCodeInput, setShowSecurityCodeInput] = useState(false);
  const [isSavingServer, setIsSavingServer] = useState(false);
  const [isSavingSecurityCode, setIsSavingSecurityCode] = useState(false);
  const [isRegeneratingSecurityCode, setIsRegeneratingSecurityCode] = useState(false);
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isAlert?: boolean;
    closeOnConfirm?: boolean;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  // Nouveaux états locaux pour les super-codes
  const [customCodeInput, setCustomCodeInput] = useState("");
  const [maxUsesInput, setMaxUsesInput] = useState("");
  const [pendingRoleChanges, setPendingRoleChanges] = useState<Record<string, string>>({});

  const [pollsConfig, setPollsConfig] = useState<any[]>([]);
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<{ url: string, timecode: number } | null>(null);

  const fetchData = React.useCallback(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsersList)
      .catch(console.error);
    fetch("/api/requests")
      .then((r) => r.json())
      .then(setRequestsList)
      .catch(console.error);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
          setSettings(data);
          setWebhookUrlInput(data.webhookUrl || "");
          if (data.securityCode) setSecurityCodeInput(data.securityCode);
      })
      .catch(console.error);
    fetch("/api/invites")
      .then((r) => r.json())
      .then(setInvitesList)
      .catch(console.error);
    fetch("/api/polls/results")
      .then((r) => r.json())
      .then(setPollResults)
      .catch(console.error);
    fetch("/api/polls/config")
      .then((r) => r.json())
      .then(setPollsConfig)
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setTab(mode === "upload" ? "upload" : "users");
  }, [mode]);

  const generateInvite = async () => {
    try {
      const bodyPayload: any = {};
      if (customCodeInput.trim())
        bodyPayload.customCode = customCodeInput.trim();
      if (maxUsesInput && parseInt(maxUsesInput) > 0)
        bodyPayload.maxUses = parseInt(maxUsesInput);

      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const err = await res.json();
        notify(err.error, "Erreur");
      } else {
        setCustomCodeInput("");
        setMaxUsesInput("");
        fetch("/api/invites").then(r => r.json()).then(setInvitesList).catch(console.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.status === 403) {
          notify("Vous ne passerez pas !", "Accès Interdit");
          return;
      }
      setPendingRoleChanges((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteInvite = async (code: string) => {
    try {
      await fetch(`/api/invites/${code}`, { method: "DELETE" });
      fetch("/api/invites").then(r => r.json()).then(setInvitesList).catch(console.error);
    } catch (e) {
      console.error(e);
    }
  };

  const [securityModal, setSecurityModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    operation: "delete_film" | "delete_user";
    targetId: string;
    targetLabel: string;
    code: string;
    error: string;
    demoNotice?: string;
    onSuccess: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    operation: "delete_film",
    targetId: "",
    targetLabel: "",
    code: "",
    error: "",
    onSuccess: async () => {},
  });

  const triggerSecurityValidation = async (
    operation: "delete_film" | "delete_user",
    targetId: string,
    targetLabel: string,
    title: string,
    message: string,
    onSuccess: () => Promise<void>,
  ) => {
    // 1. Ouvrir le modal immédiatement avec un message de chargement/génération
    setSecurityModal({
      isOpen: true,
      title,
      message,
      operation,
      targetId,
      targetLabel,
      code: "",
      error: "",
      demoNotice: "🔑 Envoi d'un code de sécurité temporaire à 6 chiffres...",
      onSuccess,
    });

    try {
      const requestLabel =
        operation === "delete_film"
          ? `Suppression définitive du film "${targetLabel}"`
          : `Bannissement définitif de l'utilisateur "${targetLabel}"`;

      const res = await fetch("/api/security/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, targetId, label: requestLabel }),
      });

      if (!res.ok) {
        const err = await res.json();
        setSecurityModal((prev) => ({
          ...prev,
          demoNotice: `⚠️ Impossible de générer un code temporaire : ${err.error || "Erreur serveur"}. Vous pouvez toujours utiliser votre code Patron permanent si configuré.`,
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

      setSecurityModal((prev) => ({
        ...prev,
        demoNotice,
      }));
    } catch (err) {
      console.error(err);
      setSecurityModal((prev) => ({
        ...prev,
        demoNotice:
          "⚠️ Erreur de communication de sécurité. Saisissez votre code Patron permanent pour valider.",
      }));
    }
  };

  const handleConfirmSecurityAction = async () => {
    if (securityModal.code.trim().length !== 6) {
      setSecurityModal((prev) => ({
        ...prev,
        error: "Veuillez entrer le code de sécurité à 6 chiffres.",
      }));
      return;
    }

    try {
      const method = "DELETE";
      const url =
        securityModal.operation === "delete_film"
          ? `/api/films/${securityModal.targetId}?code=${securityModal.code}`
          : `/api/users/${securityModal.targetId}?code=${securityModal.code}`;

      const res = await fetch(url, { method });
      if (res.status === 403) {
          setSecurityModal((prev) => ({ ...prev, isOpen: false }));
          notify("Vous ne passerez pas !", "Accès Interdit");
          return;
      }
      if (res.ok) {
        setSecurityModal((prev) => ({ ...prev, isOpen: false }));
        await securityModal.onSuccess();
        notify("L'opération a été validée et exécutée avec succès.", "Succès");
      } else {
        const err = await res.json();
        setSecurityModal((prev) => ({
          ...prev,
          error: err.error || "Opération refusée (code incorrect ou expiré).",
        }));
      }
    } catch (e) {
      console.error(e);
      setSecurityModal((prev) => ({
        ...prev,
        error: "Erreur de communication avec le serveur.",
      }));
    }
  };

  const handleRestoreFilm = async (filmId: string) => {
    try {
      const res = await fetch(`/api/films/${filmId}/restore`, {
        method: "POST",
      });
      if (res.ok) {
        notify("Le film a été rétabli avec succès.", "Succès");
        onRefresh(true);
      } else {
        const err = await res.json();
        notify(
          err.error || "Erreur de restauration des droits du film.",
          "Erreur",
        );
      }
    } catch (e) {
      console.error(e);
      notify("Échec de connexion.", "Erreur");
    }
  };

  const handleRestoreUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/restore`, {
        method: "POST",
      });
      if (res.ok) {
        notify(
          "Le compte de l'utilisateur a été réactivé avec succès.",
          "Succès",
        );
        fetchData();
      } else {
        const err = await res.json();
        notify(
          err.error || "Erreur de réactivation de l'utilisateur.",
          "Erreur",
        );
      }
    } catch (e) {
      console.error(e);
      notify("Échec de connexion.", "Erreur");
    }
  };

  const handleDeleteUser = async (userId: string, targetName: string) => {
    if (hasRole(activeUser, "admin")) {
      // Si simple admin -> suspension temporaire sans code
      setDialogState({
        isOpen: true,
        title: "Suspendre l'utilisateur",
        message: `Êtes-vous sûr de vouloir suspendre temporairement "${targetName}" ? Son compte sera bloqué et masqué, et le Patron devra valider son bannissement définitif.`,
        onConfirm: async () => {
          try {
            const res = await fetch(`/api/users/${userId}`, {
              method: "DELETE",
            });
            if (res.status === 403) {
                notify("Vous ne passerez pas !", "Accès Interdit");
                return;
            }
            if (res.ok) {
              notify(
                `La suspension de ${targetName} a été enregistrée.`,
                "Succès",
              );
              fetchData();
            } else {
              const err = await res.json();
              notify(
                err.error || "Impossible de suspendre l'utilisateur",
                "Erreur",
              );
            }
          } catch (e) {
            console.error(e);
            notify("Erreur de connexion", "Erreur");
          }
        },
      });
    } else {
      // Si Patron (owner) -> code de sécurité requis
      triggerSecurityValidation(
        "delete_user",
        userId,
        targetName,
        "Bannir un utilisateur",
        `Saisissez le code de validation reçu (par e-mail ou code Maître) pour confirmer la suppression définitive de l'utilisateur "${targetName}" et de tous ses accès.`,
        async () => {
          fetchData();
        },
      );
    }
  };

  const handleRefreshAllMetadata = async () => {
    setIsRefreshingAll(true);
    notify("Rafraîchissement global des métadonnées en cours...", "Info");
    try {
        let successCount = 0;
        let failCount = 0;
        for (const film of films) {
            try {
                const res = await fetch(`/api/films/${film.id}/refresh-metadata`, { method: 'POST' });
                if (res.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (e) {
                failCount++;
            }
            // Délai de 300ms entre chaque requête pour ne pas spammer TMDB
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        notify(`Terminé : ${successCount} succès, ${failCount} échecs.`, "Succès");
        fetchData();
    } catch (e) {
        notify("Erreur lors du rafraîchissement global", "Erreur");
    } finally {
        setIsRefreshingAll(false);
    }
  };

  const handleDeleteFilm = async (filmId: string, filmTitle: string) => {
    if (hasRole(activeUser, "admin") || hasRole(activeUser, "technician")) {
      // Si simple admin/technician -> suppression temporaire sans code
      setDialogState({
        isOpen: true,
        title: "Suspendre le film",
        message: `Êtes-vous sûr de vouloir suspendre le film "${filmTitle}" ? Il sera masqué pour les membres, et le Patron devra de valider sa destruction définitive.`,
        onConfirm: async () => {
          try {
            const res = await fetch(`/api/films/${filmId}`, {
              method: "DELETE",
            });
            if (res.status === 403) {
                notify("Vous ne passerez pas !", "Accès Interdit");
                return;
            }
            if (res.ok) {
              notify(
                `Le film "${filmTitle}" a été suspendu temporairement.`,
                "Succès",
              );
              onRefresh(true);
            } else {
              const err = await res.json();
              notify(err.error || "Impossible de suspendre le film", "Erreur");
            }
          } catch (e) {
            console.error(e);
            notify("Erreur de connexion", "Erreur");
          }
        },
      });
    } else {
      // Si Patron (owner) -> code de sécurité requis
      triggerSecurityValidation(
        "delete_film",
        filmId,
        filmTitle,
        "Supprimer définitivement un film",
        `Saisissez le code de validation reçu (par e-mail ou code Maître) pour confirmer la destruction définitive du film "${filmTitle}" et de son fichier vidéo sur le serveur.`,
        async () => {
          onRefresh(true);
        },
      );
    }
  };

  const handleToggleRegistration = async () => {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowRegistrations: !settings.allowRegistrations,
        }),
      });
      const newSettings = await res.json();
      setSettings(newSettings);
    } catch (e) {
      console.error(e);
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      await fetch(`/api/users/${userId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    try {
      await fetch(`/api/requests/${requestId}`, { method: "DELETE" });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Upload State
  interface UploadTask {
    id: string;
    file: File;
    tmdbQuery: string;
    tmdbResults: any[];
    selectedMeta: any | null;
    status: "waiting" | "uploading" | "success" | "error" | "duplicate";
    progress: number;
    isSearching: boolean;
    etaSeconds?: number | null;
    versionType?: string;
    replaceFilmId?: string;
    replaceFilmTitle?: string;
  }
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isUploadingGlobal, setIsUploadingGlobal] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const isUploadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentUploadIdRef = useRef<string | null>(null);

  const [duplicateState, setDuplicateState] = useState<{
    isOpen: boolean;
    taskId: string;
    meta: any;
    existingVersions: string[];
    selectedVersion: string;
  }>({
    isOpen: false,
    taskId: "",
    meta: null,
    existingVersions: [],
    selectedVersion: "Version Longue"
  });

  useEffect(() => {
    if (onUploadStateChange) {
      onUploadStateChange(isUploadingGlobal);
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploadingGlobal) {
        e.preventDefault();
        e.returnValue =
          "Un téléchargement est en cours. Si vous quittez la page, il sera annulé !";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isUploadingGlobal, onUploadStateChange]);

  const searchTMDBForTask = async (taskId: string, query: string) => {
    if (!query || query.length < 2) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isSearching: true } : t)),
    );
    try {
      const res = await fetch(
        `/api/tmdb/search?query=${encodeURIComponent(query)}`,
      );
      const data = await res.json();
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            const results = data.results || [];
            return {
              ...t,
              isSearching: false,
              tmdbResults: results,
              selectedMeta: results.length > 0 ? results[0] : null,
            };
          }
          return t;
        }),
      );
    } catch (e) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, isSearching: false } : t)),
      );
    }
  };

  const manualSearch = (taskId: string, query: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, tmdbQuery: query } : t)),
    );
    searchTMDBForTask(taskId, query);
  };

  const processFiles = (selectedFiles: File[]) => {
    const newTasks: UploadTask[] = [];

    for (const f of selectedFiles) {
      const nameWithoutExt = f.name.replace(/\.[^/.]+$/, "");
      let cleanName = nameWithoutExt
        .replace(/[\._-]/g, " ")
        .replace(/[\[\(].*?[\]\)]/g, "")
        .replace(
          /\b(1080p|720p|480p|mp4|avi|mov|wmv|av1|x264|x265|bluray|webrip|hdrip|dvdrip|cam|fr|vostfr|truefrench|b1|t00|t01|t02|t03)\b/gi,
          "",
        )
        .replace(/^[0-9rn]+\s*/, "") // Supprime les nombres au début (comme "1 ", "2 ")
        .trim();

      // "HP" to "Harry Potter" as a nice standardisation for known acronyms if needed, though manual search is preferred
      if (cleanName.toUpperCase().includes("HP AND THE")) {
        cleanName = cleanName.replace(/HP/i, "Harry Potter");
      }

      // VÉRIFICATION ANTI-DOUBLON INSTANTANÉE (par nom)
      const isDuplicate = films.some(film => 
          film.title.toLowerCase() === cleanName.toLowerCase() ||
          film.originalName?.toLowerCase() === f.name.toLowerCase() ||
          film.filename?.toLowerCase() === f.name.toLowerCase()
      );

      if (isDuplicate) {
          notify("Les films déjà présents sur le serveur ont été automatiquement supprimés de la file d'attente.", "Refusé");
          continue;
      }

      newTasks.push({
        id: Date.now().toString() + Math.random().toString().slice(2),
        file: f,
        tmdbQuery: cleanName,
        tmdbResults: [],
        selectedMeta: null,
        status: "waiting",
        progress: 0,
        isSearching: false,
      });
    }

    if (newTasks.length > 0) {
      setTasks((prev) => [...prev, ...newTasks]);
      newTasks.forEach((task) => searchTMDBForTask(task.id, task.tmdbQuery));
    }
  };

  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingFilm, setReplacingFilm] = useState<{id: string, title: string, tmdbId?: number} | null>(null);

  const handleReplaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!replacingFilm) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const file = files[0];
    const task: UploadTask = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        tmdbQuery: replacingFilm.title,
        tmdbResults: [],
        selectedMeta: { id: replacingFilm.tmdbId, title: replacingFilm.title },
        status: "waiting",
        progress: 0,
        isSearching: false,
        replaceFilmId: replacingFilm.id,
        replaceFilmTitle: replacingFilm.title
    };
    
    setTasks(prev => [...prev, task]);
    setTab('upload');
    setReplacingFilm(null);
    e.target.value = '';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    processFiles(selectedFiles);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    processFiles(droppedFiles);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
  };

  const updateTaskMeta = async (taskId: string, meta: any) => {
    if (meta) {
        if (meta.adult) {
            notify("Le contenu pour adultes est strictement interdit sur ce serveur.", "Importation bloquée");
            return;
        }
        try {
            const res = await fetch('/api/films');
            if (res.ok) {
                const data = await res.json();
                const existing = data.films.find((f: any) => f.tmdbId === meta.id);
                if (existing) {
                    notify("Film déjà présent dans le catalogue", "Upload bloqué");
                    setTasks((prev) =>
                      prev.map((t) => (t.id === taskId ? { ...t, selectedMeta: meta, status: "duplicate" } : t))
                    );
                    return;
                }
            }
        } catch (e) {
            console.error("Erreur vérification doublon", e);
        }
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, selectedMeta: meta, versionType: undefined, status: "waiting" } : t)),
    );
  };

  const removeTask = (taskId: string) => {
    setDialogState({
      isOpen: true,
      title: "Annuler le transfert",
      message: "Êtes-vous sûr de vouloir annuler ce transfert ?",
      isAlert: false,
      onConfirm: () => {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      }
    });
  };

  const cancelActiveUpload = (taskId: string) => {
    setDialogState({
      isOpen: true,
      title: "Annuler le transfert en cours",
      message: "Couper la connexion : Un transfert est en cours vers le serveur. Êtes-vous sûr de vouloir l'annuler ?",
      isAlert: false,
      onConfirm: () => {
        isUploadingRef.current = false;
        setIsUploadingGlobal(false);
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (currentUploadIdRef.current) {
            fetch('/api/films/upload-cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uploadId: currentUploadIdRef.current })
            }).catch(console.error);
            currentUploadIdRef.current = null;
        }
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      }
    });
  };

  const abortUploads = () => {
    isUploadingRef.current = false;
    setIsUploadingGlobal(false);
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
    }
    if (currentUploadIdRef.current) {
        fetch('/api/films/upload-cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadId: currentUploadIdRef.current })
        }).catch(console.error);
        currentUploadIdRef.current = null;
    }
    setTasks(prev => prev.filter(t => t.status !== "waiting" && t.status !== "error" && t.status !== "duplicate"));
  };

  const processUploadQueue = async () => {
    if (isUploadingRef.current) return;

    const nextTask = tasks.find(
      (t) => t.status === "waiting" && t.selectedMeta
    );
    if (!nextTask) return; // Plus rien à uploader

    isUploadingRef.current = true;
    setIsUploadingGlobal(true);

    const task = nextTask;

    try {
        const res = await fetch('/api/films');
        if (res.ok && !task.replaceFilmId) {
            const data = await res.json();
            const existing = data.films.find((f: any) => f.tmdbId === task.selectedMeta.id);
            if (existing) {
                notify(`Film déjà présent : ${task.selectedMeta.title}`, "Upload bloqué");
                setTasks((prev) => prev.filter((t) => t.id !== task.id));
                isUploadingRef.current = false;
                setIsUploadingGlobal(false);
                
                // Launch the next one
                setTimeout(() => processUploadQueue(), 100);
                return;
            }
        }
    } catch (e) {
        console.error("Erreur vérification doublon pre-upload", e);
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: "uploading", progress: 0, etaSeconds: null }
          : t,
      ),
    );

    try {
      const uploadId = Date.now().toString() + Math.random().toString().slice(2);
      currentUploadIdRef.current = uploadId;
      abortControllerRef.current = new AbortController();
      
      const chunkSize = 2 * 1024 * 1024;
      const totalChunks = Math.ceil(task.file.size / chunkSize);
      let failed = false;
      const startTime = Date.now();

      for (let i = 0; i < totalChunks; i++) {
        if (!isUploadingRef.current) {
          failed = true;
          break;
        }
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, task.file.size);
        const chunk = task.file.slice(start, end);

        const formData = new FormData();
        formData.append("chunk", chunk, task.file.name);
        formData.append("uploadId", uploadId);
        formData.append("chunkIndex", i.toString());
        formData.append("totalChunks", totalChunks.toString());

        try {
            const res = await fetch("/api/films/upload-chunk", {
              method: "POST",
              body: formData,
              signal: abortControllerRef.current.signal
            });

            if (!res.ok) {
              failed = true;
              break;
            }
        } catch (e: any) {
            if (e.name === 'AbortError') {
                failed = true;
                break;
            }
            throw e;
        }

        const progress = Math.round(((i + 1) / totalChunks) * 100);
        const elapsedTime = (Date.now() - startTime) / 1000;
        let eta = null;
        if (progress > 0 && progress < 100) {
          const estimatedTotal = elapsedTime / (progress / 100);
          eta = Math.round(estimatedTotal - elapsedTime);
        }

        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, progress, etaSeconds: eta } : t,
          ),
        );
      }

      if (failed) throw new Error("Chunk upload failed");

      const finalizeUrl = task.replaceFilmId 
        ? `/api/films/${task.replaceFilmId}/replace-finalize`
        : "/api/films/upload-finalize";

      const finRes = await fetch(finalizeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId,
          filename: task.file.name,
          originalName: task.file.name,
          metadata: task.selectedMeta,
          user: activeUser.id,
          versionType: task.versionType,
          totalChunks
        }),
        signal: abortControllerRef.current.signal
      });

      if (finRes.ok) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: "success" } : t,
          ),
        );
        onRefresh(true);
        notify(
          task.replaceFilmId ? "Le fichier a été remplacé avec succès." : "Les projectionnistes préparent les bobines pour le web. Ce processus d'optimisation intensif s'exécute en tâche de fond et peut prendre plusieurs dizaines de minutes.",
          task.replaceFilmId ? "Remplacement terminé" : "🎬 En salle de montage..."
        );
      } else {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: "error" } : t)),
        );
      }
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: "error" } : t)),
      );
    }

    isUploadingRef.current = false;
    setIsUploadingGlobal(false);
  };

  useEffect(() => {
    // Si aucun upload n'est en cours, on tente de lancer le suivant
    if (!isUploadingGlobal) {
      processUploadQueue();
    }
  }, [tasks, isUploadingGlobal]);

  const AdminPanelNav = () => (
    <div className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-800 mb-8 pb-4">
      {mode === "upload" ? (
        <button
          className={`px-4 py-2 font-medium rounded transition-colors bg-zinc-800 dark:bg-white text-white dark:text-black`}
        >
          Plateforme de Transfert
        </button>
      ) : (
        <>
          {(hasRole(activeUser, "owner") || hasRole(activeUser, "admin")) && (
            <button
              className={`px-4 py-2 font-medium rounded transition-colors ${tab === "users" ? "bg-zinc-800 dark:bg-white text-white dark:text-black" : "text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300"}`}
              onClick={() => setTab("users")}
            >
              Membres ({usersList.filter((u) => u.status === "pending").length}{" "}
              en attente)
            </button>
          )}
          {(hasRole(activeUser, "owner") || hasRole(activeUser, "admin")) && (
            <>
                <button
                  className={`px-4 py-2 font-medium rounded transition-colors flex items-center gap-2 ${tab === "quarantine" ? "bg-primary-600 text-white" : "text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300"}`}
                  onClick={() => setTab("quarantine")}
                >
                  <AlertTriangle className="w-4 h-4" /> Quarantaine
                  {films.filter(f => (f as any).isQuarantined).length > 0 && (
                      <span className="bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full">{films.filter(f => (f as any).isQuarantined).length}</span>
                  )}
                </button>
                <button
                  className={`px-4 py-2 font-medium rounded transition-colors ${tab === "funding" ? "bg-zinc-800 dark:bg-white text-white dark:text-black" : "text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300"}`}
                  onClick={() => setTab("funding")}
                >
                  Financement
                </button>
                <button
                  className={`px-4 py-2 font-medium rounded transition-colors ${tab === "security" ? "bg-zinc-800 dark:bg-white text-white dark:text-black" : "text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300"}`}
                  onClick={() => setTab("security")}
                >
                  Sécurité
                </button>
            </>
          )}
          <button
            className={`px-4 py-2 font-medium rounded transition-colors ${tab === "polls" ? "bg-zinc-800 dark:bg-white text-white dark:text-black" : "text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300"}`}
            onClick={() => setTab("polls")}
          >
            Sondages
          </button>
          <button
            className={`px-4 py-2 font-medium rounded transition-colors ${tab === "library" ? "bg-zinc-800 dark:bg-white text-white dark:text-black" : "text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300"}`}
            onClick={() => setTab("library")}
          >
            Historique ({films.length})
          </button>
        </>
      )}
    </div>
  );

  const renderTask = (task: UploadTask) => (
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
            {task.etaSeconds !== null && task.etaSeconds !== undefined && (
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
                  e.key === "Enter" && searchTMDBForTask(task.id, task.tmdbQuery)
                }
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
                placeholder="Rechercher un autre titre..."
              />
              <button
                onClick={() => searchTMDBForTask(task.id, task.tmdbQuery)}
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
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-12 pb-24 max-w-[1200px] mx-auto">
      <input 
          type="file" 
          ref={replaceInputRef} 
          className="hidden" 
          accept="video/*,.mkv" 
          onChange={handleReplaceFile} 
      />
      <div className="flex justify-between items-start mb-8 p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-transparent border-l-4 border-l-primary-600 rounded-r shadow-sm">
        <div>
          <h2 className="text-xl font-medium text-zinc-900 dark:text-white mb-2">
            {mode === "upload" ? "Espace Contributeur" : "Salle des Serveurs"}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">
            {mode === "upload"
              ? "Ici, vous pouvez ajouter vos films à la bibliothèque partagée CinéPrivé depuis votre ordinateur."
              : "Gérez les accès, les demandes et les paramètres globaux de la plateforme."}
          </p>
        </div>
        {mode === "admin" && (
          <button
            onClick={fetchData}
            className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded text-sm font-medium transition flex items-center gap-2"
          >
            Actualiser
          </button>
        )}
      </div>

      <AdminPanelNav />

      {tab === "upload" &&
        (activeUser.status === "pending" ? (
          <div className="p-12 text-center bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-xl font-medium text-primary-600 mb-2">
              Accès Restreint
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Votre compte est en attente de vérification par un administrateur.
              L'ajout de contenu est temporairement bloqué, mais vous pouvez
              totalement écumer la bibliothèque et visionner les films !
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-6">
              <div className="hidden lg:block bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-400 mb-2">Guide d'optimisation</h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 list-disc pl-5 space-y-1">
                      <li>Le format <strong>.mp4</strong> est fortement recommandé pour un traitement instantané sans surcharger le serveur.</li>
                      <li>Pour extraire un DVD : utilisez <strong>MakeMKV</strong>, puis convertissez avec <strong>HandBrake</strong>.</li>
                      <li>Dans HandBrake : Cochez l'option <strong>"Web Optimized"</strong> et assurez-vous de conserver les pistes audio et sous-titres dans l'onglet "Audio".</li>
                  </ul>
              </div>
              <div className="lg:hidden p-8 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
                  <p className="text-zinc-400">L'ajout de films nécessite un ordinateur (drag & drop).</p>
              </div>
              {/* Zone de Drop / Selection Multiple */}
              <div className="hidden lg:block bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <label
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className={`block border-2 border-dashed border-zinc-700 bg-zinc-950 rounded-lg p-8 relative cursor-pointer hover:border-zinc-500 transition text-center`}
                >
                  <input
                    type="file"
                    multiple
                    accept="video/*,.mkv"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <UploadCloud className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="font-medium text-white mb-1">
                    Cliquez pour ajouter un ou plusieurs films
                  </p>
                  <p className="text-xs text-zinc-500">
                    Formats supportés : MP4, MKV, AVI, etc. Les vidéos seront
                    automatiquement optimisées en MP4 sur le serveur en
                    arrière-plan.
                  </p>
                </label>
              </div>

              {/* Transfert en cours */}
              {tasks.some(t => t.status === "uploading") && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-6">
                  <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
                    <h3 className="font-medium text-blue-400 flex items-center gap-2">
                      <UploadCloud className="w-4 h-4 text-blue-400" /> Transfert en cours
                    </h3>
                  </div>
                  <div className="divide-y divide-zinc-800">
                    {tasks.filter(t => t.status === "uploading").map(renderTask)}
                  </div>
                </div>
              )}

              {/* File d'attente */}
              {tasks.some(t => t.status === "waiting" || t.status === "error" || t.status === "duplicate") && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-6">
                  <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
                    <h3 className="font-medium text-white flex items-center gap-2">
                      <Database className="w-4 h-4 text-zinc-400" /> File d'attente ({tasks.filter(t => t.status === "waiting" || t.status === "error" || t.status === "duplicate").length})
                    </h3>
                    <button
                      onClick={abortUploads}
                      className="text-xs text-primary-400 hover:text-primary-300 transition flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Vider et forcer l'arrêt
                    </button>
                  </div>
                  <div className="divide-y divide-zinc-800">
                    {tasks.filter(t => t.status === "waiting" || t.status === "error" || t.status === "duplicate").map(renderTask)}
                  </div>
                </div>
              )}

              {/* Transferts terminés */}
              {tasks.some(t => t.status === "success") && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
                    <h3 className="font-medium text-green-500 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" /> Transferts terminés ({tasks.filter(t => t.status === "success").length})
                    </h3>
                    <button
                      onClick={() => setTasks(prev => prev.filter(t => t.status !== "success"))}
                      className="text-xs text-zinc-400 hover:text-white transition"
                    >
                      Effacer
                    </button>
                  </div>
                  <div className="divide-y divide-zinc-800">
                    {tasks.filter(t => t.status === "success").map(renderTask)}
                  </div>
                </div>
              )}
            </div>
          </>
        ))}

      {tab === "library" && (
        <div className="flex flex-col gap-4">
          {(hasRole(activeUser, "owner") || hasRole(activeUser, "admin") || hasRole(activeUser, "technician")) && (
              <div className="flex justify-end">
                <button
                   onClick={handleRefreshAllMetadata}
                   disabled={isRefreshingAll}
                   className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                   {isRefreshingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                   {isRefreshingAll ? "Rafraîchissement en cours..." : "Rafraîchir tout le catalogue"}
                </button>
              </div>
          )}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium">Titre (TMDB)</th>
                <th className="px-6 py-4 font-medium">Uploader</th>
                <th className="px-6 py-4 font-medium">Date d'import</th>
                <th className="px-6 py-4 font-medium">Fichier d'origine</th>
                {(hasRole(activeUser, "owner") ||
                  hasRole(activeUser, "admin") ||
                  hasRole(activeUser, "technician")) && (
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {films.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8">
                    Base de données vide.
                  </td>
                </tr>
              ) : (
                films.map((f) => {
                  const uploader = usersList.find((u) => u.id === f.addedBy);
                  return (
                    <tr
                      key={f.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white">
                        {f.title}
                      </td>
                      <td className="px-6 py-4">
                        {uploader?.name || f.addedBy}
                        {(f as any).modifiedBy && (
                            <span className="block text-[10px] text-zinc-500 mt-0.5">
                                (Mis à jour par {(f as any).modifiedBy})
                            </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                            const d = new Date(f.addedAt);
                            return new Intl.DateTimeFormat('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            }).format(d).replace(' ', ' à ');
                        })()}
                      </td>
                      <td
                        className="px-6 py-4 max-w-[200px] truncate"
                        title={f.originalName}
                      >
                        {f.originalName
                          ? f.originalName.replace(/\.[^/.]+$/, "")
                          : ""}
                      </td>
                      {(hasRole(activeUser, "owner") ||
                        hasRole(activeUser, "admin") ||
                        hasRole(activeUser, "technician")) && (
                        <td className="px-6 py-4 text-right">
                          {f.pendingDeletion ? (
                            <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2">
                              <span className="text-[10px] bg-amber-500/10 text-amber-500 font-semibold px-2 py-1 rounded border border-amber-500/10 whitespace-nowrap">
                                ⚠️ Suspendu par{" "}
                                {f.requestedDeletionBy || "Admin"}
                              </span>
                              <div className="flex gap-1.5 mt-1 sm:mt-0">
                                {hasRole(activeUser, "owner") && (
                                  <button
                                    onClick={() =>
                                      handleDeleteFilm(f.id, f.title)
                                    }
                                    className="text-white hover:bg-primary-500 transition-all font-semibold text-[11px] bg-primary-600 hover:shadow-sm px-2.5 py-1.5 rounded tracking-wide uppercase"
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
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                    setReplacingFilm({ id: f.id, title: f.title, tmdbId: f.tmdbId });
                                    replaceInputRef.current?.click();
                                }}
                                className="text-zinc-500 hover:text-green-600 transition-all font-medium text-xs px-2.5 py-1.5 rounded flex items-center justify-center border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                                title="Remplacer la vidéo"
                              >
                                <Video className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/films/${f.id}/refresh-metadata`, { method: 'POST' });
                                    const data = await res.json();
                                    if (data.success) {
                                      notify(`Métadonnées mises à jour pour ${f.title}`, 'Succès');
                                      onRefresh(true);
                                    } else {
                                      notify(data.error || 'Erreur lors de la mise à jour', 'Erreur');
                                    }
                                  } catch (e) {
                                    notify('Erreur réseau', 'Erreur');
                                  }
                                }}
                                title="Rechercher l'affiche / Rafraîchir les métadonnées"
                                className="text-zinc-500 hover:text-blue-600 transition-all font-medium text-xs px-2.5 py-1.5 rounded flex items-center justify-center border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteFilm(f.id, f.title)}
                                disabled={!hasRole(activeUser, "owner")}
                                className="text-primary-500 hover:text-primary-700 hover:bg-primary-100 dark:hover:bg-primary-950/60 transition-all font-medium text-xs bg-primary-50 dark:bg-primary-950/30 px-2.5 py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Supprimer
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}



      {tab === "users" &&
        (hasRole(activeUser, "owner") || hasRole(activeUser, "admin")) && (
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
                      Autoriser ou non les nouvelles demandes de compte. Même si
                      ouvert, les comptes doivent être approuvés manuellement
                      par la suite.
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
                      onClick={generateInvite}
                      className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded text-sm font-medium"
                    >
                      Générer
                    </button>
                  </div>
                </div>
                {invitesList.length > 0 ? (
                  <ul className="space-y-2">
                    {invitesList.map((inv) => (
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
                          {u.status === "pending" ? (
                            <>
                              <button
                                onClick={() => handleApproveUser(u.id)}
                                className="px-3 py-1 bg-green-500/10 text-green-600 font-medium rounded hover:bg-green-500/20"
                              >
                                Approuver
                              </button>
                              {(hasRole(activeUser, "owner") ||
                                hasRole(activeUser, "admin")) &&
                                u.id !== activeUser.id && (
                                  <button
                                    onClick={() =>
                                      handleDeleteUser(
                                        u.id,
                                        u.name || u.username,
                                      )
                                    }
                                    disabled={!hasRole(activeUser, "owner")}
                                    className="px-3 py-1 bg-primary-500/10 text-primary-600 font-medium rounded hover:bg-primary-500/20 text-xs ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Refuser
                                  </button>
                                )}
                            </>
                          ) : u.status === "pending_ban" ? (
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
                              <span className="text-zinc-400 cursor-default">
                                Actif
                              </span>
                              {(hasRole(activeUser, "owner") ||
                                hasRole(activeUser, "admin")) &&
                                u.id !== activeUser.id && (
                                  <button
                                    onClick={() =>
                                      handleDeleteUser(
                                        u.id,
                                        u.name || u.username,
                                      )
                                    }
                                    disabled={!hasRole(activeUser, "owner")}
                                    className="px-3 py-1 bg-primary-500/10 text-primary-600 font-medium rounded hover:bg-primary-500/20 text-xs ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {tab === "quarantine" && (hasRole(activeUser, "owner") || hasRole(activeUser, "admin")) && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-medium text-primary-600 dark:text-primary-500 mb-6 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Films en Quarantaine
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500">
                    <th className="px-6 py-4 font-medium">Film</th>
                    <th className="px-6 py-4 font-medium">Signalements</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {films.filter((f: any) => f.isQuarantined).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-zinc-500">
                        Aucun film en quarantaine.
                      </td>
                    </tr>
                  ) : (
                    films.filter((f: any) => f.isQuarantined).map((f: any) => (
                      <tr key={f.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                {f.posterUrl ? (
                                    <img src={f.posterUrl} alt={f.title} className="w-10 h-14 object-cover rounded shadow" />
                                ) : (
                                    <div className="w-10 h-14 bg-zinc-200 dark:bg-zinc-800 rounded flex items-center justify-center">
                                        <Video className="w-4 h-4 text-zinc-500" />
                                    </div>
                                )}
                                <div>
                                    <p className="font-medium text-zinc-900 dark:text-white">{f.title}</p>
                                    <p className="text-xs text-zinc-500">{f.year} • {f.originalName}</p>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
                                {f.reports && f.reports.map((r: any) => (
                                    <div key={r.id} className="bg-primary-50 dark:bg-primary-950/30 p-2 rounded border border-primary-100 dark:border-primary-900/50 flex justify-between items-center gap-2">
                                        <div>
                                            <p className="text-xs text-primary-800 dark:text-primary-400 font-medium">Par {r.userName}</p>
                                            <p className="text-xs text-primary-600 dark:text-primary-500 mt-1">Timecode: <span className="font-mono bg-primary-100 dark:bg-primary-900/50 px-1 py-0.5 rounded">{new Date(r.timecode * 1000).toISOString().substr(11, 8)}</span></p>
                                        </div>
                                        <button
                                            onClick={() => setPreviewVideo({ url: f.jellyfinId ? `/api/stream/${f.jellyfinId}` : `/videos/${f.filename}`, timecode: r.timecode })}
                                            className="text-xs font-medium bg-primary-200 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 px-3 py-1.5 rounded hover:bg-primary-300 dark:hover:bg-primary-900/60 transition-colors shrink-0 flex items-center gap-1"
                                        >
                                            <Video className="w-3 h-3" />
                                            Aperçu
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleRestoreFilm(f.id)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-950/60 font-medium text-xs bg-green-50 dark:bg-green-950/30 px-3 py-1.5 rounded transition-all"
                              >
                                Lever la Quarantaine
                              </button>
                              <button
                                onClick={() => handleDeleteFilm(f.id, f.title)}
                                disabled={!hasRole(activeUser, "owner")}
                                className="text-primary-600 hover:text-primary-700 hover:bg-primary-100 dark:hover:bg-primary-950/60 font-medium text-xs bg-primary-50 dark:bg-primary-950/30 px-3 py-1.5 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                title={!hasRole(activeUser, "owner") ? "Seul le Patron peut détruire un fichier" : "Détruire définitivement"}
                              >
                                Détruire le Fichier
                              </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
      )}

      {tab === "funding" &&
        (hasRole(activeUser, "owner") || hasRole(activeUser, "admin")) && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-6">
              Gestion Financière du Serveur
            </h3>
            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Montant actuel de la cagnotte (€)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={settings.fundingCurrent || 0}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        fundingCurrent: parseFloat(e.target.value),
                      }))
                    }
                    className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Objectif mensuel (€)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={settings.fundingGoal || 12}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        fundingGoal: parseFloat(e.target.value),
                      }))
                    }
                    className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  fetch("/api/settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      fundingCurrent: settings.fundingCurrent,
                      fundingGoal: settings.fundingGoal,
                    }),
                  }).then(() =>
                    notify(
                      "Modifications sauvegardées avec succès !",
                      "Cagnotte mise à jour",
                    ),
                  );
                }}
                className="mt-4 w-full bg-primary-600 text-white font-medium py-2 rounded hover:bg-primary-500 transition"
              >
                Valider les modifications
              </button>
              <p className="text-xs text-zinc-500 mt-4">
                Ces valeurs s'affichent publiquement dans la modal "Soutenir".
                Note: N'ayant pas d'intégration externe vers une banque,
                l'incrémentation doit être mise à jour manuellement par les
                soins de l'administrateur lors de l'arrivée de dons pour
                CinéPrivé.
              </p>
            </div>
          </div>
        )}

      {tab === "polls" && (
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
                    <button className="bg-zinc-900 text-white px-4 py-2 rounded">
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
                      {(hasRole(activeUser, "owner") ||
                        hasRole(activeUser, "admin")) && (
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
      )}

      {tab === "security" && (hasRole(activeUser, "owner") || hasRole(activeUser, "admin")) && (
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
      )}

      {(hasRole(activeUser, "owner") || hasRole(activeUser, "admin")) &&
        tab === "polls" && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl mx-auto shadow-sm mt-8">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-medium">Créer un nouveau sondage</h3>
            </div>
            <form
              className="p-6 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const newPoll = {
                  id: "p" + Date.now(),
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
                      .map((s, i) => ({
                        id: "o" + (i + 1),
                        label: s.trim(),
                      })) || [],
                };
                const updatedConfig = [...pollsConfig, newPoll];
                await fetch("/api/polls/config", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(updatedConfig),
                });
                fetchData();
                (e.target as HTMLFormElement).reset();
              }}
            >
              <div>
                <label className="block text-sm font-medium mb-1">
                  Titre du sondage
                </label>
                <input
                  name="title"
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded p-2 text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <input
                  name="desc"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded p-2 text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Options (une par ligne)
                </label>
                <textarea
                  name="options"
                  rows={4}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded p-2 resize-none text-zinc-900 dark:text-white"
                  placeholder="Option 1&#10;Option 2..."
                />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="allowMultiple"
                    id="allowMultiple"
                    className="w-4 h-4 rounded border-zinc-300"
                  />
                  <label htmlFor="allowMultiple" className="text-sm">
                    Autoriser les choix multiples
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="allowCustom"
                    id="allowCustom"
                    defaultChecked
                    className="w-4 h-4 rounded border-zinc-300"
                  />
                  <label htmlFor="allowCustom" className="text-sm">
                    Autoriser le choix "Autre suggestion"
                  </label>
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded font-medium text-sm"
              >
                Générer le sondage
              </button>
            </form>
          </div>
        )}

      {/* Modal de duplication */}
      {duplicateState.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-sm border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-primary-600 mb-2">Ce film existe déjà</h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4 text-sm">
              Le film <strong>{duplicateState.meta?.title}</strong> est déjà présent dans la base de données.
              <br/><br/>
              Veuillez justifier cet ajout en précisant le type de version :
            </p>
            
            <div className="space-y-3 mb-6">
               <select 
                   value={duplicateState.selectedVersion}
                   onChange={(e) => setDuplicateState(prev => ({ ...prev, selectedVersion: e.target.value }))}
                   className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-white"
               >
                   <option value="Version Longue">Version Longue</option>
                   <option value="Version Courte">Version Courte</option>
                   <option value="Qualité Supérieure">Qualité Supérieure</option>
                   <option value="Parodie">Parodie</option>
               </select>
               
               {duplicateState.existingVersions.includes(duplicateState.selectedVersion) && (
                   <p className="text-xs text-primary-500 font-medium">⚠️ Cette version ({duplicateState.selectedVersion}) existe déjà ! Vous ne pouvez pas uploader une copie identique.</p>
               )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setDuplicateState(prev => ({ ...prev, isOpen: false }));
                  setTasks(prev => prev.map(t => t.id === duplicateState.taskId ? { ...t, selectedMeta: null, versionType: undefined } : t));
                }}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition"
              >
                Annuler
              </button>
              <button
                disabled={duplicateState.existingVersions.includes(duplicateState.selectedVersion)}
                onClick={() => {
                  setTasks((prev) =>
                    prev.map((t) => (t.id === duplicateState.taskId ? { ...t, selectedMeta: duplicateState.meta, versionType: duplicateState.selectedVersion } : t)),
                  );
                  setDuplicateState(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmer l'ajout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation / alert generic */}
      {dialogState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-sm border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              {dialogState.title}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              {dialogState.message}
            </p>
            <div className="flex items-center justify-end gap-3">
              {!dialogState.isAlert && (
                <button
                  onClick={() =>
                    setDialogState((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition"
                >
                  Annuler
                </button>
              )}
              <button
                onClick={() => {
                  if (!dialogState.isAlert) {
                    dialogState.onConfirm();
                  }
                  if (dialogState.closeOnConfirm !== false) {
                    setDialogState((prev) => ({ ...prev, isOpen: false }));
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded shadow-sm transition"
              >
                {dialogState.isAlert ? "OK" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Validation de Sécurité par Code */}
      {securityModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-920 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-primary-500/20 dark:border-primary-500/10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-primary-600">
              <span className="p-2 bg-primary-500/10 rounded-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {securityModal.title}
                </h3>
                <p className="text-xs text-primary-600 dark:text-primary-400 font-semibold uppercase tracking-wider">
                  Autorisation requise
                </p>
              </div>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed bg-zinc-50 dark:bg-zinc-900/40 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
              {securityModal.message}
            </p>

            {securityModal.demoNotice && (
              <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400 space-y-1">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  Notification de Sécurité
                </div>
                <p className="font-medium leading-relaxed">
                  {securityModal.demoNotice}
                </p>
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
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setSecurityModal((prev) => ({
                      ...prev,
                      code: val,
                      error: "",
                    }));
                  }}
                  className="w-full tracking-[0.4em] text-center font-mono text-3xl font-extrabold bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-zinc-900 dark:text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all select-all placeholder:text-zinc-300 dark:placeholder:text-zinc-700 placeholder:opacity-30"
                  placeholder="000000"
                  autoFocus
                />
              </div>

              {securityModal.error && (
                <p className="text-xs text-primary-600 dark:text-primary-400 font-medium text-center bg-primary-500/10 border border-primary-500/20 py-2 px-3 rounded-lg animate-shake">
                  ⚠️ {securityModal.error}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setSecurityModal((prev) => ({ ...prev, isOpen: false }))
                }
                className="flex-1 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmSecurityAction}
                disabled={securityModal.code.length !== 6}
                className="flex-1 py-3 text-sm font-medium text-white bg-primary-600 hover:bg-primary-500 disabled:opacity-40 disabled:hover:bg-primary-600 rounded-xl shadow-md transition-all uppercase tracking-wide"
              >
                Valider et Détruire
              </button>
            </div>
          </div>
        </div>
      )}
      {previewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden w-full max-w-4xl shadow-2xl relative">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-black/50">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Video className="w-5 h-5 text-primary-500" />
                Aperçu du Signalement
              </h3>
              <button
                onClick={() => setPreviewVideo(null)}
                className="text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-black aspect-video relative">
                <video
                    controls
                    autoPlay
                    src={`${previewVideo.url}#t=${Math.max(0, previewVideo.timecode - 10)}`}
                    className="w-full h-full"
                    crossOrigin="anonymous"
                >
                    Votre navigateur ne supporte pas la lecture vidéo.
                </video>
            </div>
            <div className="p-4 bg-zinc-900 flex justify-between items-center text-sm text-zinc-400">
                <p>Lecture démarrée 10 secondes avant le timecode signalé (<span className="text-white font-mono">{new Date(previewVideo.timecode * 1000).toISOString().substr(11, 8)}</span>).</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
