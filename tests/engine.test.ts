import { describe, expect, it } from 'vitest';
import { compositionError } from '../shared/rules';
import type { Role } from '../shared/types';
import { GameError } from '../server/game/errors';
import { DEFAULT_TIMINGS, Room } from '../server/game/Room';
import { drawPair, newDrawMemory, PACKS } from '../server/packs';
import { clueRevealsWord, guessMatches } from '../server/text';

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

interface Setup {
  room: Room;
  ids: string[];
  now: { t: number };
}

/** Crée un salon de n joueurs connectés et prêts (le premier est l'hôte). */
function lobby(n: number): Setup {
  const now = { t: 1_000_000 };
  const room = new Room('ABCDEF', T, 1, now.t);
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = room.addPlayer({ name: `Joueur ${i + 1}`, avatar: i, tokenHash: `h${i}` }, now.t);
    room.attachSocket(p.id, `s${i}`);
    ids.push(p.id);
  }
  for (const id of ids.slice(1)) room.setReady(id, true);
  return { room, ids, now };
}

/** Lance une manche puis impose les rôles (index → rôle) pour des scénarios déterministes. */
function startWith(setup: Setup, roles: Role[]) {
  const { room, ids, now } = setup;
  const uc = roles.filter((r) => r === 'undercover').length;
  const mw = roles.includes('mrwhite');
  room.updateSettings(ids[0], { undercoverCount: uc, mrWhite: mw });
  for (const id of ids.slice(1)) room.setReady(id, true);
  room.start(ids[0], now.t);
  const r = room.round!;
  ids.forEach((id, i) => r.roles.set(id, roles[i]));
  r.baseOrder = [...ids];
  for (const id of ids) room.markSeen(id, r.id, now.t);
  expect(room.phase).toBe('clues');
  return r;
}

function playClues(setup: Setup) {
  const { room, now } = setup;
  const r = room.round!;
  while (room.phase === 'clues') {
    const id = r.order[r.turnIndex];
    room.submitClue(id, r.turnId, `indice ${r.clues.length}`, now.t);
  }
  expect(room.phase).toBe('vote');
}

function vote(setup: Setup, votes: [number, number][]) {
  const { room, ids, now } = setup;
  const ballot = room.round!.ballot!;
  for (const [from, to] of votes) room.castVote(ids[from], ballot.id, ids[to], now.t);
}

function advance(setup: Setup, ms: number) {
  setup.now.t += ms;
  setup.room.tick(setup.now.t);
}

describe('composition', () => {
  it('exige des Civils strictement majoritaires', () => {
    const base = { undercoverCount: 1, mrWhite: false, packIds: ['animaux'], clueSeconds: 45, voteSeconds: 60, specialRoles: [], clueRounds: 1, preciseTheme: false, themeId: null };
    expect(compositionError(base, 3)).toBeNull();
    expect(compositionError(base, 2)).toMatch(/au moins 3/);
    expect(compositionError({ ...base, undercoverCount: 2 }, 4)).toMatch(/Trop d'intrus/);
    expect(compositionError({ ...base, undercoverCount: 2 }, 5)).toBeNull();
    expect(compositionError({ ...base, mrWhite: true }, 4)).toMatch(/Mr. White/);
    expect(compositionError({ ...base, mrWhite: true }, 5)).toBeNull();
    expect(compositionError({ ...base, undercoverCount: 2, mrWhite: true }, 5)).toMatch(/Trop d'intrus/);
    expect(compositionError({ ...base, undercoverCount: 0 }, 6)).toMatch(/au moins un intrus/);
    expect(compositionError({ ...base, undercoverCount: 0, mrWhite: true }, 5)).toBeNull();
  });
});

describe('salon', () => {
  it('réserve le lancement et les paramètres à l’hôte', () => {
    const s = lobby(4);
    expectError(() => s.room.start(s.ids[1], s.now.t), 'NOT_HOST');
    expectError(() => s.room.updateSettings(s.ids[2], { undercoverCount: 1 }), 'NOT_HOST');
    expectError(() => s.room.replay(s.ids[1]), 'NOT_HOST');
  });

  it('attend que tous les joueurs présents soient prêts', () => {
    const s = lobby(4);
    s.room.setReady(s.ids[2], false);
    expectError(() => s.room.start(s.ids[0], s.now.t), 'NOT_READY');
  });

  it('réinitialise les statuts Prêt quand la configuration change', () => {
    const s = lobby(4);
    s.room.updateSettings(s.ids[0], { clueSeconds: 30 });
    expect(s.room.players.every((p) => !p.ready)).toBe(true);
  });

  it('refuse les configurations invalides et l’absence de pack', () => {
    const s = lobby(4);
    s.room.updateSettings(s.ids[0], { mrWhite: true });
    for (const id of s.ids.slice(1)) s.room.setReady(id, true);
    expectError(() => s.room.start(s.ids[0], s.now.t), 'CONFIG_INVALID');
    s.room.updateSettings(s.ids[0], { mrWhite: false, packIds: [] });
    for (const id of s.ids.slice(1)) s.room.setReady(id, true);
    expectError(() => s.room.start(s.ids[0], s.now.t), 'NO_PACK');
    expectError(() => s.room.updateSettings(s.ids[0], { clueSeconds: 7 }), 'BAD_REQUEST');
    expectError(() => s.room.updateSettings(s.ids[0], { packIds: ['inexistant'] }), 'BAD_REQUEST');
  });

  it('verrouille les paramètres pendant une manche', () => {
    const s = lobby(4);
    s.room.start(s.ids[0], s.now.t);
    expectError(() => s.room.updateSettings(s.ids[0], { undercoverCount: 1 }), 'SETTINGS_LOCKED');
  });

  it('valide les pseudos et évite les doublons', () => {
    const s = lobby(3);
    expectError(() => s.room.addPlayer({ name: 'x', avatar: 0, tokenHash: 'z' }, s.now.t), 'NAME_INVALID');
    expectError(() => s.room.addPlayer({ name: ' JOUEUR   1 ', avatar: 0, tokenHash: 'z' }, s.now.t), 'NAME_TAKEN');
    const p = s.room.addPlayer({ name: '<b>Léa</b>', avatar: 0, tokenHash: 'z' }, s.now.t);
    expect(p.name).toBe('<b>Léa</b>');
    expect(p.avatar).not.toBe(0);
  });
});

describe('attribution secrète', () => {
  it('donne le même mot aux Civils, un autre aux Undercover, aucun à Mr. White', () => {
    const s = lobby(6);
    s.room.updateSettings(s.ids[0], { undercoverCount: 1, mrWhite: true });
    for (const id of s.ids.slice(1)) s.room.setReady(id, true);
    s.room.start(s.ids[0], s.now.t);
    const r = s.room.round!;
    const words = new Map<Role, Set<string>>();
    for (const id of s.ids) {
      const view = s.room.viewFor(id, s.now.t);
      const role = r.roles.get(id)!;
      if (role === 'mrwhite') {
        expect(view.me.secret).toEqual({ kind: 'mrwhite', theme: r.pair.theme });
      } else {
        expect(view.me.secret?.kind).toBe('word');
        const { word, description } = view.me.secret as { word: string; description: string };
        expect(description).toBe(role === 'civil' ? r.pair.civilDescription : r.pair.undercoverDescription);
        if (!words.has(role)) words.set(role, new Set());
        words.get(role)!.add(word);
      }
    }
    expect(words.get('civil')!.size).toBe(1);
    expect(words.get('undercover')!.size).toBe(1);
    expect([...words.get('civil')!][0]).not.toBe([...words.get('undercover')!][0]);
  });

  it('ne divulgue ni les mots ni les rôles des autres dans les vues', () => {
    const s = lobby(6);
    s.room.updateSettings(s.ids[0], { undercoverCount: 1, mrWhite: true });
    for (const id of s.ids.slice(1)) s.room.setReady(id, true);
    s.room.start(s.ids[0], s.now.t);
    const r = s.room.round!;
    for (const id of s.ids) {
      const json = JSON.stringify(s.room.viewFor(id, s.now.t));
      const role = r.roles.get(id);
      if (role !== 'civil') expect(json).not.toContain(r.pair.civil);
      if (role !== 'undercover') expect(json).not.toContain(r.pair.undercover);
      if (role !== 'civil') expect(json).not.toContain(r.pair.civilDescription);
      if (role !== 'undercover') expect(json).not.toContain(r.pair.undercoverDescription);
      if (role !== 'mrwhite') expect(json).not.toContain(r.pair.theme);
      expect(json).not.toMatch(/"role":/);
      expect(json).not.toContain(r.pair.packName);
    }
  });

  it('ne fait jamais commencer Mr. White au premier tour', () => {
    for (let i = 0; i < 150; i++) {
      const s = lobby(5);
      s.room.updateSettings(s.ids[0], { undercoverCount: 1, mrWhite: true });
      for (const id of s.ids.slice(1)) s.room.setReady(id, true);
      s.room.start(s.ids[0], s.now.t);
      const r = s.room.round!;
      for (const id of s.ids) s.room.markSeen(id, r.id, s.now.t);
      expect(r.roles.get(r.order[0])).not.toBe('mrwhite');
    }
  });
});

describe('indices', () => {
  it('impose l’ordre de passage et refuse les actions périmées', () => {
    const s = lobby(4);
    const r = startWith(s, ['civil', 'civil', 'civil', 'undercover']);
    expectError(() => s.room.submitClue(s.ids[1], r.turnId, 'coucou', s.now.t), 'NOT_YOUR_TURN');
    const oldTurn = r.turnId;
    s.room.submitClue(s.ids[0], oldTurn, 'premier', s.now.t);
    expectError(() => s.room.submitClue(s.ids[0], oldTurn, 'encore', s.now.t), 'STALE_ACTION');
    expectError(() => s.room.submitClue(s.ids[1], oldTurn, 'vieux', s.now.t), 'STALE_ACTION');
  });

  it('interdit de donner son mot, même déguisé', () => {
    const s = lobby(4);
    const r = startWith(s, ['civil', 'civil', 'civil', 'undercover']);
    r.pair = { ...r.pair, civil: 'Pain au chocolat', undercover: 'Croissant' };
    for (const attempt of ['pain au chocolat', '  PAIN  AU  CHOCOLAT ', 'pain-au-chocolat', 'painauchocolat', 'un pain au chocolat chaud']) {
      expectError(() => s.room.submitClue(s.ids[0], r.turnId, attempt, s.now.t), 'CLUE_IS_WORD');
    }
    expectError(() => s.room.submitClue(s.ids[0], r.turnId, '   ', s.now.t), 'TEXT_INVALID');
    expectError(() => s.room.submitClue(s.ids[0], r.turnId, 'x'.repeat(31), s.now.t), 'TEXT_INVALID');
    s.room.submitClue(s.ids[0], r.turnId, 'viennoiserie', s.now.t);
    expect(r.clues.at(-1)).toMatchObject({ playerId: s.ids[0], text: 'viennoiserie' });
  });

  it('marque « Passé » quand le temps expire ou qu’un joueur est absent', () => {
    const s = lobby(4);
    const r = startWith(s, ['civil', 'civil', 'civil', 'undercover']);
    advance(s, 45_000);
    expect(r.clues[0]).toMatchObject({ playerId: s.ids[0], text: null });
    expect(r.order[r.turnIndex]).toBe(s.ids[1]);
    s.room.detachSocket(s.ids[1], 's1', s.now.t);
    advance(s, T.disconnectGrace - 1);
    expect(r.order[r.turnIndex]).toBe(s.ids[1]);
    advance(s, 2);
    expect(r.clues[1]).toMatchObject({ playerId: s.ids[1], text: null });
  });
});

describe('vote', () => {
  it('garde les choix secrets jusqu’à la clôture et refuse les votes invalides', () => {
    const s = lobby(4);
    startWith(s, ['civil', 'civil', 'civil', 'undercover']);
    playClues(s);
    const ballot = s.room.round!.ballot!;
    expectError(() => s.room.castVote(s.ids[0], ballot.id, s.ids[0], s.now.t), 'SELF_VOTE');
    expectError(() => s.room.castVote(s.ids[0], 'ancien', s.ids[1], s.now.t), 'STALE_ACTION');
    expectError(() => s.room.castVote(s.ids[0], ballot.id, 'fantome', s.now.t), 'INVALID_TARGET');
    s.room.castVote(s.ids[0], ballot.id, s.ids[3], s.now.t);
    expectError(() => s.room.castVote(s.ids[0], ballot.id, s.ids[2], s.now.t), 'ALREADY_DONE');

    const other = s.room.viewFor(s.ids[1], s.now.t);
    expect(other.round!.ballot!.voted).toEqual([s.ids[0]]);
    expect(other.round!.ballot!.myVote).toBeNull();
    expect(JSON.stringify(other)).not.toContain('"targetId"');
    expect(s.room.viewFor(s.ids[0], s.now.t).round!.ballot!.myVote).toBe(s.ids[3]);
  });

  it('élimine le joueur le plus visé et révèle son rôle, pas son mot', () => {
    const s = lobby(4);
    const r = startWith(s, ['civil', 'civil', 'civil', 'undercover']);
    playClues(s);
    vote(s, [[0, 3], [1, 3], [2, 3], [3, 0]]);
    expect(s.room.phase).toBe('result');
    const view = s.room.viewFor(s.ids[1], s.now.t);
    expect(view.round!.result!.outcome).toEqual({ type: 'eliminated', playerId: s.ids[3], role: 'undercover' });
    expect(view.players.find((p) => p.id === s.ids[3])!.role).toBe('undercover');
    expect(JSON.stringify(view)).not.toContain(r.pair.undercover);
    advance(s, T.result);
    expect(s.room.phase).toBe('ended');
    expect(s.room.round!.end!.winnerSide).toBe('civils');
    expect(s.room.round!.end!.winners).toEqual(s.ids.slice(0, 3));
  });

  it('compte les absences comme abstentions à l’échéance', () => {
    const s = lobby(5);
    startWith(s, ['civil', 'civil', 'civil', 'civil', 'undercover']);
    playClues(s);
    vote(s, [[0, 4], [1, 4]]);
    advance(s, 60_000);
    const result = s.room.round!.result!;
    expect(result.outcome).toMatchObject({ type: 'eliminated', playerId: s.ids[4] });
    expect(result.votes.filter((v) => v.targetId === null)).toHaveLength(3);
  });

  it('organise un second scrutin limité aux ex æquo, puis relance les indices si l’égalité persiste', () => {
    const s = lobby(5);
    const r = startWith(s, ['civil', 'civil', 'civil', 'civil', 'undercover']);
    playClues(s);
    vote(s, [[0, 1], [1, 0], [2, 1], [3, 0], [4, 2]]);
    expect(r.result!.outcome).toEqual({ type: 'tie', tied: [s.ids[0], s.ids[1]] });
    advance(s, T.tieNotice);
    expect(s.room.phase).toBe('vote');
    const runoff = r.ballot!;
    expect(runoff.runoff).toBe(true);
    expect(runoff.candidates.sort()).toEqual([s.ids[0], s.ids[1]].sort());
    expect(runoff.voters).toHaveLength(5);
    expectError(() => s.room.castVote(s.ids[2], runoff.id, s.ids[3], s.now.t), 'INVALID_TARGET');
    vote(s, [[0, 1], [1, 0], [2, 0], [3, 1]]);
    advance(s, 60_000);
    expect(r.result!.outcome.type).toBe('tie-persist');
    advance(s, T.result);
    expect(s.room.phase).toBe('clues');
    expect(r.cycle).toBe(2);
    expect(r.alive.size).toBe(5);
  });

  it('n’élimine personne sans aucun vote exprimé', () => {
    const s = lobby(4);
    const r = startWith(s, ['civil', 'civil', 'civil', 'undercover']);
    playClues(s);
    advance(s, 60_000);
    expect(r.result!.outcome.type).toBe('no-votes');
    advance(s, T.result);
    expect(s.room.phase).toBe('clues');
    expect(r.alive.size).toBe(4);
  });

  it('donne la victoire aux intrus quand ils égalent les Civils', () => {
    const s = lobby(5);
    const r = startWith(s, ['civil', 'civil', 'civil', 'undercover', 'undercover']);
    playClues(s);
    vote(s, [[0, 1], [1, 0], [2, 0], [3, 0], [4, 0]]);
    advance(s, T.result);
    expect(s.room.phase).toBe('ended');
    expect(r.end!.winnerSide).toBe('intrus');
    expect(r.end!.winners).toEqual([s.ids[3], s.ids[4]]);
  });

  it('empêche un éliminé de voter ou de donner un indice', () => {
    const s = lobby(6);
    const r = startWith(s, ['civil', 'civil', 'civil', 'civil', 'undercover', 'undercover']);
    playClues(s);
    vote(s, [[0, 1], [1, 0], [2, 1], [3, 1], [4, 1], [5, 1]]);
    advance(s, T.result);
    expect(s.room.phase).toBe('clues');
    expect(r.order).not.toContain(s.ids[1]);
    expectError(() => s.room.submitClue(s.ids[1], r.turnId, 'coucou', s.now.t), 'NOT_ACTIVE');
    playClues(s);
    expectError(() => s.room.castVote(s.ids[1], r.ballot!.id, s.ids[4], s.now.t), 'NOT_ACTIVE');
  });
});

describe('Mr. White', () => {
  function toMrWhite() {
    const s = lobby(5);
    const r = startWith(s, ['civil', 'civil', 'civil', 'undercover', 'mrwhite']);
    r.pair = { ...r.pair, civil: 'Crème brûlée', undercover: 'Flan' };
    playClues(s);
    vote(s, [[0, 4], [1, 4], [2, 4], [3, 4], [4, 0]]);
    advance(s, T.result);
    expect(s.room.phase).toBe('mrwhite');
    return { s, r };
  }

  it('gagne immédiatement avec une réponse exacte (casse, accents, espaces)', () => {
    const { s, r } = toMrWhite();
    expectError(() => s.room.submitGuess(s.ids[0], r.mrWhite!.attemptId, 'x', s.now.t), 'NOT_ACTIVE');
    s.room.submitGuess(s.ids[4], r.mrWhite!.attemptId, '  CREME   brulee ', s.now.t);
    expect(s.room.phase).toBe('ended');
    expect(r.end).toMatchObject({ winnerSide: 'mrwhite', winners: [s.ids[4]], mrWhiteGuess: '  CREME   brulee '.trim().replace(/\s+/g, ' ') });
  });

  it('échoue sur une réponse approchante puis la manche continue', () => {
    const { s, r } = toMrWhite();
    s.room.submitGuess(s.ids[4], r.mrWhite!.attemptId, 'crème brûlées', s.now.t);
    expect(r.mrWhite).toMatchObject({ resolved: true, correct: false });
    expectError(() => s.room.submitGuess(s.ids[4], r.mrWhite!.attemptId, 'crème brûlée', s.now.t), 'ALREADY_DONE');
    advance(s, T.mrWhiteResult);
    expect(s.room.phase).toBe('clues');
    expect(r.cycle).toBe(2);
  });

  it('échoue à l’expiration du délai', () => {
    const { s, r } = toMrWhite();
    advance(s, T.mrWhiteGuess);
    expect(r.mrWhite).toMatchObject({ resolved: true, correct: false, guess: null });
  });
});

describe('connexions', () => {
  it('met la manche en pause quand tout le monde est déconnecté, puis la reprend', () => {
    const s = lobby(3);
    startWith(s, ['civil', 'civil', 'undercover']);
    s.ids.forEach((id, i) => s.room.detachSocket(id, `s${i}`, s.now.t));
    advance(s, 200);
    expect(s.room.paused).toBe(true);
    expect(s.room.deadline).toBeNull();
    advance(s, 10 * 60_000);
    expect(s.room.phase).toBe('clues');
    s.room.attachSocket(s.ids[1], 'n1');
    advance(s, 100);
    expect(s.room.paused).toBe(false);
    expect(s.room.deadline).not.toBeNull();
  });

  it('transfère le rôle d’hôte après 60 s de déconnexion, selon l’ordre d’arrivée', () => {
    const s = lobby(4);
    s.room.detachSocket(s.ids[0], 's0', s.now.t);
    s.room.detachSocket(s.ids[1], 's1', s.now.t);
    advance(s, T.hostTransfer - 10);
    expect(s.room.hostId).toBe(s.ids[0]);
    advance(s, 20);
    expect(s.room.hostId).toBe(s.ids[2]);
  });

  it('fait attendre un joueur arrivé en cours de manche, sans information secrète', () => {
    const s = lobby(3);
    const r = startWith(s, ['civil', 'civil', 'undercover']);
    const late = s.room.addPlayer({ name: 'Retardataire', avatar: 5, tokenHash: 'late' }, s.now.t);
    s.room.attachSocket(late.id, 'late');
    const view = s.room.viewFor(late.id, s.now.t);
    expect(view.me.status).toBe('waiting');
    expect(view.me.secret).toBeNull();
    const json = JSON.stringify(view);
    expect(json).not.toContain(r.pair.civil);
    expect(json).not.toContain(r.pair.undercover);
    expectError(() => s.room.submitClue(late.id, r.turnId, 'hop', s.now.t), 'NOT_ACTIVE');
  });
});

describe('packs et tirage', () => {
  const general = (id: string) => PACKS.find((p) => p.id === id)!.universes.find((u) => !u.precise)!;

  it('tire uniquement dans les packs choisis, sans répétition avant épuisement', () => {
    const memory = newDrawMemory();
    const total = general('football').pairs.length;
    const seen = new Set<string>();
    for (let i = 0; i < total; i++) {
      const pair = drawPair(['football'], memory);
      expect(pair.packId).toBe('football');
      expect(pair.themeName).toBeNull();
      expect(seen.has(pair.id)).toBe(false);
      seen.add(pair.id);
    }
    expect(seen.size).toBe(total);
    drawPair(['football'], memory);
    expect(memory.pairs.size).toBe(1);
  });

  it('évite de reproposer tout de suite un mot déjà vu avec un autre partenaire', () => {
    const memory = newDrawMemory();
    const recent: string[] = [];
    for (let i = 0; i < 6; i++) {
      const pair = drawPair(['animaux'], memory);
      expect(recent).not.toContain(pair.civil);
      expect(recent).not.toContain(pair.undercover);
      recent.push(pair.civil, pair.undercover);
    }
  });

  it('attribue aléatoirement les deux mots aux Civils et aux Undercover', () => {
    const u = general('animaux');
    const only = u.pairs[0];
    const sides = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const memory = newDrawMemory();
      for (const pair of u.pairs) if (pair !== only) memory.pairs.add(`animaux/${u.id}/${[pair.a, pair.b].sort().join('+')}`);
      sides.add(drawPair(['animaux'], memory).civil);
    }
    expect(sides).toEqual(new Set([u.words[only.a].word, u.words[only.b].word]));
  });

  it('en « Thème précis », ne tire que dans l’univers choisi', () => {
    const lol = PACKS.find((p) => p.id === 'jeux-video')!.universes.find((u) => u.id === 'league-of-legends')!;
    const allowed = new Set(Object.values(lol.words).map((w) => w.word));
    const memory = newDrawMemory();
    for (let i = 0; i < 60; i++) {
      const pair = drawPair(['jeux-video', 'animaux'], memory, 'jeux-video:league-of-legends');
      expect(pair.themeName).toBe('League of Legends');
      expect(allowed.has(pair.civil) && allowed.has(pair.undercover)).toBe(true);
    }
    // En partie normale, les univers précis ne sont pas mélangés aux paires générales.
    const normal = newDrawMemory();
    for (let i = 0; i < 60; i++) {
      const pair = drawPair(['jeux-video'], normal);
      expect(pair.id.startsWith('jeux-video/general/')).toBe(true);
    }
  });
});

describe('normalisation', () => {
  it('compare les propositions de Mr. White sans approximation', () => {
    expect(guessMatches('  la reine   des NEIGES', 'La Reine des neiges')).toBe(true);
    expect(guessMatches('Pokemon', 'Pokémon')).toBe(true);
    expect(guessMatches('oeuf au plat', 'Œuf au plat')).toBe(true);
    expect(guessMatches('spider man', 'Spider-Man')).toBe(true);
    expect(guessMatches('Pokemons', 'Pokémon')).toBe(false);
    expect(guessMatches('Reine des neiges', 'La Reine des neiges')).toBe(false);
  });

  it('détecte un indice qui contient le mot', () => {
    expect(clueRevealsWord('PIZZA', 'Pizza')).toBe(true);
    expect(clueRevealsWord('pizza royale', 'Pizza')).toBe(true);
    expect(clueRevealsWord('attaque des titans', "L'Attaque des Titans")).toBe(true);
    expect(clueRevealsWord('spiderman', 'Spider-Man')).toBe(true);
    expect(clueRevealsWord('pizzeria', 'Pizza')).toBe(false);
    expect(clueRevealsWord('italie', 'Pizza')).toBe(false);
  });
});
