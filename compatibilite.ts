import { execFile } from 'child_process';

// Ce qu'un fichier video contient reellement. L'extension ne dit rien : un
// .mp4 n'est qu'une enveloppe, qui peut contenir une video HEVC ou un son AC-3
// que certains navigateurs lisent et d'autres non. C'est exactement ce qui
// arrivait jusqu'en septembre 2026 : un film se lisait chez le proprietaire et
// affichait "format non supporte" chez un autre membre.
export interface Flux {
    video: string;   // codec de la premiere vraie piste video (hors jaquette)
    pixFmt: string;  // yuv420p = 8 bits ; yuv420p10le = 10 bits, illisible en navigateur
    audio: string;   // codec de la premiere piste audio, '' s'il n'y en a pas
}

const AUCUN_FLUX: Flux = { video: '', pixFmt: '', audio: '' };

// Sortie JSON et non CSV : l'ancienne sonde lisait "h264,video" comme
// "type,codec" alors que ffprobe ecrit "codec,type". Elle ne reconnaissait
// donc jamais aucun codec.
export const sonder = (chemin: string): Promise<Flux> => new Promise((resolve) => {
    execFile('ffprobe', [
        '-v', 'error',
        '-show_entries', 'stream=codec_type,codec_name,pix_fmt:stream_disposition=attached_pic',
        '-of', 'json',
        chemin,
    ], (err, stdout) => {
        if (err || !stdout) return resolve(AUCUN_FLUX);
        try {
            const pistes: any[] = JSON.parse(stdout).streams || [];
            // Une jaquette integree apparait comme une piste video : on l'ignore.
            const video = pistes.find((p) => p.codec_type === 'video' && !p.disposition?.attached_pic);
            const audio = pistes.find((p) => p.codec_type === 'audio');
            resolve({
                video: String(video?.codec_name || '').toLowerCase(),
                pixFmt: String(video?.pix_fmt || '').toLowerCase(),
                audio: String(audio?.codec_name || '').toLowerCase(),
            });
        } catch {
            resolve(AUCUN_FLUX);
        }
    });
});

// Video H.264 en 8 bits : elle peut etre recopiee telle quelle.
export const videoCopiable = (f: Flux): boolean =>
    f.video === 'h264' && (f.pixFmt === 'yuv420p' || f.pixFmt === 'yuvj420p');

// Lisible par tous les navigateurs : enveloppe MP4, video H.264 8 bits, son AAC
// ou MP3 — ou pas de son du tout.
export const estLisiblePartout = (nomFichier: string, f: Flux): boolean =>
    nomFichier.toLowerCase().endsWith('.mp4')
    && videoCopiable(f)
    && (f.audio === '' || f.audio === 'aac' || f.audio === 'mp3');
