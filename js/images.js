// Images de cartes personnelles : stockées uniquement dans le navigateur du joueur (IndexedDB).
// Rien n'est envoyé ni publié : chacun ajoute ses propres scans ou photos pour son usage.
import { t } from './i18n.js';

const DB_NAME = 'dust1947-images';
const STORE = 'img';
const MAX_SIDE = 1400;
export const SIDES = { front: 'Recto', back: 'Verso' };

let db = null;
const urls = new Map(); // "unitId|side" -> objectURL
const listeners = new Set();

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const tx = (mode) => db.transaction(STORE, mode).objectStore(STORE);
const done = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export async function initImages() {
  try {
    db = await openDB();
    const store = tx('readonly');
    const [keys, vals] = await Promise.all([done(store.getAllKeys()), done(store.getAll())]);
    keys.forEach((k, i) => urls.set(k, URL.createObjectURL(vals[i])));
    return true;
  } catch {
    db = null; // navigation privée ou stockage bloqué : la fonction est simplement indisponible
    return false;
  }
}
export const imagesAvailable = () => !!db;
export const onImagesChange = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn());

export function imageURL(unitId, side = 'front') { return urls.get(`${unitId}|${side}`) || null; }
export function hasImage(unitId) { return urls.has(`${unitId}|front`) || urls.has(`${unitId}|back`); }
export function imageCount() { return urls.size; }

// Réduit l'image (max 1400 px) et la convertit en JPEG pour économiser l'espace
export async function shrink(file, maxSide = MAX_SIDE) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error(t("{f} n'est pas une image lisible.", { f: file.name }));
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.86));
}

export async function saveImage(unitId, side, file, { silent = false } = {}) {
  if (!db) throw new Error(t("Stockage d'images indisponible dans ce navigateur."));
  const blob = await shrink(file);
  const key = `${unitId}|${side}`;
  await done(tx('readwrite').put(blob, key));
  if (urls.has(key)) URL.revokeObjectURL(urls.get(key));
  urls.set(key, URL.createObjectURL(blob));
  if (!silent) emit();
}

export async function deleteImage(unitId, side) {
  if (!db) return;
  const key = `${unitId}|${side}`;
  await done(tx('readwrite').delete(key));
  if (urls.has(key)) { URL.revokeObjectURL(urls.get(key)); urls.delete(key); }
  emit();
}

export async function clearImages() {
  if (!db) return;
  await done(tx('readwrite').clear());
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls.clear();
  emit();
}

export function storageEstimate() {
  return navigator.storage?.estimate ? navigator.storage.estimate().catch(() => null) : Promise.resolve(null);
}

// ---------------------------------------------------------------- Import groupé
const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const BACK_RE = /([_\-\s.](verso|back|dos|rear|b|2))$/i;
const FRONT_RE = /([_\-\s.](recto|front|face|a|1))$/i;

export function parseFileName(name) {
  let stem = name.replace(/\.[a-z0-9]+$/i, '');
  let side = 'front';
  if (BACK_RE.test(stem)) { side = 'back'; stem = stem.replace(BACK_RE, ''); }
  else if (FRONT_RE.test(stem)) stem = stem.replace(FRONT_RE, '');
  return { key: norm(stem), side };
}

// Associe chaque fichier aux unités dont le nom, l'id ou le nom d'image de l'ancienne appli correspond
export function matchFiles(files, units) {
  const index = new Map();
  const add = (k, u) => { if (!k) return; const a = index.get(k) || []; if (!a.includes(u)) a.push(u); index.set(k, a); };
  for (const u of units) {
    add(norm(u.name), u);
    add(norm(u.image), u);
    add(norm(u.id.split('--')[1]), u);
    add(norm(u.id), u);
  }
  return [...files].map((file) => {
    const { key, side } = parseFileName(file.name);
    return { file, side, units: index.get(key) || [] };
  });
}
