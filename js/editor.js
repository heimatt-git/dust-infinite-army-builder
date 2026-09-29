// Éditeur de base : corriger les unités, pelotons et compétences, puis publier
import { indexData, typeLabel } from './data.js';
import { validateData, UNIT_TYPES } from './validate.js';
import { esc, store, toast, openModal, unitCardHTML, guessRepo } from './ui.js';
import { shrink } from './images.js';
import { t, LANG, initLang, setLang } from './i18n.js';

const DRAFT_KEY = 'dust1947.editor.draft';
const GH_KEY = 'dust1947.editor.github';
const root = document.getElementById('ed');

const E = {
  orig: null, // fichiers publiés
  d: null,    // brouillon { unitsFile, blocsFile, skills }
  tab: 'units', sel: null, q: '', fbloc: 'all', onlyChanged: false,
  psel: null, pq: '', sq: '',
};

const clone = (x) => structuredClone(x);
const bn = (b) => (LANG === 'en' && b.nameEn) || b.name;

// En-tête traduit (le HTML de la page contient la version française par défaut)
function topbar() {
  const h = document.querySelector('header.topbar');
  if (!h) return;
  h.innerHTML = `<a class="brand" href="index.html"><b>DUST 194∞</b><small>${t('Éditeur')}</small></a>
  <nav class="topnav">
    <a href="index.html">${t('Army builder')}</a>
    <a href="editeur-2k26hdl.html" class="on">${t('Éditeur de base')}</a>
    <button id="lang-btn" type="button" lang="${LANG === 'fr' ? 'en' : 'fr'}" title="${LANG === 'fr' ? 'English version' : 'Version française'}">${LANG === 'fr' ? 'EN' : 'FR'}</button>
  </nav>`;
  h.querySelector('#lang-btn').addEventListener('click', () => { setLang(LANG === 'fr' ? 'en' : 'fr'); location.reload(); });
  document.title = `DUST 194∞ ${t('Éditeur')}`;
  const boot = document.querySelector('#ed .boot'); if (boot) boot.textContent = t('Chargement de la base…');
}
const slug = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const numOrNull = (v) => { v = String(v ?? '').trim(); if (v === '') return null; return /^-?\d+$/.test(v) ? parseInt(v, 10) : v; };
const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
const attacks = (v) => String(v || '').trim().split(/\s+/).filter(Boolean);

initLang();
init();
async function init() {
  topbar();
  const get = (f) => fetch('data/' + f, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
  try {
    const [unitsFile, blocsFile, skills, photos, custom] = await Promise.all([get('units.json'), get('blocs.json'), get('skills.json'), get('photos.json').catch(() => ({})), get('custom.json').catch(() => null)]);
    E.orig = { unitsFile, blocsFile, skills, photos };
    E.customIds = (custom?.units || []).map((u) => u.id); // créations CONFIDENTIAL (gérées dans une prochaine étape)
  } catch (e) {
    root.innerHTML = `<div class="issue bad"><b>!</b><span>${esc(t('Impossible de charger la base : {e}', { e: e.message }))}</span></div>`;
    return;
  }
  const draft = store.get(DRAFT_KEY, null);
  if (draft && draft.base === E.orig.unitsFile.meta?.version) { E.d = draft.data; E.restored = true; }
  else E.d = clone(E.orig);
  // Les images en attente ne survivent pas à un rechargement : on retire les photos non publiées du brouillon
  E.pending = new Map();
  E.d.photos ||= clone(E.orig.photos);
  const known = new Set(Object.values(E.orig.photos).flat().map((p) => p.file));
  let lost = 0;
  for (const [id, arr] of Object.entries(E.d.photos)) {
    const keep = arr.filter((p) => known.has(p.file));
    lost += arr.length - keep.length;
    if (keep.length) E.d.photos[id] = keep; else delete E.d.photos[id];
  }
  if (lost) setTimeout(() => toast(t('{n} photo(s) non publiée(s) perdue(s) au rechargement : ajoutez-les à nouveau.', { n: lost })), 500);
  render();
}

function saveDraft() {
  if (!store.set(DRAFT_KEY, { base: E.orig.unitsFile.meta?.version, data: E.d })) toast(t('Brouillon non sauvegardé (stockage local indisponible).'));
}

// ---------------------------------------------------------------- Différences
function changes() {
  const o = new Map(E.orig.unitsFile.units.map((u) => [u.id, JSON.stringify(u)]));
  const n = new Map(E.d.unitsFile.units.map((u) => [u.id, JSON.stringify(u)]));
  const uMod = [], uAdd = [], uDel = [];
  for (const [id, s] of n) { if (!o.has(id)) uAdd.push(id); else if (o.get(id) !== s) uMod.push(id); }
  for (const id of o.keys()) if (!n.has(id)) uDel.push(id);
  const po = new Map(E.orig.blocsFile.platoons.map((p) => [p.id, JSON.stringify(p)]));
  const pn = new Map(E.d.blocsFile.platoons.map((p) => [p.id, JSON.stringify(p)]));
  const pMod = [], pAdd = [], pDel = [];
  for (const [id, s] of pn) { if (!po.has(id)) pAdd.push(id); else if (po.get(id) !== s) pMod.push(id); }
  for (const id of po.keys()) if (!pn.has(id)) pDel.push(id);
  const sMod = [];
  const keys = new Set([...Object.keys(E.orig.skills), ...Object.keys(E.d.skills)]);
  for (const k of keys) if (E.orig.skills[k] !== E.d.skills[k]) sMod.push(k);
  const phMod = JSON.stringify(E.orig.photos) !== JSON.stringify(E.d.photos);
  const blocsChanged = JSON.stringify(E.orig.blocsFile.blocs) !== JSON.stringify(E.d.blocsFile.blocs);
  const total = uMod.length + uAdd.length + uDel.length + pMod.length + pAdd.length + pDel.length + sMod.length + (blocsChanged ? 1 : 0) + (phMod ? 1 : 0);
  return { uMod, uAdd, uDel, pMod, pAdd, pDel, sMod, blocsChanged, total,
    files: { units: uMod.length + uAdd.length + uDel.length > 0, blocs: pMod.length + pAdd.length + pDel.length > 0 || blocsChanged, skills: sMod.length > 0, photos: phMod }, phMod };
}

// ---------------------------------------------------------------- Rendu
function render() {
  const ch = changes();
  root.innerHTML = `
  <div class="ed-head">
    <div>
      <div class="eyebrow">${t('Base {v} · {u} unités · {p} pelotons', { v: esc(E.orig.unitsFile.meta?.version || ''), u: E.d.unitsFile.units.length, p: E.d.blocsFile.platoons.length })}</div>
      <h1 class="h-display">${t('Éditeur de base')}</h1>
      <p>${t("Corrigez une fiche, vérifiez-la, puis publiez. Vos modifications restent dans ce navigateur (brouillon) tant qu'elles ne sont pas publiées sur GitHub.")}</p>
    </div>
    ${ch.total ? `<button class="btn danger sm" id="reset-draft">${t('Abandonner le brouillon')}</button>` : ''}
  </div>
  ${E.restored && ch.total ? `<div class="issue info" style="margin-bottom:12px"><b>i</b><span>${t('Brouillon précédent restauré.')}</span></div>` : ''}
  <div class="ed-tabs" role="tablist">
    ${[['units', t('Unités')], ['platoons', t('Pelotons')], ['skills', t('Compétences')], ['photos', t('Photos')], ['publish', t('Publier')]].map(([k, l]) =>
      `<button role="tab" data-tab="${k}" class="${E.tab === k ? 'on' : ''}">${l}${k === 'publish' && ch.total ? `<span class="count">${ch.total}</span>` : ''}</button>`).join('')}
  </div>
  <div id="ed-body"></div>`;
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { E.tab = b.dataset.tab; render(); }));
  root.querySelector('#reset-draft')?.addEventListener('click', (ev) => {
    const b = ev.currentTarget;
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('Confirmer : tout annuler'); return; }
    E.d = clone(E.orig); E.restored = false; store.set(DRAFT_KEY, null); render(); toast(t('Brouillon abandonné'));
  });
  const body = root.querySelector('#ed-body');
  ({ units: renderUnits, platoons: renderPlatoons, skills: renderSkills, photos: renderPhotos, publish: renderPublish })[E.tab](body, ch);
}

// ---------------------------------------------------------------- Unités
function renderUnits(body, ch) {
  const units = E.d.unitsFile.units;
  const changed = new Set([...ch.uMod, ...ch.uAdd]);
  let shown = units;
  if (E.fbloc !== 'all') shown = shown.filter((u) => u.bloc === E.fbloc);
  if (E.onlyChanged) shown = shown.filter((u) => changed.has(u.id));
  if (E.q) { const q = E.q.toLowerCase(); shown = shown.filter((u) => (u.name + ' ' + u.id + ' ' + u.subtitle).toLowerCase().includes(q)); }
  const u = units.find((x) => x.id === E.sel);
  body.innerHTML = `<div class="ed-grid">
    <aside class="ed-side">
      <input type="search" id="u-q" placeholder="${t('Rechercher une unité')}" value="${esc(E.q)}">
      <select id="u-bloc"><option value="all">${t('Tous les blocs')}</option>${E.d.blocsFile.blocs.map((b) => `<option value="${esc(b.id)}" ${E.fbloc === b.id ? 'selected' : ''}>${esc(bn(b))}</option>`).join('')}</select>
      <label class="check"><input type="checkbox" id="u-changed" ${E.onlyChanged ? 'checked' : ''}> ${t('Seulement les fiches modifiées')}</label>
      <div class="ed-list">${shown.map((x) => `<button class="ed-item ${x.id === E.sel ? 'on' : ''}" data-sel="${esc(x.id)}"><span>${esc(x.name)}${changed.has(x.id) ? `<span class="dot" title="${t('Modifiée')}"></span>` : ''}</span><small>${esc(x.bloc.slice(0, 3))} ${esc(x.cost)}</small></button>`).join('') || `<p class="empty" style="padding:8px">${t('Aucune unité.')}</p>`}</div>
      <button class="btn" id="u-new">${t('+ Nouvelle unité')}</button>
    </aside>
    <section>${u ? unitForm(u) : `<div class="ed-sec"><p class="hint" style="margin:0">${t('Choisissez une unité à gauche pour la corriger, ou créez-en une nouvelle.')}</p></div>`}</section>
  </div>`;

  const q = body.querySelector('#u-q');
  q.addEventListener('input', () => { E.q = q.value; const p = q.selectionStart; render(); const q2 = document.getElementById('u-q'); q2.focus(); q2.setSelectionRange(p, p); });
  body.querySelector('#u-bloc').addEventListener('change', (e) => { E.fbloc = e.target.value; render(); });
  body.querySelector('#u-changed').addEventListener('change', (e) => { E.onlyChanged = e.target.checked; render(); });
  body.querySelectorAll('[data-sel]').forEach((b) => b.addEventListener('click', () => { E.sel = b.dataset.sel; render(); }));
  body.querySelector('#u-new').addEventListener('click', () => {
    const bloc = E.fbloc !== 'all' ? E.fbloc : 'Allies';
    let id = `${slug(bloc)}--nouvelle-unite`; let i = 2;
    while (units.some((x) => x.id === id)) id = `${slug(bloc)}--nouvelle-unite-${i++}`;
    units.push({ id, name: t('Nouvelle unité'), subtitle: '', bloc, type: 'infantry', faction: null, cost: 0, health: null, move: 2, march: 4, armor: 2, capturable: false, skills: [], customSkills: [], weapons: [], image: null });
    E.sel = id; saveDraft(); render();
  });
  if (u) bindUnitForm(body, u);
}

function unitForm(u) {
  const bloc = E.d.blocsFile.blocs.find((b) => b.id === u.bloc);
  const allSkills = Object.keys(E.d.skills);
  return `<form class="ed-form" id="u-form" autocomplete="off">
    <div class="ed-sec">
      <h2>${t('Identité')}</h2>
      <div class="idline">${t("id : {id} (identifiant stable utilisé par les listes sauvegardées : il ne change pas si vous renommez l'unité)", { id: esc(u.id) })}</div>
      <div class="row2">
        <label class="field"><span>${t('Nom')}</span><input type="text" name="name" value="${esc(u.name)}"></label>
        <label class="field"><span>${t('Sous-titre')}</span><input type="text" name="subtitle" value="${esc(u.subtitle)}"></label>
      </div>
      <div class="row2">
        <label class="field"><span>${t('Bloc')}</span><select name="bloc">${E.d.blocsFile.blocs.map((b) => `<option value="${esc(b.id)}" ${b.id === u.bloc ? 'selected' : ''}>${esc(bn(b))}</option>`).join('')}</select></label>
        <label class="field"><span>${t('Type')}</span><select name="type">${UNIT_TYPES.map((ty) => `<option value="${ty}" ${ty === u.type ? 'selected' : ''}>${esc(typeLabel(ty))}</option>`).join('')}</select></label>
        <label class="field"><span>${t('Faction')}</span><select name="faction"><option value="">${t('— Bloc (aucune) —')}</option>${(bloc?.factions || []).map((f) => `<option value="${esc(f.id)}" ${f.id === u.faction ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>
      </div>
    </div>
    <div class="ed-sec">
      <h2>${t('Caractéristiques')}</h2>
      <div class="row5">
        ${[['cost', t('Points')], ['armor', t('Armure')], ['health', t('Santé')], ['move', t('Mouvement')], ['march', t('Marche')]].map(([k, l]) => `<label class="field"><span>${l}</span><input type="text" inputmode="numeric" name="${k}" value="${esc(u[k] ?? '')}"></label>`).join('')}
      </div>
      <label class="check"><input type="checkbox" name="capturable" ${u.capturable ? 'checked' : ''}> ${t('Peut être aligné comme véhicule capturé par un autre bloc')}</label>
      <label class="field"><span>${t('Compétences (séparées par des virgules)')}</span><input type="text" name="skills" list="skills-dl" value="${esc((u.skills || []).join(', '))}"></label>
      <datalist id="skills-dl">${allSkills.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
    </div>
    <div class="ed-sec">
      <h2>${t("Compétences propres à l'unité")}</h2>
      ${(u.customSkills || []).map((c, i) => `<div class="wedit"><div class="wedit-h"><b>${t('Compétence {n}', { n: i + 1 })}</b><button type="button" class="btn sm danger" data-rmcs="${i}">${t('Retirer')}</button></div>
        <input type="text" name="cs-name-${i}" value="${esc(c.name)}" placeholder="${t('Nom')}"><textarea name="cs-desc-${i}" rows="2" placeholder="${t('Description')}">${esc(c.description)}</textarea></div>`).join('')}
      <div><button type="button" class="btn sm" id="add-cs">${t('+ Compétence propre')}</button></div>
    </div>
    <div class="ed-sec">
      <h2>${t('Armes')}</h2>
      <p class="hint" style="margin:0">${t("Valeurs d'attaque séparées par des espaces, dans l'ordre des classes d'armure (ex. <code>7/1 6/1 4/1 2/1</code>). Laissez vide si l'arme ne peut pas viser ce type.")}</p>
      ${(u.weapons || []).map((w, i) => `<div class="wedit">
        <div class="wedit-h"><b>${t('Arme {n}', { n: i + 1 })}</b><span style="display:flex;gap:6px">
          <button type="button" class="btn sm icon" data-wup="${i}" ${i === 0 ? 'disabled' : ''} aria-label="${t('Monter')}">↑</button>
          <button type="button" class="btn sm danger" data-rmw="${i}">${t('Retirer')}</button></span></div>
        <div class="row2">
          <label class="field"><span>${t('Nom')}</span><input type="text" name="w-name-${i}" value="${esc(w.name)}"></label>
          <label class="field"><span>${t('Nb')}</span><input type="text" name="w-count-${i}" value="${esc(w.count ?? '')}"></label>
          <label class="field"><span>${t('Portée')}</span><input type="text" name="w-range-${i}" value="${esc(w.range ?? '')}"></label>
          <label class="field"><span>${t('Munitions')}</span><input type="text" name="w-ammo-${i}" value="${esc(w.ammo ?? '')}"></label>
          <label class="field"><span>${t('Montage')}</span><input type="text" name="w-mount-${i}" value="${esc(w.mount ?? '')}" placeholder="Turret, Front…"></label>
        </div>
        <label class="field"><span>${t('Règles spéciales (virgules)')}</span><input type="text" name="w-specials-${i}" list="skills-dl" value="${esc((w.specials || []).join(', '))}"></label>
        <div class="row2">
          <label class="field"><span>${t('vs Infanterie (1→4)')}</span><input type="text" name="w-inf-${i}" value="${esc((w.vsInfantry || []).join(' '))}"></label>
          <label class="field"><span>${t('vs Véhicule (1→7)')}</span><input type="text" name="w-veh-${i}" value="${esc((w.vsVehicle || []).join(' '))}"></label>
          <label class="field"><span>${t('vs Aéronef')}</span><input type="text" name="w-air-${i}" value="${esc((w.vsAircraft || []).join(' '))}"></label>
        </div>
      </div>`).join('')}
      <div><button type="button" class="btn sm" id="add-w">${t('+ Arme')}</button></div>
    </div>
    <div class="ed-actions">
      <button type="button" class="btn" id="u-preview">${t('Voir la carte')}</button>
      <button type="button" class="btn" id="u-revert" ${JSON.stringify(E.orig.unitsFile.units.find((x) => x.id === u.id)) === JSON.stringify(u) ? 'disabled' : ''}>${t('Annuler les modifications de cette fiche')}</button>
      <span class="spacer"></span>
      <button type="button" class="btn" id="u-dup">${t('Dupliquer')}</button>
      <button type="button" class="btn danger" id="u-del">${t('Supprimer')}</button>
    </div>
  </form>`;
}

function readUnitForm(form, u) {
  const f = new FormData(form);
  const g = (k) => f.get(k);
  u.name = String(g('name') || '').trim() || u.name;
  u.subtitle = String(g('subtitle') || '').trim();
  u.bloc = g('bloc');
  u.type = g('type');
  const bloc = E.d.blocsFile.blocs.find((b) => b.id === u.bloc);
  u.faction = g('faction') && bloc?.factions.some((x) => x.id === g('faction')) ? g('faction') : null;
  for (const k of ['cost', 'armor', 'health', 'move', 'march']) u[k] = numOrNull(g(k));
  if (u.cost === null) u.cost = 0;
  u.capturable = !!g('capturable');
  u.skills = list(g('skills'));
  u.customSkills = (u.customSkills || []).map((_, i) => ({ name: String(g(`cs-name-${i}`) || '').trim(), description: String(g(`cs-desc-${i}`) || '').trim() }));
  u.weapons = (u.weapons || []).map((w, i) => {
    const nw = { name: String(g(`w-name-${i}`) || '').trim(), count: numOrNull(g(`w-count-${i}`)), range: numOrNull(g(`w-range-${i}`)) };
    const ammo = numOrNull(g(`w-ammo-${i}`)); if (ammo !== null) nw.ammo = ammo;
    const mount = String(g(`w-mount-${i}`) || '').trim(); if (mount) nw.mount = mount;
    nw.specials = list(g(`w-specials-${i}`));
    nw.vsInfantry = attacks(g(`w-inf-${i}`));
    nw.vsVehicle = attacks(g(`w-veh-${i}`));
    nw.vsAircraft = attacks(g(`w-air-${i}`));
    return nw;
  });
}

function bindUnitForm(body, u) {
  const form = body.querySelector('#u-form');
  const apply = () => { readUnitForm(form, u); saveDraft(); };
  form.addEventListener('change', (e) => {
    apply();
    if (['bloc', 'name', 'cost'].includes(e.target.name)) render();
    else {
      // mettre à jour le repère « modifiée » et le bouton d'annulation sans perdre le focus
      const same = JSON.stringify(E.orig.unitsFile.units.find((x) => x.id === u.id)) === JSON.stringify(u);
      form.querySelector('#u-revert').disabled = same;
    }
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  form.querySelector('#add-w').addEventListener('click', () => { apply(); u.weapons.push({ name: t('Nouvelle arme'), count: 1, range: 1, specials: [], vsInfantry: [], vsVehicle: [], vsAircraft: [] }); saveDraft(); render(); });
  form.querySelector('#add-cs').addEventListener('click', () => { apply(); (u.customSkills ||= []).push({ name: '', description: '' }); saveDraft(); render(); });
  form.querySelectorAll('[data-rmw]').forEach((b) => b.addEventListener('click', () => { apply(); u.weapons.splice(+b.dataset.rmw, 1); saveDraft(); render(); }));
  form.querySelectorAll('[data-wup]').forEach((b) => b.addEventListener('click', () => { apply(); const i = +b.dataset.wup; [u.weapons[i - 1], u.weapons[i]] = [u.weapons[i], u.weapons[i - 1]]; saveDraft(); render(); }));
  form.querySelectorAll('[data-rmcs]').forEach((b) => b.addEventListener('click', () => { apply(); u.customSkills.splice(+b.dataset.rmcs, 1); saveDraft(); render(); }));
  form.querySelector('#u-preview').addEventListener('click', () => {
    apply();
    const D = indexData(E.d.unitsFile, E.d.blocsFile, E.d.skills);
    openModal(unitCardHTML(D.unitsById.get(u.id), D));
  });
  form.querySelector('#u-revert').addEventListener('click', () => {
    const o = E.orig.unitsFile.units.find((x) => x.id === u.id);
    if (!o) return;
    Object.keys(u).forEach((k) => delete u[k]); Object.assign(u, clone(o));
    saveDraft(); render(); toast(t('Fiche restaurée'));
  });
  form.querySelector('#u-dup').addEventListener('click', () => {
    apply();
    const c = clone(u); let id = u.id + '-copie'; let i = 2;
    while (E.d.unitsFile.units.some((x) => x.id === id)) id = `${u.id}-copie-${i++}`;
    c.id = id; c.name = u.name + t(' (copie)');
    E.d.unitsFile.units.splice(E.d.unitsFile.units.indexOf(u) + 1, 0, c);
    E.sel = id; saveDraft(); render();
  });
  form.querySelector('#u-del').addEventListener('click', (ev) => {
    const refs = E.d.blocsFile.platoons.filter((p) => [...p.command, ...p.combat].flat(2).includes(u.id));
    if (refs.length) { toast(t("Impossible : utilisée par {list}. Retirez-la d'abord de ces pelotons.", { list: refs.map((p) => p.name).join(', ') })); return; }
    const b = ev.currentTarget;
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('Confirmer la suppression'); return; }
    E.d.unitsFile.units = E.d.unitsFile.units.filter((x) => x.id !== u.id);
    E.sel = null; saveDraft(); render(); toast(t('{n} supprimée du brouillon', { n: u.name }));
  });
}

// ---------------------------------------------------------------- Pelotons
function renderPlatoons(body, ch) {
  const P = E.d.blocsFile.platoons;
  const changed = new Set([...ch.pMod, ...ch.pAdd]);
  const names = new Map(E.d.unitsFile.units.map((u) => [u.id, u.name]));
  let shown = P;
  if (E.fbloc !== 'all') shown = shown.filter((p) => p.bloc === E.fbloc);
  if (E.pq) { const q = E.pq.toLowerCase(); shown = shown.filter((p) => p.name.toLowerCase().includes(q)); }
  const p = P.find((x) => x.id === E.psel);
  const slotText = (slot) => slot.map((opt) => opt.join(' + ')).join('\n');
  const slotCheck = (slot) => {
    const bad = slot.flat().filter((id) => !names.has(id));
    return `<div class="hint">${slot.map((opt) => opt.map((id) => esc(names.get(id) || '?')).join(' + ')).join(' · ')}</div>${bad.length ? `<div class="bad-ref">${t('Id inconnu :')} ${bad.map(esc).join(', ')}</div>` : ''}`;
  };
  body.innerHTML = `<div class="ed-grid">
    <aside class="ed-side">
      <input type="search" id="p-q" placeholder="${t('Rechercher un peloton')}" value="${esc(E.pq)}">
      <select id="p-bloc"><option value="all">${t('Tous les blocs')}</option>${E.d.blocsFile.blocs.map((b) => `<option value="${esc(b.id)}" ${E.fbloc === b.id ? 'selected' : ''}>${esc(bn(b))}</option>`).join('')}</select>
      <div class="ed-list">${shown.map((x) => `<button class="ed-item ${x.id === E.psel ? 'on' : ''}" data-psel="${esc(x.id)}"><span>${esc(x.name)}${changed.has(x.id) ? '<span class="dot"></span>' : ''}</span><small>${esc(x.bloc.slice(0, 3))}</small></button>`).join('')}</div>
      <button class="btn" id="p-new">${t('+ Nouveau peloton')}</button>
    </aside>
    <section>${p ? `<form class="ed-form" id="p-form" autocomplete="off">
      <div class="ed-sec">
        <h2>${t('Peloton')}</h2>
        <div class="idline">id : ${esc(p.id)}</div>
        <div class="row2">
          <label class="field"><span>${t('Nom')}</span><input type="text" name="name" value="${esc(p.name)}"></label>
          <label class="field"><span>${t('Bloc')}</span><select name="bloc">${E.d.blocsFile.blocs.map((b) => `<option value="${esc(b.id)}" ${b.id === p.bloc ? 'selected' : ''}>${esc(bn(b))}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>${t('Devise')}</span><input type="text" name="lore" value="${esc(p.lore)}"></label>
        <label class="field"><span>${t('Avantage de peloton')}</span><textarea name="advantage" rows="3" style="font-family:var(--f-body);font-size:14px">${esc(p.advantage)}</textarea></label>
        <label class="check"><input type="checkbox" name="onlyCombat" ${p.onlyCombatUnitsAsSupport ? 'checked' : ''}> ${t('Seules les unités de combat du peloton peuvent être en soutien')}</label>
      </div>
      <div class="ed-sec">
        <h2>${t('Postes requis')}</h2>
        <p class="hint" style="margin:0">${t("Une option par ligne, identifiants d'unités. Plusieurs unités jouées ensemble : séparez-les par « + » (ex. héros + véhicule).")}</p>
        ${p.command.map((s, i) => `<div class="slot-ed"><label class="field"><span>${t('Commandement {n}', { n: i + 1 })}</span><textarea name="cmd-${i}" rows="3">${esc(slotText(s))}</textarea></label>${slotCheck(s)}</div>`).join('')}
        ${p.combat.map((s, i) => `<div class="slot-ed"><label class="field"><span>${t('Combat {n}', { n: i + 1 })}</span><textarea name="cb-${i}" rows="4">${esc(slotText(s))}</textarea></label>${slotCheck(s)}</div>`).join('')}
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="btn sm" data-addslot="combat">${t('+ Poste de combat')}</button>
          <button type="button" class="btn sm" data-rmslot="combat" ${p.combat.length ? '' : 'disabled'}>${t('− Dernier poste de combat')}</button>
          <button type="button" class="btn sm" data-addslot="command">${t('+ Poste de commandement')}</button>
        </div>
      </div>
      <div class="ed-sec">
        <h2>${t('Trouver un identifiant')}</h2>
        <input type="search" id="id-find" placeholder="${t("Nom d'unité…")}">
        <div id="id-res" class="hint"></div>
      </div>
      <div class="ed-actions"><span class="spacer"></span><button type="button" class="btn danger" id="p-del">${t('Supprimer le peloton')}</button></div>
    </form>` : `<div class="ed-sec"><p class="hint" style="margin:0">${t('Choisissez un peloton à gauche.')}</p></div>`}</section>
  </div>`;
  const q = body.querySelector('#p-q');
  q.addEventListener('input', () => { E.pq = q.value; const pos = q.selectionStart; render(); const q2 = document.getElementById('p-q'); q2.focus(); q2.setSelectionRange(pos, pos); });
  body.querySelector('#p-bloc').addEventListener('change', (e) => { E.fbloc = e.target.value; render(); });
  body.querySelectorAll('[data-psel]').forEach((b) => b.addEventListener('click', () => { E.psel = b.dataset.psel; render(); }));
  body.querySelector('#p-new').addEventListener('click', () => {
    const bloc = E.fbloc !== 'all' ? E.fbloc : 'Allies';
    let id = `${slug(bloc)}--nouveau-peloton`; let i = 2;
    while (P.some((x) => x.id === id)) id = `${slug(bloc)}--nouveau-peloton-${i++}`;
    P.push({ id, bloc, name: t('Nouveau peloton'), advantage: '', lore: '', onlyCombatUnitsAsSupport: false, command: [[]], combat: [[], []], image: null });
    E.psel = id; saveDraft(); render();
  });
  if (!p) return;
  const form = body.querySelector('#p-form');
  const parse = (txt) => String(txt || '').split('\n').map((l) => l.split('+').map((s) => s.trim()).filter(Boolean)).filter((o) => o.length);
  const apply = () => {
    const f = new FormData(form);
    p.name = String(f.get('name') || '').trim() || p.name;
    p.bloc = f.get('bloc');
    p.lore = String(f.get('lore') || '').trim();
    p.advantage = String(f.get('advantage') || '').trim();
    p.onlyCombatUnitsAsSupport = !!f.get('onlyCombat');
    p.command = p.command.map((_, i) => parse(f.get(`cmd-${i}`)));
    p.combat = p.combat.map((_, i) => parse(f.get(`cb-${i}`)));
    saveDraft();
  };
  form.addEventListener('change', (e) => { if (e.target.id === 'id-find') return; apply(); render(); });
  form.querySelectorAll('[data-addslot]').forEach((b) => b.addEventListener('click', () => { apply(); p[b.dataset.addslot].push([]); saveDraft(); render(); }));
  form.querySelectorAll('[data-rmslot]').forEach((b) => b.addEventListener('click', () => { apply(); p[b.dataset.rmslot].pop(); saveDraft(); render(); }));
  const find = form.querySelector('#id-find');
  find.addEventListener('input', () => {
    const v = find.value.toLowerCase();
    const res = v.length < 2 ? [] : E.d.unitsFile.units.filter((u) => u.name.toLowerCase().includes(v)).slice(0, 12);
    form.querySelector('#id-res').innerHTML = res.map((u) => `<div><b>${esc(u.name)}</b> (${esc(u.bloc)}) — <code>${esc(u.id)}</code></div>`).join('') || (v.length >= 2 ? t('Aucun résultat.') : '');
  });
  form.querySelector('#p-del').addEventListener('click', (ev) => {
    const b = ev.currentTarget;
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('Confirmer la suppression'); return; }
    E.d.blocsFile.platoons = P.filter((x) => x.id !== p.id); E.psel = null; saveDraft(); render();
  });
}

// ---------------------------------------------------------------- Compétences
function renderSkills(body, ch) {
  const S = E.d.skills;
  const changed = new Set(ch.sMod);
  let keys = Object.keys(S).sort((a, b) => a.localeCompare(b));
  if (E.sq) { const q = E.sq.toLowerCase(); keys = keys.filter((k) => (k + ' ' + S[k]).toLowerCase().includes(q)); }
  const missing = [...new Set(E.d.unitsFile.units.flatMap((u) => [...(u.skills || []), ...(u.weapons || []).flatMap((w) => w.specials || [])]))].filter((k) => !S[k]);
  body.innerHTML = `<div class="ed-sec">
    <div class="row2"><input type="search" id="s-q" placeholder="${t('Rechercher une compétence')}" value="${esc(E.sq)}">
    <div style="display:flex;gap:6px"><input type="text" id="s-new" placeholder="${t('Nom exact (anglais, comme sur les cartes)')}" list="missing-dl"><button class="btn" id="s-add">${t('Ajouter')}</button></div></div>
    <datalist id="missing-dl">${missing.map((k) => `<option value="${esc(k)}">`).join('')}</datalist>
    ${missing.length ? `<div class="issue warn"><b>!</b><span>${t('Compétences utilisées sans description :')} ${missing.map(esc).join(', ')}</span></div>` : ''}
    <div>${keys.map((k) => `<div class="skill-ed"><b>${esc(k)}${changed.has(k) ? ' <span class="dot" style="width:7px;height:7px;border-radius:50%;background:var(--accent);display:inline-block"></span>' : ''}</b>
      <textarea data-skill="${esc(k)}" rows="2">${esc(S[k])}</textarea>
      <button class="btn sm danger" data-rmskill="${esc(k)}">${t('Supprimer')}</button></div>`).join('')}</div>
  </div>`;
  const q = body.querySelector('#s-q');
  q.addEventListener('input', () => { E.sq = q.value; const pos = q.selectionStart; render(); const q2 = document.getElementById('s-q'); q2.focus(); q2.setSelectionRange(pos, pos); });
  body.querySelectorAll('[data-skill]').forEach((ta) => ta.addEventListener('change', () => { S[ta.dataset.skill] = ta.value.trim(); saveDraft(); }));
  body.querySelectorAll('[data-rmskill]').forEach((b) => b.addEventListener('click', () => {
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('Confirmer'); return; }
    delete S[b.dataset.rmskill]; saveDraft(); render();
  }));
  body.querySelector('#s-add').addEventListener('click', () => {
    const n = body.querySelector('#s-new').value.trim();
    if (!n) return;
    if (S[n] !== undefined) { toast(t('Cette compétence existe déjà.')); return; }
    S[n] = ''; E.sq = n; saveDraft(); render();
  });
}

// ---------------------------------------------------------------- Publication
function fileText(which) {
  const d = prepared();
  const obj = which === 'units' ? d.unitsFile : which === 'blocs' ? d.blocsFile : which === 'photos' ? d.photos : d.skills;
  return JSON.stringify(obj, null, 1) + '\n';
}
function prepared() {
  const d = clone(E.d);
  const today = new Date().toISOString().slice(0, 10);
  d.unitsFile.meta = { ...(d.unitsFile.meta || {}), version: today.replace(/-/g, '.'), updated: today };
  const sorted = {};
  for (const k of Object.keys(d.skills).sort((a, b) => a.localeCompare(b))) sorted[k] = d.skills[k];
  d.skills = sorted;
  return d;
}

function renderPublish(body, ch) {
  const v = validateData(E.d.unitsFile, E.d.blocsFile, E.d.skills, E.d.photos, E.customIds || []);
  const name = (id) => E.d.unitsFile.units.find((u) => u.id === id)?.name || E.orig.unitsFile.units.find((u) => u.id === id)?.name || id;
  const pname = (id) => E.d.blocsFile.platoons.find((p) => p.id === id)?.name || E.orig.blocsFile.platoons.find((p) => p.id === id)?.name || id;
  const gh = { ...guessRepo(), ...store.get(GH_KEY, {}) };
  const li = (label, arr, fn) => arr.length ? `<li><b>${label} (${arr.length})${LANG === 'en' ? ':' : ' :'}</b> ${arr.map((x) => esc(fn(x))).join(', ')}</li>` : '';
  body.innerHTML = `<div class="ed-form">
    <div class="ed-sec">
      <h2>${t('Modifications en attente')}</h2>
      ${ch.total ? `<ul class="changes">
        ${li(t('Unités modifiées'), ch.uMod, name)}${li(t('Unités ajoutées'), ch.uAdd, name)}${li(t('Unités supprimées'), ch.uDel, name)}
        ${li(t('Pelotons modifiés'), ch.pMod, pname)}${li(t('Pelotons ajoutés'), ch.pAdd, pname)}${li(t('Pelotons supprimés'), ch.pDel, pname)}
        ${li(t('Compétences modifiées'), ch.sMod, (x) => x)}
        ${ch.phMod ? `<li><b>${t('Photos de la communauté modifiées')}</b>${E.pending.size ? t(' ({n} image(s) à envoyer)', { n: E.pending.size }) : ''}</li>` : ''}
      </ul>` : `<p class="hint" style="margin:0">${t('Aucune modification : le brouillon est identique à la base publiée.')}</p>`}
    </div>
    <div class="ed-sec">
      <h2>${t('Vérification')}</h2>
      <div class="issues">
        ${v.errors.map((m) => `<div class="issue bad"><b>✕</b><span>${esc(m)}</span></div>`).join('')}
        ${v.warnings.slice(0, 40).map((m) => `<div class="issue warn"><b>!</b><span>${esc(m)}</span></div>`).join('')}
        ${v.warnings.length > 40 ? `<div class="issue info"><b>i</b><span>${t('… et {n} autres avertissements.', { n: v.warnings.length - 40 })}</span></div>` : ''}
        ${!v.errors.length ? `<div class="issue info"><b>✓</b><span>${t('Aucune erreur bloquante. Les avertissements ne bloquent pas la publication.')}</span></div>` : ''}
      </div>
    </div>
    <div class="ed-sec">
      <h2>${t('Option 1 : publier directement sur GitHub')}</h2>
      <p class="hint" style="margin:0">${t('Crée un commit sur votre dépôt ; le site est mis à jour en une à deux minutes. Nécessite un jeton GitHub « fine-grained » limité à ce dépôt, avec la permission <b>Contents : Read and write</b>.')}</p>
      <div class="row2">
        <label class="field"><span>${t('Propriétaire')}</span><input type="text" id="gh-owner" value="${esc(gh.owner || '')}" placeholder="${t('votre-pseudo')}"></label>
        <label class="field"><span>${t('Dépôt')}</span><input type="text" id="gh-repo" value="${esc(gh.repo || '')}" placeholder="dust-infinite-army-builder"></label>
        <label class="field"><span>${t('Branche')}</span><input type="text" id="gh-branch" value="${esc(gh.branch || 'main')}"></label>
      </div>
      <label class="field"><span>${t("Jeton d'accès")}</span><input type="password" id="gh-token" value="${esc(gh.token || '')}" placeholder="github_pat_…" autocomplete="off"></label>
      <label class="check"><input type="checkbox" id="gh-remember" ${gh.token ? 'checked' : ''}> ${t('Se souvenir du jeton sur cet appareil (à éviter sur un ordinateur partagé)')}</label>
      <label class="field"><span>${t('Message de commit')}</span><input type="text" id="gh-msg" value="${esc(defaultMessage(ch, name))}"></label>
      <div><button class="btn primary" id="gh-go" ${!ch.total || v.errors.length ? 'disabled' : ''}>${t('Publier sur GitHub')}</button></div>
      <div id="gh-log" class="hint"></div>
    </div>
    <div class="ed-sec">
      <h2>${t('Option 2 : télécharger et déposer les fichiers')}</h2>
      <ol class="pub-steps">
        <li>${t('Téléchargez les fichiers modifiés :')}
          <span style="display:inline-flex;gap:6px;flex-wrap:wrap">
          ${['units', 'blocs', 'skills', 'photos'].map((f) => `<button class="btn sm ${ch.files[f] ? 'primary' : ''}" data-dl="${f}">${f}.json${ch.files[f] ? t(' (modifié)') : ''}</button>`).join('')}
          </span></li>
        ${E.pending.size ? `<li>${t('Téléchargez aussi les nouvelles images :')} ${[...E.pending.keys()].map((k) => `<button class="btn sm" data-dlimg="${esc(k)}">${esc(k.split('/').pop())}</button>`).join(' ')} ${t('et déposez-les dans le dossier <code>photos/</code>.')}</li>` : ''}
        <li>${t('Sur github.com, ouvrez le dossier <code>data/</code> de votre dépôt, puis <b>Add file → Upload files</b>.')}</li>
        <li>${t("Déposez les fichiers, décrivez la correction, cliquez sur <b>Commit changes</b>. La vérification automatique s'exécute et le site se met à jour.")}</li>
      </ol>
    </div>
  </div>`;
  body.querySelectorAll('[data-dl]').forEach((b) => b.addEventListener('click', () => download(b.dataset.dl + '.json', fileText(b.dataset.dl))));
  body.querySelectorAll('[data-dlimg]').forEach((b) => b.addEventListener('click', () => download(b.dataset.dlimg.split('/').pop(), E.pending.get(b.dataset.dlimg))));
  body.querySelector('#gh-go').addEventListener('click', () => publishGitHub(ch));
}

function defaultMessage(ch, name) {
  const parts = [];
  if (ch.uMod.length) parts.push(t('corrige {list}', { list: ch.uMod.slice(0, 4).map(name).join(', ') + (ch.uMod.length > 4 ? '…' : '') }));
  if (ch.uAdd.length) parts.push(t('ajoute {n} unité(s)', { n: ch.uAdd.length }));
  if (ch.uDel.length) parts.push(t('retire {n} unité(s)', { n: ch.uDel.length }));
  if (ch.pMod.length + ch.pAdd.length + ch.pDel.length) parts.push(t('pelotons'));
  if (ch.sMod.length) parts.push(t('compétences'));
  return t('Base : ') + (parts.join('; ') || t('mise à jour'));
}


function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(text instanceof Blob ? text : new Blob([text], { type: 'application/json' }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const blobB64 = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
const b64 = (text) => { const bytes = new TextEncoder().encode(text); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };

async function publishGitHub(ch) {
  const $ = (id) => document.getElementById(id);
  const owner = $('gh-owner').value.trim(), repo = $('gh-repo').value.trim(), branch = $('gh-branch').value.trim() || 'main';
  const token = $('gh-token').value.trim(), msg = $('gh-msg').value.trim() || t('Mise à jour de la base');
  const log = $('gh-log');
  if (!owner || !repo || !token) { log.innerHTML = `<span class="bad-ref">${t('Renseignez le propriétaire, le dépôt et le jeton.')}</span>`; return; }
  store.set(GH_KEY, $('gh-remember').checked ? { owner, repo, branch, token } : { owner, repo, branch });
  const btn = $('gh-go'); btn.disabled = true;
  const H = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const files = ['units', 'blocs', 'skills', 'photos'].filter((f) => ch.files[f]);
  // units.json change toujours (date de version) dès qu'autre chose change
  if (!files.includes('units')) files.unshift('units');
  const lines = [];
  const say = (m) => { lines.push(m); log.innerHTML = lines.map(esc).join('<br>'); };
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  const putFile = async (path, content, message) => {
    const cur = await fetch(`${api}/contents/${path}?ref=${encodeURIComponent(branch)}`, { headers: H });
    if (cur.status === 401) throw new Error(t('Jeton refusé (401). Vérifiez-le ou générez-en un nouveau.'));
    if (!cur.ok && cur.status !== 404) throw new Error(t('Lecture de {p} impossible ({s}).', { p: path, s: cur.status }));
    const sha = cur.ok ? (await cur.json()).sha : undefined;
    const put = await fetch(`${api}/contents/${path}`, { method: 'PUT', headers: H, body: JSON.stringify({ message, content, sha, branch }) });
    if (put.status === 403) throw new Error(t("Le jeton n'a pas la permission « Contents : Read and write » sur ce dépôt."));
    if (!put.ok) throw new Error(t('Écriture de {p} refusée ({s}).', { p: path, s: put.status }));
    say(t('✓ {p} publié', { p: path }));
  };
  try {
    const r = await fetch(api, { headers: H });
    if (r.status === 401) throw new Error(t('Jeton refusé (401). Vérifiez-le ou générez-en un nouveau.'));
    if (!r.ok) throw new Error(t('Dépôt {r} introuvable. Vérifiez le nom et que le jeton y a accès.', { r: `${owner}/${repo}` }));
    for (const [path, blob] of E.pending) {
      say(t('Envoi de {p}…', { p: path }));
      await putFile(path, await blobB64(blob), `${msg} (photo)`);
    }
    for (const f of files) {
      const path = `data/${f}.json`;
      say(t('Envoi de {p}…', { p: path }));
      await putFile(path, b64(fileText(f)), files.length > 1 ? `${msg} (${f}.json)` : msg);
    }
    E.pending.clear();
    E.orig = clone(prepared()); E.d = clone(E.orig); store.set(DRAFT_KEY, null);
    say(t("Terminé. Le site sera à jour d'ici une à deux minutes (GitHub Pages)."));
    toast(t('Base publiée sur GitHub'));
    setTimeout(render, 2500);
  } catch (e) {
    say('✕ ' + e.message);
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------- Photos de la communauté
function renderPhotos(body) {
  const P = E.d.photos;
  const units = E.d.unitsFile.units;
  const label = (u) => `${u.name} — ${u.bloc}`;
  const byLabel = new Map(units.map((u) => [label(u), u]));
  const entries = Object.entries(P).flatMap(([id, arr]) => arr.map((p, i) => ({ id, i, p, u: units.find((u) => u.id === id) })));
  const repo = guessRepo();
  const src = (p) => E.pending.has(p.file) ? URL.createObjectURL(E.pending.get(p.file)) : p.file;
  body.innerHTML = `<div class="ed-form">
    <div class="ed-sec">
      <h2>${t('Ajouter une photo de la communauté')}</h2>
      <p class="hint" style="margin:0">${t('Les joueurs proposent leurs photos via le formulaire GitHub « Proposer une photo de figurine »')}${repo.owner ? ` (<a href="https://github.com/${esc(repo.owner)}/${esc(repo.repo)}/issues?q=is%3Aissue+label%3Aphoto" target="_blank" rel="noopener">${t('voir les propositions')}</a>)` : ''}. ${t("Vérifiez que l'auteur a coché les deux autorisations, téléchargez son image, puis ajoutez-la ici.")}</p>
      <datalist id="ph-units">${units.map((u) => `<option value="${esc(label(u))}">`).join('')}</datalist>
      <div class="row2">
        <label class="field"><span>${t('Unité')}</span><input type="text" id="ph-unit" list="ph-units" placeholder="Pounder — Allies"></label>
        <label class="field"><span>${t('Crédit (pseudo)')}</span><input type="text" id="ph-author"></label>
        <label class="field"><span>${t('Licence')}</span><input type="text" id="ph-license" value="CC BY 4.0"></label>
      </div>
      <label class="field"><span>${t('Image')}</span><input type="file" id="ph-file" accept="image/*"></label>
      <label class="check"><input type="checkbox" id="ph-ok"> ${t("L'auteur a confirmé qu'il s'agit de sa propre photo de figurine et accepte la licence")}</label>
      <div><button class="btn primary" id="ph-add">${t('Ajouter au brouillon')}</button></div>
      ${E.pending.size ? `<div class="issue warn"><b>!</b><span>${t("{n} image(s) en attente d'envoi : publiez-les avant de fermer cette page, elles ne sont pas conservées au rechargement.", { n: E.pending.size })}</span></div>` : ''}
    </div>
    <div class="ed-sec">
      <h2>${t('Photos publiées ({n})', { n: entries.length })}</h2>
      ${entries.length ? `<div class="ph-grid">${entries.map(({ id, i, p, u }) => `<figure>
        <img src="${esc(src(p))}" alt="" style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:6px;border:1px solid var(--line)">
        <figcaption><b>${esc(u?.name || id)}</b><br>${esc(p.author)} · ${esc(p.license || '')}${E.pending.has(p.file) ? ` · <i>${t('à envoyer')}</i>` : ''}</figcaption>
        <button class="btn sm danger" data-rmph="${esc(id)}|${i}">${t('Retirer')}</button></figure>`).join('')}</div>` : `<p class="hint" style="margin:0">${t('Aucune photo pour le moment.')}</p>`}
    </div>
  </div>`;
  body.querySelector('#ph-add').addEventListener('click', async () => {
    const u = byLabel.get(body.querySelector('#ph-unit').value.trim());
    const author = body.querySelector('#ph-author').value.trim();
    const file = body.querySelector('#ph-file').files[0];
    if (!u) return toast(t('Choisissez une unité dans la liste.'));
    if (!author) return toast(t('Indiquez le nom à créditer.'));
    if (!file) return toast(t('Choisissez une image.'));
    if (!body.querySelector('#ph-ok').checked) return toast(t("Confirmez l'autorisation de l'auteur."));
    let blob;
    try { blob = await shrink(file, 1200); } catch (e) { return toast(e.message); }
    const n = (P[u.id]?.length || 0) + 1;
    let path = `photos/${u.id}-${slug(author) || 'photo'}-${n}.jpg`;
    let k = 2; while (Object.values(P).flat().some((p) => p.file === path) || E.pending.has(path)) path = `photos/${u.id}-${slug(author) || 'photo'}-${n}-${k++}.jpg`;
    E.pending.set(path, blob);
    (P[u.id] ||= []).push({ file: path, author, license: body.querySelector('#ph-license').value.trim() || 'CC BY 4.0', added: new Date().toISOString().slice(0, 10) });
    saveDraft(); render(); toast(t("Photo ajoutée au brouillon : publiez-la dans l'onglet Publier."));
  });
  body.querySelectorAll('[data-rmph]').forEach((b) => b.addEventListener('click', () => {
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('Confirmer'); return; }
    const [id, i] = b.dataset.rmph.split('|');
    const [removed] = P[id].splice(+i, 1);
    E.pending.delete(removed.file);
    if (!P[id].length) delete P[id];
    saveDraft(); render();
  }));
}
