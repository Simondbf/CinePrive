# ⚠️ INSTRUCTIONS CRITIQUES : Erreur d'Upload (413 Payload Too Large)

Au vu des logs (le serveur Node.js ne reçoit même pas la requête), le problème ne vient ni du code React, ni du serveur Express. L'erreur survient "instantanément" car **c'est votre propre proxy Nginx sur le VPS Hetzner qui rejette silencieusement la requête** avant même de l'envoyer au conteneur Docker. 

Par défaut, Nginx possède une limite stricte `client_max_body_size` fixée à 1 Mo seulement. Toute requête au-delà de cette taille (même nos petits morceaux de 10 Mo) est bloquée par Nginx, qui renvoie une erreur 413.

## Étape 1 : Mettre à jour la configuration Nginx (Sur le VPS)

Connectez-vous en SSH à votre VPS et modifiez votre fichier de configuration Nginx dans `/etc/nginx/sites-enabled/cineprive.conf` pour ajouter les lignes de `client_max_body_size` et les `timeouts` :

```nginx
server {
    listen 80;
    server_name cineprive.votredomaine.com;

    # === CORRECTIONS CRITIQUES ===
    # Autorise les uploads sans limite de taille
    client_max_body_size 0;

    # Augmente drastiquement les délais de timeout
    proxy_read_timeout 3600;
    proxy_connect_timeout 3600;
    proxy_send_timeout 3600;
    # ==============================

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Rechargez ensuite Nginx sur votre VPS :
`sudo systemctl reload nginx`

## Étape 2 : Relancer Docker Compose

La nouvelle architecture Docker (Interface, Redis, Worker) nécessite de tout relancer :
`docker-compose up -d --build`

La découpe en morceau fonctionne correctement et est strictement asynchrone / séquentielle. Le Frontend a été "blindé" de `console.error` pour inspecter l'erreur dans la console du navigateur au cas où.
