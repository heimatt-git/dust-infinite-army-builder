// DUST 194∞ Builder — application principale (français / anglais)
import { loadData, loadCustom, withCustom, typeLabel, MERC, unitCost, canPilot } from './data.js';
import { analyzeArmy, entryCost, blocName, factionName, CAPTURED_SURCHARGE, isJoiner, isCommissar } from './rules.js';
import { esc, uid, store, toast, copyText, openModal, unitCardHTML, guessRepo } from './ui.js';
import { t, LANG, initLang, setLang } from './i18n.js';
import { initImages, imagesAvailable, imageURL, hasImage, imageCount, saveImage, deleteImage, clearImages, matchFiles, storageEstimate, SIDES } from './images.js';

const LS_KEY = 'dust1947.lists';
const LIMITS = [25, 50, 100, 150, 200];
const TYPE_ORDER = ['hero', 'infantry', 'vehicle', 'aircraft', 'token'];

const S = {
  data: null,
  lists: [],
  list: null,
  undo: null,
  ui: { catTab: 'units', type: 'all', faction: 'all', q: '', mtab: 'catalog', newBloc: 'Allies', newLimit: 100, newConf: false, newName: '' },
  official: null, // base officielle
  all: null,      // base officielle + créations CONFIDENTIAL
};

const app = document.getElementById('app');

// ---------------------------------------------------------------- Démarrage
initLang();
init();
async function init() {
  try {
    S.data = await loadData();
    if (LANG === 'en') {
      // Descriptions de règles d'armes rédigées en français dans la base : version anglaise
      const en = await fetch('data/skills.en.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
      Object.assign(S.data.skills, en);
    }
    S.official = S.data;
    S.all = withCustom(S.official, await loadCustom());
  } catch (e) {
    app.innerHTML = `<div class="wrap"><div class="issue bad"><b>!</b><span>${esc(t('Impossible de charger la base : {e}. Si vous ouvrez le fichier directement depuis votre disque, utilisez plutôt un petit serveur local (voir README).', { e: e.message }))}</span></div></div>`;
    return;
  }
  S.lists = store.get(LS_KEY, []);
  await initImages();
  window.addEventListener('hashchange', route);
  route();
}

function saveLists() {
  if (S.list) {
    S.list.updated = Date.now();
    const i = S.lists.findIndex((l) => l.id === S.list.id);
    if (i >= 0) S.lists[i] = S.list; else S.lists.unshift(S.list);
  }
  if (!store.set(LS_KEY, S.lists)) toast(t('Sauvegarde locale indisponible (navigation privée ?) : utilisez « Partager » pour garder votre liste.'));
}

function route() {
  const h = location.hash;
  if (h.startsWith('#l=')) return importFromCode(h.slice(3));
  const m = h.match(/^#\/liste\/([\w-]+)/);
  if (m) {
    const l = S.lists.find((x) => x.id === m[1]);
    if (l) { S.list = l; S.data = dataFor(l); return renderBuilder(); }
  }
  S.list = null; S.data = S.official;
  renderHome();
}

// Une armée CONFIDENTIAL voit la base officielle + les créations de la communauté
const dataFor = (l) => (l?.confidential ? S.all : S.official);

function go(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}

function topbar(active) {
  return `<header class="topbar">
    <a class="brand" href="#/"><b>DUST 194∞</b><small>Builder</small></a>
    <nav class="topnav">
      <a href="#/" class="${active === 'home' ? 'on' : ''}">${t('Mes listes')}</a>
      <a href="shot.html">Shot Format</a>
      <a href="atelier.html">${t('Atelier')}</a>
      <button id="lang-btn" type="button" lang="${LANG === 'fr' ? 'en' : 'fr'}" title="${LANG === 'fr' ? 'English version' : 'Version française'}">${LANG === 'fr' ? 'EN' : 'FR'}</button>
      <button id="theme-btn" title="${t('Changer de thème')}">${t('Thème')}</button>
    </nav>
  </header>`;
}

function bindTopbar() {
  document.getElementById('lang-btn')?.addEventListener('click', () => { setLang(LANG === 'fr' ? 'en' : 'fr'); location.reload(); });
  document.getElementById('theme-btn')?.addEventListener('click', () => {
    const r = document.documentElement;
    const cur = r.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    r.dataset.theme = cur === 'dark' ? 'light' : 'dark';
    store.set('dust1947.theme', r.dataset.theme);
  });
}
{ const t = store.get('dust1947.theme', null); if (t) document.documentElement.dataset.theme = t; }

// ---------------------------------------------------------------- Accueil
function renderHome() {
  const D = S.official;
  const DB = S.ui.newConf ? S.all : S.official; // blocs proposés selon la case CONFIDENTIAL
  const blocs = DB.blocs;
  const hasCustom = S.all !== S.official;
  const lists = [...S.lists].sort((a, b) => (b.updated || 0) - (a.updated || 0));
  app.innerHTML = `${topbar('home')}
  <main class="wrap home">
    <section class="home-hero">
      <div class="eyebrow">${t('Outil communautaire · base {v}', { v: esc(D.meta.version || '') })}</div>
      <h1 class="h-display">${t('Levez votre armée')}</h1>
      <p>${t('Choisissez un bloc et un format, puis composez vos pelotons. Les points, le bonus de faction, les héros et les véhicules capturés sont vérifiés en direct. {u} unités et {p} pelotons disponibles.', { u: D.units.length, p: D.platoons.length })}</p>
    </section>
    <div class="home-grid">
      <section class="panel">
        <h2>${t('Nouvelle armée')}</h2>
        <form class="new-army" id="new-form">
          <label class="field"><span>${t('Nom')}</span><input type="text" id="new-name" placeholder="${t('Ex. Rangers de Kasserine')}" maxlength="80" value="${esc(S.ui.newName)}"></label>
          ${hasCustom ? `<label class="conf-check"><input type="checkbox" id="new-conf" ${S.ui.newConf ? 'checked' : ''}>
            <span><b class="conf-stamp">CONFIDENTIAL</b> ${t('Inclure les unités et factions custom')}<small>${t('Créations de la communauté, non officielles. Réglage fixé à la création de l\'armée.')}</small></span></label>` : ''}
          <div class="field"><span>${t('Bloc')}</span>
            <div class="bloc-pick">
              ${blocs.map((b) => `<label style="--bc:${esc(b.color)}"><input type="radio" name="bloc" value="${esc(b.id)}" ${b.id === S.ui.newBloc ? 'checked' : ''}>
                <b><span class="swatch"></span> ${esc(blocName(b.id, DB))}</b><small>${t('{n} unités', { n: DB.units.filter((u) => u.bloc === b.id).length })}${b.confidential ? ' · <span class="conf-mini">CONFIDENTIAL</span>' : ''}</small></label>`).join('')}
            </div>
          </div>
          <div class="field"><span>${t("Format (points d'armée)")}</span>
            <div class="limits">
              ${LIMITS.map((l) => `<button type="button" class="btn sm ${l === S.ui.newLimit ? 'on' : ''}" data-limit="${l}">${l}</button>`).join('')}
              <input type="number" id="new-limit" min="1" max="2000" value="${S.ui.newLimit}" aria-label="${t('Points personnalisés')}">
            </div>
          </div>
          <button class="btn primary" type="submit">${t("Créer l'armée")}</button>
        </form>
      </section>
      <section class="panel">
        <h2>${t('Mes listes ({n})', { n: lists.length })}</h2>
        <div class="saved">
          ${lists.length ? lists.map((l) => savedRow(l)).join('') : `<p class="empty">${t('Aucune liste enregistrée sur cet appareil. Les listes sont gardées dans votre navigateur ; utilisez « Partager » pour les envoyer ou les retrouver ailleurs.')}</p>`}
        </div>
        <form id="import-form" style="display:grid;gap:6px;margin-top:16px">
          <label class="field"><span>${t('Importer un lien de partage')}</span><input type="text" id="import-code" placeholder="${t('Collez un lien ou un code de liste')}"></label>
          <div><button class="btn sm" type="submit">${t('Importer')}</button></div>
        </form>
      </section>
    </div>
    ${imagesPanelHTML()}
    <p class="foot">${t("Outil de fan non officiel. DUST, DUST 1947 et les données de jeu appartiennent à leurs ayants droit. Les photos de la communauté appartiennent à leurs auteurs (CC BY 4.0). Données reprises de l'application DUST ENLIST 1.50 et corrigées par la communauté. Signalez une erreur via le dépôt GitHub (Issues → Signaler une erreur d'unité).")}</p>
  </main>`;
  bindTopbar();
  bindImagesPanel();

  const form = document.getElementById('new-form');
  form.addEventListener('change', (e) => { if (e.target.name === 'bloc') S.ui.newBloc = e.target.value; });
  document.getElementById('new-name').addEventListener('input', (e) => { S.ui.newName = e.target.value; });
  document.getElementById('new-conf')?.addEventListener('change', (e) => {
    S.ui.newConf = e.target.checked;
    if (!S.ui.newConf && !S.official.blocsById.has(S.ui.newBloc)) S.ui.newBloc = 'Allies';
    renderHome();
  });
  form.querySelectorAll('[data-limit]').forEach((b) => b.addEventListener('click', () => {
    S.ui.newLimit = +b.dataset.limit;
    document.getElementById('new-limit').value = S.ui.newLimit;
    form.querySelectorAll('[data-limit]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  document.getElementById('new-limit').addEventListener('input', (e) => {
    S.ui.newLimit = +e.target.value || 100;
    form.querySelectorAll('[data-limit]').forEach((x) => x.classList.toggle('on', +x.dataset.limit === S.ui.newLimit));
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const bloc = form.querySelector('input[name=bloc]:checked')?.value || 'Allies';
    const limit = Math.max(1, +document.getElementById('new-limit').value || 100);
    const conf = !!S.ui.newConf && S.all !== S.official;
    const name = document.getElementById('new-name').value.trim() || `${blocName(bloc, conf ? S.all : S.official)} ${limit} pts`;
    const l = { id: uid() + uid(), name, bloc, limit, entries: [], platoons: [], created: Date.now(), updated: Date.now(), ...(conf ? { confidential: true } : {}) };
    S.lists.unshift(l); S.list = l; S.data = dataFor(l); saveLists();
    S.ui.newName = '';
    S.ui.catTab = 'units'; S.ui.faction = 'all'; S.ui.type = 'all'; S.ui.q = '';
    go('#/liste/' + l.id);
  });

  app.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => go('#/liste/' + b.dataset.open)));
  app.querySelectorAll('[data-dup]').forEach((b) => b.addEventListener('click', () => {
    const src = S.lists.find((l) => l.id === b.dataset.dup);
    const copy = { ...structuredClone(src), id: uid() + uid(), name: src.name + t(' (copie)'), updated: Date.now() };
    S.lists.unshift(copy); store.set(LS_KEY, S.lists); renderHome();
  }));
  app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('Confirmer'); setTimeout(() => { if (b.isConnected) { b.classList.remove('armed'); b.textContent = t('Supprimer'); } }, 3000); return; }
    const i = S.lists.findIndex((l) => l.id === b.dataset.del);
    const [removed] = S.lists.splice(i, 1);
    store.set(LS_KEY, S.lists); renderHome();
    toast(t('« {n} » supprimée', { n: removed.name }), { label: t('Annuler'), run: () => { S.lists.splice(i, 0, removed); store.set(LS_KEY, S.lists); renderHome(); } });
  }));
  document.getElementById('import-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = document.getElementById('import-code').value.trim();
    const code = v.includes('#l=') ? v.split('#l=')[1] : v;
    if (code) importFromCode(code);
  });
}

function savedRow(l) {
  const DL = dataFor(l);
  const b = DL.blocsById.get(l.bloc);
  const a = analyzeArmy(l, DL);
  const d = new Date(l.updated || l.created || Date.now());
  return `<div class="saved-row">
    <span class="swatch" style="--bc:${esc(b?.color || '#777')}"></span>
    <div><div class="name">${esc(l.name)}</div>
      <div class="meta">${l.confidential ? '<span class="conf-mini">CONFIDENTIAL</span> · ' : ''}${esc(blocName(l.bloc, DL))} · <span class="num">${a.counted}/${l.limit}</span> pts · ${t('{n} unités', { n: l.entries.length })} · ${d.toLocaleDateString(LANG === 'en' ? 'en-GB' : 'fr-FR')}
      ${a.ok ? '' : ` · <span style="color:var(--bad)">${t('à corriger')}</span>`}</div></div>
    <div class="acts">
      <button class="btn sm primary" data-open="${l.id}">${t('Ouvrir')}</button>
      <button class="btn sm" data-dup="${l.id}">${t('Dupliquer')}</button>
      <button class="btn sm danger" data-del="${l.id}">${t('Supprimer')}</button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- Partage
function encodeList(l) {
  const c = {
    v: 1, n: l.name, b: l.bloc, l: l.limit, ...(l.confidential ? { c: 1 } : {}),
    p: l.platoons.map((p) => [p.k, p.p]),
    e: l.entries.map((e) => [e.u, e.k, e.cap ? 1 : 0, e.join || '', e.pl || '', e.role || '', e.merc ? 1 : 0]),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(c));
  let bin = ''; bytes.forEach((x) => { bin += String.fromCharCode(x); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeList(code) {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  const c = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
  return {
    id: uid() + uid(), name: c.n, bloc: c.b, limit: c.l, created: Date.now(), updated: Date.now(), ...(c.c ? { confidential: true } : {}),
    platoons: (c.p || []).map(([k, p]) => ({ k, p })),
    entries: (c.e || []).map(([u, k, cap, join, pl, role, merc]) => ({ u, k, ...(cap ? { cap: 1 } : {}), ...(join ? { join } : {}), ...(pl ? { pl } : {}), ...(role ? { role } : {}), ...(merc ? { merc: 1 } : {}) })),
  };
}
function importFromCode(code) {
  let l;
  try { l = decodeList(decodeURIComponent(code)); } catch { toast(t('Ce lien de liste est invalide ou incomplet.')); history.replaceState(null, '', '#/'); return renderHome(); }
  S.lists.unshift(l); S.list = l; S.data = dataFor(l); saveLists();
  history.replaceState(null, '', '#/liste/' + l.id);
  toast(t('Liste « {n} » importée', { n: l.name }));
  renderBuilder();
}
function shareURL(l) {
  return location.href.split('#')[0] + '#l=' + encodeList(l);
}

// ---------------------------------------------------------------- Mutations
function commit(snapshot = true) {
  if (snapshot) S.undo = null;
  saveLists();
  renderBuilder();
}
function withUndo(label, fn) {
  const before = structuredClone(S.list);
  fn();
  saveLists();
  renderBuilder();
  toast(label, { label: t('Annuler'), run: () => { Object.assign(S.list, before); saveLists(); renderBuilder(); } });
}
function addEntry(unitId, extra = {}) {
  const e = { k: uid(), u: unitId, ...extra };
  S.list.entries.push(e);
  return e;
}
function removeEntry(k) {
  const L = S.list;
  L.entries = L.entries.filter((e) => e.k !== k);
  for (const e of L.entries) if (e.join === k) delete e.join;
}
function setSlot(plk, role, value) {
  const L = S.list;
  const pi = L.platoons.find((p) => p.k === plk);
  const P = S.data.platoonsById.get(pi.p);
  for (const e of L.entries.filter((e) => e.pl === plk && e.role === role)) removeEntry(e.k);
  if (value === '') return;
  if (value.startsWith('m:')) { addEntry(value.slice(2), { pl: plk, role, merc: 1 }); return; }
  const slots = role.startsWith('cmd') ? P.command : P.combat;
  const opt = slots[+role.replace(/\D/g, '')][+value];
  const added = opt.map((id) => addEntry(id, { pl: plk, role }));
  const hero = added.find((e) => S.data.unitsById.get(e.u)?.type === 'hero');
  const host = added.find((e) => S.data.unitsById.get(e.u)?.type !== 'hero');
  if (hero && host) hero.join = host.k;
}

// ---------------------------------------------------------------- Constructeur
function renderBuilder() {
  const D = S.data, L = S.list;
  const A = analyzeArmy(L, D);
  const bloc = D.blocsById.get(L.bloc);
  const over = A.counted > A.limit;
  const pct = (v) => Math.min(100, (v / Math.max(1, A.limit)) * 100);

  app.innerHTML = `${topbar('build')}
  <main class="wrap">
    <div class="army-head">
      <div class="army-title">
        <a class="btn sm ghost" href="#/">${t('← Listes')}</a>
        <input type="text" id="army-name" value="${esc(L.name)}" aria-label="${t("Nom de l'armée")}" maxlength="80">
        <span class="chip bloc" style="--bc:${esc(bloc?.color)}"><span class="swatch"></span>${esc(blocName(L.bloc, D))}</span>
        ${L.confidential ? `<span class="chip conf" title="${esc(t('Cette armée peut contenir des créations de la communauté, non officielles.'))}">CONFIDENTIAL</span>` : ''}
        <label class="chip">${t('Format')} <input type="number" id="army-limit" value="${L.limit}" min="1" max="2000" style="width:70px;padding:0 4px;border:0;background:transparent" aria-label="${t('Limite de points')}"> pts</label>
      </div>
    </div>
    <section class="summary" aria-label="${t("Résumé de l'armée")}">
      <div class="pts">${A.counted}<small> / ${A.limit} pts</small></div>
      <div class="sum-mid">
        <div class="gauge" title="${t('Points comptés')}">
          <i class="${over ? 'over' : ''}" style="width:${pct(A.counted)}%"></i>
        </div>
        <div class="sum-chips">
          <span class="chip ${A.kind === 'none' ? '' : 'ok'}">${esc(A.kindLabel)}</span>
          ${A.kind !== 'none' ? `<span class="chip">${t('Bonus héros')} <b class="num">${A.covered}/${A.pool}</b></span>` : ''}
          <span class="chip">${t('Total dépensé')} <b class="num">${A.total}</b></span>
          ${A.errors.length ? `<span class="chip bad">${t(A.errors.length > 1 ? '{n} erreurs' : '{n} erreur', { n: A.errors.length })}</span>` : `<span class="chip ok">${t('Liste valide')}</span>`}
          ${A.warnings.length ? `<span class="chip warn">${t(A.warnings.length > 1 ? '{n} avertissements' : '{n} avertissement', { n: A.warnings.length })}</span>` : ''}
        </div>
      </div>
      <div class="sum-acts">
        <button class="btn sm primary" id="btn-share">${t('Partager')}</button>
        <button class="btn sm" id="btn-text">${t('Texte')}</button>
        <button class="btn sm" id="btn-print">${t('Imprimer')}</button>
      </div>
    </section>
    <div class="mtabs">
      <button class="btn ${S.ui.mtab === 'catalog' ? 'on' : ''}" data-mtab="catalog">${t('Ajouter des unités')}</button>
      <button class="btn ${S.ui.mtab === 'list' ? 'on' : ''}" data-mtab="list">${t('Ma liste ({n})', { n: L.entries.length })}</button>
    </div>
    <div class="builder" data-tab="${S.ui.mtab}">
      <aside class="catalog" id="catalog">${catalogHTML()}</aside>
      <section class="roster" id="roster">${rosterHTML(A)}</section>
    </div>
    <div class="print-sheet" id="print-sheet"></div>
  </main>`;
  bindTopbar();
  bindBuilder(A);
}

// ------------------------------ Catalogue
function catalogUnits() {
  const D = S.data, L = S.list, U = S.ui;
  const tab = U.catTab;
  let pool;
  if (tab === 'captured') pool = D.units.filter((u) => u.type === 'vehicle' && u.capturable && u.bloc !== L.bloc && u.bloc !== MERC);
  else if (tab === 'merc') pool = D.units.filter((u) => u.bloc === MERC);
  else pool = D.units.filter((u) => u.bloc === L.bloc);
  if (U.type !== 'all' && tab !== 'captured') pool = pool.filter((u) => u.type === U.type);
  if (tab === 'units' && U.faction !== 'all') pool = pool.filter((u) => (U.faction === 'none' ? !u.faction : u.faction === U.faction));
  if (U.q) {
    const q = U.q.toLowerCase();
    pool = pool.filter((u) => (u.name + ' ' + u.subtitle + ' ' + (u.skills || []).join(' ')).toLowerCase().includes(q));
  }
  return pool;
}

function catalogHTML() {
  const D = S.data, L = S.list, U = S.ui;
  const bloc = D.blocsById.get(L.bloc);
  const tabs = [['units', t('Unités')], ...(L.bloc !== MERC ? [['merc', t('Mercenaires')]] : []), ['platoons', t('Pelotons')], ['captured', t('Capturés')]];
  let body = '';
  if (U.catTab === 'platoons') {
    const own = D.platoons.filter((p) => p.bloc === L.bloc);
    const merc = L.bloc !== MERC ? D.platoons.filter((p) => p.bloc === MERC) : [];
    const row = (p) => `<div class="prow">
        <div class="row"><b>${esc(p.name)}</b><button class="btn sm primary" data-addpl="${esc(p.id)}">${t('Ajouter')}</button></div>
        ${p.lore ? `<p><i>${esc(p.lore)}</i></p>` : ''}
        <p>${esc(p.advantage)}</p>
        <p class="num" style="font-size:12px">${t('{a} commandement · {b} combat requis', { a: p.command.length, b: p.combat.length })}</p>
      </div>`;
    body = `<div class="cat-list">${own.map(row).join('') || `<p class="empty">${t('Aucun peloton pour ce bloc.')}</p>`}
      ${merc.length ? `<div class="cat-group">${t('Pelotons mercenaires')}</div>${merc.map(row).join('')}` : ''}</div>`;
  } else {
    const units = catalogUnits();
    const groups = U.catTab === 'captured'
      ? D.blocs.filter((b) => units.some((u) => u.bloc === b.id)).map((b) => [blocName(b.id, D), units.filter((u) => u.bloc === b.id)])
      : TYPE_ORDER.map((ty) => [typeLabel(ty), units.filter((u) => u.type === ty)]).filter(([, a]) => a.length);
    const cap = U.catTab === 'captured';
    body = `
      ${!cap ? `<div class="typebar">${[['all', t('Tous')], ...TYPE_ORDER.map((ty) => [ty, typeLabel(ty)])].map(([k, l]) => `<button data-type="${k}" class="${U.type === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : `<p class="hint">${t('Un seul véhicule capturé par armée, coût +2 pts.')}</p>`}
      <div class="filters">
        <input type="search" id="cat-q" class="${U.catTab === 'units' && bloc?.factions.length ? '' : 'full'}" placeholder="${t('Rechercher (nom, compétence…)')}" value="${esc(U.q)}">
        ${U.catTab === 'units' && bloc?.factions.length ? `<select id="cat-fac" aria-label="${t('Filtrer par faction')}">
          <option value="all">${t('Toutes les factions')}</option><option value="none" ${U.faction === 'none' ? 'selected' : ''}>${t('Bloc (sans faction)')}</option>
          ${bloc.factions.map((f) => `<option value="${esc(f.id)}" ${U.faction === f.id ? 'selected' : ''}>${esc(f.name)}${f.confidential ? ' · CONFIDENTIAL' : ''}</option>`).join('')}
        </select>` : ''}
      </div>
      <div class="cat-list">
        ${groups.map(([g, arr]) => `<div class="cat-group">${esc(g)} · ${arr.length}</div>${arr.map((u) => unitRow(u, cap)).join('')}`).join('') || `<p class="empty">${t('Aucune unité ne correspond.')}</p>`}
      </div>`;
  }
  return `<div class="cat-tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-cattab="${k}" class="${U.catTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>${body}`;
}

function unitRow(u, captured) {
  const D = S.data;
  const cost = unitCost(u) + (captured ? CAPTURED_SURCHARGE : 0);
  const tags = [
    u.faction ? `<span class="tag fac">${esc(factionName(u.faction, D))}</span>` : '',
    u.bloc === MERC && S.list.bloc !== MERC ? `<span class="tag merc">${t('Mercenaire')}</span>` : '',
    captured ? `<span class="tag cap">${t('Capturé')}</span>` : '',
    u.confidential ? '<span class="tag conf">CONFIDENTIAL</span>' : '',
    u.armor ? `<span class="tag">${t('Arm. {n}', { n: esc(u.armor) })}</span>` : '',
  ].join('');
  return `<div class="urow">
    <div class="nm${hasImage(u.id) || communityPhotos(u.id).length ? ' wt' : ''}" data-card="${esc(u.id)}" data-cap="${captured ? 1 : ''}" tabindex="0" role="button" aria-label="${esc(t('Voir la carte {n}', { n: u.name }))}">
      ${thumb(u.id)}<b>${esc(u.name)}</b>${u.subtitle ? `<small>${esc(u.subtitle)}</small>` : ''}<div class="tags">${tags}</div>
    </div>
    <span class="cost">${cost}</span>
    <button class="btn icon primary" data-add="${esc(u.id)}" data-cap="${captured ? 1 : ''}" aria-label="${esc(t('Ajouter {n}', { n: u.name }))}">+</button>
  </div>`;
}

// ------------------------------ Liste
function rosterHTML(A) {
  const D = S.data, L = S.list;
  const issues = [
    ...A.errors.map((m) => `<div class="issue bad"><b>✕</b><span>${esc(m)}</span></div>`),
    ...A.warnings.map((m) => `<div class="issue warn"><b>!</b><span>${esc(m)}</span></div>`),
    ...(A.reason ? [`<div class="issue info"><b>i</b><span>${esc(A.reason)}</span></div>`] : []),
  ].join('');
  const joinedMap = new Map();
  for (const e of L.entries) if (e.join) { const a = joinedMap.get(e.join) || []; a.push(e); joinedMap.set(e.join, a); }
  const entryKeys = new Set(L.entries.map((e) => e.k));
  const isShownUnder = (e) => e.join && entryKeys.has(e.join);

  const renderWithJoined = (e) => entryRow(e) + (joinedMap.get(e.k) || []).map((h) => entryRow(h, true)).join('');

  const platoonBlocks = L.platoons.map((pi) => {
    const P = D.platoonsById.get(pi.p);
    const st = A.platoonStatus.find((s) => s.key === pi.k);
    if (!P) return `<div class="block"><div class="block-h"><h3>${t('Peloton introuvable')}</h3><button class="btn sm danger" data-rmpl="${pi.k}">${t('Retirer')}</button></div></div>`;
    const mine = L.entries.filter((e) => e.pl === pi.k);
    const sub = mine.reduce((s, e) => s + entryCost(e, D), 0);
    const slotRow = (role, label, options, idx) => {
      const inSlot = mine.filter((e) => e.role === role);
      const ids = inSlot.filter((e) => !e.merc).map((e) => e.u).sort().join('|');
      const mercE = inSlot.find((e) => e.merc);
      const selected = mercE ? 'm:' + mercE.u : options.findIndex((o) => [...o].sort().join('|') === ids);
      const optLabel = (o) => o.map((id) => D.unitsById.get(id)?.name || id).join(' + ') + ` (${o.reduce((s, id) => s + unitCost(D.unitsById.get(id) || {}), 0)})`;
      let mercOpts = '';
      if (role.startsWith('c') && !role.startsWith('cmd') && L.bloc !== MERC) {
        const types = new Set(options.flat().map((id) => D.unitsById.get(id)?.type).filter(Boolean));
        const minArmor = Math.min(...options.flat().map((id) => D.unitsById.get(id)?.armor || 99));
        const mercs = D.units.filter((u) => u.bloc === MERC && types.has(u.type) && (u.armor || 0) >= minArmor);
        if (mercs.length) mercOpts = `<optgroup label="${t('Remplacer par un mercenaire')}">${mercs.map((u) => `<option value="m:${esc(u.id)}" ${selected === 'm:' + u.id ? 'selected' : ''}>${esc(u.name)} (${esc(u.cost)})</option>`).join('')}</optgroup>`;
      }
      const shown = inSlot.filter((e) => !isShownUnder(e));
      return `<div class="slot">
        <div class="slot-l req ${inSlot.length ? 'done' : ''}">${label}</div>
        <div class="slot-body">
          <select data-slot="${pi.k}" data-role="${role}" aria-label="${esc(label)}">
            <option value="">${t('— Choisir —')}</option>
            ${options.map((o, i) => `<option value="${i}" ${selected === i ? 'selected' : ''}>${esc(optLabel(o))}</option>`).join('')}
            ${mercOpts}
          </select>
          ${shown.map(renderWithJoined).join('')}
        </div>
      </div>`;
    };
    const support = mine.filter((e) => e.role === 'sup' && !isShownUnder(e));
    return `<div class="block">
      <div class="block-h">
        <div><h3>${esc(P.name)}</h3><div class="sub">${esc(P.lore || '')}</div></div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <span class="chip ${st?.complete ? 'ok' : 'warn'}">${st?.complete ? t('Avantage actif') : t('Incomplet')}</span>
          <span class="chip"><b class="num">${sub}</b> pts</span>
          <button class="btn sm danger" data-rmpl="${pi.k}">${t('Retirer')}</button>
        </div>
      </div>
      <div class="block-b">
        <div class="adv ${st?.complete ? 'on' : ''}"><b>${t('Avantage :')}</b> ${esc(P.advantage)}</div>
        ${P.command.map((opts, i) => slotRow('cmd' + i, P.command.length > 1 ? t('Commandement {n}', { n: i + 1 }) : t('Commandement'), opts, i)).join('')}
        ${P.combat.map((opts, i) => slotRow('c' + i, t('Combat {n}', { n: i + 1 }), opts, i)).join('')}
        <div class="slot"><div class="slot-l">${t('Soutien')}</div><div class="slot-body">
          ${support.map(renderWithJoined).join('') || `<p class="hint" style="margin:6px 0 0">${t('Ajoutez une unité depuis le catalogue puis affectez-la à ce peloton avec son menu « Peloton ».')}</p>`}
        </div></div>
      </div>
    </div>`;
  }).join('');

  const loose = L.entries.filter((e) => !e.pl && !isShownUnder(e));
  const looseSorted = [...loose].sort((a, b) => TYPE_ORDER.indexOf(D.unitsById.get(a.u)?.type) - TYPE_ORDER.indexOf(D.unitsById.get(b.u)?.type));
  const looseSum = loose.reduce((s, e) => s + entryCost(e, D) + (joinedMap.get(e.k) || []).filter((h) => !h.pl).reduce((x, h) => x + entryCost(h, D), 0), 0);

  if (!L.entries.length && !L.platoons.length) {
    return `<div class="block"><div class="block-b">
      <p style="margin:0"><b>${t('Votre liste est vide.')}</b></p>
      <p class="hint" style="margin:0">${t("Ajoutez des unités avec le bouton <b>+</b> du catalogue, ou partez d'un peloton (onglet « Pelotons ») pour bénéficier de son avantage. Cliquez sur le nom d'une unité pour voir sa carte complète.")}</p>
    </div></div>`;
  }

  return `${issues ? `<div class="issues">${issues}</div>` : ''}
    ${platoonBlocks}
    <div class="block">
      <div class="block-h"><div><h3>${t('Unités indépendantes')}</h3><div class="sub">${t('Hors peloton')}</div></div><span class="chip"><b class="num">${looseSum}</b> pts</span></div>
      <div class="block-b">${looseSorted.map(renderWithJoined).join('') || `<p class="hint" style="margin:0">${t('Aucune unité hors peloton.')}</p>`}</div>
    </div>`;
}

function entryRow(e, joined = false) {
  const D = S.data, L = S.list;
  const u = D.unitsById.get(e.u);
  if (!u) return `<div class="erow"><div class="nm"><b>${t('Unité inconnue')}</b><small>${esc(e.u)}</small></div><span></span><div class="ctrl"><button class="btn icon danger" data-rm="${e.k}" aria-label="${t('Retirer')}">✕</button></div></div>`;
  const cost = entryCost(e, D);
  const tags = [
    u.faction ? `<span class="tag fac">${esc(factionName(u.faction, D))}</span>` : '',
    u.bloc === MERC && L.bloc !== MERC ? `<span class="tag merc">${t('Mercenaire')}</span>` : '',
    e.cap ? `<span class="tag cap">${t('Capturé')}</span>` : '',
    u.confidential ? '<span class="tag conf">CONFIDENTIAL</span>' : '',
  ].join('');
  let ctrls = '';
  // Rattachement d'un héros
  if (isJoiner(u)) {
    const targets = L.entries.filter((x) => x.k !== e.k).map((x) => ({ x, t: D.unitsById.get(x.u) })).filter(({ t: tu }) => tu && (
      ((tu.type === 'infantry' || (tu.type === 'hero' && isCommissar(u))) && tu.armor === u.armor) || ((tu.type === 'vehicle' || tu.type === 'aircraft') && canPilot(u, tu))));
    ctrls += `<select data-join="${e.k}" aria-label="${esc(t('Rattacher {n}', { n: u.name }))}">
      <option value="">${t('Seul')}</option>
      ${targets.map(({ x, t: tu }) => `<option value="${x.k}" ${e.join === x.k ? 'selected' : ''}>${tu.type === 'vehicle' || tu.type === 'aircraft' ? t('Pilote') : t('Rejoint')} : ${esc(tu.name)}</option>`).join('')}
    </select>`;
  }
  // Affectation à un peloton (unités hors poste requis)
  if (!e.role || e.role === 'sup') {
    if (L.platoons.length) {
      ctrls += `<select data-assign="${e.k}" aria-label="${t('Peloton')}">
        <option value="">${t('Indépendant')}</option>
        ${L.platoons.map((p) => `<option value="${p.k}" ${e.pl === p.k ? 'selected' : ''}>${t('Soutien :')} ${esc(D.platoonsById.get(p.p)?.name || '?')}</option>`).join('')}
      </select>`;
    }
    ctrls += `<button class="btn icon" data-clone="${e.k}" title="${t('Ajouter un exemplaire')}" aria-label="${t('Dupliquer')}">⧉</button>`;
    ctrls += `<button class="btn icon danger" data-rm="${e.k}" aria-label="${esc(t('Retirer {n}', { n: u.name }))}">✕</button>`;
  }
  return `<div class="erow ${joined ? 'joined' : ''}">
    <div class="nm${hasImage(u.id) || communityPhotos(u.id).length ? ' wt' : ''}" data-card="${esc(u.id)}" data-cap="${e.cap ? 1 : ''}" tabindex="0" role="button">
      ${thumb(u.id)}<b>${joined ? '↳ ' : ''}${esc(u.name)}</b><small>${esc(typeLabel(u.type))}${u.armor ? ' · ' + t('Armure') + ' ' + esc(u.armor) : ''}</small>${tags ? `<div class="tags">${tags}</div>` : ''}
    </div>
    <span class="cost">${cost}</span>
    <div class="ctrl">${ctrls}</div>
  </div>`;
}

// ------------------------------ Événements
function bindBuilder(A) {
  const D = S.data, L = S.list, U = S.ui;
  const $ = (id) => document.getElementById(id);

  $('army-name').addEventListener('change', (e) => { L.name = e.target.value.trim() || L.name; saveLists(); });
  $('army-limit').addEventListener('change', (e) => { L.limit = Math.max(1, +e.target.value || L.limit); commit(); });

  app.querySelectorAll('[data-mtab]').forEach((b) => b.addEventListener('click', () => { U.mtab = b.dataset.mtab; renderBuilder(); }));

  const cat = $('catalog');
  const rerenderCatalog = () => { cat.innerHTML = catalogHTML(); bindCatalog(); };
  function bindCatalog() {
    cat.querySelectorAll('[data-cattab]').forEach((b) => b.addEventListener('click', () => { U.catTab = b.dataset.cattab; rerenderCatalog(); }));
    cat.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => { U.type = b.dataset.type; rerenderCatalog(); }));
    const q = $('cat-q');
    q?.addEventListener('input', () => {
      U.q = q.value;
      const pos = q.selectionStart;
      rerenderCatalog();
      const q2 = $('cat-q'); q2.focus(); q2.setSelectionRange(pos, pos);
    });
    $('cat-fac')?.addEventListener('change', (e) => { U.faction = e.target.value; rerenderCatalog(); });
    cat.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
      const u = D.unitsById.get(b.dataset.add);
      addEntry(u.id, b.dataset.cap ? { cap: 1 } : {});
      commit();
      toast(t(b.dataset.cap ? '{n} ajouté (capturé)' : '{n} ajouté', { n: u.name }));
    }));
    cat.querySelectorAll('[data-addpl]').forEach((b) => b.addEventListener('click', () => {
      const P = D.platoonsById.get(b.dataset.addpl);
      L.platoons.push({ k: uid(), p: P.id });
      commit();
      toast(t('{n} ajouté : choisissez ses unités dans la liste', { n: P.name }));
    }));
    bindCards(cat);
  }
  bindCatalog();

  const ros = $('roster');
  bindCards(ros);
  ros.querySelectorAll('[data-slot]').forEach((s) => s.addEventListener('change', () => { setSlot(s.dataset.slot, s.dataset.role, s.value); commit(); }));
  ros.querySelectorAll('[data-join]').forEach((s) => s.addEventListener('change', () => {
    const e = L.entries.find((x) => x.k === s.dataset.join);
    if (s.value) e.join = s.value; else delete e.join;
    commit();
  }));
  ros.querySelectorAll('[data-assign]').forEach((s) => s.addEventListener('change', () => {
    const e = L.entries.find((x) => x.k === s.dataset.assign);
    if (s.value) { e.pl = s.value; e.role = 'sup'; } else { delete e.pl; delete e.role; }
    commit();
  }));
  ros.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
    const u = D.unitsById.get(L.entries.find((x) => x.k === b.dataset.rm)?.u);
    withUndo(t('{n} retiré', { n: u?.name || t('Unité') }), () => removeEntry(b.dataset.rm));
  }));
  ros.querySelectorAll('[data-clone]').forEach((b) => b.addEventListener('click', () => {
    const e = L.entries.find((x) => x.k === b.dataset.clone);
    const c = { ...e, k: uid() }; delete c.join;
    if (c.role && c.role !== 'sup') { delete c.role; delete c.pl; }
    L.entries.push(c); commit();
  }));
  ros.querySelectorAll('[data-rmpl]').forEach((b) => b.addEventListener('click', () => {
    const pi = L.platoons.find((p) => p.k === b.dataset.rmpl);
    const name = D.platoonsById.get(pi?.p)?.name || t('Peloton');
    withUndo(t('{n} retiré', { n: name }), () => {
      for (const e of L.entries.filter((e) => e.pl === pi.k && e.role !== 'sup')) removeEntry(e.k);
      for (const e of L.entries.filter((e) => e.pl === pi.k)) { delete e.pl; delete e.role; }
      L.platoons = L.platoons.filter((p) => p.k !== pi.k);
    });
  }));

  $('btn-share').addEventListener('click', () => openShare());
  $('btn-text').addEventListener('click', () => openText(A));
  $('btn-print').addEventListener('click', () => {
    $('print-sheet').innerHTML = printHTML(A);
    window.print();
  });
}

function bindCards(root) {
  root.querySelectorAll('[data-card]').forEach((el) => {
    const open = () => {
      const u = S.data.unitsById.get(el.dataset.card);
      const cap = !!el.dataset.cap;
      openUnitCard(u, cap);
    };
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

// ------------------------------ Export
function listText(A) {
  const D = S.data, L = S.list;
  const line = (e, ind = '  ') => {
    const u = D.unitsById.get(e.u);
    if (!u) return '';
    const bits = [];
    if (e.cap) bits.push(t('capturé'));
    if (e.merc) bits.push(t('mercenaire'));
    if (u.confidential) bits.push('CONFIDENTIAL');
    if (e.join) { const tu = D.unitsById.get(L.entries.find((x) => x.k === e.join)?.u); if (tu) bits.push((tu.type === 'vehicle' || tu.type === 'aircraft' ? t('pilote') : t('rejoint')) + ' ' + tu.name); }
    return `${ind}- ${u.name} (${entryCost(e, D)})${bits.length ? ' [' + bits.join(', ') + ']' : ''}`;
  };
  const out = [`${L.name}`, ...(L.confidential ? [t('CONFIDENTIAL : contient des créations de la communauté, non officielles')] : []), `${blocName(L.bloc, D)} · ${A.counted}/${L.limit} pts${A.covered ? t(' (+{n} pts de héros en bonus)', { n: A.covered }) : ''} · ${A.kindLabel}`, ''];
  for (const pi of L.platoons) {
    const P = D.platoonsById.get(pi.p);
    const st = A.platoonStatus.find((s) => s.key === pi.k);
    out.push(`${P?.name || t('Peloton')}${st?.complete ? '' : t(' (incomplet)')}`);
    for (const e of L.entries.filter((e) => e.pl === pi.k)) out.push(line(e));
    out.push('');
  }
  const loose = L.entries.filter((e) => !e.pl);
  if (loose.length) { out.push(t('Unités indépendantes')); for (const e of loose) out.push(line(e)); out.push(''); }
  if (A.errors.length) { out.push(t('À corriger :')); for (const m of A.errors) out.push('  ! ' + m); }
  out.push(t('Total dépensé : {n} pts', { n: A.total }));
  return out.join('\n');
}

function openText(A) {
  const txt = listText(A);
  openModal(`<div class="modal-h"><div><div class="eyebrow">${t('Export')}</div><h2>${t('Liste en texte')}</h2></div><button class="btn icon" data-close-btn aria-label="${t('Fermer')}">✕</button></div>
    <div class="modal-b"><textarea class="export-box" id="exp-txt" readonly>${esc(txt)}</textarea>
    <div><button class="btn primary" id="copy-txt">${t('Copier le texte')}</button></div></div>`, (root) => {
    root.querySelector('#copy-txt').addEventListener('click', () => copyText(txt, root.querySelector('#exp-txt')));
  });
}

function openShare() {
  const url = shareURL(S.list);
  openModal(`<div class="modal-h"><div><div class="eyebrow">${t('Partager')}</div><h2>${t('Lien de la liste')}</h2><p>${t('Toute personne qui ouvre ce lien reçoit une copie de votre liste, modifiable de son côté.')}</p></div><button class="btn icon" data-close-btn aria-label="${t('Fermer')}">✕</button></div>
    <div class="modal-b"><textarea class="export-box share-url" id="share-url" readonly style="min-height:110px">${esc(url)}</textarea>
    <div><button class="btn primary" id="copy-url">${t('Copier le lien')}</button></div></div>`, (root) => {
    root.querySelector('#copy-url').addEventListener('click', () => copyText(url, root.querySelector('#share-url')));
  });
}

function printHTML(A) {
  const D = S.data, L = S.list;
  const card = (e) => {
    const u = D.unitsById.get(e.u);
    if (!u) return '';
    const ws = u.weapons || [];
    return `<div class="pu"><b>${esc(u.name)}</b> — ${entryCost(e, D)} pts · ${t('Arm')} ${esc(u.armor ?? '-')} · ${t('Santé')} ${esc(u.health ?? '-')} · ${t('Mv')} ${esc(u.move ?? '-')}/${esc(u.march ?? '-')}${e.cap ? ' · ' + t('capturé') : ''}${u.confidential ? ' · <b>CONFIDENTIAL</b>' : ''}
      ${(u.skills || []).length ? `<div><i>${u.skills.map(esc).join(', ')}</i></div>` : ''}
      ${ws.length ? `<table><tr><th>${t('Arme')}</th><th>${t('Nb')}</th><th>${t('Portée')}</th><th>${t('Inf 1-4')}</th><th>${t('Véh 1-7')}</th><th>${t('Aéro')}</th></tr>
      ${ws.map((w) => `<tr><td class="wn">${esc(w.name)}${(w.specials || []).length ? ' (' + w.specials.map(esc).join(', ') + ')' : ''}</td><td>${esc(w.count ?? '')}</td><td>${esc(w.range ?? '')}</td><td>${(w.vsInfantry || []).map(esc).join(' ')}</td><td>${(w.vsVehicle || []).map(esc).join(' ')}</td><td>${(w.vsAircraft || []).map(esc).join(' ')}</td></tr>`).join('')}</table>` : ''}
    </div>`;
  };
  return `<h1>${esc(L.name)}</h1>${L.confidential ? `<p><b>${esc(t('CONFIDENTIAL : contient des créations de la communauté, non officielles'))}</b></p>` : ''}<p>${esc(blocName(L.bloc, D))} · ${A.counted}/${L.limit} pts · ${esc(A.kindLabel)}</p>
    ${L.platoons.map((pi) => { const P = D.platoonsById.get(pi.p); return `<h3>${esc(P?.name || '')}</h3><p><i>${esc(P?.advantage || '')}</i></p>${L.entries.filter((e) => e.pl === pi.k).map(card).join('')}`; }).join('')}
    ${L.entries.some((e) => !e.pl) ? `<h3>${t('Unités indépendantes')}</h3>${L.entries.filter((e) => !e.pl).map(card).join('')}` : ''}`;
}

// ---------------------------------------------------------------- Images de cartes (locales)
const communityPhotos = (id) => S.data.photos?.[id] || [];
function thumb(id) {
  const src = imageURL(id, 'front') || imageURL(id, 'back') || communityPhotos(id)[0]?.file;
  return src ? `<img class="thumb" src="${src}" alt="" loading="lazy">` : '';
}

function refreshView() {
  if (S.list) renderBuilder(); else renderHome();
}

function imagesSectionHTML(u) {
  if (!imagesAvailable()) return `<p class="hint" style="margin:0">${t('Images de cartes indisponibles dans ce navigateur (navigation privée ?).')}</p>`;
  const slot = (side) => {
    const src = imageURL(u.id, side);
    return `<div class="img-slot">
      <div class="eyebrow">${t(SIDES[side])}</div>
      ${src ? `<button class="img-view" data-zoom="${side}" aria-label="${t('Agrandir le {s}', { s: t(SIDES[side]).toLowerCase() })}"><img src="${src}" alt="${esc(t('{s} de la carte {n}', { s: t(SIDES[side]), n: u.name }))}"></button>`
        : `<div class="img-empty">${t('Aucune image')}</div>`}
      <div class="img-acts">
        <label class="btn sm">${src ? t('Remplacer') : t('Ajouter')}<input type="file" accept="image/*" data-up="${side}" hidden></label>
        ${src ? `<button class="btn sm danger" data-delimg="${side}">${t('Retirer')}</button>` : ''}
      </div>
    </div>`;
  };
  return `<details class="img-box" ${hasImage(u.id) ? 'open' : ''}>
    <summary>${t('Ma carte')} ${hasImage(u.id) ? '' : `<span class="hint">${t('(ajouter une photo ou un scan)')}</span>`}</summary>
    <div class="img-grid">${slot('front')}${slot('back')}</div>
    <p class="hint" style="margin:0">${t("Image gardée uniquement dans ce navigateur, pour votre usage personnel. Elle n'est ni envoyée ni partagée.")}</p>
  </details>`;
}

function communitySectionHTML(u) {
  const ph = communityPhotos(u.id);
  const repo = guessRepo();
  const propose = repo.owner
    ? `https://github.com/${repo.owner}/${repo.repo}/issues/new?template=photo.yml&title=${encodeURIComponent('Photo : ' + u.name)}&unit=${encodeURIComponent(u.name + ' (' + u.id + ')')}`
    : null;
  if (!ph.length && !propose) return '';
  return `<div class="community">
    ${ph.length ? `<div class="eyebrow">${t('Photos de la communauté')}</div>
    <div class="ph-grid">${ph.map((p) => `<figure><button class="img-view" data-zoomc aria-label="${t('Agrandir')}"><img src="${esc(p.file)}" alt="${esc(t('Figurine {n} peinte par {a}', { n: u.name, a: p.author }))}" loading="lazy"></button>
      <figcaption>${t('Photo :')} ${esc(p.author)}${p.license ? ' · ' + esc(p.license) : ''}</figcaption></figure>`).join('')}</div>` : ''}
    ${propose ? `<p class="hint" style="margin:0">${t('Vous avez peint cette unité ?')} <a href="${propose}" target="_blank" rel="noopener">${t('Proposez une photo de votre figurine')}</a>.</p>` : ''}
  </div>`;
}

function openUnitCard(u, cap) {
  openModal(unitCardHTML(u, S.data, { cost: unitCost(u) + (cap ? CAPTURED_SURCHARGE : 0), captured: cap, topHTML: communitySectionHTML(u) + imagesSectionHTML(u) }), (root, close) => {
    root.querySelectorAll('[data-zoomc]').forEach((b) => b.addEventListener('click', () => b.classList.toggle('zoomed')));
    root.querySelectorAll('[data-up]').forEach((inp) => inp.addEventListener('change', async () => {
      const f = inp.files[0];
      if (!f) return;
      try { await saveImage(u.id, inp.dataset.up, f); toast(t('Image enregistrée')); close(); refreshView(); openUnitCard(u, cap); }
      catch (e) { toast(e.message); }
    }));
    root.querySelectorAll('[data-delimg]').forEach((b) => b.addEventListener('click', async () => {
      await deleteImage(u.id, b.dataset.delimg); close(); refreshView(); openUnitCard(u, cap);
    }));
    root.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => b.classList.toggle('zoomed')));
  });
}

function imagesPanelHTML() {
  const n = imageCount();
  return `<section class="panel" style="margin-top:24px">
    <h2>${t('Mes images de cartes ({n})', { n })}</h2>
    ${imagesAvailable() ? `
    <p class="hint" style="margin:0 0 12px;max-width:75ch">${t("Ajoutez vos propres scans ou photos de cartes : ils s'affichent sur les fiches d'unités. Ils restent dans ce navigateur et ne sont jamais envoyés ni partagés. Nommez les fichiers comme l'unité (<code>Pounder.jpg</code>, <code>Bazooka Joe - verso.jpg</code>) pour les associer automatiquement ; vous pourrez corriger avant d'enregistrer.")}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <label class="btn primary">${t('Importer des images')}<input type="file" id="bulk-img" accept="image/*" multiple hidden></label>
      ${n ? `<button class="btn danger" id="clear-img">${t('Tout supprimer')}</button>` : ''}
      <span class="hint" id="img-space"></span>
    </div>` : `<p class="hint" style="margin:0">${t('Ce navigateur ne permet pas de garder des images (navigation privée ou stockage bloqué).')}</p>`}
  </section>`;
}

function bindImagesPanel() {
  const inp = document.getElementById('bulk-img');
  if (!inp) return;
  storageEstimate().then((est) => {
    const el = document.getElementById('img-space');
    if (est && el && imageCount()) el.textContent = t('Espace utilisé par le site : {n} Mo', { n: (est.usage / 1048576).toFixed(1) });
  });
  inp.addEventListener('change', () => { if (inp.files.length) openBulkImport([...inp.files]); inp.value = ''; });
  document.getElementById('clear-img')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget;
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('Confirmer : supprimer {n} images', { n: imageCount() }); return; }
    await clearImages(); renderHome(); toast(t('Images supprimées'));
  });
}

function openBulkImport(files) {
  const D = S.all;
  const rows = matchFiles(files, D.units);
  const label = (u) => `${u.name} — ${blocName(u.bloc, D)}`;
  const byLabel = new Map(D.units.map((u) => [label(u), u]));
  const matched = rows.filter((r) => r.units.length).length;
  openModal(`<div class="modal-h"><div><div class="eyebrow">${t('Import')}</div><h2>${t('Associer les images')}</h2>
      <p>${t('{m} fichier(s) sur {n} reconnus automatiquement. Complétez ou corrigez puis enregistrez.', { m: matched, n: rows.length })}</p></div>
      <button class="btn icon" data-close-btn aria-label="${t('Fermer')}">✕</button></div>
    <div class="modal-b">
      <datalist id="unit-dl">${D.units.map((u) => `<option value="${esc(label(u))}">`).join('')}</datalist>
      <div class="bulk-list">
        ${rows.map((r, i) => `<div class="bulk-row">
          <img src="${URL.createObjectURL(r.file)}" alt="">
          <div class="bulk-main">
            <div class="bulk-file">${esc(r.file.name)}</div>
            <input type="text" list="unit-dl" id="bulk-u-${i}" placeholder="${t("Choisir l'unité…")}" value="${esc(r.units[0] ? label(r.units[0]) : '')}" aria-label="${esc(t('Unité pour {f}', { f: r.file.name }))}">
            ${r.units.length > 1 ? `<label class="check"><input type="checkbox" id="bulk-all-${i}" checked> ${t('Appliquer aussi aux {n} autre(s) version(s) :', { n: r.units.length - 1 })} ${r.units.slice(1).map((u) => esc(label(u))).join(', ')}</label>` : ''}
          </div>
          <select id="bulk-s-${i}" aria-label="${t('Face')}">${Object.entries(SIDES).map(([k, v]) => `<option value="${k}" ${r.side === k ? 'selected' : ''}>${t(v)}</option>`).join('')}</select>
        </div>`).join('')}
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn primary" id="bulk-save">${t('Enregistrer')}</button><span class="hint" id="bulk-status"></span></div>
    </div>`, (root, close) => {
    root.querySelector('#bulk-save').addEventListener('click', async (ev) => {
      ev.currentTarget.disabled = true;
      const status = root.querySelector('#bulk-status');
      let ok = 0, skipped = 0;
      for (const [i, r] of rows.entries()) {
        const u = byLabel.get(root.querySelector(`#bulk-u-${i}`).value.trim());
        if (!u) { skipped++; continue; }
        const side = root.querySelector(`#bulk-s-${i}`).value;
        const targets = [u, ...(root.querySelector(`#bulk-all-${i}`)?.checked && r.units[0]?.id === u.id ? r.units.slice(1) : [])];
        status.textContent = t('Enregistrement {i}/{n}…', { i: i + 1, n: rows.length });
        try { for (const t of targets) await saveImage(t.id, side, r.file, { silent: true }); ok++; }
        catch (e) { skipped++; toast(e.message); }
      }
      close(); refreshView();
      toast(t('{n} image(s) enregistrée(s)', { n: ok }) + (skipped ? t(', {n} ignorée(s) sans unité', { n: skipped }) : ''));
    });
  });
}
