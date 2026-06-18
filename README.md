# CinéPrivé

Plateforme de streaming privée. Films, multi-comptes, enrichissement automatique et optimisation vidéo.

## Configuration (Variables d'Environnement)

Le projet utilise un fichier `.env` ou des variables d'environnement.

**Variables requises :**
- `JWT_SECRET` : Clé secrète pour signer les jetons. Obligatoire en production.
- `SECURITY_MASTER_CODE` : (Optionnel) Code passe-partout.
- `TMDB_API_KEY` : (Optionnel) Clé API The Movie Database pour récupérer les métadonnées de films.
- `JELLYFIN_URL` : (Optionnel) URL de votre serveur Jellyfin.
- `JELLYFIN_API_KEY` : (Optionnel) Clé API de votre serveur Jellyfin.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` : (Optionnel) Pour l'envoi de mails de notifications de sécurité.
- `REDIS_HOST`, `REDIS_PORT` : Pour la file d'attente BullMQ.

## Lancement Docker

```bash
docker-compose up -d --build
```
L'application sera accessible (via Nginx configuré avec `client_max_body_size 0;`) avec les ports exposés dans le docker-compose en localhost sur l'interface de rebond de votre VPS Hetzner.
