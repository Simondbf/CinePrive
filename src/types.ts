export interface User {
    id: string;
    username: string;
    password?: string; // Simplifié pour le prototype
    email?: string;
    name: string;
    color: string;
    role: 'owner' | 'admin' | 'technician' | 'user';
    status?: 'pending' | 'active' | 'pending_ban';
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
    jellyfinId?: string;
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
