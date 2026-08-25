/**
 * Vitrine figée de l'ancienne adresse cineprive.rpisimon.uk.
 *
 * Cloudflare Worker : aucune machine à entretenir, la page vit chez
 * Cloudflare. À déployer dans le tableau de bord (Workers & Pages),
 * puis attacher le domaine personnalisé cineprive.rpisimon.uk.
 */

const PAGE = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CinéPrivé a déménagé</title>
  <meta name="robots" content="noindex">
  <style>
    :root { --bordeaux: #b04f5e; --bordeaux-fonce: #8c2f39; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #111315; color: #fff;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      text-align: center; padding: 2rem;
    }
    .logo { width: 96px; height: 96px; margin: 0 auto 1.75rem; animation: pouls 2.4s ease-in-out infinite; }
    @keyframes pouls { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
    h1 { font-size: 1.9rem; font-weight: 700; letter-spacing: -.02em; }
    .sous { margin-top: .75rem; color: #a1a1aa; font-size: 1rem; line-height: 1.6; }
    .adresse {
      display: inline-block; margin-top: 1.75rem; padding: .9rem 1.6rem;
      background: var(--bordeaux-fonce); color: #fff; text-decoration: none;
      border-radius: .75rem; font-weight: 600; font-size: 1.05rem;
      transition: background .2s;
    }
    .adresse:hover { background: var(--bordeaux); }
    .compte { margin-top: 1.5rem; color: #71717a; font-size: .85rem; }
    .fige { margin-top: 2.5rem; color: #52525b; font-size: .78rem; font-style: italic; }
  </style>
</head>
<body>
  <main>
    <svg class="logo" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g transform="translate(256 256)">
        <circle r="138" fill="none" stroke="#b04f5e" stroke-width="40" stroke-dasharray="630 240" transform="rotate(-40)"/>
        <path d="M-38 -52 L58 0 L-38 52 Z" fill="#b04f5e"/>
      </g>
    </svg>
    <h1>CinéPrivé a déménagé</h1>
    <p class="sous">La plateforme vit désormais à sa nouvelle adresse.<br>
    Pensez à mettre à jour vos favoris et l'application sur votre écran d'accueil.</p>
    <a class="adresse" href="https://cineprive.soleiljaune.be">cineprive.soleiljaune.be</a>
    <p class="compte">Redirection automatique dans <span id="compteur">15</span> secondes…</p>
    <p class="fige">Cette page est la vitrine figée de l'ancienne adresse : le site n'est plus accessible ici.</p>
  </main>
  <script>
    let restant = 15;
    const el = document.getElementById('compteur');
    const tictac = setInterval(() => {
      restant -= 1;
      el.textContent = restant;
      if (restant <= 0) {
        clearInterval(tictac);
        window.location.href = 'https://cineprive.soleiljaune.be';
      }
    }, 1000);
  </script>
</body>
</html>`;

export default {
  async fetch() {
    return new Response(PAGE, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    });
  },
};
