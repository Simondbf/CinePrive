import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import path from 'path';
import { spawn, exec, execFile } from 'child_process';
import fs from 'fs';

const connection = new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
});

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');

const parseTimeToSeconds = (timeStr: string) => {
    const parts = timeStr.split(':');
    if (parts.length === 3) {
        return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    }
    return 0;
};

const processJob = async (job: any) => {
    const { filmId, inputFilename } = job.data;
    const inputPath = path.join(UPLOADS_DIR, inputFilename);
    const ext = path.extname(inputFilename);
    const baseName = path.basename(inputFilename, ext);
    const outputFilename = `${baseName}_conv.mp4`;
    const outputPath = path.join(UPLOADS_DIR, outputFilename);

    if (path.resolve(outputPath) === path.resolve(inputPath)) {
        throw new Error('[Worker] SÉCURITÉ : fichier sortie identique à source.');
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

    const videoCodecStr = await new Promise<string>((resolve) => {
        execFile('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'default=noprint_wrappers=1:nokey=1', inputPath], (err, stdout) => {
             resolve((stdout || '').trim());
        });
    });

    const audioCodecStr = await new Promise<string>((resolve) => {
        execFile('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name', '-of', 'default=noprint_wrappers=1:nokey=1', inputPath], (err, stdout) => {
             resolve((stdout || '').trim());
        });
    });

    const isH264 = videoCodecStr.toLowerCase() === 'h264';
    const isAac = audioCodecStr.toLowerCase() === 'aac';
    const audioAction = isAac ? 'copy' : 'aac';

    console.log(`[Worker] Analyse : codec vidéo = ${videoCodecStr}. Remuxing rapide : ${isH264 ? 'OUI' : 'NON'}`);
    console.log(`[Worker] Analyse : codec audio = ${audioCodecStr}. Action audio : ${audioAction}`);

    try {
        await new Promise((resolve, reject) => {
            const args = isH264 ? [
                '-y', '-i', inputPath,
                '-map', '0:v:0', '-map', '0:a', '-map', '0:s?',
                '-c:v', 'copy',
                '-c:a', audioAction,
                '-c:s', 'mov_text',
                '-movflags', '+faststart',
                outputPath
            ] : [
                '-y', '-i', inputPath,
                '-map', '0:v:0', '-map', '0:a', '-map', '0:s?',
                '-threads', '2',
                '-c:v', 'libx264', '-preset', 'fast',
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
        console.error(`[Worker] ÉCHEC du transcodage pour le film ID: ${filmId}. Nettoyage des fichiers...`);
        try {
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
                console.log(`[Worker] Fichier partiel supprimé : ${outputPath}`);
            }
        } catch (cleanupErr) {
            console.error(`[Worker] Erreur lors du nettoyage :`, cleanupErr);
        }
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
