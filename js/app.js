// DUST 1947 Army Builder — application principale
import { loadData, TYPE_LABELS, MERC, unitCost, canPilot } from './data.js';
import { analyzeArmy, entryCost, blocName, factionName, CAPTURED_SURCHARGE, isJoiner, isCommissar } from './rules.js';
import { esc, uid, store, toast, copyText, openModal, unitCardHTML, guessRepo } from './ui.js';
import { initImages, imagesAvailable, imageURL, hasImage, imageCount, saveImage, deleteImage, clearImages, matchFiles, storageEstimate, SIDES } from './images.js';

const LS_KEY = 'dust1947.lists';
const LIMITS = [25, 50, 100, 150, 200];
const TYPE_ORDER = ['hero', 'infantry', 'vehicle', 'aircraft', 'token'];

const S = {
  data: null,
  lists: [],
  list: null,
  undo: null,
  ui: { catTab: 'units', type: 'all', faction: 'all', q: '', mtab: 'catalog', newBloc: 'Allies', newLimit: 100 },
};

const app = document.getElementById('app');

// ---------------------------------------------------------------- Démarrage
init();
async function init() {
  try {
    S.data = await loadData();
  } catch (e) {
    app.innerHTML = `<div class="wrap"><div class="issue bad"><b>!</b><span>Impossible de charger la base : ${esc(e.message)}. Si vous ouvrez le fichier directement depuis votre disque, utilisez plutôt un petit serveur local (voir README).</span></div></div>`;
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
  if (!store.set(LS_KEY, S.lists)) toast('Sauvegarde locale indisponible (navigation privée ?) : utilisez « Partager » pour garder votre liste.');
}

function route() {
  const h = location.hash;
  if (h.startsWith('#l=')) return importFromCode(h.slice(3));
  const m = h.match(/^#\/liste\/([\w-]+)/);
  if (m) {
    const l = S.lists.find((x) => x.id === m[1]);
    if (l) { S.list = l; return renderBuilder(); }
  }
  S.list = null;
  renderHome();
}

function go(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}

function topbar(active) {
  return `<header class="topbar">
    <a class="brand" href="#/"><b>DUST 194∞</b><small>Builder</small></a>
    <nav class="topnav">
      <a href="#/" class="${active === 'home' ? 'on' : ''}">Mes listes</a>
      <a href="shot.html">Shot Format</a>
      <button id="theme-btn" title="Changer de thème">Thème</button>
    </nav>
  </header>`;
}

function bindTopbar() {
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
  const D = S.data;
  const blocs = D.blocs;
  const lists = [...S.lists].sort((a, b) => (b.updated || 0) - (a.updated || 0));
  app.innerHTML = `${topbar('home')}
  <main class="wrap home">
    <section class="home-hero">
      <div class="eyebrow">Outil communautaire · base ${esc(D.meta.version || '')}</div>
      <h1 class="h-display">Levez votre armée</h1>
      <p>Choisissez un bloc et un format, puis composez vos pelotons. Les points, le bonus de faction, les héros et les véhicules capturés sont vérifiés en direct. ${D.units.length} unités et ${D.platoons.length} pelotons disponibles.</p>
    </section>
    <div class="home-grid">
      <section class="panel">
        <h2>Nouvelle armée</h2>
        <form class="new-army" id="new-form">
          <label class="field"><span>Nom</span><input type="text" id="new-name" placeholder="Ex. Rangers de Kasserine" maxlength="80"></label>
          <div class="field"><span>Bloc</span>
            <div class="bloc-pick">
              ${blocs.map((b) => `<label style="--bc:${esc(b.color)}"><input type="radio" name="bloc" value="${esc(b.id)}" ${b.id === S.ui.newBloc ? 'checked' : ''}>
                <b><span class="swatch"></span> ${esc(b.name)}</b><small>${D.units.filter((u) => u.bloc === b.id).length} unités</small></label>`).join('')}
            </div>
          </div>
          <div class="field"><span>Format (points d'armée)</span>
            <div class="limits">
              ${LIMITS.map((l) => `<button type="button" class="btn sm ${l === S.ui.newLimit ? 'on' : ''}" data-limit="${l}">${l}</button>`).join('')}
              <input type="number" id="new-limit" min="1" max="2000" value="${S.ui.newLimit}" aria-label="Points personnalisés">
            </div>
          </div>
          <button class="btn primary" type="submit">Créer l'armée</button>
        </form>
      </section>
      <section class="panel">
        <h2>Mes listes (${lists.length})</h2>
        <div class="saved">
          ${lists.length ? lists.map((l) => savedRow(l)).join('') : '<p class="empty">Aucune liste enregistrée sur cet appareil. Les listes sont gardées dans votre navigateur ; utilisez « Partager » pour les envoyer ou les retrouver ailleurs.</p>'}
        </div>
        <form id="import-form" style="display:grid;gap:6px;margin-top:16px">
          <label class="field"><span>Importer un lien de partage</span><input type="text" id="import-code" placeholder="Collez un lien ou un code de liste"></label>
          <div><button class="btn sm" type="submit">Importer</button></div>
        </form>
      </section>
    </div>
    ${imagesPanelHTML()}
    <p class="foot">Outil de fan non officiel. DUST, DUST 1947 et les données de jeu appartiennent à leurs ayants droit. Les photos de la communauté appartiennent à leurs auteurs (CC BY 4.0). Données reprises de l'application DUST ENLIST 1.50 et corrigées par la communauté. Signalez une erreur via le dépôt GitHub (Issues → Signaler une erreur d'unité).</p>
  </main>`;
  bindTopbar();
  bindImagesPanel();

  const form = document.getElementById('new-form');
  form.addEventListener('change', (e) => { if (e.target.name === 'bloc') S.ui.newBloc = e.target.value; });
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
    const name = document.getElementById('new-name').value.trim() || `${blocName(bloc, S.data)} ${limit} pts`;
    const l = { id: uid() + uid(), name, bloc, limit, entries: [], platoons: [], created: Date.now(), updated: Date.now() };
    S.lists.unshift(l); S.list = l; saveLists();
    S.ui.catTab = 'units'; S.ui.faction = 'all'; S.ui.type = 'all'; S.ui.q = '';
    go('#/liste/' + l.id);
  });

  app.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => go('#/liste/' + b.dataset.open)));
  app.querySelectorAll('[data-dup]').forEach((b) => b.addEventListener('click', () => {
    const src = S.lists.find((l) => l.id === b.dataset.dup);
    const copy = { ...structuredClone(src), id: uid() + uid(), name: src.name + ' (copie)', updated: Date.now() };
    S.lists.unshift(copy); store.set(LS_KEY, S.lists); renderHome();
  }));
  app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Confirmer'; setTimeout(() => { if (b.isConnected) { b.classList.remove('armed'); b.textContent = 'Supprimer'; } }, 3000); return; }
    const i = S.lists.findIndex((l) => l.id === b.dataset.del);
    const [removed] = S.lists.splice(i, 1);
    store.set(LS_KEY, S.lists); renderHome();
    toast(`« ${removed.name} » supprimée`, { label: 'Annuler', run: () => { S.lists.splice(i, 0, removed); store.set(LS_KEY, S.lists); renderHome(); } });
  }));
  document.getElementById('import-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = document.getElementById('import-code').value.trim();
    const code = v.includes('#l=') ? v.split('#l=')[1] : v;
    if (code) importFromCode(code);
  });
}

function savedRow(l) {
  const b = S.data.blocsById.get(l.bloc);
  const a = analyzeArmy(l, S.data);
  const d = new Date(l.updated || l.created || Date.now());
  return `<div class="saved-row">
    <span class="swatch" style="--bc:${esc(b?.color || '#777')}"></span>
    <div><div class="name">${esc(l.name)}</div>
      <div class="meta">${esc(b?.name || l.bloc)} · <span class="num">${a.counted}/${l.limit}</span> pts · ${l.entries.length} unités · ${d.toLocaleDateString('fr-FR')}
      ${a.ok ? '' : ' · <span style="color:var(--bad)">à corriger</span>'}</div></div>
    <div class="acts">
      <button class="btn sm primary" data-open="${l.id}">Ouvrir</button>
      <button class="btn sm" data-dup="${l.id}">Dupliquer</button>
      <button class="btn sm danger" data-del="${l.id}">Supprimer</button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- Partage
function encodeList(l) {
  const c = {
    v: 1, n: l.name, b: l.bloc, l: l.limit,
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
    id: uid() + uid(), name: c.n, bloc: c.b, limit: c.l, created: Date.now(), updated: Date.now(),
    platoons: (c.p || []).map(([k, p]) => ({ k, p })),
    entries: (c.e || []).map(([u, k, cap, join, pl, role, merc]) => ({ u, k, ...(cap ? { cap: 1 } : {}), ...(join ? { join } : {}), ...(pl ? { pl } : {}), ...(role ? { role } : {}), ...(merc ? { merc: 1 } : {}) })),
  };
}
function importFromCode(code) {
  let l;
  try { l = decodeList(decodeURIComponent(code)); } catch { toast('Ce lien de liste est invalide ou incomplet.'); history.replaceState(null, '', '#/'); return renderHome(); }
  S.lists.unshift(l); S.list = l; saveLists();
  history.replaceState(null, '', '#/liste/' + l.id);
  toast(`Liste « ${l.name} » importée`);
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
  toast(label, { label: 'Annuler', run: () => { Object.assign(S.list, before); saveLists(); renderBuilder(); } });
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
        <a class="btn sm ghost" href="#/">← Listes</a>
        <input type="text" id="army-name" value="${esc(L.name)}" aria-label="Nom de l'armée" maxlength="80">
        <span class="chip bloc" style="--bc:${esc(bloc?.color)}"><span class="swatch"></span>${esc(bloc?.name || L.bloc)}</span>
        <label class="chip">Format <input type="number" id="army-limit" value="${L.limit}" min="1" max="2000" style="width:70px;padding:0 4px;border:0;background:transparent" aria-label="Limite de points"> pts</label>
      </div>
    </div>
    <section class="summary" aria-label="Résumé de l'armée">
      <div class="pts">${A.counted}<small> / ${A.limit} pts</small></div>
      <div class="sum-mid">
        <div class="gauge" title="Points comptés">
          <i class="${over ? 'over' : ''}" style="width:${pct(A.counted)}%"></i>
        </div>
        <div class="sum-chips">
          <span class="chip ${A.kind === 'none' ? '' : 'ok'}">${esc(A.kindLabel)}</span>
          ${A.kind !== 'none' ? `<span class="chip">Bonus héros <b class="num">${A.covered}/${A.pool}</b></span>` : ''}
          <span class="chip">Total dépensé <b class="num">${A.total}</b></span>
          ${A.errors.length ? `<span class="chip bad">${A.errors.length} erreur${A.errors.length > 1 ? 's' : ''}</span>` : '<span class="chip ok">Liste valide</span>'}
          ${A.warnings.length ? `<span class="chip warn">${A.warnings.length} avertissement${A.warnings.length > 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>
      <div class="sum-acts">
        <button class="btn sm primary" id="btn-share">Partager</button>
        <button class="btn sm" id="btn-text">Texte</button>
        <button class="btn sm" id="btn-print">Imprimer</button>
      </div>
    </section>
    <div class="mtabs">
      <button class="btn ${S.ui.mtab === 'catalog' ? 'on' : ''}" data-mtab="catalog">Ajouter des unités</button>
      <button class="btn ${S.ui.mtab === 'list' ? 'on' : ''}" data-mtab="list">Ma liste (${L.entries.length})</button>
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
  const tabs = [['units', 'Unités'], ...(L.bloc !== MERC ? [['merc', 'Mercenaires']] : []), ['platoons', 'Pelotons'], ...(L.bloc !== MERC ? [['captured', 'Capturés']] : [['captured', 'Capturés']])];
  let body = '';
  if (U.catTab === 'platoons') {
    const own = D.platoons.filter((p) => p.bloc === L.bloc);
    const merc = L.bloc !== MERC ? D.platoons.filter((p) => p.bloc === MERC) : [];
    const row = (p) => `<div class="prow">
        <div class="row"><b>${esc(p.name)}</b><button class="btn sm primary" data-addpl="${esc(p.id)}">Ajouter</button></div>
        ${p.lore ? `<p><i>${esc(p.lore)}</i></p>` : ''}
        <p>${esc(p.advantage)}</p>
        <p class="num" style="font-size:12px">${p.command.length} commandement · ${p.combat.length} combat requis</p>
      </div>`;
    body = `<div class="cat-list">${own.map(row).join('') || '<p class="empty">Aucun peloton pour ce bloc.</p>'}
      ${merc.length ? `<div class="cat-group">Pelotons mercenaires</div>${merc.map(row).join('')}` : ''}</div>`;
  } else {
    const units = catalogUnits();
    const groups = U.catTab === 'captured'
      ? D.blocs.filter((b) => units.some((u) => u.bloc === b.id)).map((b) => [b.name, units.filter((u) => u.bloc === b.id)])
      : TYPE_ORDER.map((t) => [TYPE_LABELS[t], units.filter((u) => u.type === t)]).filter(([, a]) => a.length);
    const cap = U.catTab === 'captured';
    body = `
      ${!cap ? `<div class="typebar">${[['all', 'Tous'], ...TYPE_ORDER.map((t) => [t, TYPE_LABELS[t]])].map(([k, l]) => `<button data-type="${k}" class="${U.type === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : '<p class="hint">Un seul véhicule capturé par armée, coût +2 pts.</p>'}
      <div class="filters">
        <input type="search" id="cat-q" class="${U.catTab === 'units' && bloc?.factions.length ? '' : 'full'}" placeholder="Rechercher (nom, compétence…)" value="${esc(U.q)}">
        ${U.catTab === 'units' && bloc?.factions.length ? `<select id="cat-fac" aria-label="Filtrer par faction">
          <option value="all">Toutes les factions</option><option value="none" ${U.faction === 'none' ? 'selected' : ''}>Bloc (sans faction)</option>
          ${bloc.factions.map((f) => `<option value="${esc(f.id)}" ${U.faction === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
        </select>` : ''}
      </div>
      <div class="cat-list">
        ${groups.map(([g, arr]) => `<div class="cat-group">${esc(g)} · ${arr.length}</div>${arr.map((u) => unitRow(u, cap)).join('')}`).join('') || '<p class="empty">Aucune unité ne correspond.</p>'}
      </div>`;
  }
  return `<div class="cat-tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-cattab="${k}" class="${U.catTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>${body}`;
}

function unitRow(u, captured) {
  const D = S.data;
  const cost = unitCost(u) + (captured ? CAPTURED_SURCHARGE : 0);
  const tags = [
    u.faction ? `<span class="tag fac">${esc(factionName(u.faction, D))}</span>` : '',
    u.bloc === MERC && S.list.bloc !== MERC ? '<span class="tag merc">Mercenaire</span>' : '',
    captured ? '<span class="tag cap">Capturé</span>' : '',
    u.armor ? `<span class="tag">Arm. ${esc(u.armor)}</span>` : '',
  ].join('');
  return `<div class="urow">
    <div class="nm${hasImage(u.id) || communityPhotos(u.id).length ? ' wt' : ''}" data-card="${esc(u.id)}" data-cap="${captured ? 1 : ''}" tabindex="0" role="button" aria-label="Voir la carte ${esc(u.name)}">
      ${thumb(u.id)}<b>${esc(u.name)}</b>${u.subtitle ? `<small>${esc(u.subtitle)}</small>` : ''}<div class="tags">${tags}</div>
    </div>
    <span class="cost">${cost}</span>
    <button class="btn icon primary" data-add="${esc(u.id)}" data-cap="${captured ? 1 : ''}" aria-label="Ajouter ${esc(u.name)}">+</button>
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
    if (!P) return `<div class="block"><div class="block-h"><h3>Peloton introuvable</h3><button class="btn sm danger" data-rmpl="${pi.k}">Retirer</button></div></div>`;
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
        if (mercs.length) mercOpts = `<optgroup label="Remplacer par un mercenaire">${mercs.map((u) => `<option value="m:${esc(u.id)}" ${selected === 'm:' + u.id ? 'selected' : ''}>${esc(u.name)} (${esc(u.cost)})</option>`).join('')}</optgroup>`;
      }
      const shown = inSlot.filter((e) => !isShownUnder(e));
      return `<div class="slot">
        <div class="slot-l req ${inSlot.length ? 'done' : ''}">${label}</div>
        <div class="slot-body">
          <select data-slot="${pi.k}" data-role="${role}" aria-label="${esc(label)}">
            <option value="">— Choisir —</option>
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
          <span class="chip ${st?.complete ? 'ok' : 'warn'}">${st?.complete ? 'Avantage actif' : 'Incomplet'}</span>
          <span class="chip"><b class="num">${sub}</b> pts</span>
          <button class="btn sm danger" data-rmpl="${pi.k}">Retirer</button>
        </div>
      </div>
      <div class="block-b">
        <div class="adv ${st?.complete ? 'on' : ''}"><b>Avantage :</b> ${esc(P.advantage)}</div>
        ${P.command.map((opts, i) => slotRow('cmd' + i, P.command.length > 1 ? `Commandement ${i + 1}` : 'Commandement', opts, i)).join('')}
        ${P.combat.map((opts, i) => slotRow('c' + i, `Combat ${i + 1}`, opts, i)).join('')}
        <div class="slot"><div class="slot-l">Soutien</div><div class="slot-body">
          ${support.map(renderWithJoined).join('') || '<p class="hint" style="margin:6px 0 0">Ajoutez une unité depuis le catalogue puis affectez-la à ce peloton avec son menu « Peloton ».</p>'}
        </div></div>
      </div>
    </div>`;
  }).join('');

  const loose = L.entries.filter((e) => !e.pl && !isShownUnder(e));
  const looseSorted = [...loose].sort((a, b) => TYPE_ORDER.indexOf(D.unitsById.get(a.u)?.type) - TYPE_ORDER.indexOf(D.unitsById.get(b.u)?.type));
  const looseSum = loose.reduce((s, e) => s + entryCost(e, D) + (joinedMap.get(e.k) || []).filter((h) => !h.pl).reduce((x, h) => x + entryCost(h, D), 0), 0);

  if (!L.entries.length && !L.platoons.length) {
    return `<div class="block"><div class="block-b">
      <p style="margin:0"><b>Votre liste est vide.</b></p>
      <p class="hint" style="margin:0">Ajoutez des unités avec le bouton <b>+</b> du catalogue, ou partez d'un peloton (onglet « Pelotons ») pour bénéficier de son avantage. Cliquez sur le nom d'une unité pour voir sa carte complète.</p>
    </div></div>`;
  }

  return `${issues ? `<div class="issues">${issues}</div>` : ''}
    ${platoonBlocks}
    <div class="block">
      <div class="block-h"><div><h3>Unités indépendantes</h3><div class="sub">Hors peloton</div></div><span class="chip"><b class="num">${looseSum}</b> pts</span></div>
      <div class="block-b">${looseSorted.map(renderWithJoined).join('') || '<p class="hint" style="margin:0">Aucune unité hors peloton.</p>'}</div>
    </div>`;
}

function entryRow(e, joined = false) {
  const D = S.data, L = S.list;
  const u = D.unitsById.get(e.u);
  if (!u) return `<div class="erow"><div class="nm"><b>Unité inconnue</b><small>${esc(e.u)}</small></div><span></span><div class="ctrl"><button class="btn icon danger" data-rm="${e.k}" aria-label="Retirer">✕</button></div></div>`;
  const cost = entryCost(e, D);
  const tags = [
    u.faction ? `<span class="tag fac">${esc(factionName(u.faction, D))}</span>` : '',
    u.bloc === MERC && L.bloc !== MERC ? '<span class="tag merc">Mercenaire</span>' : '',
    e.cap ? '<span class="tag cap">Capturé</span>' : '',
  ].join('');
  let ctrls = '';
  // Rattachement d'un héros
  if (isJoiner(u)) {
    const targets = L.entries.filter((x) => x.k !== e.k).map((x) => ({ x, t: D.unitsById.get(x.u) })).filter(({ t }) => t && (
      ((t.type === 'infantry' || (t.type === 'hero' && isCommissar(u))) && t.armor === u.armor) || ((t.type === 'vehicle' || t.type === 'aircraft') && canPilot(u, t))));
    ctrls += `<select data-join="${e.k}" aria-label="Rattacher ${esc(u.name)}">
      <option value="">Seul</option>
      ${targets.map(({ x, t }) => `<option value="${x.k}" ${e.join === x.k ? 'selected' : ''}>${t.type === 'vehicle' || t.type === 'aircraft' ? 'Pilote' : 'Rejoint'} : ${esc(t.name)}</option>`).join('')}
    </select>`;
  }
  // Affectation à un peloton (unités hors poste requis)
  if (!e.role || e.role === 'sup') {
    if (L.platoons.length) {
      ctrls += `<select data-assign="${e.k}" aria-label="Peloton">
        <option value="">Indépendant</option>
        ${L.platoons.map((p) => `<option value="${p.k}" ${e.pl === p.k ? 'selected' : ''}>Soutien : ${esc(D.platoonsById.get(p.p)?.name || '?')}</option>`).join('')}
      </select>`;
    }
    ctrls += `<button class="btn icon" data-clone="${e.k}" title="Ajouter un exemplaire" aria-label="Dupliquer">⧉</button>`;
    ctrls += `<button class="btn icon danger" data-rm="${e.k}" aria-label="Retirer ${esc(u.name)}">✕</button>`;
  }
  return `<div class="erow ${joined ? 'joined' : ''}">
    <div class="nm${hasImage(u.id) || communityPhotos(u.id).length ? ' wt' : ''}" data-card="${esc(u.id)}" data-cap="${e.cap ? 1 : ''}" tabindex="0" role="button">
      ${thumb(u.id)}<b>${joined ? '↳ ' : ''}${esc(u.name)}</b><small>${esc(TYPE_LABELS[u.type] || '')}${u.armor ? ' · Armure ' + esc(u.armor) : ''}</small>${tags ? `<div class="tags">${tags}</div>` : ''}
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
      toast(`${u.name} ajouté${b.dataset.cap ? ' (capturé)' : ''}`);
    }));
    cat.querySelectorAll('[data-addpl]').forEach((b) => b.addEventListener('click', () => {
      const P = D.platoonsById.get(b.dataset.addpl);
      L.platoons.push({ k: uid(), p: P.id });
      commit();
      toast(`${P.name} ajouté : choisissez ses unités dans la liste`);
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
    withUndo(`${u?.name || 'Unité'} retiré`, () => removeEntry(b.dataset.rm));
  }));
  ros.querySelectorAll('[data-clone]').forEach((b) => b.addEventListener('click', () => {
    const e = L.entries.find((x) => x.k === b.dataset.clone);
    const c = { ...e, k: uid() }; delete c.join;
    if (c.role && c.role !== 'sup') { delete c.role; delete c.pl; }
    L.entries.push(c); commit();
  }));
  ros.querySelectorAll('[data-rmpl]').forEach((b) => b.addEventListener('click', () => {
    const pi = L.platoons.find((p) => p.k === b.dataset.rmpl);
    const name = D.platoonsById.get(pi?.p)?.name || 'Peloton';
    withUndo(`${name} retiré`, () => {
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
    if (e.cap) bits.push('capturé');
    if (e.merc) bits.push('mercenaire');
    if (e.join) { const t = D.unitsById.get(L.entries.find((x) => x.k === e.join)?.u); if (t) bits.push((t.type === 'vehicle' || t.type === 'aircraft' ? 'pilote ' : 'rejoint ') + t.name); }
    return `${ind}- ${u.name} (${entryCost(e, D)})${bits.length ? ' [' + bits.join(', ') + ']' : ''}`;
  };
  const out = [`${L.name}`, `${blocName(L.bloc, D)} · ${A.counted}/${L.limit} pts${A.covered ? ` (+${A.covered} pts de héros en bonus)` : ''} · ${A.kindLabel}`, ''];
  for (const pi of L.platoons) {
    const P = D.platoonsById.get(pi.p);
    const st = A.platoonStatus.find((s) => s.key === pi.k);
    out.push(`${P?.name || 'Peloton'}${st?.complete ? '' : ' (incomplet)'}`);
    for (const e of L.entries.filter((e) => e.pl === pi.k)) out.push(line(e));
    out.push('');
  }
  const loose = L.entries.filter((e) => !e.pl);
  if (loose.length) { out.push('Unités indépendantes'); for (const e of loose) out.push(line(e)); out.push(''); }
  if (A.errors.length) { out.push('À corriger :'); for (const m of A.errors) out.push('  ! ' + m); }
  out.push(`Total dépensé : ${A.total} pts`);
  return out.join('\n');
}

function openText(A) {
  const txt = listText(A);
  openModal(`<div class="modal-h"><div><div class="eyebrow">Export</div><h2>Liste en texte</h2></div><button class="btn icon" data-close-btn aria-label="Fermer">✕</button></div>
    <div class="modal-b"><textarea class="export-box" id="exp-txt" readonly>${esc(txt)}</textarea>
    <div><button class="btn primary" id="copy-txt">Copier le texte</button></div></div>`, (root) => {
    root.querySelector('#copy-txt').addEventListener('click', () => copyText(txt, root.querySelector('#exp-txt')));
  });
}

function openShare() {
  const url = shareURL(S.list);
  openModal(`<div class="modal-h"><div><div class="eyebrow">Partager</div><h2>Lien de la liste</h2><p>Toute personne qui ouvre ce lien reçoit une copie de votre liste, modifiable de son côté.</p></div><button class="btn icon" data-close-btn aria-label="Fermer">✕</button></div>
    <div class="modal-b"><textarea class="export-box share-url" id="share-url" readonly style="min-height:110px">${esc(url)}</textarea>
    <div><button class="btn primary" id="copy-url">Copier le lien</button></div></div>`, (root) => {
    root.querySelector('#copy-url').addEventListener('click', () => copyText(url, root.querySelector('#share-url')));
  });
}

function printHTML(A) {
  const D = S.data, L = S.list;
  const card = (e) => {
    const u = D.unitsById.get(e.u);
    if (!u) return '';
    const ws = u.weapons || [];
    return `<div class="pu"><b>${esc(u.name)}</b> — ${entryCost(e, D)} pts · Arm ${esc(u.armor ?? '-')} · Santé ${esc(u.health ?? '-')} · Mv ${esc(u.move ?? '-')}/${esc(u.march ?? '-')}${e.cap ? ' · capturé' : ''}
      ${(u.skills || []).length ? `<div><i>${u.skills.map(esc).join(', ')}</i></div>` : ''}
      ${ws.length ? `<table><tr><th>Arme</th><th>Nb</th><th>Portée</th><th>Inf 1-4</th><th>Véh 1-7</th><th>Aéro</th></tr>
      ${ws.map((w) => `<tr><td class="wn">${esc(w.name)}${(w.specials || []).length ? ' (' + w.specials.map(esc).join(', ') + ')' : ''}</td><td>${esc(w.count ?? '')}</td><td>${esc(w.range ?? '')}</td><td>${(w.vsInfantry || []).map(esc).join(' ')}</td><td>${(w.vsVehicle || []).map(esc).join(' ')}</td><td>${(w.vsAircraft || []).map(esc).join(' ')}</td></tr>`).join('')}</table>` : ''}
    </div>`;
  };
  return `<h1>${esc(L.name)}</h1><p>${esc(blocName(L.bloc, D))} · ${A.counted}/${L.limit} pts · ${esc(A.kindLabel)}</p>
    ${L.platoons.map((pi) => { const P = D.platoonsById.get(pi.p); return `<h3>${esc(P?.name || '')}</h3><p><i>${esc(P?.advantage || '')}</i></p>${L.entries.filter((e) => e.pl === pi.k).map(card).join('')}`; }).join('')}
    ${L.entries.some((e) => !e.pl) ? `<h3>Unités indépendantes</h3>${L.entries.filter((e) => !e.pl).map(card).join('')}` : ''}`;
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
  if (!imagesAvailable()) return '<p class="hint" style="margin:0">Images de cartes indisponibles dans ce navigateur (navigation privée ?).</p>';
  const slot = (side) => {
    const src = imageURL(u.id, side);
    return `<div class="img-slot">
      <div class="eyebrow">${SIDES[side]}</div>
      ${src ? `<button class="img-view" data-zoom="${side}" aria-label="Agrandir le ${SIDES[side].toLowerCase()}"><img src="${src}" alt="${esc(SIDES[side])} de la carte ${esc(u.name)}"></button>`
        : `<div class="img-empty">Aucune image</div>`}
      <div class="img-acts">
        <label class="btn sm">${src ? 'Remplacer' : 'Ajouter'}<input type="file" accept="image/*" data-up="${side}" hidden></label>
        ${src ? `<button class="btn sm danger" data-delimg="${side}">Retirer</button>` : ''}
      </div>
    </div>`;
  };
  return `<details class="img-box" ${hasImage(u.id) ? 'open' : ''}>
    <summary>Ma carte ${hasImage(u.id) ? '' : '<span class="hint">(ajouter une photo ou un scan)</span>'}</summary>
    <div class="img-grid">${slot('front')}${slot('back')}</div>
    <p class="hint" style="margin:0">Image gardée uniquement dans ce navigateur, pour votre usage personnel. Elle n'est ni envoyée ni partagée.</p>
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
    ${ph.length ? `<div class="eyebrow">Photos de la communauté</div>
    <div class="ph-grid">${ph.map((p) => `<figure><button class="img-view" data-zoomc aria-label="Agrandir"><img src="${esc(p.file)}" alt="Figurine ${esc(u.name)} peinte par ${esc(p.author)}" loading="lazy"></button>
      <figcaption>Photo : ${esc(p.author)}${p.license ? ' · ' + esc(p.license) : ''}</figcaption></figure>`).join('')}</div>` : ''}
    ${propose ? `<p class="hint" style="margin:0">Vous avez peint cette unité ? <a href="${propose}" target="_blank" rel="noopener">Proposez une photo de votre figurine</a>.</p>` : ''}
  </div>`;
}

function openUnitCard(u, cap) {
  openModal(unitCardHTML(u, S.data, { cost: unitCost(u) + (cap ? CAPTURED_SURCHARGE : 0), captured: cap, topHTML: communitySectionHTML(u) + imagesSectionHTML(u) }), (root, close) => {
    root.querySelectorAll('[data-zoomc]').forEach((b) => b.addEventListener('click', () => b.classList.toggle('zoomed')));
    root.querySelectorAll('[data-up]').forEach((inp) => inp.addEventListener('change', async () => {
      const f = inp.files[0];
      if (!f) return;
      try { await saveImage(u.id, inp.dataset.up, f); toast('Image enregistrée'); close(); refreshView(); openUnitCard(u, cap); }
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
    <h2>Mes images de cartes (${n})</h2>
    ${imagesAvailable() ? `
    <p class="hint" style="margin:0 0 12px;max-width:75ch">Ajoutez vos propres scans ou photos de cartes : ils s'affichent sur les fiches d'unités. Ils restent dans ce navigateur et ne sont jamais envoyés ni partagés. Nommez les fichiers comme l'unité (<code>Pounder.jpg</code>, <code>Bazooka Joe - verso.jpg</code>) pour les associer automatiquement ; vous pourrez corriger avant d'enregistrer.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <label class="btn primary">Importer des images<input type="file" id="bulk-img" accept="image/*" multiple hidden></label>
      ${n ? '<button class="btn danger" id="clear-img">Tout supprimer</button>' : ''}
      <span class="hint" id="img-space"></span>
    </div>` : '<p class="hint" style="margin:0">Ce navigateur ne permet pas de garder des images (navigation privée ou stockage bloqué).</p>'}
  </section>`;
}

function bindImagesPanel() {
  const inp = document.getElementById('bulk-img');
  if (!inp) return;
  storageEstimate().then((est) => {
    const el = document.getElementById('img-space');
    if (est && el && imageCount()) el.textContent = `Espace utilisé par le site : ${(est.usage / 1048576).toFixed(1)} Mo`;
  });
  inp.addEventListener('change', () => { if (inp.files.length) openBulkImport([...inp.files]); inp.value = ''; });
  document.getElementById('clear-img')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget;
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = `Confirmer : supprimer ${imageCount()} images`; return; }
    await clearImages(); renderHome(); toast('Images supprimées');
  });
}

function openBulkImport(files) {
  const D = S.data;
  const rows = matchFiles(files, D.units);
  const label = (u) => `${u.name} — ${blocName(u.bloc, D)}`;
  const byLabel = new Map(D.units.map((u) => [label(u), u]));
  const matched = rows.filter((r) => r.units.length).length;
  openModal(`<div class="modal-h"><div><div class="eyebrow">Import</div><h2>Associer les images</h2>
      <p>${matched} fichier(s) sur ${rows.length} reconnus automatiquement. Complétez ou corrigez puis enregistrez.</p></div>
      <button class="btn icon" data-close-btn aria-label="Fermer">✕</button></div>
    <div class="modal-b">
      <datalist id="unit-dl">${D.units.map((u) => `<option value="${esc(label(u))}">`).join('')}</datalist>
      <div class="bulk-list">
        ${rows.map((r, i) => `<div class="bulk-row">
          <img src="${URL.createObjectURL(r.file)}" alt="">
          <div class="bulk-main">
            <div class="bulk-file">${esc(r.file.name)}</div>
            <input type="text" list="unit-dl" id="bulk-u-${i}" placeholder="Choisir l'unité…" value="${esc(r.units[0] ? label(r.units[0]) : '')}" aria-label="Unité pour ${esc(r.file.name)}">
            ${r.units.length > 1 ? `<label class="check"><input type="checkbox" id="bulk-all-${i}" checked> Appliquer aussi aux ${r.units.length - 1} autre(s) version(s) : ${r.units.slice(1).map((u) => esc(label(u))).join(', ')}</label>` : ''}
          </div>
          <select id="bulk-s-${i}" aria-label="Face">${Object.entries(SIDES).map(([k, v]) => `<option value="${k}" ${r.side === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </div>`).join('')}
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn primary" id="bulk-save">Enregistrer</button><span class="hint" id="bulk-status"></span></div>
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
        status.textContent = `Enregistrement ${i + 1}/${rows.length}…`;
        try { for (const t of targets) await saveImage(t.id, side, r.file, { silent: true }); ok++; }
        catch (e) { skipped++; toast(e.message); }
      }
      close(); refreshView();
      toast(`${ok} image(s) enregistrée(s)${skipped ? `, ${skipped} ignorée(s) sans unité` : ''}`);
    });
  });
}
