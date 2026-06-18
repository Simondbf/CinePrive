import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import path from 'path';
import { spawn, exec } from 'child_process';
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

const worker = new Worker('transcode', async (job) => {
    const { filmId, inputFilename } = job.data;
    const inputPath = path.join(UPLOADS_DIR, inputFilename);
    const ext = path.extname(inputFilename);
    const baseName = path.basename(inputFilename, ext);
    const outputFilename = `${baseName}.mp4`;
    const outputPath = path.join(UPLOADS_DIR, outputFilename);

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
        exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`, (err, stdout) => {
            resolve(stdout ? parseFloat(stdout) : 0);
        });
    });

    await new Promise((resolve, reject) => {
        const args = [
            '-y', '-i', inputPath,
            '-threads', '1',
            '-c:v', 'libx264', '-preset', 'fast',
            '-c:a', 'aac',
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
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
            console.log(`[Worker] Fichier d'origine supprimé de l'espace disque : ${inputFilename}`);
        }
    } catch (unlinkErr) {
        console.error(`[Worker] Impossible de supprimer l'original ${inputFilename}:`, unlinkErr);
    }

    return { filmId, newFilename: outputFilename };
}, { connection });

worker.on('failed', (job, err) => {
    console.error(`[Worker] Le job ${job?.id} a échoué:`, err);
});

console.log('[Worker] Démarré et en écoute sur la file BullMQ "transcode"...');
