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
      return pack.pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
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
      for (const pair of pack.pairs) for (const w of pair) counts.set(foldForCompare(w), (counts.get(foldForCompare(w)) ?? 0) + 1);
    }
    const reused = [...counts].filter(([, n]) => n > 1);
    expect(reused).toEqual([]);
  });

  it('n’expose que des métadonnées publiques', () => {
    const json = JSON.stringify(PACK_META);
    expect(json).not.toContain('Sasuke');
    expect(PACK_META.every((m) => m.pairCount === PACKS.find((p) => p.id === m.id)!.pairs.length)).toBe(true);
  });
});
