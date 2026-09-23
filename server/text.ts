/** Caractères de contrôle, de formatage invisibles (zero-width…), privés ou non assignés. */
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Co}\p{Cn}]/gu;

/**
 * Nettoie une saisie d'une ligne : supprime l'invisible, compacte les espaces.
 * Retourne null si la saisie est vide ou dépasse `max` caractères.
 * L'affichage côté client se fait toujours en texte brut (jamais en HTML).
 */
export function cleanLine(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string' || raw.length > max * 8) return null;
  const text = raw.normalize('NFC').replace(INVISIBLE, '').replace(/\s+/gu, ' ').trim();
  if (!text || [...text].length > max) return null;
  return text;
}

/**
 * Forme de comparaison : insensible à la casse, aux accents, aux espaces superflus,
 * aux tirets et aux apostrophes typographiques. Aucune correspondance approximative.
 */
export function foldForCompare(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[’‘`´ʼ]/g, "'")
    .replace(/[-‐‑‒–—_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*'\s*/g, "'");
}

/** Tentative de Mr. White : égalité stricte après normalisation. */
export function guessMatches(guess: string, word: string): boolean {
  const g = foldForCompare(guess);
  return g.length > 0 && g === foldForCompare(word);
}

function tokens(value: string): string[] {
  return foldForCompare(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

const LEADING_ARTICLES = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'the']);

/**
 * Un indice ne doit pas donner le mot secret : on refuse l'égalité après normalisation,
 * mais aussi un indice qui contient le mot entier (« une pizza géante » pour « Pizza »).
 */
export function clueRevealsWord(clue: string, word: string): boolean {
  const clueTokens = tokens(clue);
  const wordTokens = tokens(word);
  if (wordTokens.length === 0 || clueTokens.length === 0) return false;

  const variants = [wordTokens];
  if (wordTokens.length > 1 && LEADING_ARTICLES.has(wordTokens[0])) variants.push(wordTokens.slice(1));

  const clueJoined = clueTokens.join('');
  for (const variant of variants) {
    const joined = variant.join('');
    if (clueJoined === joined || clueTokens.includes(joined)) return true;
    for (let i = 0; i + variant.length <= clueTokens.length; i++) {
      if (variant.every((t, j) => clueTokens[i + j] === t)) return true;
    }
  }
  return false;
}
