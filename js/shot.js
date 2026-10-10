// Shot Format — version courte de l'army builder (DUST 194∞, L'Heure du Loir)
import { loadData, typeLabel, unitCost, heroBaseName, canPilot } from './data.js';
import { t, LANG, initLang, setLang } from './i18n.js';
import { analyzeArmy, blocName, factionName } from './rules.js';
import { esc, uid, store, toast, copyText, openModal, unitCardHTML, brandLogo, mountCredit, printCredit } from './ui.js';
import { attackHtml } from './dice.js';
import { exportListPDF, pdfDialogHTML, bindPdfDialog } from './pdf.js';
import { initCardArt } from './cardart.js';
import { initImages } from './images.js';
import { openUnitCard, thumb, artOf } from './unitcard.js';

const LS_KEY = 'dust1947.short.lists';
const SLOTS = ['cmd', 'c1', 'c2', 'c3', 'c4', 'veh'];
const app = document.getElementById('app');
const S = { data: null, F: null, lists: [], list: null };

init();
async function init() {
  initLang();
  mountCredit();
  try {
    const [data, F] = await Promise.all([
      loadData(),
      fetch('data/short-format.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('short-format.json ' + r.status); return r.json(); }),
    ]);
    // Version anglaise : textes du format et descriptions de compétences traduites
    S.F = LANG === 'en' && F.en ? { ...F, ...F.en, feedback: { ...F.feedback, ...(F.en.feedback || {}) } } : F;
    S.data = data;
  } catch (e) {
    app.innerHTML = `<div class="sf-wrap"><div class="issue bad"><b>!</b><span>${esc(t('Impossible de charger la base : {e}', { e: e.message }))}</span></div></div>`;
    return;
  }
  S.lists = store.get(LS_KEY, []);
  S.lists.forEach(dropUnknown);
  await initImages();
  await initCardArt();
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
  if (!store.set(LS_KEY, S.lists)) toast(t('Sauvegarde locale indisponible : utilisez « Partager » pour garder votre liste.'));
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
  if (slot === 'cmd') return { ...F.command, label: t('Unité de commandement'), short: t('Commandement'), required: true, hint: t('Un héros') };
  if (slot === 'c1') return { ...F.combatRequired, label: t('Unité de combat {n}', { n: 1 }), short: t('Combat {n}', { n: 1 }), required: true, hint: t('Escouade, armure {n} max.', { n: F.combatRequired.maxArmor }) };
  if (slot === 'veh') return { ...F.vehicle, label: t('Véhicule'), short: t('Véhicule'), required: true, hint: t("Armure {n} max., pas d'aéronef", { n: F.vehicle.maxArmor }) };
  const n = +slot.slice(1);
  return { ...F.combatOptional, label: t('Unité de combat {n}', { n }), short: t('Combat {n}', { n }), required: false, hint: t('Escouade, armure {n} max.', { n: F.combatOptional.maxArmor }) };
}

const banned = () => new Set((S.F.bannedHeroes || []).map(heroBaseName));
// Raison d'interdiction d'une unité (compétence interdite ou héros listé), sinon null
function banReason(u) {
  const bs = S.F.bannedSkills || {};
  const sk = [...(u.skills || []), ...(u.customSkills || []).map((c) => c.name)].find((x) => bs[x]);
  if (sk) return t('{x} interdit', { x: bs[sk] });
  if (u.type === 'hero' && banned().has(heroBaseName(u.name))) return t('héros interdit dans ce format');
  return null;
}

// Coût affiché d'une unité : le bonus héros est déduit du coût du HQ (« 7 → 3 »)
function hqBonus(R) { return R?.A?.covered || 0; }
function costLabel(u, slot, R) {
  const b = slot === 'cmd' ? hqBonus(R) : 0;
  return b ? `${unitCost(u)} → ${unitCost(u) - b}` : `${unitCost(u)}`;
}
function budgetLine(A, F) {
  const over = A.counted - F.budget;
  let m = A.covered
    ? t('{s} PA dépensés − {b} PA de bonus HQ = {c} / {l} PA', { s: A.total, b: A.covered, c: A.counted, l: F.budget })
    : t('{c} / {l} PA', { c: A.counted, l: F.budget });
  if (over > 0) m += t(' : {n} PA de trop', { n: over });
  return m;
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
    if (!u) { if (spec.required) checks.push({ ok: false, msg: t('{slot} : obligatoire.', { slot: spec.label }) }); continue; }
    const bad = [];
    if (u.bloc !== L.bloc) bad.push(t("n'appartient pas au bloc {b}", { b: blocName(L.bloc, D) }));
    if (!spec.types.includes(u.type)) bad.push(t('type non autorisé ({t})', { t: typeLabel(u.type) }));
    if (spec.maxArmor !== undefined && (u.armor ?? 0) > spec.maxArmor) bad.push(t('armure {a} (max. {m})', { a: u.armor, m: spec.maxArmor }));
    const br = banReason(u); if (br) bad.push(br);
    checks.push({ ok: !bad.length, msg: `${spec.label}${LANG === 'en' ? ':' : ' :'} ${u.name}${bad.length ? ' — ' + bad.join(', ') : ''}` });
  }
  checks.push({ ok: A.counted <= F.budget, msg: t('Budget : ') + budgetLine(A, F) });
  // Erreurs de rattachement / unicité détectées par les règles de base (hors limite de points, déjà vérifiée)
  const limitMsg = A.overLimit ? A.errors[A.errors.length - 1] : null;
  for (const e of A.errors) if (e !== limitMsg) checks.push({ ok: false, msg: e });
  const firstTurn = toEntries(L).map((e) => D.unitsById.get(e.u)).filter((u) => u && (u.skills || []).some((s) => F.firstTurnSkills.includes(s)));
  const info = [];
  const hq = D.unitsById.get(L.slots.cmd?.u);
  if (A.kind !== 'none') info.push(A.covered && hq ? t('{k} : {n} PA de bonus déduits du coût du HQ ({hq}).', { k: A.kindLabel, n: A.covered, hq: hq.name }) : t('{k} : jusqu\'à {n} PA de bonus déduits du coût du HQ.', { k: A.kindLabel, n: F.heroBonus }));
  else if (A.reason) info.push(t('Pas de bonus : {r}', { r: A.reason }));
  if (firstTurn.length > 1) info.push(t("{list} ont Spy ou Airborne : une seule unité pourra s'en servir, et seulement au tour 1.", { list: firstTurn.map((u) => u.name).join(', ') }));
  else if (firstTurn.length === 1) info.push(t("{name} a Spy ou Airborne : utilisable au tour 1 uniquement. En cas d'échec, entrée au tour 2 par votre zone de déploiement.", { name: firstTurn[0].name }));
  const ok = checks.every((c) => c.ok);
  return { A, checks, info, ok };
}

// ---------------------------------------------------------------- Accueil
function header(back) {
  return `<header class="sf-top">
    ${back ? `<a class="sf-back" href="#/" aria-label="${t('Retour aux listes')}">←</a>` : ''}
    <a class="sf-brand with-logo" href="#/">${brandLogo()}<b>${esc(S.F.game)}</b><span>${esc(S.F.name)}</span></a>
    <nav>${S.F.showFullBuilderLink ? `<a href="index.html">${t('Builder complet')}</a>` : ''}<a href="aide.html#shot">${t('Aide')}</a>${feedbackLink('sf-fb-top')}<button id="lang-btn" type="button" lang="${LANG === 'fr' ? 'en' : 'fr'}" title="${LANG === 'fr' ? 'English version' : 'Version française'}">${LANG === 'fr' ? 'EN' : 'FR'}</button><button id="theme-btn" type="button">${t('Thème')}</button></nav>
  </header>`;
}
function bindHeader() {
  document.getElementById('lang-btn')?.addEventListener('click', () => { setLang(LANG === 'fr' ? 'en' : 'fr'); location.reload(); });
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
      <p class="eyebrow">${esc(F.tagline)} · ${esc(t('par {by}', { by: F.by }))}</p>
      <h1>${esc(F.name)}</h1>
      <p class="sf-lead">${t('Des parties courtes, {d}. Un héros, une à quatre escouades, un véhicule : <b>{b} PA</b>, +{h} PA pour le héros en armée de faction ou mercenaire.', { d: esc(F.duration), b: F.budget, h: F.heroBonus })}</p>
    </section>

    <form class="sf-card sf-new" id="new-form">
      <h2>${t('Nouvelle armée')}</h2>
      <div class="sf-blocs">
        ${D.blocs.filter((b) => b.id !== 'Mercenaries' || F.allowMercenaryArmy || F.allowMercenaries).map((b, i) => `<label style="--bc:${esc(b.color)}"><input type="radio" name="bloc" value="${esc(b.id)}" ${i === 0 ? 'checked' : ''}><span class="swatch"></span>${esc(blocName(b.id, D))}</label>`).join('')}
      </div>
      <input type="text" id="new-name" placeholder="${t('Nom (facultatif)')}" maxlength="60" aria-label="${t("Nom de l'armée")}">
      <button class="btn primary" type="submit">${t('Créer')}</button>
    </form>

    <section class="sf-card">
      <h2>${t('Mes armées ({n})', { n: lists.length })}</h2>
      ${lists.length ? `<div class="sf-saved">${lists.map((l) => {
        const r = analyze(l); const b = D.blocsById.get(l.bloc);
        return `<div class="sf-saved-row"><button class="sf-open" data-open="${l.id}"><span class="swatch" style="--bc:${esc(b?.color)}"></span><span><b>${esc(l.name)}</b><small>${esc(blocName(l.bloc, D))} · ${r.A.counted}/${F.budget} ${t('PA')} · ${r.ok ? t('valide') : t('incomplète')}</small></span></button>
          <button class="btn sm danger" data-del="${l.id}" aria-label="${esc(t('Supprimer {n}', { n: l.name }))}">✕</button></div>`;
      }).join('')}</div>` : `<p class="hint" style="margin:0">${t("Aucune armée pour l'instant.")}</p>`}
    </section>

    <details class="sf-card sf-rules">
      <summary>${t('Règles du format')}</summary>
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
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('Supprimer ?'); return; }
    const i = S.lists.findIndex((l) => l.id === b.dataset.del);
    const [rm] = S.lists.splice(i, 1); store.set(LS_KEY, S.lists); renderHome();
    toast(t('« {n} » supprimée', { n: rm.name }), { label: t('Annuler'), run: () => { S.lists.splice(i, 0, rm); store.set(LS_KEY, S.lists); renderHome(); } });
  }));
}

// Bouton « Donner mon avis » (lien réglable dans short-format.json → feedback)
function feedbackLink(cls) {
  const fb = S.F.feedback;
  if (!fb?.url) return '';
  return `<a class="${cls}" href="${esc(fb.url)}" target="_blank" rel="noopener">${esc(fb.label || t('Donner mon avis'))}</a>`;
}
function feedbackCard() {
  const fb = S.F.feedback;
  if (!fb?.url) return '';
  return `<section class="sf-card sf-fb">
      <h2>${t('Version de test')}</h2>
      <p>${esc(fb.intro || '')}</p>
      ${(fb.ask || []).length ? `<ul>${fb.ask.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      <div>${feedbackLink('btn primary')}</div>
    </section>`;
}

function rulesHTML() {
  const F = S.F;
  return `<div class="sf-rules-b">
    <h3>${t('Mise en place')}</h3><ul>${F.settings.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    <h3>${t('Composition')}</h3><ul>
      <li>${t('1 unité de commandement obligatoire : un héros. Il peut rejoindre une escouade de même armure, ou piloter le véhicule si ses compétences le permettent.')}</li>
      <li>${t('1 escouade obligatoire, armure {n} max.', { n: F.combatRequired.maxArmor })}</li>
      <li>${t('0 à {c} escouades supplémentaires, armure {n} max.', { c: F.combatOptional.count, n: F.combatOptional.maxArmor })}</li>
      <li>${t('1 véhicule obligatoire, armure {n} max.', { n: F.vehicle.maxArmor })}</li>
      <li>${t("{b} PA, +{h} PA (10 %) pour le héros si l'armée respecte les règles de faction (livre DUST 1947).", { b: F.budget, h: F.heroBonus })}</li>
      <li>${F.allowMercenaryArmy ? t('Armée Mercenaire jouable, mais pas de mercenaire dans les armées des autres blocs ; pas de véhicule capturé.') : t('Ni mercenaire, ni véhicule capturé.')}</li>
      <li>${esc(t('Interdits : {list}.', { list: [...Object.values(F.bannedSkills || {}), ...(F.bannedHeroes || [])].join(', ') }))}</li>
    </ul>
    <h3>${t('Restrictions')}</h3><ul>${F.reminders.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
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
      <input type="text" id="army-name" value="${esc(L.name)}" maxlength="60" aria-label="${t("Nom de l'armée")}">
      <span class="chip bloc" style="--bc:${esc(bloc?.color)}"><span class="swatch"></span>${esc(blocName(L.bloc, D))}</span>
    </div>

    <section class="sf-sum ${R.ok ? 'ok' : ''}" aria-label="${t('Résumé')}">
      <div class="sf-pa"><b>${R.A.counted}</b><span>/ ${F.budget} ${t('PA')}</span></div>
      <div class="sf-bar"><i class="${R.A.counted > F.budget ? 'over' : ''}" style="width:${pct}%"></i></div>
      <div class="sf-sum-chips">
        <span class="chip ${R.ok ? 'ok' : 'warn'}">${R.ok ? t('Prête à jouer') : t('Incomplète')}</span>
        ${R.A.kind !== 'none' ? `<span class="chip ok">${esc(R.A.kindLabel)}</span>` : ''}
      </div>
      ${R.A.covered || R.A.counted > F.budget ? `<div class="sf-sum-detail">${R.A.covered ? esc(t('{s} dépensés − {b} bonus HQ', { s: R.A.total, b: R.A.covered })) : ''}${R.A.counted > F.budget ? ` <b class="sf-over">${esc(t('{n} PA de trop', { n: R.A.counted - F.budget }))}</b>` : ''}</div>` : ''}
    </section>

    <ol class="sf-tree">
      ${slotHTML('cmd')}
      ${slotHTML('c1')}
      ${optSlots.map(slotHTML).join('')}
      ${slotHTML('veh')}
    </ol>

    <section class="sf-card">
      <h2>${t('Vérification')}</h2>
      <ul class="sf-checks">${R.checks.map((c) => `<li class="${c.ok ? 'ok' : 'bad'}"><b>${c.ok ? '✓' : '✕'}</b><span>${esc(c.msg)}</span></li>`).join('')}</ul>
      ${R.info.map((m) => `<p class="sf-info">${esc(m)}</p>`).join('')}
    </section>

    <div class="sf-actions">
      <button class="btn primary" id="btn-share">${t('Partager')}</button>
      <button class="btn" id="btn-sheet">${t('Fiche de partie')}</button>
      <button class="btn" id="btn-pdf">PDF</button>
      <button class="btn" id="btn-text">${t('Texte')}</button>
      ${feedbackLink('btn')}
    </div>
    <div class="print-sheet" id="print-sheet"></div>
  </main>`;
  bindHeader();
  bindArmy();
}

function slotHTML(slot) {
  const D = S.data, L = S.list;
  const R = slot === 'cmd' ? analyze(L) : null;
  const spec = slotSpec(slot);
  const e = L.slots[slot];
  const u = e?.u ? D.unitsById.get(e.u) : null;
  const icon = slot === 'cmd' ? '★' : slot === 'veh' ? '◆' : '●';
  let extra = '';
  if (u && slot === 'cmd') {
    const targets = SLOTS.filter((s) => s !== 'cmd' && L.slots[s]?.u).map((s) => ({ s, t: D.unitsById.get(L.slots[s].u) }))
      .filter(({ t }) => t && ((t.type === 'infantry' && t.armor === u.armor) || (t.type === 'vehicle' && canPilot(u, t))));
    extra = `<label class="sf-join"><span>${t('Placement')}</span><select data-join aria-label="${t('Rattacher le héros')}">
      <option value="">${t('Seul')}</option>
      ${targets.map(({ s, t: tu }) => `<option value="${s}" ${e.join === s ? 'selected' : ''}>${tu.type === 'vehicle' ? t('Pilote') : t('Rejoint')}${LANG === 'en' ? ':' : ' :'} ${esc(tu.name)}</option>`).join('')}
    </select></label>`;
    if (!targets.length) extra += `<p class="hint" style="margin:0">${t('Aucune escouade de même armure ni véhicule pilotable : le héros joue seul.')}</p>`;
  }
  return `<li class="sf-slot ${spec.required ? 'req' : 'opt'} ${u ? 'filled' : ''}" data-slot="${slot}">
    <div class="sf-slot-h"><span class="sf-ico" aria-hidden="true">${icon}</span>
      <div><b>${esc(spec.label)}</b><small>${spec.required ? t('Obligatoire') : t('Facultative')} · ${esc(spec.hint)}</small></div></div>
    ${u ? `<div class="sf-unit">
        <button class="sf-unit-n${thumb(u.id) ? ' wt' : ''}" data-card="${esc(u.id)}">${thumb(u.id, 44)}<b>${esc(u.name)}</b><small>${esc(u.subtitle || typeLabel(u.type))}${u.armor ? ' · ' + t('Armure {n}', { n: u.armor }) : ''}${u.faction ? ' · ' + esc(factionName(u.faction, D)) : ''}</small></button>
        <span class="sf-cost">${esc(costLabel(u, slot, R))}${slot === 'cmd' && hqBonus(R) ? `<small>${esc(t('bonus −{n}', { n: hqBonus(R) }))}</small>` : ''}</span>
        <button class="btn sm" data-pick="${slot}">${t('Changer')}</button>
        <button class="btn sm icon danger" data-clear="${slot}" aria-label="${t('Retirer')}">✕</button>
      </div>${extra}`
      : `<button class="btn sf-add" data-pick="${slot}">${t('+ Choisir')}</button>`}
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
    const cu = S.data.unitsById.get(b.dataset.card);
    openUnitCard(cu, S.data, { cost: unitCost(cu) });
  }));
  document.getElementById('btn-share').addEventListener('click', share);
  document.getElementById('btn-text').addEventListener('click', () => {
    const txt = listText();
    openModal(`<div class="modal-h"><div><div class="eyebrow">${t('Export')}</div><h2>${t('Liste en texte')}</h2></div><button class="btn icon" data-close-btn aria-label="${t('Fermer')}">✕</button></div>
      <div class="modal-b"><textarea class="export-box" id="exp" readonly>${esc(txt)}</textarea><div><button class="btn primary" id="cp">${t('Copier')}</button></div></div>`,
    (root) => root.querySelector('#cp').addEventListener('click', () => copyText(txt, root.querySelector('#exp'))));
  });
  document.getElementById('btn-pdf').addEventListener('click', openPdf);
  document.getElementById('btn-sheet').addEventListener('click', () => {
    document.getElementById('print-sheet').innerHTML = sheetHTML();
    window.print();
  });
}

// Garde les escouades facultatives groupées (c2, c3, c4) sans trou
// Retire les unités qui n'existent plus dans la base (unité supprimée ou corrigée), pour ne pas bloquer l'affichage
function dropUnknown(L) {
  if (!L?.slots) return;
  let changed = false;
  for (const s of Object.keys(L.slots)) if (L.slots[s]?.u && !S.data.unitsById.has(L.slots[s].u)) { delete L.slots[s]; changed = true; }
  if (L.slots.cmd?.join && !L.slots[L.slots.cmd.join]) { delete L.slots.cmd.join; changed = true; }
  if (changed) { const keep = S.list; S.list = L; compactOptional(); S.list = keep; }
}
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
  const all = allowedFor(slot, L.bloc);
  // Tri de la liste : ordre alphabétique (par défaut) ou coût en points ; le choix est mémorisé
  const SORT_KEY = 'dust1947.shotSort';
  let sortBy = store.get(SORT_KEY, 'az') === 'cost' ? 'cost' : 'az';
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  const sorter = () => (sortBy === 'cost' ? (a, b) => unitCost(a) - unitCost(b) || byName(a, b) : byName);
  const R = analyze(L);
  const current = L.slots[slot]?.u ? unitCost(D.unitsById.get(L.slots[slot].u)) : 0;
  const left = S.F.budget + (slot === 'cmd' ? S.F.heroBonus : 0) - (R.A.counted - current);
  // Filtre de sous-faction : mémorisé par armée ; par défaut, la faction déjà présente dans l'armée
  const factions = (D.blocsById.get(L.bloc)?.factions || []).filter((f) => all.some((u) => u.faction === f.id));
  if (L.fac === undefined) L.fac = R.A.factions.length === 1 ? R.A.factions[0] : 'all';
  if (L.fac !== 'all' && L.fac !== 'none' && !factions.some((f) => f.id === L.fac)) L.fac = 'all';
  const chips = [['all', t('Toutes')], ['none', t('Bloc')], ...factions.map((f) => [f.id, f.name])];
  const count = (k) => all.filter((u) => k === 'all' || (k === 'none' ? !u.faction : u.faction === k)).length;
  let q = '';
  const row = (u) => `<div class="sf-pick-row"><button class="sf-pick${thumb(u.id) ? ' wt' : ''}" data-u="${esc(u.id)}">
      ${thumb(u.id, 44)}<span><b>${esc(u.name)}</b><small>${esc(u.subtitle || typeLabel(u.type))}${u.armor ? ' · ' + t('Arm. {n}', { n: u.armor }) : ''}${u.faction ? ' · ' + esc(factionName(u.faction, D)) : ''}</small></span>
      <span class="sf-cost ${unitCost(u) > left ? 'over' : ''}">${unitCost(u)}</span></button>
      <button type="button" class="sf-unit-info" data-info="${esc(u.id)}" title="${t('Voir la fiche')}" aria-label="${esc(t('Voir la fiche : {name}', { name: u.name }))}">i</button></div>`;
  const listHTML = () => {
    const shown = all.filter((u) => (L.fac === 'all' || (L.fac === 'none' ? !u.faction : u.faction === L.fac))
      && (!q || (u.name + ' ' + u.subtitle).toLowerCase().includes(q)));
    return shown.sort(sorter()).map(row).join('') || `<p class="hint">${all.length ? t('Aucune unité ne correspond à ce filtre.') : t('Aucune unité autorisée pour ce poste dans ce bloc.')}</p>`;
  };
  openModal(`<div id="pk-main"><div class="modal-h"><div><div class="eyebrow">${esc(blocName(L.bloc, D))} · ${esc(spec.hint)}</div><h2>${esc(spec.label)}</h2>
      <p>${t('Il vous reste environ {n} PA', { n: left })}${slot === 'cmd' ? t(' (bonus héros compris)') : ''}.</p></div>
      <button class="btn icon" data-close-btn aria-label="${t('Fermer')}">✕</button></div>
    <div class="modal-b">
      <div class="sf-fac sf-sort" role="group" aria-label="${t('Trier la liste')}"><span class="sf-sort-l">${t('Trier par')}</span>${[['az', t('Ordre alphabétique')], ['cost', t('Coût en points')]].map(([k, l]) => `<button type="button" data-sort="${k}" class="${sortBy === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${factions.length ? `<div class="sf-fac" role="group" aria-label="${t('Filtrer par sous-faction')}">${chips.map(([k, l]) => `<button type="button" data-fac="${esc(k)}" class="${L.fac === k ? 'on' : ''}" ${count(k) ? '' : 'disabled'}>${esc(l)} <small>${count(k)}</small></button>`).join('')}</div>` : ''}
      <input type="search" id="pk-q" placeholder="${t('Rechercher')}" aria-label="${t('Rechercher une unité')}">
      <div class="sf-pick-list" id="pk-list">${listHTML()}</div>
    </div></div><div id="pk-card" hidden></div>`, (root, close) => {
    const list = root.querySelector('#pk-list');
    const main = root.querySelector('#pk-main'), card = root.querySelector('#pk-card'), box = root.querySelector('.modal');
    const choose = (id) => { L.slots[slot] = { u: id }; compactOptional(); save(); close(); renderArmy(); };
    // Fiche de l'unité affichée dans la même fenêtre : le retour conserve le filtre, la recherche et la position
    let scrollPos = 0;
    const showCard = (id) => {
      const u = D.unitsById.get(id); if (!u) return;
      scrollPos = box.scrollTop;
      card.innerHTML = unitCardHTML(u, D, { cost: unitCost(u), topHTML: `<div class="sf-card-bar"><button type="button" class="btn" data-back>${t('← Retour à la liste')}</button><button type="button" class="btn primary" data-choose>${t('Choisir cette unité ({n} PA)', { n: unitCost(u) })}</button></div>` });
      card.querySelector('[data-back]').addEventListener('click', () => { card.hidden = true; card.innerHTML = ''; main.hidden = false; box.scrollTop = scrollPos; });
      card.querySelector('[data-choose]').addEventListener('click', () => choose(id));
      main.hidden = true; card.hidden = false; box.scrollTop = 0;
      card.querySelector('[data-back]').focus();
    };
    const bind = () => {
      list.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', () => choose(b.dataset.u)));
      list.querySelectorAll('[data-info]').forEach((b) => b.addEventListener('click', () => showCard(b.dataset.info)));
    };
    const refresh = () => { list.innerHTML = listHTML(); bind(); };
    bind();
    root.querySelectorAll('[data-fac]').forEach((b) => b.addEventListener('click', () => {
      L.fac = b.dataset.fac; save();
      root.querySelectorAll('[data-fac]').forEach((x) => x.classList.toggle('on', x === b));
      refresh();
    }));
    root.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => {
      sortBy = b.dataset.sort; store.set(SORT_KEY, sortBy);
      root.querySelectorAll('[data-sort]').forEach((x) => x.classList.toggle('on', x === b));
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
    dropUnknown(S.list);
    save(); history.replaceState(null, '', '#/' + S.list.id); toast(t('« {n} » importée', { n: c.n })); renderArmy();
  } catch {
    toast(t('Lien de liste invalide.')); history.replaceState(null, '', '#/'); renderHome();
  }
}
function share() {
  const url = location.href.split('#')[0] + '#s=' + encode(S.list);
  openModal(`<div class="modal-h"><div><div class="eyebrow">${t('Partager')}</div><h2>${t("Lien de l'armée")}</h2><p>${t('Votre adversaire reçoit une copie de votre armée.')}</p></div><button class="btn icon" data-close-btn aria-label="${t('Fermer')}">✕</button></div>
    <div class="modal-b"><textarea class="export-box share-url" id="su" readonly style="min-height:100px">${esc(url)}</textarea><div><button class="btn primary" id="cu">${t('Copier le lien')}</button></div></div>`,
  (root) => root.querySelector('#cu').addEventListener('click', () => copyText(url, root.querySelector('#su'))));
}

function listText() {
  const D = S.data, F = S.F, L = S.list, R = analyze(L);
  const out = [`${L.name}`, `${F.game} · ${F.name} · ${blocName(L.bloc, D)} · ${R.A.counted} / ${F.budget} ${t('PA')}${R.A.covered ? t(' ({s} dépensés, −{b} bonus HQ)', { s: R.A.total, b: R.A.covered }) : ''}`, ''];
  for (const s of SLOTS) {
    const u = D.unitsById.get(L.slots[s]?.u);
    if (!u) continue;
    let tail = '';
    if (s === 'cmd' && L.slots.cmd.join) { const tu = D.unitsById.get(L.slots[L.slots.cmd.join]?.u); if (tu) tail = ` [${tu.type === 'vehicle' ? t('pilote') : t('rejoint')} ${tu.name}]`; }
    out.push(`${slotSpec(s).short}${LANG === 'en' ? ':' : ' :'} ${u.name} (${costLabel(u, s, R)})${tail}`);
  }
  if (!R.ok) out.push('', t('À compléter : ') + R.checks.filter((c) => !c.ok).map((c) => c.msg).join(' ; '));
  return out.join('\n');
}

// Export PDF : récapitulatif + cartes des unités choisies
function openPdf() {
  const D = S.data, F = S.F, L = S.list, R = analyze(L);
  const filled = SLOTS.filter((s) => D.unitsById.get(L.slots[s]?.u));
  const cards = filled.map((s) => { const u = D.unitsById.get(L.slots[s].u); const a = artOf(u, D); return { u, D, cost: unitCost(u), photo: a.photo, focus: a.focus, credit: a.credit }; });
  openModal(pdfDialogHTML(cards.length), (root) => bindPdfDialog(root, ({ includeCards, format }, onProgress) => {
    const rows = filled.map((s) => {
      const u = D.unitsById.get(L.slots[s].u);
      const stats = [`${t('Arm')} ${u.armor ?? '-'}`, `${t('Santé')} ${u.health ?? '-'}`, `${t('Mv')} ${u.move ?? '-'}/${u.march ?? '-'}`];
      return { name: `${slotSpec(s).short} — ${u.name}`, cost: `${costLabel(u, s, R)} ${t('PA')}`, detail: [stats.join(' · '), (u.skills || []).join(', ')].filter(Boolean).join(' · ') };
    });
    const recap = {
      title: L.name,
      lines: [`${F.game} · ${F.name} · ${blocName(L.bloc, D)}`, `${R.A.counted} / ${F.budget} ${t('PA')}${R.A.covered ? t(' ({s} dépensés, −{b} bonus HQ)', { s: R.A.total, b: R.A.covered }) : ''}`],
      sections: [{ title: t('Unités'), rows }],
      notes: [...F.settings, ...F.reminders], notesTitle: t('Rappels'),
    };
    const slugName = String(L.name || 'liste').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'liste';
    return exportListPDF({ filename: `${slugName}.pdf`, recap, cards, includeCards, format, onProgress });
  }));
}

function sheetHTML() {
  const D = S.data, F = S.F, L = S.list, R = analyze(L);
  const card = (s) => {
    const u = D.unitsById.get(L.slots[s]?.u);
    if (!u) return '';
    const ws = u.weapons || [];
    return `<div class="pu"><b>${esc(slotSpec(s).short)} — ${esc(u.name)}</b> · ${esc(costLabel(u, s, R))} ${t('PA')} · Arm ${esc(u.armor ?? '-')} · ${esc(t('Santé {n}', { n: u.health ?? '-' }))} · Mv ${esc(u.move ?? '-')}/${esc(u.march ?? '-')}
      ${(u.skills || []).length ? `<div><i>${u.skills.map(esc).join(', ')}</i></div>` : ''}
      ${ws.length ? `<table><tr><th>${t('Arme')}</th><th>${t('Nb')}</th><th>${t('Portée')}</th><th>Inf 1-4</th><th>${LANG === 'en' ? 'Veh' : 'Véh'} 1-7</th></tr>${ws.map((w) => `<tr><td class="wn">${esc(w.name)}${(w.specials || []).length ? ' (' + w.specials.map(esc).join(', ') + ')' : ''}</td><td>${esc(w.count ?? '')}</td><td>${esc(w.range ?? '')}</td><td>${(w.vsInfantry || []).map(attackHtml).join(' ')}</td><td>${(w.vsVehicle || []).map(attackHtml).join(' ')}</td></tr>`).join('')}</table>` : ''}</div>`;
  };
  return `<h1>${esc(L.name)}</h1><p>${esc(F.game)} · ${esc(F.name)} · ${esc(blocName(L.bloc, D))} · ${R.A.counted} / ${F.budget} ${t('PA')}${R.A.covered ? t(' ({s} dépensés, −{b} bonus HQ)', { s: R.A.total, b: R.A.covered }) : ''}</p>
    ${SLOTS.map(card).join('')}
    <h3>${t('Rappels')}</h3><ul>${[...F.settings, ...F.reminders].map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    ${printCredit()}`;
}
