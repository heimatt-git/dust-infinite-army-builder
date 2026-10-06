// Fiche d'unité complète, commune au builder et au Shot Format :
// carte générée (PNG), choix de l'image (ma photo / photo communautaire / pixel art / icône), images de carte perso.
import { esc, toast, openModal, unitCardHTML } from './ui.js';
import { t } from './i18n.js';
import { generatedCardSVG, cardPNG, cardFontsReady } from './cardgen.js';
import { pixelListed, pixelPath, pixelMini, resolveArt, getPrefs, setPrefs, ownPhotoAvailable, ownPhotoURL, saveOwnPhoto, deleteOwnPhoto } from './cardart.js';
import { framingHTML, mountFraming } from './framing.js';
import { imagesAvailable, imageURL, hasImage, saveImage, deleteImage, SIDES } from './images.js';

let D = null; // base de données de la fiche ouverte
const communityPhotos = (id) => D.photos?.[id] || [];

// Miniature : petite version (160 px) de l'illustration de l'unité, si elle en a une
export function thumb(id, size = 64) {
  return pixelListed(id) ? `<img class="thumb" src="${esc(pixelMini(id))}" alt="" width="${size}" height="${size}" loading="lazy" onerror="this.onerror=null;this.src='${esc(pixelPath(id))}'">` : '';
}

// Image de la carte générée d'une unité (ma photo → photo de la communauté → pixel art → icône)
export function artOf(u, data = D) {
  const a = resolveArt(u, data?.photos?.[u.id] || []);
  const c = a.credit;
  const credit = c ? `${t('Photo :')} ${c.author}${c.license && /^CC/i.test(c.license) ? ' · ' + c.license : ''}` : '';
  return { photo: a.photo, focus: a.focus, credit };
}


function imagesSectionHTML(u) {
  if (!imagesAvailable()) return `<p class="hint" style="margin:0">${t('Images de cartes indisponibles dans ce navigateur (navigation privée ?).')}</p>`;
  const slot = (side) => {
    const src = imageURL(u.id, side);
    return `<div class="img-slot">
      <div class="eyebrow">${t(SIDES[side])}</div>
      ${src ? `<button class="img-view" data-zoom="${side}" aria-label="${t('Agrandir le {s}', { s: t(SIDES[side]).toLowerCase() })}"><img src="${src}" alt="${esc(t('{s} de la carte {n}', { s: t(SIDES[side]), n: u.name }))}"></button>`
        : `<div class="img-empty">${t('Aucune image')}</div>`}
      <div class="img-acts">
        <label class="btn sm">${src ? t('Remplacer') : t('Ajouter')}<input type="file" accept="image/*" data-up="${side}" hidden></label>
        ${src ? `<button class="btn sm danger" data-delimg="${side}">${t('Retirer')}</button>` : ''}
      </div>
    </div>`;
  };
  return `<details class="img-box">
    <summary>${t('Mes images de la carte officielle (option)')} ${hasImage(u.id) ? `<span class="hint">${t('({n} image(s))', { n: ['front', 'back'].filter((sd) => imageURL(u.id, sd)).length })}</span>` : ''}</summary>
    <div class="img-grid">${slot('front')}${slot('back')}</div>
    <p class="hint" style="margin:0">${t("Image gardée uniquement dans ce navigateur, pour votre usage personnel. Elle n'est ni envoyée ni partagée.")}</p>
  </details>`;
}

// Image de la carte générée : pixel art par défaut ; photo de la communauté ou photo perso en option (choix local)
const artLabel = (u) => ({ mine: t('Ma photo'), community: t('Photo de la communauté'), pixel: t('Pixel art'), none: t('Icône par défaut') })[resolveArt(u, communityPhotos(u.id)).kind];
function cardArtSectionHTML(u, open = false) {
  const ph = communityPhotos(u.id)[0];
  const p = getPrefs(u.id);
  const mineURL = ownPhotoURL(u.id);
  const credit = ph ? `${t('Photo :')} ${esc(ph.author)}${ph.license ? ' · ' + esc(ph.license) : ''}` : '';
  return `<details class="img-box art-box"${open ? ' open' : ''}>
    <summary>${t('Image de la carte générée')} <span class="hint" data-art-state>${esc(artLabel(u))}</span></summary>
    <div class="community">
      <p class="hint" style="margin:0">${t("Par défaut, la carte affiche le pixel art de l'unité (ou une icône s'il n'existe pas encore). Vos choix restent dans ce navigateur.")}</p>
      ${ph ? `<div class="art-opt">
        <label class="check"><input type="checkbox" data-art="comm" ${p.comm && !(p.mine && mineURL) ? 'checked' : ''}> ${t('Utiliser la photo de la communauté')}</label>
        <figure class="art-fig"><img src="${esc(ph.file)}" alt="${esc(t('Figurine {n} peinte par {a}', { n: u.name, a: ph.author }))}" loading="lazy"><figcaption>${credit}</figcaption></figure>
      </div>` : ''}
      ${ownPhotoAvailable() ? `<div class="art-opt">
        <label class="check"><input type="checkbox" data-art="mine" ${p.mine && mineURL ? 'checked' : ''} ${mineURL ? '' : 'disabled'}> ${t('Utiliser ma photo')}</label>
        <div class="img-acts">
          <label class="btn sm">${mineURL ? t('Remplacer') : t('Ajouter ma photo')}<input type="file" accept="image/*" data-own hidden></label>
          ${mineURL ? `<button type="button" class="btn sm danger" data-own-rm>${t('Retirer')}</button>` : ''}
        </div>
        ${mineURL ? framingHTML() : ''}
        <p class="hint" style="margin:0">${t("Votre photo reste dans ce navigateur : elle n'est ni envoyée ni partagée, et ne s'affiche que sur votre carte générée.")}</p>
      </div>` : ''}
    </div>
  </details>`;
}
function bindCardArt(root, u, cost, rerender) {
  const box = root.querySelector('.art-box');
  if (!box) return;
  const redraw = () => {
    const w = root.querySelector('.gcard-wrap'); if (w?.isConnected) w.innerHTML = cardSVG(u, cost);
    const st = box.querySelector('[data-art-state]'); if (st) st.textContent = artLabel(u);
  };
  box.querySelectorAll('[data-art]').forEach((cb) => cb.addEventListener('change', () => {
    const kind = cb.dataset.art;
    if (cb.checked) {
      setPrefs(u.id, kind === 'mine' ? { mine: true, comm: false } : { comm: true, mine: false });
      box.querySelectorAll('[data-art]').forEach((o) => { if (o !== cb) o.checked = false; });
    } else setPrefs(u.id, { [kind]: false });
    redraw();
  }));
  box.querySelector('[data-own]')?.addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    try { await saveOwnPhoto(u.id, f); toast(t('Photo enregistrée')); rerender(box.open); }
    catch (e) { toast(e.message === 'storage' ? t("Stockage d'images indisponible dans ce navigateur.") : e.message); }
  });
  box.querySelector('[data-own-rm]')?.addEventListener('click', async () => { await deleteOwnPhoto(u.id); rerender(box.open); });
  // Le cadrage se règle sur la zone affichée : on ne le monte que lorsque la section est ouverte
  const fr = box.querySelector('.framing');
  let mounted = false;
  const mountFr = () => {
    if (mounted || !fr || !box.open) return;
    mounted = true;
    mountFraming(fr, ownPhotoURL(u.id), getPrefs(u.id).focus, (focus) => { setPrefs(u.id, { focus }); redraw(); });
  };
  box.addEventListener('toggle', mountFr);
  mountFr();
  return redraw;
}

// Carte générée (format mono-face) à partir des données, avec export PNG
const cardSVG = (u, cost) => { const a = artOf(u); return generatedCardSVG(u, D, { cost, photo: a.photo || null, focus: a.focus, credit: a.credit }); };
function generatedCardSection(u, cost) {
  return `<div class="gcard-box"><button type="button" class="gcard-wrap" data-zoomc title="${t('Agrandir')}" aria-label="${t('Agrandir')}">${cardSVG(u, cost)}</button>
    <div class="gcard-acts"><button type="button" class="btn sm" data-png>${t('Télécharger la carte (PNG)')}</button>
    <span class="hint">${t('Carte générée à partir de la base : cliquez dessus pour l\'agrandir. Le texte complet des compétences est détaillé plus bas.')}</span></div></div>`;
}
const fileSlug = (s) => String(s || 'carte').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function openUnitCard(u, data, { cap = false, cost, onImages } = {}) {
  D = data;
  openModal(unitCardHTML(u, D, { cost, captured: cap, topHTML: generatedCardSection(u, cost) + cardArtSectionHTML(u) + imagesSectionHTML(u) }), (root, close) => {
    // Redessine la carte une fois ses polices chargées (les textes sont mesurés avec la bonne police)
    const rerenderArt = (open) => { const b = root.querySelector('.art-box'); if (b) b.outerHTML = cardArtSectionHTML(u, open); bindCardArt(root, u, cost, rerenderArt)?.(); };
    const redrawArt = bindCardArt(root, u, cost, rerenderArt);
    // Redessine la carte une fois ses polices chargées (les textes sont mesurés avec la bonne police)
    cardFontsReady().then(() => redrawArt?.());
    root.querySelector('[data-png]')?.addEventListener('click', async (ev) => {
      const b = ev.currentTarget; b.disabled = true;
      try {
        const blob = await cardPNG(root.querySelector('.gcard-wrap svg').outerHTML);
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${fileSlug(u.name)}.png`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } catch { toast(t('Impossible de créer l\'image dans ce navigateur.')); }
      b.disabled = false;
    });
    root.querySelectorAll('[data-zoomc]').forEach((b) => b.addEventListener('click', () => b.classList.toggle('zoomed')));
    root.querySelectorAll('[data-up]').forEach((inp) => inp.addEventListener('change', async () => {
      const f = inp.files[0];
      if (!f) return;
      try { await saveImage(u.id, inp.dataset.up, f); toast(t('Image enregistrée')); close(); onImages?.(); openUnitCard(u, data, { cap, cost, onImages }); }
      catch (e) { toast(e.message); }
    }));
    root.querySelectorAll('[data-delimg]').forEach((b) => b.addEventListener('click', async () => {
      await deleteImage(u.id, b.dataset.delimg); close(); onImages?.(); openUnitCard(u, data, { cap, cost, onImages });
    }));
    root.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => b.classList.toggle('zoomed')));
  });
}
