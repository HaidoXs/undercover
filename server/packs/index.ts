import { randomInt } from 'node:crypto';
import type { PackMeta, UniverseMeta } from '../../shared/types';
import animaux from './animaux';
import animeManga from './anime-manga';
import chanteurs from './chanteurs';
import filmsSeries from './films-series';
import football from './football';
import jeuxVideo from './jeux-video';
import nourriture from './nourriture';
import objets from './objets';
import rapFr from './rap-fr';
import type { PairDef, Universe, WordPack } from './types';
import { MIN_UNIVERSE_PAIRS, packIssues as validatePacks } from './validate';
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

export { MAX_PARTNERS, MIN_PAIRS_PER_PACK, MIN_UNIVERSE_PAIRS } from './validate';

const PACKS_BY_ID = new Map(PACKS.map((pack) => [pack.id, pack]));

/** Clé globale d'un univers précis : « pack:univers ». */
export function themeKey(packId: string, universeId: string): string {
  return `${packId}:${universeId}`;
}

export function generalUniverses(pack: WordPack): Universe[] {
  return pack.universes.filter((u) => !u.precise);
}

function preciseUniverses(pack: WordPack): Universe[] {
  return pack.universes.filter((u) => u.precise && u.pairs.length >= MIN_UNIVERSE_PAIRS);
}

/** Métadonnées publiques : jamais les mots eux-mêmes. Un univers n'apparaît que s'il a assez de paires. */
export const PACK_META: readonly PackMeta[] = PACKS.map((pack) => ({
  id: pack.id,
  name: pack.name,
  description: pack.description,
  icon: pack.icon,
  pairCount: generalUniverses(pack).reduce((n, u) => n + u.pairs.length, 0),
  universes: preciseUniverses(pack).map<UniverseMeta>((u) => ({ id: themeKey(pack.id, u.id), name: u.name, pairCount: u.pairs.length })),
}));

export function isPackId(value: unknown): value is string {
  return typeof value === 'string' && PACKS_BY_ID.has(value);
}

/** Trie et dédoublonne selon l'ordre du registre. */
export function orderPackIds(ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  return PACKS.filter((p) => wanted.has(p.id)).map((p) => p.id);
}

export interface ThemeInfo {
  key: string;
  packId: string;
  universe: Universe;
}

/** Univers précis proposé, s'il existe et s'il a assez de paires. */
export function findTheme(key: unknown): ThemeInfo | null {
  if (typeof key !== 'string' || key.length > 80) return null;
  const [packId, universeId] = key.split(':');
  const pack = PACKS_BY_ID.get(packId);
  const universe = pack && preciseUniverses(pack).find((u) => u.id === universeId);
  return pack && universe ? { key, packId, universe } : null;
}

/** Univers précis réellement disponibles dans les packs sélectionnés. */
export function themesFor(packIds: readonly string[]): string[] {
  return packIds.flatMap((id) => {
    const pack = PACKS_BY_ID.get(id);
    return pack ? preciseUniverses(pack).map((u) => themeKey(pack.id, u.id)) : [];
  });
}

export interface DrawnPair {
  id: string;
  packId: string;
  packName: string;
  /** Univers précis de la manche (null en partie normale). */
  themeName: string | null;
  civil: string;
  undercover: string;
  civilDescription: string;
  undercoverDescription: string;
  /** Thème commun, réservé à Mr. White. */
  theme: string;
}

interface PoolEntry {
  id: string;
  pack: WordPack;
  universe: Universe;
  pair: PairDef;
  words: [string, string];
}

function pairId(pack: WordPack, universe: Universe, pair: PairDef): string {
  return `${pack.id}/${universe.id}/${[pair.a, pair.b].sort().join('+')}`;
}

function wordId(pack: WordPack, universe: Universe, key: string): string {
  return `${pack.id}/${universe.id}/${key}`;
}

export interface DrawMemory {
  /** Paires déjà jouées dans le salon (identifiants stables). */
  pairs: Set<string>;
  /** Mots joués récemment : on évite de retrouver tout de suite un mot déjà vu avec un autre partenaire. */
  words: string[];
}

export function newDrawMemory(): DrawMemory {
  return { pairs: new Set(), words: [] };
}

const RECENT_WORDS = 12;

/**
 * Tire une paire parmi les packs sélectionnés (ou dans le seul univers précis choisi), sans répéter une paire
 * du salon tant que la réserve n'est pas épuisée, et en évitant si possible les mots vus récemment.
 * Le mot des Civils est tiré au sort.
 */
export function drawPair(packIds: readonly string[], memory: DrawMemory, themeKeyValue: string | null = null): DrawnPair {
  const pool: PoolEntry[] = [];
  const add = (pack: WordPack, universe: Universe) => {
    for (const pair of universe.pairs) {
      pool.push({ id: pairId(pack, universe, pair), pack, universe, pair, words: [wordId(pack, universe, pair.a), wordId(pack, universe, pair.b)] });
    }
  };
  const theme = themeKeyValue ? findTheme(themeKeyValue) : null;
  if (theme) {
    add(PACKS_BY_ID.get(theme.packId) as WordPack, theme.universe);
  } else {
    for (const packId of packIds) {
      const pack = PACKS_BY_ID.get(packId);
      if (pack) for (const u of generalUniverses(pack)) add(pack, u);
    }
  }
  if (pool.length === 0) throw new Error('Aucune paire disponible');

  let available = pool.filter((entry) => !memory.pairs.has(entry.id));
  if (available.length === 0) {
    for (const entry of pool) memory.pairs.delete(entry.id);
    available = pool;
  }
  const recent = new Set(memory.words);
  const fresh = available.filter((entry) => !entry.words.some((id) => recent.has(id)));
  const candidates = fresh.length > 0 ? fresh : available;
  const pick = candidates[randomInt(candidates.length)];
  memory.pairs.add(pick.id);
  memory.words.push(...pick.words);
  memory.words.splice(0, Math.max(0, memory.words.length - RECENT_WORDS));

  const a = pick.universe.words[pick.pair.a];
  const b = pick.universe.words[pick.pair.b];
  const [civil, undercover] = randomInt(2) === 1 ? [b, a] : [a, b];
  return {
    id: pick.id,
    packId: pick.pack.id,
    packName: pick.pack.name,
    themeName: theme ? theme.universe.name : null,
    civil: civil.word,
    undercover: undercover.word,
    civilDescription: civil.description,
    undercoverDescription: undercover.description,
    theme: pick.pair.theme,
  };
}

/** Contrôles de contenu de tous les packs du registre (tests, démarrage du serveur). */
export function packIssues(packs: readonly WordPack[] = PACKS): string[] {
  return validatePacks(packs);
}
