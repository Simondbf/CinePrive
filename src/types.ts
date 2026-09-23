export interface User {
    id: string;
    username: string;
    password?: string; // Simplifié pour le prototype
    email?: string;
    name: string;
    color: string;
    role: 'owner' | 'admin' | 'technician' | 'user';
    status?: 'active' | 'pending_ban';
    requestedBanBy?: string;
    requestedBanAt?: number;
    myList: string[]; // Liste des IDs de films à voir
  seenFilms?: string[];
  showSeenBadge?: boolean;
}

export interface MovieRequest {
    id: string;
    userId: string;
    userName: string;
    tmdbId?: number;
    title: string;
    createdAt: number;
}

export interface Cast {
    name: string;
    character: string;
    profilePath: string | null;
}

export interface Film {
    id: string;
    tmdbId?: number;
    title: string;
    synopsis: string;
    year: number;
    genre: string;
    genres?: string[];
    director: string;
    cast?: Cast[];
    duration: string;
    runtime?: number;
    versionType?: string;
    posterUrl?: string;
    addedBy: string; // ID de l'utilisateur ayant uploadé
    addedAt: string;
    filename: string;
    originalName: string;
    status: 'AVAILABLE' | 'PROCESSING' | 'ERROR';
    pendingDeletion?: boolean;
    requestedDeletionBy?: string;
    requestedDeletionAt?: number;
    // Version de secours WebM (VP9 + Opus), fabriquee a la demande pour les
    // navigateurs prives des codecs H.264/AAC, frequents sous Linux.
    webm?: { statut: 'attente' | 'pret' | 'erreur'; fichier?: string; demandeLe?: number };
}

export interface UploadTask {
  id: string;
  file: File;
  tmdbQuery: string;
  tmdbYear?: string;
  tmdbResults: any[];
  selectedMeta: any | null;
  // Vrai pendant l'assemblage cote serveur, apres l'envoi des morceaux.
  finalisation?: boolean;
  // Renseigne apres l'import : permet de corriger la fiche a posteriori.
  filmId?: string;
  correctionOuverte?: boolean;
  status: "waiting" | "uploading" | "success" | "error" | "duplicate";
  progress: number;
  isSearching: boolean;
  etaSeconds?: number | null;
  versionType?: string;
  replaceFilmId?: string;
  replaceFilmTitle?: string;
}

export interface ReglagesServeur {
  allowRegistrations: boolean;
  webhookUrl?: string;
  securityCode?: string;
}

export interface EtatDialogue {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  isAlert?: boolean;
  closeOnConfirm?: boolean;
}

export interface Invitation {
  code: string;
  used: boolean;
  maxUses?: number;
  currentUses?: number;
  // "admin" : usage unique, expire au bout de 7 jours, donne le role
  // administrateur des l'inscription sans passer par la validation.
  role?: 'admin' | 'user';
  expiresAt?: number;
  usedBy?: string;
  createdAt?: number;
}
