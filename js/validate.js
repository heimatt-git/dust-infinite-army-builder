// Validation de la base — utilisée par l'éditeur (navigateur) et par la CI GitHub (Node)
export const UNIT_TYPES = ['infantry', 'vehicle', 'aircraft', 'hero', 'token'];
const ATTACK = /^([0-9]+|B|BB|DB)\/([0-9]+|AK)$/;

export function validateData(unitsFile, blocsFile, skills, photos = {}) {
  const errors = [];
  const warnings = [];
  const E = (m) => errors.push(m);
  const W = (m) => warnings.push(m);

  if (!unitsFile || !Array.isArray(unitsFile.units)) { E('units.json : la clé "units" doit être une liste.'); return { errors, warnings }; }
  if (!blocsFile || !Array.isArray(blocsFile.blocs) || !Array.isArray(blocsFile.platoons)) { E('blocs.json : les clés "blocs" et "platoons" doivent être des listes.'); return { errors, warnings }; }
  if (!skills || typeof skills !== 'object' || Array.isArray(skills)) { E('skills.json doit être un objet { "Nom": "Description" }.'); return { errors, warnings }; }

  const blocIds = new Set();
  const factionsByBloc = new Map();
  for (const b of blocsFile.blocs) {
    if (!b.id) { E('Un bloc n\'a pas d\'id.'); continue; }
    if (blocIds.has(b.id)) E(`Bloc en double : ${b.id}`);
    blocIds.add(b.id);
    factionsByBloc.set(b.id, new Set((b.factions || []).map((f) => f.id)));
  }

  const ids = new Set();
  const usedSkills = new Set();
  for (const [i, u] of unitsFile.units.entries()) {
    const where = `Unité « ${u?.name || '#' + i} »`;
    if (!u || typeof u !== 'object') { E(`Entrée #${i} invalide.`); continue; }
    if (!u.id || typeof u.id !== 'string') E(`${where} : id manquant.`);
    else if (ids.has(u.id)) E(`${where} : id en double (${u.id}).`);
    else ids.add(u.id);
    if (!u.name) E(`${where} : nom manquant.`);
    if (!blocIds.has(u.bloc)) E(`${where} : bloc inconnu (${u.bloc}).`);
    if (!UNIT_TYPES.includes(u.type)) E(`${where} : type inconnu (${u.type}).`);
    if (!Number.isInteger(u.cost) || u.cost < 0) E(`${where} : coût invalide (${u.cost}).`);
    if (u.faction && !factionsByBloc.get(u.bloc)?.has(u.faction)) E(`${where} : faction « ${u.faction} » absente du bloc ${u.bloc}.`);
    for (const k of ['armor', 'health', 'move', 'march']) {
      if (u[k] !== null && u[k] !== undefined && !Number.isInteger(u[k]) && !(k === 'health' && /^\d+x\d+$/.test(u[k]))) W(`${where} : ${k} n'est pas un nombre (${u[k]}).`);
    }
    if (u.type !== 'token' && (u.armor === null || u.armor === undefined)) W(`${where} : armure non renseignée.`);
    for (const s of u.skills || []) usedSkills.add(s);
    for (const [j, w] of (u.weapons || []).entries()) {
      if (!w.name) E(`${where} : arme #${j + 1} sans nom.`);
      for (const s of w.specials || []) usedSkills.add(s);
      for (const k of ['vsInfantry', 'vsVehicle', 'vsAircraft']) {
        if (!Array.isArray(w[k])) { E(`${where} / ${w.name} : ${k} doit être une liste.`); continue; }
        for (const v of w[k]) if (!ATTACK.test(v)) W(`${where} / ${w.name} : valeur d'attaque inhabituelle « ${v} » (${k}).`);
      }
    }
  }

  const pids = new Set();
  for (const p of blocsFile.platoons) {
    const where = `Peloton « ${p.name || p.id} »`;
    if (!p.id) E(`${where} : id manquant.`);
    else if (pids.has(p.id)) E(`${where} : id en double.`);
    else pids.add(p.id);
    if (!blocIds.has(p.bloc)) E(`${where} : bloc inconnu (${p.bloc}).`);
    for (const key of ['command', 'combat']) {
      if (!Array.isArray(p[key])) { E(`${where} : "${key}" doit être une liste de postes.`); continue; }
      p[key].forEach((slot, si) => {
        if (!Array.isArray(slot) || !slot.length) { E(`${where} : poste ${key} #${si + 1} vide.`); return; }
        for (const opt of slot) {
          if (!Array.isArray(opt) || !opt.length) { E(`${where} : option vide dans ${key} #${si + 1}.`); continue; }
          for (const id of opt) if (!ids.has(id)) E(`${where} : unité inconnue « ${id} » (${key} #${si + 1}).`);
        }
      });
    }
  }

  for (const s of usedSkills) if (!skills[s]) W(`Compétence sans description : ${s}`);

  if (photos && typeof photos === 'object') {
    for (const [id, arr] of Object.entries(photos)) {
      if (!ids.has(id)) E(`photos.json : unité inconnue « ${id} ».`);
      if (!Array.isArray(arr)) { E(`photos.json / ${id} : doit être une liste.`); continue; }
      for (const ph of arr) {
        if (!ph.file || !/^photos\/[\w.-]+\.(jpe?g|png|webp)$/i.test(ph.file)) E(`photos.json / ${id} : chemin d'image invalide (${ph.file}).`);
        if (!ph.author) E(`photos.json / ${id} : crédit (author) manquant.`);
      }
    }
  }
  return { errors, warnings };
}
