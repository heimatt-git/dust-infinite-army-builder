// Image de la carte générée (builder complet).
// Par défaut : l'illustration carrée de l'unité (style pixel art), dans le dossier pixel/ :
//   pixel/<id>.jpg        image de la carte (1000 px max)
//   pixel/mini/<id>.jpg   miniature de la liste (160 px)
// La liste des unités illustrées, et un éventuel cadrage par unité, sont dans data/pixel.json.
// En option, choisie par chaque joueur et gardée dans son navigateur :
//   - la photo de la communauté de l'unité (avec son crédit) ;
//   - sa propre photo de figurine (jamais envoyée ni publiée).
// Ordre de priorité : ma photo → photo de la communauté → illustration → icône de type (dessinée par cardgen.js).
import { store } from './ui.js';
import { shrink } from './images.js';

const PREFS_KEY = 'dust1947.cardArt';   // { [idUnité]: { mine, comm, focus } }
const DB_NAME = 'dust1947-cardart';
const STORE = 'photo';
const OWN_MAX_SIDE = 1200;

let listed = new Set();                 // ids des unités qui ont une illustration
let focusById = {};                     // cadrage par unité : { x, y, zoom } (optionnel, 0.5 / 0.5 / 1 par défaut)
let version = '';                       // change quand une image change (évite le cache du navigateur)
let prefs = {};
let db = null;
const own = new Map();                  // id -> objectURL de la photo perso

// ---------------------------------------------------------------- Démarrage
export async function initCardArt() {
  const saved = store.get(PREFS_KEY, {});
  prefs = saved && typeof saved === 'object' ? saved : {};
  try {
    const r = await fetch('data/pixel.json', { cache: 'no-cache' });
    const j = r.ok ? await r.json() : null;
    listed = new Set(Array.isArray(j?.units) ? j.units : []);
    focusById = j?.focus && typeof j.focus === 'object' ? j.focus : {};
    version = j?.version ? String(j.version) : '';
  } catch { listed = new Set(); focusById = {}; }
  try {
    db = await openDB();
    const s = tx('readonly');
    const [keys, vals] = await Promise.all([done(s.getAllKeys()), done(s.getAll())]);
    keys.forEach((k, i) => own.set(k, URL.createObjectURL(vals[i])));
  } catch { db = null; } // navigation privée : la photo perso est simplement indisponible
}

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

// ---------------------------------------------------------------- Illustrations
const q = () => (version ? `?v=${encodeURIComponent(version)}` : '');
export const pixelListed = (id) => listed.has(id);
export const pixelPath = (id) => (listed.has(id) ? `pixel/${id}.jpg${q()}` : null);
export const pixelMini = (id) => (listed.has(id) ? `pixel/mini/${id}.jpg${q()}` : null);
// L'illustration est carrée (ar = 1) : elle remplit la zone photo, rognée au centre ou autour du point de visée de l'unité
function pixelFocus(id) {
  const f = focusById[id] || {};
  const n = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  return { x: n(f.x, 0.5), y: n(f.y, 0.5), zoom: n(f.zoom, 1), ar: 1 };
}

// ---------------------------------------------------------------- Préférences du joueur
export function getPrefs(id) { return { mine: false, comm: false, focus: null, ...(prefs[id] || {}) }; }
export function setPrefs(id, patch) {
  const p = { ...getPrefs(id), ...patch };
  if (!p.mine && !p.comm && !p.focus) delete prefs[id]; else prefs[id] = p;
  store.set(PREFS_KEY, prefs);
}

// ---------------------------------------------------------------- Photo perso (navigateur uniquement)
export const ownPhotoAvailable = () => !!db;
export const ownPhotoURL = (id) => own.get(id) || null;
export async function saveOwnPhoto(id, file) {
  if (!db) throw new Error('storage');
  const blob = await shrink(file, OWN_MAX_SIDE);
  await done(tx('readwrite').put(blob, id));
  if (own.has(id)) URL.revokeObjectURL(own.get(id));
  own.set(id, URL.createObjectURL(blob));
  // Le joueur vient d'ajouter sa photo : on l'utilise tout de suite (il peut décocher la case)
  setPrefs(id, { mine: true, comm: false, focus: null });
}
export async function deleteOwnPhoto(id) {
  if (!db) return;
  await done(tx('readwrite').delete(id));
  if (own.has(id)) { URL.revokeObjectURL(own.get(id)); own.delete(id); }
  setPrefs(id, { mine: false, focus: null });
}

// ---------------------------------------------------------------- Choix de l'image d'une carte
// community : liste de photos communautaires de l'unité (data/photos.json)
// → { kind: 'mine' | 'community' | 'pixel' | 'none', photo, focus, credit }
export function resolveArt(u, community = []) {
  const p = getPrefs(u.id);
  if (p.mine && own.has(u.id)) return { kind: 'mine', photo: own.get(u.id), focus: p.focus || null, credit: null };
  const c = community[0];
  if (p.comm && c) return { kind: 'community', photo: c.file, focus: c.focus || null, credit: { author: c.author, license: c.license } };
  if (listed.has(u.id)) return { kind: 'pixel', photo: pixelPath(u.id), focus: pixelFocus(u.id), credit: null };
  return { kind: 'none', photo: null, focus: null, credit: null };
}
