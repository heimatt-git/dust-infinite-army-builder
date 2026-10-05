# DUST 194∞ Builder (web)

Army builder communautaire pour **DUST 194∞** (règles DUST 1947), qui remplace l'application Android DUST ENLIST (plus installable sur les versions récentes d'Android). Il fonctionne dans n'importe quel navigateur (ordinateur, téléphone, tablette), sans compte et sans installation.

- **542 unités**, **54 pelotons**, **6 blocs** (Alliés, Axe, SSU, Mercenaires, Mythos, IJN) et leurs factions, repris de DUST ENLIST 1.50.
- Règles de construction du livre DUST 1947 (p.46-55) et de l'errata/FAQ de février 2019 vérifiées en direct :
  - limite de points et **bonus héros de 10 %** (armée de faction : 75 % des points dans une faction et aucune autre faction ; armée de bloc : 75 % d'unités du bloc et aucune faction ; armée mercenaire) ;
  - **mercenaires** dans une armée de bloc (et en remplacement d'une unité de combat de peloton, même type et armure au moins égale) ;
  - **un seul véhicule capturé**, coût +2 ;
  - **héros uniques**, un héros par escouade (sauf « Siblings »), armure identique pour rejoindre, compétence Pilote pour piloter ;
  - **commissaires** qui rejoignent une escouade (l'escouade prend leur faction) ;
  - **pelotons** (TO&E) : postes de commandement et de combat requis, soutiens, avantage actif ou non.
- Carte complète de chaque unité : caractéristiques, table d'armes, compétences avec description.
- Listes sauvegardées dans le navigateur, **lien de partage**, export texte, impression.
- **Français / anglais** (builder complet, Shot Format et éditeur) : la langue suit celle du navigateur ; le bouton EN/FR de l'en-tête permet de changer, et le choix vaut pour les trois pages. Les textes d'interface se traduisent dans `js/i18n.js`.
- **Éditeur de base** intégré pour corriger une unité et publier la correction en un clic sur GitHub.
- **Mes images de cartes** : chaque joueur peut ajouter ses propres scans ou photos de cartes (recto/verso). Ils restent dans son navigateur, ne sont ni envoyés ni partagés.
- **Image de la carte générée** : une illustration carrée par unité, en pixel art (miniature de la liste et carte générée). En option, et uniquement dans leur navigateur, les joueurs peuvent utiliser une photo de la communauté (avec son crédit) ou leur propre photo de figurine.

## Shot Format (DUST 194∞)

La page `shot.html` est une version courte et simplifiée pour le **Shot Format** de L'Heure du Loir (parties de 30 à 45 minutes) : un héros de commandement, une escouade obligatoire (armure 4 max.), jusqu'à trois escouades facultatives (armure 3 max.) et un véhicule obligatoire (armure 5 max.), pour 40 PA (+4 PA de bonus héros en armée de faction). Armée Mercenaire jouable (avec le bonus héros), mais pas de mercenaire dans les armées des autres blocs. Pas d'aéronef, de véhicule capturé ni d'avantage de peloton ; unités avec les compétences Super Human ou Strong Point interdites.

Tous les réglages du format sont dans `data/short-format.json` : budget, bonus, armures maximum, nombre d'escouades facultatives, compétences interdites (`bannedSkills` : nom exact de la compétence et libellé affiché), héros interdits en plus (`bannedHeroes`, noms exacts de la base), textes de mise en place et rappels. Modifiez ce fichier sur GitHub pour faire évoluer le format ; le site suit automatiquement. Il utilise la même base d'unités que le builder complet : une correction d'unité profite aux deux.

Adresse : `https://VOTRE-PSEUDO.github.io/dust-infinite-army-builder/shot.html`

## Mettre le site en ligne (GitHub Pages, gratuit)

1. Créez un compte sur [github.com](https://github.com) si besoin, puis **New repository** : nom `dust-infinite-army-builder`, visibilité **Public**, sans README.
2. Sur la page du dépôt vide, cliquez sur **uploading an existing file**, glissez **tout le contenu** du dossier (pas le dossier lui-même : `index.html` doit être à la racine), puis **Commit changes**.
   - Le dossier `.github` (vérification automatique) est parfois ignoré par le glisser-déposer. Si c'est le cas, créez-le ensuite avec **Add file → Create new file**, nom `.github/workflows/validate.yml`, et collez son contenu.
3. **Settings → Pages** : *Source* = **Deploy from a branch**, *Branch* = `main` / `(root)`, **Save**.
4. Après une à deux minutes, le site est disponible à l'adresse `https://VOTRE-PSEUDO.github.io/dust-infinite-army-builder/`. Partagez ce lien avec votre communauté.

## Corriger une unité (mise à jour de la base)

Toute la base tient dans trois fichiers du dossier `data/` :

| Fichier | Contenu |
|---|---|
| `units.json` | Unités : coût, armure, santé, mouvement, compétences, armes et tables d'attaque |
| `blocs.json` | Blocs, factions et pelotons (TO&E, avantages) |
| `skills.json` | Descriptions des compétences et règles d'armes |
| `photos.json` | Photos de figurines proposées en option (unité, fichier, crédit, licence, cadrage) |
| `pixel.json` | Unités illustrées dans `pixel/`, version (anti-cache) et cadrage éventuel par unité (mis à jour par l'onglet Illustrations de l'éditeur) |

### Méthode recommandée : l'éditeur intégré

1. Ouvrez l'éditeur de base à son adresse privée (volontairement absente des menus du site et de ce README : gardez-la dans vos favoris).
2. Cherchez l'unité, corrigez la fiche (les modifications sont gardées dans votre navigateur en brouillon). **Voir la carte** montre le résultat tel que les joueurs le verront.
3. Onglet **Publier** : vérifiez la liste des changements et le résultat de la vérification.
4. **Publier sur GitHub** avec un jeton d'accès (à créer une seule fois, voir ci-dessous). Le site est à jour une à deux minutes plus tard.

Sans jeton, utilisez **Option 2** : téléchargez les fichiers modifiés et déposez-les dans `data/` via **Add file → Upload files** sur GitHub.

#### Créer le jeton GitHub (une fois)

GitHub → photo de profil → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token** :

- *Repository access* : **Only select repositories** → votre dépôt ;
- *Permissions → Repository permissions → Contents* : **Read and write** ;
- choisissez une date d'expiration, générez, copiez le jeton `github_pat_…` dans l'éditeur.

Ce jeton ne donne accès qu'à ce dépôt. Ne le partagez pas ; en cas de doute, supprimez-le sur GitHub et créez-en un autre.

### Méthode manuelle

Vous pouvez aussi modifier `data/units.json` directement sur github.com (icône crayon). Chaque unité ressemble à ceci :

```json
{
 "id": "allies--pounder",
 "name": "Pounder",
 "subtitle": "M3C Medium Combat Walker, Anti-Tank",
 "bloc": "Allies",
 "type": "vehicle",
 "faction": null,
 "cost": 13,
 "health": 6, "move": 3, "march": 5, "armor": 3,
 "capturable": true,
 "skills": [],
 "customSkills": [],
 "weapons": [
  { "name": "Antitank Gun", "count": 1, "range": 16, "specials": [],
    "vsInfantry": ["B/1", "B/1", "B/1", "B/1"],
    "vsVehicle": ["1/AK", "1/AK", "1/5", "1/4", "1/4", "1/3", "1/3"],
    "vsAircraft": [] }
 ]
}
```

- **Ne changez jamais l'`id`** d'une unité existante : les listes sauvegardées et les pelotons s'y réfèrent. Renommer (`name`) ne pose aucun problème.
- `type` : `infantry`, `vehicle`, `aircraft`, `hero` ou `token`.
- `faction` : `null` pour une unité de bloc, sinon l'id d'une faction de `blocs.json` (`usmc`, `desert-scorpions`, `luftwaffe`, `blutkreuz-korps`, `neue-deutsches-afrika-korps`, `spetsnaz`, `red-guard`, `people-s-liberation-army`).
- Valeurs d'attaque : `dés/dommages` pour chaque classe d'armure (`B`, `BB`, `DB` pour les armes à gabarit, `AK` pour les dommages spéciaux).

### Vérification automatique

À chaque modification de `data/`, GitHub lance `scripts/validate.mjs` (onglet **Actions**). Une croix rouge signale une erreur (id en double, unité inconnue dans un peloton, JSON mal formé…) avec le message détaillé. En local : `node scripts/validate.mjs`.

## Créations de la communauté (CONFIDENTIAL)

Les unités, factions et blocs créés par la communauté (non officiels) sont rangés à part, dans `data/custom.json`. La base officielle n'est jamais modifiée.

- **Dans le builder complet** : la case **CONFIDENTIAL — Inclure les unités et factions custom** se coche à la création de l'armée. Seules ces armées voient les créations : blocs custom dans le choix du bloc, factions custom dans le filtre, unités custom mêlées aux unités officielles de leur faction (elles comptent pour le bonus de faction). Chaque création porte le tampon **CONFIDENTIAL** (carte, catalogue, export texte, impression), et le lien de partage transmet le réglage.
- **Shot Format** : 100 % officiel, les créations n'y apparaissent pas.
- **Format de `custom.json`** : `blocs` (blocs inédits, avec couleur et factions), `factions` (factions custom rattachées à un bloc existant : `bloc`, `id`, `name`), `units` (même format que `units.json`, plus `author` et `approved`), `platoons` (à venir) et `skills` (règles inédites). Les identifiants d'unités commencent obligatoirement par `conf--`.
- **Vérification** : `node scripts/validate.mjs` contrôle aussi `custom.json` (identifiants, bloc et faction de rattachement, valeurs d'attaque, créateur renseigné).
- **Atelier** (`atelier.html`, lien « Atelier » dans l'en-tête du builder) : les joueurs créent leurs unités (à partir de zéro ou d'une unité existante), factions et blocs inédits, voient l'aperçu des cartes, joignent une photo de figurine (réduite automatiquement), acceptent la charte puis exportent un fichier `confidential-<projet>.json` à poster dans le salon Discord `#confidential-units`. Le projet reste dans leur navigateur ; « Importer un fichier » le recharge pour le corriger. Les identifiants sont figés au premier export.
- **À venir** : un onglet « Propositions » dans l'éditeur pour importer ces fichiers, les relire et les approuver.

## Mes images de cartes (personnelles)

Sur l'accueil, **Importer des images** accepte plusieurs fichiers d'un coup. Nommez-les comme l'unité pour une association automatique : `Pounder.jpg`, `Bazooka Joe - verso.jpg` (suffixes reconnus pour le verso : `verso`, `back`, `dos`). Un écran permet de corriger avant d'enregistrer. Les images sont réduites (1 400 px max) et stockées dans le navigateur (IndexedDB) ; elles ne sont jamais publiées. Depuis une fiche d'unité, **Ma carte** permet aussi d'ajouter, remplacer ou retirer une image.

## Image de la carte générée

Chaque carte générée (écran, PNG, PDF) et chaque miniature de la liste affichent, dans cet ordre de priorité :

1. **la photo du joueur**, s'il en a ajouté une et coché « Utiliser ma photo » ;
2. **la photo de la communauté** de l'unité, si elle existe et que le joueur a coché « Utiliser la photo de la communauté » (son crédit s'affiche alors sur la carte) ;
3. **l'illustration pixel art** de l'unité (par défaut) ;
4. **l'icône du type d'unité**, tant que l'unité n'a pas d'illustration.

La miniature de la liste montre toujours l'illustration. Les choix du joueur et sa photo restent dans son navigateur : rien n'est envoyé ni publié. Le Shot Format n'est pas concerné (il garde son affichage actuel).

### Ajouter des illustrations (pixel art)

Les illustrations sont des images **carrées** (le format de la carte, 80 × 80 mm), de n'importe quelle taille : 1 600 × 1 600 px convient très bien. Elles s'ajoutent dans l'**éditeur de base**, onglet **Illustrations** :

1. Glissez vos images dans la zone prévue. Nommez chaque fichier comme l'unité (`Flying_Banana.jpg`) ou avec son id complet (`axis--kaori.jpg`, obligatoire quand plusieurs unités portent le même nom) : l'unité est retrouvée automatiquement, et vous pouvez la corriger dans la liste.
2. Cliquez sur **Ajouter au brouillon**. Les images sont réduites dans le navigateur (vos originaux ne sont pas envoyés) :
   - `pixel/<id>.jpg` : l'image de la carte (1 000 px maximum) ;
   - `pixel/mini/<id>.jpg` : la miniature de la liste (160 px).
3. Vérifiez le **cadrage** de chaque illustration (aperçu en format carré et large).
4. Publiez depuis l'onglet **Publier** : les images et `data/pixel.json` sont envoyés sur GitHub.

Sur la carte, l'illustration remplit la zone photo avec un rognage centré, plus ou moins important selon le format et le nombre d'armes (en format large avec beaucoup d'armes, un tiers à 40 % de la hauteur est coupé). Si le sujet n'est pas au centre de l'image, réglez le cadrage : il est enregistré dans `data/pixel.json` (`focus`, avec `x` et `y` de 0 à 1, 0,5 = centre, et `zoom` 1 ou plus).

### Photos de figurines proposées en option

Ces photos ne sont plus proposées par les joueurs : elles sont ajoutées par l'auteur du projet (ou viennent de l'Atelier, après relecture dans l'onglet Propositions). Dans l'éditeur de base, onglet **Photos** : choisissez l'unité, indiquez le crédit et la licence, sélectionnez l'image, **Ajouter au brouillon**, puis **Publier** (l'image est envoyée dans `photos/` et `data/photos.json` est mis à jour). Le bouton « Crédit et cadrage » règle la photo sur la carte.

Le formulaire **Signaler une erreur d'unité** (`.github/ISSUE_TEMPLATE/`) sert toujours aux corrections de la base.

## Mettre à jour le code sans casser le cache

Les navigateurs gardent les fichiers JS et CSS en cache une dizaine de minutes. Pour éviter qu'un joueur mélange d'anciens et de nouveaux fichiers après une mise à jour (page bloquée sur « Chargement… »), chaque page porte un numéro de version. **Après toute modification d'un fichier `js/` ou `css/`**, lancez :

```bash
node scripts/bump-version.mjs
```

Le script met à jour `index.html`, `shot.html` et l'éditeur ; publiez-les avec les fichiers modifiés. Les modifications de `data/` n'en ont pas besoin (les données sont toujours rechargées).

## Tester sur son ordinateur

Le site charge les fichiers JSON avec `fetch`, il faut donc un petit serveur (ouvrir `index.html` en double-cliquant ne suffit pas) :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Structure

```
index.html          army builder
shot.html           Shot Format (version courte)
(page privée)       éditeur de base, non lié depuis le site
css/                styles
js/app.js           interface du builder
js/rules.js         règles de construction (points, bonus, pelotons, héros…)
js/data.js          chargement de la base
js/validate.js      vérification de la base (éditeur + GitHub)
js/editor.js        éditeur
js/shot.js          Shot Format
data/*.json         la base (units, blocs, skills, photos, pixel)
pixel/              illustrations des unités (<id>.jpg) et miniatures (mini/<id>.jpg)
photos/             photos de figurines proposées en option
js/images.js        images de cartes personnelles (stockage local)
js/cardart.js       image de la carte générée (pixel art, photo, choix du joueur)
.github/            vérification automatique et formulaires de contribution
scripts/validate.mjs
```

## Points connus à vérifier

- `PLA Steel Guards Anti-Tank Squad` / *Heavy Sniper Rifle* : valeur `1/3K` (probablement `1/3`).
- Le peloton *Yakov's Stormwall* référençait « Tesla Gun Squad » : corrigé en « Red Army Tesla Gun Squad » lors de l'import.
- La table des véhicules capturés du livre cite « Heinrich Trop », absent de la base de l'application.
- Les descriptions de règles d'armes (Flame, Laser, Tesla…) ont été résumées en français d'après le livre de règles ; certaines restent à compléter dans `skills.json`.

## Mentions

Outil de fan, non officiel et gratuit. DUST, DUST 1947, les noms, profils et règles appartiennent à leurs ayants droit. Les images officielles des cartes ne sont pas incluses. Les photos de figurines proposées en option restent la propriété de leurs auteurs et sont publiées sous licence CC BY 4.0.
