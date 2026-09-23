import { describe, expect, it } from 'vitest';
import { MAX_PARTNERS, MIN_PAIRS_PER_PACK, MIN_UNIVERSE_PAIRS, PACK_META, PACKS, packIssues, themesFor } from '../server/packs';
import type { Universe } from '../server/packs/types';
import { foldForCompare } from '../server/text';

const words = (u: Universe) => Object.values(u.words).map((w) => foldForCompare(w.word));

function partners(u: Universe): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>(Object.keys(u.words).map((k) => [k, new Set()]));
  for (const { a, b } of u.pairs) {
    map.get(a)?.add(b);
    map.get(b)?.add(a);
  }
  return map;
}

function hasPair(u: Universe, a: string, b: string): boolean {
  const fa = foldForCompare(a);
  const fb = foldForCompare(b);
  return u.pairs.some((p) => {
    const x = foldForCompare(u.words[p.a].word);
    const y = foldForCompare(u.words[p.b].word);
    return (x === fa && y === fb) || (x === fb && y === fa);
  });
}

const universe = (packId: string, id: string) => PACKS.find((p) => p.id === packId)!.universes.find((u) => u.id === id)!;

describe('packs de mots', () => {
  it('respecte toutes les règles de contenu (aucun problème détecté)', () => {
    expect(packIssues()).toEqual([]);
    for (const pack of PACKS) {
      const general = pack.universes.filter((u) => !u.precise).reduce((n, u) => n + u.pairs.length, 0);
      expect(general).toBeGreaterThanOrEqual(MIN_PAIRS_PER_PACK);
      for (const u of pack.universes.filter((x) => x.precise)) expect(u.pairs.length).toBeGreaterThanOrEqual(MIN_UNIVERSE_PAIRS);
    }
  });

  it('organise les données par pack, univers et paire, avec de vrais univers précis', () => {
    const expected: Record<string, string[]> = {
      'jeux-video': ['league-of-legends', 'pokemon', 'minecraft'],
      'anime-manga': ['one-piece', 'naruto', 'dragon-ball'],
      'films-series': ['harry-potter', 'star-wars', 'marvel'],
    };
    for (const [packId, ids] of Object.entries(expected)) {
      const pack = PACKS.find((p) => p.id === packId)!;
      expect(pack.universes.filter((u) => u.precise).map((u) => u.id)).toEqual(ids);
    }
    const lol = universe('jeux-video', 'league-of-legends');
    expect(hasPair(lol, 'Mana', 'Énergie')).toBe(true);
    expect(hasPair(lol, 'Armure', 'Résistance magique')).toBe(true);
    expect(hasPair(lol, 'Dragon', 'Baron Nashor')).toBe(true);
  });

  it('prévoit plusieurs partenaires pour une partie des mots, sans fabriquer toutes les combinaisons', () => {
    for (const pack of PACKS) {
      for (const u of pack.universes) {
        const map = partners(u);
        const counts = [...map.values()].map((s) => s.size);
        expect(Math.max(...counts)).toBeLessThanOrEqual(MAX_PARTNERS);
        expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
        const multi = counts.filter((n) => n >= 2).length;
        expect(multi / counts.length).toBeGreaterThanOrEqual(0.2);
        // Loin de toutes les combinaisons possibles.
        expect(u.pairs.length).toBeLessThan((counts.length * (counts.length - 1)) / 8);
      }
    }
  });

  it('évite les duos figés les plus prévisibles', () => {
    const general = (packId: string) => universe(packId, 'general');
    expect(hasPair(general('football'), 'Messi', 'Cristiano Ronaldo')).toBe(false);
    expect(hasPair(general('football'), 'PSG', 'Marseille')).toBe(false);
    expect(hasPair(general('anime-manga'), 'Naruto', 'Sasuke')).toBe(false);
    expect(hasPair(general('animaux'), 'Chat', 'Chien')).toBe(false);
    expect(hasPair(general('animaux'), 'Tigre', 'Lion')).toBe(false);
    expect(hasPair(general('nourriture'), 'Croissant', 'Pain au chocolat')).toBe(false);
    expect(hasPair(general('objets'), 'Fourchette', 'Cuillère')).toBe(false);
  });

  it('garde les descriptions privées neutres : jamais un partenaire, jamais un rôle, même niveau de détail', () => {
    for (const pack of PACKS) {
      for (const u of pack.universes) {
        for (const pair of u.pairs) {
          const a = u.words[pair.a];
          const b = u.words[pair.b];
          expect(foldForCompare(a.description)).not.toContain(foldForCompare(b.word));
          expect(foldForCompare(b.description)).not.toContain(foldForCompare(a.word));
          const [la, lb] = [a.description.length, b.description.length];
          expect(Math.max(la, lb) / Math.min(la, lb)).toBeLessThanOrEqual(1.8);
          for (const d of [a.description, b.description]) expect(d).not.toMatch(/undercover|imposteur|\bintrus\b|mr\.? white/i);
        }
      }
    }
  });

  it('donne à Mr. White un thème large : jamais un mot, ni le nom de l’univers précis', () => {
    for (const pack of PACKS) {
      for (const u of pack.universes) {
        for (const pair of u.pairs) {
          const t = foldForCompare(pair.theme);
          expect(t).not.toContain(foldForCompare(u.words[pair.a].word));
          expect(t).not.toContain(foldForCompare(u.words[pair.b].word));
          if (u.precise) expect(t).not.toContain(foldForCompare(u.name));
        }
      }
    }
  });

  it('n’expose que des métadonnées publiques, sans thème vide', () => {
    const json = JSON.stringify(PACK_META);
    for (const pack of PACKS) {
      for (const u of pack.universes) {
        for (const w of Object.values(u.words)) expect(json).not.toContain(w.description);
      }
    }
    expect(json).not.toContain('Baron Nashor');
    const lol = PACK_META.find((m) => m.id === 'jeux-video')!.universes.find((u) => u.id === 'jeux-video:league-of-legends')!;
    expect(lol.pairCount).toBe(universe('jeux-video', 'league-of-legends').pairs.length);
    for (const meta of PACK_META) for (const u of meta.universes) expect(u.pairCount).toBeGreaterThanOrEqual(MIN_UNIVERSE_PAIRS);
    expect(themesFor(['animaux', 'nourriture'])).toEqual([]);
    expect(themesFor(['jeux-video'])).toContain('jeux-video:league-of-legends');
  });

  it('ne mélange jamais deux univers précis', () => {
    const lol = new Set(words(universe('jeux-video', 'league-of-legends')));
    const poke = new Set(words(universe('jeux-video', 'pokemon')));
    for (const w of lol) expect(poke.has(w)).toBe(false);
  });
});
