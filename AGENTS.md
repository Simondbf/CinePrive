# Conventions pour les agents

Avant d'écrire du code dans ce dépôt, lire **`BONNES_PRATIQUES_AGENT.md`** à la racine. Tout y est, tiré de pannes réelles ; ce fichier-ci n'en est que le point d'entrée pour les outils qui cherchent un `AGENTS.md` par son nom.

Les trois règles qui reviennent le plus souvent :

- **React.** Calculer pendant le rendu. Les événements dans les gestionnaires. Réinitialiser avec `key`. `useMemo` pour un calcul pur et coûteux. Un `useEffect` uniquement pour se synchroniser avec un système extérieur à React. Détails et exemples tirés de ce dépôt : section 9.
- **Réseau.** Toujours vérifier `res.ok` avant `res.json()`. Le helper `apiGet` de `src/lib/api.ts` le fait déjà : l'utiliser plutôt que d'écrire un `fetch` à la main.
- **Vérification.** `npx tsc --noEmit` puis `npx vite build` doivent passer avant toute livraison. C'est la seule barrière automatique du projet, il n'y a aucun test.

- **Version.** Le numéro vit uniquement dans `package.json`. À chaque envoi, le monter avec `npm version <niveau> --no-git-tag-version`, qui met aussi `package-lock.json` à jour : `patch` pour une correction, `minor` pour une fonctionnalité nouvelle, `major` pour un gros changement — ce dernier seulement avec l'accord du propriétaire. Le numéro est repris tout seul dans le menu utilisateur et dans le nom du cache du service worker.

Ne jamais réécrire un fichier entier pour une modification ponctuelle : c'est ainsi que du code récent a déjà été supprimé en silence ici.
