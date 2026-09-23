export type WordPair = readonly [string, string];

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
