import express from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// Sécurité : Bloquer l'IP nue (Autoriser uniquement via Cloudflare avec le bon nom de domaine)
app.use((req, res, next) => {
    // Si l'application tourne derrière un proxy (Cloudflare), 
    // le header 'x-forwarded-host' ou 'host' contiendra le domaine d'origine
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    
    // Si nous ne sommes pas en dev et si le host pointe vers l'IP pure au lieu du nom de domaine
    if (process.env.NODE_ENV === 'production' && typeof host === 'string') {
        const isIp = /^[0-9.]+(:[0-9]+)?$/.test(host);
        
        // Bloquer si le host est l'IP directe
        // On permet 'localhost' pour le développement interne
        if (isIp && !host.startsWith('127.0.0.1') && !host.startsWith('localhost')) {
            return res.status(403).send("Accès direct par IP bloqué. Veuillez utiliser CinePrive.rpisimon.uk");
        }
    }
    next();
});

// Dossier de stockage des vidéos
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// BDD JSON locale
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const dbFile = path.join(DATA_DIR, 'db.json');
let db: any = { users: [], films: [] };

if (fs.existsSync(dbFile)) {
    try {
        db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    } catch(e) { }
}

// Initialisation simple
if (!db.users) db.users = [];
if (!db.requests) db.requests = [];
if (!db.progress) db.progress = {};
if (!db.settings) db.settings = { allowRegistrations: true };
if (!db.invites) db.invites = [];

const saveDb = () => fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));

const upload = multer({ 
    dest: UPLOADS_DIR,
    limits: { fileSize: 1000 * 1024 * 1024 } // ~1GB limite pour le prototype (à ajuster sur un vrai serveur)
});

// Mapping simplifié des genres TMDB
const TMDB_GENRES: Record<number, string> = {
    28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie", 80: "Crime", 
    99: "Documentaire", 18: "Drame", 10751: "Familial", 14: "Fantastique",
    36: "Histoire", 27: "Horreur", 10402: "Musique", 9648: "Mystère", 
    10749: "Romance", 878: "Science-Fiction", 10770: "Téléfilm", 
    53: "Thriller", 10752: "Guerre", 37: "Western"
};

// ======================= API ROUTES =======================

// Settings
app.get('/api/settings', (req, res) => res.json(db.settings || { allowRegistrations: true }));
app.post('/api/settings', (req, res) => {
    if (req.body.allowRegistrations !== undefined) {
        db.settings.allowRegistrations = req.body.allowRegistrations;
    }
    saveDb();
    res.json(db.settings);
});

// Invites
app.get('/api/invites', (req, res) => res.json(db.invites || []));
app.post('/api/invites', (req, res) => {
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    if (!db.invites) db.invites = [];
    db.invites.push({ code: newCode, used: false, createdAt: Date.now() });
    saveDb();
    res.json({ success: true, code: newCode });
});
app.delete('/api/invites/:code', (req, res) => {
    if (!db.invites) db.invites = [];
    db.invites = db.invites.filter((i: any) => i.code !== req.params.code);
    saveDb();
    res.json({ success: true });
});

// Auth & Utilisateurs
app.get('/api/users', (req, res) => {
    // Ne renvoyer que les données non sensibles (pas le mot de passe)
  res.json(db.users.map((u: any) => ({ ...u, password: '' })));
});

app.post('/api/register', (req, res) => {
    const { username, password, email, name, inviteCode } = req.body;
    
    let bypassWithCode = false;
    if (inviteCode && db.invites) {
        const inviteIndex = db.invites.findIndex((i: any) => i.code === inviteCode && !i.used);
        if (inviteIndex >= 0) {
            bypassWithCode = true;
            // Gérer les tickets multi-uses
            const currentUses = db.invites[inviteIndex].currentUses || 0;
            const maxUses = db.invites[inviteIndex].maxUses || 1;
            
            db.invites[inviteIndex].currentUses = currentUses + 1;
            if (db.invites[inviteIndex].currentUses >= maxUses) {
                db.invites[inviteIndex].used = true; // Consommer le code s'il a atteint la limite
            }
        } else {
            return res.status(400).json({ error: "Code d'invitation invalide ou épuisé." });
        }
    }

    if (db.settings && db.settings.allowRegistrations === false && !bypassWithCode) {
        return res.status(403).json({ error: "Les inscriptions sont fermées. Fournissez un code d'invitation." });
    }

    if (!username || !password || !name) return res.status(400).json({ error: 'Champs manquants' });

    if (db.users.find((u: any) => (u.username || '').toLowerCase() === username.toLowerCase())) {
        return res.status(400).json({ error: 'Ce pseudo est déjà pris' });
    }

    const isFirstUser = db.users.length === 0;
    
    // Attribuer des couleurs aléatoires
    const colors = ['bg-amber-600', 'bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-orange-600'];
    
    const newUser = {
        id: uuidv4(),
        username,
        password, // EN PROD: HASHER!
        email: email || '',
        name,
        color: colors[db.users.length % colors.length],
        role: isFirstUser ? 'owner' : 'user', // Le 1er est propriétaire !
        status: (isFirstUser || bypassWithCode) ? 'active' : 'pending',
        myList: []
    };

    db.users.push(newUser);
    saveDb();

    // Renvoyer l'utilisateur sans le mdp
    res.json({ ...newUser, password: '' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.users.find((u: any) => 
        (
            (u.username || '').toLowerCase() === username.toLowerCase() || 
            (u.email || '').toLowerCase() === username.toLowerCase()
        ) && 
        u.password === password
    );
    
    if (user) {
        if (user.status === 'pending') {
            return res.status(403).json({ error: "Votre compte est en attente d'approbation par le propriétaire." });
        }
        res.json({ ...user, password: '' });
    } else {
        res.status(401).json({ error: 'Identifiants incorrects' });
    }
});

// Auth : Réinitialisation de mot de passe (Simulation)
app.post('/api/auth/reset-password', (req, res) => {
    const { email } = req.body;
    // On simule l'envoi d'un email (Toujours renvoyer un succès pour ne pas fuiter l'existence d'une adresse)
    res.json({ success: true, dummyMessage: "Email de réinitialisation envoyé si le compte existe." });
});

// Auth : Changement de mot de passe
app.post('/api/auth/change-password', (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;
    const user = db.users.find((u: any) => u.id === userId && u.password === oldPassword);
    
    if (!user) {
        return res.status(401).json({ error: "Ancien mot de passe incorrect." });
    }

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Le mot de passe doit faire au moins 6 caractères." });
    }

    user.password = newPassword;
    saveDb();
    res.json({ success: true });
});

// Admin : Promouvoir un utilisateur
app.post('/api/users/:id/upgrade', (req, res) => {
    const { adminId } = req.body;
    const adminUser = db.users.find((u: any) => u.id === adminId);
    
    // Seul le owner peut promouvoir qqn en admin
    if (!adminUser || adminUser.role !== 'owner') {
        return res.status(403).json({ error: 'Non autorisé' });
    }

    const userToUpgrade = db.users.find((u: any) => u.id === req.params.id);
    if (!userToUpgrade) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    userToUpgrade.role = 'admin';
    saveDb();
    res.json({ success: true });
});

// Admin : Approuver un utilisateur
app.post('/api/users/:id/approve', (req, res) => {
    const { adminId } = req.body;
    const adminUser = db.users.find((u: any) => u.id === adminId);
    
    if (!adminUser || (adminUser.role !== 'owner' && adminUser.role !== 'admin')) {
        return res.status(403).json({ error: 'Non autorisé' });
    }

    const userToApprove = db.users.find((u: any) => u.id === req.params.id);
    if (!userToApprove) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    userToApprove.status = 'active';
    saveDb();
    res.json({ success: true, user: { ...userToApprove, password: '' } });
});

app.post('/api/users/:id/mylist', (req, res) => {
    const user = db.users.find((u: any) => u.id === req.params.id);
    if (!user) return res.status(404).json({error: 'Utilisateur non trouvé'});
    
    const { filmId, action } = req.body;
    if(!user.myList) user.myList = [];

    if (action === 'add' && !user.myList.includes(filmId)) {
        user.myList.push(filmId);
    } else if (action === 'remove') {
        user.myList = user.myList.filter((id: string) => id !== filmId);
    }
    
    saveDb();
    res.json(user);
});

// Films
app.get('/api/films', (req, res) => {
  res.json(db.films);
});

// Progression de lecture
app.post('/api/progress', (req, res) => {
    const { userId, filmId, time } = req.body;
    db.progress[`${userId}_${filmId}`] = time;
    saveDb();
    res.json({ success: true });
});

app.get('/api/progress/:userId/:filmId', (req, res) => {
    const time = db.progress[`${req.params.userId}_${req.params.filmId}`] || 0;
    res.json({ time });
});

// Demandes (Requests)
app.get('/api/requests', (req, res) => {
    res.json(db.requests || []);
});

app.post('/api/requests', (req, res) => {
    const { userId, userName, title, tmdbId } = req.body;
    if (!userId || !title) return res.status(400).json({ error: 'Champs manquants' });

    const newRequest = {
        id: uuidv4(),
        userId,
        userName,
        title,
        tmdbId,
        createdAt: Date.now(),
        status: 'pending' // pending or fulfilled
    };

    if (!db.requests) db.requests = [];
    db.requests.push(newRequest);
    saveDb();
    
    res.json({ success: true, request: newRequest });
});

app.delete('/api/requests/:id', (req, res) => {
    if (!db.requests) db.requests = [];
    db.requests = db.requests.filter((r: any) => r.id !== req.params.id);
    saveDb();
    res.json({ success: true });
});

// Recherche TMDB
app.get('/api/tmdb/search', async (req, res) => {
    const query = req.query.query;
    const apiKey = process.env.TMDB_API_KEY;
    
    if (!apiKey) {
        // Mode simulation si pas de clé API (pour ne pas bloquer le prototype)
        return res.json({ results: [
            { id: 9991, title: query, release_date: "2024-01-01", overview: "[Simulation TheMovieDB] - Veuillez configurer la clé API TMDB_API_KEY dans les variables d'environnement.", poster_path: null, genre_ids: [28, 878] },
            { id: 9992, title: query + " 2", release_date: "2025-01-01", overview: "Une suite simulée.", poster_path: null, genre_ids: [35] }
        ]});
    }

    try {
        const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${query}&language=fr-FR`);
        const data = await response.json();
        res.json(data);
    } catch (err: any) {
        console.error("Erreur TMDB:", err);
        res.status(500).json({ error: 'Échec de la recherche TMDB', details: err.message });
    }
});

// Upload Video Local
app.post('/api/films/upload', upload.single('video'), async (req, res) => {
    const file = req.file;
    const body = req.body;

    if (!file) return res.status(400).json({ error: 'Aucun fichier vidéo fourni' });

    try {
        const metadata = JSON.parse(body.metadata || '{}');
        const genreIds = metadata.genre_ids || [];
        const mainGenre = genreIds.length > 0 ? (TMDB_GENRES[genreIds[0]] || 'Autre') : 'Autre';

        let castData: any[] = [];
        let directorData = 'Vérifié par TMDB';

        if (metadata.id && process.env.TMDB_API_KEY) {
            try {
                const creditsRes = await fetch(`https://api.themoviedb.org/3/movie/${metadata.id}?api_key=${process.env.TMDB_API_KEY}&language=fr-FR&append_to_response=credits`);
                const fullMeta = await creditsRes.json();
                
                if (fullMeta.credits && fullMeta.credits.cast) {
                    castData = fullMeta.credits.cast.slice(0, 10).map((c: any) => ({
                        name: c.name,
                        character: c.character,
                        profilePath: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
                    }));
                }
                if (fullMeta.credits && fullMeta.credits.crew) {
                    const dir = fullMeta.credits.crew.find((c: any) => c.job === 'Director');
                    if (dir) directorData = dir.name;
                }
            } catch (err) {
                console.error("TMDB Credits fetch error", err);
            }
        }

        const film = {
            id: uuidv4(),
            tmdbId: metadata.id,
            title: metadata.title || 'Inconnu',
            synopsis: metadata.overview || '',
            year: metadata.release_date ? parseInt(metadata.release_date.split('-')[0]) : new Date().getFullYear(),
            genre: mainGenre,
            director: directorData,
            cast: castData,
            duration: '~120m',
            posterUrl: metadata.poster_path ? `https://image.tmdb.org/t/p/w500${metadata.poster_path}` : undefined,
            addedBy: body.user || 'Unknown',
            addedAt: new Date().toISOString(),
            filename: file.filename,
            originalName: file.originalname,
            status: 'ready'
        };

        db.films.push(film);
        saveDb();

        res.json({ success: true, film });
    } catch (e) {
        console.error("Upload error", e);
        res.status(500).json({ error: 'Internal upload error' });
    }
});

// Distribution Vidéos Static
app.use('/videos', express.static(UPLOADS_DIR));


// ======================= VITE MIDDLEWARE =======================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur CinéPrivé lancé sur le port ${PORT}`);
  });
}

startServer();
