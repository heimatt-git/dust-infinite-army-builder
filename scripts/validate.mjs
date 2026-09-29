#!/usr/bin/env node
// Vérifie la base avant publication : node scripts/validate.mjs
import { readFileSync, existsSync } from 'node:fs';
import { validateData, validateCustom } from '../js/validate.js';

const read = (f) => {
  try { return JSON.parse(readFileSync(new URL('../data/' + f, import.meta.url), 'utf8')); }
  catch (e) { console.error(`✗ data/${f} : JSON invalide — ${e.message}`); process.exit(1); }
};
const photos = existsSync(new URL('../data/photos.json', import.meta.url)) ? read('photos.json') : {};
// Créations CONFIDENTIAL (facultatif) : leurs unités peuvent avoir des photos de la communauté
const custom = existsSync(new URL('../data/custom.json', import.meta.url)) ? read('custom.json') : null;
const customIds = (custom?.units || []).map((u) => u.id);
const { errors, warnings } = validateData(read('units.json'), read('blocs.json'), read('skills.json'), photos, customIds);
if (custom) {
  const c = validateCustom(custom, read('units.json'), read('blocs.json'), read('skills.json'));
  errors.push(...c.errors); warnings.push(...c.warnings);
}
for (const arr of Object.values(photos)) for (const p of arr) {
  if (!existsSync(new URL('../' + p.file, import.meta.url))) errors.push(`photos.json : fichier absent du dépôt (${p.file}).`);
}
// Shot Format : les héros interdits doivent exister dans la base
if (existsSync(new URL('../data/short-format.json', import.meta.url))) {
  const sf = read('short-format.json');
  const names = new Set(read('units.json').units.map((u) => u.name));
  for (const n of sf.bannedHeroes || []) if (!names.has(n)) warnings.push(`short-format.json : héros interdit introuvable dans la base (${n}).`);
  const skillsUsed = new Set(read('units.json').units.flatMap((u) => [...(u.skills || []), ...(u.customSkills || []).map((c) => c.name)]));
  for (const k of Object.keys(sf.bannedSkills || {})) if (!skillsUsed.has(k)) warnings.push(`short-format.json : compétence interdite portée par aucune unité (${k}).`);
  if (!Number.isInteger(sf.budget)) errors.push('short-format.json : budget invalide.');
}
for (const w of warnings) console.log('⚠ ' + w);
for (const e of errors) console.error('✗ ' + e);
console.log(`\n${errors.length} erreur(s), ${warnings.length} avertissement(s)`);
process.exit(errors.length ? 1 : 0);
