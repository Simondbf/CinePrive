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
import { createProxyMiddleware } from 'http-proxy-middleware';
import { exec, spawn, execFile } from 'child_process';
import nodemailer from 'nodemailer';

const app = express();
app.set('trust proxy', 1);
const PORT = 3000;

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
app.use(cookieParser());

app.use('/api', (req, res, next) => {
    let ipStr = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress || 'unknown';
    if (Array.isArray(ipStr)) ipStr = ipStr[0];
    const ip = typeof ipStr === 'string' ? ipStr.split(',')[0].trim() : 'unknown';
    console.log(`[HTTP] ${ip} - ${req.method} ${req.url}`);
    next();
});

let JWT_SECRET = process.env.JWT_SECRET || 'cineprive_super_secret_dev_key';

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

const verificationCodes: Record<string, { code: string, expires: number, targetId: string, operation: string }> = {};

async function sendSecurityCodeEmail(email: string, name: string, code: string, operationLabel: string) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const fromName = process.env.SMTP_FROM_NAME || 'CinéPrivé Sécurité';
    const fromAddress = process.env.SMTP_FROM_EMAIL || 'security@cineprive.rpisimon.uk';

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
    const fromAddress = process.env.SMTP_FROM_EMAIL || 'security@cineprive.rpisimon.uk';

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

// Configuration des téléchargements Chunkés
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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
        
    // Migration of old statuses to new statuses
    let migrated = false;
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
            { id: 'o1', label: 'cineprive.rpisimon.uk me convient très bien' },
            { id: 'o2', label: 'Je préfèrerais un format plus court (ex: film.rpisimon.uk)' },
            { id: 'o3', label: 'Il faudrait un vrai domaine professionnel (.com, .fr)' }
        ]
    }
];

// Fusionner les sondages par défaut s'ils manquent (ex: nouveau sondage ajouté dans le code)
defaultPolls.forEach(defaultPoll => {
    if (!db.pollsConfig.find((p: any) => p.id === defaultPoll.id)) {
        db.pollsConfig.push(defaultPoll);
    }
});

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
            if (film) {
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

const checkIsH264 = (inputPath: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
        execFile('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'default=noprint_wrappers=1:nokey=1', inputPath], (err, stdout) => {
             resolve((stdout || '').trim().toLowerCase() === 'h264');
        });
    });
};

export const enqueueTranscode = async (filmId: string, inputFilename: string) => {
    try {
        await transcodeQueue.remove(filmId);
        await transcodeFastQueue.remove(filmId);
    } catch(e) {}

    const inputPath = path.join(UPLOADS_DIR, inputFilename);
    const isH264 = await checkIsH264(inputPath);

    if (isH264) {
        console.log(`[Queue] Remuxing rapide détecté (H264). Ajout à la file rapide (qui n'est jamais en pause).`);
        await transcodeFastQueue.add(
            'transcode-job', 
            { filmId, inputFilename }, 
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
            { filmId, inputFilename }, 
            { 
                jobId: `${filmId}_${Date.now()}`,
                removeOnComplete: { age: 3600 },
                removeOnFail: 50
            }
        );
    }
    console.log(`[Queue] Job ajouté à BullMQ pour le film ID: ${filmId}`);
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
    if (req.user.role === 'owner') {
        settings.webhookUrl = db.settings?.webhookUrl || '';
        settings.securityCode = db.settings?.securityCode || '000000';
    } else if (req.user.role === 'admin') {
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
    if (req.user.role === 'owner' || req.user.role === 'admin') {
        if (req.body.webhookUrl !== undefined) {
            db.settings.webhookUrl = req.body.webhookUrl;
        }
    }
    if (req.user.role === 'owner') {
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
    if (req.user.role === 'owner') {
        responseSettings.webhookUrl = db.settings.webhookUrl || '';
        responseSettings.securityCode = db.settings.securityCode || '';
    } else if (req.user.role === 'admin') {
        responseSettings.webhookUrl = db.settings.webhookUrl || '';
    }
    res.json(responseSettings);
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
app.get('/api/users', requireAuth, requireRole(['owner', 'admin']), (req, res) => {
    // Ne renvoyer que les données non sensibles (pas le mot de passe)
  res.json(db.users.map((u: any) => ({ ...u, password: '' })));
});

app.post('/api/register', async (req, res) => {
    const { username, password, email, name, inviteCode, rememberMe } = req.body;
    
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
    let ipStr = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress || 'unknown';
    if (Array.isArray(ipStr)) ipStr = ipStr[0];
    const ip = typeof ipStr === 'string' ? ipStr.split(',')[0].trim() : 'unknown';
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
            if (user.status === 'pending') {
                return res.status(403).json({ error: "Votre compte est en attente d'approbation par le Patron." });
            }
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

app.post('/api/users/:id/restore', requireAuth, requireRole(['owner', 'admin']), (req: any, res) => {
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

app.delete('/api/users/:id', requireAuth, requireRole(['owner']), (req: any, res) => {
    const { id } = req.params;
    const targetUser = db.users.find((u: any) => u.id === id);
    if (!targetUser) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    
    if (targetUser.role === 'owner') {
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
app.get('/api/films', requireAuth, async (req: any, res) => {
  let filmsList = db.films || [];
  
  // Masquer les films en attente de suppression définitive ou en quarantaine pour les membres réguliers
  if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      filmsList = filmsList.filter((f: any) => !f.pendingDeletion && !f.isQuarantined);
  }

  // Masquer la clé JELLYFIN_API_KEY des posterUrls pour les films existants
  const sanitizedFilms = filmsList.map((f: any) => {
    let sanitizedF = { ...f };
    const creator = db.users.find((u: any) => u.id === f.addedBy);
    if (creator) {
        sanitizedF.addedBy = creator.name || creator.username;
    }

    if (sanitizedF.posterUrl && sanitizedF.posterUrl.includes('?api_key=')) {
      const parts = sanitizedF.posterUrl.split('/Items/');
      if (parts.length > 1) {
        const itemId = parts[1].split('/')[0];
        sanitizedF.posterUrl = `/api/jellyfin/image/${itemId}`;
      }
    }

    if (req.user.role !== 'owner' && req.user.role !== 'admin' && req.user.role !== 'technician') {
        delete sanitizedF.originalName;
        delete sanitizedF.jellyfinId;
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
    if (film.filename && !film.jellyfinId) {
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
    
    db.films.splice(filmIndex, 1);
    
    if (db.progress) {
        delete db.progress[id];
    }
    
    saveDb();
    res.json({ success: true, deleted: true, message: `Le film "${film.title}" a été supprimé définitivement.` });
});

app.post('/api/jellyfin/sync', requireAuth, requireRole(['owner']), async (req, res) => {
    if (!process.env.JELLYFIN_URL || !process.env.JELLYFIN_API_KEY) {
        return res.status(400).json({ error: "Jellyfin n'est pas configuré" });
    }
    
    try {
        // 1. Récupérer les utilisateurs pour trouver l'admin (les clés API globales sont souvent rattachées à un utilisateur)
        const usersResp = await fetch(`${process.env.JELLYFIN_URL}/Users`, {
            headers: { 'X-Emby-Authorization': `MediaBrowser Token="${process.env.JELLYFIN_API_KEY}"` }
        });
        const users = await usersResp.json();
        const admin = users.find((u: any) => u.Policy.IsAdministrator);
        
        if (!admin) return res.status(500).json({ error: "Administrateur Jellyfin introuvable" });

        // 2. Fetch les items récursivement
        const itemsResp = await fetch(`${process.env.JELLYFIN_URL}/Users/${admin.Id}/Items?Recursive=true&IncludeItemTypes=Movie,Series,Video&Fields=Path,Overview,PremiereDate,Genres,Studios`, {
            headers: { 'X-Emby-Authorization': `MediaBrowser Token="${process.env.JELLYFIN_API_KEY}"` }
        });
        const itemsData = await itemsResp.json();
        
        let addedCount = 0;
        
        itemsData.Items.forEach((item: any) => {
            // Check si on a déjà ce film
            const existing = db.films.find((f: any) => f.jellyfinId === item.Id);
            if (!existing) {
                const isSeries = item.Type === "Series";
                db.films.push({
                    id: 'jf_' + item.Id,
                    jellyfinId: item.Id,
                    title: item.Name,
                    synopsis: item.Overview || 'Aucun synopsis disponible.',
                    year: item.PremiereDate ? new Date(item.PremiereDate).getFullYear() : new Date().getFullYear(),
                    genre: item.Genres && item.Genres.length > 0 ? item.Genres[0] : (isSeries ? 'Série' : 'Film'),
                    director: isSeries ? 'Série' : 'Jellyfin',
                    duration: isSeries ? (item.RunTimeTicks ? Math.floor(item.RunTimeTicks / 600000000) + ' min par ep.' : 'Série TV') : (item.RunTimeTicks ? Math.floor(item.RunTimeTicks / 600000000) + ' min' : 'Inconnu'),
                    posterUrl: `/api/jellyfin/image/${item.Id}`,
                    addedBy: 'Admin',
                    addedAt: new Date().toISOString(),
                    filename: '',
                    originalName: item.Path || item.Name,
                    status: 'AVAILABLE'
                });
                addedCount++;
            }
        });
        
        saveDb();
        res.json({ success: true, count: addedCount, films: db.films });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Erreur lors de la synchronisation Jellyfin" });
    }
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
app.get('/api/notifications', requireAuth, requireRole(['owner', 'admin']), (req, res) => {
    res.json(db.notifications || []);
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

app.delete('/api/notifications/:id', requireAuth, requireRole(['owner', 'admin']), (req, res) => {
    if (!db.notifications) db.notifications = [];
    db.notifications = db.notifications.filter((n: any) => n.id !== req.params.id);
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
        const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=fr-FR&include_adult=false`);
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

// Upload Video par paquets (Chunking pour contourner Cloudflare)
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

        const isMp4 = finalFilename.toLowerCase().endsWith('.mp4');

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
            status: isMp4 ? 'AVAILABLE' : 'PROCESSING'
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

        if (!isMp4) {
            // Ajout à la file d'attente
            enqueueTranscode(film.id, finalFilename);
        }

        const reloadedFilm = db.films.find((f: any) => f.id === film.id) || film;
        res.json({ success: true, film: reloadedFilm });
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

        const isMp4 = finalFilename.toLowerCase().endsWith('.mp4');

        if (oldFilm.filename) {
            const oldPath = path.join(UPLOADS_DIR, oldFilm.filename);
            if (fs.existsSync(oldPath)) {
                try { fs.unlinkSync(oldPath); } catch (e) {}
            }
        }

        oldFilm.filename = finalFilename;
        oldFilm.originalName = originalName || filename;
        oldFilm.status = isMp4 ? 'AVAILABLE' : 'PROCESSING';
        oldFilm.modifiedBy = req.user.name || req.user.username;
        oldFilm.modifiedById = req.user.id;
        oldFilm.modifiedAt = new Date().toISOString();

        saveDb();
        
        if (!isMp4) {
            enqueueTranscode(oldFilm.id, finalFilename);
        }

        res.json({ success: true, film: oldFilm });
    } catch (e) {
        console.error("Erreur replace-finalize:", e);
        res.status(500).json({ error: 'Erreur interne' });
    }
});

app.post('/api/films/:id/remux', requireRole(['owner', 'admin', 'technician']), (req: any, res) => {
    const film = db.films.find((f: any) => f.id === req.params.id);
    if (!film) return res.status(404).json({ error: 'Film non trouvé' });
    
    // Only transcode if it's an MKV and not already MP4
    if (film.filename && film.filename.toLowerCase().endsWith('.mkv')) {
        res.json({ success: true, message: 'Fichier ajouté à la file de transcodage' });
        // Enqueue the task
        enqueueTranscode(film.id, film.filename);
    } else {
        res.json({ success: false, message: 'Ce format n\'a pas besoin de conversion ou est déjà en MP4' });
    }
});

app.get('/api/films/transcoding-status', requireAuth, async (req, res) => {
    try {
        const activeJobs = await transcodeQueue.getActive();
        const waitingJobs = await transcodeQueue.getWaiting();
        const fastActiveJobs = await transcodeFastQueue.getActive();
        const fastWaitingJobs = await transcodeFastQueue.getWaiting();
        
        const tasks: Record<string, any> = {};
        
        for (const job of [...activeJobs, ...fastActiveJobs]) {
            tasks[job.data.filmId] = job.progress !== undefined && job.progress !== null && typeof job.progress === 'object' 
                ? { ...job.progress, state: 'active' } 
                : { progress: 0, etaSeconds: null, state: 'active' };
        }
        for (const job of [...waitingJobs, ...fastWaitingJobs]) {
            tasks[job.data.filmId] = { progress: 0, etaSeconds: null, state: 'waiting' };
        }
        res.json(tasks);
    } catch (e) {
        // Fallback for dev mode without redis
        res.json({});
    }
});

// Distribution Vidéos Static & Proxy Jellyfin
app.get('/videos/:filename', requireAuth, (req, res) => {
    const safeName = path.basename(req.params.filename);
    const videoPath = path.join(UPLOADS_DIR, safeName);

    if (!fs.existsSync(videoPath)) {
        return res.status(404).send('Playable video not found.');
    }

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

// Phase 3: Route /api/stream/:filmId via Jellyfin API
app.get('/api/stream/:filmId', requireAuth, async (req: any, res, next) => {
    const user = req.user;
    const filmId = req.params.filmId;
    
    // Find film
    const films = db.films || [];
    
    const film = films.find((f: any) => f.id === filmId || (f as any).jellyfinId === filmId);
    if (!film) return res.status(404).json({ error: 'Film non trouvé' });

    if (process.env.JELLYFIN_URL && process.env.JELLYFIN_API_KEY) {
        const jellyfinId = (film as any).jellyfinId || film.id;
        return createProxyMiddleware({
            target: `${process.env.JELLYFIN_URL}/Videos/${jellyfinId}/stream`,
            changeOrigin: true,
            ignorePath: true,
            on: {
                proxyReq: (proxyReq) => {
                    proxyReq.setHeader('X-Emby-Authorization', `MediaBrowser Token="${process.env.JELLYFIN_API_KEY}"`);
                }
            }
        })(req, res, next);
    } else {
        // Fallback local
        const filename = film.filename || film.id;
        return res.redirect(`/videos/${filename}`);
    }
});

// Proxy d'images Jellyfin pour masquer la clé d'API
app.get('/api/jellyfin/image/:itemId', requireAuth, (req: any, res, next) => {
    if (process.env.JELLYFIN_URL && process.env.JELLYFIN_API_KEY) {
        return createProxyMiddleware({
            target: `${process.env.JELLYFIN_URL}/Items/${req.params.itemId}/Images/Primary`,
            changeOrigin: true,
            ignorePath: true,
            on: {
                proxyReq: (proxyReq) => {
                    proxyReq.setHeader('X-Emby-Authorization', `MediaBrowser Token="${process.env.JELLYFIN_API_KEY}"`);
                }
            }
        })(req, res, next);
    } else {
        res.status(404).json({ error: 'Jellyfin non configuré' });
    }
});

// Force Download Route
app.get('/api/download/:filmId', requireAuth, async (req: any, res) => {
    const filmId = req.params.filmId;
    
    const films = db.films || [];
    
    const film = films.find((f: any) => f.id === filmId || (f as any).jellyfinId === filmId);
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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur CinéPrivé lancé sur le port ${PORT}`);
  });
  
  // Désactive les timeouts pour les gros uploads
  server.setTimeout(0);
}

startServer();
