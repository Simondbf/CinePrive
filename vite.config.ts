import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import fs from 'fs';

// Version de l'application. Une seule source : le champ "version" de
// package.json, au format majeure.mineure.correctif. Elle est affichee dans le
// menu utilisateur et reprise dans le nom du cache du service worker.
const VERSION: string = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')).version;

// Nom du cache du service worker : la version lisible, suivie d'un tampon de
// construction apres un "+" (notation standard des metadonnees de construction).
// Le service worker n'efface l'ancien cache que lorsque ce nom change ; grace au
// tampon, il change a chaque construction meme si l'on oublie de monter la
// version — ce qui est arrive treize deploiements de suite avec l'ancien numero
// a incrementer a la main.
const nomCacheParConstruction = () => ({
  name: 'nom-cache-service-worker',
  apply: 'build' as const,
  closeBundle() {
    const fichier = path.resolve(__dirname, 'dist', 'sw.js');
    if (!fs.existsSync(fichier)) return;
    const contenu = fs.readFileSync(fichier, 'utf-8');
    const remplace = contenu.replace(
      /const CACHE_NAME = '[^']*';/,
      `const CACHE_NAME = 'cineprive-v${VERSION}+${Date.now().toString(36)}';`,
    );
    if (remplace === contenu) {
      throw new Error("sw.js : ligne CACHE_NAME introuvable, le cache ne serait jamais renouvele.");
    }
    fs.writeFileSync(fichier, remplace);
  },
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), nomCacheParConstruction()],
    define: {
      __APP_VERSION__: JSON.stringify(VERSION),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
