// Export PDF d'une liste : page(s) de récapitulatif + cartes générées 80 × 80 mm (6 par page A4, traits de coupe).
// Le PDF est fabriqué dans le navigateur, sans bibliothèque externe : chaque page est dessinée en SVG
// (mêmes polices que le site), convertie en image JPEG, puis assemblée dans un fichier PDF minimal.
import { generatedCardSVG, svgCanvas, cardFontsReady, measure, wrap, FONT, FONT_NAME, xe } from './cardgen.js';
import { t } from './i18n.js';
import { LOGO, creditLine, store } from './ui.js';

const FORMAT_KEY = 'dust1947.pdfFormat';

const MM = 72 / 25.4;                     // points PDF par millimètre
const A4 = { w: 210, h: 297 };
// Formats de cartes : carrée 80 × 80 (6 par page) ; large 120 × 70, placée tournée d'un quart de tour (2 × 2 par page)
const LAYOUTS = {
  square: { cw: 80, ch: 80, cols: 2, rows: 3, rotate: false },
  wide: { cw: 70, ch: 120, cols: 2, rows: 2, rotate: true },
};
const gridOf = (L) => ({ ...L, x: (A4.w - L.cols * L.cw) / 2, y: (A4.h - L.rows * L.ch) / 2 });
const INK = '#231f1a', MUTED = '#6b6257', RED = '#b3261e', LINE = '#cfc5b1';

// ---------------------------------------------------------------- Fichier PDF minimal (images JPEG + traits)
async function jpeg(canvas, q = 0.92) {
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', q));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w: canvas.width, h: canvas.height };
}
function buildPDF(pages, title) {
  const enc = new TextEncoder();
  const chunks = []; let size = 0;
  const offsets = [];
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); size += b.length; };
  const f = (n) => (Math.round(n * 100) / 100).toString();
  // Numérotation : 1 catalogue, 2 pages, 3 infos, puis pour chaque page : page, contenu, images
  let next = 4;
  const plan = pages.map((p) => ({ page: next++, content: next++, imgs: p.images.map(() => next++) }));
  const total = next;
  const obj = (n, body) => { offsets[n] = size; push(`${n} 0 obj\n`); for (const b of [].concat(body)) push(b); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${pages.length} /Kids [${plan.map((p) => `${p.page} 0 R`).join(' ')}] >>`);
  // Texte des métadonnées en UTF-16 (accents, ∞)
  const u16 = (str) => '<FEFF' + [...String(str)].map((ch) => { const c = ch.codePointAt(0); const hex = (n) => n.toString(16).padStart(4, '0'); if (c < 0x10000) return hex(c); const v = c - 0x10000; return hex(0xD800 + (v >> 10)) + hex(0xDC00 + (v & 0x3FF)); }).join('').toUpperCase() + '>';
  obj(3, `<< /Title ${u16(title)} /Creator ${u16("DUST 194∞ · L'Heure du Loir")} >>`);
  const W = A4.w * MM, H = A4.h * MM;
  pages.forEach((p, i) => {
    const P = plan[i];
    const xo = P.imgs.map((n, k) => `/Im${k} ${n} 0 R`).join(' ');
    obj(P.page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(W)} ${f(H)}] /Resources << /XObject << ${xo} >> >> /Contents ${P.content} 0 R >>`);
    let c = '';
    p.images.forEach((im, k) => {
      const w = im.W * MM, h = im.H * MM, x = im.x * MM, y = H - (im.y + im.H) * MM;
      c += `q ${f(w)} 0 0 ${f(h)} ${f(x)} ${f(y)} cm /Im${k} Do Q\n`;
    });
    if (p.lines?.length) {
      c += '0.35 w 0.45 G\n';
      for (const [x1, y1, x2, y2] of p.lines) c += `${f(x1 * MM)} ${f(H - y1 * MM)} m ${f(x2 * MM)} ${f(H - y2 * MM)} l S\n`;
    }
    obj(P.content, [`<< /Length ${enc.encode(c).length} >>\nstream\n`, c, '\nendstream']);
    p.images.forEach((im, k) => {
      obj(P.imgs[k], [`<< /Type /XObject /Subtype /Image /Width ${im.img.w} /Height ${im.img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.img.bytes.length} >>\nstream\n`, im.img.bytes, '\nendstream']);
    });
  });
  const xref = size;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) x += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
  push(x);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}

// ---------------------------------------------------------------- Récapitulatif (SVG A4, unité = 0,1 mm)
// recap = { title, lines: [..], confidential, sections: [{ title, note, rows: [{ name, cost, detail }] }], notes: [..], notesTitle }
function recapSVGs(recap) {
  const PW = 2100, PH = 2970, MX = 150, BOTTOM = PH - 230;
  const pages = [];
  let out, y;
  const text = (x, yy, s, size, { w = 400, fill = INK, anchor = 'start', font = FONT, extra = '' } = {}) =>
    `<text x="${x}" y="${yy}" font-family="${xe(font)}" font-size="${size}" font-weight="${w}" fill="${fill}" text-anchor="${anchor}" ${extra}>${xe(s)}</text>`;
  const start = (first) => {
    out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH}"><defs></defs><rect width="${PW}" height="${PH}" fill="#fff"/>`];
    y = 170;
    if (first) {
      const tl = wrap(recap.title, `400 110px ${FONT_NAME}`, PW - 2 * MX);
      for (const l of tl.slice(0, 2)) { out.push(text(MX, y, l, 110, { font: FONT_NAME })); y += 120; }
      y -= 40;
      for (const l of recap.lines) { y += 62; out.push(text(MX, y, l, 44, { w: 500, fill: MUTED })); }
      if (recap.confidential) {
        y += 90;
        out.push(`<rect x="${MX}" y="${y - 58}" width="560" height="78" fill="none" stroke="${RED}" stroke-width="6"/>`);
        out.push(text(MX + 280, y - 4, 'CONFIDENTIAL', 50, { w: 700, fill: RED, anchor: 'middle', font: "'IBM Plex Mono', 'DejaVu Sans Mono', monospace", extra: 'letter-spacing="6"' }));
        out.push(text(MX + 590, y - 6, t('Contient des créations de la communauté, non officielles'), 36, { fill: RED }));
      }
      y += 50;
      out.push(`<rect x="${MX}" y="${y}" width="${PW - 2 * MX}" height="6" fill="${INK}"/>`);
      y += 40;
    } else {
      out.push(text(MX, y - 40, `${recap.title} (${t('suite')})`, 48, { w: 600, fill: MUTED })); y += 10;
    }
  };
  const finish = () => { pages.push(out); };
  const need = (h) => { if (y + h > BOTTOM) { finish(); start(false); } };
  start(true);
  for (const sec of recap.sections) {
    const noteL = sec.note ? wrap(sec.note, `italic 400 36px ${FONT}`, PW - 2 * MX) : [];
    need(110 + noteL.length * 44 + 90);
    y += 90; out.push(text(MX, y, sec.title, 58, { w: 700 }));
    for (const l of noteL) { y += 46; out.push(text(MX, y, l, 36, { fill: MUTED, extra: 'font-style="italic"' })); }
    y += 24;
    for (const r of sec.rows) {
      const det = r.detail ? wrap(r.detail, `400 34px ${FONT}`, PW - 2 * MX - 60) : [];
      need(70 + det.length * 42 + 20);
      y += 62;
      out.push(`<circle cx="${MX + 14}" cy="${y - 15}" r="9" fill="${INK}"/>`);
      out.push(text(MX + 44, y, r.name, 46, { w: 600 }));
      if (r.cost !== undefined && r.cost !== '') out.push(text(PW - MX, y, r.cost, 46, { w: 700, anchor: 'end' }));
      for (const l of det) { y += 42; out.push(text(MX + 44, y, l, 34, { fill: MUTED })); }
      y += 18;
      out.push(`<rect x="${MX + 44}" y="${y}" width="${PW - 2 * MX - 44}" height="2" fill="${LINE}"/>`);
    }
  }
  if (recap.notes?.length) {
    need(200);
    y += 100; out.push(text(MX, y, recap.notesTitle || t('Rappels'), 52, { w: 700 }));
    for (const n of recap.notes) {
      const ls = wrap(n, `400 34px ${FONT}`, PW - 2 * MX - 50);
      need(ls.length * 42 + 20);
      y += 50; out.push(text(MX + 10, y, '•', 34)); out.push(text(MX + 44, y, ls[0], 34));
      for (const l of ls.slice(1)) { y += 42; out.push(text(MX + 44, y, l, 34)); }
    }
  }
  finish();
  // Pied de page : crédit + numéro de page
  return pages.map((o, i) => {
    o.push(`<rect x="${MX}" y="${PH - 175}" width="${PW - 2 * MX}" height="2" fill="${LINE}"/>`);
    o.push(`<image href="${LOGO}" x="${MX}" y="${PH - 150}" width="80" height="80"/>`);
    o.push(text(MX + 100, PH - 97, `DUST 194∞ · ${creditLine()}`, 34, { w: 600, fill: MUTED }));
    o.push(text(PW - MX, PH - 97, `${new Date().toLocaleDateString()} · ${i + 1}/${pages.length}`, 34, { fill: MUTED, anchor: 'end' }));
    o.push('</svg>');
    return o.join('\n');
  });
}

// Quart de tour (sens horaire) d'une carte large pour la placer debout sur la page
function rotated(src) {
  const c = document.createElement('canvas');
  c.width = src.height; c.height = src.width;
  const g = c.getContext('2d');
  g.translate(c.width, 0); g.rotate(Math.PI / 2); g.drawImage(src, 0, 0);
  return c;
}

// ---------------------------------------------------------------- Export
// cards = [{ u, D, cost, photo, focus, credit }]
export async function exportListPDF({ filename, recap, cards = [], includeCards = true, format = 'square', onProgress = () => {} }) {
  const G = gridOf(LAYOUTS[format] || LAYOUTS.square);
  await cardFontsReady();
  const pages = [];
  const recapSvgs = recapSVGs(recap);
  const list = includeCards ? cards : [];
  const steps = recapSvgs.length + list.length;
  let done = 0;
  for (const svg of recapSvgs) {
    const c = await svgCanvas(svg, { scale: 1, bg: '#fff' });
    pages.push({ images: [{ img: await jpeg(c, 0.9), x: 0, y: 0, W: A4.w, H: A4.h }] });
    onProgress(++done, steps);
  }
  const per = G.cols * G.rows;
  for (let i = 0; i < list.length; i += per) {
    const images = [];
    const chunk = list.slice(i, i + per);
    for (const [k, card] of chunk.entries()) {
      const svg = generatedCardSVG(card.u, card.D, { cost: card.cost, photo: card.photo || null, focus: card.focus || null, format, credit: card.credit || '' });
      let c = await svgCanvas(svg, { scale: 1, bg: '#fff' });
      if (G.rotate) c = rotated(c);
      const col = k % G.cols, row = Math.floor(k / G.cols);
      // Une carte très chargée (plus haute que prévu) est réduite pour tenir dans son emplacement
      const sc = Math.min(G.cw / c.width, G.ch / c.height);
      const W = c.width * sc, H = c.height * sc;
      images.push({ img: await jpeg(c), x: G.x + col * G.cw + (G.cw - W) / 2, y: G.y + row * G.ch + (G.ch - H) / 2, W, H });
      onProgress(++done, steps);
    }
    // Traits de coupe dans les marges, dans le prolongement des bords des cartes
    const rows = Math.ceil(chunk.length / G.cols), cols = Math.min(G.cols, chunk.length);
    const lines = [];
    const x0 = G.x, y0 = G.y, x1 = G.x + cols * G.cw, y1 = G.y + rows * G.ch, m = 3, L = 8;
    for (let c = 0; c <= cols; c++) { const x = x0 + c * G.cw; lines.push([x, y0 - m - L, x, y0 - m], [x, y1 + m, x, y1 + m + L]); }
    for (let r = 0; r <= rows; r++) { const y = y0 + r * G.ch; lines.push([x0 - m - L, y, x0 - m, y], [x1 + m, y, x1 + m + L, y]); }
    pages.push({ images, lines });
  }
  const blob = buildPDF(pages, recap.title);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return blob;
}

// Fenêtre d'options commune au builder et au Shot Format
export function pdfDialogHTML(nCards) {
  const fmt = store.get(FORMAT_KEY, 'square') === 'wide' ? 'wide' : 'square';
  return `<div class="modal-h"><div><div class="eyebrow">${t('Export')}</div><h2>${t('Exporter en PDF')}</h2></div><button class="btn icon" data-close-btn aria-label="${t('Fermer')}">✕</button></div>
    <div class="modal-b pdf-dlg">
      <p class="hint" style="margin:0">${t('Le PDF contient le récapitulatif de la liste. Vous pouvez y ajouter les cartes des unités, prêtes à imprimer et découper.')}</p>
      <label class="check"><input type="checkbox" id="pdf-cards" checked> ${t('Inclure les cartes des unités ({n})', { n: nCards })}</label>
      <label class="field"><span>${t('Format des cartes')}</span><select id="pdf-format">
        <option value="square" ${fmt === 'square' ? 'selected' : ''}>${t('80 × 80 mm (carrée), 6 par page')}</option>
        <option value="wide" ${fmt === 'wide' ? 'selected' : ''}>${t('120 × 70 mm (format tarot, texte complet des compétences), 4 par page')}</option>
      </select></label>
      <p class="hint" style="margin:0">${t('Pages A4 avec traits de coupe. Imprimez à 100 % (taille réelle), sans « ajuster à la page ».')}</p>
      <div class="pdf-acts"><button class="btn primary" id="pdf-go">${t('Télécharger le PDF')}</button><span class="hint" id="pdf-status" role="status"></span></div>
    </div>`;
}
export function bindPdfDialog(root, run) {
  const go = root.querySelector('#pdf-go'), st = root.querySelector('#pdf-status');
  const cb = root.querySelector('#pdf-cards'), sel = root.querySelector('#pdf-format');
  cb.addEventListener('change', () => { sel.disabled = !cb.checked; });
  go.addEventListener('click', async () => {
    go.disabled = true;
    try {
      const format = root.querySelector('#pdf-format').value;
      store.set(FORMAT_KEY, format);
      await run({ includeCards: root.querySelector('#pdf-cards').checked, format }, (d, n) => { st.textContent = t('Création du PDF… {d}/{n}', { d, n }); });
      st.textContent = t('PDF téléchargé.');
    } catch (e) {
      console.error(e);
      st.textContent = t('Impossible de créer le PDF dans ce navigateur.');
    }
    go.disabled = false;
  });
}
