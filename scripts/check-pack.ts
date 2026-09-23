/**
 * Vérifie un ou plusieurs packs : npx tsx scripts/check-pack.ts nourriture animaux
 * Affiche chaque problème de contenu (descriptions, thèmes, doublons).
 */
import { PACKS, packIssues } from '../server/packs/index';

const ids = process.argv.slice(2);
const selected = ids.length ? PACKS.filter((p) => ids.includes(p.id)) : PACKS;
if (ids.length && selected.length !== ids.length) {
  console.error('Pack inconnu parmi :', ids.join(', '));
  process.exit(2);
}
const issues = packIssues(selected);
for (const issue of issues) console.log('✗', issue);
const pairs = selected.reduce((n, p) => n + p.pairs.length, 0);
console.log(issues.length ? `${issues.length} problème(s)` : `OK — ${selected.length} pack(s), ${pairs} paires`);
process.exit(issues.length ? 1 : 0);
