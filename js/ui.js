// Petits utilitaires d'interface partagés (constructeur + éditeur)
import { TYPE_LABELS } from './data.js';

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
    toast('Copié dans le presse-papiers');
  } catch {
    if (fallbackEl) { fallbackEl.focus(); fallbackEl.select?.(); }
    toast('Copie refusée par le navigateur : le texte est sélectionné, faites Ctrl+C.');
  }
}

// Symboles de dés dans les descriptions ("dice_block", "dice_sight", "dice_shield")
const DICE = { dice_block: ['■', 'Face « bloc »'], dice_sight: ['◎', 'Face « viseur »'], dice_shield: ['⛨', 'Face « bouclier »'] };
export function richText(s) {
  return esc(s).replace(/dice_(block|sight|shield)/g, (m) => `<span class="die" title="${DICE[m][1]}">${DICE[m][0]}</span>`);
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
    out += `<td class="v${v ? '' : ' nil'}${i === 0 ? ' grp' : ''}">${v ? esc(v) : '–'}</td>`;
  }
  return out;
}

export function unitCardHTML(u, data, { cost, captured, extraChips = '', topHTML = '' } = {}) {
  const bloc = data.blocsById.get(u.bloc);
  const fac = u.faction ? data.factionsById.get(u.faction) : null;
  const ws = u.weapons || [];
  const nI = Math.max(0, ...ws.map((w) => w.vsInfantry?.length || 0));
  const nV = Math.max(0, ...ws.map((w) => w.vsVehicle?.length || 0));
  const nA = Math.max(0, ...ws.map((w) => w.vsAircraft?.length || 0));
  const head = (n, label) => n ? `<th colspan="${n}" class="grp">${label}</th>` : '';
  const sub = (n) => Array.from({ length: n }, (_, i) => `<th${i === 0 ? ' class="grp"' : ''}>${i + 1}</th>`).join('');
  const skills = [
    ...(u.skills || []).map((s) => ({ name: s, description: data.skills[s] || '' })),
    ...(u.customSkills || []),
  ];
  const wSpecials = [...new Set(ws.flatMap((w) => w.specials || []))];
  const shownCost = cost ?? u.cost;
  return `
  <div class="modal-h">
    <div>
      <div class="eyebrow">${esc(TYPE_LABELS[u.type] || u.type)} · ${esc(bloc?.name || u.bloc)}${fac ? ' · ' + esc(fac.name) : ''}</div>
      <h2>${esc(u.name)}</h2>
      ${u.subtitle ? `<p>${esc(u.subtitle)}</p>` : ''}
      <div class="tags">${captured ? '<span class="tag cap">Capturé (+2)</span>' : ''}${u.capturable && !captured ? '<span class="tag">Capturable</span>' : ''}${extraChips}</div>
    </div>
    <button class="btn icon" data-close-btn aria-label="Fermer">✕</button>
  </div>
  <div class="modal-b">
    ${topHTML}
    <div class="statline">
      <div class="stat cost"><span>Points</span><b>${esc(shownCost ?? '–')}</b></div>
      <div class="stat"><span>Armure</span><b>${esc(u.armor ?? '–')}</b></div>
      <div class="stat"><span>Santé</span><b>${esc(u.health ?? '–')}</b></div>
      <div class="stat"><span>Mouv.</span><b>${esc(u.move ?? '–')}</b></div>
      <div class="stat"><span>Marche</span><b>${esc(u.march ?? '–')}</b></div>
    </div>
    ${ws.length ? `
    <div>
      <div class="eyebrow" style="margin-bottom:6px">Armes</div>
      <div class="wtable-wrap"><table class="wt">
        <thead>
          <tr><th rowspan="2" style="text-align:left">Arme</th><th rowspan="2">Nb</th><th rowspan="2">Portée</th>${head(nI, 'vs Infanterie')}${head(nV, 'vs Véhicule')}${head(nA, 'vs Aéronef')}</tr>
          <tr>${sub(nI)}${sub(nV)}${sub(nA)}</tr>
        </thead>
        <tbody>
        ${ws.map((w) => `<tr>
          <td class="wn">${esc(w.name)}${w.mount ? ` <span class="sp">· ${esc(w.mount)}</span>` : ''}${w.ammo ? ` <span class="sp">· munitions ${esc(w.ammo)}</span>` : ''}${(w.specials || []).length ? `<br><span class="sp">${w.specials.map(esc).join(', ')}</span>` : ''}</td>
          <td class="v">${esc(w.count ?? '')}</td><td class="v">${esc(w.range ?? '')}</td>
          ${attackCells(w.vsInfantry || [], nI)}${attackCells(w.vsVehicle || [], nV)}${attackCells(w.vsAircraft || [], nA)}
        </tr>`).join('')}
        </tbody>
      </table></div>
      <p class="legend">Chaque case indique <b>dés / dommages</b> contre la classe d'armure correspondante (1 à 4 pour l'infanterie, 1 à 7 pour les véhicules). « B », « BB », « DB » : attaques à gabarit (zone), voir le livre de règles.</p>
    </div>` : ''}
    ${skills.length || wSpecials.length ? `
    <div>
      <div class="eyebrow" style="margin-bottom:6px">Compétences</div>
      <div class="skills">
        ${skills.map((s) => `<div class="skill"><b>${esc(s.name)}</b>${s.description ? `<p>${richText(s.description)}</p>` : '<p>Description absente de la base (voir le livre de règles).</p>'}</div>`).join('')}
        ${wSpecials.map((s) => `<div class="skill"><b>${esc(s)}</b> <span class="tag">règle d'arme</span>${data.skills[s] ? `<p>${richText(data.skills[s])}</p>` : '<p>Règle d\'arme spéciale : voir « Armes spéciales » dans le livre de règles.</p>'}</div>`).join('')}
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
