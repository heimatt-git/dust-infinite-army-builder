// Règles de construction d'armée — DUST 1947 (livre de règles p.46-55 + errata/FAQ 02/2019)
import { MERC, unitCost, heroBaseName, canPilot } from './data.js';
import { t, LANG } from './i18n.js';

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
      if (!r.u) warnings.push(t("Unité inconnue retirée de l'analyse ({id}). Elle a peut-être été renommée dans la base.", { id: r.e.u }));
      return !!r.u;
    });

  const total = rows.reduce((s, r) => s + r.cost, 0);

  // --- Légalité des unités
  for (const r of rows) {
    if (r.cat === 'illegal') errors.push(t("{name} n'appartient pas au bloc {bloc} (ni mercenaire, ni véhicule capturé).", { name: r.u.name, bloc: blocName(list.bloc, data) }));
  }
  const captured = rows.filter((r) => r.e.cap);
  if (captured.length > 1) errors.push(t('Un seul véhicule capturé est autorisé ({n} dans la liste).', { n: captured.length }));
  for (const r of captured) {
    if (r.u.type !== 'vehicle') errors.push(t('{name} : seuls les véhicules peuvent être capturés.', { name: r.u.name }));
    else if (!r.u.capturable) warnings.push(t('{name} ne figure pas dans la table des véhicules capturés.', { name: r.u.name }));
    if (r.u.bloc === list.bloc) warnings.push(t('{name} est un véhicule de votre propre bloc : pas besoin de le capturer.', { name: r.u.name }));
  }

  // --- Héros uniques
  const seen = new Map();
  for (const r of rows.filter((r) => r.u.type === 'hero')) {
    const k = heroBaseName(r.u.name);
    if (seen.has(k)) errors.push(t('Héros en double : {a} et {b}. Un héros est unique dans une armée.', { a: seen.get(k), b: r.u.name }));
    else seen.set(k, r.u.name);
  }

  // --- Héros rattachés (escouade / véhicule piloté)
  const byKey = new Map(rows.map((r) => [r.e.k, r]));
  const joinedBy = new Map();
  for (const r of rows.filter((r) => r.e.join)) {
    const tg = byKey.get(r.e.join);
    if (!tg) { warnings.push(t('{name} est rattaché à une unité absente de la liste.', { name: r.u.name })); continue; }
    if (!isJoiner(r.u)) { warnings.push(t("{name} n'est ni un héros ni un commissaire et ne peut pas rejoindre une unité.", { name: r.u.name })); continue; }
    if (tg.u.type === 'infantry' || (tg.u.type === 'hero' && isCommissar(r.u))) {
      if (tg.u.armor !== r.u.armor) errors.push(t("{name} (armure {a}) ne peut rejoindre {target} (armure {b}) : les valeurs d'armure doivent être identiques.", { name: r.u.name, a: r.u.armor, target: tg.u.name, b: tg.u.armor }));
    } else if (tg.u.type === 'vehicle' || tg.u.type === 'aircraft') {
      if (!canPilot(r.u, tg.u)) errors.push(t("{name} n'a pas la compétence nécessaire pour piloter {target}.", { name: r.u.name, target: tg.u.name }));
    } else {
      errors.push(t('{name} ne peut pas rejoindre {target}.', { name: r.u.name, target: tg.u.name }));
    }
    const list2 = joinedBy.get(tg.e.k) || [];
    list2.push(r);
    joinedBy.set(tg.e.k, list2);
  }
  // FAQ : une escouade rejointe par un commissaire de faction appartient à cette faction
  for (const r of rows.filter((r) => isCommissar(r.u) && r.u.faction && r.e.join)) {
    const tg = byKey.get(r.e.join);
    if (tg && tg.cat === 'bloc' && tg.u.type === 'infantry') { tg.cat = 'faction'; tg.fac = r.u.faction; }
  }
  for (const r of rows.filter((r) => isCommissar(r.u) && !r.e.join)) {
    warnings.push(t("{name} (commissaire) doit rejoindre une unité d'infanterie de même armure.", { name: r.u.name }));
  }
  for (const [k, hs] of joinedBy) {
    if (hs.length > 1) {
      const siblings = hs.length === 2 && hs.every((h) => (h.u.skills || []).includes('Siblings'));
      if (!siblings) errors.push(t('{name} est rejoint par {n} héros : un seul autorisé (sauf paire « Siblings »).', { name: byKey.get(k).u.name, n: hs.length }));
    }
  }

  // --- Type d'armée et bonus héros
  const factions = new Set(rows.filter((r) => r.cat === 'faction').map((r) => r.fac));
  let kind = 'none';
  let kindLabel = t('Aucun bonus');
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
      covered = c; kind = 'merc'; kindLabel = t('Armée mercenaire'); share = 1;
    }
  } else if (factions.size > 1) {
    reason = t('Plusieurs factions présentes ({list}) : pas de bonus.', { list: [...factions].map((f) => factionName(f, data)).join(', ') });
  } else if (factions.size === 1) {
    const F = [...factions][0];
    const heroes = rows.filter((r) => r.u.type === 'hero' && (r.cat === 'bloc' || (r.cat === 'faction' && r.fac === F)));
    heroes.sort((a, b) => (a.cat === 'bloc' ? -1 : 1) - (b.cat === 'bloc' ? -1 : 1));
    const { c, coveredBy } = cover(heroes);
    const fPts = rows.filter((r) => r.cat === 'faction').reduce((s, r) => s + r.cost, 0) - coveredBy.faction;
    const base = total - c;
    share = base > 0 ? fPts / base : 0;
    if (share >= FACTION_SHARE) { kind = 'faction'; kindLabel = t('Armée de faction {f}', { f: factionName(F, data) }); covered = c; }
    else reason = t('Faction {f} : {p} % des points (75 % requis pour le bonus).', { f: factionName(F, data), p: Math.round(share * 100) });
  } else {
    const heroes = rows.filter((r) => r.u.type === 'hero' && r.cat === 'bloc');
    const { c } = cover(heroes);
    const bPts = rows.filter((r) => r.cat === 'bloc').reduce((s, r) => s + r.cost, 0) - c;
    const base = total - c;
    share = base > 0 ? bPts / base : 0;
    if (rows.length && share >= FACTION_SHARE) { kind = 'bloc'; kindLabel = t('Armée de bloc {b}', { b: blocName(list.bloc, data) }); covered = c; }
    else if (rows.length) reason = t('Unités du bloc : {p} % des points (75 % requis pour le bonus).', { p: Math.round(share * 100) });
  }

  const counted = total - covered;
  if (counted > limit) errors.push(t('Limite dépassée : {c} pts comptés pour {l} pts autorisés.', { c: counted, l: limit }));

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
    ok: errors.length === 0, overLimit: counted > limit,
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
  const b = data.blocsById.get(id);
  return (LANG === 'en' ? b?.nameEn : b?.name) || id;
}
export function factionName(id, data) {
  return data.factionsById.get(id)?.name || id;
}
