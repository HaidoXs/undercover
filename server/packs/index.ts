import { randomInt } from 'node:crypto';
import type { PackMeta } from '../../shared/types';
import { foldForCompare } from '../text';
import animaux from './animaux';
import animeManga from './anime-manga';
import chanteurs from './chanteurs';
import filmsSeries from './films-series';
import football from './football';
import jeuxVideo from './jeux-video';
import nourriture from './nourriture';
import objets from './objets';
import rapFr from './rap-fr';
import type { WordPack } from './types';
import voyage from './voyage';

/**
 * Registre des packs. Pour en ajouter un : créer un fichier sur le modèle des autres
 * (definePack), puis l'ajouter à cette liste. `npm test` vérifie les règles de contenu.
 */
export const PACKS: readonly WordPack[] = [
  animeManga,
  chanteurs,
  rapFr,
  filmsSeries,
  jeuxVideo,
  football,
  nourriture,
  animaux,
  objets,
  voyage,
];

export const MIN_PAIRS_PER_PACK = 30;

const PACKS_BY_ID = new Map(PACKS.map((pack) => [pack.id, pack]));

/** Métadonnées publiques : jamais les mots eux-mêmes. */
export const PACK_META: readonly PackMeta[] = PACKS.map((pack) => ({
  id: pack.id,
  name: pack.name,
  description: pack.description,
  icon: pack.icon,
  pairCount: pack.pairs.length,
}));

export function isPackId(value: unknown): value is string {
  return typeof value === 'string' && PACKS_BY_ID.has(value);
}

/** Trie et dédoublonne selon l'ordre du registre. */
export function orderPackIds(ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  return PACKS.filter((p) => wanted.has(p.id)).map((p) => p.id);
}

export interface DrawnPair {
  id: string;
  packId: string;
  packName: string;
  civil: string;
  undercover: string;
}

/**
 * Tire une paire uniquement parmi les packs sélectionnés, en évitant celles déjà jouées
 * dans le salon tant que la réserve n'est pas épuisée. Le mot des Civils est tiré au sort.
 */
export function drawPair(packIds: readonly string[], used: Set<string>): DrawnPair {
  const pool: { id: string; pack: WordPack; pair: readonly [string, string] }[] = [];
  for (const packId of packIds) {
    const pack = PACKS_BY_ID.get(packId);
    if (!pack) continue;
    pack.pairs.forEach((pair, index) => pool.push({ id: `${pack.id}#${index}`, pack, pair }));
  }
  if (pool.length === 0) throw new Error('Aucune paire disponible');

  let available = pool.filter((entry) => !used.has(entry.id));
  if (available.length === 0) {
    for (const entry of pool) used.delete(entry.id);
    available = pool;
  }
  const pick = available[randomInt(available.length)];
  used.add(pick.id);
  const swap = randomInt(2) === 1;
  return {
    id: pick.id,
    packId: pick.pack.id,
    packName: pick.pack.name,
    civil: swap ? pick.pair[1] : pick.pair[0],
    undercover: swap ? pick.pair[0] : pick.pair[1],
  };
}

/** Contrôles de contenu : utilisés par les tests et au démarrage du serveur. */
export function packIssues(packs: readonly WordPack[] = PACKS): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  const pairKeys = new Map<string, string>();

  for (const pack of packs) {
    if (ids.has(pack.id)) issues.push(`Identifiant de pack en double : ${pack.id}`);
    ids.add(pack.id);
    if (pack.pairs.length < MIN_PAIRS_PER_PACK) {
      issues.push(`${pack.name} : ${pack.pairs.length} paires (minimum ${MIN_PAIRS_PER_PACK})`);
    }
    for (const [a, b] of pack.pairs) {
      const fa = foldForCompare(a);
      const fb = foldForCompare(b);
      if (!fa || !fb) issues.push(`${pack.name} : mot vide dans « ${a} / ${b} »`);
      if (fa === fb) issues.push(`${pack.name} : paire identique « ${a} / ${b} »`);
      const key = [fa, fb].sort().join(' | ');
      const seen = pairKeys.get(key);
      if (seen) issues.push(`Paire en double « ${a} / ${b} » (${seen} et ${pack.name})`);
      pairKeys.set(key, pack.name);
    }
  }
  return issues;
}
