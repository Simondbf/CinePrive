# Bonnes pratiques — CinéPrivé & Gringotts

Règles tirées de pannes réelles. Chacune a coûté au moins une soirée de débogage. À lire avant toute modification, et à faire lire à toute IA sollicitée sur ces projets.

---

## 1. Vérifications avant chaque envoi sur GitHub

### Contrôler les types

Ni Vite ni esbuild ne vérifient les types. Une icône non importée, une variable déclarée deux fois, une propriété renommée : tout cela **passe le build sans un mot** et casse l'application à l'exécution.

Le serveur n'ayant ni Node ni npm, la vérification se fait sur le poste de développement :

```powershell
npm install ; npx tsc --noEmit
```

Ou, depuis le serveur, dans un conteneur jetable :

```bash
docker run --rm -v /root/CinePrive:/app -w /app node:20-alpine \
  sh -c "npm install --silent ; npx tsc --noEmit"
```

**Pannes évitées par cette seule commande :** `hasRole` utilisé sans être importé, l'icône `Check` manquante provoquant un écran blanc, `inputPath` déclaré deux fois empêchant toute reconstruction du worker, le SDK PocketBase en retard d'une version majeure.

### Un commit, un sujet

**Ne jamais reconstruire un fichier entier à partir d'une version antérieure.** Trois commits successifs ont effacé silencieusement du travail de cette manière :

| Commit | Message affiché | Contenu réel |
|---|---|---|
| `b3c206f` | « Update print statement from Hello to Goodbye » | 368 lignes supprimées, deux routes d'API perdues |
| `f21974b` | « standardize role management » | 593 lignes réécrites, correctifs vidéo perdus, backend ramené à l'ancien modèle de rôles |
| `87c8722` | « migrate to PocketBase » | Marche arrière complète vers Supabase |

Modifier uniquement les portions concernées, par recherche-remplacement ciblée.

---

## 2. Service worker

### Les trois gardes obligatoires

En tête du gestionnaire `fetch` de `public/sw.js` :

```js
if (req.method !== 'GET') return;
if (url.origin !== self.location.origin) return;
if (
  url.pathname.startsWith('/videos/') ||
  url.pathname.startsWith('/api/') ||
  req.headers.has('range')
) return;
```

Sans elles, le service worker intercepte les requêtes partielles de la vidéo et **le lecteur reste bloqué à 00:00**. Sur Gringotts, l'absence de la garde sur `/api/` et `/_/` rendait le panneau PocketBase totalement inaccessible.

### Renouveler le cache à chaque déploiement

Le service worker n'efface l'ancien cache que lorsque `CACHE_NAME` change. Si la valeur ne bouge pas, selon la stratégie de cache, le navigateur continue de servir l'ancienne version, parfois plusieurs jours, sans le moindre signe visible — ou, au mieux, les fichiers de chaque version s'empilent indéfiniment chez les visiteurs. Symptôme typique : une console vide alors que la page ne se comporte pas comme prévu.

**CinéPrivé — automatique depuis septembre 2026.** `vite.config.ts` réécrit `CACHE_NAME` dans `dist/sw.js` à chaque construction, sous la forme `cineprive-v1.2.0+tampon` : la version de `package.json`, puis un tampon de construction qui garantit un nom neuf même si la version n'a pas été montée. La construction échoue si la ligne est introuvable. La valeur écrite dans `public/sw.js` ne sert qu'en développement : **ne plus l'incrémenter à la main**. La règle manuelle avait été oubliée treize déploiements de suite.

**Ailleurs**, tant que ce n'est pas automatisé, incrémenter à la main :

```js
const CACHE_NAME = 'monsite-v2';   // etait v1
```

Pour purger côté navigateur : DevTools → Application → Service Workers → Unregister, puis rechargement forcé. Sur Firefox, `Ctrl+Maj+R` ne suffit pas — il faut passer par `about:preferences#privacy` → Gérer les données.

---

## 3. Appels réseau

### Toujours vérifier `res.ok` avant `res.json()`

`fetch` ne rejette **pas** sur un code d'erreur HTTP, uniquement sur une panne réseau. Un `.catch()` ne protège donc de rien.

Trois pannes distinctes ont eu cette même origine : une réponse `403` passée à un `setState`, transformant un tableau en `{error: "..."}`. Le `.map()` suivant lève `m.map is not a function` et React démonte tout l'arbre — écran blanc, sans message.

Utiliser `apiGet` de `src/lib/api.ts`, qui renvoie une valeur de repli en cas d'erreur :

```ts
setUsersList(await apiGet<User[]>("/api/users", []));
```

Pour les écritures, vérifier explicitement :

```ts
if (!res.ok) {
  const detail = await res.json().catch(() => ({}));
  console.error("[CONTEXTE] HTTP", res.status, detail);
  notify("...", "Erreur");
  return;
}
```

### Journaliser les routes sensibles

Le middleware de journalisation est monté sur `/api` uniquement. Les routes hors de ce préfixe — `/videos/` notamment — n'apparaissent **jamais** dans les logs, même en échec. Une absence de log n'est donc pas une information.

---

## 4. Docker et réseau

### Docker contourne le pare-feu

Docker écrit ses propres règles iptables et passe devant `ufw`. Un port publié sans préfixe reste joignable depuis Internet malgré un `ufw deny`.

**La seule protection fiable est le préfixe dans `docker-compose.yml` :**

```yaml
ports:
  - "127.0.0.1:3001:80"     # bon
  - "3001:80"               # exposé sur Internet
```

Contrôle après chaque déploiement :

```bash
sudo ss -tlnp | grep -vE '127\.0\.0\.|\[::1\]'
```

Seuls `sshd` et `nginx` doivent apparaître.

### « address already in use »

Un processus `docker-proxy` peut survivre à son conteneur et garder le port indéfiniment. Aucun `docker compose down` ne l'atteint, puisqu'il n'y a plus de conteneur à supprimer.

```bash
sudo ss -tlnp | grep 3000
ps -fp <PID>
sudo kill <PID>
```

Un cas réel a duré **plusieurs semaines**, faisant croire à un conteneur fantôme et masquant le fait que le code déployé n'était jamais celui qui répondait.

### Ne jamais supprimer un montage sans comprendre son rôle

Un commit a retiré les montages de la Storage Box en les qualifiant de « redondants ». Ils ne l'étaient pas : `./data` porte `db.json` sur le disque local, les deux autres portent les fichiers vidéo sur la Storage Box. Sans eux, le conteneur ne voit aucun film.

Vérifier aussi que le montage CIFS est actif **avant** de démarrer les conteneurs — un montage créé après n'est pas propagé :

```bash
mount | grep cineprive
```

---

## 5. nginx

**Deux nginx coexistent.** Celui de l'hôte, dans `/etc/nginx/`, jamais versionné, qui reçoit Internet et trie par nom de domaine. Et celui du conteneur Gringotts, dans son dépôt, qui sert les fichiers React.

**`proxy_buffering off` est indispensable pour la vidéo.** Sans lui, nginx met le flux en tampon et casse les requêtes partielles — le lecteur reste à 00:00.

**Attention à la barre oblique dans `proxy_pass`.** `proxy_pass http://serveur:8090/_/;` retire `/_/` avant de transmettre, et le service en aval construit alors des liens sans préfixe. Sans chemin, l'adresse passe intacte.

**Un seul `default_server` par port.** En déclarer deux fait échouer `nginx -t`.

**Toujours tester avant de recharger :**

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. Traitement des fichiers vidéo

**Ne jamais écrire dans le fichier qu'on est en train de lire.** Le worker construisait un nom de sortie identique au nom d'entrée quand le fichier était déjà en MP4, puis supprimait « la source » après traitement — détruisant le résultat. Des films ont été perdus.

Garde-fou en place, à ne pas retirer :

```ts
if (path.resolve(outputPath) === path.resolve(inputPath)) {
    throw new Error('Sécurité : entrée et sortie identiques.');
}
```

**En cas d'échec, ne jamais supprimer le fichier source.** Il permet de relancer le traitement. Seule la sortie partielle doit être nettoyée.

---

## 7. Interface

**Tailwind v4 a supprimé les utilitaires d'opacité.** `bg-opacity-75`, `text-opacity-*`, `border-opacity-*` et `ring-opacity-*` n'existent plus. La syntaxe est désormais `bg-gray-500/75`.

Symptôme observé : un voile de fenêtre modale rendu **totalement opaque** au lieu de translucide, masquant le formulaire — un écran gris sans erreur en console.

**Un élément positionné passe au-dessus d'un élément non positionné**, quel que soit l'ordre dans le HTML. Le contenu d'une fenêtre modale doit porter `relative`, sinon le voile en `fixed` le recouvre.

**Une palette centralisée.** Toute la couleur d'accent descend des variables `--color-primary-*` de `src/index.css`. Ne jamais coder une couleur en dur dans un composant.

---

## 8. Sur le travail assisté par IA

**Ne pas laisser une IA deviner le comportement d'une API qu'elle ne peut pas tester.** Plusieurs correctifs successifs sur la recherche par ISBN ont introduit des régressions parce qu'ils reposaient sur des suppositions. Le navigateur est le seul outil ayant réellement accès à ces services : tester d'abord, corriger ensuite.

**Exiger le contrôle des types avant toute remise.** C'est la seule barrière automatique du projet.

**Se méfier des messages de commit générés automatiquement.** Ils décrivent rarement le contenu réel. Vérifier le diff avant de fusionner.

---

## 9. React — les Effects

**La règle courte.** Calculer pendant le rendu. Les événements dans les gestionnaires. Réinitialiser avec `key`. `useMemo` pour un calcul pur et coûteux. Un `useEffect` **uniquement** pour se synchroniser avec un système extérieur à React.

Un système extérieur, c'est : un écouteur sur `window` ou `document`, un `setInterval`, une instance Plyr, le service worker, le `localStorage`, une requête réseau. Rien d'autre.

### Les quatre usages à proscrire

**L'état dérivé.** Si une valeur se déduit d'autres états ou de props, elle se calcule pendant le rendu — pas dans un Effect qui appelle `setState`. Chaque Effect de ce type coûte un rendu supplémentaire et crée un décalage d'une frame pendant lequel l'affichage est faux.

```tsx
// Non
useEffect(() => { setTab(mode === "upload" ? "upload" : "users") }, [mode]);

// Oui
const tab = mode === "upload" ? "upload" : "users";
```

**Les événements branchés dans un Effect.** Prévenir le parent, envoyer une requête, afficher une notification : tout cela appartient au gestionnaire qui a déclenché l'action, pas à un Effect qui observe le changement d'état après coup. Dans un Effect, on perd la cause : on ne sait plus *pourquoi* la valeur a changé.

```tsx
// Non
useEffect(() => { onUploadStateChange(isUploadingGlobal) }, [isUploadingGlobal]);

// Oui — dans la fonction qui démarre réellement l'envoi
const demarrerEnvoi = () => { setIsUploadingGlobal(true); onUploadStateChange(true); };
```

**La réinitialisation d'état.** Pour repartir de zéro quand l'utilisateur change, on remonte le composant avec `key` — on ne remet pas six `setState` à leur valeur initiale dans un Effect.

```tsx
// Non
useEffect(() => { if (!activeUser) { setA(false); setB(false); setC('system') } }, [activeUser]);

// Oui
<Reglages key={activeUser?.id ?? 'anonyme'} />
```

Quand le découpage n'est pas praticable — l'état est lu partout dans le composant et l'extraire déplacerait trop de choses — React documente une seconde forme : **ajuster pendant le rendu**, en comparant à la valeur précédente. Elle évite elle aussi la frame intermédiaire où l'écran affiche encore l'état de l'utilisateur précédent.

```tsx
const [idCharge, setIdCharge] = useState(activeUser?.id);
if (idCharge !== activeUser?.id) {
  setIdCharge(activeUser?.id);
  setThemeMode(lireReglages(activeUser?.id).theme);
}
```

Comparer l'identifiant, pas l'objet : sinon une simple mise à jour de profil recrée un objet `activeUser` et déclenche une réinitialisation non voulue.

**Le calcul coûteux.** `useMemo`, jamais un Effect suivi d'un `setState`.

### Trois erreurs corrigées dans ce dépôt (septembre 2026)

**Un hook ne se place jamais dans un bloc conditionnel.** `src/App.tsx`, composant `FilmPlayerRoute` : un `useEffect` était appelé à l'intérieur d'un `if (!film)`. Le nombre de hooks change alors d'un rendu à l'autre et React lève « Rendered fewer hooks than expected » — écran blanc. Pour une redirection, utiliser `<Navigate to="/" replace />`, pas un Effect.

**Deux Effects qui chargent la même chose.** Toujours dans `src/App.tsx` : `fetchFilms()` était appelé dans l'Effect de montage `[]` *et* dans l'Effect `[activeUser]`. Au démarrage, la liste partait deux fois. Un seul point de chargement désormais.

**Un Effect ne doit pas déclencher sa propre relance.** L'Effect de sondage dépendait de `films` et appelle `fetchFilms()`, qui remplace `films` : l'intervalle était détruit et recréé toutes les cinq secondes. Dépendre de la condition dérivée (`transcodageEnCours`), pas du tableau entier.

### Changer de route ne remonte pas forcément le composant

Erreur commise en septembre 2026, à ne pas refaire. `/upload` et `/serveurs` sont deux `<Route>` distinctes, et on en a déduit que chacune donnait sa propre instance de `ContributeApp` — donc qu'une remise à zéro de l'onglet actif était inutile. Faux. Les deux routes rendent le **même composant au même endroit** de l'arbre : React réconcilie par type, garde l'instance vivante et se contente de changer la prop `mode`. On arrivait dans la Salle des Serveurs avec l'onglet d'envoi encore affiché.

Deux composants de types **différents** forcent bien un démontage. Deux `<Route>` sur le même composant, non. Dans le doute, partir du principe que l'état survit à la navigation.

C'est aussi pour cela que `key` n'était pas la bonne réponse ici : remonter `ContributeApp` aurait détruit la file d'envoi en cours. D'où l'ajustement pendant le rendu.

### Avant de rendre du React

Compter les `useEffect` ajoutés. Pour chacun, répondre à : *quel système extérieur est-ce que je synchronise ?* Si la réponse n'est pas immédiate, l'Effect n'a pas lieu d'être.

---

## 10. Formats vidéo

**Le format des films est MP4, vidéo H.264 en 8 bits (`yuv420p`), son AAC.** C'est le plus universel : Windows, Mac, Android, iPhone, tous les navigateurs courants. Ne jamais convertir la bibliothèque vers un autre format « plus moderne » : WebM et AV1 ne sont pas lus par une partie des appareils Apple.

**L'extension ne dit rien du contenu.** Un `.mp4` peut contenir une vidéo HEVC ou 10 bits, ou un son AC-3, qu'une partie des navigateurs refuse. Tout fichier envoyé passe donc par `compatibilite.ts` (`sonder`, `estLisiblePartout`), `.mp4` compris ; jusqu'en septembre 2026, les `.mp4` étaient mis en ligne sans examen.

**Le seul cas que ce format ne couvre pas :** un navigateur privé des codecs H.264 et AAC, fréquent sous Linux où Firefox et Chromium dépendent de ceux du système. Cas réel de septembre 2026 : Firefox 140 sous Linux, à qui le serveur envoyait correctement la vidéo (réponses `206`, plusieurs mégaoctets) et qui ne savait pas la décoder. Pour lui, une **version de secours** WebM (VP9 + Opus) est fabriquée à la demande :

- le lecteur teste `canPlayType` ; s'il ne lit pas le H.264 mais lit le WebM, il ne tente jamais le MP4 et demande `POST /api/films/:id/webm` ;
- la file `transcode-webm` du worker encode avec `nice -n 19`, dans un fichier `.part` renommé seulement à la fin ;
- réglage rapide, choisi sur mesures : VP9 `-deadline realtime -cpu-used 8`, plafonné à 720p sans agrandir, quatre fils. Un film de 2 h est prêt en une vingtaine de minutes sur quatre cœurs, contre environ cinq heures en qualité maximale. Dix minutes pour un film entier ne sont pas atteignables sur ce serveur, même en 480p ;
- l'état vit dans `film.webm` (`attente`, `pret`, `erreur`) ; la version de secours est supprimée avec le film et lors d'un remplacement de fichier.

Par défaut, seuls les films réellement ouverts par un tel navigateur ont une version de secours. Le propriétaire peut aussi toutes les préparer d'avance depuis la Bibliothèque (`/api/admin/versions-secours`) :

- l'espace libre du disque est mesuré **avant** (`fs.statfsSync`), avec 10 % de marge ; sans place suffisante, ou si la mesure échoue, rien n'est lancé — un disque plein ferait échouer les envois et les conversions de tous les films ;
- chaque film a un identifiant de job fixe, `webm_<film>` : pas de doublon, et une demande urgente retrouve le job du lot ;
- priorité 1 pour un visiteur qui attend, 100 pour le lot : un visiteur passe toujours devant la préparation de toute la bibliothèque ;
- le bouton « Préparer pour Linux » de chaque film est ouvert au propriétaire et aux admins.
