import { clueRevealsWord, foldForCompare, tokens } from '../text';
import type { Universe, WordEntry, WordPack } from './types';

/** Paires générales minimales par pack, et paires minimales pour proposer un univers en « Thème précis ». */
export const MIN_PAIRS_PER_PACK = 30;
export const MIN_UNIVERSE_PAIRS = 10;
/** Un mot peut avoir plusieurs partenaires, choisis à la main : jamais toutes les combinaisons. */
export const MAX_PARTNERS = 4;

function generalUniverses(pack: WordPack): Universe[] {
  return pack.universes.filter((u) => !u.precise);
}

// ───────────────────────── contrôles de contenu

const ROLE_WORDS = ['civil', 'civils', 'undercover', 'intrus', 'mr white', 'imposteur'];

/** Tournures comparatives : une description ne se définit jamais par rapport à un autre mot. */
const COMPARISONS = [
  /\bcontrairement\b/i,
  /\bà la différence\b/i,
  /\bne pas confondre\b/i,
  /\bconfondu\b/i,
  /\bplus [a-zàâçéèêëîïôûùüÿœ-]+ que\b/i,
  /\bmoins [a-zàâçéèêëîïôûùüÿœ-]+ que\b/i,
  /\bversion (améliorée|allégée|simplifiée)\b/i,
  /\bl[’'](équivalent|alternative)\b/i,
];

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

function checkDescription(label: string, own: WordEntry, others: WordEntry[], issues: string[]): void {
  const d = own.description.trim();
  if (d.length < 25 || d.length > 110) issues.push(`${label} : description de « ${own.word} » de ${d.length} caractères (25 à 110)`);
  for (const other of others) {
    if (mentions(d, other.word, own.word)) issues.push(`${label} : la description de « ${own.word} » évoque « ${other.word} »`);
  }
  if (ROLE_WORDS.some((r) => clueRevealsWord(d, r))) issues.push(`${label} : la description de « ${own.word} » évoque un rôle`);
  if (COMPARISONS.some((re) => re.test(d))) issues.push(`${label} : la description de « ${own.word} » compare à autre chose`);
}

/** Contrôles de contenu : utilisés par les tests et au démarrage du serveur. */
export function packIssues(packs: readonly WordPack[]): string[] {
  const issues: string[] = [];
  const packIds = new Set<string>();

  for (const pack of packs) {
    if (packIds.has(pack.id)) issues.push(`Identifiant de pack en double : ${pack.id}`);
    packIds.add(pack.id);
    const general = generalUniverses(pack).reduce((n, u) => n + u.pairs.length, 0);
    if (general < MIN_PAIRS_PER_PACK) issues.push(`${pack.name} : ${general} paires générales (minimum ${MIN_PAIRS_PER_PACK})`);

    const universeIds = new Set<string>();
    const pairKeys = new Map<string, string>();
    for (const u of pack.universes) {
      const where = u.precise ? `${pack.name} › ${u.name}` : pack.name;
      if (!/^[a-z0-9-]{2,40}$/.test(u.id) || universeIds.has(u.id)) issues.push(`${where} : identifiant d’univers invalide ou en double (${u.id})`);
      universeIds.add(u.id);
      if (u.precise && u.pairs.length < MIN_UNIVERSE_PAIRS) {
        issues.push(`${where} : ${u.pairs.length} paires (minimum ${MIN_UNIVERSE_PAIRS} pour un thème précis)`);
      }

      // Mots : uniques dans l'univers, tous utilisés, jamais associés à toutes les combinaisons.
      const partners = new Map<string, Set<string>>();
      const folded = new Map<string, string>();
      for (const [key, entry] of Object.entries(u.words)) {
        const f = foldForCompare(entry.word);
        if (!f || [...entry.word].length > 30) issues.push(`${where} : mot « ${entry.word} » vide ou trop long`);
        if (folded.has(f)) issues.push(`${where} : mot « ${entry.word} » en double (${folded.get(f)} / ${key})`);
        folded.set(f, key);
        partners.set(key, new Set());
      }

      for (const pair of u.pairs) {
        const a = u.words[pair.a];
        const b = u.words[pair.b];
        const label = `${where} « ${a?.word ?? pair.a} / ${b?.word ?? pair.b} »`;
        if (!a || !b) {
          issues.push(`${label} : clé de mot inconnue`);
          continue;
        }
        if (pair.a === pair.b) issues.push(`${label} : paire identique`);
        const key = [foldForCompare(a.word), foldForCompare(b.word)].sort().join(' | ');
        const seen = pairKeys.get(key);
        if (seen) issues.push(`${label} : paire en double (${seen})`);
        pairKeys.set(key, u.name);
        partners.get(pair.a)?.add(pair.b);
        partners.get(pair.b)?.add(pair.a);

        // Même niveau de détail pour les deux descriptions.
        const la = a.description.trim().length;
        const lb = b.description.trim().length;
        if (Math.max(la, lb) > Math.min(la, lb) * 1.8) issues.push(`${label} : descriptions trop inégales (${la} / ${lb} caractères)`);

        // Thème de Mr. White : large, sans mot ni terme distinctif de la paire, ni nom d'univers précis.
        const t = pair.theme.trim();
        if (t.length < 4 || t.length > 40) issues.push(`${label} : thème de ${t.length} caractères (4 à 40)`);
        if (foldForCompare(t) === foldForCompare(pack.name)) issues.push(`${label} : thème identique au nom du pack`);
        if (mentions(t, a.word) || mentions(t, b.word)) issues.push(`${label} : le thème « ${t} » révèle un mot`);
        if (u.precise && mentions(t, u.name)) issues.push(`${label} : le thème « ${t} » répète le nom de l’univers`);
      }

      for (const [key, set] of partners) {
        const entry = u.words[key];
        if (set.size === 0) issues.push(`${where} : mot « ${entry.word} » inutilisé`);
        if (set.size > MAX_PARTNERS) issues.push(`${where} : « ${entry.word} » a ${set.size} partenaires (maximum ${MAX_PARTNERS})`);
        checkDescription(where, entry, [...set].map((k) => u.words[k]).filter(Boolean), issues);
      }
      const multi = [...partners.values()].filter((s) => s.size >= 2).length;
      if (partners.size >= 20 && multi < partners.size * 0.2) {
        issues.push(`${where} : seulement ${multi} mots sur ${partners.size} ont plusieurs partenaires (20 % minimum)`);
      }
    }
  }
  return issues;
}
