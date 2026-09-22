import { hasRole, primaryRole } from '../lib/roles';
import AideImportModal from './AideImportModal';
import { apiGet } from '../lib/api';
import React, { useState, useEffect, useRef } from "react";
import { notify } from "../lib/notify";
import { Film, User, UploadTask, Invitation } from "../types";
import CarteTache from "./CarteTache";
import OngletStatistiques from "./OngletStatistiques";
import OngletModeration from "./OngletModeration";
import OngletSondages from "./OngletSondages";
import OngletSecurite from "./OngletSecurite";
import OngletUtilisateurs from "./OngletUtilisateurs";
import OngletBibliotheque from "./OngletBibliotheque";
import {
  UploadCloud,
  Search,
  CheckCircle, Check,
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
  Video,
  FileUp,
  Layers,
  HelpCircle,
  BarChart3,
  Bell
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
  const [verifEnCours, setVerifEnCours] = useState(false);
  const [resultatVerif, setResultatVerif] = useState<{ count: number; films: any[] } | null>(null);
  const [rechercheFilm, setRechercheFilm] = useState("");
  const [stats, setStats] = useState<any | null>(null);
  const [notifsGlobales, setNotifsGlobales] = useState<any[]>([]);
  const [showAide, setShowAide] = useState(false);
  const [tab, setTab] = useState<
    "upload" | "library" | "users" | "requests" | "polls" | "security" | "quarantine" | "stats"
  >(mode === "upload" ? "upload" : "users");
  const [usersList, setUsersList] = useState<User[]>([]);
  const [requestsList, setRequestsList] = useState<any[]>([]);
  const [invitesList, setInvitesList] = useState<Invitation[]>([]);
  const [pollResults, setPollResults] = useState<any>({});
  const [settings, setSettings] = useState<{
    allowRegistrations: boolean;
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

  const fetchData = React.useCallback(async () => {
    setUsersList(await apiGet<User[]>("/api/users", []));
    setRequestsList(await apiGet<any[]>("/api/requests", []));
    const data = await apiGet<any>("/api/settings", {});
    setSettings(data);
    setWebhookUrlInput(data.webhookUrl || "");
    if (data.securityCode) setSecurityCodeInput(data.securityCode);
    setInvitesList(await apiGet<any[]>("/api/invites", []));
    setPollResults(await apiGet<any>("/api/polls/results", {}));
    setPollsConfig(await apiGet<any[]>("/api/polls/config", []));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // REGRESSION CORRIGEE : j'avais suppose que `mode` ne changeait jamais sur une
  // instance montee, puisque /upload et /serveurs sont deux <Route> distinctes.
  // C'est faux : les deux rendent <ContributeApp> a la meme position, donc React
  // reconcilie par type, reutilise l'instance et se contente de changer la prop.
  // Sans cette remise a zero, on arrivait sur la Salle des Serveurs avec l'onglet
  // d'envoi encore actif. Ajustement pendant le rendu, pas un Effect : l'onglet
  // est correct des le premier affichage, sans image intermediaire fausse.
  const [modePrecedent, setModePrecedent] = useState(mode);

  if (modePrecedent !== mode) {
     setModePrecedent(mode);
     setTab(mode === "upload" ? "upload" : "users");
  }

  // Avec role "admin", le serveur fabrique un code aleatoire ADM-..., a usage
  // unique et valable 7 jours, et ignore code personnalise et nombre
  // d'utilisations. Il refuse si l'appelant n'est pas proprietaire.
  const generateInvite = async (role?: "admin") => {
    try {
      const bodyPayload: any = {};
      if (role === "admin") {
        bodyPayload.role = "admin";
      } else {
        if (customCodeInput.trim())
          bodyPayload.customCode = customCodeInput.trim();
        if (maxUsesInput && parseInt(maxUsesInput) > 0)
          bodyPayload.maxUses = parseInt(maxUsesInput);
      }

      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        notify(err.error || "Impossible de créer le code.", "Erreur");
      } else {
        if (role !== "admin") {
          setCustomCodeInput("");
          setMaxUsesInput("");
        }
        setInvitesList(await apiGet<Invitation[]>("/api/invites", []));
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

  // Verifie que chaque film marque disponible possede bien son fichier sur le
  // disque, et bascule en ERROR ceux dont le fichier a disparu.
  const handleVerifierFichiers = async () => {
    if (!window.confirm(
      "Verifier tous les fichiers du catalogue ?\n\n" +
      "Les films dont le fichier a disparu du serveur seront marques comme " +
      "indisponibles. Aucun fichier ne sera supprime."
    )) return;

    setVerifEnCours(true);
    setResultatVerif(null);
    try {
      const res = await fetch("/api/admin/reparer-fichiers", { method: "POST" });
      if (!res.ok) {
        notify("Erreur lors de la verification des fichiers.", "Erreur");
        return;
      }
      const data = await res.json();
      setResultatVerif(data);
      fetchData();
    } catch (e) {
      console.error(e);
      notify("Impossible de contacter le serveur.", "Erreur");
    } finally {
      setVerifEnCours(false);
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

  // Deux actions distinctes, chacune appelee explicitement par son bouton.
  // Avant, une seule fonction devinait l'intention d'apres le role : un compte
  // cumulant proprietaire et admin aurait mis de cote au lieu de detruire.

  // Reversible, sans code : owner et admin.
  const handleSetAsideFilm = (filmId: string, filmTitle: string) => {
    setDialogState({
      isOpen: true,
      title: "Mettre le film de côté",
      message: `« ${filmTitle} » ne sera plus visible pour les membres. Il reste dans la bibliothèque et peut être rétabli à tout moment. Seul le propriétaire peut le supprimer définitivement.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/films/${filmId}/set-aside`, { method: "POST" });
          if (res.ok) {
            notify(`« ${filmTitle} » a été mis de côté.`, "Succès");
            onRefresh(true);
          } else {
            const err = await res.json().catch(() => ({}));
            notify(err.error || "Impossible de mettre le film de côté.", "Erreur");
          }
        } catch (e) {
          console.error(e);
          notify("Erreur de connexion", "Erreur");
        }
      },
    });
  };

  // Definitif, fichier video compris : proprietaire seul, code de securite requis.
  const handleDeleteFilm = async (filmId: string, filmTitle: string) => {
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

      // Sans cette verification, une reponse d'erreur remplacerait l'objet
      // settings par { error: ... } et le bouton cesserait de repondre.
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        console.error("[SETTINGS] HTTP", res.status, detail);
        notify(
          res.status === 403
            ? "Votre compte n'a pas les droits pour modifier ce réglage."
            : `Le serveur a refusé la modification (erreur ${res.status}).`,
          "Modification impossible"
        );
        return;
      }

      const newSettings = await res.json();
      if (typeof newSettings?.allowRegistrations !== "boolean") {
        console.error("[SETTINGS] reponse inattendue", newSettings);
        notify("Réponse inattendue du serveur.", "Modification impossible");
        return;
      }
      setSettings(newSettings);
    } catch (e) {
      console.error(e);
      notify("Impossible de contacter le serveur.", "Erreur réseau");
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
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isUploadingGlobal, setIsUploadingGlobal] = useState(false);

  // L'etat d'envoi et la notification du parent changent ensemble : une seule
  // fonction les porte, appelee par le gestionnaire qui declenche reellement
  // l'action. Ce n'est pas le role d'un Effect qui observerait le changement
  // apres coup, sans savoir pourquoi il a eu lieu.
  const majEtatEnvoi = React.useCallback((enCours: boolean) => {
    setIsUploadingGlobal(enCours);
    onUploadStateChange?.(enCours);
  }, [onUploadStateChange]);
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

  // Systeme exterieur : la fenetre. Cet Effect ne fait plus que brancher l'ecouteur.
  // La notification du parent est partie dans majEtatEnvoi, avec le changement d'etat.
  useEffect(() => {
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
  }, [isUploadingGlobal]);

  // Au demontage (changement de route), l'envoi est interrompu : le parent ne doit
  // pas rester bloque sur "envoi en cours", sinon sa demande de confirmation se
  // declenche a tort a la navigation suivante.
  useEffect(() => {
    return () => { onUploadStateChange?.(false); };
  }, [onUploadStateChange]);

  const searchTMDBForTask = async (taskId: string, query: string, year?: string) => {
    if (!query || query.length < 2) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isSearching: true } : t)),
    );
    try {
      const finalQuery = year ? `${query} ${year}` : query;
      const res = await fetch(
        `/api/tmdb/search?query=${encodeURIComponent(finalQuery)}`,
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

  const manualSearch = (taskId: string, query: string, year?: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, tmdbQuery: query, tmdbYear: year } : t)),
    );
    searchTMDBForTask(taskId, query, year);
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
  const lotInputRef = useRef<HTMLInputElement>(null);
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

  // Normalise un texte pour comparer un nom de fichier a un titre de film :
  // minuscules, sans accents, sans ponctuation ni extension.
  const normaliser = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\.(mp4|mkv|avi|mov|webm)$/i, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  // Score de ressemblance : proportion de mots du titre presents dans le
  // nom du fichier. Simple, mais suffisant pour des titres de films.
  const score = (nomFichier: string, titre: string): number => {
    const a = normaliser(nomFichier);
    const motsTitre = normaliser(titre).split(' ').filter((m) => m.length > 2);
    if (motsTitre.length === 0) return 0;
    const trouves = motsTitre.filter((m) => a.includes(m)).length;
    return trouves / motsTitre.length;
  };

  // Remplacement en lot : on associe chaque fichier choisi au film
  // indisponible dont le titre lui ressemble le plus.
  const handleLotFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichiers = Array.from(e.target.files || []);
    e.target.value = '';
    if (fichiers.length === 0) return;

    const candidats = films.filter((f: any) => f.status === 'ERROR');
    if (candidats.length === 0) {
      notify(
        "Aucun film indisponible a remplacer. Lancez d'abord « Verifier les fichiers ».",
        'Rien a faire'
      );
      return;
    }

    const nouvelles: UploadTask[] = [];
    const associes = new Set<string>();
    const orphelins: string[] = [];

    fichiers.forEach((file) => {
      let meilleur: any = null;
      let meilleurScore = 0;
      candidats.forEach((f: any) => {
        if (associes.has(f.id)) return;
        const sc = Math.max(score(file.name, f.title), score(file.name, f.originalName || ''));
        if (sc > meilleurScore) {
          meilleurScore = sc;
          meilleur = f;
        }
      });

      if (meilleur && meilleurScore >= 0.5) {
        associes.add(meilleur.id);
        nouvelles.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          tmdbQuery: meilleur.title,
          tmdbResults: [],
          selectedMeta: { id: meilleur.tmdbId, title: meilleur.title },
          status: 'waiting',
          progress: 0,
          isSearching: false,
          replaceFilmId: meilleur.id,
          replaceFilmTitle: meilleur.title,
        } as UploadTask);
      } else {
        orphelins.push(file.name);
      }
    });

    if (nouvelles.length === 0) {
      notify(
        `Aucun fichier n'a pu etre associe. Verifiez que les noms de fichiers ressemblent aux titres.`,
        'Aucune correspondance'
      );
      return;
    }

    setTasks((prev) => [...prev, ...nouvelles]);
    setTab('upload');
    notify(
      `${nouvelles.length} fichier(s) associe(s) et ajoute(s) a la file.` +
        (orphelins.length > 0
          ? ` ${orphelins.length} non reconnu(s) : ${orphelins.slice(0, 3).join(', ')}${orphelins.length > 3 ? '...' : ''}`
          : ''),
      'File d\'attente mise a jour'
    );
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

  // Corriger la correspondance TMDB d'un film DEJA importe. La recherche
  // reutilise exactement celle de l'import ; seule l'application differe.
  const corrigerFiche = async (taskId: string, meta: any) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task?.filmId || !meta?.id) return;
    try {
      const res = await fetch(`/api/films/${task.filmId}/relink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: meta.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        notify(err.error || "La correction a échoué.", "Erreur");
        return;
      }
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, selectedMeta: meta, correctionOuverte: false, tmdbResults: [] }
            : t,
        ),
      );
      onRefresh(true);
      notify(`La fiche pointe désormais sur « ${meta.title} ».`, "Fiche corrigée");
    } catch (e) {
      notify("Erreur de connexion.", "Erreur");
    }
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
        majEtatEnvoi(false);
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
    majEtatEnvoi(false);
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
    majEtatEnvoi(true);

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
                majEtatEnvoi(false);
                
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

        // L'envoi des morceaux ne represente que 95 % du travail : le serveur
        // doit encore les rassembler, analyser le fichier et l'enregistrer.
        // La barre s'arretait donc a 100 % puis semblait figee ; elle plafonne
        // desormais a 95 %, les 5 % restants etant la finalisation.
        const partEnvoi = ((i + 1) / totalChunks) * 95;
        const progress = Math.round(partEnvoi);
        const elapsedTime = (Date.now() - startTime) / 1000;
        let eta = null;
        if (partEnvoi > 0 && partEnvoi < 95) {
          const estimatedTotal = elapsedTime / (partEnvoi / 95);
          eta = Math.round(estimatedTotal - elapsedTime);
        }

        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, progress, etaSeconds: eta } : t,
          ),
        );
      }

      if (failed) throw new Error("Chunk upload failed");

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, progress: 97, etaSeconds: null, finalisation: true } : t,
        ),
      );

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
        const donneesFin = await finRes.json().catch(() => ({}));
        const idCree = donneesFin?.film?.id || task.replaceFilmId;
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: "success", progress: 100, finalisation: false, filmId: idCree }
              : t,
          ),
        );
        onRefresh(true);

        // Le serveur indique le traitement reellement applique. L'ancien
        // message annoncait a tout le monde une attente de plusieurs dizaines
        // de minutes, y compris pour les fichiers deja lisibles.
        const messagesParTraitement: Record<string, { titre: string; texte: string }> = {
          immediat: {
            titre: "Film disponible",
            texte: "Le fichier était déjà au bon format : il est visible dans le catalogue dès maintenant.",
          },
          rapide: {
            titre: "Conversion rapide en cours",
            texte: "Le fichier est en cours de remise en forme. Comptez quelques minutes avant qu'il soit lisible.",
          },
          nuit: {
            titre: "Conversion programmée",
            texte: "Ce format demande un réencodage complet, trop lourd pour être fait pendant que d'autres regardent un film. Il sera traité cette nuit et disponible au matin.",
          },
        };
        const info = messagesParTraitement[donneesFin?.traitement] || messagesParTraitement.rapide;

        notify(
          task.replaceFilmId ? "Le fichier a été remplacé avec succès." : info.texte,
          task.replaceFilmId ? "Remplacement terminé" : info.titre,
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
    majEtatEnvoi(false);
  };

  useEffect(() => {
    // Si aucun upload n'est en cours, on tente de lancer le suivant
    if (!isUploadingGlobal) {
      processUploadQueue();
    }
  }, [tasks, isUploadingGlobal]);

  useEffect(() => {
    if (tab !== "stats") return;
    fetch("/api/stats").then((r) => (r.ok ? r.json() : null)).then(setStats).catch(() => setStats(null));
  }, [tab]);

  useEffect(() => {
    if (tab !== "quarantine") return;
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setNotifsGlobales(Array.isArray(d) ? d.slice().reverse() : []))
      .catch(() => setNotifsGlobales([]));
  }, [tab]);

  const AdminPanelNav = () => (
    <div className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-800 mb-8 pb-4">
      {mode === "upload" ? (
        <button
          className={`px-4 py-2 font-medium rounded transition-colors bg-primary-600 text-white`}
        >
          Plateforme de Transfert
        </button>
      ) : (
        <>
          {(hasRole(activeUser, "owner") || hasRole(activeUser, "admin")) && (
            <button
              className={`px-4 py-2 font-medium rounded transition-colors ${tab === "users" ? "bg-primary-600 text-white" : "text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300"}`}
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
                  <AlertTriangle className="w-4 h-4" /> Modération
                  {films.filter(f => (f as any).isQuarantined).length > 0 && (
                      <span className="bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full">{films.filter(f => (f as any).isQuarantined).length}</span>
                  )}
                </button>
                <button
                  className={`px-4 py-2 font-medium rounded transition-colors ${tab === "security" ? "bg-primary-600 text-white" : "text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300"}`}
                  onClick={() => setTab("security")}
                >
                  Sécurité
                </button>
                <button
                  className={`px-4 py-2 font-medium rounded transition-colors flex items-center gap-2 ${tab === "stats" ? "bg-primary-600 text-white" : "text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300"}`}
                  onClick={() => setTab("stats")}
                >
                  <BarChart3 className="w-4 h-4" /> Fréquentation
                </button>
            </>
          )}
          <button
            className={`px-4 py-2 font-medium rounded transition-colors ${tab === "polls" ? "bg-primary-600 text-white" : "text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300"}`}
            onClick={() => setTab("polls")}
          >
            Sondages
          </button>
          <button
            className={`px-4 py-2 font-medium rounded transition-colors ${tab === "library" ? "bg-primary-600 text-white" : "text-zinc-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300"}`}
            onClick={() => setTab("library")}
          >
            Historique ({films.length})
          </button>
        </>
      )}
    </div>
  );


  // Une date absente ou invalide ne doit JAMAIS faire tomber l'ecran :
  // Intl.DateTimeFormat.format() leve une exception sur une date invalide,
  // et un seul vieux film sans addedAt rendait toute la Salle des Serveurs
  // noire. Idem pour toISOString() sur un timecode manquant.
  const formatDateSure = (valeur: any): string => {
    const d = new Date(valeur);
    if (!valeur || isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d).replace(" ", " à ");
  };
  const formatTimecode = (t: any): string =>
    Number.isFinite(t) && t >= 0
      ? new Date(t * 1000).toISOString().substr(11, 8)
      : "—";

  // Recherche dans la zone de controle des films (onglet Historique).
  // On enleve les accents et la casse pour que "amelie" trouve "Amélie".
  const normaliserTexte = (s: string) =>
    (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const filmsFiltres = React.useMemo(() => {
    const q = normaliserTexte(rechercheFilm).trim();
    if (!q) return films;
    return films.filter((f) => {
      const uploader = usersList.find((u) => u.id === f.addedBy);
      return (
        normaliserTexte(f.title).includes(q) ||
        normaliserTexte(f.originalName || "").includes(q) ||
        normaliserTexte(uploader?.name || f.addedBy || "").includes(q)
      );
    });
  }, [films, rechercheFilm, usersList]);

  return (
    <div className="p-6 lg:p-12 pb-24 max-w-[1200px] mx-auto">
      <input 
          type="file" 
          ref={replaceInputRef} 
          className="hidden" 
          accept="video/*,.mkv" 
          onChange={handleReplaceFile} 
      />
      <input
          type="file"
          ref={lotInputRef}
          className="hidden"
          accept="video/*,.mkv"
          multiple
          onChange={handleLotFiles}
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
              <div className="hidden lg:flex items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Le format <strong className="font-medium text-zinc-900 dark:text-white">.mp4</strong> est mis en ligne
                      immédiatement. Les autres sont acceptés : quelques minutes de conversion, ou la nuit suivante
                      si l'image doit être entièrement réencodée.
                  </p>
                  <button
                      type="button"
                      onClick={() => setShowAide(true)}
                      className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
                  >
                      <HelpCircle className="w-4 h-4" />
                      Aide
                  </button>
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
                    {tasks.filter(t => t.status === "uploading").map(t => <CarteTache key={t.id} task={t} searchTMDBForTask={searchTMDBForTask} setTasks={setTasks} updateTaskMeta={updateTaskMeta} removeTask={removeTask} corrigerFiche={corrigerFiche} cancelActiveUpload={cancelActiveUpload} />)}
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
                    {tasks.filter(t => t.status === "waiting" || t.status === "error" || t.status === "duplicate").map(t => <CarteTache key={t.id} task={t} searchTMDBForTask={searchTMDBForTask} setTasks={setTasks} updateTaskMeta={updateTaskMeta} removeTask={removeTask} corrigerFiche={corrigerFiche} cancelActiveUpload={cancelActiveUpload} />)}
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
                    {tasks.filter(t => t.status === "success").map(t => <CarteTache key={t.id} task={t} searchTMDBForTask={searchTMDBForTask} setTasks={setTasks} updateTaskMeta={updateTaskMeta} removeTask={removeTask} corrigerFiche={corrigerFiche} cancelActiveUpload={cancelActiveUpload} />)}
                  </div>
                </div>
              )}
            </div>
          </>
        ))}

      {tab === "library" && <OngletBibliotheque handleSetAsideFilm={handleSetAsideFilm} activeUser={activeUser} films={films} filmsFiltres={filmsFiltres} usersList={usersList} onRefresh={onRefresh} rechercheFilm={rechercheFilm} setRechercheFilm={setRechercheFilm} verifEnCours={verifEnCours} resultatVerif={resultatVerif} isRefreshingAll={isRefreshingAll} lotInputRef={lotInputRef} replaceInputRef={replaceInputRef} setReplacingFilm={setReplacingFilm} handleVerifierFichiers={handleVerifierFichiers} handleRefreshAllMetadata={handleRefreshAllMetadata} handleRestoreFilm={handleRestoreFilm} handleDeleteFilm={handleDeleteFilm} formatDateSure={formatDateSure} />}



      {tab === "users" && (hasRole(activeUser, "owner") || hasRole(activeUser, "admin")) && <OngletUtilisateurs activeUser={activeUser} usersList={usersList} invitesList={invitesList} settings={settings} customCodeInput={customCodeInput} setCustomCodeInput={setCustomCodeInput} maxUsesInput={maxUsesInput} setMaxUsesInput={setMaxUsesInput} pendingRoleChanges={pendingRoleChanges} setPendingRoleChanges={setPendingRoleChanges} generateInvite={generateInvite} deleteInvite={deleteInvite} handleChangeRole={handleChangeRole} handleApproveUser={handleApproveUser} handleRestoreUser={handleRestoreUser} handleDeleteUser={handleDeleteUser} handleToggleRegistration={handleToggleRegistration} />}

      {tab === "stats" && (hasRole(activeUser, "owner") || hasRole(activeUser, "admin")) && <OngletStatistiques stats={stats} />}

      {tab === "quarantine" && (hasRole(activeUser, "owner") || hasRole(activeUser, "admin")) && <OngletModeration activeUser={activeUser} films={films} onRefresh={onRefresh} notifsGlobales={notifsGlobales} setNotifsGlobales={setNotifsGlobales} setPreviewVideo={setPreviewVideo} handleRestoreFilm={handleRestoreFilm} handleDeleteFilm={handleDeleteFilm} formatTimecode={formatTimecode} />}

      {tab === "polls" && <OngletSondages activeUser={activeUser} pollsConfig={pollsConfig} pollResults={pollResults} setPollResults={setPollResults} editingPollId={editingPollId} setEditingPollId={setEditingPollId} setDialogState={setDialogState} usersList={usersList} fetchData={fetchData} />}

      {tab === "security" && (hasRole(activeUser, "owner") || hasRole(activeUser, "admin")) && <OngletSecurite activeUser={activeUser} settings={settings} webhookUrlInput={webhookUrlInput} setWebhookUrlInput={setWebhookUrlInput} securityCodeInput={securityCodeInput} setSecurityCodeInput={setSecurityCodeInput} showSecurityCodeInput={showSecurityCodeInput} setShowSecurityCodeInput={setShowSecurityCodeInput} isSavingServer={isSavingServer} setIsSavingServer={setIsSavingServer} isSavingSecurityCode={isSavingSecurityCode} setIsSavingSecurityCode={setIsSavingSecurityCode} isRegeneratingSecurityCode={isRegeneratingSecurityCode} setIsRegeneratingSecurityCode={setIsRegeneratingSecurityCode} fetchData={fetchData} />}

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
                <p>Lecture démarrée 10 secondes avant le timecode signalé (<span className="text-white font-mono">{formatTimecode(previewVideo.timecode)}</span>).</p>
            </div>
          </div>
        </div>
      )}
      {showAide && <AideImportModal onClose={() => setShowAide(false)} />}

    </div>
  );
}
