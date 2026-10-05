// Sélecteur de compétences à pastilles (Atelier) : remplace la saisie « séparée par des virgules ».
// Il garde un champ caché (name = nom du champ d'origine) contenant la liste séparée par des virgules,
// donc le reste du formulaire (lecture, export, validation) fonctionne exactement comme avant.
import { esc } from './ui.js';
import { t } from './i18n.js';

const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const short = (d) => {
  const s = String(d || '').replace(/[•■]/g, '').replace(/\s+/g, ' ').trim();
  return s.length > 90 ? s.slice(0, 88).trimEnd() + '…' : s;
};

// values : noms choisis ; skills : { nom: description } ; custom : noms des règles inédites du projet ;
// sugg : suggestions fréquentes (noms) ; label : intitulé du champ ; hint : aide facultative
export function skillPickerHTML({ name, label, values = [], skills, custom = [], sugg = [], hint = '' }) {
  const id = 'skp-' + name.replace(/[^\w-]/g, '_');
  const chip = (v) => chipHTML(v, skills, custom);
  const free = sugg.filter((s) => !values.includes(s));
  return `<div class="skp field" data-skp data-sugg="${esc(JSON.stringify(sugg))}" data-custom="${esc(JSON.stringify(custom))}">
    <span id="${id}-l">${esc(label)}</span>
    <input type="hidden" name="${esc(name)}" value="${esc(values.join(', '))}">
    <div class="skp-chips" data-chips>${values.map(chip).join('')}</div>
    <div class="skp-add">
      <input type="text" class="skp-q" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="${id}-list" aria-labelledby="${id}-l" aria-autocomplete="list" placeholder="${esc(t('Ajouter une compétence…'))}" enterkeyhint="done">
      <ul class="skp-list" id="${id}-list" role="listbox" hidden></ul>
    </div>
    <div class="skp-sugg" data-sugg-row ${free.length ? '' : 'hidden'}><span class="hint">${t('Fréquentes pour ce type :')}</span> ${free.map((s) => `<button type="button" class="skp-s" data-add="${esc(s)}">+ ${esc(s)}</button>`).join('')}</div>
    ${hint ? `<p class="hint" style="margin:0">${hint}</p>` : ''}
  </div>`;
}

function chipHTML(v, skills, custom) {
  const known = Object.prototype.hasOwnProperty.call(skills, v);
  const cls = known ? '' : custom.includes(v) ? ' custom' : ' unknown';
  const title = known ? short(skills[v]) : custom.includes(v) ? t('Règle inédite') : t("Compétence inconnue : ce n'est pas une compétence officielle.");
  return `<span class="skp-chip${cls}" data-skill="${esc(v)}" title="${esc(title)}">${esc(v)}<button type="button" data-rm aria-label="${esc(t('Retirer {n}', { n: v }))}">✕</button></span>`;
}

// root : conteneur du formulaire ; skills : { nom: description } ; onCreate(nom, champ) : « Créer comme règle inédite »
export function bindSkillPickers(root, { skills, onCreate }) {
  const names = Object.keys(skills).sort((a, b) => a.localeCompare(b));
  root.querySelectorAll('[data-skp]').forEach((box) => {
    const hidden = box.querySelector('input[type=hidden]');
    const chips = box.querySelector('[data-chips]');
    const q = box.querySelector('.skp-q');
    const ul = box.querySelector('.skp-list');
    const suggRow = box.querySelector('[data-sugg-row]');
    const sugg = JSON.parse(box.dataset.sugg || '[]');
    const custom = JSON.parse(box.dataset.custom || '[]');
    let items = [], active = -1;

    const get = () => hidden.value.split(',').map((s) => s.trim()).filter(Boolean);
    const set = (arr) => {
      hidden.value = arr.join(', ');
      chips.innerHTML = arr.map((v) => chipHTML(v, skills, custom)).join('');
      const free = sugg.filter((s) => !arr.includes(s));
      suggRow.innerHTML = `<span class="hint">${t('Fréquentes pour ce type :')}</span> ` + free.map((s) => `<button type="button" class="skp-s" data-add="${esc(s)}">+ ${esc(s)}</button>`).join('');
      suggRow.hidden = !free.length;
      hidden.dispatchEvent(new Event('change', { bubbles: true })); // le formulaire enregistre et redessine l'aperçu
    };
    const add = (v) => { const a = get(); if (v && !a.includes(v)) { a.push(v); set(a); } };
    const close = () => { ul.hidden = true; q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-activedescendant'); active = -1; };
    const paint = () => {
      ul.innerHTML = items.map((it, i) => `<li role="option" id="${ul.id}-${i}" data-i="${i}" class="${i === active ? 'on' : ''}" aria-selected="${i === active}">${
        it.create ? `<b>${esc(t('Créer « {n} » comme règle inédite', { n: it.name }))}</b>`
          : `<b>${esc(it.name)}</b><small>${esc(short(skills[it.name]))}</small>`}</li>`).join('');
      ul.hidden = !items.length;
      q.setAttribute('aria-expanded', String(!!items.length));
      if (active >= 0) q.setAttribute('aria-activedescendant', `${ul.id}-${active}`); else q.removeAttribute('aria-activedescendant');
      ul.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
    };
    const search = () => {
      const k = norm(q.value);
      if (!k) { items = []; return close(); }
      const have = new Set(get());
      const pool = names.filter((n) => !have.has(n));
      const starts = pool.filter((n) => norm(n).startsWith(k));
      const inside = pool.filter((n) => !norm(n).startsWith(k) && (norm(n).includes(k) || norm(skills[n]).includes(k)));
      items = [...starts, ...inside].slice(0, 8).map((name) => ({ name }));
      const exact = names.some((n) => norm(n) === k);
      if (!exact && !have.has(q.value.trim()) && !k.includes(',')) items.push({ name: q.value.trim(), create: true });
      active = items.length ? 0 : -1;
      paint();
    };
    const choose = (it) => {
      if (!it) return;
      q.value = '';
      if (it.create) { add(it.name); onCreate?.(it.name, hidden.name); }
      else add(it.name);
      items = []; close(); q.focus();
    };

    q.addEventListener('input', search);
    q.addEventListener('focus', search);
    q.addEventListener('blur', () => setTimeout(close, 120));
    q.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); active = (active + 1) % items.length; paint(); }
      else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); active = (active - 1 + items.length) % items.length; paint(); }
      else if (e.key === 'Escape') { if (!ul.hidden) { e.preventDefault(); e.stopPropagation(); close(); } }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (q.value.includes(',')) { // liste collée « A, B, C » : on ajoute ce qui est reconnu
          const rest = [];
          for (const p of q.value.split(',').map((s) => s.trim()).filter(Boolean)) {
            const hit = names.find((n) => norm(n) === norm(p));
            if (hit) add(hit); else rest.push(p);
          }
          q.value = rest.join(', '); search(); return;
        }
        choose(items[active]);
      } else if (e.key === 'Backspace' && !q.value) { const a = get(); if (a.length) { a.pop(); set(a); } }
    });
    ul.addEventListener('mousedown', (e) => { // mousedown : avant la perte de focus du champ
      const li = e.target.closest('li'); if (!li) return;
      e.preventDefault(); choose(items[+li.dataset.i]);
    });
    chips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rm]'); if (!b) return;
      const v = b.closest('[data-skill]').dataset.skill;
      set(get().filter((x) => x !== v));
    });
    suggRow.addEventListener('click', (e) => { const b = e.target.closest('[data-add]'); if (b) add(b.dataset.add); });
  });
}
