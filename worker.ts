import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import path from 'path';
import { spawn, exec, execFile } from 'child_process';
import fs from 'fs';
import { sonder, estLisiblePartout, videoCopiable } from './compatibilite';

const connection = new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
});

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');
const FILMS_DIR = path.join(process.cwd(), 'data', 'Films');

const parseTimeToSeconds = (timeStr: string) => {
    const parts = timeStr.split(':');
    if (parts.length === 3) {
        return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    }
    return 0;
};

const processJob = async (job: any) => {
    const { filmId, inputFilename } = job.data;
    // Le fichier peut vivre dans uploads/ ou dans Films/ : on le cherche aux deux.
    const inputPath = [UPLOADS_DIR, FILMS_DIR]
        .map((dossier) => path.join(dossier, inputFilename))
        .find((chemin) => fs.existsSync(chemin));
    if (!inputPath) {
        throw new Error(`Fichier introuvable dans uploads/ comme dans Films/ : ${inputFilename}`);
    }
    const ext = path.extname(inputFilename).toLowerCase();

    const flux = await sonder(inputPath);
    if (!flux.video) {
        throw new Error(`Analyse impossible de ${inputFilename} : aucune piste vidéo reconnue.`);
    }

    // Deja lisible par tous les navigateurs : rien a faire.
    if (estLisiblePartout(inputFilename, flux)) {
        console.log(`[Worker] ${inputFilename} est déjà lisible sur tous les navigateurs, aucun traitement.`);
        return { filmId, newFilename: inputFilename };
    }

    // Un .mp4 a convertir ne peut pas etre ecrit sous son propre nom : la sortie
    // ecraserait la source. D'ou le suffixe ".lecture". L'ancien code evitait ce
    // piege en ignorant TOUT .mp4 — y compris ceux dont le contenu (video HEVC ou
    // 10 bits, son AC-3...) n'etait lisible que par une partie des navigateurs.
    const base = path.basename(inputFilename, ext);
    const outputFilename = ext === '.mp4' ? `${base}.lecture.mp4` : `${base}.mp4`;
    const outputPath = path.join(UPLOADS_DIR, outputFilename);

    if (path.resolve(outputPath) === path.resolve(inputPath)) {
        throw new Error(`Sécurité : entrée et sortie identiques (${inputPath}).`);
    }

    console.log(`[Worker] DÉMARRAGE de FFmpeg pour le film ID: ${filmId}...`);
    
    // Check if FFmpeg is installed
    await new Promise((resolve, reject) => {
        exec('ffmpeg -version', (err) => {
            if (err) {
                console.error('[Worker] ffmpeg n\'est pas installé sur ce serveur. Échec.');
                reject(new Error('ffmpeg introuvable'));
            } else {
                resolve(null);
            }
        });
    });

    const totalDuration = await new Promise<number>((resolve) => {
        execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', inputPath], (err, stdout) => {
            resolve(stdout ? parseFloat(stdout) : 0);
        });
    });

    const copierVideo = videoCopiable(flux);
    const audioAction = flux.audio === 'aac' ? 'copy' : 'aac';
    console.log(`[Worker] Analyse : vidéo ${flux.video} (${flux.pixFmt}), audio ${flux.audio || 'aucun'}. Vidéo ${copierVideo ? 'recopiée' : 'réencodée'}, audio ${audioAction === 'copy' ? 'recopié' : 'converti en AAC'}.`);

    try {
        await new Promise((resolve, reject) => {
            // 0:V majuscule = premiere vraie piste video, jamais une jaquette.
            // Le "?" de 0:a? et 0:s? evite l'echec d'un film sans son ou sans sous-titres.
            const communs = ['-y', '-i', inputPath, '-map', '0:V:0', '-map', '0:a?', '-map', '0:s?'];
            const args = copierVideo ? [
                ...communs,
                '-c:v', 'copy',
                '-c:a', audioAction,
                '-c:s', 'mov_text',
                '-movflags', '+faststart',
                outputPath
            ] : [
                ...communs,
                '-threads', '2',
                // yuv420p force le 8 bits : sans lui, une source 10 bits donnait une
                // sortie H.264 10 bits, toujours illisible en navigateur.
                '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
                '-c:a', audioAction,
                '-c:s', 'mov_text',
                '-movflags', '+faststart',
                outputPath
            ];

            const ffmpegProcess = spawn('ffmpeg', args);

            ffmpegProcess.stderr.on('data', async (data) => {
                const output = data.toString();
                const timeMatch = output.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
                
                if (timeMatch && totalDuration > 0) {
                    const currentTime = parseTimeToSeconds(timeMatch[1]);
                    const progress = Math.min(100, Math.round((currentTime / totalDuration) * 100));
                    
                    const speedMatch = output.match(/speed=\s*([\d.]+)x/);
                    let eta = null;
                    if (speedMatch) {
                        const speed = parseFloat(speedMatch[1]);
                        if (speed > 0) {
                            eta = Math.round((totalDuration - currentTime) / speed);
                        }
                    }
                    await job.updateProgress({ progress, etaSeconds: eta });
                }
            });

            ffmpegProcess.on('error', (err) => {
                reject(err);
            });

            ffmpegProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`FFmpeg a échoué avec le code ${code}`));
                } else {
                    resolve(null);
                }
            });
        });

        console.log(`[Worker] SUCCÈS pour le film ID: ${filmId}. Converti en ${outputFilename}`);

        try {
            if (fs.existsSync(outputPath)) {
                const outStat = fs.statSync(outputPath);
                if (outStat.size >= 1024) {
                    if (fs.existsSync(inputPath)) {
                        fs.unlinkSync(inputPath);
                        console.log(`[Worker] Fichier d'origine supprimé de l'espace disque : ${inputFilename}`);
                    }
                } else {
                    console.error(`[Worker] SÉCURITÉ : Fichier de sortie trop petit (${outStat.size} bytes). Original conservé.`);
                }
            }
        } catch (unlinkErr) {
            console.error(`[Worker] Impossible de supprimer l'original ${inputFilename}:`, unlinkErr);
        }

        return { filmId, newFilename: outputFilename };
    } catch (err) {
        if (fs.existsSync(outputPath) && path.resolve(outputPath) !== path.resolve(inputPath)) {
            fs.unlinkSync(outputPath);
        }
        // Le fichier source est CONSERVÉ : il permet de relancer le traitement.
        throw err;
    }
};

// ---------------------------------------------------------------------------
// Version de secours en WebM (video VP9, son Opus), fabriquee a la demande.
//
// Tous les films sont en MP4 H.264/AAC, le format le plus universel. Mais un
// navigateur prive des codecs H.264 et AAC — frequent sous Linux, ou Firefox et
// Chromium dependent de ceux du systeme — les refuse tous. VP9 et Opus sont
// libres de brevets et integres a ces navigateurs. On ne fabrique cette version
// que pour un film reellement ouvert par un tel navigateur : les autres membres
// ne sont pas concernes, et l'espace disque ne grossit que pour ces films-la.
// ---------------------------------------------------------------------------
const processWebm = async (job: any) => {
    const { filmId, inputFilename } = job.data;

    const inputPath = [UPLOADS_DIR, FILMS_DIR]
        .map((dossier) => path.join(dossier, inputFilename))
        .find((chemin) => fs.existsSync(chemin));
    if (!inputPath) {
        throw new Error(`Fichier introuvable dans uploads/ comme dans Films/ : ${inputFilename}`);
    }

    const base = path.basename(inputFilename, path.extname(inputFilename));
    const fichier = `${base}.secours.webm`;
    const outputPath = path.join(UPLOADS_DIR, fichier);
    // Encodage dans un fichier temporaire, renomme seulement a la fin : un
    // fichier a moitie encode ne peut jamais etre servi.
    const tempPath = `${outputPath}.part`;

    const totalDuration = await new Promise<number>((resolve) => {
        execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', inputPath], (err, stdout) => {
            resolve(stdout ? parseFloat(stdout) : 0);
        });
    });

    console.log(`[Webm] Début de la version de secours du film ${filmId} (${inputFilename}).`);

    try {
        await new Promise((resolve, reject) => {
            // nice -n 19 : priorite processeur la plus basse. L'encodage tourne a
            // toute heure, mais cede toujours la place a la lecture des films.
            const args = ['-n', '19', 'ffmpeg',
                '-y', '-i', inputPath,
                '-map', '0:V:0', '-map', '0:a:0?',
                // Reglage rapide, mesure en septembre 2026 : un film de 2 h est pret
                // en une vingtaine de minutes sur quatre coeurs, contre environ cinq
                // heures en qualite maximale. Plafond a 720p, sans jamais agrandir une
                // video plus petite : suffisant sur un ordinateur, et cette version ne
                // sert qu'aux navigateurs sans H.264 — les autres gardent l'original.
                '-vf', "scale=-2:'min(720,ih)'",
                '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '33',
                '-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1', '-tile-columns', '2', '-threads', '4',
                '-pix_fmt', 'yuv420p',
                '-c:a', 'libopus', '-b:a', '128k', '-ac', '2',
                // Les sous-titres sont servis a part par /api/films/:id/subtitles.
                '-sn',
                '-f', 'webm', tempPath,
            ];
            const processus = spawn('nice', args);

            processus.stderr.on('data', async (data) => {
                const timeMatch = data.toString().match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
                if (timeMatch && totalDuration > 0) {
                    const progress = Math.min(100, Math.round((parseTimeToSeconds(timeMatch[1]) / totalDuration) * 100));
                    await job.updateProgress({ progress });
                }
            });
            processus.on('error', reject);
            processus.on('close', (code) => code === 0 ? resolve(null) : reject(new Error(`FFmpeg (WebM) a échoué avec le code ${code}`)));
        });

        if (!fs.existsSync(tempPath) || fs.statSync(tempPath).size < 1024) {
            throw new Error(`Version de secours vide ou absente pour ${inputFilename}.`);
        }
        fs.renameSync(tempPath, outputPath);
        console.log(`[Webm] Version de secours prête : ${fichier}`);
        return { filmId, fichier };
    } catch (err) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        throw err;
    }
};

// Une seule a la fois : un encodage occupe deja les quatre coeurs, avec la
// priorite la plus basse pour ceder la place a tout le reste.
const webmWorker = new Worker('transcode-webm', processWebm, { connection: connection as any, concurrency: 1 });
webmWorker.on('failed', (job, err) => {
    console.error(`[Webm] Le job ${job?.id} a échoué:`, err);
});

const worker = new Worker('transcode', processJob, { connection: connection as any });
const fastWorker = new Worker('transcode-fast', processJob, { connection: connection as any });

worker.on('failed', (job, err) => {
    console.error(`[Worker] Le job ${job?.id} a échoué:`, err);
});
fastWorker.on('failed', (job, err) => {
    console.error(`[FastWorker] Le job ${job?.id} a échoué:`, err);
});

console.log('[Worker] Démarré et en écoute sur les files BullMQ "transcode", "transcode-fast" et "transcode-webm"...');
