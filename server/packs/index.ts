import { randomInt } from 'node:crypto';
import type { PackMeta } from '../../shared/types';
import { clueRevealsWord, foldForCompare, tokens } from '../text';
import animaux from './animaux';
import animeManga from './anime-manga';
import chanteurs from './chanteurs';
import filmsSeries from './films-series';
import football from './football';
import jeuxVideo from './jeux-video';
import nourriture from './nourriture';
import objets from './objets';
import rapFr from './rap-fr';
import type { WordPack, WordPair } from './types';
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
  civilDescription: string;
  undercoverDescription: string;
  /** Thème commun, réservé à Mr. White. */
  theme: string;
}

/**
 * Tire une paire uniquement parmi les packs sélectionnés, en évitant celles déjà jouées
 * dans le salon tant que la réserve n'est pas épuisée. Le mot des Civils est tiré au sort.
 */
export function drawPair(packIds: readonly string[], used: Set<string>): DrawnPair {
  const pool: { id: string; pack: WordPack; pair: WordPair }[] = [];
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
  const [civil, undercover] = randomInt(2) === 1 ? [pick.pair.b, pick.pair.a] : [pick.pair.a, pick.pair.b];
  return {
    id: pick.id,
    packId: pick.pack.id,
    packName: pick.pack.name,
    civil: civil.word,
    undercover: undercover.word,
    civilDescription: civil.description,
    undercoverDescription: undercover.description,
    theme: pick.pair.theme,
  };
}

const ROLE_WORDS = ['civil', 'civils', 'undercover', 'intrus', 'mr white', 'imposteur'];

/** Mots significatifs (4 lettres et plus) d'un mot secret. */
function keyTokens(word: string): string[] {
  return tokens(word).filter((t) => t.length >= 4);
}

/** Vrai si le texte cite le mot, ou l'un de ses termes distinctifs absents du mot autorisé. */
function mentions(text: string, word: string, allowed = ''): boolean {
  if (clueRevealsWord(text, word)) return true;
  const own = new Set(tokens(allowed));
  const textTokens = new Set(tokens(text));
  return keyTokens(word).some((t) => !own.has(t) && textTokens.has(t));
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
    for (const { theme, a, b } of pack.pairs) {
      const label = `${pack.name} « ${a.word} / ${b.word} »`;
      const fa = foldForCompare(a.word);
      const fb = foldForCompare(b.word);
      if (!fa || !fb) issues.push(`${label} : mot vide`);
      if (fa === fb) issues.push(`${label} : paire identique`);
      const key = [fa, fb].sort().join(' | ');
      const seen = pairKeys.get(key);
      if (seen) issues.push(`${label} : paire en double (${seen})`);
      pairKeys.set(key, pack.name);

      // Descriptions : privées, factuelles, sans l'autre mot ni allusion à un rôle.
      for (const [own, other] of [[a, b], [b, a]] as const) {
        const d = own.description.trim();
        if (d.length < 15 || d.length > 110) issues.push(`${label} : description de « ${own.word} » de ${d.length} caractères (15 à 110)`);
        if (mentions(d, other.word, own.word)) issues.push(`${label} : la description de « ${own.word} » évoque « ${other.word} »`);
        if (ROLE_WORDS.some((r) => clueRevealsWord(d, r))) issues.push(`${label} : la description de « ${own.word} » évoque un rôle`);
      }

      // Thème de Mr. White : commun, large, sans mot ni terme distinctif de la paire.
      const t = theme.trim();
      if (t.length < 4 || t.length > 40) issues.push(`${label} : thème de ${t.length} caractères (4 à 40)`);
      if (foldForCompare(t) === foldForCompare(pack.name)) issues.push(`${label} : thème identique au nom du pack`);
      if (mentions(t, a.word) || mentions(t, b.word)) issues.push(`${label} : le thème « ${t} » révèle un mot`);
    }
  }
  return issues;
}
