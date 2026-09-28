#!/usr/bin/env node
// Protection contre le cache : donne un numéro de version aux fichiers JS et CSS des pages.
// À lancer après chaque modification du code : node scripts/bump-version.mjs
// Chaque page reçoit une « import map » qui ajoute ?v=VERSION à tous les modules JS,
// pour que le navigateur ne mélange jamais d'anciens et de nouveaux fichiers.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const version = process.argv[2] || new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const modules = readdirSync(new URL('js/', root)).filter((f) => f.endsWith('.js')).sort();
const map = JSON.stringify({ imports: Object.fromEntries(modules.map((m) => [`./js/${m}`, `./js/${m}?v=${version}`])) });
const block = `<!-- version:start -->\n<script type="importmap">${map}</script>\n<!-- version:end -->`;

const pages = readdirSync(root).filter((f) => f.endsWith('.html'));
for (const page of pages) {
  const url = new URL(page, root);
  let html = readFileSync(url, 'utf8');
  if (!/<script type="module"/.test(html)) continue;
  // import map (remplacée si elle existe déjà), placée avant le premier module
  html = html.replace(/<!-- version:start -->[\s\S]*?<!-- version:end -->\n?/, '');
  html = html.replace(/<script type="module"/, `${block}\n<script type="module"`);
  // version sur le module d'entrée et les feuilles de style locales
  html = html.replace(/(<script type="module" src="js\/[\w.-]+\.js)(\?v=[\w.-]+)?"/g, `$1?v=${version}"`);
  html = html.replace(/(<link rel="stylesheet" href="css\/[\w.-]+\.css)(\?v=[\w.-]+)?"/g, `$1?v=${version}"`);
  writeFileSync(url, html);
  console.log(`${page} → version ${version}`);
}
