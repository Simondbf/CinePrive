import 'dotenv/config';
import { sonder, estLisiblePartout, videoCopiable } from './compatibilite';
import express from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { exec, spawn, execFile } from 'child_process';
import nodemailer from 'nodemailer';

const app = express();
app.set('trust proxy', 1);
const PORT = 3000;

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
app.use(cookieParser());

// Adresse reelle du visiteur. Avec trust proxy a 1 (plus haut), Express la tire
// de X-Forwarded-For en ne faisant confiance qu'au dernier intermediaire, nginx :
// c'est l'adresse que nginx a lui-meme ajoutee, impossible a falsifier.
// L'ancien code lisait d'abord CF-Connecting-IP, puis la PREMIERE entree de
// X-Forwarded-For. Derriere l'ancien proxy, qui reecrivait ces en-tetes, c'etait
// juste ; derriere nginx, le visiteur les ecrit lui-meme. Ne pas les reintroduire. Il suffisait d'en changer a
// chaque essai pour ne jamais declencher le verrouillage apres cinq mots de
// passe faux, calcule par nom d'utilisateur ET par adresse.
const ipClient = (req: any): string => req.ip || req.socket?.remoteAddress || 'unknown';

app.use('/api', (req, res, next) => {
    const ip = ipClient(req);
    console.log(`[HTTP] ${ip} - ${req.method} ${req.url}`);
    next();
});

let JWT_SECRET = process.env.JWT_SECRET || 'cineprive_super_secret_dev_key';

// Domaine public de l'application. Modifiable via le fichier .env : c'est le
// seul endroit a changer lors d'une migration de nom de domaine.
const PUBLIC_DOMAIN = process.env.PUBLIC_DOMAIN || 'cineprive.soleiljaune.be';

const userHasRole = (user: any, ...wanted: string[]) => {
    const roles: string[] = user?.roles ?? (user?.role ? [user.role] : []);
    return wanted.some(r => roles.includes(r));
};

// Rempli plus bas, une fois db charge : le comptage de frequentation.
let compterVisite: ((userId: string) => void) | null = null;

const requireAuth = (req: any, res: any, next: any) => {
    let token = req.cookies.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ error: 'Non autorisé' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = db.users.find((u: any) => u.id === decoded.userId);
        if (!req.user) throw new Error();
        
        // Sécurité : Bloquer l'utilisateur s'il est banni temporairement ou suspendu par l'admin
        if (req.user.status === 'pending_ban') {
            return res.status(403).json({ error: 'Votre compte est temporairement suspendu en attente de la validation finale du Patron.' });
        }

        // Comptage anonyme de frequentation (voir plus bas). Defini plus tard
        // dans le fichier, d'ou la verification.
        if (compterVisite) {
            try { compterVisite(req.user.id); } catch (e) { /* jamais bloquant */ }
        }

        next();
    } catch {
        res.status(401).json({ error: 'Token invalide' });
    }
};

const requireRole = (roles: string[]) => (req: any, res: any, next: any) => {
    if (!req.user || !userHasRole(req.user, ...roles)) {
        return res.status(403).json({ error: 'Accès interdit' });
    }
    next();
};

const verificationCodes: Record<string, { code: string, expires: number, targetId: string, operation: string }> = {};

async function sendSecurityCodeEmail(email: string, name: string, code: string, operationLabel: string) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const fromName = process.env.SMTP_FROM_NAME || 'CinéPrivé Sécurité';
    const fromAddress = process.env.SMTP_FROM_EMAIL || `security@${PUBLIC_DOMAIN}`;

    if (!host || !user || !pass) {
        console.log(`[Sécurité Mail] SMTP non configuré. Le code généré pour ${email} (${name}) est : ${code}`);
        return false;
    }

    try {
        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: {
                user,
                pass
            }
        });

        const mailOptions = {
            from: `"${fromName}" <${fromAddress}>`,
            to: email,
            subject: `🔑 Code de sécurité CinéPrivé`,
            html: `
                <div style="font-family: sans-serif; background-color: #0f0f10; color: #ffffff; padding: 40px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #27272a;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="color: #e4e4e7; font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 2px;">CINÉPRIVÉ</span>
                        <p style="color: #71717a; font-size: 14px; margin: 5px 0 0 0;">Validation de sécurité d'un administrateur</p>
                    </div>
                    
                    <div style="background-color: #18181b; border-radius: 8px; padding: 24px; border: 1px solid #27272a; margin-bottom: 24px;">
                        <p style="margin: 0 0 16px 0; color: #a1a1aa; font-size: 15px;">Bonjour <strong>${name}</strong>,</p>
                        <p style="margin: 0 0 20px 0; color: #a1a1aa; font-size: 14px; line-height: 1.5;">
                            Une action sensible exigeant vos droits de propriétaire/administrateur a été initiée : <br/>
                            <strong style="color: #ef4444; font-size: 15px;">👉 ${operationLabel}</strong>
                        </p>
                        
                        <div style="background-color: #0d0e12; border: 1px solid #3f3f46; border-radius: 6px; padding: 16px; text-align: center; margin-bottom: 20px;">
                            <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: bold; color: #ea580c; letter-spacing: 6px;">${code}</span>
                        </div>
                        
                        <p style="margin: 0; color: #71717a; font-size: 12px; line-height: 1.4; text-align: center;">
                            Ce code est à usage unique et expirera dans 5 minutes.<br/>
                            Si vous n'êtes pas à l'origine de cette action, ignorez cet e-mail.
                        </p>
                    </div>
                    
                    <div style="text-align: center; font-size: 11px; color: #52525b;">
                        &copy; 2026 CinéPrivé • Serveur multimédia autonome.
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[Sécurité Mail] E-mail de validation de sécurité envoyé avec succès à ${email}`);
        return true;
    } catch (err) {
        console.error('[Sécurité Mail] Erreur lors de l\'envoi de l\'e-mail :', err);
        return false;
    }
}

async function sendNewPatronSecurityCodeEmail(email: string, name: string, code: string, method: 'direct' | 'regenerate' = 'regenerate') {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const fromName = process.env.SMTP_FROM_NAME || 'CinéPrivé Sécurité';
    const fromAddress = process.env.SMTP_FROM_EMAIL || `security@${PUBLIC_DOMAIN}`;

    if (!host || !user || !pass) {
        console.log(`[Sécurité Mail] SMTP non configuré. Le nouveau code pour le Patron (${email}) est : ${code}`);
        return false;
    }

    try {
        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass }
        });

        const subject = method === 'regenerate' 
            ? `🔑 Nouveau Code de Sécurité Régénéré - CinéPrivé`
            : `🔑 Récupération/Modification de votre Code de Sécurité - CinéPrivé`;

        const actionText = method === 'regenerate'
            ? `Un nouveau code de sécurité a été généré aléatoirement pour sécuriser les actions de votre espace Patron.`
            : `Votre code de sécurité Patron a été mis à jour dans vos paramètres.`;

        const mailOptions = {
            from: `"${fromName}" <${fromAddress}>`,
            to: email,
            subject,
            html: `
                <div style="font-family: sans-serif; background-color: #0f0f10; color: #ffffff; padding: 40px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #27272a;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="color: #e4e4e7; font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 2px;">CINÉPRIVÉ</span>
                        <p style="color: #71717a; font-size: 14px; margin: 5px 0 0 0;">Sécurité de l'Espace Patron</p>
                    </div>
                    
                    <div style="background-color: #18181b; border-radius: 8px; padding: 24px; border: 1px solid #27272a; margin-bottom: 24px;">
                        <p style="margin: 0 0 16px 0; color: #a1a1aa; font-size: 15px;">Bonjour <strong>${name}</strong>,</p>
                        <p style="margin: 0 0 20px 0; color: #a1a1aa; font-size: 14px; line-height: 1.5;">
                            ${actionText}<br/>
                            Ce code est requis pour valider les suppressions de films et bannissements définitifs d'utilisateurs.
                        </p>
                        
                        <div style="background-color: #0d0e12; border: 1px solid #3f3f46; border-radius: 6px; padding: 16px; text-align: center; margin-bottom: 20px;">
                            <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: bold; color: #ef4444; letter-spacing: 6px;">${code}</span>
                        </div>
                        
                        <p style="margin: 0; color: #71717a; font-size: 12px; line-height: 1.4; text-align: center;">
                            Veuillez conserver ce code précieusement.<br/>
                            Vous pouvez le modifier à tout moment depuis vos Paramètres.
                        </p>
                    </div>
                    
                    <div style="text-align: center; font-size: 11px; color: #52525b;">
                        &copy; 2026 CinéPrivé • Serveur multimédia autonome.
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[Sécurité Mail] Code de sécurité envoyé avec succès au Patron à : ${email}`);
        return true;
    } catch (err) {
        console.error('[Sécurité Mail] Erreur d\'envoi du code de sécurité au Patron :', err);
        return false;
    }
}

import crypto from 'crypto';

const securityAttempts: Record<string, { count: number, lockedUntil: number }> = {};

function timingSafeCompare(a: string, b: string) {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifySecurityCode(userId: string, code: string, operation: string, targetId: string): { valid: boolean, error?: string } {
    let attempts = securityAttempts[userId] || { count: 0, lockedUntil: 0 };
    if (attempts.lockedUntil > Date.now()) {
        const remaining = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
        return { valid: false, error: `Trop de tentatives. Veuillez patienter ${remaining}s.` };
    }

    const masterCode = process.env.SECURITY_MASTER_CODE;
    if (masterCode && timingSafeCompare(code, masterCode)) {
        delete securityAttempts[userId];
        return { valid: true };
    }

    const record = verificationCodes[userId];
    if (record) {
        if (timingSafeCompare(code, record.code)) {
            if (Date.now() > record.expires) {
                delete verificationCodes[userId];
                return { valid: false, error: "Le code a expiré après 5 minutes." };
            }
            delete verificationCodes[userId];
            delete securityAttempts[userId];
            return { valid: true };
        }
    }

    const patronCode = db.settings?.securityCode;
    if (patronCode && timingSafeCompare(code, patronCode)) {
        delete securityAttempts[userId];
        return { valid: true };
    }

    attempts.count++;
    if (attempts.count >= 5) {
        attempts.lockedUntil = Date.now() + 5 * 60 * 1000; // 5 min lockout
        attempts.count = 0;
    }
    securityAttempts[userId] = attempts;

    return { valid: false, error: "Code de sécurité incorrect." };
}

const requestCodeAttempts: Record<string, { count: number, lockedUntil: number }> = {};

app.post('/api/security/request-code', requireAuth, requireRole(['owner', 'admin']), async (req: any, res) => {
    const { operation, targetId, label } = req.body;
    if (!operation || !targetId) {
        return res.status(400).json({ error: "Paramètres manquants." });
    }

    const userId = req.user.id;
    let attempts = requestCodeAttempts[userId] || { count: 0, lockedUntil: 0 };
    if (attempts.lockedUntil > Date.now()) {
        const remaining = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
        return res.status(429).json({ error: `Trop de requêtes. Veuillez patienter ${remaining}s.` });
    }

    attempts.count++;
    if (attempts.count >= 3) {
        attempts.lockedUntil = Date.now() + 2 * 60 * 1000; // 2 min lockout after 3 requests
        attempts.count = 0;
    }
    requestCodeAttempts[userId] = attempts;
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodes[req.user.id] = {
        code,
        expires: Date.now() + 5 * 60 * 1000,
        targetId,
        operation
    };

    const hasSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    
    let sentToEmail = false;
    if (hasSmtp && req.user.email) {
        sentToEmail = await sendSecurityCodeEmail(req.user.email, req.user.name || req.user.username, code, label || operation);
    }

    let sentToDiscord = false;
    if (db.settings?.webhookUrl) {
        try {
            const opLabel = operation === 'delete_film' ? 'Suppression définitive du film' : 'Bannissement définitive de l\'utilisateur';
            const discordMessage = `🔐 **[CinéPrivé Sécurité]** Validation requise par **${req.user.name || req.user.username}** pour l'action :\n` +
                `👉 **${label || opLabel}**\n` +
                `🔑 **Code temporaire** : \`${code}\`\n` +
                `⏱️ *Valable pendant 5 minutes. Saisissez ce code dans l'application pour valider.*`;
            
            await fetch(db.settings.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: discordMessage })
            });
            sentToDiscord = true;
        } catch (e) {
            console.error("Erreur d'envoi du code sécurité sur Discord Webhook", e);
        }
    }

    res.json({
        success: true,
        smtpConfigured: hasSmtp && !!req.user.email,
        discordConfigured: !!db.settings?.webhookUrl,
        emailSentTo: req.user.email || null,
        codeShownInDemo: (!hasSmtp && !db.settings?.webhookUrl) ? code : null
    });
});

// Sécurité : refuser l'accès par l'adresse IP nue, n'accepter que le nom de domaine.
// Double protection : le conteneur n'ecoute que sur 127.0.0.1 et la configuration
// nginx par defaut rejette deja les requetes qui ne visent aucun domaine connu.
app.use((req, res, next) => {
    // Derriere nginx, le domaine demande arrive dans l'en-tete Host.
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    
    // Si nous ne sommes pas en dev et si le host pointe vers l'IP pure au lieu du nom de domaine
    if (process.env.NODE_ENV === 'production' && typeof host === 'string') {
        const isIp = /^[0-9.]+(:[0-9]+)?$/.test(host);
        
        // Bloquer si le host est l'IP directe
        // On permet 'localhost' pour le développement interne
        if (isIp && !host.startsWith('127.0.0.1') && !host.startsWith('localhost')) {
            return res.status(403).send(`Accès direct par IP bloqué. Veuillez utiliser ${PUBLIC_DOMAIN}`);
        }
    }
    next();
});

// Configuration des téléchargements Chunkés
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');
const FILMS_DIR = path.join(process.cwd(), 'data', 'Films');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(FILMS_DIR)) fs.mkdirSync(FILMS_DIR, { recursive: true });

const resolveVideoPath = (safeName: string): string | null => {
    for (const dir of [UPLOADS_DIR, FILMS_DIR]) {
        const p = path.join(dir, safeName);
        if (fs.existsSync(p)) return p;
    }
    return null;
};

// Nettoyage automatique des chunks fantômes (> 12 heures)
setInterval(() => {
    try {
        const files = fs.readdirSync(UPLOADS_DIR);
        const now = Date.now();
        const MAX_AGE = 12 * 60 * 60 * 1000; // 12 heures
        
        let cleaned = 0;
        files.forEach(file => {
            if (file.startsWith('temp_')) {
                const filePath = path.join(UPLOADS_DIR, file);
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > MAX_AGE) {
                    fs.unlinkSync(filePath);
                    cleaned++;
                }
            }
        });
        if (cleaned > 0) console.log(`[Nettoyage] ${cleaned} chunk(s) fantôme(s) supprimé(s).`);
    } catch (e) {
        console.error('[Nettoyage] Erreur lors du nettoyage des chunks:', e);
    }
}, 60 * 60 * 1000); // Exécuter toutes les heures

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
    } catch (e) {
        console.error("FATAL ERROR: Failed to parse db.json. Halting startup to prevent data corruption.", e);
        throw e;
    }
        
    // Migration of old statuses to new statuses and role -> roles migration
    let migrated = false;
    
    if (db.users && Array.isArray(db.users)) {
        db.users.forEach((user: any) => {
            if (user.role && !user.roles) {
                user.roles = [user.role];
                migrated = true;
            } else if (user.roles && !user.role) {
                user.role = user.roles.length > 0 ? user.roles[0] : 'member';
                migrated = true;
            }
        });
    }

    if (db.films && Array.isArray(db.films)) {
        db.films.forEach((film: any) => {
            if (film.status === 'ready') {
                film.status = 'AVAILABLE';
                migrated = true;
            } else if (film.status === 'transcoding') {
                film.status = 'PROCESSING';
                migrated = true;
            } else if (film.status === 'error') {
                film.status = 'ERROR';
                migrated = true;
            }
        });
    }
    if (migrated) {
        const tmpFile = dbFile + '.tmp';
        fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2));
        fs.renameSync(tmpFile, dbFile);
        console.log('[DB] Migration des statuts de films appliquée.');
    }
}

// Initialisation simple
if (!db.users) db.users = [];
if (!db.requests) db.requests = [];
if (!db.progress) db.progress = {};
if (!db.settings) db.settings = { allowRegistrations: true, fundingCurrent: 0, fundingGoal: 12 };
if (!db.settings.securityCode) db.settings.securityCode = Math.floor(100000 + Math.random() * 900000).toString();
if (!db.fundingHistory) db.fundingHistory = [];

// Sécurisation automatique de JWT_SECRET
if (process.env.JWT_SECRET) {
    JWT_SECRET = process.env.JWT_SECRET;
} else if (db.settings && db.settings.jwtSecret) {
    JWT_SECRET = db.settings.jwtSecret;
    console.log('[Sécurité] JWT_SECRET chargé depuis le fichier de configuration persistent (db.settings.jwtSecret).');
} else if (process.env.NODE_ENV !== 'development') {
    throw new Error("ERREUR CRITIQUE: Démarrage refusé. Aucun JWT_SECRET n'est défini en variable d'environnement (recommandé) ni dans db.json.");
}
if (!db.invites) db.invites = [];
if (!db.notifications) db.notifications = [];
if (!db.polls) db.polls = {};
if (!db.pollsConfig) db.pollsConfig = [];

const defaultPolls = [
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
        allowCustom: false,
        options: [
            { id: 'o1', label: 'Oui, je veux bien !' },
            { id: 'o2', label: 'Non, je préfère la version stable.' }
        ]
    },
    {
        id: 'p4',
        title: 'Nom de Domaine',
        desc: "Que pensez-vous du nom de domaine actuel ?",
        allowMultiple: false,
        allowCustom: true,
        options: [
            { id: 'o1', label: `${PUBLIC_DOMAIN} me convient très bien` },
            { id: 'o2', label: 'Je préfèrerais un format plus court' },
            { id: 'o3', label: 'Il faudrait un vrai domaine professionnel (.com, .fr)' }
        ]
    }
];

// Amorcer les sondages par defaut UNE SEULE FOIS, a la toute premiere
// initialisation de la base. L'ancienne version re-fusionnait a chaque
// demarrage du serveur : tout sondage supprime par le Patron reapparaissait
// au redemarrage suivant. Les nouveaux sondages se creent desormais depuis
// la Salle des Serveurs, pas dans le code.
if (!db.pollsSeedInitial) {
    if (db.pollsConfig.length === 0) {
        defaultPolls.forEach(defaultPoll => {
            db.pollsConfig.push(defaultPoll);
        });
    }
    // Les bases existantes (comme celle en production) sont considerees
    // comme deja amorcees : on ne touche plus a leur liste.
    db.pollsSeedInitial = true;
}

const saveDb = () => {
    const tmpFile = dbFile + '.tmp';
    const bakFile = dbFile + '.bak';
    
    // 1. Ecrire dans le fichier temporaire (atomique)
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2));
    
    // 2. Si un fichier db existe déjà, on en fait une copie .bak par sécurité
    if (fs.existsSync(dbFile)) {
        fs.copyFileSync(dbFile, bakFile);
    }
    
    // 3. Renommer le tmp pour remplacer le fichier actuel
    fs.renameSync(tmpFile, dbFile);
};

let saveDbTimeout: NodeJS.Timeout | null = null;
const debouncedSaveDb = () => {
    if (saveDbTimeout) clearTimeout(saveDbTimeout);
    saveDbTimeout = setTimeout(() => {
        saveDb();
        saveDbTimeout = null;
    }, 5000); // 5 sec debounce
};

import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Optional: Graceful fallback for Redis connection 
// If Redis isn't up (like in a sandbox environment), BullMQ will keep trying, which is fine, 
// but we only want strict BullMQ here.
const connection = new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
});

export const transcodeQueue = new Queue('transcode', { connection: connection as any });
export const transcodeFastQueue = new Queue('transcode-fast', { connection: connection as any });
const transcodeEvents = new QueueEvents('transcode', { connection: connection as any });
const transcodeFastEvents = new QueueEvents('transcode-fast', { connection: connection as any });
// Versions de secours WebM, fabriquees a la demande (voir worker.ts).
export const webmQueue = new Queue('transcode-webm', { connection: connection as any });
const webmEvents = new QueueEvents('transcode-webm', { connection: connection as any });

const handleTranscodeCompleted = async ({ jobId, returnvalue }: any, queue: any) => {
    let parsedReturn: any = returnvalue;
    if (typeof returnvalue === 'string') {
        try { parsedReturn = JSON.parse(returnvalue); } catch(e) {}
    }
    
    if (!parsedReturn || typeof parsedReturn !== 'object') {
        try {
            const job = await queue.getJob(jobId);
            if (job && job.returnvalue) {
                parsedReturn = typeof job.returnvalue === 'string' ? JSON.parse(job.returnvalue) : job.returnvalue;
            }
        } catch (e) {}
    }

    const filmId = parsedReturn?.filmId;
    const newFilename = parsedReturn?.newFilename || parsedReturn?.outputFilename;

    if (!filmId || !newFilename) {
        console.error(`[Queue] Impossible de parser returnvalue pour la db:`, returnvalue);
        return;
    }

    const film = db.films.find((f: any) => f.id === filmId);
    if (film) {
        film.filename = newFilename;
        film.status = 'AVAILABLE';
        saveDb();
        console.log(`[Queue] Film ${filmId} marqué comme prêt. Fichier: ${newFilename}`);
        
        // Notifications
        if (!db.notifications) db.notifications = [];
        const notifMessage = `🎬 Nouveau film disponible : ${film.title} est prêt !`;
        const { v4: uuidv4 } = require('uuid');
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
    }
};

const handleTranscodeFailed = async ({ jobId, failedReason }: any, queue: any) => {
    console.error(`[Queue] Échec du transcodage pour le job ${jobId}: ${failedReason}`);
    try {
        const job = await queue.getJob(jobId);
        if (job && job.data.filmId) {
            const film = db.films.find((f: any) => f.id === job.data.filmId);
            if (film && job.data.dejaEnLigne) {
                // Le worker ne supprime la source qu'apres une conversion reussie :
                // le fichier d'origine est intact, le film reste regardable.
                console.error(`[Queue] Reconversion échouée pour "${film.title}" : il reste en ligne avec son fichier d'origine.`);
            } else if (film) {
                film.status = 'ERROR';
                saveDb();
            }
        }
    } catch(e) {}
};

transcodeEvents.on('completed', (args) => handleTranscodeCompleted(args, transcodeQueue));
transcodeFastEvents.on('completed', (args) => handleTranscodeCompleted(args, transcodeFastQueue));
transcodeEvents.on('failed', (args) => handleTranscodeFailed(args, transcodeQueue));
transcodeFastEvents.on('failed', (args) => handleTranscodeFailed(args, transcodeFastQueue));

// Supprime la version de secours d'un film, s'il en a une.
const supprimerVersionSecours = (film: any) => {
    const fichier = film?.webm?.fichier;
    if (fichier) {
        const chemin = resolveVideoPath(path.basename(fichier));
        if (chemin) {
            try { fs.unlinkSync(chemin); } catch (e) { console.error(`[Webm] Suppression impossible de ${fichier}:`, e); }
        }
    }
    if (film) delete film.webm;
};

// Un visiteur qui attend devant son ecran passe devant la preparation de toute
// la bibliotheque, qui peut durer des semaines. Plus le nombre est petit, plus
// la priorite est haute.
const PRIORITE_DEMANDE = 1;
const PRIORITE_LOT = 100;

// Identifiant de job fixe par film : une seule preparation a la fois pour un
// meme film, et une demande urgente peut retrouver un job du lot et le faire
// passer devant.
const mettreEnFileSecours = async (film: any, priorite: number) => {
    const jobId = `webm_${film.id}`;
    const existant = await webmQueue.getJob(jobId).catch(() => null);
    if (existant) {
        const etat = await existant.getState();
        if (etat === 'active') return;
        if (etat === 'waiting' || etat === 'prioritized' || etat === 'delayed') {
            if (priorite < (existant.opts.priority ?? Infinity)) {
                await existant.changePriority({ priority: priorite });
            }
            return;
        }
        // Termine ou echoue : on repart de zero.
        await existant.remove().catch(() => {});
    }
    await webmQueue.add('webm-job', { filmId: film.id, inputFilename: film.filename }, {
        jobId,
        priority: priorite,
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
    });
};

// L'identifiant du film se lit dans celui du job : "webm_<film>" ou, pour les
// jobs d'avant cette version, "webm_<film>_<horodatage>".
const filmDuJobSecours = (jobId: string) => String(jobId || '').slice(5).split('_')[0];

const lireRetourJob = async (queue: any, jobId: string, returnvalue: any) => {
    let retour: any = returnvalue;
    if (typeof retour === 'string') { try { retour = JSON.parse(retour); } catch (e) {} }
    if (!retour || typeof retour !== 'object') {
        const job = await queue.getJob(jobId).catch(() => null);
        retour = job?.returnvalue;
        if (typeof retour === 'string') { try { retour = JSON.parse(retour); } catch (e) {} }
    }
    return retour;
};

webmEvents.on('completed', async ({ jobId, returnvalue }: any) => {
    const retour = await lireRetourJob(webmQueue, jobId, returnvalue);
    const film = db.films.find((f: any) => f.id === retour?.filmId);
    if (!film) {
        // Film supprime pendant l'encodage : le fichier produit n'a plus de proprietaire.
        const orphelin = retour?.fichier && resolveVideoPath(path.basename(retour.fichier));
        if (orphelin) { try { fs.unlinkSync(orphelin); } catch (e) {} }
        return;
    }
    film.webm = { statut: 'pret', fichier: retour.fichier, demandeLe: film.webm?.demandeLe };
    saveDb();
    console.log(`[Webm] "${film.title}" est lisible sur les navigateurs sans codecs H.264.`);
});

webmEvents.on('failed', async ({ jobId, failedReason }: any) => {
    const film = db.films.find((f: any) => f.id === filmDuJobSecours(jobId));
    console.error(`[Webm] Échec de la version de secours ${jobId} : ${failedReason}`);
    if (film) {
        film.webm = { statut: 'erreur', demandeLe: film.webm?.demandeLe };
        saveDb();
    }
});


// Renvoie le traitement reellement applique, pour que l'interface annonce
// un delai exact au lieu d'un message unique parlant toujours de la nuit :
//   'immediat' : rien a faire, le film est deja lisible
//   'rapide'   : remuxage sur la file rapide, jamais mise en pause
//   'nuit'     : encodage lourd, file active seulement de 01h00 a 06h45
// dejaEnLigne : film deja disponible que l'on reconvertit (rattrapage, bouton
// "Convertir"). Il reste visible pendant la conversion, et un echec le laisse
// disponible avec son fichier d'origine, intact, au lieu de le faire disparaitre.
export const enqueueTranscode = async (filmId: string, inputFilename: string, dejaEnLigne = false): Promise<'immediat' | 'rapide' | 'nuit'> => {
    try {
        await transcodeQueue.remove(filmId);
        await transcodeFastQueue.remove(filmId);
    } catch(e) {}

    const inputPath = resolveVideoPath(path.basename(inputFilename)) || path.join(UPLOADS_DIR, inputFilename);
    const flux = await sonder(inputPath);
    
    // Lisible par tous les navigateurs : en ligne tout de suite.
    if (estLisiblePartout(inputFilename, flux)) {
        console.log(`[Queue] Film ${filmId} déjà lisible partout (MP4, H.264 8 bits, ${flux.audio || 'sans son'}). Aucune conversion.`);
        const film = db.films.find((f: any) => f.id === filmId);
        if (film) {
            film.status = 'AVAILABLE';
            film.progress = 100;
            saveDb();
        }
        return 'immediat';
    }

    // Video recopiable : seul l'emballage ou le son change, c'est rapide.
    const isH264 = videoCopiable(flux);
    console.log(`[Queue] Film ${filmId} : vidéo ${flux.video || '?'} (${flux.pixFmt || '?'}), audio ${flux.audio || 'aucun'} → conversion ${isH264 ? 'rapide' : 'de nuit'}.`);

    if (isH264) {
        console.log(`[Queue] Remuxing rapide détecté (H264). Ajout à la file rapide (qui n'est jamais en pause).`);
        await transcodeFastQueue.add(
            'transcode-job', 
            { filmId, inputFilename, dejaEnLigne }, 
            { 
                jobId: `${filmId}_${Date.now()}`,
                removeOnComplete: { age: 3600 },
                removeOnFail: 50
            }
        );
    } else {
        console.log(`[Queue] Encodage lourd requis. Ajout à la file nocturne.`);
        await transcodeQueue.add(
            'transcode-job', 
            { filmId, inputFilename, dejaEnLigne }, 
            { 
                jobId: `${filmId}_${Date.now()}`,
                removeOnComplete: { age: 3600 },
                removeOnFail: 50
            }
        );
    }
    console.log(`[Queue] Job ajouté à BullMQ pour le film ID: ${filmId}`);
    return isH264 ? 'rapide' : 'nuit';
};

import cron from 'node-cron';

// Tâche planifiée : Mettre en pause à 06h45
cron.schedule('45 6 * * *', async () => {
    console.log('[Cron] 06h45 : Mise en pause de la file de transcodage.');
    await transcodeQueue.pause();
});

// Tâche planifiée : Relancer à 01h00
cron.schedule('0 1 * * *', async () => {
    console.log('[Cron] 01h00 : Reprise de la file de transcodage.');
    await transcodeQueue.resume();
});

// Tâche planifiée : Réinitialiser la cagnotte le 1er du mois
cron.schedule('0 0 1 * *', () => {
    console.log('[Cron] Réinitialisation mensuelle de la cagnotte.');
    if (db.settings) {
        db.settings.fundingCurrent = 0;
        saveDb();
    }
});

// État initial au démarrage du serveur
const initQueueState = async () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // File active de 01:00 à 06:44
    const isActive = (hour >= 1 && hour < 6) || (hour === 6 && minute < 45);
    
    if (!isActive) {
        console.log('[Cron] Démarrage hors du créneau 01h00-06h45. Mise en pause initiale de la file.');
        await transcodeQueue.pause();
    } else {
        console.log('[Cron] Démarrage dans le créneau 01h00-06h45. File active.');
        await transcodeQueue.resume();
    }
};
initQueueState();

// --- API POLLS ---
app.get('/api/polls/config', (req, res) => {
    res.json(db.pollsConfig);
});

app.post('/api/polls/config', requireAuth, requireRole(['owner']), (req, res) => {
    db.pollsConfig = req.body;
    saveDb();
    res.json({ success: true, pollsConfig: db.pollsConfig });
});

app.post('/api/polls/vote', requireAuth, (req: any, res) => {
    const { pollId, vote, customText } = req.body;
    const userId = req.user.id;
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

app.get('/api/polls/results', requireAuth, (req, res) => {
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
    limits: { fileSize: 15000 * 1024 * 1024 } // 15GB
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

// Public Settings
app.get('/api/public/settings', (req, res) => {
    res.json({
        allowRegistrations: db.settings?.allowRegistrations ?? true
    });
});

// Settings
app.get('/api/settings', requireAuth, (req: any, res) => {
    const settings: any = { 
        allowRegistrations: db.settings?.allowRegistrations ?? true,
        fundingCurrent: db.settings?.fundingCurrent ?? 0,
        fundingGoal: db.settings?.fundingGoal ?? 12
    };
    if (userHasRole(req.user, 'owner')) {
        settings.webhookUrl = db.settings?.webhookUrl || '';
        settings.securityCode = db.settings?.securityCode || '000000';
    } else if (userHasRole(req.user, 'admin')) {
        settings.webhookUrl = db.settings?.webhookUrl || '';
    }
    res.json(settings);
});

app.post('/api/settings', requireAuth, requireRole(['owner', 'admin']), (req: any, res) => {
    if (req.body.allowRegistrations !== undefined) {
        db.settings.allowRegistrations = req.body.allowRegistrations;
    }
    if (req.body.fundingCurrent !== undefined) {
        db.settings.fundingCurrent = parseFloat(req.body.fundingCurrent);
    }
    if (req.body.fundingGoal !== undefined) {
        db.settings.fundingGoal = parseFloat(req.body.fundingGoal);
    }
    if (userHasRole(req.user, 'owner') || userHasRole(req.user, 'admin')) {
        if (req.body.webhookUrl !== undefined) {
            db.settings.webhookUrl = req.body.webhookUrl;
        }
    }
    if (userHasRole(req.user, 'owner')) {
        if (req.body.securityCode !== undefined) {
            db.settings.securityCode = req.body.securityCode;
        }
    }
    saveDb();
    
    // Pour la réponse, renvoyer de manière sécurisée
    const responseSettings: any = {
        allowRegistrations: db.settings.allowRegistrations,
        fundingCurrent: db.settings.fundingCurrent,
        fundingGoal: db.settings.fundingGoal
    };
    if (userHasRole(req.user, 'owner')) {
        responseSettings.webhookUrl = db.settings.webhookUrl || '';
        responseSettings.securityCode = db.settings.securityCode || '';
    } else if (userHasRole(req.user, 'admin')) {
        responseSettings.webhookUrl = db.settings.webhookUrl || '';
    }
    res.json(responseSettings);
});

app.post('/api/settings/contribute', requireAuth, (req: any, res) => {
    const { amount } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
    }
    
    db.settings.fundingCurrent = (db.settings.fundingCurrent || 0) + amount;
    
    db.fundingHistory.push({
        id: Date.now().toString() + Math.random().toString().slice(2),
        userId: req.user.id,
        username: req.user.username,
        amount,
        date: new Date().toISOString()
    });
    
    saveDb();
    res.json({ success: true, fundingCurrent: db.settings.fundingCurrent });
});

app.get('/api/settings/funding-history', requireAuth, requireRole(['owner']), (req: any, res) => {
    res.json(db.fundingHistory || []);
});

app.post('/api/settings/security/regenerate', requireAuth, requireRole(['owner']), async (req: any, res) => {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    db.settings.securityCode = newCode;
    saveDb();

    let notificationSent = false;
    let sentToDiscord = false;
    let sentToEmail = false;

    // 1. Envoyer à Discord si configuré
    if (db.settings.webhookUrl) {
        try {
            const discordMessage = `🔔 **[CinéPrivé Sécurité]** Un nouveau code de sécurité Patron a été régénéré : \`${newCode}\`.\nCe code est désormais requis pour toutes les suppressions définitives de films ou bannissements d'utilisateurs.`;
            await fetch(db.settings.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: discordMessage })
            });
            sentToDiscord = true;
            notificationSent = true;
        } catch (e) {
            console.error("Erreur envoi webhook sécurité Discord", e);
        }
    }

    // 2. Envoyer par e-mail si SMTP et adresse configurés
    const hasSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    if (hasSmtp && req.user.email) {
        const sent = await sendNewPatronSecurityCodeEmail(req.user.email, req.user.name || req.user.username, newCode, 'regenerate');
        if (sent) {
            sentToEmail = true;
            notificationSent = true;
        }
    }

    res.json({
        success: true,
        securityCode: newCode,
        sentToDiscord,
        sentToEmail,
        notificationSent,
        emailSentTo: req.user.email || null
    });
});

// Invites
app.get('/api/invites', requireAuth, requireRole(['owner', 'admin']), (req, res) => res.json(db.invites || []));
app.post('/api/invites', requireAuth, requireRole(['owner', 'admin']), (req: any, res) => {
    const role = req.body.role === 'admin' ? 'admin' : 'user';

    // Un code administrateur donne les droits d'administration des l'inscription,
    // sans passer par la validation. Reserve au proprietaire : un administrateur
    // ne peut pas changer les roles (la route /role est reservee au proprietaire),
    // il ne doit pas pouvoir contourner cette limite en fabriquant des invitations.
    if (role === 'admin' && !userHasRole(req.user, 'owner')) {
        return res.status(403).json({ error: "Seul le propriétaire peut créer un code administrateur." });
    }

    if (!db.invites) db.invites = [];
    const invitation: any = {
        used: false,
        currentUses: 0,
        createdAt: Date.now(),
        role,
        createdBy: req.user.username,
    };

    if (role === 'admin') {
        // Trois garde-fous. Jamais de code personnalise : "MARIE2026" se devine.
        // Une seule utilisation, quoi que demande l'interface. Et une date limite :
        // un code qui traine dans une conversation transferee ne doit pas rester
        // valable indefiniment.
        invitation.code = 'ADM-' + crypto.randomBytes(6).toString('hex').toUpperCase();
        invitation.maxUses = 1;
        invitation.expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    } else {
        invitation.code = req.body.customCode || Math.random().toString(36).substring(2, 8).toUpperCase();
        invitation.maxUses = req.body.maxUses || 1; // Default to 1 instead of unlimited
    }

    db.invites.push(invitation);
    saveDb();
    res.json({ success: true, code: invitation.code });
});
app.delete('/api/invites/:code', requireAuth, requireRole(['owner', 'admin']), (req, res) => {
    if (!db.invites) db.invites = [];
    db.invites = db.invites.filter((i: any) => i.code !== req.params.code);
    saveDb();
    res.json({ success: true });
});

// Auth & Utilisateurs
app.get('/api/users', requireAuth, requireRole(['owner', 'admin']), (req, res) => {
    // Ne renvoyer que les données non sensibles (pas le mot de passe)
  res.json(db.users.map((u: any) => ({ ...u, password: '' })));
});

app.post('/api/register', async (req, res) => {
    let { username, password, email, name, inviteCode, rememberMe } = req.body;
    
    // L'invitation est verifiee ici mais consommee plus bas, apres les controles
    // du pseudo. Avant, un pseudo deja pris brulait le code au passage et il
    // fallait en regenerer un — genant pour un code a usage unique.
    let invitation: any = null;
    if (inviteCode && db.invites) {
        invitation = db.invites.find((i: any) => i.code.toLowerCase() === String(inviteCode).toLowerCase() && !i.used);
        if (!invitation) {
            return res.status(400).json({ error: "Code d'invitation invalide ou épuisé." });
        }
        if (invitation.expiresAt && Date.now() > invitation.expiresAt) {
            return res.status(400).json({ error: "Ce code d'invitation a expiré. Demandez-en un nouveau." });
        }
    }
    const bypassWithCode = !!invitation;
    const inviteAdmin = invitation?.role === 'admin';

    if (db.settings && db.settings.allowRegistrations === false && !bypassWithCode) {
        return res.status(403).json({ error: "Les inscriptions sont fermées. Fournissez un code d'invitation." });
    }

    if (!username || !password || !name) return res.status(400).json({ error: 'Champs manquants' });

    // Longueur minimale du pseudo : un pseudo d'une seule lettre est
    // impossible a distinguer dans les listes et les mentions.
    username = String(username).trim();
    name = String(name).trim();
    if (username.length < 2) {
        return res.status(400).json({ error: 'Le pseudo doit contenir au moins 2 caractères.' });
    }
    if (username.length > 20) {
        return res.status(400).json({ error: 'Le pseudo ne doit pas dépasser 20 caractères.' });
    }
    if (name.length < 2) {
        return res.status(400).json({ error: 'Le prénom doit contenir au moins 2 caractères.' });
    }

    if (db.users.find((u: any) => (u.username || '').toLowerCase() === username.toLowerCase())) {
        return res.status(400).json({ error: 'Ce pseudo est déjà pris' });
    }

    const isFirstUser = db.users.length === 0;
    
    // Attribuer des couleurs aléatoires
    const colors = ['bg-amber-600', 'bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-orange-600'];

    // Consommation de l'invitation : toutes les verifications sont passees, et on
    // est encore AVANT le premier await. Node traite ce bloc d'un seul tenant, donc
    // deux inscriptions simultanees ne peuvent pas utiliser le meme code unique.
    // Le placer apres bcrypt.hash aurait ouvert cette fenetre.
    if (invitation) {
        invitation.currentUses = (invitation.currentUses || 0) + 1;
        if (invitation.currentUses >= (invitation.maxUses || 1)) invitation.used = true;
        if (inviteAdmin) {
            invitation.usedBy = username;
            invitation.usedAt = Date.now();
        }
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);

    // Le 1er inscrit est proprietaire. Un code administrateur donne directement le
    // role admin et un compte actif : le proprietaire s'est deja porte garant en
    // creant le code, une validation supplementaire n'aurait pas de sens.
    const role = isFirstUser ? 'owner' : (inviteAdmin ? 'admin' : 'user');
    
    const newUser = {
        id: uuidv4(),
        username,
        password: hashedPassword,
        email: email || '',
        name,
        color: colors[db.users.length % colors.length],
        role,
        roles: [role],
        // Plus d'etape de validation : tout compte est actif des l'inscription.
        // C'est l'ouverture des inscriptions qui decide qui peut entrer : fermees,
        // il faut un code d'invitation.
        status: 'active',
        myList: []
    };

    db.users.push(newUser);
    
    
    saveDb();

    const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: rememberMe ? '30d' : '1d' });
    res.cookie('token', token, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'lax',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : undefined 
    });

    // Renvoyer l'utilisateur sans le mdp
    res.json({ ...newUser, password: '', token });
});

const loginAttempts: Record<string, { count: number, lockedUntil: number }> = {};

app.post('/api/login', async (req, res) => {
    const { username, password, rememberMe } = req.body;
    const ip = ipClient(req);
    const lockKey = `${(username || '').toLowerCase()}_${ip}`;
    
    let attempts = loginAttempts[lockKey] || { count: 0, lockedUntil: 0 };
    if (attempts.lockedUntil > Date.now()) {
        const remaining = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
        return res.status(429).json({ error: `Trop de tentatives. Veuillez patienter ${remaining}s.` });
    }

    const user = db.users.find((u: any) => 
        (
            (u.username || '').toLowerCase() === (username || '').toLowerCase() || 
            (u.email || '').toLowerCase() === (username || '').toLowerCase()
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
            delete loginAttempts[lockKey];
            if (user.status === 'pending_ban') {
                return res.status(403).json({ error: "Votre compte est temporairement suspendu en attente de la validation finale du Patron." });
            }
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: rememberMe ? '30d' : '1d' });
            res.cookie('token', token, { 
                httpOnly: true, 
                secure: process.env.NODE_ENV === 'production', 
                sameSite: 'lax',
                maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : undefined 
            });
            return res.json({ ...user, password: '', token });
        }
    }
    
    attempts.count++;
    if (attempts.count >= 5) {
        attempts.lockedUntil = Date.now() + 5 * 60 * 1000;
        attempts.count = 0;
    }
    loginAttempts[lockKey] = attempts;

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


app.post('/api/users/:id/role', requireAuth, requireRole(['owner']), (req, res) => {
    const { role } = req.body;
    const userToEdit = db.users.find((u: any) => u.id === req.params.id);
    if (!userToEdit) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    userToEdit.roles = Array.isArray(role) ? role : [role];
    saveDb();
    res.json({ success: true });
});

// Reactiver un compte suspendu : c'est la decision finale, donc proprietaire seul.
app.post('/api/users/:id/restore', requireAuth, requireRole(['owner']), (req: any, res) => {
    const { id } = req.params;
    const targetUser = db.users.find((u: any) => u.id === id);
    if (!targetUser) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    targetUser.status = 'active';
    delete targetUser.requestedBanBy;
    delete targetUser.requestedBanAt;
    
    saveDb();
    res.json({ success: true, message: `Le compte de "${targetUser.username}" a été réactivé.` });
});

// Suspendre un membre : un admin soumet un bannissement au proprietaire. Le
// compte est bloque sur-le-champ — le middleware d'authentification refuse
// toute requete d'un compte pending_ban — jusqu'a la decision du proprietaire :
// Reactiver, ou Bannir definitivement. Un admin ne peut suspendre ni le
// proprietaire, ni un autre admin, ni lui-meme.
// Toute l'interface ("Suspendu par...", Reactiver, Bannir def.) existait deja,
// mais le client appelait DELETE, reserve au proprietaire : rien ne posait
// jamais pending_ban.
app.post('/api/users/:id/suspend', requireAuth, requireRole(['owner', 'admin']), (req: any, res) => {
    const targetUser = db.users.find((u: any) => u.id === req.params.id);
    if (!targetUser) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    if (targetUser.id === req.user.id) {
        return res.status(403).json({ error: "Vous ne pouvez pas effectuer cette action sur vous-même." });
    }
    if (userHasRole(targetUser, 'owner') || (userHasRole(targetUser, 'admin') && !userHasRole(req.user, 'owner'))) {
        return res.status(403).json({ error: "Seul le Patron peut suspendre un administrateur." });
    }

    const nom = targetUser.name || targetUser.username;
    targetUser.status = 'pending_ban';
    targetUser.requestedBanBy = req.user.name || req.user.username;
    targetUser.requestedBanAt = Date.now();

    if (!db.notifications) db.notifications = [];
    db.notifications.push({
        id: Date.now().toString(),
        type: 'bannissement',
        referenceId: targetUser.id,
        message: `${targetUser.requestedBanBy} demande le bannissement de "${nom}". Le compte est suspendu en attendant la décision du Patron.`,
        readBy: [],
        createdAt: Date.now()
    });

    saveDb();
    res.json({ success: true, message: `Le compte de "${nom}" est suspendu. Le Patron décidera de la suite.` });
});

app.delete('/api/users/:id', requireAuth, requireRole(['owner']), (req: any, res) => {
    const { id } = req.params;
    const targetUser = db.users.find((u: any) => u.id === id);
    if (!targetUser) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    
    if (userHasRole(targetUser, 'owner')) {
        return res.status(403).json({ error: "Impossible de modifier le compte Patron." });
    }
    
    if (targetUser.id === req.user.id) {
        return res.status(403).json({ error: "Vous ne pouvez pas effectuer cette action sur vous-même." });
    }

    // Le Patron (owner) valide avec le code pour supprimer définitivement
    const code = req.query.code || req.headers['x-security-code'];
    if (!code) {
        return res.status(400).json({ error: "Code de validation de sécurité requis." });
    }
    const verification = verifySecurityCode(req.user.id, code as string, 'delete_user', id);
    if (!verification.valid) {
        return res.status(403).json({ error: verification.error });
    }

    db.users = db.users.filter((u: any) => u.id !== id);
    saveDb();
    res.json({ success: true, deleted: true, message: `L'utilisateur "${targetUser.username}" a été banni définitivement.` });
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
app.get('/api/films', requireAuth, async (req: any, res) => {
  let filmsList = db.films || [];
  
  // Masquer les films en attente de suppression définitive ou en quarantaine pour les membres réguliers
  if (!userHasRole(req.user, 'owner') && !userHasRole(req.user, 'admin')) {
      filmsList = filmsList.filter((f: any) => !f.pendingDeletion && !f.isQuarantined);
  }

  const sanitizedFilms = filmsList.map((f: any) => {
    let sanitizedF = { ...f };
    const creator = db.users.find((u: any) => u.id === f.addedBy);
    if (creator) {
        sanitizedF.addedBy = creator.name || creator.username;
    }


    if (!userHasRole(req.user, 'owner') && !userHasRole(req.user, 'admin') && !userHasRole(req.user, 'technician')) {
        delete sanitizedF.originalName;
    }

    return sanitizedF;
  });
  res.json(sanitizedFilms);
});

app.post('/api/films/:id/restore', requireAuth, requireRole(['owner', 'admin']), (req: any, res) => {
    const { id } = req.params;
    const film = db.films.find((f: any) => f.id === id);
    if (!film) {
        return res.status(404).json({ error: "Film non trouvé" });
    }

    delete film.pendingDeletion;
    delete film.requestedDeletionBy;
    delete film.requestedDeletionAt;
    delete film.isQuarantined;
    delete film.reports;
    
    saveDb();
    res.json({ success: true, message: `Le film "${film.title}" a été restauré.` });
});

// Mettre un film de cote : il disparait pour les membres, reste visible pour
// l'equipe, et se retablit d'un clic. Seul le proprietaire peut ensuite le
// detruire (DELETE, avec code de securite).
// Le client appelait jusqu'ici DELETE pour les admins — route reservee au
// proprietaire — et le bouton etait de toute facon desactive pour eux : toute
// l'interface "Suspendu par..." existait, mais rien ne posait pendingDeletion.
app.post('/api/films/:id/set-aside', requireAuth, requireRole(['owner', 'admin']), (req: any, res) => {
    const film = db.films.find((f: any) => f.id === req.params.id);
    if (!film) {
        return res.status(404).json({ error: "Film non trouvé" });
    }
    film.pendingDeletion = true;
    film.requestedDeletionBy = req.user.name || req.user.username;
    film.requestedDeletionAt = Date.now();
    saveDb();
    res.json({ success: true, message: `Le film "${film.title}" a été mis de côté.` });
});

app.post('/api/films/:id/report', requireAuth, (req: any, res) => {
    const { id } = req.params;
    const { timecode } = req.body;
    
    const film = db.films.find((f: any) => f.id === id);
    if (!film) {
        return res.status(404).json({ error: "Film non trouvé" });
    }

    film.isQuarantined = true;
    
    if (!film.reports) {
        film.reports = [];
    }
    
    film.reports.push({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        userId: req.user.id,
        userName: req.user.name || req.user.username,
        timecode,
        createdAt: new Date().toISOString()
    });
    
    saveDb();
    res.json({ success: true, message: "Film mis en quarantaine suite au signalement." });
});

app.put('/api/films/:id/genre', requireAuth, requireRole(['owner', 'admin']), (req: any, res) => {
    const { id } = req.params;
    const { genre } = req.body;
    
    if (!genre) return res.status(400).json({ error: "Le genre est requis" });

    const filmIndex = db.films.findIndex((f: any) => f.id === id);
    if (filmIndex === -1) {
        return res.status(404).json({ error: "Film non trouvé" });
    }

    db.films[filmIndex].genre = genre;
    db.films[filmIndex].genres = [genre];
    db.films[filmIndex].genreOverride = genre;
    saveDb();

    res.json({ success: true, film: db.films[filmIndex] });
});

app.delete('/api/films/:id', requireAuth, requireRole(['owner']), (req: any, res) => {
    const { id } = req.params;
    const filmIndex = db.films.findIndex((f: any) => f.id === id);
    if (filmIndex === -1) {
        return res.status(404).json({ error: "Film non trouvé" });
    }
    const film = db.films[filmIndex];

    // Si c'est le Patron (owner), il faut valider avec le code de sécurité pour supprimer définitivement
    const code = req.query.code || req.headers['x-security-code'];
    if (!code) {
        return res.status(400).json({ error: "Code de validation de sécurité requis." });
    }
    const verification = verifySecurityCode(req.user.id, code as string, 'delete_film', id);
    if (!verification.valid) {
        return res.status(403).json({ error: verification.error });
    }
    
    // Si c'est un film local de type upload, on supprime le fichier physique
    if (film.filename) {
        const filePath = path.join(UPLOADS_DIR, film.filename);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`[Delete] Fichier vidéo supprimé du serveur : ${film.filename}`);
            } catch (err) {
                console.error(`[Delete] Erreur de suppression du fichier ${film.filename}:`, err);
            }
        }
    }
    supprimerVersionSecours(film);
    
    db.films.splice(filmIndex, 1);
    
    if (db.progress) {
        delete db.progress[id];
    }
    
    saveDb();
    res.json({ success: true, deleted: true, message: `Le film "${film.title}" a été supprimé définitivement.` });
});


// Progression de lecture
app.post('/api/progress', requireAuth, (req: any, res) => {
    const { filmId, time } = req.body;
    db.progress[`${req.user.id}_${filmId}`] = time;
    debouncedSaveDb();
    res.json({ success: true });
});

app.get('/api/progress', requireAuth, (req: any, res) => {
    const userProgress: Record<string, number> = {};
    Object.keys(db.progress).forEach(key => {
        if (key.startsWith(`${req.user.id}_`)) {
            const filmId = key.replace(`${req.user.id}_`, '');
            userProgress[filmId] = db.progress[key];
        }
    });
    res.json(userProgress);
});

app.get('/api/progress/:filmId', requireAuth, (req: any, res) => {
    const time = db.progress[`${req.user.id}_${req.params.filmId}`] || 0;
    res.json({ time });
});

app.delete('/api/progress/:filmId', requireAuth, (req: any, res) => {
    delete db.progress[`${req.user.id}_${req.params.filmId}`];
    debouncedSaveDb();
    res.json({ success: true });
});

// Demandes (Requests)
app.get('/api/requests', requireAuth, (req, res) => {
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
// La boite s'appelle "Nouveautes" et concerne tout le monde. Les membres
// voient les arrivees de films ; les notifications de gestion (demandes de
// compte, bugs, votes) restent reservees a l'equipe. Chacun peut vider sa
// boite : suppression reelle pour l'equipe, masquage personnel pour les
// autres, afin qu'un membre n'efface pas la boite des cinquante autres.
// Rattrapage unique. Jusqu'en septembre 2026, tout .mp4 etait mis en ligne sans
// verifier son contenu : des films en HEVC, en 10 bits ou avec un son AC-3 ne se
// lisaient que chez une partie des membres. Au premier demarrage, on repasse
// une fois sur toute la bibliotheque et on envoie en conversion ceux qui ne
// sont pas lisibles partout. Ils restent en ligne pendant la conversion ; un
// echec les laisse en ligne avec leur fichier d'origine.
setTimeout(async () => {
    try {
        if (!db.settings) db.settings = {};
        if (db.settings.rattrapageCompatibilite) return;
        const enLigne = (db.films || []).filter((f: any) => f.status === 'AVAILABLE' && f.filename);
        let envoyes = 0;
        for (const film of enLigne) {
            const chemin = resolveVideoPath(path.basename(film.filename));
            if (!chemin) continue;
            const flux = await sonder(chemin);
            // Analyse impossible (stockage momentanement injoignable...) : on ne
            // prend aucun risque, le film n'est pas touche.
            if (!flux.video) continue;
            if (estLisiblePartout(film.filename, flux)) continue;
            await enqueueTranscode(film.id, film.filename, true);
            envoyes++;
        }
        db.settings.rattrapageCompatibilite = Date.now();
        saveDb();
        console.log(`[Rattrapage] ${enLigne.length} film(s) vérifié(s), ${envoyes} envoyé(s) en conversion.`);
    } catch (e) {
        console.error('[Rattrapage] Interrompu, il sera relancé au prochain démarrage :', e);
    }
}, 30000);

// Une notification vit une semaine. Le filtre d'affichage ci-dessous est exact
// a la seconde ; la purge quotidienne fait le menage dans la base.
const DUREE_VIE_NOTIF = 7 * 24 * 60 * 60 * 1000;
// createdAt est un nombre pour certaines notifications et un texte ISO pour
// d'autres (arrivees de films, signalements de bug). Comparer un texte a un
// nombre donnait toujours "trop vieux" : ces notifications disparaissaient des
// leur creation et etaient effacees a chaque redemarrage.
const dateNotif = (n: any): number => {
    if (typeof n.createdAt === 'number') return n.createdAt;
    const depuisTexte = Date.parse(n.createdAt);
    if (!isNaN(depuisTexte)) return depuisTexte;
    const depuisId = Number(n.id);
    return isNaN(depuisId) ? 0 : depuisId;
};
const notifRecente = (n: any) => dateNotif(n) >= Date.now() - DUREE_VIE_NOTIF;

const purgerNotificationsExpirees = () => {
    if (!db.notifications) return;
    const avant = db.notifications.length;
    db.notifications = db.notifications.filter(notifRecente);
    if (db.notifications.length === avant) return;
    // Les masquages personnels qui visaient des notifications disparues n'ont
    // plus d'objet : sans ce nettoyage, ces listes grossiraient indefiniment.
    const restantes = new Set(db.notifications.map((n: any) => n.id));
    (db.users || []).forEach((u: any) => {
        if (u.hiddenNotifs) u.hiddenNotifs = u.hiddenNotifs.filter((id: string) => restantes.has(id));
    });
    saveDb();
    console.log(`[Notifications] ${avant - db.notifications.length} notification(s) de plus d'une semaine supprimee(s).`);
};
purgerNotificationsExpirees();
cron.schedule('30 4 * * *', purgerNotificationsExpirees);

const notifsVisiblesPour = (utilisateur: any) => {
    const equipe = utilisateur?.roles?.includes('owner') || utilisateur?.roles?.includes('admin');
    const masquees: string[] = utilisateur?.hiddenNotifs || [];
    return (db.notifications || [])
        .filter(notifRecente)
        .filter((n: any) => equipe || n.type === 'upload')
        .filter((n: any) => !masquees.includes(n.id));
};

app.get('/api/notifications', requireAuth, (req: any, res) => {
    const utilisateur = db.users.find((u: any) => u.id === req.user.id);
    res.json(notifsVisiblesPour(utilisateur));
});
app.post('/api/notifications/:id/read', requireAuth, (req: any, res) => {
    const userId = req.user.id;
    if (!db.notifications) db.notifications = [];
    const notif = db.notifications.find((n: any) => n.id === req.params.id);
    if (notif && !notif.readBy.includes(userId)) {
        notif.readBy.push(userId);
        saveDb();
    }
    res.json({ success: true });
});
app.post('/api/notifications/read-all', requireAuth, (req: any, res) => {
    const userId = req.user.id;
    if (!db.notifications) db.notifications = [];
    db.notifications.forEach((n: any) => {
        if (!n.readBy.includes(userId)) {
            n.readBy.push(userId);
        }
    });
    saveDb();
    res.json({ success: true });
});

// Vider la boite d'un coup : la suppression une par une devenait penible
// des que plusieurs films etaient importes le meme jour.
// Vider sa boite est toujours un geste personnel, pour tout le monde :
// personne n'efface la boite des autres depuis ici. La suppression reelle
// se fait depuis la Salle des Serveurs (route /global ci-dessous).
app.delete('/api/notifications', requireAuth, (req: any, res) => {
    const utilisateur = db.users.find((u: any) => u.id === req.user.id);
    if (!utilisateur) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const visibles = notifsVisiblesPour(utilisateur);
    if (!Array.isArray(utilisateur.hiddenNotifs)) utilisateur.hiddenNotifs = [];
    utilisateur.hiddenNotifs = [...new Set([...utilisateur.hiddenNotifs, ...visibles.map((n: any) => n.id)])];
    saveDb();
    res.json({ success: true, supprimees: visibles.length });
});

// Retirer une notification pour TOUS les membres : sert quand l'annonce
// elle-meme pose probleme (contenu inapproprie signale par son titre).
app.delete('/api/notifications/:id/global', requireAuth, requireRole(['owner', 'admin']), (req: any, res) => {
    if (!db.notifications) db.notifications = [];
    const avant = db.notifications.length;
    db.notifications = db.notifications.filter((n: any) => n.id !== req.params.id);
    saveDb();
    res.json({ success: true, supprimee: avant !== db.notifications.length });
});

app.delete('/api/notifications/:id', requireAuth, (req: any, res) => {
    const utilisateur = db.users.find((u: any) => u.id === req.user.id);
    if (!utilisateur) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (!Array.isArray(utilisateur.hiddenNotifs)) utilisateur.hiddenNotifs = [];
    if (!utilisateur.hiddenNotifs.includes(req.params.id)) utilisateur.hiddenNotifs.push(req.params.id);
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
app.get('/api/tmdb/search', requireAuth, async (req, res) => {
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
        const trimmedQuery = query.trim();
        
        // 1. Recherche par ID direct
        if (/^\d+$/.test(trimmedQuery)) {
            const response = await fetch(`https://api.themoviedb.org/3/movie/${trimmedQuery}?api_key=${apiKey}&language=fr-FR`);
            if (response.ok) {
                const data = await response.json();
                if (data && !data.adult) {
                    return res.json({ results: [data] });
                }
            }
        }
        
        // 2. Recherche par année
        let searchQuery = trimmedQuery;
        let yearParam = '';
        const yearMatch = trimmedQuery.match(/^(.*?)\s+(19\d{2}|20\d{2})$/);
        
        if (yearMatch) {
            searchQuery = yearMatch[1].trim();
            yearParam = `&primary_release_year=${yearMatch[2]}`;
        }

        const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(searchQuery)}&language=fr-FR&include_adult=false${yearParam}`);
        const data = await response.json();
        
        if (data.results) {
            data.results = data.results.filter((r: any) => !r.adult);
        }
        
        res.json(data);
    } catch (err: any) {
        console.error("Erreur TMDB:", err);
        res.status(500).json({ error: 'Échec de la recherche TMDB', details: err.message });
    }
});

app.post('/api/films/:id/refresh-metadata', requireAuth, requireRole(['owner', 'admin', 'technician']), async (req: any, res) => {
    const film = db.films.find((f: any) => f.id === req.params.id);
    if (!film) return res.status(404).json({ error: "Film introuvable" });

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return res.status(400).json({ error: "Clé API TMDB non configurée" });

    try {
        let metaId = film.tmdbId;
        
        // Si on n'a pas de tmdbId, on tente de le trouver via le titre
        if (!metaId) {
            const searchRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(film.title)}&language=fr-FR`);
            const searchData = await searchRes.json();
            if (searchData.results && searchData.results.length > 0) {
                metaId = searchData.results[0].id;
                film.tmdbId = metaId;
            } else {
                return res.status(404).json({ error: "Aucun résultat trouvé sur TMDB pour ce titre" });
            }
        }

        const creditsRes = await fetch(`https://api.themoviedb.org/3/movie/${metaId}?api_key=${apiKey}&language=fr-FR&append_to_response=credits`);
        const fullMeta = await creditsRes.json();
        
        if (fullMeta.poster_path) {
            film.posterUrl = `https://image.tmdb.org/t/p/w500${fullMeta.poster_path}`;
        }
        if (fullMeta.overview) film.synopsis = fullMeta.overview;
        if (fullMeta.release_date) film.year = parseInt(fullMeta.release_date.split('-')[0]);
        if (fullMeta.genres && Array.isArray(fullMeta.genres)) {
            film.genres = fullMeta.genres.map((g: any) => g.name);
            if (film.genres.length > 0) film.genre = film.genres[0]; // Rétrocompatibilité
        }

        if (fullMeta.credits && fullMeta.credits.cast) {
            film.cast = fullMeta.credits.cast.slice(0, 10).map((c: any) => ({
                name: c.name,
                character: c.character,
                profilePath: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
            }));
        }
        if (fullMeta.credits && fullMeta.credits.crew) {
            const dir = fullMeta.credits.crew.find((c: any) => c.job === 'Director');
            if (dir) film.director = dir.name;
        }

        saveDb();
        res.json({ success: true, film });
    } catch (err) {
        console.error("TMDB Refresh error", err);
        res.status(500).json({ error: "Erreur lors de la mise à jour des métadonnées" });
    }
});

// Bande-annonce du film (A_FAIRE n°5) : on interroge TMDB et on renvoie le
// lien YouTube. Français d'abord, anglais en secours. Le front ouvre le lien
// dans un nouvel onglet ; en cas d'échec il retombe sur une recherche YouTube.
app.get('/api/films/:id/trailer', requireAuth, async (req: any, res) => {
    const film = db.films.find((f: any) => f.id === req.params.id);
    if (!film) return res.status(404).json({ error: "Film introuvable" });

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return res.status(404).json({ error: "Clé API TMDB non configurée" });

    try {
        // Les films importes avant l'association TMDB n'ont pas de tmdbId :
        // on le retrouve par une recherche sur le titre et l'annee.
        let tmdbId = film.tmdbId;
        if (!tmdbId) {
            const rechercheUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=fr-FR&query=${encodeURIComponent(film.title || '')}${film.year ? `&year=${film.year}` : ''}`;
            const rechercheRes = await fetch(rechercheUrl);
            if (rechercheRes.ok) {
                const data: any = await rechercheRes.json();
                if (data.results?.length) tmdbId = data.results[0].id;
            }
        }
        if (!tmdbId) return res.status(404).json({ error: "Film introuvable sur TMDB" });

        for (const langue of ['fr-FR', 'en-US']) {
            const reponse = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${apiKey}&language=${langue}`);
            if (!reponse.ok) continue;
            const data = await reponse.json();
            const videos = Array.isArray(data.results) ? data.results : [];
            const choix =
                videos.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ||
                videos.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer') ||
                videos.find((v: any) => v.site === 'YouTube' && v.type === 'Teaser');
            if (choix) {
                // `key` permet de l'integrer directement dans la fiche, sans
                // ouverture d'onglet que les navigateurs bloquent souvent.
                return res.json({ key: choix.key, url: `https://www.youtube.com/watch?v=${choix.key}`, name: choix.name });
            }
        }
        return res.status(404).json({ error: "Aucune bande-annonce trouvée sur TMDB" });
    } catch (err: any) {
        console.error("TMDB trailer error", err);
        return res.status(500).json({ error: "Erreur lors de la recherche de la bande-annonce" });
    }
});

// ---------- FREQUENTATION ----------
// Comptage volontairement anonyme : on garde des NOMBRES, jamais qui a
// regarde quoi. Le dedoublonnage du jour se fait en memoire vive et
// disparait au redemarrage ; seuls les totaux sont ecrits sur le disque.
// Aucun cookie ni identifiant n'est ajoute : tout est deduit des requetes
// deja authentifiees, ce qui evite d'avoir a demander un consentement.
if (!db.stats) db.stats = { jours: {}, films: {} };
if (!db.stats.jours) db.stats.jours = {};
if (!db.stats.films) db.stats.films = {};

let jourCourant = '';
let visiteursDuJour = new Set<string>();

const jourActuel = () => new Date().toISOString().slice(0, 10);

const ligneDuJour = (jour: string) => {
    if (!db.stats.jours[jour]) db.stats.jours[jour] = { visiteurs: 0, lectures: 0 };
    return db.stats.jours[jour];
};

// Ne conserver que 180 jours : au-dela, la courbe n'apprend plus rien.
const purgerVieuxJours = () => {
    const limite = new Date();
    limite.setDate(limite.getDate() - 180);
    const seuil = limite.toISOString().slice(0, 10);
    for (const jour of Object.keys(db.stats.jours)) {
        if (jour < seuil) delete db.stats.jours[jour];
    }
};

compterVisite = (userId: string) => {
    const jour = jourActuel();
    if (jour !== jourCourant) {
        jourCourant = jour;
        visiteursDuJour = new Set();
        purgerVieuxJours();
    }
    if (visiteursDuJour.has(userId)) return;
    visiteursDuJour.add(userId);
    ligneDuJour(jour).visiteurs = visiteursDuJour.size;
    saveDb();
};

// Une lecture demarree. Le film est compte globalement, sans lien avec
// la personne qui l'a lance.
app.post('/api/films/:id/view', requireAuth, (req: any, res) => {
    const film = db.films.find((f: any) => f.id === req.params.id);
    if (!film) return res.status(404).json({ error: 'Film introuvable' });
    const jour = jourActuel();
    ligneDuJour(jour).lectures += 1;
    db.stats.films[film.id] = (db.stats.films[film.id] || 0) + 1;
    saveDb();
    res.json({ success: true });
});

app.get('/api/stats', requireAuth, requireRole(['owner', 'admin']), (req, res) => {
    const jours = Object.keys(db.stats.jours).sort();
    const depuis = (n: number) => {
        const d = new Date();
        d.setDate(d.getDate() - n);
        const seuil = d.toISOString().slice(0, 10);
        return jours.filter((j) => j >= seuil);
    };
    const somme = (liste: string[], champ: 'visiteurs' | 'lectures') =>
        liste.reduce((total, j) => total + (db.stats.jours[j]?.[champ] || 0), 0);
    const maximum = (liste: string[], champ: 'visiteurs' | 'lectures') =>
        liste.reduce((max, j) => Math.max(max, db.stats.jours[j]?.[champ] || 0), 0);

    const jour = jourActuel();
    const topFilms = Object.entries(db.stats.films as Record<string, number>)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id, lectures]) => ({
            titre: db.films.find((f: any) => f.id === id)?.title || 'Film supprimé',
            lectures,
        }));

    res.json({
        aujourdhui: {
            visiteurs: db.stats.jours[jour]?.visiteurs || 0,
            lectures: db.stats.jours[jour]?.lectures || 0,
        },
        septJours: {
            lectures: somme(depuis(7), 'lectures'),
            pointeVisiteurs: maximum(depuis(7), 'visiteurs'),
        },
        trenteJours: {
            lectures: somme(depuis(30), 'lectures'),
            pointeVisiteurs: maximum(depuis(30), 'visiteurs'),
        },
        courbe: depuis(30).map((j) => ({ jour: j, ...db.stats.jours[j] })),
        topFilms,
        membresInscrits: db.users.filter((u: any) => u.status === 'active').length,
    });
});

// ---------- DEJA VU ----------
// Marqueur personnel, stocke sur le compte de chacun : un film vu par
// l'un ne l'est pas pour les autres.
// Marquage automatique : appele par le lecteur quand le film est fini
// (au-dela de 95 %). Ne desactive jamais le marqueur, contrairement a la
// bascule manuelle.
app.post('/api/films/:id/seen-auto', requireAuth, (req: any, res) => {
    const utilisateur = db.users.find((u: any) => u.id === req.user.id);
    const film = db.films.find((f: any) => f.id === req.params.id);
    if (!utilisateur || !film) return res.status(404).json({ error: 'Introuvable' });

    if (!Array.isArray(utilisateur.seenFilms)) utilisateur.seenFilms = [];
    if (!utilisateur.seenFilms.includes(film.id)) {
        utilisateur.seenFilms.push(film.id);
        saveDb();
    }
    res.json({ success: true, seenFilms: utilisateur.seenFilms });
});

app.post('/api/films/:id/seen', requireAuth, express.json(), (req: any, res) => {
    const utilisateur = db.users.find((u: any) => u.id === req.user.id);
    if (!utilisateur) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const film = db.films.find((f: any) => f.id === req.params.id);
    if (!film) return res.status(404).json({ error: 'Film introuvable' });

    if (!Array.isArray(utilisateur.seenFilms)) utilisateur.seenFilms = [];

    const dejaLa = utilisateur.seenFilms.includes(film.id);
    utilisateur.seenFilms = dejaLa
        ? utilisateur.seenFilms.filter((id: string) => id !== film.id)
        : [...utilisateur.seenFilms, film.id];

    saveDb();
    res.json({ success: true, seen: !dejaLa, seenFilms: utilisateur.seenFilms });
});

// Affichage du marqueur : preference personnelle, active par defaut.
app.post('/api/users/me/show-seen', requireAuth, express.json(), (req: any, res) => {
    const utilisateur = db.users.find((u: any) => u.id === req.user.id);
    if (!utilisateur) return res.status(404).json({ error: 'Utilisateur introuvable' });
    utilisateur.showSeenBadge = req.body?.actif !== false;
    saveDb();
    res.json({ success: true, showSeenBadge: utilisateur.showSeenBadge });
});

// ---------- SOUS-TITRES ----------
// Les pistes de sous-titres survivent au transcodage (`-map 0:s?` dans
// worker.ts) mais restent enfermees dans le MP4 en mov_text : aucun
// navigateur ne sait les afficher. On les extrait donc a la demande en
// WebVTT, seul format compris par la balise <track>, et on met le resultat
// en cache pour ne le faire qu'une fois par piste.
const SUBS_DIR = path.join(process.cwd(), 'data', 'subtitles');
if (!fs.existsSync(SUBS_DIR)) fs.mkdirSync(SUBS_DIR, { recursive: true });

const NOMS_LANGUES: Record<string, string> = {
    fre: 'Français', fra: 'Français', fr: 'Français',
    eng: 'Anglais', en: 'Anglais',
    spa: 'Espagnol', es: 'Espagnol',
    ger: 'Allemand', deu: 'Allemand', de: 'Allemand',
    ita: 'Italien', it: 'Italien',
    dut: 'Néerlandais', nld: 'Néerlandais', nl: 'Néerlandais',
    por: 'Portugais', pt: 'Portugais',
    jpn: 'Japonais', ja: 'Japonais',
    ara: 'Arabe', ar: 'Arabe',
};

// Code BCP-47 pour l'attribut srclang de <track>.
const codeCourt = (langue: string): string => {
    const l = (langue || '').toLowerCase();
    if (l.startsWith('fr')) return 'fr';
    if (l.startsWith('en') || l === 'eng') return 'en';
    if (l.startsWith('sp') || l === 'spa' || l === 'es') return 'es';
    if (l.startsWith('ge') || l === 'deu' || l === 'de') return 'de';
    if (l.startsWith('it')) return 'it';
    if (l.startsWith('du') || l === 'nld' || l === 'nl') return 'nl';
    if (l.startsWith('po') || l === 'pt') return 'pt';
    return l.slice(0, 2) || 'und';
};

const listerSousTitres = (cheminVideo: string): Promise<Array<{ index: number; langue: string; titre: string }>> => {
    return new Promise((resolve) => {
        execFile('ffprobe', [
            '-v', 'error',
            '-select_streams', 's',
            '-show_entries', 'stream=index:stream_tags=language,title',
            '-of', 'json', cheminVideo
        ], (err, stdout) => {
            if (err || !stdout) return resolve([]);
            try {
                const data = JSON.parse(stdout);
                const pistes = (data.streams || []).map((flux: any, position: number) => ({
                    // `position` est l'indice PARMI les sous-titres (0:s:N),
                    // pas l'indice global du flux dans le fichier.
                    index: position,
                    langue: flux.tags?.language || 'und',
                    titre: flux.tags?.title || '',
                }));
                resolve(pistes);
            } catch {
                resolve([]);
            }
        });
    });
};

app.get('/api/films/:id/subtitles', requireAuth, async (req, res) => {
    const film = db.films.find((f: any) => f.id === req.params.id);
    if (!film || !film.filename) return res.json([]);

    const cheminVideo = resolveVideoPath(path.basename(film.filename));
    if (!cheminVideo) return res.json([]);

    try {
        const pistes = await listerSousTitres(cheminVideo);
        res.json(pistes.map((p) => ({
            index: p.index,
            srclang: codeCourt(p.langue),
            label: p.titre || NOMS_LANGUES[p.langue.toLowerCase()] || p.langue.toUpperCase(),
            url: `/api/films/${film.id}/subtitles/${p.index}.vtt`,
        })));
    } catch (e) {
        console.error('Subtitles list error', e);
        res.json([]);
    }
});

app.get('/api/films/:id/subtitles/:index.vtt', requireAuth, async (req: any, res) => {
    const film = db.films.find((f: any) => f.id === req.params.id);
    if (!film || !film.filename) return res.status(404).send('Film introuvable');

    const index = parseInt(req.params.index, 10);
    if (!Number.isInteger(index) || index < 0 || index > 30) return res.status(400).send('Piste invalide');

    const cheminVideo = resolveVideoPath(path.basename(film.filename));
    if (!cheminVideo) return res.status(404).send('Fichier introuvable');

    const cache = path.join(SUBS_DIR, `${film.id}_${index}.vtt`);

    const envoyer = () => {
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        fs.createReadStream(cache).pipe(res);
    };

    if (fs.existsSync(cache) && fs.statSync(cache).size > 0) return envoyer();

    // Extraction ponctuelle : quelques secondes, une seule fois par piste.
    execFile('ffmpeg', [
        '-y', '-i', cheminVideo,
        '-map', `0:s:${index}`,
        '-c:s', 'webvtt',
        '-f', 'webvtt', cache
    ], { timeout: 120000 }, (err) => {
        if (err || !fs.existsSync(cache) || fs.statSync(cache).size === 0) {
            console.error(`[Subs] Extraction impossible pour ${film.id} piste ${index}`, err?.message);
            try { if (fs.existsSync(cache)) fs.unlinkSync(cache); } catch {}
            return res.status(404).send('Piste non extractible');
        }
        console.log(`[Subs] Piste ${index} extraite pour "${film.title}"`);
        envoyer();
    });
});

// Corriger la correspondance TMDB d'un film deja importe (A_FAIRE : mauvaise
// association detectee trop tard, ex. "Inferno" qui tombait sur un film
// d'horreur). Reecrit titre, affiche, synopsis, annee, genres, casting et
// realisateur a partir du tmdbId choisi. Ne touche pas au fichier video.
app.post('/api/films/:id/relink', requireAuth, requireRole(['owner', 'admin', 'technician']), express.json(), async (req: any, res) => {
    const film = db.films.find((f: any) => f.id === req.params.id);
    if (!film) return res.status(404).json({ error: "Film introuvable" });

    const tmdbId = req.body?.tmdbId;
    if (!tmdbId) return res.status(400).json({ error: "tmdbId manquant" });

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return res.status(400).json({ error: "Clé API TMDB non configurée" });

    try {
        const reponse = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&language=fr-FR&append_to_response=credits`);
        if (!reponse.ok) return res.status(404).json({ error: "Fiche TMDB introuvable" });
        const meta: any = await reponse.json();

        const ancienTitre = film.title;

        film.tmdbId = meta.id;
        if (meta.title) film.title = meta.title;
        film.posterUrl = meta.poster_path ? `https://image.tmdb.org/t/p/w500${meta.poster_path}` : null;
        film.synopsis = meta.overview || '';
        if (meta.release_date) film.year = parseInt(meta.release_date.split('-')[0]);
        if (meta.runtime) film.runtime = meta.runtime;
        if (Array.isArray(meta.genres) && meta.genres.length > 0) {
            film.genres = meta.genres.map((g: any) => g.name);
            film.genre = film.genres[0]; // Rétrocompatibilité
        }
        if (meta.credits?.cast) {
            film.cast = meta.credits.cast.slice(0, 10).map((c: any) => ({
                name: c.name,
                character: c.character,
                profilePath: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
            }));
        }
        if (meta.credits?.crew) {
            const real = meta.credits.crew.find((c: any) => c.job === 'Director');
            if (real) film.director = real.name;
        }
        film.modifiedBy = req.user?.name || req.user?.id;

        saveDb();
        console.log(`[Relink] "${ancienTitre}" -> "${film.title}" (TMDB ${meta.id}) par ${film.modifiedBy}`);
        res.json({ success: true, film });
    } catch (err: any) {
        console.error("Relink error", err);
        res.status(500).json({ error: "Erreur lors de la correction de la fiche" });
    }
});

// Envoi des vidéos par paquets de 2 Mo : permet la barre de progression et
// l'annulation, et évite de faire transiter plusieurs gigaoctets en une requête.
app.post('/api/films/upload-chunk', requireAuth, upload.single('chunk'), async (req: any, res) => {
    const { uploadId, chunkIndex } = req.body;
    const chunkFile = req.file;

    console.log(`[Upload] Réception d'un chunk pour l'upload ${uploadId}...`);

    if (!uploadId || !chunkFile || chunkIndex === undefined) {
        console.error(`[Upload] Données manquantes pour le chunk de ${uploadId}`);
        return res.status(400).json({ error: 'Données manquantes' });
    }

    const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeUploadId) {
        console.error(`[Upload] ID invalide : ${uploadId}`);
        return res.status(400).json({ error: 'ID invalide' });
    }

    const targetPath = path.join(UPLOADS_DIR, `temp_${safeUploadId}_${chunkIndex}`);

    try {
        fs.renameSync(chunkFile.path, targetPath);
        console.log(`[Upload] Chunk sauvegardé à ${targetPath}`);
        res.json({ success: true });
    } catch (e) {
        console.error("[Upload] Erreur de chunk:", e);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Erreur écriture chunk' });
    }
});

app.post('/api/films/upload-cancel', requireAuth, express.json(), (req: any, res) => {
    const { uploadId } = req.body;
    if (!uploadId) return res.status(400).json({ error: 'ID manquant' });
    const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
    
    console.log(`[Upload] Annulation de l'upload ${safeUploadId}`);
    try {
        const files = fs.readdirSync(UPLOADS_DIR);
        for (const file of files) {
            if (file.startsWith(`temp_${safeUploadId}`)) {
                fs.unlinkSync(path.join(UPLOADS_DIR, file));
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error("Erreur nettoyage upload:", e);
        res.status(500).json({ error: 'Erreur nettoyage' });
    }
});

app.post('/api/films/upload-finalize', requireAuth, express.json(), async (req: any, res) => {
    const body = req.body;
    const { uploadId, filename, originalName, totalChunks } = body;

    console.log(`[Upload] Requête finalize reçue pour uploadId: ${uploadId}`);

    if (!uploadId || !filename || !totalChunks) {
        console.error(`[Upload] Échec finalize: données manquantes pour ${uploadId}`);
        return res.status(400).json({ error: 'Données manquantes' });
    }

    const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeUploadId) return res.status(400).json({ error: 'ID invalide' });

    const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const finalFilename = `${Date.now()}_${safeName}`;
    const finalPath = path.join(UPLOADS_DIR, finalFilename);

    console.log(`[Upload] Construction du fichier final: ${finalPath}`);

    try {
        // Assembler les chunks
        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(UPLOADS_DIR, `temp_${safeUploadId}_${i}`);
            if (!fs.existsSync(chunkPath)) {
                 console.error(`[Upload] Chunk introuvable: ${chunkPath}`);
                 if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath); // Nettoyer
                 return res.status(400).json({ error: `Fichier temporaire (chunk ${i}) introuvable` });
            }
            await new Promise((resolve, reject) => {
                const rs = fs.createReadStream(chunkPath);
                const ws = fs.createWriteStream(finalPath, { flags: 'a' });
                rs.pipe(ws);
                rs.on('error', reject);
                ws.on('error', reject);
                ws.on('finish', () => resolve(null));
            });
            fs.unlinkSync(chunkPath); // Nettoyer le chunk une fois écrit
        }
        console.log(`[Upload] Fichier final généré avec succès: ${finalFilename}`);

        const metadata = typeof body.metadata === 'string' ? JSON.parse(body.metadata || '{}') : (body.metadata || {});
        const genreIds = metadata.genre_ids || [];
        const mainGenre = genreIds.length > 0 ? (TMDB_GENRES[genreIds[0]] || 'Autre') : 'Autre';
        const allGenres = genreIds.map((id: number) => TMDB_GENRES[id] || 'Autre').filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);

        let castData: any[] = [];
        let directorData = 'Vérifié par TMDB';
        let runtimeData: number | undefined = undefined;
        let finalGenres = allGenres;

        if (metadata.id && process.env.TMDB_API_KEY) {
            try {
                const creditsRes = await fetch(`https://api.themoviedb.org/3/movie/${metadata.id}?api_key=${process.env.TMDB_API_KEY}&language=fr-FR&append_to_response=credits`);
                const fullMeta = await creditsRes.json();
                
                if (fullMeta.runtime) {
                    runtimeData = fullMeta.runtime;
                }
                
                if (fullMeta.genres && Array.isArray(fullMeta.genres)) {
                    finalGenres = fullMeta.genres.map((g: any) => g.name);
                }

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

        const filmData = {
            id: uuidv4(),
            tmdbId: metadata.id,
            title: metadata.title || 'Inconnu',
            synopsis: metadata.overview || '',
            year: metadata.release_date ? parseInt(metadata.release_date.split('-')[0]) : new Date().getFullYear(),
            genre: mainGenre,
            genres: finalGenres.length > 0 ? finalGenres : [mainGenre],
            director: directorData,
            cast: castData,
            duration: runtimeData ? `${runtimeData}m` : '~120m',
            runtime: runtimeData,
            versionType: body.versionType || undefined,
            posterUrl: metadata.poster_path ? `https://image.tmdb.org/t/p/w500${metadata.poster_path}` : undefined,
            addedBy: body.user || 'Unknown',
            addedAt: new Date().toISOString(),
            filename: finalFilename,
            originalName: originalName || filename,
            // Toujours en preparation au depart, meme en .mp4 : la verification
            // ci-dessous le met en ligne aussitot s'il est lisible partout.
            status: 'PROCESSING'
        };

        const existingFilmIndex = db.films.findIndex(f => f.tmdbId && f.tmdbId === metadata.id);
        
        let film: any = null;
        if (existingFilmIndex !== -1) {
            // Update existant
            const oldFilm = db.films[existingFilmIndex];
            if (oldFilm.filename) {
                const oldPath = path.join(UPLOADS_DIR, oldFilm.filename);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            filmData.id = oldFilm.id;
            filmData.addedAt = oldFilm.addedAt;
            if (oldFilm.genreOverride) {
                filmData.genre = oldFilm.genreOverride;
                (filmData as any).genreOverride = oldFilm.genreOverride;
            }
            db.films[existingFilmIndex] = filmData;
            film = filmData;
            console.log(`[Upload] Film mis à jour : ${film.title}`);
        } else {
            film = filmData;
            db.films.push(film);
            
            if (!db.notifications) db.notifications = [];
            const notifMessage = `🎬 Nouveau film ajouté : ${film.title}`;
            db.notifications.push({
                id: uuidv4(),
                type: 'upload',
                message: notifMessage,
                createdAt: new Date().toISOString(),
                readBy: []
            });

            if (db.settings && db.settings.webhookUrl) {
                try {
                    fetch(db.settings.webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: notifMessage })
                    }).catch(e => console.error("Discord webhook failed", e));
                } catch (e) {}
            }
        }
        
        saveDb();

        // On attend le verdict (une simple lecture d'en-tetes par ffprobe) pour
        // pouvoir annoncer un delai exact a celui qui vient d'envoyer le film.
        // Tous les fichiers passent par la verification, .mp4 compris : l'extension
        // ne dit rien du contenu. Jusqu'ici, un .mp4 etait mis en ligne sans
        // examen, et un film en HEVC ou avec un son AC-3 ne se lisait que chez
        // une partie des membres.
        let traitement: 'immediat' | 'rapide' | 'nuit' = 'nuit';
        try {
            traitement = await enqueueTranscode(film.id, finalFilename);
        } catch (e) {
            console.error("Enqueue transcode error", e);
        }

        const reloadedFilm = db.films.find((f: any) => f.id === film.id) || film;
        res.json({ success: true, film: reloadedFilm, traitement });
    } catch (e) {
        console.error("Upload finalize error", e);
        res.status(500).json({ error: 'Internal upload finalize error' });
    }
});

app.post('/api/films/:id/replace-finalize', requireAuth, requireRole(['owner', 'admin', 'technician']), express.json(), async (req: any, res) => {
    const { uploadId, filename, originalName, totalChunks } = req.body;
    const filmId = req.params.id;

    if (!uploadId || !filename || !totalChunks) {
        return res.status(400).json({ error: 'Données manquantes' });
    }

    const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const finalFilename = `${Date.now()}_${safeName}`;
    const finalPath = path.join(UPLOADS_DIR, finalFilename);

    const filmIndex = db.films.findIndex((f: any) => f.id === filmId);
    if (filmIndex === -1) {
        return res.status(404).json({ error: "Film non trouvé" });
    }
    const oldFilm = db.films[filmIndex];

    try {
        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(UPLOADS_DIR, `temp_${safeUploadId}_${i}`);
            if (!fs.existsSync(chunkPath)) {
                 if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
                 return res.status(400).json({ error: `Chunk ${i} introuvable` });
            }
            await new Promise((resolve, reject) => {
                const rs = fs.createReadStream(chunkPath);
                const ws = fs.createWriteStream(finalPath, { flags: 'a' });
                rs.pipe(ws);
                rs.on('error', reject);
                ws.on('error', reject);
                ws.on('finish', () => resolve(null));
            });
            fs.unlinkSync(chunkPath);
        }

        if (oldFilm.filename) {
            const oldPath = path.join(UPLOADS_DIR, oldFilm.filename);
            if (fs.existsSync(oldPath)) {
                try { fs.unlinkSync(oldPath); } catch (e) {}
            }
        }

        // L'ancienne version de secours correspond a l'ancien fichier.
        supprimerVersionSecours(oldFilm);
        oldFilm.filename = finalFilename;
        oldFilm.originalName = originalName || filename;
        oldFilm.status = 'PROCESSING'; // la verification ci-dessous le remet en ligne s'il est lisible partout
        oldFilm.modifiedBy = req.user.name || req.user.username;
        oldFilm.modifiedById = req.user.id;
        oldFilm.modifiedAt = new Date().toISOString();

        saveDb();
        
        try {
            await enqueueTranscode(oldFilm.id, finalFilename);
        } catch (e) {
            console.error("Enqueue transcode error (remplacement)", e);
        }

        res.json({ success: true, film: oldFilm });
    } catch (e) {
        console.error("Erreur replace-finalize:", e);
        res.status(500).json({ error: 'Erreur interne' });
    }
});

// Un navigateur qui ne lit pas le MP4 standard demande la version de secours.
// Tout membre connecte peut la demander : elle n'est fabriquee qu'une fois par
// film, et une nouvelle demande apres un echec relance l'encodage.
app.post('/api/films/:id/webm', requireAuth, async (req: any, res) => {
    const film = db.films.find((f: any) => f.id === req.params.id);
    if (!film) return res.status(404).json({ error: 'Film non trouvé' });

    const statut = film.webm?.statut;
    if (statut === 'pret' && film.webm.fichier && resolveVideoPath(path.basename(film.webm.fichier))) {
        return res.json({ statut: 'pret', fichier: film.webm.fichier });
    }
    if (statut === 'attente') {
        // Peut-etre en attente au fond du lot : on le fait passer devant.
        try { await mettreEnFileSecours(film, PRIORITE_DEMANDE); } catch (e) { console.error('[Webm] Priorité inchangée :', e); }
        return res.json({ statut: 'attente' });
    }
    if (!film.filename || !resolveVideoPath(path.basename(film.filename))) {
        return res.status(404).json({ error: "Le fichier vidéo de ce film est introuvable sur le serveur." });
    }

    film.webm = { statut: 'attente', demandeLe: Date.now() };
    saveDb();
    try {
        await mettreEnFileSecours(film, PRIORITE_DEMANDE);
        console.log(`[Webm] Version de secours demandée pour "${film.title}".`);
        res.json({ statut: 'attente' });
    } catch (e) {
        console.error('[Webm] Mise en file impossible :', e);
        film.webm = { statut: 'erreur', demandeLe: film.webm.demandeLe };
        saveDb();
        res.status(500).json({ error: "Impossible de lancer la préparation." });
    }
});

// Preparation d'avance des versions de secours de toute la bibliotheque.
// L'espace disque est verifie AVANT : une version de secours pese a peu pres
// comme l'original, et un disque plein ferait echouer les envois et les
// conversions de tous les films.
const etatVersionsSecours = () => {
    const enLigne = (db.films || []).filter((f: any) =>
        f.status === 'AVAILABLE' && f.filename && resolveVideoPath(path.basename(f.filename)));
    const aFaire = enLigne.filter((f: any) => f.webm?.statut !== 'pret' && f.webm?.statut !== 'attente');
    let tailleAFaire = 0;
    for (const f of aFaire) {
        try { tailleAFaire += fs.statSync(resolveVideoPath(path.basename(f.filename)) as string).size; } catch (e) {}
    }
    let libre: number | null = null;
    try {
        const disque = fs.statfsSync(UPLOADS_DIR);
        libre = disque.bavail * disque.bsize;
    } catch (e) {
        console.error('[Webm] Espace libre impossible à mesurer :', e);
    }
    return {
        aFaire,
        resume: {
            total: enLigne.length,
            prets: enLigne.filter((f: any) => f.webm?.statut === 'pret').length,
            enAttente: enLigne.filter((f: any) => f.webm?.statut === 'attente').length,
            aFaire: aFaire.length,
            dureeAFaireMinutes: aFaire.reduce((t: number, f: any) => t + (Number(f.runtime) || 0), 0),
            tailleAFaire,
            libre,
            // Marge de 10 % : on ne remplit pas le disque a ras bord.
            suffisant: libre !== null && libre > tailleAFaire * 1.1,
        },
    };
};

app.get('/api/admin/versions-secours', requireAuth, requireRole(['owner']), (req: any, res) => {
    res.json(etatVersionsSecours().resume);
});

app.post('/api/admin/versions-secours', requireAuth, requireRole(['owner']), async (req: any, res) => {
    const { aFaire, resume } = etatVersionsSecours();
    if (resume.aFaire === 0) {
        return res.json({ ...resume, lances: 0 });
    }
    if (resume.libre === null) {
        return res.status(409).json({ ...resume, error: "L'espace libre du disque n'a pas pu être mesuré : rien n'a été lancé." });
    }
    if (!resume.suffisant) {
        return res.status(409).json({ ...resume, error: "Pas assez d'espace libre sur le disque : rien n'a été lancé." });
    }
    let lances = 0;
    for (const film of aFaire) {
        try {
            film.webm = { statut: 'attente', demandeLe: Date.now() };
            await mettreEnFileSecours(film, PRIORITE_LOT);
            lances++;
        } catch (e) {
            console.error(`[Webm] Mise en file impossible pour "${film.title}" :`, e);
            delete film.webm;
        }
    }
    saveDb();
    console.log(`[Webm] Préparation d'avance lancée pour ${lances} film(s).`);
    res.json({ ...etatVersionsSecours().resume, lances });
});

// Bouton "Convertir" du lecteur. Il manquait requireAuth : sans lui, le serveur
// ne sait pas qui appelle et requireRole refusait toujours. Le bouton affichait
// pourtant "demande envoyee" sans lire la reponse — il n'a jamais rien converti.
app.post('/api/films/:id/remux', requireAuth, requireRole(['owner', 'admin', 'technician']), async (req: any, res) => {
    const film = db.films.find((f: any) => f.id === req.params.id);
    if (!film) return res.status(404).json({ error: 'Film non trouvé' });
    if (!film.filename || !resolveVideoPath(path.basename(film.filename))) {
        return res.status(404).json({ error: "Le fichier vidéo de ce film est introuvable sur le serveur." });
    }
    try {
        const verdict = await enqueueTranscode(film.id, film.filename, film.status === 'AVAILABLE');
        const message = verdict === 'immediat'
            ? "Ce fichier est déjà lisible sur tous les navigateurs : le problème vient d'ailleurs."
            : verdict === 'rapide'
                ? "Conversion lancée. Le film sera lisible partout d'ici quelques minutes."
                : "Conversion lancée. La vidéo doit être entièrement réencodée : ce sera fait cette nuit.";
        res.json({ success: true, verdict, message });
    } catch (e) {
        console.error("Remux enqueue error", e);
        res.status(500).json({ error: "Impossible de lancer la conversion." });
    }
});

app.get('/api/films/transcoding-status', requireAuth, async (req, res) => {
    try {
        const activeJobs = await transcodeQueue.getActive();
        const waitingJobs = await transcodeQueue.getWaiting();
        const fastActiveJobs = await transcodeFastQueue.getActive();
        const fastWaitingJobs = await transcodeFastQueue.getWaiting();
        
        const tasks: Record<string, any> = {};
        
        // On distingue les deux files : la rapide tourne en permanence, la
        // nocturne n'est active que de 01h00 a 06h45. L'interface peut ainsi
        // annoncer le bon delai au lieu de parler de nuit dans tous les cas.
        const marquer = (job: any, state: string, file: 'rapide' | 'nuit') => {
            const base = job.progress && typeof job.progress === 'object' ? job.progress : { progress: 0, etaSeconds: null };
            tasks[job.data.filmId] = { ...base, state, file };
        };
        for (const job of activeJobs) marquer(job, 'active', 'nuit');
        for (const job of fastActiveJobs) marquer(job, 'active', 'rapide');
        for (const job of waitingJobs) tasks[job.data.filmId] = { progress: 0, etaSeconds: null, state: 'waiting', file: 'nuit' };
        for (const job of fastWaitingJobs) tasks[job.data.filmId] = { progress: 0, etaSeconds: null, state: 'waiting', file: 'rapide' };
        res.json(tasks);
    } catch (e) {
        // Fallback for dev mode without redis
        res.json({});
    }
});

// Distribution des vidéos (lecture par plages, pour pouvoir avancer dans le film)
app.get('/videos/:filename', requireAuth, (req, res) => {
    const safeName = path.basename(req.params.filename);
    const videoPath = resolveVideoPath(safeName);

    console.log(`[VIDEO] Demande: ${safeName} | chemin: ${videoPath} | existe: ${!!videoPath}`);

    if (!videoPath) return res.status(404).send('Playable video not found.');

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    let contentType = 'video/mp4';
    if (safeName.toLowerCase().endsWith('.mkv')) contentType = 'video/x-matroska';
    if (safeName.toLowerCase().endsWith('.webm')) contentType = 'video/webm';

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] && parts[1] !== "" ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
    }
});


// Force Download Route
app.get('/api/download/:filmId', requireAuth, async (req: any, res) => {
    const filmId = req.params.filmId;
    
    const films = db.films || [];
    
    const film = films.find((f: any) => f.id === filmId);
    if (!film) return res.status(404).json({ error: 'Film non trouvé' });

    const safeName = path.basename(film.filename || '');
    const filePath = resolveVideoPath(safeName);
    
    if (filePath) {
        res.download(filePath, film.originalName || safeName);
    } else {
        res.status(404).json({ error: 'Fichier source introuvable' });
    }
});


// Marque en ERROR tous les films dont le fichier a disparu du disque.
// Ils cessent ainsi d'etre proposes a la lecture, ce qui evite le lecteur
// bloque a 00:00 devant un fichier inexistant.
app.post('/api/admin/reparer-fichiers', requireAuth, requireRole(['owner', 'admin']), (req, res) => {
    const films = db.films || [];
    const repares: any[] = [];

    films.forEach((film: any) => {
        if (film.status === 'AVAILABLE' && film.filename) {
            const safeName = path.basename(film.filename);
            const trouve = [UPLOADS_DIR, FILMS_DIR].some((dir) => fs.existsSync(path.join(dir, safeName)));
            if (!trouve) {
                film.status = 'ERROR';
                film.errorReason = 'Fichier introuvable sur le serveur';
                repares.push({ id: film.id, title: film.title, filename: film.filename });
            }
        }
    });

    if (repares.length > 0) saveDb();
    console.log(`[REPARATION] ${repares.length} film(s) marque(s) comme indisponible(s).`);
    res.json({ count: repares.length, films: repares });
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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur CinéPrivé lancé sur le port ${PORT}`);
  });
  
  // Désactive les timeouts pour les gros uploads
  server.setTimeout(0);
}

startServer();
