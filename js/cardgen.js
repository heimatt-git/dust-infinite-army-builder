// Carte d'unité générée (format mono-face), dessinée en SVG à partir des données de la base.
// Aucune image officielle n'est utilisée. Le même SVG sert à l'affichage et à l'export PNG
// et à l'export PDF : ce qu'on voit est exactement ce qu'on télécharge.
import { t } from './i18n.js';
import { diceInner, ATTACK_ICONS, attackParts } from './dice.js';

// Largeur logique : 1000 pour la carte carrée (80 × 80 mm), 1500 pour la carte large (120 × 70 mm),
// soit la même échelle (12,5 unités par mm) : les textes ont la même taille imprimée dans les deux formats.
export const CARD_FORMATS = { square: { w: 1000, mm: [80, 80] }, wide: { w: 1500, mm: [120, 70] } };
// Nom et sous-titre de l'unité : même police pochoir que le titre du site
const FONT_NAME = "'Saira Stencil One', Oswald, 'DejaVu Sans Condensed', Impact, sans-serif";
// Police étroite et grasse (Oswald sur le site ; équivalents étroits en secours)
const FONT = "Oswald, 'Roboto Condensed', 'Arial Narrow', 'DejaVu Sans Condensed', 'Liberation Sans Narrow', Impact, sans-serif";
const INK = '#231f1a', PAPER = '#f1e6c8', CREAM = '#f6ecd2', RED = '#b3261e', BROWN = '#7a4a32';
// Les faces de dé sont des caractères réservés (largeur d'un cadratin) ; le dessin est posé dessus ensuite
const DICE = { dice_block: '\uE000', dice_sight: '\uE001', dice_shield: '\uE002' };
const DICE_RE = /[\uE000-\uE002]/g;
const DICE_CODE = ['dice_block', 'dice_sight', 'dice_shield'];

const xe = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dice = (s) => String(s || '').replace(/dice_(sight|block|shield)/g, (m) => DICE[m]);

// Icônes (chemins SVG simples, dessinés pour ce site, en 24 × 24)
const P = {
  inf: 'M12 1.9a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2zM8 9h8l-1 6h-2l-.6 7h-2.8L9 15H7z',
  hero: 'M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z',
  veh: 'M1.5 14.5h21l-1.6 4.5H3.1zM6 10h9.5v4.5H6zM15 11.2h8.5v1.6H15z',
  air: 'M1.5 12l6.5-1.2L11.2 5h2l-1.4 5.1 7.4-.8L21.6 7h1.6l-.8 5 .8 5h-1.6l-2.4-2.3-7.4-.8 1.4 5.1h-2L8 13.2z',
  cross: 'M8.5 2h7v6.5H22v7h-6.5V22h-7v-6.5H2v-7h6.5z',
  arrow: 'M2 9h11V3.5L22.5 12 13 20.5V15H2z',
};
const TYPE_ICON = { infantry: P.inf, hero: P.hero, vehicle: P.veh, aircraft: P.air, token: P.inf };
const ARMOR_ICON = { infantry: P.inf, hero: P.inf, vehicle: P.veh, aircraft: P.air, token: P.inf };
const icon = (d, x, y, size, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra} transform="translate(${x} ${y}) scale(${size / 24})"/>`;

// Bord « déchiré » des bandeaux (toujours le même pour une unité donnée)
function rng(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}
function tornEdge(y, amp, r, reverse = false, W = 1000) {
  const pts = [];
  for (let x = 0; x <= W; x += 14 + r() * 16) pts.push([x, y + (r() - .5) * amp]);
  pts.push([W, y + (r() - .5) * amp]);
  if (reverse) pts.reverse();
  return pts.map(([x, yy]) => `L${x.toFixed(1)} ${yy.toFixed(1)}`).join('');
}
let uid = 0;

// Mesure du texte (canvas) pour couper les lignes comme le navigateur les dessinera
let ctx;
function measure(text, font) {
  ctx ||= document.createElement('canvas').getContext('2d');
  ctx.font = font;
  return ctx.measureText(String(text).replace(DICE_RE, '\u2003')).width;
}
function wrap(text, font, width) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const tryL = cur ? cur + ' ' + w : w;
    if (measure(tryL, font) <= width || !cur) cur = tryL; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function fit(text, font, size, width, min = 12) {
  let s = size;
  while (s > min && measure(text, font.replace('{s}', s)) > width) s -= 1;
  let out = String(text);
  if (measure(out, font.replace('{s}', s)) > width) {
    while (out.length > 1 && measure(out + '…', font.replace('{s}', s)) > width) out = out.slice(0, -1);
    out += '…';
  }
  return { text: out, size: s };
}


// Ligne de description : les faces de dé (caractères réservés) deviennent un cadratin,
// et le dessin du symbole est posé à cet endroit (emblème du bloc pour la face « bloc »)
function descLine(x, y, size, line, bloc, txt) {
  let o = txt(x, y, size, xe(line.replace(DICE_RE, '\u2003')), { w: 400, anchor: 'start' });
  const font = `400 ${size}px ${FONT}`;
  for (let i = 0; i < line.length; i++) {
    const k = line.charCodeAt(i) - 0xE000;
    if (k < 0 || k > 2) continue;
    const px = x + measure(line.slice(0, i), font) + size * .04;
    o += `<g transform="translate(${px.toFixed(1)} ${(y - size * .84).toFixed(1)}) scale(${(size * .92 / 100).toFixed(4)})" color="${INK}" fill="${INK}">${diceInner(DICE_CODE[k], bloc)}</g>`;
  }
  return o;
}

// Résumé d'une compétence pour la carte : première phrase, coupée si elle reste trop longue
// (le texte complet reste affiché dans la fiche, sous la carte)
export function skillSummary(text, max = 130) {
  let s = dice(String(text || '').replace(/\s+/g, ' ').trim());
  if (!s) return '';
  const first = s.match(/^.+?[.!?](\s|$)/);
  if (first && first[0].length >= 25) s = first[0].trim();
  if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return s;
}

// credit : ligne de crédit affichée sur la photo (licence CC BY)
export function generatedCardSVG(u, D, { cost, photo, focus = null, format = 'square', credit = '' } = {}) {
  const wide = format === 'wide';
  const W = wide ? CARD_FORMATS.wide.w : CARD_FORMATS.square.w;
  const id = `gc${++uid}`;
  const bloc = D.blocsById.get(u.bloc);
  const color = bloc?.color || '#6c7347';
  const ws = u.weapons || [];
  const r = rng(u.id || u.name);
  const out = [];
  const f = (w, s) => `${w} ${s}px ${FONT}`;
  const txt = (x, y, s, content, { w = 700, anchor = 'middle', fill = INK, extra = '', font = FONT } = {}) =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${xe(font)}" font-weight="${w}" font-size="${s}" fill="${fill}" ${extra}>${content}</text>`;

  // ---- Géométrie (proche de la carte mono-face)
  // Carte carrée (80 × 80 mm à l'impression) : les lignes d'armes et le haut de la carte
  // se partagent la hauteur disponible (peu d'armes → grande photo ; beaucoup → lignes serrées)
  const nW = Math.max(1, ws.length);
  const HEAD = 80;
  let ROW, T;
  if (wide) {
    // Carte large 120 × 70 mm (hauteur logique 875) : même disposition, étalée en largeur
    ROW = Math.max(40, Math.min(62, 173 / nW));
    T = Math.max(-234, 653 - nW * ROW - 574);          // bas de carte à 875 ; carte plus haute si trop d'armes
  } else {
    ROW = Math.max(44, Math.min(66, 204 / nW));
    T = Math.max(-160, 204 - nW * ROW);                // hauteur ajoutée (ou retirée) au haut de la carte
  }
  const PX = 42, PY = 60, PW = 466, PH = 404 + T;      // photo
  const SX = 524, SY = 60, SW = W - 24 - SX, SH = 490 + T; // encadré des compétences
  const TY = 574 + T;                                   // tableau d'armes
  const x0 = 22, x1 = W - 22;
  const NAME_W = wide ? 430 : 300, RANGE_W = wide ? 76 : 64, NAME_X = x0, RANGE_X = x0 + NAME_W, VAL_X = RANGE_X + RANGE_W;
  const VAL_W = (x1 - VAL_X) / 14;
  const footY = TY + HEAD + nW * ROW + 26;
  const H = footY + 116;

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="gcard-svg" role="img" aria-label="${xe(u.name)}">`);
  out.push(`<defs>
    <clipPath id="${id}-card"><rect width="${W}" height="${H}" rx="26"/></clipPath>
    <clipPath id="${id}-ph"><rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="34"/></clipPath>
    <radialGradient id="${id}-paper" cx="30%" cy="35%" r="85%"><stop offset="0" stop-color="#f7efd9"/><stop offset=".65" stop-color="${PAPER}"/><stop offset="1" stop-color="#dcc79a"/></radialGradient>
    <linearGradient id="${id}-gen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity=".55"/></linearGradient>
  </defs><g clip-path="url(#${id}-card)">`);

  // ---- Fond parchemin, bandeaux déchirés couleur du bloc
  out.push(`<rect width="${W}" height="${H}" fill="url(#${id}-paper)"/>`);
  for (let i = 0; i < 7; i++) out.push(`<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(40 + r() * 120).toFixed(0)}" fill="#b89a60" opacity="${(.04 + r() * .05).toFixed(2)}"/>`);
  out.push(`<path d="M0 0H${W}V34${tornEdge(34, 12, r, true, W).replace(/^L/, 'L')}L0 34Z" fill="${color}"/>`);
  out.push(`<path d="M0 ${H}H${W}V${footY + 8}${tornEdge(footY + 8, 14, r, true, W)}L0 ${footY + 8}Z" fill="${color}"/>`);

  // ---- Photo (communauté) ou image générique
  out.push(`<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="34" fill="${PAPER}"/>`);
  if (photo && focus?.ar) {
    // Cadrage choisi : point de visée + zoom (gardés quel que soit le format de la zone photo)
    const pl = photoPlacement({ x: PX, y: PY, w: PW, h: PH }, focus);
    out.push(`<image href="${xe(photo)}" x="${pl.x.toFixed(1)}" y="${pl.y.toFixed(1)}" width="${pl.w.toFixed(1)}" height="${pl.h.toFixed(1)}" preserveAspectRatio="none" clip-path="url(#${id}-ph)"/>`);
  } else if (photo) out.push(`<image href="${xe(photo)}" x="${PX}" y="${PY}" width="${PW}" height="${PH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}-ph)"/>`);
  else {
    out.push(`<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="34" fill="url(#${id}-gen)"/>`);
    for (let i = 0; i < 9; i++) out.push(`<rect x="${PX}" y="${PY + 30 + i * 44}" width="${PW}" height="2" fill="${color}" opacity=".12" clip-path="url(#${id}-ph)"/>`);
    const isz = Math.min(220, PH * .62);
    out.push(icon(TYPE_ICON[u.type] || P.inf, PX + PW / 2 - isz / 2, PY + PH / 2 - isz * .59, isz, color, 'opacity=".55"'));
  }
  out.push(`<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="34" fill="none" stroke="${INK}" stroke-width="4"/>`);

  // ---- Crédit de la photo (juste au-dessus du cartouche du nom, qui recouvre le bas de la photo)
  if (credit) {
    const cf = 20, cw = Math.min(PW - 20, measure(credit, f('500', cf)) + 22), cy = 432 + T - 34;
    out.push(`<rect x="${PX + 10}" y="${cy}" width="${cw.toFixed(1)}" height="26" rx="6" fill="${CREAM}" fill-opacity=".85"/>`);
    out.push(txt(PX + 21, cy + 19, cf, xe(credit), { w: 500, anchor: 'start' }));
  }

  // ---- Coût (flèche à gauche de la photo)
  out.push(`<path d="M14 84h96l36 58-36 58H14z" fill="${CREAM}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`);
  out.push(txt(68, 156, 64, xe(cost ?? u.cost)));
  out.push(txt(68, 186, 24, xe(t('PA')), { fill: RED }));

  // ---- Tampon CONFIDENTIAL sur la photo
  if (u.confidential) {
    out.push(`<g transform="translate(${PX + PW - 150} ${PY + 58}) rotate(-8)"><rect x="-132" y="-34" width="264" height="${u.author ? 70 : 50}" fill="${CREAM}" fill-opacity=".85" stroke="${RED}" stroke-width="5"/>
      <text x="0" y="4" text-anchor="middle" font-family="'IBM Plex Mono', 'DejaVu Sans Mono', monospace" font-weight="700" font-size="27" letter-spacing="4" fill="${RED}">CONFIDENTIAL</text>
      ${u.author ? txt(0, 28, 18, xe(u.author), { w: 500, fill: RED }) : ''}</g>`);
  }

  // ---- Cartouche du nom (pas d'emblème de faction : aucun logo officiel sur la carte)
  const CX = 60, CY = 432 + T, CW = 440, CH = 122;
  out.push(`<rect x="${CX}" y="${CY}" width="${CW}" height="${CH}" rx="24" fill="#fffdf7" stroke="${INK}" stroke-width="4"/>`);
  out.push(`<rect x="${CX + 7}" y="${CY + 7}" width="${CW - 14}" height="${CH - 14}" rx="17" fill="none" stroke="${INK}" stroke-width="1.5" opacity=".6"/>`);
  const nm = nameLines(u.name.toUpperCase(), CW - 40, u.subtitle ? 2 : 3);
  let subL = u.subtitle ? subtitleLines(u.subtitle.toUpperCase(), CW - 40) : { lines: [], size: 0 };
  if (nm.lines.length > 1 && subL.lines.length > 1) { const sf = fit(u.subtitle.toUpperCase(), `400 {s}px ${FONT_NAME}`, subL.size, CW - 40, 12); subL = { lines: [sf.text], size: sf.size }; }
  const blockH = nm.lines.length * nm.size * .98 + subL.lines.length * (subL.size + 3);
  let ny = CY + CH / 2 - blockH / 2 - 2;
  for (const l of nm.lines) { ny += nm.size * .98; out.push(txt(CX + CW / 2, ny - nm.size * .12, nm.size, xe(l), { w: 400, font: FONT_NAME })); }
  subL.lines.forEach((l) => { ny += subL.size + 3; out.push(txt(CX + CW / 2, ny, subL.size, xe(l), { w: 400, font: FONT_NAME })); });

  // ---- Compétences : « • NOM • » centré, puis le résumé
  out.push(`<rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="34" fill="#fffdf7" stroke="${INK}" stroke-width="4"/>`);
  const skills = [
    ...(u.skills || []).filter((s) => !(u.customSkills || []).some((c) => c.name === s)).map((s) => ({ head: s, desc: D.skills[s] || '' })),
    ...(u.customSkills || []).map((c) => ({ head: c.name, desc: c.description || '' })),
  ];
  const wsk = new Map();
  for (const w of ws) for (const sp of w.specials || []) {
    if (!wsk.has(sp)) wsk.set(sp, { head: sp, weapons: [], desc: D.skills[sp] || '' });
    const e = wsk.get(sp); if (!e.weapons.includes(w.name)) e.weapons.push(w.name);
  }
  for (const e of wsk.values()) skills.push({ ...e, weapon: e.weapons.join(', ') });
  const blocks = layoutSkills(skills, SW - 44, SH - 36, wide);
  let ly = SY + 20;
  for (const b of blocks.items) {
    b.head.forEach((l) => { ly += b.hs; out.push(txt(SX + 22, ly, b.hs, xe(l), { anchor: 'start' })); });
    b.desc.forEach((l) => { ly += b.ds * 1.2; out.push(descLine(SX + 22, ly, b.ds, l, u.bloc, txt)); });
    ly += b.gap;
  }

  // ---- Tableau d'armes
  // Plaque « DUST 194∞ »
  out.push(dustLogo(x0, TY + 8, NAME_W, HEAD - 16));
  const rg = fit(t('PORTÉE'), f(700, '{s}'), 15, RANGE_W - 10, 9);
  out.push(txt(RANGE_X + RANGE_W / 2, TY + HEAD - 14, rg.size, xe(rg.text)));
  const groups = [[P.inf, 0, 4], [P.veh, 4, 7], [P.air, 11, 3]];
  const rowsH = Math.max(1, ws.length) * ROW;
  for (const [d, start, n] of groups) {
    const gx = VAL_X + start * VAL_W;
    out.push(icon(d, gx + (n * VAL_W) / 2 - 17, TY + 4, 34, INK));
    for (let i = 0; i < n; i++) out.push(txt(gx + (i + .5) * VAL_W, TY + HEAD - 10, 30, i + 1));
  }
  ws.forEach((w, i) => {
    const ry = TY + HEAD + i * ROW;
    if (i % 2 === 0) out.push(`<rect x="${x0}" y="${ry}" width="${x1 - x0}" height="${ROW}" fill="#fffaf0" opacity=".7"/>`);
    else out.push(`<rect x="${x0}" y="${ry}" width="${x1 - x0}" height="${ROW}" fill="${color}" opacity=".10"/>`);
    const cy = ry + ROW / 2;
    out.push(`<circle cx="${x0 + 24}" cy="${cy}" r="17" fill="${RED}" stroke="${INK}" stroke-width="2"/>`);
    out.push(txt(x0 + 24, cy + 8, 22, 'ABCDEFGH'[i] || '', { fill: CREAM }));
    out.push(weaponLabel(w, x0 + 50, cy + 9, NAME_W - 56));
    out.push(txt(RANGE_X + RANGE_W / 2, cy + 10, 28, xe(w.range ?? '-')));
    const vals = [...pad(w.vsInfantry, 4), ...pad(w.vsVehicle, 7), ...pad(w.vsAircraft, 3)];
    vals.forEach((v, k) => {
      const sp = attackParts(v);
      if (sp) { out.push(attackCell(sp, VAL_X + (k + .5) * VAL_W, cy, VAL_W - 6, txt)); return; }
      const vf = fit(v || '-', f(700, '{s}'), 26, VAL_W - 9, 12);
      out.push(txt(VAL_X + (k + .5) * VAL_W, cy + 9, vf.size, xe(vf.text)));
    });
  });
  if (!ws.length) out.push(txt(x0 + 24, TY + HEAD + 36, 22, xe(t('Aucune arme.')), { w: 400, anchor: 'start', extra: 'font-style="italic" opacity=".6"' }));
  // Séparateurs
  out.push(`<rect x="${x0}" y="${TY + HEAD - 2}" width="${x1 - x0}" height="3" fill="${INK}"/>`);
  out.push(`<rect x="${x0}" y="${TY + HEAD + rowsH}" width="${x1 - x0}" height="3" fill="${INK}"/>`);
  // Lignes légères entre chaque niveau de portée
  for (let k = 1; k < 14; k++) if (k !== 4 && k !== 11) out.push(`<rect x="${VAL_X + k * VAL_W - .75}" y="${TY + HEAD - 40}" width="1.5" height="${rowsH + 40}" fill="${INK}" opacity=".18"/>`);
  for (const gx of [RANGE_X, VAL_X, VAL_X + 4 * VAL_W, VAL_X + 11 * VAL_W]) out.push(`<rect x="${gx - 1}" y="${TY + 6}" width="3" height="${HEAD + rowsH - 6}" fill="${INK}" opacity=".75"/>`);

  // ---- Pied de carte : santé (croix puis chiffre), cases de dégâts « + », héros, déplacement, marche, armure
  const fy = footY + 66;
  let fx = 30;
  const hp = Number.isInteger(u.health) ? u.health : parseInt(u.health, 10);
  if (hp > 0) {
    const pw = String(u.health).length > 1 ? 150 : 120;
    out.push(`<rect x="${fx}" y="${fy - 32}" width="${pw}" height="64" rx="32" fill="${CREAM}" stroke="${INK}" stroke-width="3"/>`);
    out.push(icon(P.cross, fx + 12, fy - 20, 40, RED));
    out.push(txt(fx + 58 + (pw - 58) / 2 - 4, fy + 19, 54, xe(u.health)));
    fx += pw + 14;
    const n = Math.min(hp, 20), step = Math.min(38, (560 - fx) / n), sz = Math.min(32, step - 4);
    for (let i = 0; i < n; i++) out.push(icon(P.cross, fx + i * step, fy - sz / 2, sz, CREAM, `stroke="${INK}" stroke-width="${(1.5 * 24 / sz).toFixed(2)}"`));
    fx += n * step + 8;
  }
  const mx = W - 30 - 380;
  const hasMove = [u.move, u.march, u.armor].some((v) => v != null && v !== '');
  const num = (cx, v) => { const n = fit(String(v ?? '-'), f(700, '{s}'), 54, 58, 30); return txt(cx, fy + 19, n.size, xe(n.text)); };
  if (u.type === 'hero') out.push(txt((fx + mx) / 2, fy + 12, 34, `* ${xe(t('Héros'))}`, { fill: CREAM }));
  if (hasMove) {
  out.push(`<rect x="${mx}" y="${fy - 32}" width="380" height="64" rx="32" fill="${CREAM}" stroke="${INK}" stroke-width="3"/>`);
  out.push(icon(P.arrow, mx + 16, fy - 16, 32, BROWN));
  out.push(num(mx + 84, u.move));
  out.push(icon(P.arrow, mx + 122, fy - 16, 32, BROWN) + icon(P.arrow, mx + 140, fy - 16, 32, BROWN));
  out.push(num(mx + 214, u.march));
  out.push(icon(ARMOR_ICON[u.type] || P.inf, mx + 254, fy - 24, 48, BROWN));
  out.push(num(mx + 334, u.armor));
  }

  out.push('</g></svg>');
  return out.join('\n');
}
// Case d'attaque avec symbole(s) : « explosion / 1 », « double explosion / 1 », « 1 / tête de mort »
function attackCell(sp, cx, cy, maxW, txt) {
  const part = (p, s) => (p.icon ? { icon: ATTACK_ICONS[p.icon], w: ATTACK_ICONS[p.icon].w / 100 * s * .95 }
    : { text: p.text, w: measure(p.text, `700 ${s}px ${FONT}`) });
  let s = 26, items;
  for (; s >= 11; s--) {
    items = [part(sp.left, s), { text: '/', w: measure('/', `700 ${s}px ${FONT}`) }, part(sp.right, s)];
    if (items.reduce((a, b) => a + b.w, 0) + 2 <= maxW) break;
  }
  const total = items.reduce((a, b) => a + b.w, 0);
  let x = cx - total / 2;
  const base = cy + s * .35;
  let o = '';
  for (const it of items) {
    if (it.icon) {
      const h = s * .95, k = h / it.icon.h;
      o += `<g transform="translate(${x.toFixed(1)} ${(cy - h / 2 - s * .02).toFixed(1)}) scale(${k.toFixed(4)})" color="${INK}" fill="${INK}">${it.icon.inner}</g>`;
    } else o += txt(x, base, s, xe(it.text), { anchor: 'start' });
    x += it.w;
  }
  return o;
}
const pad = (arr, n) => Array.from({ length: n }, (_, i) => arr?.[i] || '');

// Bandeau « DUST 194∞ » : patch de tissu pochoir dessiné pour le site (pas de logo officiel).
// L'image est intégrée aux exports (PNG, PDF) par svgCanvas, comme les photos.
export const DUST_BANNER = 'img/bandeau-dust.png';
function dustLogo(x, y, w, h) {
  return `<image href="${DUST_BANNER}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
}

// Nom de l'arme trop long : deux lignes plus petites
function weaponLabel2(w, x, y, width) {
  const label = `${w.count ?? 1}x ${w.name}${w.mount ? ` (${w.mount})` : ''}`;
  for (let s = 17; s >= 11; s--) {
    const lines = wrap(label.toUpperCase(), `700 ${s}px ${FONT}`, width);
    if (lines.length <= 2 || s === 11) return lines.slice(0, 2).map((l, i) => `<text x="${x}" y="${y - 9 + (i ? s + 1 : 0) - (lines.length > 1 ? s / 2 - 2 : -4)}" font-family="${xe(FONT)}" font-weight="700" font-size="${s}" fill="${INK}">${xe(l)}</text>`).join('');
  }
}

// Nom de l'unité : une ligne, ou deux (voire trois) si le nom est long
function nameLines(text, width, maxLines) {
  const one = fit(text, `400 {s}px ${FONT_NAME}`, 58, width, 32);
  if (measure(one.text, `400 ${one.size}px ${FONT_NAME}`) <= width && !one.text.endsWith('…')) return { lines: [one.text], size: one.size };
  for (let n = 2; n <= maxLines; n++) {
    for (let s = 40; s >= (n === maxLines ? 18 : 28); s -= 2) {
      const lines = wrap(text, `400 ${s}px ${FONT_NAME}`, width);
      if (lines.length <= n && lines.every((l) => measure(l, `400 ${s}px ${FONT_NAME}`) <= width)) return { lines, size: Math.min(s, n === 3 ? 30 : 40) };
    }
  }
  const f2 = fit(text, `400 {s}px ${FONT_NAME}`, 20, width, 14);
  return { lines: [f2.text], size: f2.size };
}

// Sous-titre du cartouche : 1 ou 2 lignes, taille réduite si besoin
function subtitleLines(text, width) {
  for (let s = 21; s >= 12; s--) {
    const lines = wrap(text, `400 ${s}px ${FONT_NAME}`, width);
    if (lines.length <= 2) return { lines, size: s };
  }
  const s = 12;
  const lines = wrap(text, `400 ${s}px ${FONT_NAME}`, width).slice(0, 2);
  lines[1] = fit(lines[1] + '…', `400 {s}px ${FONT_NAME}`, s, width, s).text;
  return { lines, size: s };
}

// Compétences : on cherche la plus grande taille de texte qui tient dans l'encadré
// Carte large : texte complet des compétences si tout tient, sinon résumés (comme la carte carrée)
const fullText = (s) => dice(String(s || '').replace(/\s+/g, ' ').trim());
function layoutSkills(skills, width, height, full = false) {
  if (!skills.length) return { items: [], height: 0 };
  for (const max of full ? [0, 130, 90, 60] : [130, 90, 60]) {
    for (let ds = 17; ds >= 13; ds--) {
      const hs = Math.round(ds * 1.18), gap = Math.round(ds * .75);
      const items = skills.map((s) => ({
        hs, ds, gap,
        head: wrap(`• ${s.head.toUpperCase()} •${s.weapon ? ` (${s.weapon})` : ''}`, `700 ${hs}px ${FONT}`, width),
        desc: s.desc ? wrap(max ? skillSummary(s.desc, max) : fullText(s.desc), `400 ${ds}px ${FONT}`, width) : [],
      }));
      const h = items.reduce((a, b) => a + b.head.length * hs + b.desc.length * ds * 1.2 + gap, -gap + 6);
      if (h <= height) return { items, height: h };
    }
  }
  // Dernier recours : les noms seuls
  const hs = 16;
  const items = skills.map((s) => ({ hs, ds: 13, gap: 4, head: [fit(`• ${s.head.toUpperCase()} •`, `700 {s}px ${FONT}`, hs, width, 10).text], desc: [] }));
  return { items, height: items.length * 20 };
}

// « 1x Nom de l'arme (Tourelle) » en petites capitales
function weaponLabel(w, x, y, width) {
  const count = `${w.count ?? 1}x `;
  const words = String(w.name).split(/\s+/);
  const mount = w.mount ? ` (${w.mount})` : '';
  for (let s = 24; s >= 12; s--) {
    const small = Math.round(s * .78);
    let wd = measure(count, `700 ${s}px ${FONT}`);
    const parts = [];
    words.forEach((wd0, i) => {
      const a = (i ? ' ' : '') + wd0[0].toUpperCase(), b = wd0.slice(1).toUpperCase();
      parts.push([a, s], [b, small]);
      wd += measure(a, `700 ${s}px ${FONT}`) + measure(b, `700 ${small}px ${FONT}`);
    });
    const ms = Math.round(s * .66);
    if (mount) wd += measure(mount, `500 ${ms}px ${FONT}`);
    if (wd <= width || s === 16) {
      if (wd > width) return weaponLabel2(w, x, y, width);
      return `<text x="${x}" y="${y}" font-family="${xe(FONT)}" font-weight="700" fill="${INK}"><tspan font-size="${s}">${xe(count)}</tspan>${parts.map(([p, z]) => `<tspan font-size="${z}">${xe(p)}</tspan>`).join('')}${mount ? `<tspan font-size="${ms}" font-weight="500" fill-opacity=".7">${xe(mount)}</tspan>` : ''}</text>`;
    }
  }
}

// Les polices de la carte doivent être chargées avant de mesurer les textes
export function cardFontsReady() {
  if (!document.fonts?.load) return Promise.resolve();
  return Promise.all(['400 20px "Saira Stencil One"', '400 20px Oswald', '700 20px Oswald'].map((f) => document.fonts.load(f))).catch(() => {});
}

// ---------------------------------------------------------------- Export PNG
// Les polices du site sont intégrées dans le SVG pour que l'image soit identique à l'écran.
let fontCSS;
async function embeddedFonts() {
  if (fontCSS !== undefined) return fontCSS;
  fontCSS = '';
  try {
    const link = [...document.querySelectorAll('link[rel=stylesheet]')].find((l) => l.href.includes('fonts.googleapis.com'));
    if (!link) return fontCSS;
    let css = await fetch(link.href).then((r) => r.text());
    // Ne garder que les polices latines (les autres alphabets sont inutiles ici)
    const blocks = css.split('}').filter((b) => b.includes('@font-face') && (/U\+0000-00FF/.test(b) || !/unicode-range/.test(b)));
    const urls = [...new Set(blocks.join('}').match(/url\([^)]+\)/g) || [])];
    const map = {};
    await Promise.all(urls.map(async (u) => {
      const href = u.slice(4, -1).replace(/["']/g, '');
      const blob = await fetch(href).then((r) => r.blob());
      map[u] = `url(${await blobToDataURL(blob)})`;
    }));
    fontCSS = blocks.map((b) => b + '}').join('\n').replace(/url\([^)]+\)/g, (m) => map[m] || m);
  } catch { fontCSS = ''; }
  return fontCSS;
}
const blobToDataURL = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });

// SVG → canvas (polices et images intégrées), base des exports PNG et PDF
export async function svgCanvas(svg, { scale = 2, bg = null } = {}) {
  await document.fonts?.ready;
  const css = await embeddedFonts();
  let s = svg;
  if (css) s = s.replace(/<defs>/, `<defs><style>${css}</style>`);
  // Les images (photo, logo) doivent être intégrées pour pouvoir être dessinées
  const hrefs = [...new Set([...s.matchAll(/<image href="([^"]+)"/g)].map((m) => m[1]).filter((h) => !h.startsWith('data:')))];
  for (const h of hrefs) {
    try { s = s.split(`href="${h}"`).join(`href="${await blobToDataURL(await fetch(h.replace(/&amp;/g, '&')).then((r) => r.blob()))}"`); } catch { /* image ignorée */ }
  }
  const [, w, h] = s.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/) || [];
  s = s.replace('<svg ', `<svg width="${w}" height="${h}" `);
  const img = new Image();
  img.decoding = 'sync';
  const url = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' }));
  try {
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('svg')); img.src = url; });
    const c = document.createElement('canvas');
    c.width = Math.round(+w * scale); c.height = Math.round(+h * scale);
    const g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
    g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}
export async function cardPNG(svg, { scale = 2 } = {}) {
  const c = await svgCanvas(svg, { scale });
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

// Cadrage d'une photo dans une zone : l'image couvre la zone (zoom ≥ 1), le point de visée (x, y en fraction
// de l'image) est placé au centre de la zone autant que possible, sans laisser de bord vide.
// focus = { x, y, zoom, ar } ; ar = largeur / hauteur de l'image.
export function photoPlacement(box, focus) {
  const ar = focus.ar || 1, zoom = Math.max(1, Math.min(3, focus.zoom || 1));
  let w, h;
  if (ar > box.w / box.h) { h = box.h * zoom; w = h * ar; } else { w = box.w * zoom; h = w / ar; }
  const fx = focus.x ?? .5, fy = focus.y ?? .5;
  const x = Math.min(box.x, Math.max(box.x + box.w - w, box.x + box.w / 2 - fx * w));
  const y = Math.min(box.y, Math.max(box.y + box.h - h, box.y + box.h / 2 - fy * h));
  return { x, y, w, h };
}

// Outils de mise en page réutilisés par l'export PDF
export { measure, wrap, FONT, FONT_NAME, xe };
