import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import fs from 'fs';

// Donne au cache du service worker un nom neuf a chaque construction du site.
// Le service worker n'efface l'ancien cache que lorsque ce nom change : le
// numero etait a incrementer a la main dans public/sw.js, et il a ete oublie
// treize deploiements de suite, laissant s'empiler chez chaque membre les
// fichiers de toutes les versions precedentes. Plus rien a faire a la main.
const nomCacheParConstruction = () => ({
  name: 'nom-cache-service-worker',
  apply: 'build' as const,
  closeBundle() {
    const fichier = path.resolve(__dirname, 'dist', 'sw.js');
    if (!fs.existsSync(fichier)) return;
    const contenu = fs.readFileSync(fichier, 'utf-8');
    const remplace = contenu.replace(
      /const CACHE_NAME = '[^']*';/,
      `const CACHE_NAME = 'cineprive-${Date.now().toString(36)}';`,
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
