// Ma collection : les figurines que le joueur possède (unité → nombre d'exemplaires).
// Tout reste dans le navigateur (localStorage). Sauvegarde et transfert : fichier JSON (export / import).
// Le lien avec les listes est purement informatif : une liste peut utiliser plus d'exemplaires que
// la collection n'en contient (proxys, achats à venir), on avertit sans jamais bloquer.
import { store } from './ui.js';

const KEY = 'dust1947.collection';
export const MAX_QTY = 99;
export const FILE_TYPE = 'dust194-collection';

let state = null; // { v, units: { id: n }, updated, exported }

function load() {
  if (state) return state;
  const s = store.get(KEY, null);
  const units = {};
  if (s && typeof s === 'object' && s.units && typeof s.units === 'object') {
    for (const [id, n] of Object.entries(s.units)) {
      const q = Math.floor(Number(n));
      if (id && q > 0) units[id] = Math.min(MAX_QTY, q);
    }
  }
  state = { v: 1, units, updated: Number(s?.updated) || 0, exported: Number(s?.exported) || 0 };
  return state;
}
const save = () => store.set(KEY, state);

// ---------------------------------------------------------------- Lecture
export const getQty = (id) => load().units[id] || 0;
export const ownedIds = () => Object.keys(load().units);
export const distinctCount = () => ownedIds().length;
export const totalCount = () => Object.values(load().units).reduce((s, n) => s + n, 0);
export const hasCollection = () => distinctCount() > 0;
export const collectionDates = () => ({ updated: load().updated, exported: load().exported });
// Des modifications n'ont pas encore été exportées
export const needsBackup = () => hasCollection() && load().updated > load().exported;

// ---------------------------------------------------------------- Écriture (renvoie false si le stockage local est indisponible)
export function setQty(id, n) {
  const s = load();
  const q = Math.max(0, Math.min(MAX_QTY, Math.floor(Number(n) || 0)));
  if (q) s.units[id] = q; else delete s.units[id];
  s.updated = Date.now();
  return save();
}
export const addQty = (id, d) => setQty(id, getQty(id) + d);

// Demande au navigateur de ne pas vider ces données (utile surtout sur téléphone)
export function requestPersist() {
  try { navigator.storage?.persist?.(); } catch { /* sans effet */ }
}

// ---------------------------------------------------------------- Lien avec une liste d'armée
// Nombre d'exemplaires utilisés par la liste, par unité
export function usageOf(list) {
  const m = new Map();
  for (const e of list.entries) m.set(e.u, (m.get(e.u) || 0) + 1);
  return m;
}
// Unités pour lesquelles la liste utilise plus d'exemplaires que la collection → [{ id, used, owned, short }]
export function missingFor(list) {
  const out = [];
  for (const [id, used] of usageOf(list)) {
    const owned = getQty(id);
    if (used > owned) out.push({ id, used, owned, short: used - owned });
  }
  return out;
}
// Clés des entrées de la liste qui dépassent ce que le joueur possède (la 3e copie d'une unité possédée en 2 exemplaires…)
export function overEntryKeys(list) {
  const seen = new Map(), over = new Set();
  for (const e of list.entries) {
    const n = (seen.get(e.u) || 0) + 1;
    seen.set(e.u, n);
    if (n > getQty(e.u)) over.add(e.k);
  }
  return over;
}
// Ajoute à la collection les unités d'une liste (sans jamais en retirer) → nombre d'unités modifiées
export function addFromList(list) {
  let n = 0;
  const s = load();
  for (const [id, used] of usageOf(list)) {
    if (used > (s.units[id] || 0)) { s.units[id] = Math.min(MAX_QTY, used); n++; }
  }
  if (n) { s.updated = Date.now(); save(); }
  return n;
}

// ---------------------------------------------------------------- Export / import (fichier JSON)
export function exportText(names = {}) {
  const s = load();
  const units = {};
  for (const id of Object.keys(s.units).sort()) units[id] = s.units[id];
  const out = { app: 'DUST 194∞ Builder', type: FILE_TYPE, version: 1, exported: new Date().toISOString(), units };
  // noms lisibles, pour qui ouvre le fichier (ignorés à l'import)
  const nm = {};
  for (const id of Object.keys(units)) if (names[id]) nm[id] = names[id];
  if (Object.keys(nm).length) out.names = nm;
  return JSON.stringify(out, null, 1) + '\n';
}
export function markExported() {
  const s = load();
  s.exported = Date.now();
  if (s.updated > s.exported) s.updated = s.exported;
  save();
}
export const exportFileName = () => `ma-collection-dust194-${new Date().toISOString().slice(0, 10)}.json`;

// → { units: { id: n }, ignored: [id], error?: 'format' }  (known : ids connus de la base)
export function parseImport(text, known) {
  let j;
  try { j = JSON.parse(text); } catch { return { error: 'format' }; }
  if (!j || typeof j !== 'object' || j.type !== FILE_TYPE || !j.units || typeof j.units !== 'object') return { error: 'format' };
  const units = {}, ignored = [];
  for (const [id, n] of Object.entries(j.units)) {
    const q = Math.floor(Number(n));
    if (!(q > 0)) continue;
    if (known && !known.has(id)) { ignored.push(id); continue; }
    units[id] = Math.min(MAX_QTY, q);
  }
  return { units, ignored };
}
// mode : 'merge' (garde le plus grand nombre pour chaque unité) ou 'replace'
export function applyImport(units, mode) {
  const s = load();
  if (mode === 'replace') s.units = {};
  for (const [id, n] of Object.entries(units)) s.units[id] = mode === 'replace' ? n : Math.max(s.units[id] || 0, n);
  s.updated = Date.now();
  return save();
}
