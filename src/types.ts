export interface User {
    id: string;
    username: string;
    password?: string; // Simplifié pour le prototype
    email?: string;
    name: string;
    color: string;
    role: 'owner' | 'admin' | 'user';
    status?: 'pending' | 'active';
    myList: string[]; // Liste des IDs de films à voir
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
    director: string;
    cast?: Cast[];
    duration: string;
    posterUrl?: string;
    addedBy: string; // ID de l'utilisateur ayant uploadé
    addedAt: string;
    filename: string;
    originalName: string;
    status: 'ready' | 'transcoding' | 'error';
}
