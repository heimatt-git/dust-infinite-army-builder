# DUST 194∞ Builder

Army builder communautaire et gratuit pour **DUST 194∞** (règles DUST 1947). Il remplace l'application Android DUST ENLIST, qui n'est plus installable sur les versions récentes d'Android.

**Utiliser le site : https://heimatt-git.github.io/dust-infinite-army-builder/**

Il fonctionne dans n'importe quel navigateur (ordinateur, téléphone, tablette), sans compte et sans installation.

## Ce que fait le builder

- Base de **554 unités** et **54 pelotons**, répartis en 6 blocs (Alliés, Axe, SSU, Mercenaires, Mythos, IJN) et leurs factions.
- Vérification des règles de construction du livre DUST 1947 : limite de points, bonus héros, armées de faction, de bloc ou mercenaires, pelotons, héros et véhicules capturés.
- Carte de chaque unité : caractéristiques, armes, compétences, illustration en pixel art.
- Listes enregistrées dans le navigateur, lien de partage, export texte, PDF et impression.
- **Ma collection** : suivi des unités que l'on possède.
- Français et anglais.

## Shot Format

La page `shot.html` propose le **Shot Format** de L'Heure du Loir : des parties courtes de 30 à 45 minutes, avec une armée réduite (un héros, des escouades et un véhicule). Les réglages du format sont dans `data/short-format.json`.

## Atelier

La page `atelier.html` permet de créer ses propres unités, factions, blocs et pelotons, d'en voir l'aperçu, de télécharger la carte en PNG et de partager le projet dans un fichier. Ces créations sont marquées **CONFIDENTIAL** : elles sont non officielles et séparées de la base officielle.

## Corriger ou compléter la base

Une erreur dans une unité ? Utilisez le formulaire **Signaler une erreur d'unité** (onglet *Issues* de ce dépôt) ou écrivez-nous sur le [Discord](https://discord.gg/h3xfZKeNvU).

Les données sont des fichiers JSON dans `data/` (unités, blocs, compétences, illustrations). À chaque modification, une vérification automatique se lance dans l'onglet *Actions*.

## Tester sur son ordinateur

Le site charge des fichiers JSON : il faut un petit serveur local.

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Après toute modification d'un fichier `js/` ou `css/`, lancer `node scripts/bump-version.mjs` pour éviter les problèmes de cache.

## Mentions

Outil de fan, non officiel et gratuit. DUST, DUST 1947, les noms, profils et règles appartiennent à leurs ayants droit. Les images officielles des cartes ne sont pas incluses. Les photos de figurines proposées en option restent la propriété de leurs auteurs (licence CC BY 4.0).
