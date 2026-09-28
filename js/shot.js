// Shot Format — version courte de l'army builder (DUST 194∞, L'Heure du Loir)
import { loadData, TYPE_LABELS, unitCost, heroBaseName, canPilot } from './data.js';
import { analyzeArmy, blocName, factionName } from './rules.js';
import { esc, uid, store, toast, copyText, openModal, unitCardHTML } from './ui.js';

const LS_KEY = 'dust1947.short.lists';
const SLOTS = ['cmd', 'c1', 'c2', 'c3', 'c4', 'veh'];
const app = document.getElementById('app');
const S = { data: null, F: null, lists: [], list: null };

init();
async function init() {
  try {
    const [data, F] = await Promise.all([
      loadData(),
      fetch('data/short-format.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('short-format.json ' + r.status); return r.json(); }),
    ]);
    S.data = data; S.F = F;
  } catch (e) {
    app.innerHTML = `<div class="sf-wrap"><div class="issue bad"><b>!</b><span>Impossible de charger la base : ${esc(e.message)}</span></div></div>`;
    return;
  }
  S.lists = store.get(LS_KEY, []);
  { const t = store.get('dust1947.theme', null); if (t) document.documentElement.dataset.theme = t; }
  window.addEventListener('hashchange', route);
  route();
}

const save = () => {
  if (S.list) {
    S.list.updated = Date.now();
    const i = S.lists.findIndex((l) => l.id === S.list.id);
    if (i >= 0) S.lists[i] = S.list; else S.lists.unshift(S.list);
  }
  if (!store.set(LS_KEY, S.lists)) toast('Sauvegarde locale indisponible : utilisez « Partager » pour garder votre liste.');
};

function route() {
  const h = location.hash;
  if (h.startsWith('#s=')) return importCode(h.slice(3));
  const m = h.match(/^#\/([\w-]+)/);
  const l = m && S.lists.find((x) => x.id === m[1]);
  if (l) { S.list = l; return renderArmy(); }
  S.list = null; renderHome();
}
const go = (h) => { if (location.hash === h) route(); else location.hash = h; };

// ---------------------------------------------------------------- Règles du format
function slotSpec(slot) {
  const F = S.F;
  if (slot === 'cmd') return { ...F.command, label: 'Unité de commandement', short: 'Commandement', required: true, hint: 'Un héros' };
  if (slot === 'c1') return { ...F.combatRequired, label: 'Unité de combat 1', short: 'Combat 1', required: true, hint: `Escouade, armure ${F.combatRequired.maxArmor} max.` };
  if (slot === 'veh') return { ...F.vehicle, label: 'Véhicule', short: 'Véhicule', required: true, hint: `Armure ${F.vehicle.maxArmor} max., pas d'aéronef` };
  const n = +slot.slice(1);
  return { ...F.combatOptional, label: `Unité de combat ${n}`, short: `Combat ${n}`, required: false, hint: `Escouade, armure ${F.combatOptional.maxArmor} max.` };
}

const banned = () => new Set((S.F.bannedHeroes || []).map(heroBaseName));
// Raison d'interdiction d'une unité (compétence interdite ou héros listé), sinon null
function banReason(u) {
  const bs = S.F.bannedSkills || {};
  const sk = [...(u.skills || []), ...(u.customSkills || []).map((c) => c.name)].find((x) => bs[x]);
  if (sk) return bs[sk] + ' interdit';
  if (u.type === 'hero' && banned().has(heroBaseName(u.name))) return 'héros interdit dans ce format';
  return null;
}

function allowedFor(slot, bloc) {
  const spec = slotSpec(slot);
  return S.data.units.filter((u) => u.bloc === bloc
    && spec.types.includes(u.type)
    && (spec.maxArmor === undefined || (u.armor ?? 0) <= spec.maxArmor)
    && !banReason(u));
}

function toEntries(L) {
  return SLOTS.filter((s) => L.slots[s]?.u).map((s) => ({ k: s, u: L.slots[s].u, ...(s === 'cmd' && L.slots.cmd.join ? { join: L.slots.cmd.join } : {}) }));
}

function analyze(L) {
  const D = S.data, F = S.F;
  const A = analyzeArmy({ bloc: L.bloc, limit: F.budget, entries: toEntries(L), platoons: [] }, D);
  const checks = [];
  for (const s of SLOTS) {
    const spec = slotSpec(s);
    const u = D.unitsById.get(L.slots[s]?.u);
    if (!u) { if (spec.required) checks.push({ ok: false, msg: `${spec.label} : obligatoire.` }); continue; }
    const bad = [];
    if (u.bloc !== L.bloc) bad.push(`n'appartient pas au bloc ${blocName(L.bloc, D)}`);
    if (!spec.types.includes(u.type)) bad.push(`type non autorisé (${TYPE_LABELS[u.type]})`);
    if (spec.maxArmor !== undefined && (u.armor ?? 0) > spec.maxArmor) bad.push(`armure ${u.armor} (max. ${spec.maxArmor})`);
    const br = banReason(u); if (br) bad.push(br);
    checks.push({ ok: !bad.length, msg: `${spec.label} : ${u.name}${bad.length ? ' — ' + bad.join(', ') : ''}` });
  }
  const bonus = A.covered;
  checks.push({ ok: A.counted <= F.budget, msg: `Budget : ${A.counted} / ${F.budget} PA${bonus ? ` (+${bonus} PA de bonus sur le héros)` : ''}` });
  // Erreurs de rattachement / unicité détectées par les règles de base (hors limite de points, déjà vérifiée)
  for (const e of A.errors) if (!e.startsWith('Limite dépassée')) checks.push({ ok: false, msg: e });
  const firstTurn = toEntries(L).map((e) => D.unitsById.get(e.u)).filter((u) => u && (u.skills || []).some((s) => F.firstTurnSkills.includes(s)));
  const info = [];
  if (A.kind !== 'none') info.push(`${A.kindLabel} : bonus de ${F.heroBonus} PA réservé au héros.`);
  else if (A.reason) info.push(A.reason);
  if (firstTurn.length > 1) info.push(`${firstTurn.map((u) => u.name).join(', ')} ont Spy ou Airborne : une seule unité pourra s'en servir, et seulement au tour 1.`);
  else if (firstTurn.length === 1) info.push(`${firstTurn[0].name} a Spy ou Airborne : utilisable au tour 1 uniquement. En cas d'échec, entrée au tour 2 par votre zone de déploiement.`);
  const ok = checks.every((c) => c.ok);
  return { A, checks, info, ok };
}

// ---------------------------------------------------------------- Accueil
function header(back) {
  return `<header class="sf-top">
    ${back ? '<a class="sf-back" href="#/" aria-label="Retour aux listes">←</a>' : ''}
    <a class="sf-brand" href="#/"><b>${esc(S.F.game)}</b><span>${esc(S.F.name)}</span></a>
    <nav>${S.F.showFullBuilderLink ? '<a href="index.html">Builder complet</a>' : ''}<button id="theme-btn" type="button">Thème</button></nav>
  </header>`;
}
function bindHeader() {
  document.getElementById('theme-btn')?.addEventListener('click', () => {
    const r = document.documentElement;
    const cur = r.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    r.dataset.theme = cur === 'dark' ? 'light' : 'dark';
    store.set('dust1947.theme', r.dataset.theme);
  });
}

function renderHome() {
  const D = S.data, F = S.F;
  const lists = [...S.lists].sort((a, b) => (b.updated || 0) - (a.updated || 0));
  app.innerHTML = `${header(false)}
  <main class="sf-wrap">
    <section class="sf-hero">
      <p class="eyebrow">${esc(F.tagline)} · par ${esc(F.by)}</p>
      <h1>${esc(F.name)}</h1>
      <p class="sf-lead">Des parties courtes, ${esc(F.duration)}. Un héros, une à quatre escouades, un véhicule : <b>${F.budget} PA</b>, +${F.heroBonus} PA pour le héros en armée de faction.</p>
    </section>

    <form class="sf-card sf-new" id="new-form">
      <h2>Nouvelle armée</h2>
      <div class="sf-blocs">
        ${D.blocs.filter((b) => b.id !== 'Mercenaries' || F.allowMercenaries).map((b, i) => `<label style="--bc:${esc(b.color)}"><input type="radio" name="bloc" value="${esc(b.id)}" ${i === 0 ? 'checked' : ''}><span class="swatch"></span>${esc(b.name)}</label>`).join('')}
      </div>
      <input type="text" id="new-name" placeholder="Nom (facultatif)" maxlength="60" aria-label="Nom de l'armée">
      <button class="btn primary" type="submit">Créer</button>
    </form>

    <section class="sf-card">
      <h2>Mes armées (${lists.length})</h2>
      ${lists.length ? `<div class="sf-saved">${lists.map((l) => {
        const r = analyze(l); const b = D.blocsById.get(l.bloc);
        return `<div class="sf-saved-row"><button class="sf-open" data-open="${l.id}"><span class="swatch" style="--bc:${esc(b?.color)}"></span><span><b>${esc(l.name)}</b><small>${esc(b?.name || '')} · ${r.A.counted}/${F.budget} PA · ${r.ok ? 'valide' : 'incomplète'}</small></span></button>
          <button class="btn sm danger" data-del="${l.id}" aria-label="Supprimer ${esc(l.name)}">✕</button></div>`;
      }).join('')}</div>` : '<p class="hint" style="margin:0">Aucune armée pour l\'instant.</p>'}
    </section>

    <details class="sf-card sf-rules">
      <summary>Règles du format</summary>
      ${rulesHTML()}
    </details>
  </main>`;
  bindHeader();
  document.getElementById('new-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const bloc = e.target.querySelector('input[name=bloc]:checked').value;
    const name = document.getElementById('new-name').value.trim() || `${blocName(bloc, D)} · ${F.name}`;
    S.list = { id: uid() + uid(), name, bloc, slots: {}, created: Date.now() };
    save(); go('#/' + S.list.id);
  });
  app.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => go('#/' + b.dataset.open)));
  app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Supprimer ?'; return; }
    const i = S.lists.findIndex((l) => l.id === b.dataset.del);
    const [rm] = S.lists.splice(i, 1); store.set(LS_KEY, S.lists); renderHome();
    toast(`« ${rm.name} » supprimée`, { label: 'Annuler', run: () => { S.lists.splice(i, 0, rm); store.set(LS_KEY, S.lists); renderHome(); } });
  }));
}

function rulesHTML() {
  const F = S.F;
  return `<div class="sf-rules-b">
    <h3>Mise en place</h3><ul>${F.settings.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    <h3>Composition</h3><ul>
      <li>1 unité de commandement obligatoire : un héros. Il peut rejoindre une escouade de même armure, ou piloter le véhicule si ses compétences le permettent.</li>
      <li>1 escouade obligatoire, armure ${F.combatRequired.maxArmor} max.</li>
      <li>0 à ${F.combatOptional.count} escouades supplémentaires, armure ${F.combatOptional.maxArmor} max.</li>
      <li>1 véhicule obligatoire, armure ${F.vehicle.maxArmor} max.</li>
      <li>${F.budget} PA, +${F.heroBonus} PA (10 %) pour le héros si l'armée respecte les règles de faction (livre DUST 1947).</li>
      <li>Ni mercenaire, ni véhicule capturé.</li>
      <li>Interdits : ${Object.values(F.bannedSkills || {}).map(esc).join(', ')}${(F.bannedHeroes || []).length ? ', ' + F.bannedHeroes.map(esc).join(', ') : ''}.</li>
    </ul>
    <h3>Restrictions</h3><ul>${F.reminders.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
  </div>`;
}

// ---------------------------------------------------------------- Armée
function renderArmy() {
  const D = S.data, F = S.F, L = S.list;
  const R = analyze(L);
  const bloc = D.blocsById.get(L.bloc);
  const pct = Math.min(100, (R.A.counted / F.budget) * 100);
  const optShown = Math.min(F.combatOptional.count, Math.max(1, SLOTS.slice(2, 5).filter((s) => L.slots[s]?.u).length + 1));
  const optSlots = SLOTS.slice(2, 2 + optShown);
  app.innerHTML = `${header(true)}
  <main class="sf-wrap">
    <div class="sf-title">
      <input type="text" id="army-name" value="${esc(L.name)}" maxlength="60" aria-label="Nom de l'armée">
      <span class="chip bloc" style="--bc:${esc(bloc?.color)}"><span class="swatch"></span>${esc(bloc?.name)}</span>
    </div>

    <section class="sf-sum ${R.ok ? 'ok' : ''}" aria-label="Résumé">
      <div class="sf-pa"><b>${R.A.counted}</b><span>/ ${F.budget} PA</span></div>
      <div class="sf-bar"><i class="${R.A.counted > F.budget ? 'over' : ''}" style="width:${pct}%"></i></div>
      <div class="sf-sum-chips">
        <span class="chip ${R.ok ? 'ok' : 'warn'}">${R.ok ? 'Prête à jouer' : 'Incomplète'}</span>
        ${R.A.covered ? `<span class="chip">+${R.A.covered} PA héros</span>` : ''}
        ${R.A.kind !== 'none' ? `<span class="chip ok">${esc(R.A.kindLabel)}</span>` : ''}
      </div>
    </section>

    <ol class="sf-tree">
      ${slotHTML('cmd')}
      ${slotHTML('c1')}
      ${optSlots.map(slotHTML).join('')}
      ${slotHTML('veh')}
    </ol>

    <section class="sf-card">
      <h2>Vérification</h2>
      <ul class="sf-checks">${R.checks.map((c) => `<li class="${c.ok ? 'ok' : 'bad'}"><b>${c.ok ? '✓' : '✕'}</b><span>${esc(c.msg)}</span></li>`).join('')}</ul>
      ${R.info.map((m) => `<p class="sf-info">${esc(m)}</p>`).join('')}
    </section>

    <div class="sf-actions">
      <button class="btn primary" id="btn-share">Partager</button>
      <button class="btn" id="btn-sheet">Fiche de partie</button>
      <button class="btn" id="btn-text">Texte</button>
    </div>
    <div class="print-sheet" id="print-sheet"></div>
  </main>`;
  bindHeader();
  bindArmy();
}

function slotHTML(slot) {
  const D = S.data, L = S.list;
  const spec = slotSpec(slot);
  const e = L.slots[slot];
  const u = e?.u ? D.unitsById.get(e.u) : null;
  const icon = slot === 'cmd' ? '★' : slot === 'veh' ? '◆' : '●';
  let extra = '';
  if (u && slot === 'cmd') {
    const targets = SLOTS.filter((s) => s !== 'cmd' && L.slots[s]?.u).map((s) => ({ s, t: D.unitsById.get(L.slots[s].u) }))
      .filter(({ t }) => t && ((t.type === 'infantry' && t.armor === u.armor) || (t.type === 'vehicle' && canPilot(u, t))));
    extra = `<label class="sf-join"><span>Placement</span><select data-join aria-label="Rattacher le héros">
      <option value="">Seul</option>
      ${targets.map(({ s, t }) => `<option value="${s}" ${e.join === s ? 'selected' : ''}>${t.type === 'vehicle' ? 'Pilote' : 'Rejoint'} : ${esc(t.name)}</option>`).join('')}
    </select></label>`;
    if (!targets.length) extra += '<p class="hint" style="margin:0">Aucune escouade de même armure ni véhicule pilotable : le héros joue seul.</p>';
  }
  return `<li class="sf-slot ${spec.required ? 'req' : 'opt'} ${u ? 'filled' : ''}" data-slot="${slot}">
    <div class="sf-slot-h"><span class="sf-ico" aria-hidden="true">${icon}</span>
      <div><b>${esc(spec.label)}</b><small>${spec.required ? 'Obligatoire' : 'Facultative'} · ${esc(spec.hint)}</small></div></div>
    ${u ? `<div class="sf-unit">
        <button class="sf-unit-n" data-card="${esc(u.id)}"><b>${esc(u.name)}</b><small>${esc(u.subtitle || TYPE_LABELS[u.type])}${u.armor ? ' · Armure ' + u.armor : ''}${u.faction ? ' · ' + esc(factionName(u.faction, D)) : ''}</small></button>
        <span class="sf-cost">${unitCost(u)}</span>
        <button class="btn sm" data-pick="${slot}">Changer</button>
        <button class="btn sm icon danger" data-clear="${slot}" aria-label="Retirer">✕</button>
      </div>${extra}`
      : `<button class="btn sf-add" data-pick="${slot}">+ Choisir</button>`}
  </li>`;
}

function bindArmy() {
  const L = S.list;
  document.getElementById('army-name').addEventListener('change', (e) => { L.name = e.target.value.trim() || L.name; save(); });
  app.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => openPicker(b.dataset.pick)));
  app.querySelectorAll('[data-clear]').forEach((b) => b.addEventListener('click', () => {
    const s = b.dataset.clear;
    delete L.slots[s];
    if (L.slots.cmd?.join === s) delete L.slots.cmd.join;
    compactOptional(); save(); renderArmy();
  }));
  app.querySelector('[data-join]')?.addEventListener('change', (e) => { L.slots.cmd.join = e.target.value || undefined; save(); renderArmy(); });
  app.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', () => {
    openModal(unitCardHTML(S.data.unitsById.get(b.dataset.card), S.data));
  }));
  document.getElementById('btn-share').addEventListener('click', share);
  document.getElementById('btn-text').addEventListener('click', () => {
    const t = listText();
    openModal(`<div class="modal-h"><div><div class="eyebrow">Export</div><h2>Liste en texte</h2></div><button class="btn icon" data-close-btn aria-label="Fermer">✕</button></div>
      <div class="modal-b"><textarea class="export-box" id="exp" readonly>${esc(t)}</textarea><div><button class="btn primary" id="cp">Copier</button></div></div>`,
    (root) => root.querySelector('#cp').addEventListener('click', () => copyText(t, root.querySelector('#exp'))));
  });
  document.getElementById('btn-sheet').addEventListener('click', () => {
    document.getElementById('print-sheet').innerHTML = sheetHTML();
    window.print();
  });
}

// Garde les escouades facultatives groupées (c2, c3, c4) sans trou
function compactOptional() {
  const L = S.list;
  const opt = ['c2', 'c3', 'c4'];
  const filled = opt.map((s) => ({ s, v: L.slots[s] })).filter((x) => x.v?.u);
  const remap = {};
  opt.forEach((s) => delete L.slots[s]);
  filled.forEach((x, i) => { L.slots[opt[i]] = x.v; remap[x.s] = opt[i]; });
  if (L.slots.cmd?.join && remap[L.slots.cmd.join]) L.slots.cmd.join = remap[L.slots.cmd.join];
}

function openPicker(slot) {
  const D = S.data, L = S.list;
  const spec = slotSpec(slot);
  const all = allowedFor(slot, L.bloc).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  const R = analyze(L);
  const current = L.slots[slot]?.u ? unitCost(D.unitsById.get(L.slots[slot].u)) : 0;
  const left = S.F.budget + (slot === 'cmd' ? S.F.heroBonus : 0) - (R.A.counted - current);
  // Filtre de sous-faction : mémorisé par armée ; par défaut, la faction déjà présente dans l'armée
  const factions = (D.blocsById.get(L.bloc)?.factions || []).filter((f) => all.some((u) => u.faction === f.id));
  if (L.fac === undefined) L.fac = R.A.factions.length === 1 ? R.A.factions[0] : 'all';
  if (L.fac !== 'all' && L.fac !== 'none' && !factions.some((f) => f.id === L.fac)) L.fac = 'all';
  const chips = [['all', 'Toutes'], ['none', 'Bloc'], ...factions.map((f) => [f.id, f.name])];
  const count = (k) => all.filter((u) => k === 'all' || (k === 'none' ? !u.faction : u.faction === k)).length;
  let q = '';
  const row = (u) => `<button class="sf-pick" data-u="${esc(u.id)}">
      <span><b>${esc(u.name)}</b><small>${esc(u.subtitle || TYPE_LABELS[u.type])}${u.armor ? ' · Arm. ' + u.armor : ''}${u.faction ? ' · ' + esc(factionName(u.faction, D)) : ''}</small></span>
      <span class="sf-cost ${unitCost(u) > left ? 'over' : ''}">${unitCost(u)}</span></button>`;
  const listHTML = () => {
    const shown = all.filter((u) => (L.fac === 'all' || (L.fac === 'none' ? !u.faction : u.faction === L.fac))
      && (!q || (u.name + ' ' + u.subtitle).toLowerCase().includes(q)));
    return shown.map(row).join('') || `<p class="hint">${all.length ? 'Aucune unité ne correspond à ce filtre.' : 'Aucune unité autorisée pour ce poste dans ce bloc.'}</p>`;
  };
  openModal(`<div class="modal-h"><div><div class="eyebrow">${esc(blocName(L.bloc, D))} · ${esc(spec.hint)}</div><h2>${esc(spec.label)}</h2>
      <p>Il vous reste environ ${left} PA${slot === 'cmd' ? ' (bonus héros compris)' : ''}.</p></div>
      <button class="btn icon" data-close-btn aria-label="Fermer">✕</button></div>
    <div class="modal-b">
      ${factions.length ? `<div class="sf-fac" role="group" aria-label="Filtrer par sous-faction">${chips.map(([k, l]) => `<button type="button" data-fac="${esc(k)}" class="${L.fac === k ? 'on' : ''}" ${count(k) ? '' : 'disabled'}>${esc(l)} <small>${count(k)}</small></button>`).join('')}</div>` : ''}
      <input type="search" id="pk-q" placeholder="Rechercher" aria-label="Rechercher une unité">
      <div class="sf-pick-list" id="pk-list">${listHTML()}</div>
    </div>`, (root, close) => {
    const list = root.querySelector('#pk-list');
    const bind = () => list.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', () => {
      L.slots[slot] = { u: b.dataset.u };
      compactOptional(); save(); close(); renderArmy();
    }));
    const refresh = () => { list.innerHTML = listHTML(); bind(); };
    bind();
    root.querySelectorAll('[data-fac]').forEach((b) => b.addEventListener('click', () => {
      L.fac = b.dataset.fac; save();
      root.querySelectorAll('[data-fac]').forEach((x) => x.classList.toggle('on', x === b));
      refresh();
    }));
    root.querySelector('#pk-q').addEventListener('input', (e) => { q = e.target.value.toLowerCase(); refresh(); });
  });
}

// ---------------------------------------------------------------- Partage & export
function encode(L) {
  const c = { v: 1, n: L.name, b: L.bloc, s: Object.fromEntries(SLOTS.filter((s) => L.slots[s]?.u).map((s) => [s, s === 'cmd' ? [L.slots[s].u, L.slots[s].join || ''] : L.slots[s].u])) };
  const bytes = new TextEncoder().encode(JSON.stringify(c));
  let bin = ''; bytes.forEach((x) => { bin += String.fromCharCode(x); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function importCode(code) {
  try {
    const b64 = decodeURIComponent(code).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const c = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
    const slots = {};
    for (const [s, v] of Object.entries(c.s || {})) slots[s] = s === 'cmd' ? { u: v[0], ...(v[1] ? { join: v[1] } : {}) } : { u: v };
    S.list = { id: uid() + uid(), name: c.n, bloc: c.b, slots, created: Date.now() };
    save(); history.replaceState(null, '', '#/' + S.list.id); toast(`« ${c.n} » importée`); renderArmy();
  } catch {
    toast('Lien de liste invalide.'); history.replaceState(null, '', '#/'); renderHome();
  }
}
function share() {
  const url = location.href.split('#')[0] + '#s=' + encode(S.list);
  openModal(`<div class="modal-h"><div><div class="eyebrow">Partager</div><h2>Lien de l'armée</h2><p>Votre adversaire reçoit une copie de votre armée.</p></div><button class="btn icon" data-close-btn aria-label="Fermer">✕</button></div>
    <div class="modal-b"><textarea class="export-box share-url" id="su" readonly style="min-height:100px">${esc(url)}</textarea><div><button class="btn primary" id="cu">Copier le lien</button></div></div>`,
  (root) => root.querySelector('#cu').addEventListener('click', () => copyText(url, root.querySelector('#su'))));
}

function listText() {
  const D = S.data, F = S.F, L = S.list, R = analyze(L);
  const out = [`${L.name}`, `${F.game} · ${F.name} · ${blocName(L.bloc, D)} · ${R.A.counted}/${F.budget} PA${R.A.covered ? ` (+${R.A.covered} bonus héros)` : ''}`, ''];
  for (const s of SLOTS) {
    const u = D.unitsById.get(L.slots[s]?.u);
    if (!u) continue;
    let tail = '';
    if (s === 'cmd' && L.slots.cmd.join) { const t = D.unitsById.get(L.slots[L.slots.cmd.join]?.u); if (t) tail = ` [${t.type === 'vehicle' ? 'pilote' : 'rejoint'} ${t.name}]`; }
    out.push(`${slotSpec(s).short} : ${u.name} (${unitCost(u)})${tail}`);
  }
  if (!R.ok) out.push('', 'À compléter : ' + R.checks.filter((c) => !c.ok).map((c) => c.msg).join(' ; '));
  return out.join('\n');
}

function sheetHTML() {
  const D = S.data, F = S.F, L = S.list, R = analyze(L);
  const card = (s) => {
    const u = D.unitsById.get(L.slots[s]?.u);
    if (!u) return '';
    const ws = u.weapons || [];
    return `<div class="pu"><b>${esc(slotSpec(s).short)} — ${esc(u.name)}</b> · ${unitCost(u)} PA · Arm ${esc(u.armor ?? '-')} · Santé ${esc(u.health ?? '-')} · Mv ${esc(u.move ?? '-')}/${esc(u.march ?? '-')}
      ${(u.skills || []).length ? `<div><i>${u.skills.map(esc).join(', ')}</i></div>` : ''}
      ${ws.length ? `<table><tr><th>Arme</th><th>Nb</th><th>Portée</th><th>Inf 1-4</th><th>Véh 1-7</th></tr>${ws.map((w) => `<tr><td class="wn">${esc(w.name)}${(w.specials || []).length ? ' (' + w.specials.map(esc).join(', ') + ')' : ''}</td><td>${esc(w.count ?? '')}</td><td>${esc(w.range ?? '')}</td><td>${(w.vsInfantry || []).map(esc).join(' ')}</td><td>${(w.vsVehicle || []).map(esc).join(' ')}</td></tr>`).join('')}</table>` : ''}</div>`;
  };
  return `<h1>${esc(L.name)}</h1><p>${esc(F.game)} · ${esc(F.name)} · ${esc(blocName(L.bloc, D))} · ${R.A.counted}/${F.budget} PA${R.A.covered ? ` (+${R.A.covered} bonus héros)` : ''}</p>
    ${SLOTS.map(card).join('')}
    <h3>Rappels</h3><ul>${[...F.settings, ...F.reminders].map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
}
