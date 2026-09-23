/**
 * Réglages ajoutés : tours d'indices avant le vote et « Thème précis ».
 * Validation côté serveur, permissions de l'hôte, verrouillage pendant la manche, progression exacte.
 */
import { describe, expect, it } from 'vitest';
import { GameError } from '../server/game/errors';
import { DEFAULT_TIMINGS, Room } from '../server/game/Room';
import { PACKS } from '../server/packs';

const T = DEFAULT_TIMINGS;

function expectError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(GameError);
    expect((e as GameError).code).toBe(code);
    return;
  }
  throw new Error(`Erreur ${code} attendue`);
}

function lobby(n: number) {
  const now = { t: 1_000_000 };
  const room = new Room('FEATUR', T, 1, now.t);
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = room.addPlayer({ name: `Joueur ${i + 1}`, avatar: i, tokenHash: `h${i}` }, now.t);
    room.attachSocket(p.id, `s${i}`);
    ids.push(p.id);
  }
  const readyAll = () => ids.slice(1).forEach((id) => room.setReady(id, true));
  readyAll();
  return { room, ids, now, readyAll };
}

function startAndReveal(g: ReturnType<typeof lobby>) {
  g.readyAll();
  g.room.start(g.ids[0], g.now.t);
  const r = g.room.round!;
  for (const id of g.ids) g.room.markSeen(id, r.id, g.now.t);
  expect(g.room.phase).toBe('clues');
  return r;
}

function playOneCycle(g: ReturnType<typeof lobby>) {
  const r = g.room.round!;
  const cycle = r.cycle;
  while (g.room.phase === 'clues' && r.cycle === cycle) {
    g.room.submitClue(r.order[r.turnIndex], r.turnId, `indice ${r.clues.length}`, g.now.t);
  }
}

describe('Tours d’indices avant le vote', () => {
  it('vaut 1 par défaut, se règle de 1 à 5 par l’hôte seul, et remet les statuts « Prêt » à zéro', () => {
    const g = lobby(4);
    expect(g.room.settings.clueRounds).toBe(1);
    expectError(() => g.room.updateSettings(g.ids[1], { clueRounds: 2 }), 'NOT_HOST');
    for (const bad of [0, 6, 1.5, '2', null]) expectError(() => g.room.updateSettings(g.ids[0], { clueRounds: bad }), 'BAD_REQUEST');
    g.room.updateSettings(g.ids[0], { clueRounds: 3 });
    expect(g.room.settings.clueRounds).toBe(3);
    expect(g.room.players.every((p) => !p.ready)).toBe(true);
  });

  it('avec 2 tours, chaque joueur en jeu donne deux indices avant le scrutin, puis le bloc recommence', () => {
    const g = lobby(4);
    g.room.updateSettings(g.ids[0], { clueRounds: 2 });
    const r = startAndReveal(g);
    expect(g.room.viewFor(g.ids[1], g.now.t).round).toMatchObject({ clueRound: 1, clueRounds: 2, cycle: 1, voteRound: 0 });

    playOneCycle(g);
    expect(g.room.phase).toBe('clues');
    expect(g.room.viewFor(g.ids[1], g.now.t).round).toMatchObject({ clueRound: 2, clueRounds: 2, cycle: 2 });

    playOneCycle(g);
    expect(g.room.phase).toBe('vote');
    expect(r.clues.filter((c) => c.cycle === 1)).toHaveLength(4);
    expect(r.clues.filter((c) => c.cycle === 2)).toHaveLength(4);
    for (const id of g.ids) expect(r.clues.filter((c) => c.playerId === id)).toHaveLength(2);
    expect(r.voteRound).toBe(1);

    // Personne ne vote : pas d'élimination, un nouveau bloc de deux tours commence.
    g.now.t += T.result + 70_000;
    g.room.tick(g.now.t);
    g.now.t += T.result + 1000;
    g.room.tick(g.now.t);
    expect(g.room.phase).toBe('clues');
    expect(r.cycle).toBe(3);
    expect(r.clueRound).toBe(1);
    // L'historique reste complet et regroupé par tour.
    expect([...new Set(r.clues.map((c) => c.cycle))]).toEqual([1, 2]);
  });

  it('reprend la progression exacte après une reconnexion', () => {
    const g = lobby(4);
    g.room.updateSettings(g.ids[0], { clueRounds: 3 });
    startAndReveal(g);
    playOneCycle(g);
    const player = g.room.getPlayer(g.ids[2])!;
    g.room.detachSocket(player.id, 's2', g.now.t);
    g.room.attachSocket(player.id, 's2-bis');
    const v = g.room.viewFor(player.id, g.now.t);
    expect(v.round).toMatchObject({ clueRound: 2, clueRounds: 3, cycle: 2 });
    expect(v.settings.clueRounds).toBe(3);
  });

  it('est verrouillé pendant la manche', () => {
    const g = lobby(3);
    startAndReveal(g);
    expectError(() => g.room.updateSettings(g.ids[0], { clueRounds: 2 }), 'SETTINGS_LOCKED');
  });
});

describe('Thème précis', () => {
  const lolWords = new Set(
    Object.values(PACKS.find((p) => p.id === 'jeux-video')!.universes.find((u) => u.id === 'league-of-legends')!.words).map((w) => w.word),
  );

  it('est désactivé par défaut et réservé à l’hôte', () => {
    const g = lobby(3);
    expect(g.room.settings).toMatchObject({ preciseTheme: false, themeId: null });
    expectError(() => g.room.updateSettings(g.ids[1], { preciseTheme: true }), 'NOT_HOST');
  });

  it('refuse l’activation si aucun univers n’est disponible dans les packs sélectionnés', () => {
    const g = lobby(3);
    g.room.updateSettings(g.ids[0], { packIds: ['animaux', 'nourriture'] });
    expectError(() => g.room.updateSettings(g.ids[0], { preciseTheme: true }), 'NO_THEME');
    expectError(() => g.room.updateSettings(g.ids[0], { preciseTheme: true, themeId: 'jeux-video:league-of-legends' }), 'NO_THEME');
    expect(g.room.settings.preciseTheme).toBe(false);
  });

  it('refuse un univers inconnu ou vide', () => {
    const g = lobby(3);
    expectError(() => g.room.updateSettings(g.ids[0], { preciseTheme: true, themeId: 'jeux-video:inconnu' }), 'BAD_REQUEST');
    expectError(() => g.room.updateSettings(g.ids[0], { preciseTheme: true, themeId: 'jeux-video:general' }), 'BAD_REQUEST');
  });

  it('ne tire que des paires de l’univers choisi, affiché à tous', () => {
    const g = lobby(4);
    g.room.updateSettings(g.ids[0], { packIds: ['jeux-video', 'animaux'], preciseTheme: true, themeId: 'jeux-video:league-of-legends' });
    for (let round = 0; round < 8; round++) {
      const r = startAndReveal(g);
      expect(lolWords.has(r.pair.civil) && lolWords.has(r.pair.undercover)).toBe(true);
      for (const id of g.ids) expect(g.room.viewFor(id, g.now.t).round!.themeName).toBe('League of Legends');
      // Fin rapide de la manche pour relancer.
      g.room.phase = 'ended';
      g.room.replay(g.ids[0]);
    }
  });

  it('se désactive, avec une explication, quand le pack de l’univers est retiré', () => {
    const g = lobby(3);
    g.room.updateSettings(g.ids[0], { packIds: ['jeux-video', 'animaux'], preciseTheme: true, themeId: 'jeux-video:pokemon' });
    g.room.drainNotices();
    g.room.updateSettings(g.ids[0], { packIds: ['animaux'] });
    expect(g.room.settings).toMatchObject({ preciseTheme: false, themeId: null });
    expect(g.room.drainNotices().join(' ')).toMatch(/Thème précis désactivé/);
  });

  it('change d’univers seulement parmi ceux des packs choisis, et reste verrouillé pendant la manche', () => {
    const g = lobby(3);
    g.room.updateSettings(g.ids[0], { packIds: ['jeux-video', 'anime-manga'], preciseTheme: true, themeId: 'anime-manga:naruto' });
    expect(g.room.settings.themeId).toBe('anime-manga:naruto');
    expectError(() => g.room.updateSettings(g.ids[0], { themeId: 'films-series:star-wars' }), 'NO_THEME');
    startAndReveal(g);
    expectError(() => g.room.updateSettings(g.ids[0], { themeId: 'jeux-video:pokemon' }), 'SETTINGS_LOCKED');
  });
});
