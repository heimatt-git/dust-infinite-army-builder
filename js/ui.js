// Petits utilitaires d'interface partagés (constructeur + éditeur)
import { typeLabel } from './data.js';
import { t, LANG } from './i18n.js';
import { diceSvg, diceTitle, attackHtml } from './dice.js';

// Signature de l'auteur du site (logo + crédit)
export const LOGO = 'img/logo-loir.png';
export const brandLogo = () => `<img class="brand-logo" src="${LOGO}" alt="" width="34" height="34">`;
export const creditLine = () => t("Créé par L'Heure du Loir");
export function mountCredit() {
  if (document.querySelector('.site-credit')) return;
  const f = document.createElement('footer');
  f.className = 'site-credit';
  f.innerHTML = `<img src="${LOGO}" alt="" width="40" height="40"><span>${esc(creditLine())}</span>`;
  const anchor = document.getElementById('modal-root');
  if (anchor) anchor.before(f); else document.body.append(f);
}
export const printCredit = () => `<div class="print-credit"><img src="${LOGO}" alt="" width="30" height="30"><span>DUST 194∞ · ${esc(creditLine())}</span></div>`;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const uid = () => Math.random().toString(36).slice(2, 8);

export const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
};

let toastTimer;
export function toast(msg, action) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = esc(msg) + (action ? ` <button class="btn sm" style="margin-left:10px" id="toast-act">${esc(action.label)}</button>` : '');
  t.hidden = false;
  if (action) t.querySelector('#toast-act').onclick = () => { t.hidden = true; action.run(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, action ? 6000 : 2600);
}

export async function copyText(text, fallbackEl) {
  try {
    await navigator.clipboard.writeText(text);
    toast(t('Copié dans le presse-papiers'));
  } catch {
    if (fallbackEl) { fallbackEl.focus(); fallbackEl.select?.(); }
    toast(t('Copie refusée par le navigateur : le texte est sélectionné, faites Ctrl+C.'));
  }
}

// Symboles de dés dans les descriptions ("dice_block", "dice_sight", "dice_shield")
// bloc : bloc de l'unité affichée (la face « bloc » porte l'emblème de ce bloc)
export function richText(s, bloc) {
  return esc(s).replace(/dice_(block|sight|shield)/g, (m) => `<span class="die" role="img" aria-label="${esc(t(diceTitle(m)))}" title="${esc(t(diceTitle(m)))}">${diceSvg(m, bloc)}</span>`);
}

export function openModal(html, onMount) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-back" data-close="1"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const back = root.firstElementChild;
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', (e) => { if (e.target.dataset.close || e.target.closest('[data-close-btn]')) close(); });
  back.querySelector('button, input, select, textarea')?.focus();
  onMount?.(back, close);
  return close;
}

function attackCells(arr, n) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const v = arr[i];
    out += `<td class="v${v ? '' : ' nil'}${i === 0 ? ' grp' : ''}">${v ? attackHtml(v) : '–'}</td>`;
  }
  return out;
}

export function unitCardHTML(u, data, { cost, captured, extraChips = '', topHTML = '' } = {}) {
  const bloc = data.blocsById.get(u.bloc);
  const blocLabel = (LANG === 'en' ? bloc?.nameEn : bloc?.name) || u.bloc;
  const fac = u.faction ? data.factionsById.get(u.faction) : null;
  const ws = u.weapons || [];
  const nI = Math.max(0, ...ws.map((w) => w.vsInfantry?.length || 0));
  const nV = Math.max(0, ...ws.map((w) => w.vsVehicle?.length || 0));
  const nA = Math.max(0, ...ws.map((w) => w.vsAircraft?.length || 0));
  const head = (n, label) => n ? `<th colspan="${n}" class="grp">${label}</th>` : '';
  const sub = (n) => Array.from({ length: n }, (_, i) => `<th${i === 0 ? ' class="grp"' : ''}>${i + 1}</th>`).join('');
  const skills = [
    ...(u.skills || []).filter((s) => !(u.customSkills || []).some((c) => c.name === s)).map((s) => ({ name: s, description: data.skills[s] || '' })),
    ...(u.customSkills || []),
  ];
  const wSpecials = [...new Set(ws.flatMap((w) => w.specials || []))];
  const shownCost = cost ?? u.cost;
  return `
  <div class="modal-h">
    <div>
      <div class="eyebrow">${esc(typeLabel(u.type))} · ${esc(blocLabel)}${fac ? ' · ' + esc(fac.name) : ''}</div>
      <h2>${esc(u.name)}</h2>
      ${u.subtitle ? `<p>${esc(u.subtitle)}</p>` : ''}
      ${u.confidential && u.author ? `<p class="conf-credit">${esc(t('Création : {a}', { a: u.author }))}</p>` : ''}
      <div class="tags">${u.confidential ? `<span class="tag conf" title="${esc(t('Création de la communauté, non officielle'))}">CONFIDENTIAL</span>` : ''}${captured ? `<span class="tag cap">${t('Capturé (+2)')}</span>` : ''}${u.capturable && !captured ? `<span class="tag">${t('Capturable')}</span>` : ''}${extraChips}</div>
    </div>
    <button class="btn icon" data-close-btn aria-label="${t('Fermer')}">✕</button>
  </div>
  <div class="modal-b">
    ${topHTML}
    <div class="statline">
      <div class="stat cost"><span>${t('Points')}</span><b>${esc(shownCost ?? '–')}</b></div>
      <div class="stat"><span>${t('Armure')}</span><b>${esc(u.armor ?? '–')}</b></div>
      <div class="stat"><span>${t('Santé')}</span><b>${esc(u.health ?? '–')}</b></div>
      <div class="stat"><span>${t('Mouv.')}</span><b>${esc(u.move ?? '–')}</b></div>
      <div class="stat"><span>${t('Marche')}</span><b>${esc(u.march ?? '–')}</b></div>
    </div>
    ${ws.length ? `
    <div>
      <div class="eyebrow" style="margin-bottom:6px">${t('Armes')}</div>
      <div class="wtable-wrap"><table class="wt">
        <thead>
          <tr><th rowspan="2" style="text-align:left">${t('Arme')}</th><th rowspan="2">${t('Nb')}</th><th rowspan="2">${t('Portée')}</th>${head(nI, t('vs Infanterie'))}${head(nV, t('vs Véhicule'))}${head(nA, t('vs Aéronef'))}</tr>
          <tr>${sub(nI)}${sub(nV)}${sub(nA)}</tr>
        </thead>
        <tbody>
        ${ws.map((w) => `<tr>
          <td class="wn">${esc(w.name)}${w.mount ? ` <span class="sp">· ${esc(w.mount)}</span>` : ''}${w.ammo ? ` <span class="sp">· ${esc(t('munitions {n}', { n: w.ammo }))}</span>` : ''}${(w.specials || []).length ? `<br><span class="sp">${w.specials.map(esc).join(', ')}</span>` : ''}</td>
          <td class="v">${esc(w.count ?? '')}</td><td class="v">${esc(w.range ?? '')}</td>
          ${attackCells(w.vsInfantry || [], nI)}${attackCells(w.vsVehicle || [], nV)}${attackCells(w.vsAircraft || [], nA)}
        </tr>`).join('')}
        </tbody>
      </table></div>
      <p class="legend">${t("Chaque case indique <b>dés / dommages</b> contre la classe d'armure correspondante (1 à 4 pour l'infanterie, 1 à 7 pour les véhicules). « B », « BB », « DB » : attaques à gabarit (zone), voir le livre de règles.")}</p>
    </div>` : ''}
    ${skills.length || wSpecials.length ? `
    <div>
      <div class="eyebrow" style="margin-bottom:6px">${t('Compétences')}</div>
      <div class="skills">
        ${skills.map((s) => `<div class="skill"><b>${esc(s.name)}</b>${s.description ? `<p>${richText(s.description, u.bloc)}</p>` : `<p>${t('Description absente de la base (voir le livre de règles).')}</p>`}</div>`).join('')}
        ${wSpecials.map((s) => `<div class="skill"><b>${esc(s)}</b> <span class="tag">${t("règle d'arme")}</span>${data.skills[s] ? `<p>${richText(data.skills[s], u.bloc)}</p>` : `<p>${t("Règle d'arme spéciale : voir « Armes spéciales » dans le livre de règles.")}</p>`}</div>`).join('')}
      </div>
    </div>` : ''}
  </div>`;
}

// Dépôt GitHub du site, deviné depuis l'adresse (pseudo.github.io/depot)
export function guessRepo() {
  const m = location.hostname.match(/^([\w-]+)\.github\.io$/);
  if (!m) return {};
  const repo = location.pathname.split('/').filter(Boolean)[0];
  return { owner: m[1], repo: repo && !repo.endsWith('.html') ? repo : `${m[1]}.github.io` };
}
