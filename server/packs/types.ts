/**
 * Organisation du contenu : pack → univers → mots → paires.
 *
 * - Un pack (« Jeux vidéo ») contient un univers général (precise: false), tiré en partie normale,
 *   et éventuellement des univers précis (« League of Legends »), proposés par l'option « Thème précis ».
 * - Chaque mot est décrit une seule fois dans son univers ; les paires référencent les mots par clé.
 *   Un même mot peut ainsi avoir plusieurs partenaires choisis à la main (jamais toutes les combinaisons).
 * - Le serveur tire au sort quel mot de la paire revient aux Civils.
 */

export interface WordEntry {
  word: string;
  /**
   * Courte description factuelle, montrée uniquement au joueur qui reçoit ce mot.
   * Même ton et même niveau de détail pour tous les mots ; jamais de comparaison
   * avec un autre mot, jamais d'allusion à un camp ou à un rôle.
   */
  description: string;
}

export interface PairDef {
  /** Clés de deux mots du même univers. L'ordre est sans importance. */
  a: string;
  b: string;
  /**
   * Thème commun, montré uniquement à Mr. White. Large : une catégorie, jamais une quasi-réponse.
   * En univers précis, il ne répète pas le nom de l'univers (déjà connu de tous).
   */
  theme: string;
}

export interface Universe {
  /** Identifiant stable, unique dans le pack (utilisé dans les paramètres du salon). */
  id: string;
  name: string;
  /** true : univers proposé en « Thème précis » · false : paires générales du pack. */
  precise: boolean;
  words: Readonly<Record<string, WordEntry>>;
  pairs: readonly PairDef[];
}

export interface WordPack {
  /** Identifiant stable (utilisé dans les paramètres du salon). Ne jamais le renommer. */
  id: string;
  name: string;
  description: string;
  /** Nom d'icône Lucide en kebab-case, résolu côté client (voir client/src/components/icons.ts). */
  icon: string;
  universes: readonly Universe[];
}

export function definePack(pack: WordPack): WordPack {
  return pack;
}

export function universe(u: Universe): Universe {
  return u;
}

/** Écriture compacte d'un mot : w('Mana', 'Ressource bleue…'). */
export function w(word: string, description: string): WordEntry {
  return { word, description };
}

/** Écriture compacte d'une paire : p('mana', 'energie', 'Ressources des champions'). */
export function p(a: string, b: string, theme: string): PairDef {
  return { a, b, theme };
}
