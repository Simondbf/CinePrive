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

const worker = new Worker('transcode', processJob, { connection: connection as any });
const fastWorker = new Worker('transcode-fast', processJob, { connection: connection as any });

worker.on('failed', (job, err) => {
    console.error(`[Worker] Le job ${job?.id} a échoué:`, err);
});
fastWorker.on('failed', (job, err) => {
    console.error(`[FastWorker] Le job ${job?.id} a échoué:`, err);
});

console.log('[Worker] Démarré et en écoute sur les files BullMQ "transcode" et "transcode-fast"...');
