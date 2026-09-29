// Atelier CONFIDENTIAL : les joueurs créent leurs unités, factions et blocs,
// voient l'aperçu des cartes, puis exportent un fichier à poster sur Discord (#confidential-units).
// Rien n'est envoyé automatiquement : le projet reste dans le navigateur jusqu'à l'export.
import { loadData, loadCustom, withCustom, typeLabel, CONF_PREFIX } from './data.js';
import { validateCustom, UNIT_TYPES } from './validate.js';
import { esc, uid, store, toast, openModal, unitCardHTML, brandLogo, mountCredit } from './ui.js';
import { shrink } from './images.js';
import { t, LANG, initLang, setLang } from './i18n.js';

const KEY = 'dust1947.atelier';
const DISCORD = 'https://discord.gg/h3xfZKeNvU';
const CHANNEL = '#confidential-units';
const FORMAT = 'dust194-confidential';
const PALETTE = ['#6b7a8f', '#8a5a44', '#4f7d5c', '#9a7b2f', '#7b5b8f', '#3f7f86', '#a0525a', '#5d6b3a'];
const MAX_FILE = 8 * 1024 * 1024; // marge sous la limite des pièces jointes Discord

const root = document.getElementById('at');
const A = { off: null, all: null, P: null, tab: 'units', sel: null, fsel: null, bsel: null, photos: new Map() };

const emptyProject = () => ({ v: 1, author: '', project: '', charter: false, blocs: [], factions: [], units: [] });
const clone = (x) => structuredClone(x);
const slug = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
const numOrNull = (v) => { v = String(v ?? '').trim(); if (v === '') return null; return /^-?\d+$/.test(v) ? parseInt(v, 10) : v; };
const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
const attacks = (v) => String(v || '').trim().split(/\s+/).filter(Boolean);
const bn = (b) => (LANG === 'en' && b?.nameEn) || b?.name || '';

// ---------------------------------------------------------------- Photos (IndexedDB, clé interne _k)
const IDB = (() => {
  let dbp;
  const open = () => (dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('dust1947-atelier', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction('photos', mode); const req = fn(tx.objectStore('photos'));
      tx.oncomplete = () => res(req?.result); tx.onerror = () => rej(tx.error);
    });
  };
  return { get: (k) => run('readonly', (s) => s.get(k)), set: (k, v) => run('readwrite', (s) => s.put(v, k)), del: (k) => run('readwrite', (s) => s.delete(k)), clear: () => run('readwrite', (s) => s.clear()) };
})();
const photoURL = (u) => A.photos.get(u._k) || null;
async function loadPhotos() {
  for (const u of A.P.units) {
    if (!u.hasPhoto) continue;
    const blob = await IDB.get(u._k).catch(() => null);
    if (blob) A.photos.set(u._k, URL.createObjectURL(blob)); else delete u.hasPhoto;
  }
}
const blobToDataURL = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
const dataURLToBlob = (d) => fetch(d).then((r) => r.blob());

// ---------------------------------------------------------------- Démarrage
initLang();
mountCredit();
topbar();
init();
async function init() {
  try {
    A.off = await loadData();
    if (LANG === 'en') {
      const en = await fetch('data/skills.en.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
      Object.assign(A.off.skills, en);
    }
    A.all = withCustom(A.off, await loadCustom());
  } catch (e) {
    root.innerHTML = `<div class="issue bad"><b>!</b><span>${esc(t('Impossible de charger la base : {e}', { e: e.message }))}</span></div>`;
    return;
  }
  A.P = { ...emptyProject(), ...store.get(KEY, {}) };
  await loadPhotos();
  render();
}
const save = () => { if (!store.set(KEY, A.P)) toast(t('Projet non sauvegardé (stockage local indisponible).')); };

function topbar() {
  const h = document.getElementById('topbar');
  h.innerHTML = `<a class="brand with-logo" href="index.html">${brandLogo()}<b>DUST 194∞</b><small>${t('Atelier')}</small></a>
  <nav class="topnav">
    <a href="index.html">${t('Builder')}</a>
    <a href="atelier.html" class="on">${t('Atelier')}</a>
    <button id="lang-btn" type="button" lang="${LANG === 'fr' ? 'en' : 'fr'}" title="${LANG === 'fr' ? 'English version' : 'Version française'}">${LANG === 'fr' ? 'EN' : 'FR'}</button>
    <button id="theme-btn" type="button">${t('Thème')}</button>
  </nav>`;
  h.querySelector('#lang-btn').addEventListener('click', () => { setLang(LANG === 'fr' ? 'en' : 'fr'); location.reload(); });
  h.querySelector('#theme-btn').addEventListener('click', () => {
    const r = document.documentElement;
    const cur = r.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    r.dataset.theme = cur === 'dark' ? 'light' : 'dark';
    store.set('dust1947.theme', r.dataset.theme);
  });
  { const th = store.get('dust1947.theme', null); if (th) document.documentElement.dataset.theme = th; }
  document.title = `DUST 194∞ ${t('Atelier CONFIDENTIAL')}`;
}

// ---------------------------------------------------------------- Projet → format custom.json
function cleanUnit(u) {
  const { _k, _idLocked, hasPhoto, ...rest } = u;
  return rest;
}
function asCustom(P = A.P) {
  const projBlocs = new Set(P.blocs.map((b) => b.id));
  const author = P.author.trim() || null;
  return {
    blocs: P.blocs.map((b) => ({ id: b.id, name: b.name, color: b.color, author, factions: P.factions.filter((f) => f.bloc === b.id).map((f) => ({ id: f.id, name: f.name, author })) })),
    factions: P.factions.filter((f) => !projBlocs.has(f.bloc)).map((f) => ({ bloc: f.bloc, id: f.id, name: f.name, author })),
    units: P.units.map((u) => ({ ...cleanUnit(u), author })),
    platoons: [],
    skills: {},
  };
}
// Base complète (officiel + CONFIDENTIAL publié) + projet en cours, pour l'aperçu et les menus
const preview = () => withCustom(A.all, asCustom());

function uniqueId(base, taken) {
  let id = base, i = 2;
  while (taken(id)) id = `${base}-${i++}`;
  return id;
}
function unitIdFor(u) {
  return uniqueId(`${CONF_PREFIX}${slug(u.bloc)}--${slug(u.name)}`, (id) => A.all.unitsById.has(id) || A.P.units.some((x) => x !== u && x.id === id));
}
function factionIdFor(name, self) {
  return uniqueId(`conf-${slug(name)}`, (id) => A.all.factionsById.has(id) || A.P.factions.some((f) => f !== self && f.id === id));
}
function blocIdFor(name, self) {
  return uniqueId(`conf-${slug(name)}`, (id) => A.all.blocsById.has(id) || A.P.blocs.some((b) => b !== self && b.id === id));
}

// ---------------------------------------------------------------- Rendu
function render() {
  const P = A.P;
  const counts = { units: P.units.length, factions: P.factions.length, blocs: P.blocs.length };
  root.innerHTML = `
  <div class="ed-head at-head">
    <div>
      <div class="eyebrow"><span class="conf-stamp">CONFIDENTIAL</span> ${t('Créations de la communauté')}</div>
      <h1 class="h-display">${t('Atelier CONFIDENTIAL')}</h1>
      <p>${t('Créez vos unités, factions et blocs pour DUST 194∞, vérifiez l\'aperçu des cartes, puis exportez un fichier à poster sur le Discord. Votre projet reste dans ce navigateur tant que vous ne l\'exportez pas.')}</p>
      <p class="hint at-tip">${t('Conseil : la création d\'unités (tableau d\'armes, aperçu) est bien plus confortable sur ordinateur.')}</p>
    </div>
  </div>
  ${charterHTML(false)}
  <section class="ed-sec at-project">
    <h2>${t('Mon projet')}</h2>
    <div class="row2">
      <label class="field"><span>${t('Pseudo du créateur (crédit)')}</span><input type="text" id="p-author" maxlength="60" value="${esc(P.author)}" placeholder="${t('Ex. L\'Heure du Loir')}"></label>
      <label class="field"><span>${t('Nom du projet')}</span><input type="text" id="p-name" maxlength="80" value="${esc(P.project)}" placeholder="${t('Ex. Revanchards')}"></label>
    </div>
    <div class="at-proj-acts">
      <label class="btn sm">${t('Reprendre un projet (.json)')}<input type="file" id="p-import" accept=".json,application/json" hidden></label>
      <button type="button" class="btn sm danger" id="p-reset" ${counts.units + counts.factions + counts.blocs ? '' : 'disabled'}>${t('Nouveau projet')}</button>
    </div>
    <p class="hint" style="margin:0">${t('Recharge un fichier exporté depuis cet atelier (<code>confidential-….json</code>) pour continuer ou corriger votre création. Les images se joignent unité par unité, dans l\'onglet Unités.')}</p>
  </section>
  <div class="ed-tabs" role="tablist">
    ${[['units', t('Unités')], ['factions', t('Factions')], ['blocs', t('Blocs inédits')], ['send', t('Envoyer')]].map(([k, l]) =>
      `<button role="tab" data-tab="${k}" class="${A.tab === k ? 'on' : ''}">${l}${counts[k] ? `<span class="count">${counts[k]}</span>` : ''}</button>`).join('')}
  </div>
  <div id="at-body"></div>`;
  root.querySelector('#p-author').addEventListener('change', (e) => { P.author = e.target.value.trim(); save(); });
  root.querySelector('#p-name').addEventListener('change', (e) => { P.project = e.target.value.trim(); save(); });
  root.querySelector('#p-import').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); });
  root.querySelector('#p-reset').addEventListener('click', (ev) => {
    const b = ev.currentTarget;
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('Confirmer : tout effacer'); return; }
    resetProject(); toast(t('Nouveau projet'));
  });
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { A.tab = b.dataset.tab; render(); }));
  const body = root.querySelector('#at-body');
  ({ units: renderUnits, factions: renderFactions, blocs: renderBlocs, send: renderSend })[A.tab](body);
}

function charterHTML(inSend) {
  const items = [
    [t('Création originale :'), t('proposez uniquement vos propres créations. Ne recopiez pas une carte officielle en changeant son nom.')],
    [t('Jouabilité :'), t('pensez à l\'équilibre du jeu. Une unité trop forte pour son coût sera renvoyée pour ajustement.')],
    [t('Crédit :'), t('votre pseudo apparaît sur chaque carte que vous créez.')],
    [t('Photos :'), t('joignez uniquement des photos de vos propres figurines.')],
    [t('Validation :'), t('chaque proposition est relue avant publication. Elle peut être corrigée, ajustée ou refusée.')],
    [t('Envoi :'), t('exportez votre fichier et postez-le dans le salon {c} du Discord.', { c: CHANNEL })],
  ];
  return `<details class="ed-sec at-charter" ${inSend || !A.P.charter ? 'open' : ''}>
    <summary><h2>${t('Charte des créations CONFIDENTIAL')}</h2></summary>
    <p>${t('L\'atelier permet à la communauté de proposer ses propres unités, factions et blocs pour DUST 194∞. Ces créations ne sont pas officielles : elles portent toujours la mention CONFIDENTIAL et ne sont visibles que dans les armées où la case CONFIDENTIAL est cochée.')}</p>
    <ul>${items.map(([a, b]) => `<li><b>${a}</b> ${b}</li>`).join('')}</ul>
  </details>`;
}

// ---------------------------------------------------------------- Unités
function renderUnits(body) {
  const P = A.P, D = preview();
  const u = P.units.find((x) => x._k === A.sel);
  const templates = A.all.units;
  const tplLabel = (x) => `${x.name} — ${bn(A.all.blocsById.get(x.bloc)) || x.bloc}`;
  body.innerHTML = `<div class="ed-grid">
    <aside class="ed-side">
      <div class="ed-list">${P.units.map((x) => `<button class="ed-item ${x._k === A.sel ? 'on' : ''}" data-sel="${esc(x._k)}"><span>${esc(x.name)}</span><small>${esc(x.cost ?? '')}</small></button>`).join('') || `<p class="empty" style="padding:8px">${t('Aucune unité pour le moment.')}</p>`}</div>
      <button class="btn primary" id="u-new">${t('+ Nouvelle unité')}</button>
      <div class="at-tpl">
        <label class="field"><span>${t('Partir d\'une unité existante')}</span>
          <input type="text" id="u-tpl" list="tpl-dl" placeholder="${t('Nom d\'unité…')}"></label>
        <datalist id="tpl-dl">${templates.map((x) => `<option value="${esc(tplLabel(x))}">`).join('')}</datalist>
        <button class="btn sm" id="u-tpl-go">${t('Copier comme modèle')}</button>
      </div>
    </aside>
    <section>${u ? `<div class="at-unit"><div>${unitForm(u, D)}</div><aside class="at-prev-col"><div class="eyebrow">${t('Aperçu de la carte')}</div><div id="u-preview" class="at-preview"></div></aside></div>`
      : `<div class="ed-sec"><p class="hint" style="margin:0">${t('Créez une nouvelle unité, ou partez d\'une unité existante pour gagner du temps. Chaque unité est rattachée à un bloc et, si vous le souhaitez, à une faction (officielle ou créée dans l\'onglet Factions).')}</p></div>`}</section>
  </div>`;
  body.querySelectorAll('[data-sel]').forEach((b) => b.addEventListener('click', () => { A.sel = b.dataset.sel; render(); }));
  body.querySelector('#u-new').addEventListener('click', () => {
    const nu = { _k: uid() + uid(), id: '', name: t('Nouvelle unité'), subtitle: '', bloc: P.blocs[0]?.id || 'Allies', type: 'infantry', faction: null, cost: 0, health: null, move: 2, march: 4, armor: 2, capturable: false, skills: [], customSkills: [], weapons: [] };
    nu.id = unitIdFor(nu); P.units.push(nu); A.sel = nu._k; save(); render();
  });
  body.querySelector('#u-tpl-go').addEventListener('click', () => {
    const v = body.querySelector('#u-tpl').value.trim();
    const src = templates.find((x) => tplLabel(x) === v);
    if (!src) { toast(t('Choisissez une unité dans la liste.')); return; }
    const { id, confidential, author, approved, image, ...rest } = clone(src);
    const nu = { _k: uid() + uid(), id: '', ...rest, customSkills: rest.customSkills || [], weapons: rest.weapons || [] };
    nu.id = unitIdFor(nu); P.units.push(nu); A.sel = nu._k; save(); render();
    toast(t('Modèle copié : renommez l\'unité et adaptez-la.'));
  });
  if (u) { bindUnitForm(body, u); showPreview(); }
}

function unitForm(u, D) {
  const bloc = D.blocsById.get(u.bloc);
  const skills = Object.keys(D.skills).sort((a, b) => a.localeCompare(b));
  return `<form class="ed-form" id="u-form" autocomplete="off">
    <div class="ed-sec">
      <h2>${t('Identité')}</h2>
      <div class="idline">id : ${esc(u.id)}${u._idLocked ? '' : ` · ${t('suit le nom jusqu\'au premier export')}`}</div>
      <div class="row2">
        <label class="field"><span>${t('Nom')}</span><input type="text" name="name" value="${esc(u.name)}"></label>
        <label class="field"><span>${t('Sous-titre')}</span><input type="text" name="subtitle" value="${esc(u.subtitle)}" placeholder="${t('Surnom, désignation, régiment…')}"></label>
      </div>
      <div class="row2">
        <label class="field"><span>${t('Bloc')}</span><select name="bloc">${D.blocs.map((b) => `<option value="${esc(b.id)}" ${b.id === u.bloc ? 'selected' : ''}>${esc(bn(b))}${b.confidential ? ' · CONFIDENTIAL' : ''}</option>`).join('')}</select></label>
        <label class="field"><span>${t('Type')}</span><select name="type">${UNIT_TYPES.map((ty) => `<option value="${ty}" ${ty === u.type ? 'selected' : ''}>${esc(typeLabel(ty))}</option>`).join('')}</select></label>
        <label class="field"><span>${t('Faction')}</span><select name="faction"><option value="">${t('— Bloc (aucune) —')}</option>${(bloc?.factions || []).map((f) => `<option value="${esc(f.id)}" ${f.id === u.faction ? 'selected' : ''}>${esc(f.name)}${f.confidential ? ' · CONFIDENTIAL' : ''}</option>`).join('')}</select></label>
      </div>
    </div>
    <div class="ed-sec">
      <h2>${t('Caractéristiques')}</h2>
      <div class="row5">
        ${[['cost', t('Points')], ['armor', t('Armure')], ['health', t('Santé')], ['move', t('Mouvement')], ['march', t('Marche')]].map(([k, l]) => `<label class="field"><span>${l}</span><input type="text" inputmode="numeric" name="${k}" value="${esc(u[k] ?? '')}"></label>`).join('')}
      </div>
      <label class="check"><input type="checkbox" name="capturable" ${u.capturable ? 'checked' : ''}> ${t('Peut être aligné comme véhicule capturé par un autre bloc')}</label>
      <label class="field"><span>${t('Compétences officielles (séparées par des virgules)')}</span><input type="text" name="skills" list="skills-dl" value="${esc((u.skills || []).join(', '))}"></label>
      <datalist id="skills-dl">${skills.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
    </div>
    <div class="ed-sec">
      <h2>${t('Règles inédites')}</h2>
      <p class="hint" style="margin:0">${t('Une compétence qui n\'existe pas sur les cartes officielles : donnez-lui un nom et une description complète.')}</p>
      ${(u.customSkills || []).map((c, i) => `<div class="wedit"><div class="wedit-h"><b>${t('Compétence {n}', { n: i + 1 })}</b><button type="button" class="btn sm danger" data-rmcs="${i}">${t('Retirer')}</button></div>
        <input type="text" name="cs-name-${i}" value="${esc(c.name)}" placeholder="${t('Nom')}"><textarea name="cs-desc-${i}" rows="2" placeholder="${t('Description')}">${esc(c.description)}</textarea></div>`).join('')}
      <div><button type="button" class="btn sm" id="add-cs">${t('+ Règle inédite')}</button></div>
    </div>
    <div class="ed-sec">
      <h2>${t('Armes')}</h2>
      <p class="hint" style="margin:0">${t("Valeurs d'attaque séparées par des espaces, dans l'ordre des classes d'armure (ex. <code>7/1 6/1 4/1 2/1</code>). Laissez vide si l'arme ne peut pas viser ce type.")} ${t('Attaque à gabarit : B, BB ou DB (ex. <code>B/1</code>). Destruction automatique : AK (ex. <code>1/AK</code>).')}</p>
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
    <div class="ed-sec">
      <h2>${t('Photo de la figurine (facultatif)')}</h2>
      ${photoURL(u) ? `<img class="at-photo" src="${photoURL(u)}" alt="">` : `<p class="hint" style="margin:0">${t('Une photo de votre figurine peinte. Elle est réduite automatiquement et jointe au fichier exporté.')}</p>`}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <label class="btn sm">${photoURL(u) ? t('Remplacer') : t('Ajouter une photo')}<input type="file" id="u-photo" accept="image/*" hidden></label>
        ${photoURL(u) ? `<button type="button" class="btn sm danger" id="u-photo-rm">${t('Retirer')}</button>` : ''}
      </div>
    </div>
    <div class="ed-actions">
      <button type="button" class="btn" id="u-dup">${t('Dupliquer')}</button>
      <span class="spacer"></span>
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
  const D = preview();
  u.faction = g('faction') && D.blocsById.get(u.bloc)?.factions.some((x) => x.id === g('faction')) ? g('faction') : null;
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
  if (!u._idLocked) u.id = unitIdFor(u);
}

function showPreview() {
  const u = A.P.units.find((x) => x._k === A.sel);
  const box = document.getElementById('u-preview');
  if (!u || !box) return;
  const D = preview();
  const pu = D.unitsById.get(u.id);
  if (!pu) { box.innerHTML = ''; return; }
  const ph = photoURL(u);
  box.innerHTML = `<div class="modal at-card">${unitCardHTML(pu, D, { cost: pu.cost, topHTML: ph ? `<img class="at-photo" src="${ph}" alt="">` : '' })}</div>`;
}

function bindUnitForm(body, u) {
  const P = A.P;
  const form = body.querySelector('#u-form');
  const apply = () => { readUnitForm(form, u); save(); };
  form.addEventListener('change', (e) => {
    if (e.target.id === 'u-photo') return;
    apply();
    if (['bloc', 'name', 'cost', 'type'].includes(e.target.name)) render(); else showPreview();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  form.querySelector('#add-w').addEventListener('click', () => { apply(); u.weapons.push({ name: t('Nouvelle arme'), count: 1, range: 1, specials: [], vsInfantry: [], vsVehicle: [], vsAircraft: [] }); save(); render(); });
  form.querySelector('#add-cs').addEventListener('click', () => { apply(); (u.customSkills ||= []).push({ name: '', description: '' }); save(); render(); });
  form.querySelectorAll('[data-rmw]').forEach((b) => b.addEventListener('click', () => { apply(); u.weapons.splice(+b.dataset.rmw, 1); save(); render(); }));
  form.querySelectorAll('[data-wup]').forEach((b) => b.addEventListener('click', () => { apply(); const i = +b.dataset.wup; [u.weapons[i - 1], u.weapons[i]] = [u.weapons[i], u.weapons[i - 1]]; save(); render(); }));
  form.querySelectorAll('[data-rmcs]').forEach((b) => b.addEventListener('click', () => { apply(); u.customSkills.splice(+b.dataset.rmcs, 1); save(); render(); }));
  form.querySelector('#u-photo').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const blob = await shrink(file, 1000);
      await IDB.set(u._k, blob);
      if (A.photos.has(u._k)) URL.revokeObjectURL(A.photos.get(u._k));
      A.photos.set(u._k, URL.createObjectURL(blob));
      u.hasPhoto = true; save(); render(); toast(t('Photo ajoutée'));
    } catch (err) { toast(err.message || t('Stockage d\'images indisponible dans ce navigateur.')); }
  });
  form.querySelector('#u-photo-rm')?.addEventListener('click', async () => {
    await IDB.del(u._k).catch(() => {}); URL.revokeObjectURL(A.photos.get(u._k)); A.photos.delete(u._k); delete u.hasPhoto; save(); render();
  });
  form.querySelector('#u-dup').addEventListener('click', () => {
    apply();
    const { _k, _idLocked, hasPhoto, ...rest } = clone(u);
    const c = { ...rest, _k: uid() + uid(), name: u.name + t(' (copie)') };
    c.id = unitIdFor(c);
    P.units.splice(P.units.indexOf(u) + 1, 0, c); A.sel = c._k; save(); render();
  });
  form.querySelector('#u-del').addEventListener('click', async (ev) => {
    const b = ev.currentTarget;
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('Confirmer la suppression'); return; }
    if (u.hasPhoto) { await IDB.del(u._k).catch(() => {}); URL.revokeObjectURL(A.photos.get(u._k)); A.photos.delete(u._k); }
    P.units = P.units.filter((x) => x !== u); A.sel = null; save(); render();
  });
}

// ---------------------------------------------------------------- Factions
function renderFactions(body) {
  const P = A.P, D = preview();
  const f = P.factions.find((x) => x.id === A.fsel);
  const used = (id) => P.units.filter((u) => u.faction === id).length;
  body.innerHTML = `<div class="ed-grid">
    <aside class="ed-side">
      <div class="ed-list">${P.factions.map((x) => `<button class="ed-item ${x.id === A.fsel ? 'on' : ''}" data-fsel="${esc(x.id)}"><span>${esc(x.name)}</span><small>${esc(bn(D.blocsById.get(x.bloc)))}</small></button>`).join('') || `<p class="empty" style="padding:8px">${t('Aucune faction pour le moment.')}</p>`}</div>
      <button class="btn primary" id="f-new">${t('+ Nouvelle faction')}</button>
    </aside>
    <section>${f ? `<form class="ed-form" id="f-form" autocomplete="off"><div class="ed-sec">
        <h2>${t('Faction')}</h2>
        <div class="idline">id : ${esc(f.id)}</div>
        <div class="row2">
          <label class="field"><span>${t('Nom')}</span><input type="text" name="name" value="${esc(f.name)}"></label>
          <label class="field"><span>${t('Bloc')}</span><select name="bloc">${D.blocs.map((b) => `<option value="${esc(b.id)}" ${b.id === f.bloc ? 'selected' : ''}>${esc(bn(b))}${b.confidential ? ' · CONFIDENTIAL' : ''}</option>`).join('')}</select></label>
        </div>
        <p class="hint" style="margin:0">${t('{n} unité(s) du projet rattachée(s) à cette faction.', { n: used(f.id) })}</p>
      </div>
      <div class="ed-actions"><span class="spacer"></span><button type="button" class="btn danger" id="f-del">${t('Supprimer')}</button></div></form>`
      : `<div class="ed-sec"><p class="hint" style="margin:0">${t('Une faction (ou sous-faction) se rattache à un bloc officiel, par exemple une nouvelle faction Alliés, ou à un bloc inédit créé dans l\'onglet Blocs inédits.')}</p></div>`}</section>
  </div>`;
  body.querySelectorAll('[data-fsel]').forEach((b) => b.addEventListener('click', () => { A.fsel = b.dataset.fsel; render(); }));
  body.querySelector('#f-new').addEventListener('click', () => {
    const nf = { bloc: P.blocs[0]?.id || 'Allies', id: '', name: t('Nouvelle faction') };
    nf.id = factionIdFor(nf.name, nf); P.factions.push(nf); A.fsel = nf.id; save(); render();
  });
  if (!f) return;
  const form = body.querySelector('#f-form');
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('change', () => {
    const fd = new FormData(form);
    const oldId = f.id;
    f.name = String(fd.get('name') || '').trim() || f.name;
    const oldBloc = f.bloc; f.bloc = fd.get('bloc');
    // L'identifiant suit le nom tant que la faction n'a pas été exportée
    if (!f._idLocked) f.id = factionIdFor(f.name, f);
    for (const u of P.units) if (u.faction === oldId) { u.faction = f.id; if (oldBloc !== f.bloc) u.bloc = f.bloc; if (!u._idLocked) u.id = unitIdFor(u); }
    A.fsel = f.id; save(); render();
  });
  form.querySelector('#f-del').addEventListener('click', (ev) => {
    if (used(f.id)) { toast(t('Impossible : {n} unité(s) utilisent cette faction.', { n: used(f.id) })); return; }
    const b = ev.currentTarget;
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('Confirmer la suppression'); return; }
    P.factions = P.factions.filter((x) => x !== f); A.fsel = null; save(); render();
  });
}

// ---------------------------------------------------------------- Blocs inédits
function renderBlocs(body) {
  const P = A.P;
  const b = P.blocs.find((x) => x.id === A.bsel);
  const usedBy = (id) => P.units.filter((u) => u.bloc === id).length + P.factions.filter((f) => f.bloc === id).length;
  body.innerHTML = `<div class="ed-grid">
    <aside class="ed-side">
      <div class="ed-list">${P.blocs.map((x) => `<button class="ed-item ${x.id === A.bsel ? 'on' : ''}" data-bsel="${esc(x.id)}"><span><span class="swatch" style="--bc:${esc(x.color)}"></span> ${esc(x.name)}</span></button>`).join('') || `<p class="empty" style="padding:8px">${t('Aucun bloc inédit.')}</p>`}</div>
      <button class="btn primary" id="b-new">${t('+ Nouveau bloc')}</button>
    </aside>
    <section>${b ? `<form class="ed-form" id="b-form" autocomplete="off"><div class="ed-sec">
        <h2>${t('Bloc inédit')}</h2>
        <div class="idline">id : ${esc(b.id)}</div>
        <label class="field"><span>${t('Nom')}</span><input type="text" name="name" value="${esc(b.name)}"></label>
        <div class="field"><span>${t('Pastille de couleur')}</span>
          <div class="at-palette">${PALETTE.map((c) => `<label style="--bc:${c}"><input type="radio" name="color" value="${c}" ${c === b.color ? 'checked' : ''}><span class="swatch"></span></label>`).join('')}</div></div>
        <p class="hint" style="margin:0">${t('Les factions de ce bloc se créent dans l\'onglet Factions, et ses unités dans l\'onglet Unités.')}</p>
      </div>
      <div class="ed-actions"><span class="spacer"></span><button type="button" class="btn danger" id="b-del">${t('Supprimer')}</button></div></form>`
      : `<div class="ed-sec"><p class="hint" style="margin:0">${t('Un bloc inédit est une armée entièrement nouvelle, avec ses propres factions et unités. Pour ajouter des unités à un bloc officiel, pas besoin de créer de bloc.')}</p></div>`}</section>
  </div>`;
  body.querySelectorAll('[data-bsel]').forEach((x) => x.addEventListener('click', () => { A.bsel = x.dataset.bsel; render(); }));
  body.querySelector('#b-new').addEventListener('click', () => {
    const nb = { id: '', name: t('Nouveau bloc'), color: PALETTE[P.blocs.length % PALETTE.length] };
    nb.id = blocIdFor(nb.name, nb); P.blocs.push(nb); A.bsel = nb.id; save(); render();
  });
  if (!b) return;
  const form = body.querySelector('#b-form');
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('change', () => {
    const fd = new FormData(form);
    const oldId = b.id;
    b.name = String(fd.get('name') || '').trim() || b.name;
    b.color = fd.get('color') || b.color;
    if (!b._idLocked) b.id = blocIdFor(b.name, b);
    if (b.id !== oldId) {
      for (const f of P.factions) if (f.bloc === oldId) f.bloc = b.id;
      for (const u of P.units) if (u.bloc === oldId) { u.bloc = b.id; if (!u._idLocked) u.id = unitIdFor(u); }
    }
    A.bsel = b.id; save(); render();
  });
  form.querySelector('#b-del').addEventListener('click', (ev) => {
    if (usedBy(b.id)) { toast(t('Impossible : ce bloc contient encore des factions ou des unités.')); return; }
    const x = ev.currentTarget;
    if (!x.classList.contains('armed')) { x.classList.add('armed'); x.textContent = t('Confirmer la suppression'); return; }
    P.blocs = P.blocs.filter((y) => y !== b); A.bsel = null; save(); render();
  });
}

// ---------------------------------------------------------------- Vérification et envoi
function checks() {
  const P = A.P;
  const errors = [], warnings = [];
  if (!P.author.trim()) errors.push(t('Indiquez votre pseudo (il servira de crédit).'));
  if (!P.project.trim()) errors.push(t('Donnez un nom à votre projet.'));
  if (!P.units.length && !P.factions.length && !P.blocs.length) errors.push(t('Le projet est vide : créez au moins une unité, une faction ou un bloc.'));
  for (const u of P.units) {
    if (!u.weapons?.length && u.type !== 'token') warnings.push(t('{n} : aucune arme.', { n: u.name }));
    for (const c of u.customSkills || []) if (!c.name || !c.description) errors.push(t('{n} : une règle inédite n\'a pas de nom ou de description.', { n: u.name }));
    for (const s of [...(u.skills || []), ...(u.weapons || []).flatMap((w) => w.specials || [])]) {
      if (!A.all.skills[s] && !(u.customSkills || []).some((c) => c.name === s)) warnings.push(t('{n} : « {s} » n\'est pas une compétence officielle. Si c\'est une règle inédite, ajoutez-la avec sa description.', { n: u.name, s }));
    }
  }
  for (const b of P.blocs) if (!P.factions.some((f) => f.bloc === b.id) && !P.units.some((u) => u.bloc === b.id)) warnings.push(t('Le bloc « {n} » ne contient encore ni faction ni unité.', { n: b.name }));
  const v = validateCustom(asCustom(), { units: A.all.units }, { blocs: A.all.blocs, platoons: A.all.platoons }, A.all.skills);
  // Les compétences inconnues sont déjà signalées plus clairement ci-dessus
  const skip = (m) => m.startsWith(t('Compétence sans description : {s}', { s: '' }));
  errors.push(...v.errors); warnings.push(...v.warnings.filter((m) => !skip(m)));
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

function renderSend(body) {
  const P = A.P;
  const v = checks();
  const nPhotos = P.units.filter((u) => u.hasPhoto).length;
  body.innerHTML = `<div class="ed-form">
    <div class="ed-sec">
      <h2>${t('Récapitulatif')}</h2>
      <ul class="changes">
        <li><b>${t('Projet :')}</b> ${esc(P.project || '—')} · <b>${t('Créateur :')}</b> ${esc(P.author || '—')}</li>
        ${P.blocs.length ? `<li><b>${t('Blocs inédits ({n}) :', { n: P.blocs.length })}</b> ${P.blocs.map((b) => esc(b.name)).join(', ')}</li>` : ''}
        ${P.factions.length ? `<li><b>${t('Factions ({n}) :', { n: P.factions.length })}</b> ${P.factions.map((f) => esc(f.name)).join(', ')}</li>` : ''}
        ${P.units.length ? `<li><b>${t('Unités ({n}) :', { n: P.units.length })}</b> ${P.units.map((u) => esc(u.name)).join(', ')}</li>` : ''}
        ${nPhotos ? `<li><b>${t('Photos :')}</b> ${nPhotos}</li>` : ''}
      </ul>
    </div>
    <div class="ed-sec">
      <h2>${t('Vérification')}</h2>
      <div class="issues">
        ${v.errors.map((m) => `<div class="issue bad"><b>✕</b><span>${esc(m)}</span></div>`).join('')}
        ${v.warnings.map((m) => `<div class="issue warn"><b>!</b><span>${esc(m)}</span></div>`).join('')}
        ${!v.errors.length ? `<div class="issue info"><b>✓</b><span>${t('Aucune erreur bloquante. Les avertissements n\'empêchent pas l\'envoi, mais relisez-les.')}</span></div>` : ''}
      </div>
    </div>
    ${charterHTML(true)}
    <div class="ed-sec">
      <h2>${t('Envoyer ma création')}</h2>
      <label class="check"><input type="checkbox" id="s-charter" ${P.charter ? 'checked' : ''}> ${t('Je confirme que cette création est la mienne et j\'accepte qu\'elle soit publiée dans l\'app avec mon crédit.')}</label>
      <ol class="pub-steps">
        <li>${t('Téléchargez le fichier de votre projet :')} <button class="btn sm primary" id="s-export" ${v.errors.length || !P.charter ? 'disabled' : ''}>${t('Télécharger le fichier')}</button></li>
        <li>${t('Postez ce fichier dans le salon {c} du Discord, avec quelques mots sur votre création.', { c: `<b>${CHANNEL}</b>` })} <a class="btn sm" href="${DISCORD}" target="_blank" rel="noopener">${t('Ouvrir le Discord')}</a></li>
        <li>${t('Votre proposition est relue. Une fois validée, elle apparaît dans le builder pour toutes les armées CONFIDENTIAL, avec votre crédit.')}</li>
      </ol>
      <p class="hint" style="margin:0">${t('Pour corriger votre création plus tard, gardez ce fichier : « Reprendre un projet » le recharge dans l\'atelier.')}</p>
    </div>
  </div>`;
  body.querySelector('#s-charter').addEventListener('change', (e) => { P.charter = e.target.checked; save(); render(); });
  body.querySelector('#s-export').addEventListener('click', exportFile);
}

async function exportFile() {
  const P = A.P;
  if (checks().errors.length || !P.charter) return;
  // Les identifiants sont figés au premier export : une nouvelle version garde les mêmes
  for (const x of [...P.units, ...P.factions, ...P.blocs]) x._idLocked = true;
  save();
  const c = asCustom();
  for (const [i, u] of P.units.entries()) {
    if (!u.hasPhoto) continue;
    const blob = await IDB.get(u._k).catch(() => null);
    if (blob) c.units[i].photo = await blobToDataURL(blob);
  }
  const out = { format: FORMAT, version: 1, exported: new Date().toISOString(), author: P.author.trim(), project: P.project.trim(), charterAccepted: true, ...c };
  const text = JSON.stringify(out, null, 1) + '\n';
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `confidential-${slug(P.project)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  if (blob.size > MAX_FILE) toast(t('Fichier volumineux ({n} Mo) : Discord risque de le refuser. Retirez quelques photos si besoin.', { n: (blob.size / 1048576).toFixed(1) }));
  else toast(t('Fichier prêt : postez-le dans {c}.', { c: CHANNEL }));
  render();
}

// ---------------------------------------------------------------- Import / nouveau projet
async function resetProject() {
  for (const url of A.photos.values()) URL.revokeObjectURL(url);
  A.photos.clear(); await IDB.clear().catch(() => {});
  A.P = emptyProject(); A.sel = A.fsel = A.bsel = null; A.tab = 'units'; save(); render();
}

async function importFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast(t('Ce fichier n\'est pas un projet de l\'atelier. Choisissez un fichier confidential-….json exporté depuis l\'onglet Envoyer.')); return; }
  if (data?.format !== FORMAT || !Array.isArray(data.units)) { toast(t('Ce fichier n\'est pas un projet de l\'atelier. Choisissez un fichier confidential-….json exporté depuis l\'onglet Envoyer.')); return; }
  const P = A.P;
  const doImport = async () => {
    await resetProject();
    const NP = emptyProject();
    NP.author = data.author || ''; NP.project = data.project || '';
    NP.blocs = (data.blocs || []).map((b) => ({ id: b.id, name: b.name, color: b.color, _idLocked: true }));
    NP.factions = [
      ...(data.blocs || []).flatMap((b) => (b.factions || []).map((f) => ({ bloc: b.id, id: f.id, name: f.name, _idLocked: true }))),
      ...(data.factions || []).map((f) => ({ bloc: f.bloc, id: f.id, name: f.name, _idLocked: true })),
    ];
    for (const src of data.units) {
      const { photo, author, confidential, approved, ...u } = src;
      const nu = { ...u, _k: uid() + uid(), _idLocked: true, customSkills: u.customSkills || [], weapons: u.weapons || [], skills: u.skills || [] };
      if (photo) {
        try { const blob = await dataURLToBlob(photo); await IDB.set(nu._k, blob); A.photos.set(nu._k, URL.createObjectURL(blob)); nu.hasPhoto = true; } catch { /* photo illisible ignorée */ }
      }
      NP.units.push(nu);
    }
    A.P = NP; save(); render();
    toast(t('Projet « {n} » importé.', { n: NP.project || file.name }));
  };
  if (!P.units.length && !P.factions.length && !P.blocs.length) return doImport();
  openModal(`<div class="modal-h"><div><div class="eyebrow">${t('Reprendre un projet (.json)')}</div><h2>${t('Remplacer le projet actuel ?')}</h2>
      <p>${t('Le projet en cours dans l\'atelier sera remplacé par le contenu du fichier.')}</p></div><button class="btn icon" data-close-btn aria-label="${t('Fermer')}">✕</button></div>
    <div class="modal-b"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="imp-ok">${t('Remplacer')}</button><button class="btn" data-close-btn>${t('Annuler')}</button></div></div>`, (r, close) => {
    r.querySelector('#imp-ok').addEventListener('click', () => { close(); doImport(); });
  });
}
