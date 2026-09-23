/**
 * Vérifie un ou plusieurs packs : npx tsx scripts/check-pack.ts nourriture animaux
 * Affiche chaque problème de contenu (descriptions, thèmes, doublons, partenaires).
 * Les fichiers sont chargés un par un : un pack se vérifie même si un autre est en chantier.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { WordPack } from '../server/packs/types';
import { packIssues } from '../server/packs/validate';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server/packs');
const all = readdirSync(dir)
  .filter((f) => f.endsWith('.ts') && !['index.ts', 'types.ts', 'validate.ts'].includes(f))
  .map((f) => f.replace(/\.ts$/, ''));
const ids = process.argv.slice(2);
const unknown = ids.filter((id) => !all.includes(id));
if (unknown.length) {
  console.error('Pack inconnu :', unknown.join(', '));
  process.exit(2);
}
const selected: WordPack[] = [];
for (const id of ids.length ? ids : all) {
  selected.push((await import(pathToFileURL(path.join(dir, `${id}.ts`)).href)).default as WordPack);
}
const issues = packIssues(selected);
for (const issue of issues) console.log('✗', issue);
for (const pack of selected) {
  const detail = pack.universes.map((u) => `${u.precise ? u.name : 'général'} : ${u.pairs.length} paires, ${Object.keys(u.words).length} mots`);
  console.log(`· ${pack.name} — ${detail.join(' · ')}`);
}
console.log(issues.length ? `${issues.length} problème(s)` : `OK — ${selected.length} pack(s)`);
process.exit(issues.length ? 1 : 0);
