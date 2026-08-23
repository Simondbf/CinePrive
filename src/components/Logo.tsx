/**
 * Logo CinéPrivé.
 *
 * Le tracé utilise `currentColor` : la couleur est donc héritée du texte
 * environnant, ce qui évite d'avoir à gérer une version claire et une version
 * sombre. Pour forcer une couleur, appliquer une classe de texte au parent,
 * par exemple `text-primary-600`.
 */
export default function Logo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      role="img"
      aria-label="CinéPrivé"
      focusable="false"
    >
      <g transform="translate(256 256)">
        <circle
          r="132"
          fill="none"
          stroke="currentColor"
          strokeWidth="30"
          strokeDasharray="600 200"
          transform="rotate(-40)"
        />
        <path d="M-34 -46 L52 0 L-34 46 Z" fill="currentColor" />
      </g>
    </svg>
  );
}
