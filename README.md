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
- **Français / anglais** (builder complet et Shot Format) : la langue suit celle du navigateur ; le bouton EN/FR de l'en-tête permet de changer, et le choix vaut pour les deux pages. L'éditeur reste en français. Les textes d'interface se traduisent dans `js/i18n.js`.
- **Éditeur de base** intégré pour corriger une unité et publier la correction en un clic sur GitHub.
- **Mes images de cartes** : chaque joueur peut ajouter ses propres scans ou photos de cartes (recto/verso). Ils restent dans son navigateur, ne sont ni envoyés ni partagés.
- **Photos de la communauté** : photos de figurines peintes proposées par les joueurs, affichées avec leur crédit.

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
| `photos.json` | Photos de la communauté (unité, fichier, crédit, licence) |

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

## Mes images de cartes (personnelles)

Sur l'accueil, **Importer des images** accepte plusieurs fichiers d'un coup. Nommez-les comme l'unité pour une association automatique : `Pounder.jpg`, `Bazooka Joe - verso.jpg` (suffixes reconnus pour le verso : `verso`, `back`, `dos`). Un écran permet de corriger avant d'enregistrer. Les images sont réduites (1 400 px max) et stockées dans le navigateur (IndexedDB) ; elles ne sont jamais publiées. Depuis une fiche d'unité, **Ma carte** permet aussi d'ajouter, remplacer ou retirer une image.

## Photos de la communauté

Les joueurs proposent une photo de leur figurine peinte avec le formulaire **Issues → New issue → Proposer une photo de figurine** du dépôt (un lien direct apparaît sur chaque fiche d'unité du site). Le formulaire exige deux confirmations : photo prise par l'auteur (pas de scan de carte ni d'image officielle) et accord de publication sous licence **CC BY 4.0** avec crédit.

Pour valider une proposition :

1. Ouvrez l'issue, vérifiez l'image et les deux cases cochées, enregistrez l'image (clic droit → enregistrer).
2. **Éditeur de base → Photos** : choisissez l'unité, indiquez le crédit, sélectionnez l'image, **Ajouter au brouillon**.
3. **Publier** : l'image est envoyée dans `photos/` et `data/photos.json` est mis à jour. Fermez l'issue avec un merci.

Pour activer les formulaires, vérifiez que le dossier `.github/ISSUE_TEMPLATE/` est bien présent dans le dépôt et que les **Issues** sont activées (Settings → General → Features). Un second formulaire, **Signaler une erreur d'unité**, sert aux corrections de la base.

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
data/*.json         la base (units, blocs, skills, photos)
photos/             photos de la communauté
js/images.js        images personnelles (stockage local)
.github/            vérification automatique et formulaires de contribution
scripts/validate.mjs
```

## Points connus à vérifier

- `PLA Steel Guards Anti-Tank Squad` / *Heavy Sniper Rifle* : valeur `1/3K` (probablement `1/3`).
- Le peloton *Yakov's Stormwall* référençait « Tesla Gun Squad » : corrigé en « Red Army Tesla Gun Squad » lors de l'import.
- La table des véhicules capturés du livre cite « Heinrich Trop », absent de la base de l'application.
- Les descriptions de règles d'armes (Flame, Laser, Tesla…) ont été résumées en français d'après le livre de règles ; certaines restent à compléter dans `skills.json`.

## Mentions

Outil de fan, non officiel et gratuit. DUST, DUST 1947, les noms, profils et règles appartiennent à leurs ayants droit. Les images officielles des cartes ne sont pas incluses. Les photos de la communauté restent la propriété de leurs auteurs et sont publiées sous licence CC BY 4.0.
