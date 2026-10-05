// Réglage du cadrage d'une photo (éditeur privé et Atelier) : on fait glisser la photo dans une zone
// de la forme de la zone photo de la carte, et on règle le zoom. Rien n'est coupé : on enregistre
// { x, y, zoom, ar } (point de visée, zoom, proportions de l'image) utilisé par la carte générée.
import { photoPlacement } from './cardgen.js';
import { t } from './i18n.js';

export const PHOTO_BOX = { w: 466, h: 430 }; // proportions habituelles de la zone photo de la carte

// box : proportions de la zone de cadrage (par défaut, la zone photo habituelle de la carte)
export function framingHTML(box = PHOTO_BOX) {
  return `<div class="framing">
    <div class="fr-box" style="aspect-ratio:${box.w} / ${box.h}" title="${t('Faites glisser la photo pour la cadrer')}"><img alt="" draggable="false"></div>
    <div class="fr-ctl">
      <label class="field"><span>${t('Zoom')}</span><input type="range" class="fr-zoom" min="100" max="250" step="5"></label>
      <button type="button" class="btn sm fr-reset">${t('Recentrer')}</button>
    </div>
    <p class="hint" style="margin:0">${t('Faites glisser la photo pour choisir ce qui reste visible sur la carte.')}</p>
  </div>`;
}

// el : conteneur contenant framingHTML() ; value : cadrage actuel (ou null) ; onChange(focus)
export function mountFraming(el, src, value, onChange) {
  const box = el.querySelector('.fr-box'), img = box.querySelector('img');
  const zoomIn = el.querySelector('.fr-zoom');
  let f = { x: .5, y: .5, zoom: 1, ...(value || {}) };
  const place = () => {
    const bw = box.clientWidth, bh = box.clientHeight;
    if (!bw || !f.ar) return;
    const p = photoPlacement({ x: 0, y: 0, w: bw, h: bh }, f);
    Object.assign(img.style, { left: p.x + 'px', top: p.y + 'px', width: p.w + 'px', height: p.h + 'px' });
    zoomIn.value = Math.round(f.zoom * 100);
  };
  // Le point de visée est ramené dans la plage utile (au-delà, l'image ne bougerait plus)
  const clampFocus = () => {
    const bw = box.clientWidth, bh = box.clientHeight;
    if (!bw || !bh) return; // zone pas encore affichée (section repliée) : rien à ramener
    const p = photoPlacement({ x: 0, y: 0, w: bw, h: bh }, f);
    const hx = bw / 2 / p.w, hy = bh / 2 / p.h;
    f.x = Math.min(1 - hx, Math.max(hx, f.x));
    f.y = Math.min(1 - hy, Math.max(hy, f.y));
  };
  const round = () => ({ x: +f.x.toFixed(4), y: +f.y.toFixed(4), zoom: +f.zoom.toFixed(2), ar: +f.ar.toFixed(4) });
  const emit = () => onChange(round());
  img.onload = () => { f.ar = img.naturalWidth / img.naturalHeight; clampFocus(); place(); };
  img.src = src;
  new ResizeObserver(place).observe(box);

  let drag = null;
  box.addEventListener('pointerdown', (e) => {
    if (!f.ar) return;
    e.preventDefault();
    box.setPointerCapture(e.pointerId);
    const p = photoPlacement({ x: 0, y: 0, w: box.clientWidth, h: box.clientHeight }, f);
    drag = { x: e.clientX, y: e.clientY, fx: f.x, fy: f.y, w: p.w, h: p.h };
    box.classList.add('dragging');
  });
  box.addEventListener('pointermove', (e) => {
    if (!drag) return;
    f.x = drag.fx - (e.clientX - drag.x) / drag.w;
    f.y = drag.fy - (e.clientY - drag.y) / drag.h;
    clampFocus(); place();
  });
  const end = () => { if (!drag) return; drag = null; box.classList.remove('dragging'); emit(); };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
  zoomIn.addEventListener('input', () => { f.zoom = zoomIn.value / 100; clampFocus(); place(); });
  zoomIn.addEventListener('change', emit);
  el.querySelector('.fr-reset').addEventListener('click', () => { f = { x: .5, y: .5, zoom: 1, ar: f.ar }; place(); emit(); });
}
