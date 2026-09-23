export interface WordEntry {
  word: string;
  /**
   * Courte description factuelle, montrée uniquement au joueur qui reçoit ce mot.
   * Ne jamais y citer l'autre mot de la paire ni suggérer un rôle.
   */
  description: string;
}

export interface WordPair {
  /**
   * Thème commun aux deux mots, montré uniquement à Mr. White.
   * Plus précis que le nom du pack, mais sans mot, initiale, longueur ni description évidente.
   */
  theme: string;
  a: WordEntry;
  b: WordEntry;
}

export interface WordPack {
  /** Identifiant stable (utilisé dans les paramètres du salon). Ne jamais le renommer. */
  id: string;
  name: string;
  description: string;
  /** Nom d'icône Lucide en kebab-case, résolu côté client (voir client/src/components/icons.ts). */
  icon: string;
  /**
   * Paires de mots proches. L'ordre à l'intérieur d'une paire est sans importance :
   * le serveur tire au sort quel mot revient aux Civils.
   * Ajouter des paires en fin de liste pour garder des identifiants stables.
   */
  pairs: readonly WordPair[];
}

export function definePack(pack: WordPack): WordPack {
  return pack;
}

/** Écriture compacte : pair('Univers ninja', ['Naruto', '…'], ['Sasuke', '…']). */
export function pair(theme: string, a: readonly [string, string], b: readonly [string, string]): WordPair {
  return { theme, a: { word: a[0], description: a[1] }, b: { word: b[0], description: b[1] } };
}
