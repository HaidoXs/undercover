import { describe, expect, it } from 'vitest';
import { MIN_PAIRS_PER_PACK, PACK_META, PACKS, packIssues } from '../server/packs';
import { foldForCompare } from '../server/text';

describe('packs de mots', () => {
  it('respecte les règles de contenu (≥ 30 paires, aucune paire identique ou en double, même inversée)', () => {
    expect(packIssues()).toEqual([]);
    for (const pack of PACKS) expect(pack.pairs.length).toBeGreaterThanOrEqual(MIN_PAIRS_PER_PACK);
  });

  it('propose au moins les 10 packs demandés avec leurs exemples', () => {
    const has = (packId: string, a: string, b: string) => {
      const pack = PACKS.find((p) => p.id === packId)!;
      return pack.pairs.some(({ a: x, b: y }) => (x.word === a && y.word === b) || (x.word === b && y.word === a));
    };
    expect(has('anime-manga', 'Naruto', 'Sasuke')).toBe(true);
    expect(has('anime-manga', 'One Piece', 'Fairy Tail')).toBe(true);
    expect(has('chanteurs', 'Beyoncé', 'Rihanna')).toBe(true);
    expect(has('chanteurs', 'Stromae', 'Orelsan')).toBe(true);
    expect(has('rap-fr', 'Ninho', 'Tiakola')).toBe(true);
    expect(has('rap-fr', 'SCH', 'Niska')).toBe(true);
    expect(has('films-series', 'Harry Potter', 'Le Seigneur des anneaux')).toBe(true);
    expect(has('jeux-video', 'Fortnite', 'PUBG')).toBe(true);
    expect(has('jeux-video', 'Minecraft', 'Terraria')).toBe(true);
    expect(has('football', 'Messi', 'Ronaldo')).toBe(true);
    expect(has('football', 'PSG', 'Marseille')).toBe(true);
    expect(has('nourriture', 'Pizza', 'Tarte')).toBe(true);
    expect(has('nourriture', 'Sushi', 'Maki')).toBe(true);
    expect(has('animaux', 'Tigre', 'Lion')).toBe(true);
    expect(has('animaux', 'Dauphin', 'Baleine')).toBe(true);
    expect(has('objets', 'Tasse', 'Verre')).toBe(true);
    expect(has('objets', 'Lampe', 'Bougie')).toBe(true);
    expect(has('voyage', 'Paris', 'Rome')).toBe(true);
    expect(has('voyage', 'Plage', 'Piscine')).toBe(true);
  });

  it('limite la réutilisation d’un même mot entre paires', () => {
    const counts = new Map<string, number>();
    for (const pack of PACKS) {
      for (const { a, b } of pack.pairs) for (const w of [a.word, b.word]) counts.set(foldForCompare(w), (counts.get(foldForCompare(w)) ?? 0) + 1);
    }
    const reused = [...counts].filter(([, n]) => n > 1);
    expect(reused).toEqual([]);
  });

  it('fournit une description par mot et un thème par paire, sans trahir l’autre mot', () => {
    for (const pack of PACKS) {
      for (const { theme, a, b } of pack.pairs) {
        expect(a.description.length).toBeGreaterThan(14);
        expect(b.description.length).toBeGreaterThan(14);
        expect(foldForCompare(a.description)).not.toContain(foldForCompare(b.word));
        expect(foldForCompare(b.description)).not.toContain(foldForCompare(a.word));
        expect(foldForCompare(theme)).not.toContain(foldForCompare(a.word));
        expect(foldForCompare(theme)).not.toContain(foldForCompare(b.word));
      }
    }
  });

  it('n’expose que des métadonnées publiques', () => {
    const json = JSON.stringify(PACK_META);
    expect(json).not.toContain('Sasuke');
    expect(json).not.toContain(PACKS[0].pairs[0].theme);
    expect(json).not.toContain(PACKS[0].pairs[0].a.description);
    expect(PACK_META.every((m) => m.pairCount === PACKS.find((p) => p.id === m.id)!.pairs.length)).toBe(true);
  });
});
