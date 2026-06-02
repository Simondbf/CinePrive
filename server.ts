import 'dotenv/config';
import express from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || 'cineprive_super_secret_dev_key';

const requireAuth = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Non autorisé' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = db.users.find((u: any) => u.id === decoded.userId);
        if (!req.user) throw new Error();
        next();
    } catch {
        res.status(401).json({ error: 'Token invalide' });
    }
};

const requireRole = (roles: string[]) => (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Accès interdit' });
    }
    next();
};

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
if (!db.settings) db.settings = { allowRegistrations: true, fundingCurrent: 0, fundingGoal: 12 };
if (!db.invites) db.invites = [];
if (!db.notifications) db.notifications = [];
if (!db.polls) db.polls = {};
db.pollsConfig = [
    {
        id: 'p1',
        title: 'Identité Visuelle & Logo',
        desc: "Quel emblème me représenterait le mieux selon vous ?",
        allowMultiple: true,
        options: [
            { id: 'o1', label: 'La pellicule classique' },
            { id: 'o2', label: "L'ordinateur/moniteur" },
            { id: 'o3', label: 'Une forme géométrique abstraite neutre' }
        ]
    },
    {
        id: 'p2',
        title: 'Couleur de Marque',
        desc: "Quelle couleur d'accent préférez-vous ?",
        allowMultiple: true,
        options: [
            { id: 'o1', label: 'Rouge Cinéma' },
            { id: 'o2', label: 'Bleu Profond' },
            { id: 'o3', label: 'Or / Jaune' },
            { id: 'o4', label: 'Violet Électrique' }
        ]
    },
    {
        id: 'p3',
        title: 'Membres Bêta',
        desc: "Souhaitez-vous devenir membre bêta pour tester les nouveautés en avant-première ?",
        allowMultiple: false,
        options: [
            { id: 'o1', label: 'Oui, je veux bien !' },
            { id: 'o2', label: 'Non, je préfère la version stable.' }
        ]
    }
];

const saveDb = () => fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));

// --- API POLLS ---
app.get('/api/polls/config', (req, res) => {
    res.json(db.pollsConfig);
});

app.post('/api/polls/config', requireAuth, requireRole(['owner']), (req, res) => {
    db.pollsConfig = req.body;
    saveDb();
    res.json({ success: true, pollsConfig: db.pollsConfig });
});

app.post('/api/polls/vote', requireAuth, (req, res) => {
    const { pollId, vote, customText, userId } = req.body;
    if (!db.polls[pollId]) db.polls[pollId] = { options: {}, custom: [], votedUsers: [], userVotes: {} };
    if (!db.polls[pollId].votedUsers) db.polls[pollId].votedUsers = [];
    if (!db.polls[pollId].userVotes) db.polls[pollId].userVotes = {};
    
    if (userId && db.polls[pollId].votedUsers.includes(userId)) {
        return res.status(400).json({ error: "Vous avez déjà voté." });
    }
    
    if (userId) {
        db.polls[pollId].votedUsers.push(userId);
        if (vote) {
             db.polls[pollId].userVotes[userId] = vote;
        }
    }

    const voteArray = Array.isArray(vote) ? vote : [vote];

    voteArray.forEach((v: string) => {
        if (v === 'custom' && customText) {
            db.polls[pollId].custom.push(customText);
        } else if (v) {
            db.polls[pollId].options[v] = (db.polls[pollId].options[v] || 0) + 1;
        }
    });
    
    // Notification for admins
    if (!db.notifications) db.notifications = [];
    db.notifications.push({
        id: Date.now().toString() + Math.random().toString(36).substring(7),
        type: 'poll_vote',
        message: `Un membre a répondu au sondage.`,
        readBy: [],
        createdAt: Date.now()
    });

    saveDb();
    res.json({ success: true, pollData: db.polls[pollId] });
});

app.get('/api/polls/results', (req, res) => {
    res.json(db.polls);
});

app.delete('/api/polls/:pollId', requireAuth, requireRole(['owner']), (req, res) => {
    const { pollId } = req.params;
    if (db.pollsConfig) {
        db.pollsConfig = db.pollsConfig.filter((p: any) => p.id !== pollId);
    }
    if (db.polls && db.polls[pollId]) {
        delete db.polls[pollId];
    }
    saveDb();
    res.json({ success: true, pollsConfig: db.pollsConfig });
});

app.delete('/api/polls/reset/:pollId', requireAuth, requireRole(['owner']), (req, res) => {
    const { pollId } = req.params;
    if (db.polls[pollId]) {
        db.polls[pollId] = { options: {}, custom: [], votedUsers: [], userVotes: {} };
        saveDb();
    }
    res.json({ success: true, pollData: db.polls[pollId] });
});

const upload = multer({ 
    dest: UPLOADS_DIR,
    limits: { fileSize: 10000 * 1024 * 1024 } // 10GB
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
app.post('/api/settings', requireAuth, requireRole(['owner', 'admin']), (req, res) => {
    if (req.body.allowRegistrations !== undefined) {
        db.settings.allowRegistrations = req.body.allowRegistrations;
    }
    if (req.body.fundingCurrent !== undefined) {
        db.settings.fundingCurrent = parseFloat(req.body.fundingCurrent);
    }
    if (req.body.fundingGoal !== undefined) {
        db.settings.fundingGoal = parseFloat(req.body.fundingGoal);
    }
    if (req.body.webhookUrl !== undefined) {
        db.settings.webhookUrl = req.body.webhookUrl;
    }
    saveDb();
    res.json(db.settings);
});

// Invites
app.get('/api/invites', (req, res) => res.json(db.invites || []));
app.post('/api/invites', requireAuth, requireRole(['owner', 'admin']), (req, res) => {
    let newCode = req.body.customCode || Math.random().toString(36).substring(2, 8).toUpperCase();
    if (!db.invites) db.invites = [];
    db.invites.push({ 
        code: newCode, 
        used: false, 
        maxUses: req.body.maxUses || 1, // Default to 1 instead of unlimited
        currentUses: 0,
        createdAt: Date.now() 
    });
    saveDb();
    res.json({ success: true, code: newCode });
});
app.delete('/api/invites/:code', requireAuth, requireRole(['owner', 'admin']), (req, res) => {
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

app.post('/api/register', async (req, res) => {
    const { username, password, email, name, inviteCode } = req.body;
    
    let bypassWithCode = false;
    if (inviteCode && db.invites) {
        const inviteIndex = db.invites.findIndex((i: any) => i.code.toLowerCase() === inviteCode.toLowerCase() && !i.used);
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
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = {
        id: uuidv4(),
        username,
        password: hashedPassword,
        email: email || '',
        name,
        color: colors[db.users.length % colors.length],
        role: isFirstUser ? 'owner' : 'user', // Le 1er est propriétaire !
        status: isFirstUser ? 'active' : 'pending',
        myList: []
    };

    db.users.push(newUser);
    
    // Notification for admins
    if (newUser.status === 'pending') {
        if (!db.notifications) db.notifications = [];
        db.notifications.push({
            id: Date.now().toString(),
            type: 'register',
            referenceId: newUser.id,
            message: `Un nouvel utilisateur ("${username}") s'est inscrit avec succès et attend validation.`,
            readBy: [],
            createdAt: Date.now()
        });
    }
    
    saveDb();

    // Renvoyer l'utilisateur sans le mdp
    res.json({ ...newUser, password: '' });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = db.users.find((u: any) => 
        (
            (u.username || '').toLowerCase() === username.toLowerCase() || 
            (u.email || '').toLowerCase() === username.toLowerCase()
        )
    );
    
    if (user) {
        let passwordMatch = false;
        if (user.password.startsWith('$2b$')) {
            passwordMatch = await bcrypt.compare(password, user.password);
        } else {
            if (user.password === password) {
                passwordMatch = true;
                user.password = await bcrypt.hash(password, 10);
                saveDb();
            }
        }

        if (passwordMatch) {
            if (user.status === 'pending') {
                return res.status(403).json({ error: "Votre compte est en attente d'approbation par le propriétaire." });
            }
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
            res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
            return res.json({ ...user, password: '' });
        }
    }
    
    res.status(401).json({ error: 'Identifiants incorrects' });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

app.get('/api/me', requireAuth, (req: any, res) => {
    res.json({ ...req.user, password: '' });
});

// Auth : Réinitialisation de mot de passe (Simulation)
app.post('/api/auth/reset-password', (req, res) => {
    const { email } = req.body;
    // On simule l'envoi d'un email (Toujours renvoyer un succès pour ne pas fuiter l'existence d'une adresse)
    res.json({ success: true, dummyMessage: "Email de réinitialisation envoyé si le compte existe." });
});

// Auth : Changement de mot de passe
app.post('/api/auth/change-password', requireAuth, async (req: any, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = db.users.find((u: any) => u.id === req.user.id);
    
    if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
        return res.status(401).json({ error: "Ancien mot de passe incorrect." });
    }

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Le mot de passe doit faire au moins 6 caractères." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    saveDb();
    res.json({ success: true });
});

// Admin : Promouvoir un utilisateur
app.post('/api/users/:id/upgrade', requireAuth, requireRole(['owner']), (req, res) => {
    const userToUpgrade = db.users.find((u: any) => u.id === req.params.id);
    if (!userToUpgrade) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    userToUpgrade.role = 'admin';
    saveDb();
    res.json({ success: true });
});

app.post('/api/users/:id/role', requireAuth, requireRole(['owner']), (req, res) => {
    const { role } = req.body;
    const userToEdit = db.users.find((u: any) => u.id === req.params.id);
    if (!userToEdit) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    userToEdit.role = role;
    saveDb();
    res.json({ success: true });
});

app.delete('/api/users/:id', requireAuth, requireRole(['owner']), (req, res) => {
    db.users = db.users.filter((u: any) => u.id !== req.params.id);
    saveDb();
    res.json({ success: true });
});

// Admin : Approuver un utilisateur
app.post('/api/users/:id/approve', requireAuth, requireRole(['owner', 'admin']), async (req: any, res) => {
    const adminUser = req.user;

    const userToApprove = db.users.find((u: any) => u.id === req.params.id);
    if (!userToApprove) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    userToApprove.status = 'active';
    userToApprove.validatedBy = adminUser.username;
    userToApprove.validatedAt = Date.now();
    
    // Phase 3: Sync to Jellyfin if configured
    if (process.env.JELLYFIN_URL && process.env.JELLYFIN_API_KEY) {
        try {
            const tempPassword = Math.random().toString(36).slice(-8);
            const jellyfinResponse = await fetch(`${process.env.JELLYFIN_URL}/Users/New`, {
                method: 'POST',
                headers: { 
                    'X-Emby-Authorization': `MediaBrowser Token="${process.env.JELLYFIN_API_KEY}"`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ Name: userToApprove.username, Password: tempPassword })
            });

            if (jellyfinResponse.ok) {
                const jellyfinUser = await jellyfinResponse.json();
                userToApprove.jellyfinId = jellyfinUser.Id;
            } else {
                console.error("Erreur lors de la création de l'utilisateur Jellyfin:", await jellyfinResponse.text());
            }
        } catch (e) {
            console.error("Échec de la communication avec Jellyfin", e);
        }
    }

    saveDb();
    res.json({ success: true, user: { ...userToApprove, password: '' } });
});

app.post('/api/users/:id/mylist', requireAuth, (req, res) => {
    const user = db.users.find((u: any) => u.id === req.params.id);
    if (!user) return res.status(404).json({error: 'Utilisateur non trouvé'});
    
    // Check if the user is modifying their own list
    if ((req as any).user.id !== user.id) return res.status(403).json({error: 'Accès interdit'});

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
app.get('/api/films', async (req, res) => {
  res.json(db.films);
});

// Progression de lecture
app.post('/api/progress', requireAuth, (req, res) => {
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

app.post('/api/requests', requireAuth, (req, res) => {
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
    
    // Notification for admins
    if (!db.notifications) db.notifications = [];
    db.notifications.push({
        id: Date.now().toString(),
        type: 'request',
        referenceId: newRequest.id,
        message: `L'utilisateur "${userName}" a demandé l'ajout du film "${title}".`,
        readBy: [],
        createdAt: Date.now()
    });
    
    saveDb();
    
    res.json({ success: true, request: newRequest });
});

app.delete('/api/requests/:id', requireAuth, requireRole(['owner', 'admin']), (req, res) => {
    if (!db.requests) db.requests = [];
    db.requests = db.requests.filter((r: any) => r.id !== req.params.id);
    saveDb();
    res.json({ success: true });
});

// Notifications
app.get('/api/notifications', (req, res) => {
    res.json(db.notifications || []);
});
app.post('/api/notifications/:id/read', requireAuth, (req, res) => {
    const { userId } = req.body;
    if (!db.notifications) db.notifications = [];
    const notif = db.notifications.find((n: any) => n.id === req.params.id);
    if (notif && !notif.readBy.includes(userId)) {
        notif.readBy.push(userId);
        saveDb();
    }
    res.json({ success: true });
});
app.post('/api/notifications/read-all', requireAuth, (req, res) => {
    const { userId } = req.body;
    if (!db.notifications) db.notifications = [];
    db.notifications.forEach((n: any) => {
        if (!n.readBy.includes(userId)) {
            n.readBy.push(userId);
        }
    });
    saveDb();
    res.json({ success: true });
});

app.post('/api/bugs', requireAuth, async (req: any, res) => {
    const { os, device, isUploadRelated, description } = req.body;
    if (!db.notifications) db.notifications = [];
    
    const message = `🚨 Bug signalé par ${req.user.username}\nOS : ${os}\nAppareil : ${device}\nLié à l'upload : ${isUploadRelated ? 'Oui' : 'Non'}\nDescription :\n${description}`;
    
    db.notifications.push({
        id: uuidv4(),
        type: 'bug',
        message: message,
        createdAt: new Date().toISOString(),
        readBy: []
    });
    
    saveDb();
    
    // Envoyer au webhook Discord si configuré
    if (db.settings && db.settings.webhookUrl) {
        try {
            await fetch(db.settings.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: message })
            });
        } catch (e) {
            console.error("Erreur d'envoi webhook", e);
        }
    }
    
    res.json({ success: true });
});

// Recherche TMDB
app.get('/api/tmdb/search', async (req, res) => {
    const query = req.query.query as string;
    const apiKey = process.env.TMDB_API_KEY;
    
    if (!apiKey) {
        // Mode simulation si pas de clé API (pour ne pas bloquer le prototype)
        return res.json({ results: [
            { id: 9991, title: query, release_date: "2024-01-01", overview: "[Simulation TheMovieDB] - Veuillez configurer la clé API TMDB_API_KEY dans les variables d'environnement.", poster_path: null, genre_ids: [28, 878] },
            { id: 9992, title: query + " 2", release_date: "2025-01-01", overview: "Une suite simulée.", poster_path: null, genre_ids: [35] }
        ]});
    }

    try {
        const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=fr-FR`);
        const data = await response.json();
        res.json(data);
    } catch (err: any) {
        console.error("Erreur TMDB:", err);
        res.status(500).json({ error: 'Échec de la recherche TMDB', details: err.message });
    }
});

// Upload Video Local
app.post('/api/films/upload', requireAuth, upload.single('video'), async (req: any, res) => {
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
        
        // Notifications
        if (!db.notifications) db.notifications = [];
        const notifMessage = `🎬 Nouveau film ajouté par ${req.user.username} : ${film.title}`;
        db.notifications.push({
            id: uuidv4(),
            type: 'upload',
            message: notifMessage,
            createdAt: new Date().toISOString(),
            readBy: []
        });

        // Webhook Discord
        if (db.settings && db.settings.webhookUrl) {
            try {
                fetch(db.settings.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: notifMessage })
                }).catch(e => console.error("Discord webhook failed", e));
            } catch (e) {}
        }
        
        saveDb();

        res.json({ success: true, film });
    } catch (e) {
        console.error("Upload error", e);
        res.status(500).json({ error: 'Internal upload error' });
    }
});

// Distribution Vidéos Static & Proxy Jellyfin
app.get('/videos/:filename', requireAuth, (req, res) => {
    const safeName = path.basename(req.params.filename);
    res.sendFile(path.join(UPLOADS_DIR, safeName));
});

// Phase 3: Route /api/stream/:filmId via Jellyfin API
app.get('/api/stream/:filmId', requireAuth, async (req: any, res) => {
    const user = req.user;
    const filmId = req.params.filmId;
    
    // Find film
    const films = [];
    try {
        if (fs.existsSync(FILMS_FILE)) {
            films.push(...JSON.parse(fs.readFileSync(FILMS_FILE, 'utf-8')));
        }
    } catch (e) {}
    
    const film = films.find(f => f.id === filmId || (f as any).jellyfinId === filmId);
    if (!film) return res.status(404).json({ error: 'Film non trouvé' });

    if (process.env.JELLYFIN_URL && process.env.JELLYFIN_API_KEY) {
        const jellyfinStreamUrl = `${process.env.JELLYFIN_URL}/Videos/${(film as any).jellyfinId || film.id}/stream?api_key=${process.env.JELLYFIN_API_KEY}`;
        return res.redirect(jellyfinStreamUrl);
    } else {
        // Fallback local
        const filename = film.filename || film.id;
        return res.redirect(`/videos/${filename}`);
    }
});

// Force Download Route
app.get('/api/download/:filmId', requireAuth, async (req: any, res) => {
    const filmId = req.params.filmId;
    
    const films = [];
    try {
        if (fs.existsSync(FILMS_FILE)) {
            films.push(...JSON.parse(fs.readFileSync(FILMS_FILE, 'utf-8')));
        }
    } catch (e) {}
    
    const film = films.find(f => f.id === filmId || (f as any).jellyfinId === filmId);
    if (!film) return res.status(404).json({ error: 'Film non trouvé' });

    const safeName = path.basename(film.filename || '');
    const filePath = path.join(UPLOADS_DIR, safeName);
    
    if (fs.existsSync(filePath)) {
        res.download(filePath, film.originalName || safeName);
    } else {
        res.status(404).json({ error: 'Fichier source introuvable' });
    }
});


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
