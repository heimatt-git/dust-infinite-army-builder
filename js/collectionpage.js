// Page « Ma collection » du builder : liste des figurines possédées, ajout, export / import JSON.
import { esc, toast, openModal } from './ui.js';
import { t, LANG } from './i18n.js';
import { typeLabel } from './data.js';
import { blocName, factionName } from './rules.js';
import * as C from './collection.js';

const TYPE_ORDER = ['hero', 'infantry', 'vehicle', 'aircraft', 'token'];
const V = { view: 'owned', bloc: 'Allies', type: 'all', q: '', conf: false, listId: '' };
const dateStr = (ts) => new Date(ts).toLocaleDateString(LANG === 'en' ? 'en-GB' : 'fr-FR');

// ctx : { S, app, topbar, bindTopbar, thumb } fournis par app.js
export function renderCollectionPage(ctx) {
  const { S, app } = ctx;
  const hasCustom = S.all !== S.official;
  const DA = hasCustom ? S.all : S.official;                 // unités possédées : tout ce qui existe
  const DB = V.conf && hasCustom ? S.all : S.official;       // unités proposées à l'ajout
  if (!DB.blocsById.has(V.bloc) && V.bloc !== 'all') V.bloc = 'Allies';
  const lists = [...S.lists].sort((a, b) => (b.updated || 0) - (a.updated || 0));
  const canShare = (() => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'c.json', { type: 'application/json' })] })); } catch { return false; } })();

  app.innerHTML = `${ctx.topbar('collection')}
  <main class="wrap col-page">
    <section class="home-hero">
      <div class="eyebrow">${t('Outil communautaire · base {v}', { v: esc(S.official.meta.version || '') })}</div>
      <h1 class="h-display">${t('Ma collection')}</h1>
      <p>${t("Notez les figurines que vous possédez. Dans une liste d'armée, activez « Ma collection » pour ne voir que vos unités et être averti quand une liste en demande plus que vous n'en avez. L'avertissement ne bloque jamais une liste. Tout reste dans votre navigateur : exportez un fichier pour la sauvegarder ou la retrouver sur un autre appareil.")}</p>
    </section>
    <section class="panel col-top">
      <div class="col-stats" id="col-stats"></div>
      <div class="col-acts">
        <button class="btn primary" id="col-export">${t('Exporter (fichier JSON)')}</button>
        ${canShare ? `<button class="btn" id="col-share">${t('Partager…')}</button>` : ''}
        <label class="btn">${t('Importer un fichier')}<input type="file" id="col-import" accept=".json,application/json" hidden></label>
      </div>
      <div id="col-backup"></div>
      ${lists.length ? `<div class="col-fromlist">
        <label class="field"><span>${t("Ajouter les unités d'une liste")}</span>
          <select id="col-list">${lists.map((l) => `<option value="${esc(l.id)}" ${V.listId === l.id ? 'selected' : ''}>${esc(l.name)} · ${t('{n} unités', { n: l.entries.length })}</option>`).join('')}</select></label>
        <button class="btn" id="col-addlist">${t('Ajouter à ma collection')}</button>
        <p class="hint" style="margin:0;grid-column:1/-1">${t("Pour chaque unité, la collection prend le nombre d'exemplaires de la liste s'il est plus grand que le vôtre. Rien n'est jamais retiré.")}</p>
      </div>` : ''}
    </section>
    <div class="col-views" role="tablist">
      <button role="tab" class="btn ${V.view === 'owned' ? 'on' : ''}" data-view="owned" id="view-owned"></button>
      <button role="tab" class="btn ${V.view === 'add' ? 'on' : ''}" data-view="add">${t('Ajouter des unités')}</button>
    </div>
    <section class="panel col-body-wrap">
      <div class="col-filters" id="col-filters">
        ${V.view === 'add' ? `
          <div class="filters">
            <select id="col-bloc" aria-label="${t('Bloc')}">
              <option value="all" ${V.bloc === 'all' ? 'selected' : ''}>${t('Tous les blocs')}</option>
              ${DB.blocs.map((b) => `<option value="${esc(b.id)}" ${V.bloc === b.id ? 'selected' : ''}>${esc(blocName(b.id, DB))}${b.confidential ? ' · CONFIDENTIAL' : ''}</option>`).join('')}
            </select>
            <input type="search" id="col-q" placeholder="${t('Rechercher (nom, compétence…)')}" value="${esc(V.q)}">
          </div>
          <div class="typebar">${[['all', t('Tous')], ...TYPE_ORDER.map((ty) => [ty, typeLabel(ty)])].map(([k, l]) => `<button data-type="${k}" class="${V.type === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          ${hasCustom ? `<label class="check"><input type="checkbox" id="col-conf" ${V.conf ? 'checked' : ''}> <b class="conf-stamp">CONFIDENTIAL</b> ${t('Proposer aussi les unités custom')}</label>` : ''}`
        : `<input type="search" id="col-q" class="full" placeholder="${t('Rechercher dans ma collection')}" value="${esc(V.q)}">`}
      </div>
      <div id="col-body"></div>
    </section>
  </main>`;
  ctx.bindTopbar();

  const $ = (id) => document.getElementById(id);
  const unitTags = (u, D) => [
    u.faction ? `<span class="tag fac">${esc(factionName(u.faction, D))}</span>` : '',
    u.confidential ? '<span class="tag conf">CONFIDENTIAL</span>' : '',
    u.armor ? `<span class="tag">${t('Arm. {n}', { n: esc(u.armor) })}</span>` : '',
  ].join('');
  const row = (u, D) => {
    const q = C.getQty(u.id);
    return `<div class="urow col-row ${q ? '' : 'zero'}" data-row="${esc(u.id)}">
      <div class="nm${ctx.thumb(u.id) ? ' wt' : ''}" data-card="${esc(u.id)}" tabindex="0" role="button" aria-label="${esc(t('Voir la carte {n}', { n: u.name }))}">${ctx.thumb(u.id)}<b>${esc(u.name)}</b>${u.subtitle ? `<small>${esc(u.subtitle)}</small>` : ''}<div class="tags">${unitTags(u, D)}</div></div>
      <div class="qty" role="group" aria-label="${esc(t('Exemplaires de {n}', { n: u.name }))}">
        <button class="btn icon" data-qd="${esc(u.id)}" aria-label="${esc(t('Retirer un exemplaire de {n}', { n: u.name }))}" ${q ? '' : 'disabled'}>−</button>
        <input type="number" class="qty-in" min="0" max="${C.MAX_QTY}" value="${q}" data-qi="${esc(u.id)}" aria-label="${esc(t('Exemplaires de {n}', { n: u.name }))}">
        <button class="btn icon primary" data-qa="${esc(u.id)}" aria-label="${esc(t('Ajouter un exemplaire de {n}', { n: u.name }))}">+</button>
      </div>
    </div>`;
  };
  const matches = (u) => {
    if (!V.q) return true;
    return (u.name + ' ' + (u.subtitle || '') + ' ' + (u.skills || []).join(' ')).toLowerCase().includes(V.q.toLowerCase());
  };
  const byType = (arr) => TYPE_ORDER.map((ty) => [typeLabel(ty), arr.filter((u) => u.type === ty)]).filter(([, a]) => a.length);

  function stats() {
    const n = C.totalCount(), d = C.distinctCount();
    $('col-stats').innerHTML = `<div><b class="num">${n}</b><small>${t(n > 1 ? 'figurines' : 'figurine')}</small></div><div><b class="num">${d}</b><small>${t(d > 1 ? 'unités différentes' : 'unité différente')}</small></div>`;
    $('view-owned').textContent = t('Ce que je possède ({n})', { n: d });
    const { updated, exported } = C.collectionDates();
    $('col-backup').innerHTML = !C.hasCollection() ? ''
      : C.needsBackup()
        ? `<div class="issue warn"><b>!</b><span>${exported ? t('Dernière sauvegarde : {d}.', { d: dateStr(exported) }) : t('Pas encore sauvegardée.')} ${t("Vos modifications ne sont pas exportées : un navigateur peut vider ses données, surtout sur téléphone. Pensez à exporter votre collection.")}</span></div>`
        : `<div class="issue info"><b>✓</b><span>${t('Dernière sauvegarde : {d}.', { d: dateStr(exported || updated) })}</span></div>`;
  }

  function body() {
    let html = '';
    if (V.view === 'owned') {
      const ids = C.ownedIds();
      const known = ids.map((id) => DA.unitsById.get(id)).filter(Boolean);
      const unknown = ids.length - known.length;
      const shown = known.filter(matches);
      const groups = DA.blocs.map((b) => [blocName(b.id, DA), shown.filter((u) => u.bloc === b.id)]).filter(([, a]) => a.length);
      html = groups.length
        ? groups.map(([g, arr]) => `<div class="cat-group">${esc(g)} · ${arr.reduce((s, u) => s + C.getQty(u.id), 0)}</div>${byType(arr).map(([ty, a]) => `<div class="col-type">${esc(ty)}</div>${a.map((u) => row(u, DA)).join('')}`).join('')}`).join('')
        : (ids.length && V.q) ? `<p class="empty">${t('Aucune unité ne correspond.')}</p>`
          : `<p class="empty">${t("Votre collection est vide. Ouvrez l'onglet « Ajouter des unités », ou importez un fichier de sauvegarde.")}</p>`;
      if (unknown) html += `<p class="hint">${t("{n} unité(s) de votre collection n'existent plus dans la base actuelle : elles sont conservées mais masquées.", { n: unknown })}</p>`;
    } else {
      let pool = DB.units;
      if (V.bloc !== 'all') pool = pool.filter((u) => u.bloc === V.bloc);
      if (V.type !== 'all') pool = pool.filter((u) => u.type === V.type);
      pool = pool.filter(matches);
      if (V.bloc === 'all' && V.q.trim().length < 2) {
        html = `<p class="empty">${t('Choisissez un bloc, ou tapez le nom d\'une unité pour la chercher dans tous les blocs.')}</p>`;
      } else if (!pool.length) {
        html = `<p class="empty">${t('Aucune unité ne correspond.')}</p>`;
      } else if (V.bloc === 'all') {
        html = DB.blocs.map((b) => [blocName(b.id, DB), pool.filter((u) => u.bloc === b.id)]).filter(([, a]) => a.length)
          .map(([g, arr]) => `<div class="cat-group">${esc(g)} · ${arr.length}</div>${arr.map((u) => row(u, DB)).join('')}`).join('');
      } else {
        html = byType(pool).map(([ty, a]) => `<div class="cat-group">${esc(ty)} · ${a.length}</div>${a.map((u) => row(u, DB)).join('')}`).join('');
      }
    }
    $('col-body').innerHTML = html;
  }

  // Met à jour une ligne sans redessiner la liste (garde la position de défilement et le focus)
  const touch = (id) => {
    const r = document.querySelector(`[data-row="${CSS.escape(id)}"]`);
    if (!r) return;
    const q = C.getQty(id);
    r.classList.toggle('zero', !q);
    r.querySelector('[data-qd]').disabled = !q;
    const inp = r.querySelector('[data-qi]'); if (inp && document.activeElement !== inp) inp.value = q;
    if (inp && document.activeElement === inp && +inp.value !== q) inp.value = q;
    stats();
  };
  const set = (id, n) => {
    const first = !C.hasCollection();
    if (!C.setQty(id, n)) toast(t('Sauvegarde locale indisponible (navigation privée ?) : exportez votre collection pour la garder.'));
    if (first && C.hasCollection()) C.requestPersist();
    touch(id);
  };
  $('col-body').addEventListener('click', (e) => {
    const a = e.target.closest('[data-qa]'), d = e.target.closest('[data-qd]');
    if (a) set(a.dataset.qa, C.getQty(a.dataset.qa) + 1);
    else if (d) set(d.dataset.qd, C.getQty(d.dataset.qd) - 1);
  });
  const openCard = (el) => { const u = DA.unitsById.get(el.dataset.card); if (u) ctx.openCard(u); };
  $('col-body').addEventListener('click', (e) => { const n = e.target.closest('[data-card]'); if (n) openCard(n); });
  $('col-body').addEventListener('keydown', (e) => { const n = e.target.closest('[data-card]'); if (n && (e.key === 'Enter' || e.key === ' ') && e.target === n) { e.preventDefault(); openCard(n); } });
  $('col-body').addEventListener('change', (e) => {
    const i = e.target.closest('[data-qi]');
    if (i) set(i.dataset.qi, i.value);
  });

  app.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { V.view = b.dataset.view; V.q = ''; renderCollectionPage(ctx); }));
  app.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
    V.type = b.dataset.type;
    app.querySelectorAll('[data-type]').forEach((x) => x.classList.toggle('on', x === b));
    body();
  }));
  $('col-bloc')?.addEventListener('change', (e) => { V.bloc = e.target.value; body(); });
  $('col-conf')?.addEventListener('change', (e) => { V.conf = e.target.checked; renderCollectionPage(ctx); });
  $('col-q').addEventListener('input', (e) => { V.q = e.target.value; body(); });
  $('col-list')?.addEventListener('change', (e) => { V.listId = e.target.value; });

  $('col-addlist')?.addEventListener('click', () => {
    const l = S.lists.find((x) => x.id === $('col-list').value);
    if (!l) return;
    const first = !C.hasCollection();
    const n = C.addFromList(l);
    if (first && C.hasCollection()) C.requestPersist();
    toast(n ? t('{n} unité(s) ajoutée(s) ou mises à jour dans votre collection.', { n }) : t('Votre collection contient déjà tout ce que cette liste utilise.'));
    renderCollectionPage(ctx);
  });

  // ---- Export
  const names = () => { const o = {}; for (const id of C.ownedIds()) { const u = DA.unitsById.get(id); if (u) o[id] = u.name; } return o; };
  $('col-export').addEventListener('click', () => {
    if (!C.hasCollection()) return toast(t('Votre collection est vide.'));
    const blob = new Blob([C.exportText(names())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = C.exportFileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    C.markExported(); stats();
    toast(t('Collection exportée : gardez ce fichier précieusement.'));
  });
  $('col-share')?.addEventListener('click', async () => {
    if (!C.hasCollection()) return toast(t('Votre collection est vide.'));
    const file = new File([C.exportText(names())], C.exportFileName(), { type: 'application/json' });
    try { await navigator.share({ files: [file], title: t('Ma collection DUST 194∞') }); C.markExported(); stats(); }
    catch (e) { if (e?.name !== 'AbortError') toast(t("Le partage n'est pas disponible : utilisez « Exporter ».")); }
  });

  // ---- Import
  $('col-import').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const r = C.parseImport(await f.text().catch(() => ''), new Set(DA.units.map((u) => u.id)));
    if (r.error) return toast(t("Ce fichier n'est pas une collection DUST 194∞ valide."));
    const ids = Object.keys(r.units);
    if (!ids.length) return toast(t('Aucune unité reconnue dans ce fichier.'));
    const fresh = ids.filter((id) => !C.getQty(id)).length;
    const done = (mode) => {
      C.applyImport(r.units, mode); C.requestPersist();
      toast(t('Collection importée : {n} unité(s).', { n: ids.length }) + (r.ignored.length ? ' ' + t('{n} inconnue(s) ignorée(s).', { n: r.ignored.length }) : ''));
      renderCollectionPage(ctx);
    };
    if (!C.hasCollection()) return done('replace');
    openModal(`<div class="modal-h"><div><div class="eyebrow">${t('Importer')}</div><h2>${t('Importer une collection')}</h2></div><button class="btn icon" data-close-btn aria-label="${t('Fermer')}">✕</button></div>
      <div class="modal-b" style="display:grid;gap:12px">
        <p style="margin:0">${t('Le fichier contient {n} unité(s) dont {k} que vous n\'avez pas encore.', { n: ids.length, k: fresh })}${r.ignored.length ? ' ' + t('{n} inconnue(s) seront ignorées.', { n: r.ignored.length }) : ''}</p>
        <div style="display:grid;gap:8px">
          <button class="btn primary" data-mode="merge">${t('Fusionner')}</button>
          <p class="hint" style="margin:0">${t('Garde le plus grand nombre d\'exemplaires pour chaque unité. Rien n\'est retiré.')}</p>
          <button class="btn danger" data-mode="replace">${t('Remplacer ma collection')}</button>
          <p class="hint" style="margin:0">${t('Votre collection actuelle est remplacée par celle du fichier.')}</p>
          <button class="btn" data-close-btn>${t('Annuler')}</button>
        </div>
      </div>`, (root, close) => root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { close(); done(b.dataset.mode); })));
  });

  stats();
  body();
}
