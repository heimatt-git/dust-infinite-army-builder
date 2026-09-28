// Traductions FR → EN. La langue par défaut reste le français (builder complet, éditeur) ;
// seule la page Shot Format appelle initLang() pour suivre le navigateur ou le choix du joueur.
const LANG_KEY = 'dust1947.lang';
export let LANG = 'fr';

export function initLang() {
  let l = null;
  try { l = JSON.parse(localStorage.getItem(LANG_KEY) || 'null'); } catch { /* stockage indisponible */ }
  if (l !== 'fr' && l !== 'en') l = (navigator.languages?.[0] || navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  LANG = l;
  document.documentElement.lang = l;
  return l;
}
export function setLang(l) {
  try { localStorage.setItem(LANG_KEY, JSON.stringify(l)); } catch { /* stockage indisponible */ }
  LANG = l;
}

// t('texte français avec {var}', { var }) → texte dans la langue courante
export function t(fr, vars) {
  let s = LANG === 'en' && EN[fr] !== undefined ? EN[fr] : fr;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
}

const EN = {
  // Types d'unités
  'Infanterie': 'Infantry', 'Véhicule': 'Vehicle', 'Aéronef': 'Aircraft', 'Héros': 'Hero', 'Objet': 'Token',

  // Interface commune
  'Copié dans le presse-papiers': 'Copied to clipboard',
  'Copie refusée par le navigateur : le texte est sélectionné, faites Ctrl+C.': 'The browser blocked copying: the text is selected, press Ctrl+C.',
  'Fermer': 'Close', 'Annuler': 'Undo',
  'Face « bloc »': '“Block” face', 'Face « viseur »': '“Sight” face', 'Face « bouclier »': '“Shield” face',

  // Carte d'unité
  'Capturé (+2)': 'Captured (+2)', 'Capturable': 'Capturable',
  'Points': 'Points', 'Armure': 'Armor', 'Santé': 'Health', 'Mouv.': 'Move', 'Marche': 'March',
  'Armes': 'Weapons', 'Arme': 'Weapon', 'Nb': 'Qty', 'Portée': 'Range',
  'vs Infanterie': 'vs Infantry', 'vs Véhicule': 'vs Vehicle', 'vs Aéronef': 'vs Aircraft',
  'munitions {n}': 'ammo {n}',
  "Chaque case indique <b>dés / dommages</b> contre la classe d'armure correspondante (1 à 4 pour l'infanterie, 1 à 7 pour les véhicules). « B », « BB », « DB » : attaques à gabarit (zone), voir le livre de règles.":
    'Each cell shows <b>dice / damage</b> against the matching armor class (1–4 for infantry, 1–7 for vehicles). “B”, “BB”, “DB”: template (area) attacks, see the rulebook.',
  'Compétences': 'Skills', "règle d'arme": 'weapon rule',
  'Description absente de la base (voir le livre de règles).': 'No description in the database (see the rulebook).',
  "Règle d'arme spéciale : voir « Armes spéciales » dans le livre de règles.": 'Special weapon rule: see “Special Weapons” in the rulebook.',

  // Règles de construction
  "Unité inconnue retirée de l'analyse ({id}). Elle a peut-être été renommée dans la base.": 'Unknown unit ignored ({id}). It may have been renamed in the database.',
  "{name} n'appartient pas au bloc {bloc} (ni mercenaire, ni véhicule capturé).": '{name} is not part of the {bloc} bloc (neither mercenary nor captured vehicle).',
  'Un seul véhicule capturé est autorisé ({n} dans la liste).': 'Only one captured vehicle is allowed ({n} in the list).',
  '{name} : seuls les véhicules peuvent être capturés.': '{name}: only vehicles can be captured.',
  '{name} ne figure pas dans la table des véhicules capturés.': '{name} is not in the captured vehicles table.',
  '{name} est un véhicule de votre propre bloc : pas besoin de le capturer.': '{name} belongs to your own bloc: no need to capture it.',
  'Héros en double : {a} et {b}. Un héros est unique dans une armée.': 'Duplicate hero: {a} and {b}. A hero is unique in an army.',
  '{name} est rattaché à une unité absente de la liste.': '{name} is attached to a unit that is not in the list.',
  "{name} n'est ni un héros ni un commissaire et ne peut pas rejoindre une unité.": '{name} is neither a hero nor a commissar and cannot join a unit.',
  "{name} (armure {a}) ne peut rejoindre {target} (armure {b}) : les valeurs d'armure doivent être identiques.": '{name} (armor {a}) cannot join {target} (armor {b}): armor values must match.',
  "{name} n'a pas la compétence nécessaire pour piloter {target}.": '{name} lacks the skill required to pilot {target}.',
  '{name} ne peut pas rejoindre {target}.': '{name} cannot join {target}.',
  "{name} (commissaire) doit rejoindre une unité d'infanterie de même armure.": '{name} (commissar) must join an infantry unit with the same armor.',
  '{name} est rejoint par {n} héros : un seul autorisé (sauf paire « Siblings »).': '{name} is joined by {n} heroes: only one allowed (except a “Siblings” pair).',
  'Aucun bonus': 'No bonus', 'Armée mercenaire': 'Mercenary army',
  'Plusieurs factions présentes ({list}) : pas de bonus.': 'Several factions present ({list}): no bonus.',
  'Armée de faction {f}': '{f} faction army',
  'Faction {f} : {p} % des points (75 % requis pour le bonus).': '{f} faction: {p}% of points (75% required for the bonus).',
  'Armée de bloc {b}': '{b} bloc army',
  'Unités du bloc : {p} % des points (75 % requis pour le bonus).': 'Bloc units: {p}% of points (75% required for the bonus).',
  'Limite dépassée : {c} pts comptés pour {l} pts autorisés.': 'Limit exceeded: {c} pts counted for {l} pts allowed.',

  // Shot Format
  'Impossible de charger la base : {e}': 'Could not load the database: {e}',
  'Sauvegarde locale indisponible : utilisez « Partager » pour garder votre liste.': 'Local saving unavailable: use “Share” to keep your list.',
  'Unité de commandement': 'Command unit', 'Commandement': 'Command', 'Un héros': 'One hero',
  'Unité de combat {n}': 'Combat unit {n}', 'Combat {n}': 'Combat {n}',
  'Escouade, armure {n} max.': 'Squad, armor {n} max.',
  "Armure {n} max., pas d'aéronef": 'Armor {n} max., no aircraft',
  '{x} interdit': '{x} not allowed', 'héros interdit dans ce format': 'hero not allowed in this format',
  '{slot} : obligatoire.': '{slot}: required.',
  "n'appartient pas au bloc {b}": 'not part of the {b} bloc',
  'type non autorisé ({t})': 'type not allowed ({t})',
  'armure {a} (max. {m})': 'armor {a} (max. {m})',
  'Budget : {c} / {b} PA': 'Budget: {c} / {b} AP',
  ' (+{n} PA de bonus sur le héros)': ' (+{n} bonus AP on the hero)',
  '{k} : bonus de {n} PA réservé au héros.': '{k}: {n} bonus AP reserved for the hero.',
  "{list} ont Spy ou Airborne : une seule unité pourra s'en servir, et seulement au tour 1.": '{list} have Spy or Airborne: only one unit may use it, and only on turn 1.',
  "{name} a Spy ou Airborne : utilisable au tour 1 uniquement. En cas d'échec, entrée au tour 2 par votre zone de déploiement.": '{name} has Spy or Airborne: usable on turn 1 only. If the roll fails, it enters on turn 2 from your deployment zone.',
  'Retour aux listes': 'Back to lists', 'Builder complet': 'Full builder', 'Thème': 'Theme',
  'Passer en anglais': 'Switch to French',
  'par {by}': 'by {by}',
  'Des parties courtes, {d}. Un héros, une à quatre escouades, un véhicule : <b>{b} PA</b>, +{h} PA pour le héros en armée de faction.':
    'Short games, {d}. One hero, one to four squads, one vehicle: <b>{b} AP</b>, +{h} AP for the hero in a faction army.',
  'Nouvelle armée': 'New army', 'Nom (facultatif)': 'Name (optional)', "Nom de l'armée": 'Army name', 'Créer': 'Create',
  'Mes armées ({n})': 'My armies ({n})', 'valide': 'valid', 'incomplète': 'incomplete',
  'Supprimer {n}': 'Delete {n}', 'Supprimer ?': 'Delete?',
  "Aucune armée pour l'instant.": 'No army yet.',
  '« {n} » supprimée': '“{n}” deleted',
  'Règles du format': 'Format rules',
  'Donner mon avis': 'Give feedback', 'Version de test': 'Test version',
  'Mise en place': 'Setup', 'Composition': 'Army composition', 'Restrictions': 'Restrictions',
  '1 unité de commandement obligatoire : un héros. Il peut rejoindre une escouade de même armure, ou piloter le véhicule si ses compétences le permettent.':
    '1 mandatory command unit: a hero. It can join a squad with the same armor, or pilot the vehicle if its skills allow it.',
  '1 escouade obligatoire, armure {n} max.': '1 mandatory squad, armor {n} max.',
  '0 à {c} escouades supplémentaires, armure {n} max.': '0 to {c} additional squads, armor {n} max.',
  '1 véhicule obligatoire, armure {n} max.': '1 mandatory vehicle, armor {n} max.',
  "{b} PA, +{h} PA (10 %) pour le héros si l'armée respecte les règles de faction (livre DUST 1947).":
    '{b} AP, +{h} AP (10%) for the hero if the army follows the faction rules (DUST 1947 rulebook).',
  'Ni mercenaire, ni véhicule capturé.': 'No mercenaries, no captured vehicles.',
  'Interdits : {list}.': 'Not allowed: {list}.',
  'Résumé': 'Summary', 'PA': 'AP', 'Prête à jouer': 'Ready to play', 'Incomplète': 'Incomplete', '+{n} PA héros': '+{n} AP hero',
  'Vérification': 'Checks', 'Partager': 'Share', 'Fiche de partie': 'Game sheet', 'Texte': 'Text',
  'Placement': 'Placement', 'Rattacher le héros': 'Attach the hero', 'Seul': 'Alone', 'Pilote': 'Pilots', 'Rejoint': 'Joins',
  'Aucune escouade de même armure ni véhicule pilotable : le héros joue seul.': 'No squad with the same armor and no vehicle it can pilot: the hero plays alone.',
  'Obligatoire': 'Required', 'Facultative': 'Optional',
  'Armure {n}': 'Armor {n}', 'Arm. {n}': 'Arm. {n}',
  'Changer': 'Change', 'Retirer': 'Remove', '+ Choisir': '+ Choose',
  'Export': 'Export', 'Liste en texte': 'List as text', 'Copier': 'Copy',
  'Toutes': 'All', 'Bloc': 'Bloc',
  'Aucune unité ne correspond à ce filtre.': 'No unit matches this filter.',
  'Aucune unité autorisée pour ce poste dans ce bloc.': 'No unit allowed for this slot in this bloc.',
  'Il vous reste environ {n} PA': 'About {n} AP left', ' (bonus héros compris)': ' (hero bonus included)',
  'Filtrer par sous-faction': 'Filter by sub-faction', 'Rechercher': 'Search', 'Rechercher une unité': 'Search for a unit',
  '« {n} » importée': '“{n}” imported', 'Lien de liste invalide.': 'Invalid list link.',
  "Lien de l'armée": 'Army link', 'Votre adversaire reçoit une copie de votre armée.': 'Your opponent gets a copy of your army.',
  'Copier le lien': 'Copy link',
  ' (+{n} bonus héros)': ' (+{n} hero bonus)', 'pilote': 'pilots', 'rejoint': 'joins',
  'À compléter : ': 'To complete: ', 'Rappels': 'Reminders',
  'Santé {n}': 'Health {n}',
  '{s} PA dépensés − {b} PA de bonus HQ = {c} / {l} PA': '{s} AP spent − {b} AP HQ bonus = {c} / {l} AP',
  '{c} / {l} PA': '{c} / {l} AP',
  ' : {n} PA de trop': ': {n} AP over',
  'Budget : ': 'Budget: ',
  '{k} : {n} PA de bonus déduits du coût du HQ ({hq}).': '{k}: {n} bonus AP deducted from the HQ cost ({hq}).',
  "{k} : jusqu'à {n} PA de bonus déduits du coût du HQ.": '{k}: up to {n} bonus AP deducted from the HQ cost.',
  'Pas de bonus : {r}': 'No bonus: {r}',
  '{s} dépensés − {b} bonus HQ': '{s} spent − {b} HQ bonus',
  '{n} PA de trop': '{n} AP over',
  'bonus −{n}': 'bonus −{n}',
  ' ({s} dépensés, −{b} bonus HQ)': ' ({s} spent, −{b} HQ bonus)',
};
