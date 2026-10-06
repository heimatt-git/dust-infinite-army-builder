// Page « Aide » : une courte notice par onglet (builder, Shot Format, Ma collection, Atelier), en français et en anglais.
import { LANG, initLang, setLang } from './i18n.js';
import { esc, store, brandLogo, mountCredit } from './ui.js';

const L = (fr, en) => (LANG === 'en' ? en : fr);

// Chaque section : id, titre, à quoi ça sert, gestes essentiels, pièges
const SECTIONS = () => [
  {
    id: 'builder',
    title: L('Le builder complet', 'The full builder'),
    what: L(
      "Construire une liste d'armée complète pour DUST 194∞, avec les règles de composition vérifiées au fur et à mesure.",
      'Build a complete DUST 194∞ army list, with the composition rules checked as you go.'),
    steps: [
      L("Sur la page d'accueil, donnez un nom à votre armée, choisissez un bloc et une limite de points, puis créez-la.",
        'On the home page, name your army, pick a bloc and a points limit, then create it.'),
      L("Dans l'onglet « Ajouter des unités », filtrez par faction ou tapez un nom ou une compétence, puis ajoutez les unités. Le bouton « Voir la carte » ouvre la fiche d'une unité.",
        'In the “Add units” tab, filter by faction or type a name or skill, then add units. The card button opens a unit’s sheet.'),
      L("L'onglet « Ma liste » range vos unités par peloton. Le bandeau du haut montre les points dépensés et dit si la liste est valide ; une alerte « À corriger » explique ce qui manque.",
        'The “My list” tab arranges your units by platoon. The banner at the top shows the points spent and whether the list is valid; a “Fix” alert explains what is missing.'),
      L("« Partager » donne un lien : la personne qui l'ouvre reçoit une copie de votre liste. « Texte » la copie en texte, « PDF » crée un récapitulatif avec les cartes.",
        '“Share” gives a link: whoever opens it gets a copy of your list. “Text” copies it as text, “PDF” builds a summary with the cards.'),
    ],
    tips: [
      L("Vos listes sont gardées dans ce navigateur. Si vous changez d'appareil ou videz les données du navigateur, utilisez le lien de partage pour les retrouver.",
        'Your lists are kept in this browser. If you switch devices or clear browser data, use the share link to bring them back.'),
      L("Les créations CONFIDENTIAL n'apparaissent que si vous cochez l'option à la création de l'armée.",
        'CONFIDENTIAL creations only appear if you tick the option when creating the army.'),
    ],
  },
  {
    id: 'cartes',
    title: L('Les images des cartes', 'Card images'),
    what: L(
      "Chaque unité a une carte générée à partir de la base, que vous pouvez agrandir et télécharger en PNG. Son image dépend de ce que vous choisissez.",
      'Every unit has a card generated from the database, which you can enlarge and download as a PNG. Its picture depends on your choice.'),
    steps: [
      L("Ouvrez la fiche d'une unité : la carte est en haut, avec le bouton « Télécharger la carte (PNG) ».",
        'Open a unit’s sheet: the card is at the top, with the “Download the card (PNG)” button.'),
      L("Dans « Image de la carte générée », choisissez l'image : votre photo, la photo de la communauté, ou le pixel art. Sans rien choisir, la carte montre le pixel art de l'unité, ou une icône s'il n'existe pas encore.",
        'In “Generated card image”, pick the picture: your photo, the community photo, or the pixel art. With no choice, the card shows the unit’s pixel art, or an icon if none exists yet.'),
      L("« Ajouter ma photo » permet d'envoyer votre propre figurine peinte et de la cadrer avec la souris.",
        '“Add my photo” lets you add your own painted miniature and frame it with the mouse.'),
      L("Les petites vignettes en pixel art dans les listes sont celles des unités qui ont une illustration.",
        'The small pixel-art thumbnails in lists belong to units that have an illustration.'),
    ],
    tips: [
      L("Vos photos et vos choix restent dans ce navigateur : ils ne sont ni envoyés ni partagés.",
        'Your photos and choices stay in this browser: they are neither sent nor shared.'),
      L("« Mes images de la carte officielle » sert à garder vos propres scans pour votre usage personnel ; elles ne sont jamais mises en ligne.",
        '“My official card images” keeps your own scans for personal use; they are never uploaded.'),
    ],
  },
  {
    id: 'shot',
    title: L('Le Shot Format', 'The Shot Format'),
    what: L(
      "Une version courte pour des parties de 30 à 45 minutes : un héros, un à quatre escouades et un véhicule, 40 points (4 points de plus pour le héros dans une armée de faction ou mercenaire).",
      'A short version for 30 to 45 minute games: one hero, one to four squads and one vehicle, 40 points (4 more for the hero in a faction or mercenary army).'),
    steps: [
      L("Choisissez un bloc et créez l'armée. Elle se présente en postes : unité de commandement, unités de combat, véhicule.",
        'Pick a bloc and create the army. It is laid out as slots: command unit, combat units, vehicle.'),
      L("Pour chaque poste, « Choisir » ouvre la liste des unités autorisées. Le bouton « i » à gauche d'une unité montre sa fiche sans quitter la liste.",
        'For each slot, “Choose” opens the list of allowed units. The “i” button beside a unit shows its sheet without leaving the list.'),
      L("Le bandeau indique les points et si l'armée est complète ; la rubrique « Vérification » liste ce qui manque.",
        'The banner shows the points and whether the army is complete; the “Checks” box lists what is missing.'),
      L("Les boutons « Partager », « Fiche de partie », « PDF » et « Texte » servent à envoyer, imprimer ou copier votre liste.",
        'The “Share”, “Game sheet”, “PDF” and “Text” buttons send, print or copy your list.'),
    ],
    tips: [
      L("Pas d'aéronef, pas d'avantage de peloton, pas de héros « surhumain » (Super Human), pas d'unité Strong Point.",
        'No aircraft, no platoon advantage, no “Super Human” heroes, no Strong Point units.'),
      L("Le Shot Format est en test : les retours sont les bienvenus sur le Discord.",
        'The Shot Format is in testing: feedback is welcome on the Discord.'),
    ],
  },
  {
    id: 'collection',
    title: L('Ma collection', 'My collection'),
    what: L(
      "Noter les figurines que vous possédez, pour que vos listes tiennent compte de ce que vous avez vraiment.",
      'Keep track of the miniatures you own, so your lists take into account what you really have.'),
    steps: [
      L("Dans « Ajouter des unités », choisissez un bloc (puis une sous-faction) et ajoutez avec le bouton « + » le nombre d'exemplaires que vous possédez.",
        'In “Add units”, pick a bloc (then a sub-faction) and use the “+” button to add how many copies you own.'),
      L("« Ce que je possède » liste votre collection, groupée par bloc et sous-faction (ou par type avec « Grouper par »). Cliquez sur un titre pour replier un groupe.",
        '“What I own” lists your collection, grouped by bloc and sub-faction (or by type with “Group by”). Click a heading to collapse a group.'),
      L("En haut de la page, « Ajouter les unités d'une liste » puis « Ajouter à ma collection » ajoute d'un coup toutes les unités d'une de vos listes.",
        'At the top of the page, “Add the units of a list” then “Add to my collection” adds every unit of one of your lists at once.'),
      L("Dans une liste d'armée, activez « Ma collection » : vous pouvez ne voir que vos unités, et on vous prévient quand la liste en demande plus que vous n'en avez. Ce n'est jamais bloquant.",
        'In an army list, switch on “My collection”: you can see only your units, and you are warned when the list needs more than you own. It never blocks you.'),
    ],
    tips: [
      L("Votre collection reste dans ce navigateur. Pensez à l'exporter régulièrement avec « Exporter (fichier JSON) » : un navigateur peut vider ses données, surtout sur téléphone. Le fichier sert aussi à la copier sur un autre appareil.",
        'Your collection stays in this browser. Remember to export it now and then with “Export (JSON file)”: a browser can clear its data, especially on a phone. The file also moves it to another device.'),
      L("La collection n'existe pas dans le Shot Format.", 'The collection is not part of the Shot Format.'),
    ],
  },
  {
    id: 'atelier',
    title: L("L'Atelier", 'The Workshop'),
    what: L(
      "Créer vos propres unités, factions et blocs pour DUST 194∞. Ce sont des créations de la communauté, non officielles, marquées CONFIDENTIAL.",
      'Create your own units, factions and blocs for DUST 194∞. They are community creations, unofficial, marked CONFIDENTIAL.'),
    steps: [
      L("Indiquez votre pseudo et un nom de projet : le pseudo sert de crédit sur chaque carte que vous créez.",
        'Enter your nickname and a project name: the nickname is the credit on every card you create.'),
      L("Dans « Unités », créez une unité (ou copiez une unité existante comme modèle), remplissez l'identité, les caractéristiques, les compétences et les armes. L'aperçu de la carte se met à jour sous le formulaire.",
        'In “Units”, create a unit (or copy an existing one as a template), fill in identity, stats, skills and weapons. The card preview updates below the form.'),
      L("Pour les compétences, tapez quelques lettres : les compétences officielles apparaissent avec leur description. Si votre règle n'existe pas, « Créer comme règle inédite » l'ajoute et vous demande de la décrire.",
        'For skills, type a few letters: official skills show up with their description. If your rule does not exist, “Create as a new rule” adds it and asks you to describe it.'),
      L("Quand c'est prêt, « Envoyer » exporte un fichier à poster dans le salon prévu du Discord. Il est relu avant publication.",
        'When ready, “Send” exports a file to post in the dedicated Discord channel. It is reviewed before publication.'),
    ],
    tips: [
      L("Votre projet reste dans ce navigateur tant que vous ne l'exportez pas : exportez-le pour le garder, et rechargez le fichier avec « Reprendre un projet » pour continuer.",
        'Your project stays in this browser until you export it: export it to keep it, and reload the file with “Resume a project” to continue.'),
      L("Dans le builder, les créations CONFIDENTIAL ne se voient que si l'option est cochée ; elles ne sont pas dans le Shot Format.",
        'In the builder, CONFIDENTIAL creations only show if the option is ticked; they are not in the Shot Format.'),
      L("Proposez uniquement vos propres créations, et des photos de vos propres figurines.",
        'Only submit your own creations, and photos of your own miniatures.'),
    ],
  },
  {
    id: 'faq',
    title: L('Questions fréquentes', 'Frequently asked questions'),
    qa: [
      [L("Je ne vois pas de vignette sur une unité.", 'I do not see a thumbnail on a unit.'),
       L("Les vignettes sont celles du pixel art : une unité qui n'a pas encore d'illustration n'en a pas. Sa carte, elle, montre une icône par défaut.",
         'Thumbnails are the pixel art ones: a unit with no illustration yet has none. Its card shows a default icon instead.')],
      [L("J'ai changé d'appareil : où sont mes listes et ma collection ?", 'I changed device: where are my lists and collection?'),
       L("Elles sont gardées dans le navigateur de l'ancien appareil. Utilisez le lien de partage pour une liste, et le fichier d'export pour la collection.",
         'They are kept in the old device’s browser. Use the share link for a list, and the export file for the collection.')],
      [L("Mes photos sont-elles envoyées quelque part ?", 'Are my photos uploaded anywhere?'),
       L("Non. Elles restent dans votre navigateur et ne servent qu'à vos propres cartes.",
         'No. They stay in your browser and are only used for your own cards.')],
      [L("Quelque chose ne marche pas.", 'Something is not working.'),
       L("Rechargez la page avec Ctrl+F5. Si le problème persiste, dites-le sur le Discord en précisant l'appareil et le navigateur.",
         'Reload the page with Ctrl+F5. If the problem persists, say so on the Discord, mentioning your device and browser.')],
    ],
  },
];

initLang();
mountCredit();
render();

function render() {
  const secs = SECTIONS();
  const li = (a) => a.map((x) => `<li>${esc(x)}</li>`).join('');
  document.title = L('DUST 194∞ · Aide', 'DUST 194∞ · Help');
  document.getElementById('app').innerHTML = `
  <header class="topbar">
    <a class="brand with-logo" href="index.html">${brandLogo()}<b>DUST 194∞</b><small>${L('Aide', 'Help')}</small></a>
    <nav class="topnav">
      <a href="index.html">${L('Builder', 'Builder')}</a>
      <a href="index.html#/collection">${L('Ma collection', 'My collection')}</a>
      <a href="shot.html">Shot Format</a>
      <a href="atelier.html">${L('Atelier', 'Workshop')}</a>
      <a href="aide.html" class="on">${L('Aide', 'Help')}</a>
      <button id="lang-btn" type="button" lang="${LANG === 'fr' ? 'en' : 'fr'}" title="${LANG === 'fr' ? 'English version' : 'Version française'}">${LANG === 'fr' ? 'EN' : 'FR'}</button>
      <button id="theme-btn" type="button">${L('Thème', 'Theme')}</button>
    </nav>
  </header>
  <main class="wrap help-page">
    <section class="home-hero">
      <div class="eyebrow">${L('Notice', 'Guide')}</div>
      <h1 class="h-display">${L('Comment ça marche', 'How it works')}</h1>
      <p>${L("Une courte notice par onglet. Rien n'est envoyé sur un serveur : vos listes, votre collection et vos photos restent dans votre navigateur.",
             'A short guide for each tab. Nothing is sent to a server: your lists, collection and photos stay in your browser.')}</p>
    </section>
    <nav class="panel help-toc" aria-label="${L('Sommaire', 'Contents')}">
      ${secs.map((s) => `<a href="#${s.id}" data-go="${s.id}">${esc(s.title)}</a>`).join('')}
    </nav>
    ${secs.map((s) => `<details class="panel help-sec" id="${s.id}" open>
      <summary><h2>${esc(s.title)}</h2></summary>
      ${s.what ? `<p class="help-what">${esc(s.what)}</p>` : ''}
      ${s.steps ? `<h3>${L('Les gestes essentiels', 'The essentials')}</h3><ol>${li(s.steps)}</ol>` : ''}
      ${s.tips ? `<h3>${L('À savoir', 'Good to know')}</h3><ul>${li(s.tips)}</ul>` : ''}
      ${s.qa ? s.qa.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('') : ''}
    </details>`).join('')}
  </main>`;
  document.getElementById('lang-btn').addEventListener('click', () => { setLang(LANG === 'fr' ? 'en' : 'fr'); location.reload(); });
  document.getElementById('theme-btn').addEventListener('click', () => {
    const r = document.documentElement;
    const cur = r.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    r.dataset.theme = cur === 'dark' ? 'light' : 'dark';
    store.set('dust1947.theme', r.dataset.theme);
  });
  const th = store.get('dust1947.theme', null); if (th) document.documentElement.dataset.theme = th;
  // un lien du sommaire ouvre la section visée
  document.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', () => { const d = document.getElementById(a.dataset.go); if (d) d.open = true; }));
  const target = location.hash && document.getElementById(location.hash.slice(1));
  if (target?.tagName === 'DETAILS') { target.open = true; target.scrollIntoView(); }
}
