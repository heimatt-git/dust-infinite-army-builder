// Règles de construction d'armée — DUST 1947 (livre de règles p.46-55 + errata/FAQ 02/2019)
import { MERC, unitCost, heroBaseName, canPilot } from './data.js';

export const CAPTURED_SURCHARGE = 2;
export const BONUS_RATE = 0.10;
export const FACTION_SHARE = 0.75;

export function entryCost(entry, data) {
  const u = data.unitsById.get(entry.u);
  if (!u) return 0;
  return unitCost(u) + (entry.cap ? CAPTURED_SURCHARGE : 0);
}

// Catégorie d'une entrée vis-à-vis du bloc de l'armée
export function entryCategory(entry, list, data) {
  const u = data.unitsById.get(entry.u);
  if (!u) return 'unknown';
  if (entry.cap) return 'captured';
  if (list.bloc === MERC) return u.bloc === MERC ? 'bloc' : 'illegal';
  if (u.bloc === MERC) return 'merc';
  if (u.bloc !== list.bloc) return 'illegal';
  return u.faction ? 'faction' : 'bloc';
}

/**
 * Analyse complète d'une liste.
 * Retourne points, bonus héros, type d'armée, état des pelotons, erreurs et avertissements.
 */
export function analyzeArmy(list, data) {
  const errors = [];
  const warnings = [];
  const limit = Math.max(0, Number(list.limit) || 0);
  const pool = Math.floor(limit * BONUS_RATE);
  const rows = list.entries
    .map((e) => { const u = data.unitsById.get(e.u); return { e, u, fac: u?.faction || null, cost: entryCost(e, data), cat: entryCategory(e, list, data) }; })
    .filter((r) => {
      if (!r.u) warnings.push(`Unité inconnue retirée de l'analyse (${r.e.u}). Elle a peut-être été renommée dans la base.`);
      return !!r.u;
    });

  const total = rows.reduce((s, r) => s + r.cost, 0);

  // --- Légalité des unités
  for (const r of rows) {
    if (r.cat === 'illegal') errors.push(`${r.u.name} n'appartient pas au bloc ${blocName(list.bloc, data)} (ni mercenaire, ni véhicule capturé).`);
  }
  const captured = rows.filter((r) => r.e.cap);
  if (captured.length > 1) errors.push(`Un seul véhicule capturé est autorisé (${captured.length} dans la liste).`);
  for (const r of captured) {
    if (r.u.type !== 'vehicle') errors.push(`${r.u.name} : seuls les véhicules peuvent être capturés.`);
    else if (!r.u.capturable) warnings.push(`${r.u.name} ne figure pas dans la table des véhicules capturés.`);
    if (r.u.bloc === list.bloc) warnings.push(`${r.u.name} est un véhicule de votre propre bloc : pas besoin de le capturer.`);
  }

  // --- Héros uniques
  const seen = new Map();
  for (const r of rows.filter((r) => r.u.type === 'hero')) {
    const k = heroBaseName(r.u.name);
    if (seen.has(k)) errors.push(`Héros en double : ${seen.get(k)} et ${r.u.name}. Un héros est unique dans une armée.`);
    else seen.set(k, r.u.name);
  }

  // --- Héros rattachés (escouade / véhicule piloté)
  const byKey = new Map(rows.map((r) => [r.e.k, r]));
  const joinedBy = new Map();
  for (const r of rows.filter((r) => r.e.join)) {
    const t = byKey.get(r.e.join);
    if (!t) { warnings.push(`${r.u.name} est rattaché à une unité absente de la liste.`); continue; }
    if (!isJoiner(r.u)) { warnings.push(`${r.u.name} n'est ni un héros ni un commissaire et ne peut pas rejoindre une unité.`); continue; }
    if (t.u.type === 'infantry' || (t.u.type === 'hero' && isCommissar(r.u))) {
      if (t.u.armor !== r.u.armor) errors.push(`${r.u.name} (armure ${r.u.armor}) ne peut rejoindre ${t.u.name} (armure ${t.u.armor}) : les valeurs d'armure doivent être identiques.`);
    } else if (t.u.type === 'vehicle' || t.u.type === 'aircraft') {
      if (!canPilot(r.u, t.u)) errors.push(`${r.u.name} n'a pas la compétence nécessaire pour piloter ${t.u.name}.`);
    } else {
      errors.push(`${r.u.name} ne peut pas rejoindre ${t.u.name}.`);
    }
    const list2 = joinedBy.get(t.e.k) || [];
    list2.push(r);
    joinedBy.set(t.e.k, list2);
  }
  // FAQ : une escouade rejointe par un commissaire de faction appartient à cette faction
  for (const r of rows.filter((r) => isCommissar(r.u) && r.u.faction && r.e.join)) {
    const t = byKey.get(r.e.join);
    if (t && t.cat === 'bloc' && t.u.type === 'infantry') { t.cat = 'faction'; t.fac = r.u.faction; }
  }
  for (const r of rows.filter((r) => isCommissar(r.u) && !r.e.join)) {
    warnings.push(`${r.u.name} (commissaire) doit rejoindre une unité d'infanterie de même armure.`);
  }
  for (const [k, hs] of joinedBy) {
    if (hs.length > 1) {
      const siblings = hs.length === 2 && hs.every((h) => (h.u.skills || []).includes('Siblings'));
      if (!siblings) errors.push(`${byKey.get(k).u.name} est rejoint par ${hs.length} héros : un seul autorisé (sauf paire « Siblings »).`);
    }
  }

  // --- Type d'armée et bonus héros
  const factions = new Set(rows.filter((r) => r.cat === 'faction').map((r) => r.fac));
  let kind = 'none';
  let kindLabel = 'Aucun bonus';
  let covered = 0;
  let share = 0;
  let reason = '';

  const cover = (eligibleRows) => {
    let left = pool;
    let c = 0;
    const coveredBy = { bloc: 0, faction: 0 };
    for (const r of eligibleRows) {
      if (left <= 0) break;
      const use = Math.min(left, r.cost);
      left -= use; c += use;
      coveredBy[r.cat === 'faction' ? 'faction' : 'bloc'] += use;
    }
    return { c, coveredBy };
  };

  if (list.bloc === MERC) {
    const allMerc = rows.every((r) => r.cat === 'bloc' || r.cat === 'captured');
    if (rows.length && allMerc) {
      const { c } = cover(rows.filter((r) => r.u.type === 'hero' && r.cat === 'bloc'));
      covered = c; kind = 'merc'; kindLabel = 'Armée mercenaire'; share = 1;
    }
  } else if (factions.size > 1) {
    reason = `Plusieurs factions présentes (${[...factions].map((f) => factionName(f, data)).join(', ')}) : pas de bonus.`;
  } else if (factions.size === 1) {
    const F = [...factions][0];
    const heroes = rows.filter((r) => r.u.type === 'hero' && (r.cat === 'bloc' || (r.cat === 'faction' && r.fac === F)));
    heroes.sort((a, b) => (a.cat === 'bloc' ? -1 : 1) - (b.cat === 'bloc' ? -1 : 1));
    const { c, coveredBy } = cover(heroes);
    const fPts = rows.filter((r) => r.cat === 'faction').reduce((s, r) => s + r.cost, 0) - coveredBy.faction;
    const base = total - c;
    share = base > 0 ? fPts / base : 0;
    if (share >= FACTION_SHARE) { kind = 'faction'; kindLabel = `Armée de faction ${factionName(F, data)}`; covered = c; }
    else reason = `Faction ${factionName(F, data)} : ${Math.round(share * 100)} % des points (75 % requis pour le bonus).`;
  } else {
    const heroes = rows.filter((r) => r.u.type === 'hero' && r.cat === 'bloc');
    const { c } = cover(heroes);
    const bPts = rows.filter((r) => r.cat === 'bloc').reduce((s, r) => s + r.cost, 0) - c;
    const base = total - c;
    share = base > 0 ? bPts / base : 0;
    if (rows.length && share >= FACTION_SHARE) { kind = 'bloc'; kindLabel = `Armée de bloc ${blocName(list.bloc, data)}`; covered = c; }
    else if (rows.length) reason = `Unités du bloc : ${Math.round(share * 100)} % des points (75 % requis pour le bonus).`;
  }

  const counted = total - covered;
  if (counted > limit) errors.push(`Limite dépassée : ${counted} pts comptés pour ${limit} pts autorisés.`);

  // --- Pelotons
  const platoonStatus = (list.platoons || []).map((pi) => analyzePlatoon(pi, list, rows, data));
  for (const ps of platoonStatus) {
    if (!ps.platoon) { warnings.push('Un peloton de la liste n\'existe plus dans la base.'); continue; }
    if (!ps.complete) warnings.push(`${ps.platoon.name} : ${ps.missing} poste(s) requis vide(s). L'avantage de peloton ne s'applique pas.`);
    if (ps.mercCount > 1) errors.push(`${ps.platoon.name} : une seule unité de combat peut être remplacée par un mercenaire.`);
    for (const m of ps.issues) warnings.push(`${ps.platoon.name} : ${m}`);
  }

  return {
    total, counted, limit, pool, covered, kind, kindLabel, share, reason,
    factions: [...factions], errors, warnings, platoonStatus,
    ok: errors.length === 0,
  };
}

export function analyzePlatoon(pi, list, rows, data) {
  const platoon = data.platoonsById.get(pi.p);
  const res = { key: pi.k, platoon, complete: false, missing: 0, mercCount: 0, issues: [], members: [] };
  if (!platoon) return res;
  const mine = rows.filter((r) => r.e.pl === pi.k);
  res.members = mine;
  const slots = [...platoon.command.map((_, i) => 'cmd' + i), ...platoon.combat.map((_, i) => 'c' + i)];
  for (const s of slots) {
    const filled = mine.some((r) => r.e.role === s);
    if (!filled) res.missing++;
  }
  res.complete = res.missing === 0;
  res.mercCount = mine.filter((r) => r.e.merc).length;
  if (platoon.onlyCombatUnitsAsSupport) {
    const combatIds = new Set(platoon.combat.flat(2));
    for (const r of mine.filter((r) => r.e.role === 'sup')) {
      if (!combatIds.has(r.u.id)) res.issues.push(`${r.u.name} ne peut pas être en soutien (seules les unités de combat du peloton sont autorisées).`);
    }
  }
  return res;
}

export const isCommissar = (u) => (u.skills || []).includes('Commissar');
export const isJoiner = (u) => u.type === 'hero' || isCommissar(u);

export function blocName(id, data) {
  return data.blocsById.get(id)?.name || id;
}
export function factionName(id, data) {
  return data.factionsById.get(id)?.name || id;
}
