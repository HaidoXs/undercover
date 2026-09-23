/**
 * Rôles spéciaux et variantes maison : chaque pouvoir, leurs interactions,
 * l'ordre de résolution et la confidentialité des informations secrètes.
 */
import { describe, expect, it } from 'vitest';
import { specialRolesError, type SpecialRoleId } from '../shared/specialRoles';
import type { GameView, Role } from '../shared/types';
import { GameError } from '../server/game/errors';
import { DEFAULT_TIMINGS, Room } from '../server/game/Room';

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

interface Game {
  room: Room;
  ids: string[];
  now: { t: number };
}

function lobby(n: number): Game {
  const now = { t: 1_000_000 };
  const room = new Room('ROLES2', T, 1, now.t);
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = room.addPlayer({ name: `Joueur ${i}`, avatar: i, tokenHash: `h${i}` }, now.t);
    room.attachSocket(p.id, `s${i}`);
    ids.push(p.id);
  }
  return { room, ids, now };
}

function readyAll(g: Game) {
  for (const id of g.ids.slice(1)) g.room.setReady(id, true);
}

/**
 * Lance une manche avec des camps et des rôles spéciaux imposés (par index de joueur),
 * puis passe la découverte des cartes.
 */
function start(
  g: Game,
  roles: Role[],
  specials: Partial<Record<number, SpecialRoleId>> = {},
  opts: { enabled?: SpecialRoleId[]; falafel?: { vendor: number; target: number; effect: 'protect' | 'sabotage' }; dead?: number[] } = {},
) {
  const { room, ids, now } = g;
  const enabled = opts.enabled ?? [...new Set(Object.values(specials))];
  room.updateSettings(ids[0], {
    undercoverCount: roles.filter((r) => r === 'undercover').length,
    mrWhite: roles.includes('mrwhite'),
    specialRoles: enabled,
  });
  readyAll(g);
  room.start(ids[0], now.t);
  const r = room.round!;
  ids.forEach((id, i) => r.roles.set(id, roles[i]));
  r.baseOrder = [...ids];
  r.special.clear();
  for (const [i, s] of Object.entries(specials)) r.special.set(ids[Number(i)], s as SpecialRoleId);
  const pairOf = (role: SpecialRoleId) => ids.filter((_, i) => specials[i] === role);
  const lovers = pairOf('lovers');
  r.lovers = lovers.length === 2 ? [lovers[0], lovers[1]] : null;
  const duel = pairOf('duelists');
  r.duel = duel.length === 2 ? { a: duel[0], b: duel[1], winnerId: null, draw: false, done: false } : null;
  r.falafel = opts.falafel
    ? { vendorId: ids[opts.falafel.vendor], targetId: ids[opts.falafel.target], effect: opts.falafel.effect, used: false, sabotageCycle: null }
    : null;
  if (r.falafel) r.special.set(r.falafel.vendorId, 'falafel');
  for (const i of opts.dead ?? []) r.alive.delete(ids[i]);
  for (const id of ids) room.markSeen(id, r.id, now.t);
  expect(room.phase).toBe('clues');
  return r;
}

function playClues(g: Game) {
  const r = g.room.round!;
  while (g.room.phase === 'clues') {
    const id = r.order[r.turnIndex];
    if (r.memeId === id) g.room.finishMime(id, r.turnId, g.now.t);
    else g.room.submitClue(id, r.turnId, `indice ${r.clues.length}`, g.now.t);
  }
  expect(g.room.phase).toBe('vote');
}

function vote(g: Game, votes: [number, number][]) {
  const ballot = g.room.round!.ballot!;
  for (const [from, to] of votes) g.room.castVote(g.ids[from], ballot.id, g.ids[to], g.now.t);
}

function advance(g: Game, ms: number) {
  g.now.t += ms;
  g.room.tick(g.now.t);
}

const view = (g: Game, i: number): GameView => g.room.viewFor(g.ids[i], g.now.t);

describe('configuration des rôles spéciaux', () => {
  it('sont tous désactivés par défaut, réservés à l’hôte et verrouillés pendant la manche', () => {
    const g = lobby(6);
    expect(g.room.settings.specialRoles).toEqual([]);
    expectError(() => g.room.updateSettings(g.ids[1], { specialRoles: ['ghost'] }), 'NOT_HOST');
    expectError(() => g.room.updateSettings(g.ids[0], { specialRoles: ['inconnu'] }), 'BAD_REQUEST');
    readyAll(g);
    g.room.updateSettings(g.ids[0], { specialRoles: ['ghost', 'justice'] });
    expect(g.room.settings.specialRoles).toEqual(['justice', 'ghost']);
    expect(g.room.players.every((p) => !p.ready)).toBe(true);
    readyAll(g);
    g.room.start(g.ids[0], g.now.t);
    expectError(() => g.room.updateSettings(g.ids[0], { specialRoles: [] }), 'SETTINGS_LOCKED');
  });

  it('refuse le lancement quand il manque des places ou des joueurs, avec une explication', () => {
    expect(specialRolesError(['lovers'], 4)).toMatch(/au moins 5 joueurs/);
    expect(specialRolesError(['falafel'], 3)).toMatch(/au moins 4 joueurs/);
    expect(specialRolesError(['lovers', 'duelists', 'justice'], 5)).toBeNull();
    expect(specialRolesError(['lovers', 'duelists', 'justice', 'ghost'], 5)).toMatch(/6 places nécessaires pour 5 joueurs/);
    expect(specialRolesError(['justice', 'ghost', 'boomerang', 'meme'], 4)).toBeNull();
    const g = lobby(5);
    g.room.updateSettings(g.ids[0], { specialRoles: ['lovers', 'duelists', 'justice', 'ghost'] });
    readyAll(g);
    try {
      g.room.start(g.ids[0], g.now.t);
      throw new Error('lancement accepté');
    } catch (e) {
      expect((e as GameError).code).toBe('CONFIG_INVALID');
      expect((e as GameError).message).toMatch(/6 places nécessaires pour 5 joueurs/);
    }
  });

  it('attribue au plus un rôle spécial par joueur, sans toucher au mot ni au camp', () => {
    for (let k = 0; k < 40; k++) {
      const g = lobby(10);
      g.room.updateSettings(g.ids[0], { specialRoles: ['justice', 'lovers', 'avenger', 'duelists', 'ghost', 'falafel', 'boomerang', 'meme'] });
      readyAll(g);
      g.room.start(g.ids[0], g.now.t);
      const r = g.room.round!;
      expect(r.special.size).toBe(9);
      expect(new Set(r.special.keys()).size).toBe(9);
      expect(r.lovers).not.toBeNull();
      expect(r.duel).not.toBeNull();
      expect(r.special.get(r.falafel!.vendorId)).toBe('falafel');
      expect([...r.special.values()]).not.toContain('meme');
      expect(r.roles.size).toBe(10);
      // Il reste au moins un joueur sans rôle pour mimer (Mr. Meme).
      expect(g.ids.some((id) => !r.special.has(id))).toBe(true);
    }
  });
});

describe('confidentialité des rôles spéciaux', () => {
  it('ne montre à chacun que son propre rôle et son propre lien, sauf la Justice publique', () => {
    const g = lobby(8);
    start(
      g,
      ['civil', 'civil', 'civil', 'civil', 'civil', 'undercover', 'civil', 'civil'],
      { 0: 'justice', 1: 'lovers', 2: 'lovers', 3: 'duelists', 4: 'duelists', 6: 'boomerang' },
      { falafel: { vendor: 7, target: 5, effect: 'sabotage' } },
    );
    for (let i = 0; i < 8; i++) {
      const v = view(g, i);
      const others = v.players.filter((p) => p.id !== g.ids[i]);
      for (const p of others) {
        if (p.id === g.ids[0]) expect(p.special).toBe('justice');
        else expect(p.special).toBeUndefined();
      }
      const json = JSON.stringify(v);
      expect(json).not.toMatch(/"effect"|sabotage"|protect"/);
    }
    expect(view(g, 1).me.special).toEqual({ role: 'lovers', partnerId: g.ids[2], falafelTargetId: null, falafel: null });
    expect(view(g, 3).me.special?.partnerId).toBe(g.ids[4]);
    expect(view(g, 5).me.special).toEqual({ role: null, partnerId: null, falafelTargetId: null, falafel: 'received' });
    expect(view(g, 7).me.special?.falafelTargetId).toBe(g.ids[5]);
    expect(view(g, 6).me.special?.role).toBe('boomerang');
    expect(view(g, 0).me.special?.partnerId).toBeNull();
    // Le bénéficiaire ne sait pas qui lui a offert le falafel.
    expect(JSON.stringify(view(g, 5).me)).not.toContain(g.ids[7]);
  });
});

describe('Déesse de la Justice', () => {
  it('tranche une égalité parmi les ex æquo, même après son élimination', () => {
    const g = lobby(6);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'civil', 'undercover'], { 0: 'justice' });
    playClues(g);
    vote(g, [[0, 1], [1, 0], [2, 1], [3, 0], [4, 5], [5, 2]]);
    expect(g.room.phase).toBe('power');
    const power = view(g, 3).round!.power!;
    expect(power.kind).toBe('justice');
    expect(power.candidates.sort()).toEqual([g.ids[0], g.ids[1]].sort());
    expectError(() => g.room.usePower(g.ids[1], power.id, g.ids[0], g.now.t), 'NOT_ACTIVE');
    expectError(() => g.room.usePower(g.ids[0], power.id, g.ids[3], g.now.t), 'INVALID_TARGET');
    // Elle peut se désigner elle-même : elle est parmi les ex æquo.
    g.room.usePower(g.ids[0], power.id, g.ids[0], g.now.t);
    expect(r.eliminations.at(-1)).toMatchObject({ playerId: g.ids[0], cause: 'justice' });
    advance(g, T.result + 2000);
    expect(g.room.phase).toBe('clues');
    playClues(g);
    vote(g, [[1, 2], [2, 1], [3, 2], [4, 1], [5, 3]]);
    // Éliminée, elle tranche encore.
    expect(g.room.phase).toBe('power');
    g.room.usePower(g.ids[0], r.power!.id, g.ids[2], g.now.t);
    expect(r.alive.has(g.ids[2])).toBe(false);
  });

  it('laisse place au second scrutin habituel après 15 secondes sans réponse', () => {
    const g = lobby(5);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'undercover'], { 4: 'justice' });
    playClues(g);
    vote(g, [[0, 1], [1, 0], [2, 1], [3, 0], [4, 2]]);
    expect(g.room.phase).toBe('power');
    expect(g.room.deadlineTotal).toBe(15_000);
    advance(g, 15_000);
    expect(g.room.phase).toBe('result');
    expect(r.result!.events.at(-1)).toMatchObject({ type: 'justice-timeout' });
    advance(g, T.tieNotice + 2000);
    expect(g.room.phase).toBe('vote');
    expect(r.ballot!.runoff).toBe(true);
    expect(r.ballot!.candidates.sort()).toEqual([g.ids[0], g.ids[1]].sort());
  });
});

describe('Amoureux', () => {
  it('l’élimination de l’un entraîne celle de l’autre, révélée à tous', () => {
    const g = lobby(6);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'undercover', 'civil'], { 1: 'lovers', 4: 'lovers' });
    playClues(g);
    vote(g, [[0, 1], [1, 0], [2, 1], [3, 1], [4, 0], [5, 1]]);
    expect(r.alive.has(g.ids[1])).toBe(false);
    expect(r.alive.has(g.ids[4])).toBe(false);
    expect(r.result!.events.filter((e) => e.type === 'eliminated').map((e) => (e as { cause: string }).cause)).toEqual(['vote', 'lovers']);
    // L'Undercover mort par amour : plus d'intrus, les Civils gagnent… sans l'amoureux civil.
    advance(g, 20_000);
    expect(g.room.phase).toBe('ended');
    expect(r.end!.winnerSide).toBe('civils');
    expect(r.end!.winners).not.toContain(g.ids[1]);
    expect(r.end!.reason).toMatch(/intrus/);
  });

  it('gagnent seuls s’ils sont les deux derniers vivants, avant toute victoire de camp', () => {
    const g = lobby(5);
    // Il reste 4 vivants ; la Vengeuse, éliminée, emporte un Civil.
    const r = start(g, ['civil', 'civil', 'civil', 'undercover', 'undercover'], { 0: 'lovers', 3: 'lovers', 1: 'avenger' }, { dead: [4] });
    playClues(g);
    vote(g, [[0, 1], [2, 1], [3, 1], [1, 0]]);
    expect(g.room.phase).toBe('power');
    g.room.usePower(g.ids[1], r.power!.id, g.ids[2], g.now.t);
    expect([...r.alive].sort()).toEqual([g.ids[0], g.ids[3]].sort());
    advance(g, 20_000);
    expect(g.room.phase).toBe('ended');
    // 1 Civil contre 1 Undercover : les intrus auraient gagné, mais le couple passe avant.
    expect(r.end).toMatchObject({ winnerSide: 'lovers', winners: [g.ids[0], g.ids[3]] });
    expect(r.end!.reason).toMatch(/Amoureux/);
  });
});

describe('Vengeuse', () => {
  it('emporte un joueur vivant, ce qui déclenche aussi les liens amoureux, une seule fois', () => {
    const g = lobby(7);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'civil', 'undercover', 'undercover'], { 0: 'avenger', 2: 'lovers', 3: 'lovers' });
    playClues(g);
    vote(g, [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 1], [0, 1]]);
    expect(g.room.phase).toBe('power');
    const power = view(g, 4).round!.power!;
    expect(power).toMatchObject({ kind: 'avenger', actorId: g.ids[0] });
    expect(power.candidates).not.toContain(g.ids[0]);
    g.room.usePower(g.ids[0], power.id, g.ids[2], g.now.t);
    const causes = r.result!.events.filter((e) => e.type === 'eliminated').map((e) => [(e as { playerId: string }).playerId, (e as { cause: string }).cause]);
    expect(causes).toEqual([
      [g.ids[0], 'vote'],
      [g.ids[2], 'avenger'],
      [g.ids[3], 'lovers'],
    ]);
    expect(r.avengerUsed).toBe(true);
  });

  it('renonce sans choix dans le délai, et la protection du falafel ne bloque pas sa vengeance', () => {
    const g = lobby(6);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'civil', 'undercover'], { 0: 'avenger' }, { falafel: { vendor: 5, target: 1, effect: 'protect' } });
    playClues(g);
    vote(g, [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [0, 2]]);
    const power = r.power!;
    g.room.usePower(g.ids[0], power.id, g.ids[1], g.now.t);
    expect(r.alive.has(g.ids[1])).toBe(false);
    expect(r.falafel!.used).toBe(false);

    const g2 = lobby(6);
    const r2 = start(g2, ['civil', 'civil', 'civil', 'civil', 'civil', 'undercover'], { 0: 'avenger' });
    playClues(g2);
    vote(g2, [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [0, 2]]);
    advance(g2, 15_000);
    expect(r2.result!.events.at(-1)).toEqual({ type: 'avenger-pass', playerId: g2.ids[0] });
    expect(r2.alive.size).toBe(5);
  });
});

describe('Duellistes', () => {
  it('le premier éliminé perd le duel, annoncé sans finir la manche', () => {
    const g = lobby(6);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'civil', 'undercover'], { 1: 'duelists', 2: 'duelists' });
    playClues(g);
    vote(g, [[0, 1], [1, 0], [2, 1], [3, 1], [4, 1], [5, 1]]);
    expect(r.result!.events).toContainEqual({ type: 'duel', winnerId: g.ids[2], loserId: g.ids[1] });
    advance(g, 20_000);
    expect(g.room.phase).toBe('clues');
  });

  it('déclare un duel nul si les deux tombent pendant la même résolution', () => {
    const g = lobby(6);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'civil', 'undercover'], { 1: 'lovers', 2: 'lovers' });
    // Cas limite forcé : deux duellistes liés par un même enchaînement.
    r.duel = { a: g.ids[1], b: g.ids[2], winnerId: null, draw: false, done: false };
    playClues(g);
    vote(g, [[0, 1], [1, 0], [2, 1], [3, 1], [4, 1], [5, 1]]);
    expect(r.result!.events).toContainEqual({ type: 'duel-draw', playerIds: [g.ids[1], g.ids[2]] });
    expect(r.duel).toMatchObject({ done: true, draw: true, winnerId: null });
  });
});

describe('Fantôme', () => {
  it('vote encore après son élimination sans compter parmi les vivants ni redevenir une cible', () => {
    const g = lobby(6);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'civil', 'undercover'], { 1: 'ghost' });
    playClues(g);
    vote(g, [[0, 1], [1, 0], [2, 1], [3, 1], [4, 1], [5, 1]]);
    advance(g, T.result + 2000);
    expect(g.room.phase).toBe('clues');
    expect(r.order).not.toContain(g.ids[1]);
    expect(view(g, 3).round!.ghostId).toBe(g.ids[1]);
    playClues(g);
    const ballot = r.ballot!;
    expect(ballot.voters).toContain(g.ids[1]);
    expect(ballot.candidates).not.toContain(g.ids[1]);
    g.room.castVote(g.ids[1], ballot.id, g.ids[5], g.now.t);
    expectError(() => g.room.castVote(g.ids[2], ballot.id, g.ids[1], g.now.t), 'INVALID_TARGET');
    // Le Fantôme (Civil) ne reçoit aucun secret supplémentaire : ni l'autre mot, ni d'autre rôle.
    const ghostView = view(g, 1);
    expect(JSON.stringify(ghostView)).not.toContain(JSON.stringify(r.pair.undercover));
    expect(ghostView.me.special).toEqual({ role: 'ghost', partnerId: null, falafelTargetId: null, falafel: null });
    expect(ghostView.players.filter((p) => p.special && p.id !== g.ids[1])).toEqual([]);
  });
});

describe('Vendeur de Falafels', () => {
  it('le vendeur choisit son bénéficiaire avant de continuer, sinon le serveur tire au sort', () => {
    const g = lobby(5);
    g.room.updateSettings(g.ids[0], { specialRoles: ['falafel'] });
    readyAll(g);
    g.room.start(g.ids[0], g.now.t);
    const r = g.room.round!;
    const vendor = r.falafel!.vendorId;
    expectError(() => g.room.markSeen(vendor, r.id, g.now.t), 'BAD_REQUEST');
    expectError(() => g.room.giveFalafel(vendor, r.id, vendor), 'INVALID_TARGET');
    const target = g.ids.find((id) => id !== vendor)!;
    g.room.giveFalafel(vendor, r.id, target);
    expectError(() => g.room.giveFalafel(vendor, r.id, target), 'ALREADY_DONE');
    expect(r.falafel!.targetId).toBe(target);

    const g2 = lobby(4);
    g2.room.updateSettings(g2.ids[0], { specialRoles: ['falafel'] });
    readyAll(g2);
    g2.room.start(g2.ids[0], g2.now.t);
    advance(g2, T.revealMax);
    expect(g2.room.phase).toBe('clues');
    expect(g2.room.round!.falafel!.targetId).not.toBeNull();
    expect(g2.room.round!.falafel!.targetId).not.toBe(g2.room.round!.falafel!.vendorId);
  });

  it('protection : annule une élimination directe par scrutin, puis est consommée', () => {
    const g = lobby(5);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'undercover'], {}, { falafel: { vendor: 0, target: 4, effect: 'protect' } });
    playClues(g);
    vote(g, [[0, 4], [1, 4], [2, 4], [3, 4], [4, 0]]);
    expect(r.result!.outcome).toEqual({ type: 'protected', playerId: g.ids[4] });
    expect(r.alive.has(g.ids[4])).toBe(true);
    expect(r.falafel!.used).toBe(true);
    advance(g, T.result + 2000);
    playClues(g);
    vote(g, [[0, 4], [1, 4], [2, 4], [3, 4], [4, 0]]);
    expect(r.alive.has(g.ids[4])).toBe(false);
  });

  it('sabotage : le bénéficiaire ne vote pas au prochain tour de vote, second scrutin compris, prévenu en privé', () => {
    const g = lobby(5);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'undercover'], {}, { falafel: { vendor: 0, target: 2, effect: 'sabotage' } });
    expect(view(g, 2).me.special?.falafel).toBe('received');
    playClues(g);
    expect(view(g, 2).me.special?.falafel).toBe('sabotaged');
    expect(view(g, 1).me.special).toBeNull();
    const ballot = r.ballot!;
    expectError(() => g.room.castVote(g.ids[2], ballot.id, g.ids[4], g.now.t), 'NOT_ACTIVE');
    // Les autres votent : égalité → second scrutin, toujours bloqué.
    vote(g, [[0, 1], [1, 0], [3, 1], [4, 0]]);
    expect(r.result!.outcome.type).toBe('tie');
    advance(g, T.tieNotice + 1000);
    expectError(() => g.room.castVote(g.ids[2], r.ballot!.id, g.ids[0], g.now.t), 'NOT_ACTIVE');
    vote(g, [[0, 1], [1, 0], [3, 1], [4, 1]]);
    expect(r.falafel!.used).toBe(true);
    advance(g, T.result + 2000);
    playClues(g);
    // Tour suivant : il vote de nouveau.
    g.room.castVote(g.ids[2], r.ballot!.id, g.ids[4], g.now.t);
  });
});

describe('Boomerang', () => {
  it('renvoie une fois les votes contre lui vers leurs auteurs, avec un seul recalcul', () => {
    const g = lobby(6);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'civil', 'undercover'], { 5: 'boomerang' });
    playClues(g);
    vote(g, [[0, 5], [1, 5], [2, 5], [3, 1], [4, 1], [5, 3]]);
    // 3 votes contre le Boomerang reviennent à 0, 1 et 2 : Joueur 1 a 3 voix (2 + la sienne renvoyée).
    expect(r.result!.events[0]).toEqual({ type: 'boomerang', playerId: g.ids[5] });
    expect(r.result!.outcome).toMatchObject({ type: 'eliminated', playerId: g.ids[1] });
    expect(r.alive.has(g.ids[5])).toBe(true);
    advance(g, 20_000);
    playClues(g);
    vote(g, [[0, 5], [2, 5], [3, 5], [4, 5], [5, 0]]);
    // Pouvoir déjà utilisé : il est éliminé.
    expect(r.alive.has(g.ids[5])).toBe(false);
  });

  it('peut produire une égalité après recalcul, résolue normalement', () => {
    const g = lobby(5);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'undercover'], { 4: 'boomerang' });
    playClues(g);
    vote(g, [[0, 4], [1, 4], [2, 3], [3, 4], [4, 2]]);
    // Renvoi : 0, 1 et 3 prennent une voix chacun ; 2 et 3 en ont déjà… 3 a 2 voix, seul en tête.
    expect(r.result!.outcome).toMatchObject({ type: 'eliminated', playerId: g.ids[3] });
    const g2 = lobby(5);
    const r2 = start(g2, ['civil', 'civil', 'civil', 'civil', 'undercover'], { 4: 'boomerang' });
    playClues(g2);
    vote(g2, [[0, 4], [1, 4], [2, 4], [3, 4], [4, 2]]);
    // 0, 1, 2, 3 reçoivent chacun leur vote, 2 en a une de plus : 2 éliminé.
    expect(r2.result!.outcome).toMatchObject({ type: 'eliminated', playerId: g2.ids[2] });
  });
});

describe('Fou de joie', () => {
  it('gagne seul et arrête la manche s’il est éliminé directement par le vote du premier tour', () => {
    const g = lobby(5);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'undercover'], { 2: 'joyfool', 0: 'lovers', 1: 'lovers' }, { enabled: ['joyfool', 'lovers'] });
    playClues(g);
    vote(g, [[0, 2], [1, 2], [3, 2], [4, 2], [2, 0]]);
    expect(g.room.phase).toBe('ended');
    expect(r.end).toMatchObject({ winnerSide: 'joyfool', winners: [g.ids[2]] });
    expect(r.end!.reason).toMatch(/Fou de joie/);
  });

  it('compte le second scrutin du premier tour, mais pas une mort par amour ni un tour suivant', () => {
    const g = lobby(5);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'undercover'], { 2: 'joyfool' });
    playClues(g);
    vote(g, [[0, 2], [1, 3], [3, 2], [4, 3], [2, 0]]);
    advance(g, T.tieNotice + 1000);
    vote(g, [[0, 2], [1, 2], [3, 2], [4, 3], [2, 3]]);
    expect(r.end?.winnerSide).toBe('joyfool');

    const g2 = lobby(5);
    const r2 = start(g2, ['civil', 'civil', 'civil', 'civil', 'undercover'], { 2: 'lovers', 3: 'lovers', 0: 'joyfool' }, { enabled: ['joyfool', 'lovers'] });
    r2.lovers = [g2.ids[0], g2.ids[1]];
    playClues(g2);
    vote(g2, [[0, 1], [2, 1], [3, 1], [4, 1], [1, 0]]);
    // Le Fou de joie meurt par amour : pas de victoire, la manche continue.
    expect(r2.alive.has(g2.ids[0])).toBe(false);
    expect(g2.room.phase).toBe('result');
    advance(g2, 20_000);
    expect(r2.end?.winnerSide).not.toBe('joyfool');

    const g3 = lobby(5);
    const r3 = start(g3, ['civil', 'civil', 'civil', 'civil', 'undercover'], { 2: 'joyfool' });
    playClues(g3);
    advance(g3, 60_000); // aucun vote au premier tour
    advance(g3, T.result + 1000);
    playClues(g3);
    vote(g3, [[0, 2], [1, 2], [3, 2], [4, 2], [2, 0]]);
    expect(r3.end?.winnerSide).not.toBe('joyfool');
    expect(r3.alive.has(g3.ids[2])).toBe(false);
  });

  it('protégé par un falafel, il n’est pas éliminé et ne gagne pas', () => {
    const g = lobby(5);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'undercover'], { 2: 'joyfool' }, { falafel: { vendor: 0, target: 2, effect: 'protect' } });
    playClues(g);
    vote(g, [[0, 2], [1, 2], [3, 2], [4, 2], [2, 0]]);
    expect(r.result!.outcome.type).toBe('protected');
    expect(r.end).toBeNull();
  });
});

describe('Mr. Meme', () => {
  it('désigne à chaque tour un joueur différent sans autre rôle, qui mime au lieu d’écrire', () => {
    const g = lobby(6);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'civil', 'undercover'], { 0: 'justice', 1: 'ghost' }, { enabled: ['justice', 'ghost', 'meme'] });
    const seen = new Set<string>();
    for (let cycle = 1; cycle <= 3; cycle++) {
      const meme = r.memeId!;
      expect(meme).toBeTruthy();
      expect([g.ids[0], g.ids[1]]).not.toContain(meme);
      expect(seen.has(meme)).toBe(false);
      seen.add(meme);
      expect(view(g, 0).round!.memeId).toBe(meme);
      while (r.order[r.turnIndex] !== meme) g.room.submitClue(r.order[r.turnIndex], r.turnId, 'indice', g.now.t);
      expectError(() => g.room.submitClue(meme, r.turnId, 'parler', g.now.t), 'BAD_REQUEST');
      g.room.finishMime(meme, r.turnId, g.now.t);
      expect(r.clues.at(-1)).toMatchObject({ playerId: meme, mimed: true, text: null });
      while (g.room.phase === 'clues') g.room.submitClue(r.order[r.turnIndex], r.turnId, 'indice', g.now.t);
      advance(g, 60_000); // personne ne vote
      advance(g, T.result + 1000);
    }
  });

  it('compte le mime comme fait à la fin du temps, mais « Passé » si le mime est déconnecté', () => {
    for (const disconnected of [false, true]) {
      const g = lobby(5);
      const r = start(g, ['civil', 'civil', 'civil', 'civil', 'undercover'], {}, { enabled: ['meme'] });
      const meme = r.memeId!;
      while (r.order[r.turnIndex] !== meme) g.room.submitClue(r.order[r.turnIndex], r.turnId, 'indice', g.now.t);
      if (disconnected) {
        g.room.detachSocket(meme, `s${g.ids.indexOf(meme)}`, g.now.t);
        advance(g, T.disconnectGrace);
      } else {
        advance(g, 120_000);
      }
      const clue = r.clues.find((c) => c.playerId === meme)!;
      expect(clue.text).toBeNull();
      expect(clue.mimed ?? false).toBe(!disconnected);
    }
  });
});

describe('ordre de résolution', () => {
  it('donne sa tentative à un Mr. White emporté par l’amour, avant les victoires', () => {
    const g = lobby(6);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'undercover', 'mrwhite'], { 1: 'lovers', 5: 'lovers' });
    playClues(g);
    vote(g, [[0, 1], [2, 1], [3, 1], [4, 1], [5, 0], [1, 0]]);
    advance(g, 20_000);
    expect(g.room.phase).toBe('mrwhite');
    expect(r.mrWhite!.playerId).toBe(g.ids[5]);
    g.room.submitGuess(g.ids[5], r.mrWhite!.attemptId, r.pair.civil, g.now.t);
    expect(r.end).toMatchObject({ winnerSide: 'mrwhite', winners: [g.ids[5]] });
  });

  it('annonce une manche nulle quand personne ne survit', () => {
    const g = lobby(5);
    // Ne restent que la Vengeuse et le couple : le vote élimine la Vengeuse, qui emporte un amoureux.
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'undercover'], { 0: 'avenger', 1: 'lovers', 2: 'lovers' }, { enabled: ['avenger', 'lovers'], dead: [3, 4] });
    playClues(g);
    vote(g, [[1, 0], [2, 0], [0, 1]]);
    g.room.usePower(g.ids[0], r.power!.id, g.ids[1], g.now.t);
    expect(r.alive.size).toBe(0);
    advance(g, 20_000);
    expect(r.end).toMatchObject({ winnerSide: 'draw', winners: [] });
    expect(r.end!.reason).toMatch(/nulle/);
  });
});

describe('reconnexion', () => {
  it('conserve un pouvoir en attente, son identifiant et son échéance', () => {
    const g = lobby(5);
    const r = start(g, ['civil', 'civil', 'civil', 'civil', 'undercover'], { 0: 'avenger' });
    playClues(g);
    vote(g, [[1, 0], [2, 0], [3, 0], [4, 0], [0, 1]]);
    const before = view(g, 0);
    g.room.detachSocket(g.ids[0], 's0', g.now.t);
    advance(g, 2000);
    g.room.attachSocket(g.ids[0], 'nouvelle-connexion');
    const after = view(g, 0);
    expect(after.phase).toBe('power');
    expect(after.round!.power!.id).toBe(before.round!.power!.id);
    expect(after.deadline).toBe(before.deadline);
    g.room.usePower(g.ids[0], after.round!.power!.id, g.ids[1], g.now.t);
    expect(r.alive.has(g.ids[1])).toBe(false);
  });
});
