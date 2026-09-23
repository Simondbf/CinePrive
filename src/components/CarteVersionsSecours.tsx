import React, { useEffect, useState } from "react";
import { Monitor } from "lucide-react";
import { apiGet } from "../lib/api";
import { notify } from "../lib/notify";

// Carte de la Bibliotheque, proprietaire seul : versions de secours WebM pour
// les navigateurs prives des codecs H.264/AAC. Elles sont de toute facon
// fabriquees a la demande quand un tel navigateur ouvre un film ; cette carte
// permet de toutes les preparer d'avance.
interface Resume {
  total: number;
  prets: number;
  enAttente: number;
  aFaire: number;
  dureeAFaireMinutes: number;
  tailleAFaire: number;
  libre: number | null;
  suffisant: boolean;
  lances?: number;
  error?: string;
}

const formatOctets = (n: number): string => {
  const [valeur, unite] = n >= 1e12 ? [n / 1e12, "To"] : n >= 1e9 ? [n / 1e9, "Go"] : [n / 1e6, "Mo"];
  return `${valeur.toFixed(1).replace(".", ",")} ${unite}`;
};

const formatDuree = (minutes: number): string =>
  minutes >= 60 ? `${Math.round(minutes / 60)} h` : `${minutes} min`;

export default function CarteVersionsSecours() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  // Etat lu a l'affichage de la carte : synchronisation avec le serveur.
  useEffect(() => {
    let annule = false;
    apiGet<Resume | null>("/api/admin/versions-secours", null).then((r) => {
      if (!annule) setResume(r);
    });
    return () => { annule = true; };
  }, []);

  const lancer = async () => {
    setEnvoi(true);
    try {
      const r = await fetch("/api/admin/versions-secours", { method: "POST" });
      const d: Resume = await r.json().catch(() => ({}) as Resume);
      if (typeof d.total === "number") setResume(d);
      if (r.ok) {
        notify(`${d.lances ?? 0} film(s) mis en préparation.`, "Versions pour Linux");
      } else {
        notify(d.error || "La préparation n'a pas pu être lancée.", "Erreur");
      }
    } catch {
      notify("Erreur de connexion", "Erreur");
    } finally {
      setEnvoi(false);
      setConfirmation(false);
    }
  };

  if (!resume) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h3 className="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
            <Monitor className="w-5 h-5 text-zinc-500" />
            Versions pour les navigateurs sans H.264
          </h3>
          <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
            Certains navigateurs, surtout sous Linux, ne lisent pas le format habituel des films. Une
            version adaptée est préparée automatiquement quand l'un d'eux ouvre un film ; ici, on peut
            toutes les préparer d'avance.
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-2">
            <span className="font-medium">{resume.prets} / {resume.total}</span> prêtes
            {resume.enAttente > 0 && <> · {resume.enAttente} en préparation</>}
          </p>
        </div>
        {resume.aFaire > 0 && !confirmation && (
          <button
            onClick={() => setConfirmation(true)}
            className="px-4 py-2 rounded text-sm font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 shrink-0"
          >
            Tout préparer
          </button>
        )}
      </div>

      {confirmation && (
        <div className="mt-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 text-sm space-y-2">
          <p className="text-zinc-700 dark:text-zinc-300">
            {resume.aFaire} film(s) à préparer
            {resume.dureeAFaireMinutes > 0 && <>, soit environ {formatDuree(resume.dureeAFaireMinutes)} de vidéo</>}.
            {resume.dureeAFaireMinutes > 0 ? (
              <> Comptez de l'ordre de {formatDuree(Math.round(resume.dureeAFaireMinutes / 5))} au total</>
            ) : (
              <> Comptez une vingtaine de minutes par film de deux heures</>
            )}
            , un film à la fois. L'encodage tourne en arrière-plan sans gêner la lecture, et un
            visiteur qui ouvre un film passe toujours devant.
          </p>
          <p className="text-zinc-700 dark:text-zinc-300">
            Espace nécessaire : jusqu'à <span className="font-medium">{formatOctets(resume.tailleAFaire)}</span>
            {" · "}espace libre :{" "}
            <span className="font-medium">{resume.libre === null ? "inconnu" : formatOctets(resume.libre)}</span>
          </p>
          {!resume.suffisant && (
            <p className="text-primary-600 font-medium">
              Pas assez d'espace libre pour tout préparer. Libérez de la place avant de lancer.
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={lancer}
              disabled={!resume.suffisant || envoi}
              className="px-4 py-2 rounded text-sm font-medium bg-zinc-900 text-white dark:bg-white dark:text-black disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {envoi ? "Lancement…" : "Confirmer"}
            </button>
            <button
              onClick={() => setConfirmation(false)}
              className="px-4 py-2 rounded text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
