// Éditeur privé, onglet « Propositions » : importer les fichiers de l'Atelier CONFIDENTIAL,
// les examiner élément par élément (accepter, retoucher, refuser), puis publier data/custom.json.
import { indexData, withCustom, typeLabel } from './data.js';
import { validateCustom } from './validate.js';
import { esc, toast, openModal, unitCardHTML, copyText } from './ui.js';
import { generatedCardSVG, cardFontsReady } from './cardgen.js';
import { t, LANG } from './i18n.js';

const FORMAT = 'dust194-confidential';
const PHOTO_LICENSE = 'Atelier CONFIDENTIAL';
let X; // contexte de l'éditeur : { E, saveDraft, render, clone, slug, unitForm, bindUnitForm }
export function initProposals(ctx) { X = ctx; }

// ---------------------------------------------------------------- Stockage des images (IndexedDB)
// Photos jointes aux propositions et photos en attente de publication : elles restent dans ce navigateur.
function idb(mode, fn) {
  return new Promise((res, rej) => {
    const r = indexedDB.open('dust1947-editor', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('blobs');
    r.onerror = () => rej(r.error);
    r.onsuccess = () => {
      const tx = r.result.transaction('blobs', mode);
      const q = fn(tx.objectStore('blobs'));
      tx.oncomplete = () => { r.result.close(); res(q?.result); };
      tx.onerror = () => { r.result.close(); rej(tx.error); };
    };
  });
}
export const blobs = {
  get: (k) => idb('readonly', (s) => s.get(k)),
  set: (k, v) => idb('readwrite', (s) => s.put(v, k)),
  del: (k) => idb('readwrite', (s) => s.delete(k)),
};

// ---------------------------------------------------------------- Outils
export const emptyCustom = () => ({ meta: {}, blocs: [], factions: [], units: [], platoons: [], skills: {} });
export function normCustom(c) {
  const e = emptyCustom();
  if (!c || typeof c !== 'object') return e;
  return { ...e, ...c, blocs: c.blocs || [], factions: c.factions || [], units: c.units || [], platoons: c.platoons || [], skills: c.skills || {} };
}
const today = () => new Date().toISOString().slice(0, 10);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const KIND = { unit: 'Unité', faction: 'Faction', bloc: 'Bloc inédit' };
const propKey = (sub, it) => `prop:${sub.key}:${it.kind}:${it.id}`;
const photoURLs = new Map(); // clé IndexedDB → URL d'aperçu

function offIndex() { const d = X.E.d; return indexData(d.unitsFile, d.blocsFile, d.skills, d.photos); }
const isOffBloc = (id) => X.E.d.blocsFile.blocs.some((b) => b.id === id);
const isOffFaction = (id) => X.E.d.blocsFile.blocs.some((b) => (b.factions || []).some((f) => f.id === id));

// Recherche dans le brouillon de custom.json
function findRec(c, kind, id) {
  if (kind === 'unit') return c.units.find((u) => u.id === id) || null;
  if (kind === 'bloc') return c.blocs.find((b) => b.id === id) || null;
  const f = c.factions.find((x) => x.id === id);
  if (f) return f;
  for (const b of c.blocs) { const g = (b.factions || []).find((x) => x.id === id); if (g) return { ...g, bloc: b.id }; }
  return null;
}
function removeRec(c, kind, id) {
  if (kind === 'unit') c.units = c.units.filter((u) => u.id !== id);
  else if (kind === 'bloc') c.blocs = c.blocs.filter((b) => b.id !== id);
  else { c.factions = c.factions.filter((f) => f.id !== id); for (const b of c.blocs) b.factions = (b.factions || []).filter((f) => f.id !== id); }
}
function putRec(c, kind, rec) {
  if (kind === 'unit') { const i = c.units.findIndex((u) => u.id === rec.id); if (i >= 0) c.units[i] = rec; else c.units.push(rec); return; }
  if (kind === 'bloc') {
    const i = c.blocs.findIndex((b) => b.id === rec.id);
    if (i >= 0) c.blocs[i] = { ...rec, factions: c.blocs[i].factions || [] }; else c.blocs.push({ ...rec, factions: [] });
    return;
  }
  removeRec(c, 'faction', rec.id);
  const nb = c.blocs.find((b) => b.id === rec.bloc);
  if (nb) nb.factions.push({ id: rec.id, name: rec.name, author: rec.author });
  else c.factions.push({ bloc: rec.bloc, id: rec.id, name: rec.name, author: rec.author });
}
// Base CONFIDENTIAL du brouillon + éléments non refusés d'un dossier (aperçu des cartes et vérifications)
function withSub(sub) {
  const c = X.clone(X.E.d.custom);
  for (const it of sub.items) {
    if (it.status === 'refused' || it.status === 'accepted') continue;
    putRec(c, it.kind, { ...it.data, author: it.data.author || sub.author });
  }
  return c;
}
function depsOf(sub, it) {
  const out = [];
  const need = (kind, id) => {
    if (!id) return;
    if (kind === 'bloc' && isOffBloc(id)) return;
    if (kind === 'faction' && isOffFaction(id)) return;
    const dep = sub.items.find((x) => x.kind === kind && x.id === id);
    if (dep && !out.includes(dep)) { out.push(dep); if (kind === 'faction') need('bloc', dep.data.bloc); }
  };
  if (it.kind === 'unit') { need('faction', it.data.faction); need('bloc', it.data.bloc); }
  if (it.kind === 'faction') need('bloc', it.data.bloc);
  return out;
}

// ---------------------------------------------------------------- Import
export async function importFiles(files) {
  const E = X.E;
  let added = 0;
  for (const f of files) {
    let data;
    try { data = JSON.parse(await f.text()); } catch { toast(t('{f} : fichier illisible.', { f: f.name })); continue; }
    if (data?.format !== FORMAT || !Array.isArray(data.units)) { toast(t("{f} n'est pas un fichier de l'Atelier CONFIDENTIAL.", { f: f.name })); continue; }
    if (E.d.props.some((s) => s.exported === data.exported && s.author === data.author && s.project === data.project)) { toast(t('{f} est déjà importé.', { f: f.name })); continue; }
    const sub = { key: `${X.slug(data.project || 'projet') || 'projet'}-${Date.now().toString(36)}`, file: f.name, author: String(data.author || '').trim(), project: String(data.project || '').trim(), exported: data.exported || '', imported: today(), items: [] };
    const item = (kind, d) => ({ kind, id: d.id, data: d, orig: JSON.stringify(d), status: 'pending', reason: '', edited: false });
    for (const b of data.blocs || []) {
      const { factions, ...rest } = b;
      sub.items.push(item('bloc', rest));
      for (const fa of factions || []) sub.items.push(item('faction', { bloc: b.id, ...fa }));
    }
    for (const fa of data.factions || []) sub.items.push(item('faction', fa));
    for (const u of data.units) {
      const { photo, ...rest } = u;
      const it = item('unit', rest);
      if (typeof photo === 'string' && photo.startsWith('data:image/')) {
        try { await blobs.set(propKey(sub, it), await (await fetch(photo)).blob()); it.hasPhoto = true; } catch { /* photo illisible ignorée */ }
      }
      sub.items.push(it);
    }
    E.d.props.unshift(sub);
    added++;
  }
  if (added) { X.saveDraft(); X.render(); toast(t('{n} dossier(s) importé(s)', { n: added })); }
}

// ---------------------------------------------------------------- Décisions
async function accept(sub, it, silent) {
  const E = X.E;
  for (const dep of depsOf(sub, it)) {
    if (dep.status === 'refused') { toast(t('Impossible : « {n} » dépend de « {d} », qui est refusé.', { n: it.data.name, d: dep.data.name })); return false; }
    if (dep.status !== 'accepted' && !(await accept(sub, dep, true))) return false;
  }
  const rec = { ...X.clone(it.data), author: it.data.author || sub.author || null };
  if (it.kind === 'unit') rec.approved = today();
  const prev = findRec(E.d.custom, it.kind, it.id);
  it.prev = prev ? JSON.stringify(prev) : null;
  putRec(E.d.custom, it.kind, rec);
  if (it.kind === 'unit' && it.hasPhoto && !it.photoPath) {
    const blob = await blobs.get(propKey(sub, it)).catch(() => null);
    if (blob) {
      const base = `photos/${it.id}-${X.slug(rec.author || 'photo') || 'photo'}`;
      const ext = ({ 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[blob.type] || 'jpg';
      let path = `${base}.${ext}`, k = 2;
      const taken = (p) => Object.values(E.d.photos).flat().some((x) => x.file === p) || E.pending.has(p);
      while (taken(path)) path = `${base}-${k++}.${ext}`;
      E.pending.set(path, blob);
      await blobs.set('pending:' + path, blob).catch(() => {});
      (E.d.photos[it.id] ||= []).push({ file: path, author: rec.author || '', license: PHOTO_LICENSE, added: today() });
      it.photoPath = path;
    }
  }
  it.status = 'accepted';
  X.saveDraft();
  if (!silent) { X.render(); toast(t('« {n} » accepté', { n: it.data.name })); }
  return true;
}
// Annule une décision (retour « en attente ») ; refusé si d'autres éléments acceptés en dépendent
function undo(sub, it, silent) {
  const E = X.E;
  if (it.status === 'accepted') {
    const users = usersOf(E.d.custom, it.kind, it.id);
    if (users.length) { toast(t('Impossible : utilisé par {list}. Annulez-les d\'abord.', { list: users.join(', ') })); return false; }
    removeRec(E.d.custom, it.kind, it.id);
    if (it.prev) putRec(E.d.custom, it.kind, JSON.parse(it.prev));
    if (it.photoPath) {
      const arr = (E.d.photos[it.id] || []).filter((p) => p.file !== it.photoPath);
      if (arr.length) E.d.photos[it.id] = arr; else delete E.d.photos[it.id];
      E.pending.delete(it.photoPath); blobs.del('pending:' + it.photoPath).catch(() => {});
      delete it.photoPath;
    }
  }
  it.status = 'pending'; it.reason = ''; delete it.prev;
  X.saveDraft();
  if (!silent) X.render();
  return true;
}
function usersOf(c, kind, id) {
  if (kind === 'unit') return [];
  const out = c.units.filter((u) => (kind === 'faction' ? u.faction === id : u.bloc === id)).map((u) => u.name);
  if (kind === 'bloc') out.push(...c.factions.filter((f) => f.bloc === id).map((f) => f.name), ...(c.blocs.find((b) => b.id === id)?.factions || []).map((f) => f.name));
  return out;
}

// ---------------------------------------------------------------- Différences (mise à jour d'une création publiée)
function diffLines(kind, a, b) {
  const out = [];
  const show = (v) => (v === null || v === undefined || v === '' ? '–' : Array.isArray(v) ? (v.join(', ') || '–') : String(v));
  const fields = kind === 'unit'
    ? [['name', t('Nom')], ['subtitle', t('Sous-titre')], ['type', t('Type')], ['faction', t('Faction')], ['cost', t('Points')], ['health', t('Santé')], ['move', t('Mouvement')], ['march', t('Marche')], ['armor', t('Armure')], ['skills', t('Compétences')]]
    : kind === 'bloc' ? [['name', t('Nom')], ['color', t('Couleur')]] : [['name', t('Nom')], ['bloc', t('Bloc')]];
  for (const [k, l] of fields) if (!same(a[k] ?? null, b[k] ?? null)) out.push(`${l}${LANG === 'en' ? ':' : ' :'} ${show(a[k])} → ${show(b[k])}`);
  if (kind === 'unit') {
    if (!same(a.customSkills || [], b.customSkills || [])) out.push(t("Compétences propres à l'unité modifiées"));
    const wa = a.weapons || [], wb = b.weapons || [];
    const names = [...new Set([...wa, ...wb].map((w) => w.name))];
    for (const n of names) {
      const x = wa.find((w) => w.name === n), y = wb.find((w) => w.name === n);
      if (!x) out.push(t('Arme ajoutée : {n}', { n }));
      else if (!y) out.push(t('Arme retirée : {n}', { n }));
      else if (!same(x, y)) out.push(t('Arme modifiée : {n}', { n }));
    }
  }
  return out;
}

// ---------------------------------------------------------------- Message pour Discord
function discordText(sub) {
  const c = LANG === 'en' ? ':' : ' :';
  const nm = (it) => (it.kind === 'unit' ? it.data.name : `${t(KIND[it.kind]).toLowerCase()} ${it.data.name}`);
  const acc = sub.items.filter((i) => i.status === 'accepted' && !i.edited).map(nm);
  const ed = sub.items.filter((i) => i.status === 'accepted' && i.edited).map(nm);
  const ref = sub.items.filter((i) => i.status === 'refused').map((i) => nm(i) + (i.reason ? ` (${t('motif')}${c} ${i.reason})` : ''));
  const wait = sub.items.filter((i) => i.status === 'pending').map(nm);
  const lines = [`**${t('Propositions CONFIDENTIAL')}${c} ${sub.project || t('sans nom')} (${sub.author || '?'})**`];
  if (acc.length) lines.push(`✅ ${t('Accepté')}${c} ${acc.join(', ')}`);
  if (ed.length) lines.push(`✏️ ${t('Accepté avec retouches')}${c} ${ed.join(', ')}`);
  if (ref.length) lines.push(`❌ ${t('Refusé')}${c} ${ref.join(' ; ')}`);
  if (wait.length) lines.push(`⏳ ${t('En attente')}${c} ${wait.join(', ')}`);
  if (acc.length + ed.length) lines.push(t('Les créations acceptées seront visibles sur le site à la prochaine publication.'));
  return lines.join('\n');
}

// ---------------------------------------------------------------- Rendu
const STATUS = {
  pending: ['', 'En attente'], accepted: ['ok', 'Accepté'], refused: ['bad', 'Refusé'],
};
export function pendingCount() { return (X.E.d.props || []).reduce((n, s) => n + s.items.filter((i) => i.status === 'pending').length, 0); }

export function renderProposals(body) {
  const E = X.E;
  const subs = E.d.props;
  const off = offIndex();
  const base = validateCustom(E.d.custom, E.d.unitsFile, E.d.blocsFile, E.d.skills);
  const baseMsgs = new Set([...base.errors, ...base.warnings]);
  const missing = [];

  const itemHTML = (sub, it, D, v) => {
    const pub = findRec(E.orig.custom, it.kind, it.id);
    const isUpdate = !!pub;
    const [cls, lab] = STATUS[it.status];
    const ref = it.data.name || it.id;
    const msgs = (arr) => arr.filter((m) => !baseMsgs.has(m) && (m.includes(it.id) || m.includes(`« ${ref} »`) || m.includes(ref)));
    const errs = msgs(v.errors), warns = msgs(v.warnings);
    const diffs = isUpdate ? diffLines(it.kind, pub, it.data) : [];
    let visual = '';
    if (it.kind === 'unit') {
      const u = D.unitsById.get(it.id);
      const key = propKey(sub, it);
      if (it.hasPhoto && !photoURLs.has(key)) missing.push(key);
      visual = u ? `<button type="button" class="gcard-wrap pr-card" data-prview="${esc(sub.key)}|${esc(it.id)}" title="${t('Voir la fiche')}">${generatedCardSVG(u, D, { photo: photoURLs.get(key) || null })}</button>` : '';
    } else {
      visual = `<div class="pr-chip" style="--c:${esc(it.kind === 'bloc' ? it.data.color || '#777' : (D.blocsById.get(it.data.bloc)?.color || '#777'))}"><b>${esc(it.data.name)}</b><small>${esc(t(KIND[it.kind]))}</small></div>`;
    }
    const where = it.kind === 'unit'
      ? `${esc(D.blocsById.get(it.data.bloc)?.name || it.data.bloc)}${it.data.faction ? ' · ' + esc(D.factionsById.get(it.data.faction)?.name || it.data.faction) : ''} · ${esc(typeLabel(it.data.type))} · ${esc(it.data.cost)} ${t('pts')}`
      : it.kind === 'faction' ? esc(D.blocsById.get(it.data.bloc)?.name || it.data.bloc) : '';
    const editing = E.propEdit === `${sub.key}|${it.id}`;
    return `<div class="pr-item ${cls}" id="pr-${esc(sub.key)}-${esc(it.id)}">
      <div class="pr-vis">${visual}</div>
      <div class="pr-main">
        <div class="pr-title"><b>${esc(ref)}</b>
          <span class="pr-badge">${esc(t(KIND[it.kind]))}</span>
          <span class="pr-badge ${isUpdate ? 'upd' : 'new'}">${isUpdate ? t('Mise à jour') : t('Nouveau')}</span>
          <span class="pr-badge st ${cls}">${t(lab)}</span>
          ${it.edited ? `<span class="pr-badge upd">${t('Retouchée')}</span>` : ''}
          ${it.hasPhoto ? `<span class="pr-badge">${t('Photo jointe')}</span>` : ''}</div>
        ${where ? `<div class="hint">${where}</div>` : ''}
        <div class="idline">${esc(it.id)}</div>
        ${diffs.length ? `<ul class="pr-diff">${diffs.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : isUpdate ? `<p class="hint" style="margin:0">${t('Identique à la version en ligne.')}</p>` : ''}
        ${it.status === 'refused' && it.reason ? `<p class="hint" style="margin:0">${t('Motif')} : ${esc(it.reason)}</p>` : ''}
        ${it.status === 'pending' ? `<div class="issues">${errs.map((m) => `<div class="issue bad"><b>✕</b><span>${esc(m)}</span></div>`).join('')}${warns.map((m) => `<div class="issue warn"><b>!</b><span>${esc(m)}</span></div>`).join('')}</div>` : ''}
        <div class="pr-acts">
          ${it.status === 'pending' ? `
            <button type="button" class="btn sm primary" data-pracc="${esc(sub.key)}|${esc(it.id)}|${it.kind}" ${errs.length ? `disabled title="${t('Corrigez les erreurs (Retoucher) avant d\'accepter.')}"` : ''}>${t('Accepter')}</button>
            ${it.kind === 'unit' ? `<button type="button" class="btn sm" data-predit="${esc(sub.key)}|${esc(it.id)}">${editing ? t('Fermer la retouche') : t('Retoucher')}</button>` : ''}
            <input type="text" class="pr-reason" id="rs-${esc(sub.key)}-${esc(it.id)}-${it.kind}" maxlength="140" placeholder="${t('Motif du refus (facultatif)')}">
            <button type="button" class="btn sm danger" data-prref="${esc(sub.key)}|${esc(it.id)}|${it.kind}">${t('Refuser')}</button>`
          : `<button type="button" class="btn sm" data-prundo="${esc(sub.key)}|${esc(it.id)}|${it.kind}">${t('Annuler la décision')}</button>`}
        </div>
      </div>
      ${editing ? `<div class="pr-edit">${X.unitForm(it.data, { blocs: D.blocs, prop: true })}</div>` : ''}
    </div>`;
  };

  const subHTML = (sub) => {
    const c = withSub(sub);
    const D = withCustom(off, c);
    const v = validateCustom(c, E.d.unitsFile, E.d.blocsFile, E.d.skills);
    const n = (s) => sub.items.filter((i) => i.status === s).length;
    const order = { bloc: 0, faction: 1, unit: 2 };
    const items = [...sub.items].sort((a, b) => order[a.kind] - order[b.kind]);
    return `<details class="ed-sec pr-sub" ${n('pending') || E.propOpen === sub.key ? 'open' : ''} data-sub="${esc(sub.key)}">
      <summary><h2>${esc(sub.project || t('Projet sans nom'))} · ${esc(sub.author || '?')}</h2>
        <span class="hint">${t('{a} accepté(s) · {r} refusé(s) · {p} en attente', { a: n('accepted'), r: n('refused'), p: n('pending') })}</span></summary>
      <p class="hint" style="margin:0">${t('Fichier {f}, exporté le {d}, importé le {i}.', { f: esc(sub.file), d: esc(String(sub.exported).slice(0, 10) || '?'), i: esc(sub.imported) })}</p>
      ${items.map((it) => itemHTML(sub, it, D, v)).join('')}
      <div class="pr-discord">
        <label class="field"><span>${t('Message pour Discord ({c})', { c: '#confidential-units' })}</span>
        <textarea rows="5" readonly id="dc-${esc(sub.key)}">${esc(discordText(sub))}</textarea></label>
        <div class="pr-acts"><button type="button" class="btn sm" data-prcopy="${esc(sub.key)}">${t('Copier le message')}</button>
        <span class="spacer"></span>
        <button type="button" class="btn sm danger" data-prdrop="${esc(sub.key)}">${t('Retirer ce dossier de la liste')}</button></div>
      </div>
    </details>`;
  };

  const c = E.d.custom;
  const onlineRows = [
    ...c.blocs.map((b) => ({ kind: 'bloc', id: b.id, name: b.name, info: t('Bloc inédit'), author: b.author })),
    ...c.blocs.flatMap((b) => (b.factions || []).map((f) => ({ kind: 'faction', id: f.id, name: f.name, info: `${t('Faction')} · ${b.name}`, author: f.author }))),
    ...c.factions.map((f) => ({ kind: 'faction', id: f.id, name: f.name, info: `${t('Faction')} · ${off.blocsById.get(f.bloc)?.name || f.bloc}`, author: f.author })),
    ...c.units.map((u) => ({ kind: 'unit', id: u.id, name: u.name, info: `${t('Unité')} · ${u.bloc} · ${u.cost} ${t('pts')}${u.approved ? ' · ' + t('validée le {d}', { d: u.approved }) : ''}`, author: u.author })),
  ];
  const isNew = (r) => !findRec(E.orig.custom, r.kind, r.id);

  body.innerHTML = `<div class="ed-form">
    <div class="ed-sec">
      <h2>${t('Importer des propositions')}</h2>
      <p class="hint" style="margin:0">${t('Téléchargez les fichiers <code>confidential-….json</code> postés sur le Discord, puis importez-les ici (plusieurs à la fois si besoin). Chaque unité, faction ou bloc s\'accepte ou se refuse séparément ; rien n\'est en ligne avant l\'onglet Publier.')}</p>
      <div><label class="btn primary">${t('Importer des fichiers')}<input type="file" id="pr-import" accept=".json,application/json" multiple hidden></label></div>
    </div>
    ${subs.length ? subs.map(subHTML).join('') : `<div class="ed-sec"><p class="hint" style="margin:0">${t('Aucune proposition importée pour le moment.')}</p></div>`}
    <div class="ed-sec">
      <h2>${t('Créations CONFIDENTIAL ({n})', { n: onlineRows.length })}</h2>
      <p class="hint" style="margin:0">${t('Ce qui sera en ligne après publication. « Retirer » enlève la création du site à la prochaine publication.')}</p>
      ${onlineRows.length ? `<div class="pr-online">${onlineRows.map((r) => `<div class="pr-row">
        <div><b>${esc(r.name)}</b> ${isNew(r) ? `<span class="pr-badge new">${t('À publier')}</span>` : ''}<div class="hint">${esc(r.info)}${r.author ? ' · ' + esc(r.author) : ''}</div></div>
        <button type="button" class="btn sm danger" data-prrm="${r.kind}|${esc(r.id)}">${t('Retirer')}</button></div>`).join('')}</div>`
      : `<p class="hint" style="margin:0">${t('Aucune création CONFIDENTIAL.')}</p>`}
    </div>
  </div>`;

  // Photos jointes : chargées depuis le navigateur puis affichées
  if (missing.length) {
    Promise.all(missing.map(async (k) => { const b = await blobs.get(k).catch(() => null); photoURLs.set(k, b ? URL.createObjectURL(b) : null); }))
      .then(() => { if (X.E.tab === 'proposals') X.render(); });
  }
  cardFontsReady().then(() => { if (!E.fontsOk) { E.fontsOk = true; if (X.E.tab === 'proposals') X.render(); } });

  const find = (key, id, kind) => { const sub = subs.find((s) => s.key === key); return [sub, sub?.items.find((i) => i.id === id && (!kind || i.kind === kind))]; };
  const keep = (sub) => { E.propOpen = sub.key; };
  body.querySelector('#pr-import').addEventListener('change', (e) => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) importFiles(fs); });
  body.querySelectorAll('details.pr-sub').forEach((d) => d.addEventListener('toggle', () => { if (d.open) E.propOpen = d.dataset.sub; }));
  body.querySelectorAll('[data-pracc]').forEach((b) => b.addEventListener('click', () => {
    const [sub, it] = find(...b.dataset.pracc.split('|')); if (!it) return;
    keep(sub); if (E.propEdit === `${sub.key}|${it.id}`) E.propEdit = null;
    accept(sub, it);
  }));
  body.querySelectorAll('[data-prref]').forEach((b) => b.addEventListener('click', () => {
    const [key, id, kind] = b.dataset.prref.split('|');
    const [sub, it] = find(key, id, kind); if (!it) return;
    const users = sub.items.filter((x) => x.status === 'accepted' && depsOf(sub, x).includes(it));
    if (users.length) { toast(t('Impossible : « {n} » est nécessaire à {list}, déjà accepté(s).', { n: it.data.name, list: users.map((x) => x.data.name).join(', ') })); return; }
    it.reason = (document.getElementById(`rs-${key}-${id}-${kind}`)?.value || '').trim();
    it.status = 'refused'; keep(sub);
    if (E.propEdit === `${sub.key}|${it.id}`) E.propEdit = null;
    X.saveDraft(); X.render();
  }));
  body.querySelectorAll('[data-prundo]').forEach((b) => b.addEventListener('click', () => {
    const [sub, it] = find(...b.dataset.prundo.split('|')); if (!it) return;
    keep(sub); undo(sub, it);
  }));
  body.querySelectorAll('[data-predit]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.predit; const [sub] = find(...k.split('|'));
    keep(sub); E.propEdit = E.propEdit === k ? null : k; X.render();
    if (E.propEdit) document.getElementById(`pr-${k.replace('|', '-')}`)?.scrollIntoView({ block: 'start' });
  }));
  body.querySelectorAll('[data-prview]').forEach((b) => b.addEventListener('click', () => {
    const [key, id] = b.dataset.prview.split('|');
    const [sub, it] = find(key, id, 'unit'); if (!it) return;
    const D = withCustom(off, withSub(sub));
    const u = D.unitsById.get(id);
    const card = `<div class="gcard-box"><button type="button" class="gcard-wrap" data-zoomc>${generatedCardSVG(u, D, { photo: photoURLs.get(propKey(sub, it)) || null })}</button></div>`;
    openModal(unitCardHTML(u, D, { topHTML: card }), (root) => root.querySelectorAll('[data-zoomc]').forEach((z) => z.addEventListener('click', () => z.classList.toggle('zoomed'))));
  }));
  body.querySelectorAll('[data-prcopy]').forEach((b) => b.addEventListener('click', () => {
    const ta = document.getElementById(`dc-${b.dataset.prcopy}`); copyText(ta.value, ta);
  }));
  body.querySelectorAll('[data-prdrop]').forEach((b) => b.addEventListener('click', () => {
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('Confirmer : retirer le dossier'); return; }
    const sub = subs.find((s) => s.key === b.dataset.prdrop);
    // Les décisions déjà prises restent dans le brouillon ; seul le dossier disparaît de la liste
    for (const it of sub.items) if (it.hasPhoto && it.status !== 'accepted') blobs.del(propKey(sub, it)).catch(() => {});
    E.d.props = subs.filter((s) => s !== sub);
    X.saveDraft(); X.render();
  }));
  body.querySelectorAll('[data-prrm]').forEach((b) => b.addEventListener('click', () => {
    const [kind, id] = b.dataset.prrm.split('|');
    const users = usersOf(E.d.custom, kind, id);
    if (users.length) { toast(t('Impossible : utilisé par {list}. Retirez-les d\'abord.', { list: users.join(', ') })); return; }
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('Confirmer le retrait'); return; }
    removeRec(E.d.custom, kind, id);
    if (kind === 'unit' && E.d.photos[id]) {
      for (const p of E.d.photos[id]) { E.pending.delete(p.file); blobs.del('pending:' + p.file).catch(() => {}); }
      delete E.d.photos[id];
    }
    // Une proposition acceptée puis retirée redevient « en attente »
    for (const s of subs) for (const it of s.items) if (it.kind === kind && it.id === id && it.status === 'accepted') { it.status = 'pending'; delete it.prev; delete it.photoPath; }
    X.saveDraft(); X.render(); toast(t('Retiré du brouillon'));
  }));

  // Retouche d'une unité proposée (même formulaire que l'éditeur)
  if (E.propEdit) {
    const [sub, it] = find(...E.propEdit.split('|'));
    const wrap = it && body.querySelector(`#pr-${CSS.escape(sub.key)}-${CSS.escape(it.id)} .pr-edit`);
    if (wrap) {
      const D = withCustom(off, withSub(sub));
      X.bindUnitForm(wrap, it.data, {
        blocs: D.blocs, prop: true,
        onChange: () => { it.edited = it.orig !== JSON.stringify(it.data); },
        onDone: () => { E.propEdit = null; X.render(); },
        preview: () => {
          const D2 = withCustom(off, withSub(sub));
          const u = D2.unitsById.get(it.id);
          openModal(unitCardHTML(u, D2, { topHTML: `<div class="gcard-box"><div class="gcard-wrap zoomed">${generatedCardSVG(u, D2, { photo: photoURLs.get(propKey(sub, it)) || null })}</div></div>` }));
        },
      });
    }
  }
}

