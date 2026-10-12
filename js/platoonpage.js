// Page de peloton (A4 portrait) : texte à gauche, organigramme à droite.
// Dessin original (aucun logo ni emblème officiel). Le fond et l'emblème peuvent être remplacés par l'utilisateur.
// Sortie : SVG (viewBox 1240 × 1754), converti en PNG ou en PDF par cardgen.svgCanvas / pdf.js.
import { measure, wrap, FONT, FONT_NAME, xe } from './cardgen.js';
import { diceInner } from './dice.js';
import { t, LANG } from './i18n.js';

export const PAGE_W = 1240, PAGE_H = 1754;
const INK = '#231f1a', MUTED = '#6b6257', PAPER = '#e4dac4', CREAM = '#f6ecd2', RED = '#a83a24';
let seq = 0;

const T = (x, y, size, s, { w = 400, anchor = 'start', fill = INK, font = FONT, extra = '' } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${xe(font)}" font-weight="${w}" font-size="${size}" fill="${fill}" ${extra}>${xe(s)}</text>`;

// Paragraphes (séparés par des retours à la ligne) coupés à la largeur donnée
function paras(text, font, width) {
  const out = [];
  for (const p of String(text || '').split(/\n+/)) {
    const s = p.trim();
    if (!s) continue;
    out.push(wrap(s, font, width));
  }
  return out;
}
const textBlock = (text, x, y, width, size, { w = 400, lh = 1.28, gap = 0.55, fill = INK } = {}) => {
  const font = `${w} ${size}px ${FONT}`;
  let yy = y, svg = '';
  for (const lines of paras(text, font, width)) {
    for (const l of lines) { svg += T(x, yy, size, l, { w, fill }); yy += size * lh; }
    yy += size * gap;
  }
  return { svg, end: yy - size * gap };
};
// Plus grande taille (≤ max) pour laquelle le contenu tient dans la hauteur donnée
function fitSize(build, max, min, limit) {
  for (let s = max; s >= min; s -= 0.5) { const r = build(s); if (r.end <= limit) return { ...r, size: s }; }
  return { ...build(min), size: min };
}

// Ligne d'option : « A et B » = unités jouées ensemble ; options séparées par « ou »
const unitName = (D, id) => D.unitsById?.get(id)?.name || id;
function optionLines(slot, D) {
  return (slot || []).map((opt) => opt.map((id) => unitName(D, id)).join(` ${t('et')} `));
}

function ovalNode(cx, y, w, h, lines, { dashed = false, k = 1 } = {}) {
  const size = Math.max(20, 27 * Math.min(k, 1.12)), lh = size * 1.15;
  const font = `700 ${size}px ${FONT}`;
  let all = [];
  for (const l of lines) all.push(...wrap(l, font, w - 44));
  const top = y + h / 2 - (all.length * lh) / 2 + size * 0.82;
  return `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${h}" rx="${h / 2.2}" fill="${CREAM}" stroke="#3a342d" stroke-width="7" ${dashed ? 'stroke-dasharray="14 9"' : ''}/>`
    + all.map((l, i) => T(cx, top + i * lh, size, l, { w: 700, anchor: 'middle' })).join('');
}

export function platoonPageSVG(pl, D, { bg = null, emblem = null, credit = '', confidential = true } = {}) {
  const id = `pp${++seq}`;
  const bloc = D.blocsById?.get(pl.bloc);
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W} ${PAGE_H}"><defs><clipPath id="${id}c"><rect width="${PAGE_W}" height="${PAGE_H}"/></clipPath></defs>`);
  // Fond : image de l'utilisateur (voilée pour garder le texte lisible) ou papier uni
  out.push(`<rect width="${PAGE_W}" height="${PAGE_H}" fill="${PAPER}"/>`);
  if (bg) out.push(`<image href="${bg}" x="0" y="0" width="${PAGE_W}" height="${PAGE_H}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}c)"/><rect width="${PAGE_W}" height="${PAGE_H}" fill="${CREAM}" opacity=".62"/>`);
  else out.push(`<rect x="22" y="22" width="${PAGE_W - 44}" height="${PAGE_H - 44}" fill="none" stroke="#b9ad92" stroke-width="3"/>`);

  const hasSupport = !!String(pl.supportText || '').trim();
  const bottomLimit = hasSupport ? 1440 : 1660;

  // ---- Titre générique
  const title = t('PELOTON');
  let ts = 140; while (ts > 60 && measure(title, `400 ${ts}px ${FONT_NAME}`) > 500) ts -= 4;
  out.push(T(64, 64 + ts * 0.82, ts, title, { font: FONT_NAME, fill: '#4a433a', extra: 'opacity=".9"' }));

  // ---- Emblème + nom
  const ey = 290;
  if (emblem) out.push(`<image href="${emblem}" x="64" y="${ey}" width="130" height="150" preserveAspectRatio="xMidYMid meet"/>`);
  else out.push(`<g transform="translate(66 ${ey + 8}) scale(1.26)" color="${INK}" fill="${INK}">${diceInner('dice_block', pl.bloc)}</g>`);
  const nameFont = `700 40px ${FONT}`;
  const nameLines = wrap(String(pl.name || '').toUpperCase(), nameFont, 340).slice(0, 4);
  let ny = ey + 38;
  for (const l of nameLines) { out.push(T(214, ny, 40, l, { w: 700 })); ny += 46; }
  if (pl.lore) { const lr = textBlock(pl.lore, 214, ny + 4, 340, 20, { fill: MUTED }); out.push(lr.svg.replace(/<text /g, '<text font-style="italic" ')); ny = lr.end + 20; }
  const leftTop = Math.max(ey + 160, ny + 20);

  // ---- Colonne gauche : histoire + avantage (taille réduite jusqu'à tenir)
  const LW = 480;
  const left = fitSize((s) => {
    let y = leftTop, svg = '';
    if (String(pl.story || '').trim()) {
      const r = textBlock(pl.story, 64, y, LW, s); svg += r.svg; y = r.end + s * 1.6;
    }
    if (String(pl.advantage || '').trim() || String(pl.advantageName || '').trim()) {
      svg += T(64, y, s + 5, t('AVANTAGE DE PELOTON :'), { w: 700 }); y += (s + 5) * 1.45;
      if (String(pl.advantageName || '').trim()) { svg += T(64, y, s + 2, `- ${pl.advantageName.trim()}`, { w: 700 }); y += (s + 2) * 1.45; }
      const r = textBlock(pl.advantage, 64, y, LW, s); svg += r.svg; y = r.end;
    }
    return { svg, end: y };
  }, 24, 12, bottomLimit);
  out.push(left.svg);

  // ---- Organigramme (colonne de droite)
  const slotsC = pl.command || [], slotsB = pl.combat || [];
  const reqd = t('(Requise)');
  const BX = 890, CW = 270, GAP = 20;
  const top = 90;
  const total = slotsC.length + slotsB.length;
  const layout = (k) => {
    const osize = Math.max(14, 21 * k), BH = 112 * Math.max(1, k), ROWGAP = 40 * k, olh = osize * 1.25;
    const optH = (slot, width) => {
      const font = `700 ${osize}px ${FONT}`;
      let n = 0;
      optionLines(slot, D).forEach((o, i, a) => { n += wrap(o, font, width).length + (i < a.length - 1 ? 1 : 0); });
      return Math.max(1, n) * olh;
    };
    const nodes = [];
    let y = top;
    slotsC.forEach((s, i) => {
      const label = slotsC.length > 1 ? t('Unité de Commandement {n}', { n: i + 1 }) : t('Unité de Commandement');
      const h = BH + 14 + optH(s, 560);
      nodes.push({ kind: 'cmd', slot: s, cx: BX, y, w: 300, label, width: 560, h });
      y += h + ROWGAP;
    });
    const rows = Math.ceil(slotsB.length / 2);
    for (let r = 0; r < rows; r++) {
      const a = slotsB[r * 2], b = slotsB[r * 2 + 1];
      const ha = BH + 14 + optH(a, CW - 10), hb = b ? BH + 14 + optH(b, CW - 10) : 0;
      nodes.push({ kind: 'cb', slot: a, cx: BX - GAP / 2 - CW / 2, y, w: CW, label: t('Unité de Combat {n}', { n: r * 2 + 1 }), width: CW - 10, h: ha, row: r });
      if (b) nodes.push({ kind: 'cb', slot: b, cx: BX + GAP / 2 + CW / 2, y, w: CW, label: t('Unité de Combat {n}', { n: r * 2 + 2 }), width: CW - 10, h: hb, row: r });
      y += Math.max(ha, hb) + ROWGAP;
    }
    nodes.push({ kind: 'sup', cx: BX, y, w: 300, label: t('Unités de Soutien'), count: `${total}+`, h: BH });
    y += BH;
    return { nodes, end: y, osize, olh, BH, k };
  };
  let L = layout(1.4);
  for (let k = 1.4; k >= 0.6; k -= 0.05) { L = layout(k); if (L.end <= bottomLimit) break; }
  const BH = L.BH;
  const trunkX = BX;
  const cmdNodes = L.nodes.filter((n) => n.kind === 'cmd');
  const cbNodes = L.nodes.filter((n) => n.kind === 'cb');
  const sup = L.nodes.find((n) => n.kind === 'sup');
  // Traits rouges d'abord (les cases les recouvrent)
  const lines = [];
  const lastCmd = cmdNodes[cmdNodes.length - 1];
  if (cmdNodes.length) {
    const y0 = lastCmd.y + lastCmd.h + 4;
    if (cmdNodes.length > 1) lines.push(`<line x1="${trunkX}" y1="${cmdNodes[0].y + BH}" x2="${trunkX}" y2="${lastCmd.y}" />`);
    lines.push(`<line x1="${trunkX}" y1="${y0}" x2="${trunkX}" y2="${sup.y}" />`);
  } else lines.push(`<line x1="${trunkX}" y1="${top}" x2="${trunkX}" y2="${sup.y}" />`);
  const rowsDone = new Set();
  for (const n of cbNodes) {
    if (rowsDone.has(n.row)) continue; rowsDone.add(n.row);
    const pair = cbNodes.filter((m) => m.row === n.row);
    const my = n.y + BH / 2;
    lines.push(`<line x1="${Math.min(...pair.map((p) => p.cx))}" y1="${my}" x2="${Math.max(...pair.map((p) => p.cx))}" y2="${my}" />`);
  }
  out.push(`<g stroke="${RED}" stroke-width="13" stroke-linecap="round">${lines.join('')}</g>`);
  for (const n of L.nodes) {
    if (n.kind === 'sup') { out.push(ovalNode(n.cx, n.y, n.w, BH, [n.label, n.count, t('(Optionnelle)')], { dashed: true, k: L.k })); continue; }
    out.push(ovalNode(n.cx, n.y, n.w, BH, [n.label, reqd], { k: L.k }));
    const opts = optionLines(n.slot, D);
    const font = `700 ${L.osize}px ${FONT}`;
    let yy = n.y + BH + 14 + L.osize * 0.9;
    opts.forEach((o, i) => {
      for (const l of wrap(o, font, n.width)) { out.push(T(n.cx, yy, L.osize, l, { w: 700, anchor: 'middle' })); yy += L.olh; }
      if (i < opts.length - 1) { out.push(T(n.cx, yy, L.osize, t('ou'), { w: 400, anchor: 'middle', fill: RED, extra: 'font-style="italic"' })); yy += L.olh; }
    });
  }

  // ---- Unités de soutien (texte, pleine largeur)
  if (hasSupport) {
    const sy = 1490;
    out.push(T(64, sy, 26, t('UNITÉS DE SOUTIEN'), { w: 700 }));
    const r = fitSize((s) => textBlock(pl.supportText, 64, sy + 40, PAGE_W - 128, s), 20, 12, 1665);
    out.push(r.svg);
  }

  // ---- Pied de page
  const foot = [bloc ? ((LANG === 'en' && bloc.nameEn) || bloc.name) : '', credit].filter(Boolean).join(' · ');
  out.push(T(64, PAGE_H - 52, 17, foot, { fill: MUTED }));
  if (confidential) out.push(T(PAGE_W - 64, PAGE_H - 52, 17, t('CONFIDENTIAL : création de la communauté, non officielle'), { anchor: 'end', fill: RED, w: 700 }));
  out.push('</svg>');
  return out.join('');
}
