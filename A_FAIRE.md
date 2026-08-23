Liste des évolutions décidées mais pas encore réalisées. La liste suivante n'est pas une liste par ordre de priorité

1. Invitation à installer l'application

→ Un bandeau discret, en bas de l'écran, proposant d'installer CinéPrivé sur l'écran d'accueil. Le modèle de référence est celui de `casapark.fr`.

Règles d'affichage, dans l'ordre
| Situation | Comportement attendu |
|---|---|
| Ordinateur de bureau | **Ne jamais afficher.** Le bandeau est réservé au mobile et à la tablette. |
| Téléphone ou tablette, application non installée | Afficher le bandeau |
| Application déjà installée, ouverte depuis l'icône | **Ne jamais afficher** |
| Application installée, mais ouverte depuis le navigateur | Continuer d'afficher |
| Bandeau écarté par l'utilisateur | Ne plus réafficher |


2. Choix du logo par utilisateur

3. Trois variantes du logo existent : **bordeaux** (par defaut), **vert foret** et **bleu nuit**. L'idee est de laisser chacun choisir la sienne dans les reglages de son compte.
Mise en oeuvre : la couleur d'accent de toute l'application descend des variables `--color-primary-*` de `src/index.css`. Il suffirait donc d'appliquer une classe sur `<html>` (par exemple `theme-vert`) qui redefinit ces onze variables, et de memoriser le choix sur le compte.
Le logo lui-meme n'a rien a changer : `src/components/Logo.tsx` utilise `currentColor` et suit automatiquement.
Reste a trancher : les icones d'installation, elles, sont des fichiers PNG figes. Le logo de l'ecran d'accueil du telephone resterait donc bordeaux pour tout le monde.

4. membre bêta pour aider à la validation et surtout stabilisation de la plateforme

5. inclure les bandes annonces des films en questions via une petite interface youtube dans l'appli (fiche du film) ou via un lien de redirection sur le site youtube (ouverture d'un nouvel onglet)
