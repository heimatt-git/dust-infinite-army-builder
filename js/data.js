import { t } from './i18n.js';
// Chargement et indexation de la base (data/*.json)

export const TYPE_LABELS = {
  infantry: 'Infanterie',
  vehicle: 'Véhicule',
  aircraft: 'Aéronef',
  hero: 'Héros',
  token: 'Objet',
};

export const typeLabel = (type) => t(TYPE_LABELS[type] || type);

export const MERC = 'Mercenaries';

export async function loadData(base = 'data/') {
  const get = (f) => fetch(base + f, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(`Impossible de charger ${f} (${r.status})`);
    return r.json();
  });
  const [unitsFile, blocsFile, skills, photos] = await Promise.all([
    get('units.json'), get('blocs.json'), get('skills.json'),
    get('photos.json').catch(() => ({})), // photos de la communauté (facultatif)
  ]);
  return indexData(unitsFile, blocsFile, skills, photos);
}

export function indexData(unitsFile, blocsFile, skills, photos = {}) {
  const units = unitsFile.units;
  const unitsById = new Map(units.map((u) => [u.id, u]));
  const blocs = blocsFile.blocs;
  const blocsById = new Map(blocs.map((b) => [b.id, b]));
  const platoons = blocsFile.platoons;
  const platoonsById = new Map(platoons.map((p) => [p.id, p]));
  const factionsById = new Map();
  for (const b of blocs) for (const f of b.factions) factionsById.set(f.id, { ...f, bloc: b.id });
  return {
    meta: unitsFile.meta || {},
    units, unitsById, blocs, blocsById, platoons, platoonsById, factionsById, skills, photos,
    raw: { unitsFile, blocsFile, skills, photos },
  };
}

// ---------------------------------------------------------------- CONFIDENTIAL
// Créations de la communauté (data/custom.json), non officielles. Elles ne sont chargées que
// dans le builder complet et n'apparaissent que dans les armées où la case CONFIDENTIAL est cochée.
export const CONF_PREFIX = 'conf--';

export async function loadCustom(base = 'data/') {
  try {
    const r = await fetch(base + 'custom.json', { cache: 'no-cache' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// Base officielle + créations : chaque élément custom porte « confidential: true »
export function withCustom(off, custom) {
  if (!custom) return off;
  const cf = (x) => ({ ...x, confidential: true });
  const extraFactions = custom.factions || [];
  const blocs = off.blocs.map((b) => ({
    ...b,
    factions: [...b.factions, ...extraFactions.filter((f) => f.bloc === b.id).map(({ bloc, ...f }) => cf(f))],
  }));
  for (const b of custom.blocs || []) blocs.push(cf({ ...b, factions: (b.factions || []).map(cf) }));
  const units = [...off.units, ...(custom.units || []).map(cf)];
  const platoons = [...off.platoons, ...(custom.platoons || []).map(cf)];
  // Les règles officielles gardent la priorité sur une règle custom du même nom
  const skills = { ...(custom.skills || {}), ...off.skills };
  const D = indexData({ meta: off.meta, units }, { blocs, platoons }, skills, off.photos);
  D.customMeta = custom.meta || {};
  return D;
}

export function unitCost(u) {
  return typeof u.cost === 'number' ? u.cost : Number(u.cost) || 0;
}

// Nom "de base" d'un héros pour la règle d'unicité :
// "The Desert Fox (NDAK)" et "The Desert Fox" sont le même personnage.
export function heroBaseName(name) {
  return name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+(I|II|III|IV|V|VI)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Règles de pilotage propres à une carte : « Pilot: Sigrid » sur le véhicule (seule Sigrid le pilote),
// « Pilot: Snow Lynx » sur le héros (ne pilote que ce véhicule), « Defensive Pilot (Luftwaffe) » (véhicules de cette faction).
const pilotKey = (n) => heroBaseName(String(n || '')).replace(/^the\s+/, '');
const customNames = (u) => (u.customSkills || []).map((c) => String(c.name || '').trim());
const sameName = (a, b) => { a = pilotKey(a); b = pilotKey(b); return !!a && !!b && (a === b || a.startsWith(b + ' ') || b.startsWith(a + ' ')); };

export function canPilot(hero, target) {
  if (target.type !== 'vehicle' && target.type !== 'aircraft') return false;
  const mine = customNames(hero);
  // Le véhicule réserve son pilotage à un héros précis
  const reserved = customNames(target).map((n) => n.match(/^Pilot\s*:\s*(.+)$/i)).filter(Boolean).map((m) => m[1]);
  if (reserved.length) return reserved.some((r) => sameName(hero.name, r));
  // Le héros ne pilote qu'un véhicule précis
  const only = mine.map((n) => n.match(/^Pilot\s*:\s*(.+)$/i)).filter(Boolean).map((m) => m[1]);
  if (only.length && only.some((o) => sameName(target.name, o))) return true;
  // Pilotage limité à une faction : « Defensive Pilot (Luftwaffe) »
  const fac = mine.map((n) => n.match(target.type === 'aircraft' ? /^(?:Ace )?Air Pilot\s*\((.+)\)$/i : /^(?:Ace |Defensive )?Pilot\s*\((.+)\)$/i)).filter(Boolean).map((m) => m[1].toLowerCase());
  if (fac.some((f) => String(target.faction || '').toLowerCase().includes(f))) return true;
  const s = hero.skills || [];
  if (only.length) return false;
  if (target.type === 'aircraft') return s.includes('Air Pilot') || s.includes('Ace Air Pilot');
  return s.some((x) => /^(Ace |Defensive )?Pilot$/.test(x));
}
