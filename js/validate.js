// Validation de la base — utilisée par l'éditeur (navigateur) et par la CI GitHub (Node)
import { t } from './i18n.js';

export const UNIT_TYPES = ['infantry', 'vehicle', 'aircraft', 'hero', 'token'];
const ATTACK = /^([0-9]+|B|BB|DB)\/([0-9]+|AK)$/;

// extraIds : identifiants d'unités CONFIDENTIAL (data/custom.json), acceptés pour les photos
export function validateData(unitsFile, blocsFile, skills, photos = {}, extraIds = []) {
  const errors = [];
  const warnings = [];
  const E = (m) => errors.push(m);
  const W = (m) => warnings.push(m);

  if (!unitsFile || !Array.isArray(unitsFile.units)) { E(t('units.json : la clé "units" doit être une liste.')); return { errors, warnings }; }
  if (!blocsFile || !Array.isArray(blocsFile.blocs) || !Array.isArray(blocsFile.platoons)) { E(t('blocs.json : les clés "blocs" et "platoons" doivent être des listes.')); return { errors, warnings }; }
  if (!skills || typeof skills !== 'object' || Array.isArray(skills)) { E(t('skills.json doit être un objet { "Nom": "Description" }.')); return { errors, warnings }; }

  const blocIds = new Set();
  const factionsByBloc = new Map();
  for (const b of blocsFile.blocs) {
    if (!b.id) { E(t("Un bloc n'a pas d'id.")); continue; }
    if (blocIds.has(b.id)) E(t('Bloc en double : {id}', { id: b.id }));
    blocIds.add(b.id);
    factionsByBloc.set(b.id, new Set((b.factions || []).map((f) => f.id)));
  }

  const ids = new Set();
  const usedSkills = new Set();
  for (const [i, u] of unitsFile.units.entries()) {
    const where = t('Unité « {n} »', { n: u?.name || '#' + i });
    if (!u || typeof u !== 'object') { E(t('Entrée #{i} invalide.', { i })); continue; }
    if (!u.id || typeof u.id !== 'string') E(t('{w} : id manquant.', { w: where }));
    else if (ids.has(u.id)) E(t('{w} : id en double ({id}).', { w: where, id: u.id }));
    else ids.add(u.id);
    if (!u.name) E(t('{w} : nom manquant.', { w: where }));
    if (!blocIds.has(u.bloc)) E(t('{w} : bloc inconnu ({b}).', { w: where, b: u.bloc }));
    if (!UNIT_TYPES.includes(u.type)) E(t('{w} : type inconnu ({ty}).', { w: where, ty: u.type }));
    if (!Number.isInteger(u.cost) || u.cost < 0) E(t('{w} : coût invalide ({c}).', { w: where, c: u.cost }));
    if (u.faction && !factionsByBloc.get(u.bloc)?.has(u.faction)) E(t('{w} : faction « {f} » absente du bloc {b}.', { w: where, f: u.faction, b: u.bloc }));
    for (const k of ['armor', 'health', 'move', 'march']) {
      if (u[k] !== null && u[k] !== undefined && !Number.isInteger(u[k]) && !(k === 'health' && /^\d+x\d+$/.test(u[k]))) W(t("{w} : {k} n'est pas un nombre ({v}).", { w: where, k, v: u[k] }));
    }
    if (u.type !== 'token' && (u.armor === null || u.armor === undefined)) W(t('{w} : armure non renseignée.', { w: where }));
    for (const s of u.skills || []) usedSkills.add(s);
    for (const [j, w] of (u.weapons || []).entries()) {
      if (!w.name) E(t('{w} : arme #{n} sans nom.', { w: where, n: j + 1 }));
      for (const s of w.specials || []) usedSkills.add(s);
      for (const k of ['vsInfantry', 'vsVehicle', 'vsAircraft']) {
        if (!Array.isArray(w[k])) { E(t('{w} / {a} : {k} doit être une liste.', { w: where, a: w.name, k })); continue; }
        for (const v of w[k]) if (!ATTACK.test(v)) W(t("{w} / {a} : valeur d'attaque inhabituelle « {v} » ({k}).", { w: where, a: w.name, v, k }));
      }
    }
  }

  const pids = new Set();
  for (const p of blocsFile.platoons) {
    const where = t('Peloton « {n} »', { n: p.name || p.id });
    if (!p.id) E(t('{w} : id manquant.', { w: where }));
    else if (pids.has(p.id)) E(t('{w} : id en double.', { w: where }));
    else pids.add(p.id);
    if (!blocIds.has(p.bloc)) E(t('{w} : bloc inconnu ({b}).', { w: where, b: p.bloc }));
    for (const key of ['command', 'combat']) {
      if (!Array.isArray(p[key])) { E(t('{w} : "{k}" doit être une liste de postes.', { w: where, k: key })); continue; }
      p[key].forEach((slot, si) => {
        if (!Array.isArray(slot) || !slot.length) { E(t('{w} : poste {k} #{n} vide.', { w: where, k: key, n: si + 1 })); return; }
        for (const opt of slot) {
          if (!Array.isArray(opt) || !opt.length) { E(t('{w} : option vide dans {k} #{n}.', { w: where, k: key, n: si + 1 })); continue; }
          for (const id of opt) if (!ids.has(id)) E(t('{w} : unité inconnue « {id} » ({k} #{n}).', { w: where, id, k: key, n: si + 1 }));
        }
      });
    }
  }

  for (const s of usedSkills) if (!skills[s]) W(t('Compétence sans description : {s}', { s }));

  if (photos && typeof photos === 'object') {
    for (const [id, arr] of Object.entries(photos)) {
      if (!ids.has(id) && !extraIds.includes(id)) E(t('photos.json : unité inconnue « {id} ».', { id }));
      if (!Array.isArray(arr)) { E(t('photos.json / {id} : doit être une liste.', { id })); continue; }
      for (const ph of arr) {
        if (!ph.file || !/^photos\/[\w.-]+\.(jpe?g|png|webp)$/i.test(ph.file)) E(t("photos.json / {id} : chemin d'image invalide ({f}).", { id, f: ph.file }));
        if (!ph.author) E(t('photos.json / {id} : crédit (author) manquant.', { id }));
      }
    }
  }
  return { errors, warnings };
}

// Vérification de data/custom.json (créations CONFIDENTIAL) : mêmes règles que la base officielle,
// plus des identifiants préfixés « conf-- » qui ne doivent jamais entrer en collision avec l'officiel.
export function validateCustom(custom, unitsFile, blocsFile, skills) {
  const errors = [];
  const warnings = [];
  if (!custom || typeof custom !== 'object') return { errors: [t('custom.json doit être un objet.')], warnings };
  for (const k of ['blocs', 'factions', 'units', 'platoons']) {
    if (custom[k] !== undefined && !Array.isArray(custom[k])) errors.push(t('custom.json : la clé « {k} » doit être une liste.', { k }));
  }
  if (errors.length) return { errors, warnings };
  const offIds = new Set(unitsFile.units.map((u) => u.id));
  const offBlocs = new Set(blocsFile.blocs.map((b) => b.id));
  const offFactions = new Set(blocsFile.blocs.flatMap((b) => (b.factions || []).map((f) => f.id)));
  const cBlocs = custom.blocs || [], cFactions = custom.factions || [], cUnits = custom.units || [];
  for (const b of cBlocs) {
    if (offBlocs.has(b.id)) errors.push(t('custom.json : le bloc « {id} » existe déjà dans la base officielle.', { id: b.id }));
    if (!b.color) warnings.push(t('custom.json : le bloc « {id} » n\'a pas de couleur.', { id: b.id }));
  }
  const allBlocs = new Set([...offBlocs, ...cBlocs.map((b) => b.id)]);
  for (const f of cFactions) {
    if (!f.id || !f.name) errors.push(t('custom.json : une faction n\'a pas d\'id ou de nom.'));
    if (!allBlocs.has(f.bloc)) errors.push(t('custom.json : la faction « {id} » est rattachée à un bloc inconnu ({b}).', { id: f.id, b: f.bloc }));
    if (offFactions.has(f.id)) errors.push(t('custom.json : la faction « {id} » existe déjà dans la base officielle.', { id: f.id }));
  }
  for (const u of cUnits) {
    if (!String(u.id || '').startsWith('conf--')) errors.push(t('custom.json : l\'id « {id} » doit commencer par « conf-- ».', { id: u.id }));
    if (offIds.has(u.id)) errors.push(t('custom.json : l\'id « {id} » existe déjà dans la base officielle.', { id: u.id }));
    if (!u.author) warnings.push(t('custom.json : créateur non renseigné pour « {n} ».', { n: u.name || u.id }));
  }
  // Mêmes contrôles que la base officielle, sur la base fusionnée ; on ne garde que les messages nouveaux
  const merged = {
    units: { units: [...unitsFile.units, ...cUnits] },
    blocs: {
      blocs: [...blocsFile.blocs.map((b) => ({ ...b, factions: [...(b.factions || []), ...cFactions.filter((f) => f.bloc === b.id)] })),
        ...cBlocs.map((b) => ({ ...b, factions: [...(b.factions || []), ...cFactions.filter((f) => f.bloc === b.id)] }))],
      platoons: [...blocsFile.platoons, ...(custom.platoons || [])],
    },
    skills: { ...(custom.skills || {}), ...skills },
  };
  const before = validateData(unitsFile, blocsFile, skills);
  const after = validateData(merged.units, merged.blocs, merged.skills);
  const seenE = new Set(before.errors), seenW = new Set(before.warnings);
  errors.push(...after.errors.filter((m) => !seenE.has(m)));
  warnings.push(...after.warnings.filter((m) => !seenW.has(m)));
  return { errors, warnings };
}
