import { X, Disc, Settings2, Clock, CheckCircle2 } from "lucide-react";

/**
 * Fenêtre d'aide de l'espace contributeur.
 *
 * Remplace l'ancien encadré bleu, qui occupait de la place en permanence pour
 * trois lignes trop courtes pour être vraiment utiles. Le détail est ici, et
 * seulement quand on le demande.
 */
export default function AideImportModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      {/* Voile. Tailwind v4 : la couleur porte son opacité, bg-opacity-* n'existe plus. */}
      <div
        className="fixed inset-0 bg-black/70"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* `relative` obligatoire : sans lui, le voile en `fixed` recouvre le contenu. */}
      <div
        className="relative w-full max-w-2xl my-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-aide-import"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h3
              id="titre-aide-import"
              className="text-lg font-medium text-zinc-900 dark:text-white"
            >
              Préparer un film avant de l'envoyer
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Comment extraire un DVD, quels réglages utiliser, et que faire si
              vous ne pouvez pas convertir.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* 1 — Le format attendu */}
          <section>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white mb-2">
              <CheckCircle2 className="w-4 h-4 text-primary-600" />
              Le format attendu
            </h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Un fichier <strong className="font-medium text-zinc-900 dark:text-white">.mp4</strong>{" "}
              en <strong className="font-medium text-zinc-900 dark:text-white">H.264</strong> avec
              l'option « optimisé pour le Web » est mis en ligne presque
              immédiatement : le serveur n'a rien à recalculer.
            </p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Tout autre format est accepté — .mkv, .avi, .mov, H.265 — mais
              demande une conversion complète, qui prend plusieurs heures par
              film.
            </p>
          </section>

          {/* 2 — Extraire un DVD */}
          <section>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white mb-2">
              <Disc className="w-4 h-4 text-primary-600" />
              Extraire un DVD ou un Blu-ray
            </h4>
            <ol className="text-sm text-zinc-600 dark:text-zinc-400 space-y-2 list-decimal pl-5 leading-relaxed">
              <li>
                Installez{" "}
                <strong className="font-medium text-zinc-900 dark:text-white">MakeMKV</strong>{" "}
                et insérez le disque.
              </li>
              <li>
                Dans la liste des pistes, gardez la plus longue : c'est le film.
                Les autres sont les bonus et les menus.
              </li>
              <li>
                Décochez les langues et les sous-titres dont vous n'avez pas
                besoin — chacun alourdit le fichier.
              </li>
              <li>
                Lancez l'extraction. Vous obtenez un .mkv fidèle au disque, mais
                volumineux : il reste à le convertir.
              </li>
            </ol>
          </section>

          {/* 3 — HandBrake */}
          <section>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white mb-2">
              <Settings2 className="w-4 h-4 text-primary-600" />
              Convertir avec HandBrake
            </h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3 leading-relaxed">
              Ouvrez le .mkv dans HandBrake, puis reprenez ces réglages. Ils
              donnent un fichier lisible partout, d'une taille raisonnable.
            </p>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <table className="w-full text-sm text-left">
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {[
                    ["Préréglage", "Fast 1080p30 (ou Fast 720p30 pour un DVD)"],
                    ["Format", "MP4, avec « Web Optimized » coché"],
                    ["Codec vidéo", "H.264 (x264) — pas H.265, mal lu par certains navigateurs"],
                    ["Qualité", "Constant Quality, RF entre 20 et 22"],
                    ["Encoder Preset", "medium (fast si vous êtes pressé)"],
                    ["Audio", "Piste d'origine en AAC stéréo, 160 kbit/s"],
                    ["Sous-titres", "Gardés comme piste, pas incrustés dans l'image"],
                  ].map(([champ, valeur]) => (
                    <tr key={champ} className="bg-white dark:bg-zinc-900">
                      <th className="px-4 py-2.5 font-medium text-zinc-700 dark:text-zinc-300 align-top whitespace-nowrap w-44">
                        {champ}
                      </th>
                      <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                        {valeur}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
              Comptez entre trente minutes et deux heures selon la machine. Le
              fichier obtenu fait en général 1,5 à 3 Go pour un long métrage.
            </p>
          </section>

          {/* 4 — Si la conversion est impossible */}
          <section>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white mb-2">
              <Clock className="w-4 h-4 text-primary-600" />
              Si vous ne pouvez pas convertir
            </h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Envoyez le fichier tel quel. Il est accepté sans condition.
            </p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Le serveur s'en charge, et le délai dépend du travail à faire. Si
              seule l'enveloppe du fichier doit changer — un .mkv déjà en H.264,
              le cas le plus courant — c'est une affaire de quelques minutes. Si
              l'image doit être entièrement réencodée, en H.265 par exemple, le
              travail est reporté à la nuit suivante, entre 1 h et 6 h 45 : c'est
              le seul créneau où le serveur peut y consacrer toute sa puissance
              sans gêner ceux qui regardent un film.
            </p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Si un film reste indisponible plus de deux jours, signalez-le : la
              conversion a probablement échoué.
            </p>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition"
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  );
}
