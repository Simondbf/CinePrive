Liste des évolutions décidées mais pas encore réalisées. La liste suivante n'est pas une liste par ordre de priorité

Les deux points ci-dessous sont volontairement reportés : trop tôt pour les thèmes de couleur, et un canal bêta n'a pas de sens tant que la plateforme n'a qu'un utilisateur régulier.

3. Trois variantes du logo existent : **bordeaux** (par defaut), **vert foret** et **bleu nuit**. L'idee est de laisser chacun choisir la sienne dans les reglages de son compte.
Mise en oeuvre : la couleur d'accent de toute l'application descend des variables `--color-primary-*` de `src/index.css`. Il suffirait donc d'appliquer une classe sur `<html>` (par exemple `theme-vert`) qui redefinit ces onze variables, et de memoriser le choix sur le compte.
Le logo lui-meme n'a rien a changer : `src/components/Logo.tsx` utilise `currentColor` et suit automatiquement.
Reste a trancher : les icones d'installation, elles, sont des fichiers PNG figes. Le logo de l'ecran d'accueil du telephone resterait donc bordeaux pour tout le monde.

4. membre bêta pour aider à la validation et surtout stabilisation de la plateforme
