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

export function canPilot(hero, target) {
  const s = hero.skills || [];
  if (target.type === 'aircraft') return s.includes('Air Pilot') || s.includes('Ace Air Pilot');
  if (target.type === 'vehicle') return s.some((x) => /^(Ace |Defensive )?Pilot$/.test(x));
  return false;
}
