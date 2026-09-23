/**
 * Parcours critiques joués par plusieurs sessions Socket.IO indépendantes contre un vrai serveur.
 * Les durées sont accélérées (timeScale) ; chaque test démarre son propre serveur.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CODE_ALPHABET } from '../shared/constants';
import type { GameView, Role } from '../shared/types';
import { startServer, type RunningServer } from '../server/app';
import type { Room } from '../server/game/Room';

const SCALE = 0.02; // 30 s → 0,6 s
let server: RunningServer;
let clients: Client[] = [];
let staticDir: string;

type AckResult = { ok: boolean; error?: { code: string; message: string }; [key: string]: unknown };

class Client {
  socket!: Socket;
  views: GameView[] = [];
  /** Tout ce que ce navigateur a reçu, tel quel, pour vérifier l'absence de fuite. */
  received: string[] = [];
  token = '';
  code = '';
  id = '';

  static async connect(): Promise<Client> {
    const c = new Client();
    await c.open();
    clients.push(c);
    return c;
  }

  async open(): Promise<void> {
    this.socket = io(server.url, { transports: ['websocket'], forceNew: true, reconnection: false });
    this.socket.onAny((event, ...args) => {
      this.received.push(JSON.stringify({ event, args }));
      if (event === 'state') this.views.push(args[0] as GameView);
    });
    await new Promise<void>((resolve, reject) => {
      this.socket.once('connect', () => resolve());
      this.socket.once('connect_error', reject);
    });
  }

  get view(): GameView {
    return this.views[this.views.length - 1];
  }

  async emit(event: string, payload: object = {}): Promise<AckResult> {
    return (await this.socket.timeout(4000).emitWithAck(event, payload)) as AckResult;
  }

  async ok(event: string, payload: object = {}): Promise<AckResult> {
    const res = await this.emit(event, payload);
    if (!res.ok) throw new Error(`${event} refusé : ${res.error?.code} ${res.error?.message}`);
    return res;
  }

  async waitFor(pred: (v: GameView) => boolean, timeout = 6000): Promise<GameView> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const v = this.view;
      if (v && pred(v)) return v;
      await new Promise((r) => setTimeout(r, 15));
    }
    throw new Error(`Condition non atteinte (phase actuelle : ${this.view?.phase})`);
  }

  /** Simule un rafraîchissement : nouvelle connexion, même jeton. */
  async refresh(): Promise<void> {
    this.socket.disconnect();
    this.views = [];
    await this.open();
    await this.ok('session:resume', { code: this.code, token: this.token });
    await this.waitFor(() => true);
  }
}

async function host(name = 'Hôte', settings: Record<string, unknown> = {}): Promise<Client> {
  const c = await Client.connect();
  const res = await c.ok('room:create', { name, avatar: 0 });
  c.token = res.token as string;
  c.code = res.code as string;
  c.id = res.playerId as string;
  await c.waitFor((v) => v.code === c.code);
  if (Object.keys(settings).length) await c.ok('lobby:settings', { patch: settings });
  return c;
}

async function join(code: string, name: string): Promise<Client> {
  const c = await Client.connect();
  const res = await c.ok('room:join', { code, name, avatar: 1 });
  c.token = res.token as string;
  c.code = code;
  c.id = res.playerId as string;
  await c.waitFor((v) => v.code === code);
  return c;
}

function roomOf(code: string): Room {
  return server.manager.rooms.get(code) as Room;
}

/** Crée un salon de n joueurs, lance la manche et passe la découverte des cartes. */
async function startedRound(n: number, settings: Record<string, unknown> = {}) {
  const h = await host('Hôte', { clueSeconds: 90, voteSeconds: 120, ...settings });
  const players = [h];
  for (let i = 1; i < n; i++) players.push(await join(h.code, `Joueur ${i}`));
  for (const p of players.slice(1)) await p.ok('lobby:ready', { ready: true });
  await h.ok('game:start');
  await Promise.all(players.map((p) => p.waitFor((v) => v.phase === 'reveal')));
  const roundId = h.view.round!.id;
  // Le Vendeur de Falafels offre d'abord son falafel, comme l'exige l'interface.
  const vendor = players.find((p) => p.view.me.special?.role === 'falafel');
  if (vendor) await vendor.ok('game:falafel', { roundId, targetId: players.find((p) => p !== vendor)!.id });
  for (const p of players) await p.ok('game:seen', { roundId });
  await Promise.all(players.map((p) => p.waitFor((v) => v.phase === 'clues')));
  const room = roomOf(h.code);
  const roleOf = (c: Client) => room.round!.roles.get(c.id) as Role;
  return { h, players, room, roleOf };
}

async function playClues(players: Client[]): Promise<void> {
  const h = players[0];
  let n = 0;
  while (h.view.phase === 'clues') {
    const turn = h.view.round!.turn!;
    const current = players.find((p) => p.id === turn.playerId)!;
    await current.ok('game:clue', { turnId: turn.turnId, text: `indice ${n++}` });
    await h.waitFor((v) => v.phase !== 'clues' || v.round!.turn!.turnId !== turn.turnId);
  }
}

async function voteAll(players: Client[], targetOf: (p: Client) => Client | null): Promise<void> {
  const ballotId = players[0].view.round!.ballot!.id;
  for (const p of players) {
    const target = targetOf(p);
    if (target) await p.ok('game:vote', { ballotId, targetId: target.id });
  }
}

beforeEach(async () => {
  staticDir = mkdtempSync(path.join(tmpdir(), 'undercover-'));
  writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><title>Undercover</title><div id="root"></div>');
  server = await startServer({ port: 0, host: '127.0.0.1', timeScale: SCALE, tickMs: 20, quiet: true, staticDir });
  clients = [];
});

afterEach(async () => {
  for (const c of clients) c.socket.disconnect();
  await server.close();
});

describe('création et invitations', () => {
  it('crée un salon avec un code court sans caractère ambigu, rejoignable par code et par lien', async () => {
    const h = await host('Léa');
    expect(h.code).toMatch(new RegExp(`^[${CODE_ALPHABET}]{6}$`));
    expect(h.view.hostId).toBe(h.id);

    // Lien d'invitation : la page s'ouvre directement (application monopage).
    const page = await fetch(`${server.url}/r/${h.code}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('<div id="root">');

    // Code saisi à la main, en minuscules avec un tiret.
    const guest = await Client.connect();
    const check = await guest.ok('room:check', { code: `${h.code.slice(0, 3).toLowerCase()}-${h.code.slice(3)}` });
    expect(check).toMatchObject({ code: h.code, players: 1, inProgress: false });
    const res = await guest.ok('room:join', { code: h.code, name: 'Tom', avatar: 0 });
    expect(res.token).toBeTruthy();
    await h.waitFor((v) => v.players.length === 2);
    const tom = h.view.players.find((p) => p.name === 'Tom')!;
    expect(tom.avatar).not.toBe(0); // avatar déjà pris : un autre est attribué
    expect(tom.isHost).toBe(false);
  });

  it('explique un code inconnu, mal formé, expiré ou un salon plein', async () => {
    const c = await Client.connect();
    expect((await c.emit('room:check', { code: 'ZZZZZZ' })).error?.code).toBe('ROOM_NOT_FOUND');
    expect((await c.emit('room:check', { code: 'AB0' })).error?.code).toBe('CODE_INVALID');

    const h = await host('Hôte');
    for (let i = 1; i < 12; i++) {
      const res = await c.emit('room:join', { code: h.code, name: `Ami ${i}`, avatar: i });
      expect(res.ok).toBe(true);
      c.socket.disconnect();
      await c.open();
    }
    expect((await c.emit('room:join', { code: h.code, name: 'Treizième', avatar: 0 })).error?.code).toBe('ROOM_FULL');

    // Expiration : 30 min sans joueur connecté.
    const lonely = await host('Seul');
    lonely.socket.disconnect();
    await new Promise((r) => setTimeout(r, 100));
    server.manager.tick(Date.now() + 31 * 60_000 * SCALE);
    expect((await c.emit('room:check', { code: lonely.code })).error?.code).toBe('ROOM_EXPIRED');
  });

  it('limite les recherches de code infructueuses', async () => {
    const h = await host('Hôte');
    const c = await Client.connect();
    const codes: (string | undefined)[] = [];
    for (let i = 0; i < 16; i++) codes.push((await c.emit('room:check', { code: 'ZZZZZZ' })).error?.code);
    expect(codes.slice(0, 12).every((x) => x === 'ROOM_NOT_FOUND')).toBe(true);
    expect(codes.slice(12).every((x) => x === 'RATE_LIMITED')).toBe(true);
    // Une fois bloquée, cette adresse ne peut plus sonder aucun code, même valide.
    expect((await c.emit('room:check', { code: h.code })).error?.code).toBe('RATE_LIMITED');
  });

  it('laisse un groupe de 12 amis sur la même connexion rejoindre et se reconnecter', async () => {
    const h = await host('Hôte');
    const friends: Client[] = [];
    for (let i = 1; i < 12; i++) {
      const c = await Client.connect();
      await c.ok('room:check', { code: h.code });
      const res = await c.ok('room:join', { code: h.code, name: `Ami ${i}`, avatar: i });
      c.code = h.code;
      c.token = res.token as string;
      friends.push(c);
    }
    for (const f of friends) await f.refresh();
    for (const f of friends) await f.refresh();
    await h.waitFor((v) => v.players.length === 12 && v.players.every((p) => p.connected));
  });

  it('génère des codes uniques parmi les salons actifs', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const { code } = server.manager.createRoom(`fake-${i}`, `Hôte ${i}`, 0, Date.now());
      expect(seen.has(code)).toBe(false);
      seen.add(code);
    }
    expect(server.manager.rooms.size).toBe(400);
  });

  it('affiche les pseudos comme du texte et refuse les pseudos invalides', async () => {
    const h = await host('Hôte');
    const c = await Client.connect();
    expect((await c.emit('room:join', { code: h.code, name: 'x', avatar: 0 })).error?.code).toBe('NAME_INVALID');
    expect((await c.emit('room:join', { code: h.code, name: 'a'.repeat(17), avatar: 0 })).error?.code).toBe('NAME_INVALID');
    expect((await c.emit('room:join', { code: h.code, name: ' hôte ', avatar: 0 })).error?.code).toBe('NAME_TAKEN');
    await c.ok('room:join', { code: h.code, name: '<b>x</b>​', avatar: 0 });
    await h.waitFor((v) => v.players.length === 2);
    expect(h.view.players[1].name).toBe('<b>x</b>');
  });
});

describe('droits de l’hôte', () => {
  it('réserve paramètres, lancement et revanche à l’hôte ; le code ne donne aucun droit', async () => {
    const h = await host('Hôte');
    const a = await join(h.code, 'Alice');
    const b = await join(h.code, 'Bob');
    expect((await a.emit('lobby:settings', { patch: { undercoverCount: 1 } })).error?.code).toBe('NOT_HOST');
    expect((await a.emit('game:start')).error?.code).toBe('NOT_HOST');
    expect((await a.emit('game:replay')).error?.code).toBe('NOT_HOST');
    // Une nouvelle connexion avec le code ne peut pas reprendre la place de l'hôte.
    const intruder = await Client.connect();
    expect((await intruder.emit('session:resume', { code: h.code, token: 'x'.repeat(43) })).error?.code).toBe('SESSION_INVALID');

    expect((await h.emit('game:start')).error?.code).toBe('NOT_READY');
    await a.ok('lobby:ready', { ready: true });
    await b.ok('lobby:ready', { ready: true });
    await h.ok('lobby:settings', { patch: { voteSeconds: 90 } });
    await h.waitFor((v) => v.players.every((p) => !p.ready));
    expect((await h.emit('game:start')).error?.code).toBe('NOT_READY');
    expect((await h.emit('lobby:settings', { patch: { packIds: [] } })).ok).toBe(true);
    await a.ok('lobby:ready', { ready: true });
    await b.ok('lobby:ready', { ready: true });
    expect((await h.emit('game:start')).error?.code).toBe('NO_PACK');
  });

  it('verrouille les paramètres pendant la manche et refuse un double lancement', async () => {
    const { h } = await startedRound(3);
    expect((await h.emit('lobby:settings', { patch: { clueSeconds: 30 } })).error?.code).toBe('SETTINGS_LOCKED');
    expect((await h.emit('game:start')).error?.code).toBe('WRONG_PHASE');
  });
});

describe('manche complète et confidentialité', () => {
  it('ne transmet jamais les mots, rôles et votes d’autrui avant leur révélation', async () => {
    // Pack aux mots longs : une recherche de sous-chaîne ne peut pas tomber par hasard dans un identifiant.
    const { h, players, room, roleOf } = await startedRound(5, { mrWhite: true, undercoverCount: 1, packIds: ['films-series'] });
    const { civil, undercover } = room.round!.pair;
    const q = (w: string) => JSON.stringify(w);

    // Cartes : chacun ne reçoit que la sienne.
    for (const p of players) {
      const role = roleOf(p);
      const pair = room.round!.pair;
      expect(p.view.me.secret).toEqual(
        role === 'mrwhite'
          ? { kind: 'mrwhite', theme: pair.theme }
          : role === 'civil'
            ? { kind: 'word', word: civil, description: pair.civilDescription }
            : { kind: 'word', word: undercover, description: pair.undercoverDescription },
      );
    }

    await playClues(players);
    await h.waitFor((v) => v.phase === 'vote');
    const intruder = players.find((p) => roleOf(p) === 'undercover')!;
    const ballotId = h.view.round!.ballot!.id;
    await players[1].ok('game:vote', { ballotId, targetId: intruder.id === players[1].id ? h.id : intruder.id });
    await h.waitFor((v) => v.round!.ballot!.voted.length === 1);
    // On voit qui a voté, pas contre qui.
    expect(h.view.round!.ballot!.myVote).toBeNull();

    // Contrôle de tout ce que chaque navigateur a reçu jusqu'ici.
    for (const p of players) {
      const all = p.received.join('\n');
      const role = roleOf(p);
      if (role !== 'civil') expect(all).not.toContain(q(civil));
      if (role !== 'undercover') expect(all).not.toContain(q(undercover));
      // Descriptions privées et thème de Mr. White : jamais transmis à un autre joueur.
      const { civilDescription, undercoverDescription, theme } = room.round!.pair;
      if (role !== 'civil') expect(all).not.toContain(q(civilDescription));
      if (role !== 'undercover') expect(all).not.toContain(q(undercoverDescription));
      if (role !== 'mrwhite') expect(all).not.toContain(q(theme));
      expect(all).not.toContain('"role":');
      expect(all).not.toContain('targetId');
      expect(all).not.toContain('packName');
    }
    // Les métadonnées de packs ne contiennent aucun mot.
    // Seule exception : un mot identique au nom public d'un univers précis (« Harry Potter »), affiché quel que soit le tirage.
    const packs = await (await fetch(`${server.url}/api/packs`)).text();
    const universeNames = new Set((JSON.parse(packs).packs as { universes: { name: string }[] }[]).flatMap((p) => p.universes.map((u) => u.name)));
    for (const word of [civil, undercover]) if (!universeNames.has(word)) expect(packs).not.toContain(q(word));
    const { civilDescription, undercoverDescription } = room.round!.pair;
    expect(packs).not.toContain(civilDescription);
    expect(packs).not.toContain(undercoverDescription);
  });

  it('joue une manche jusqu’à la victoire des Civils, révèle rôles et mots, puis rejoue', async () => {
    const { h, players, roleOf } = await startedRound(4);
    await playClues(players);
    await h.waitFor((v) => v.phase === 'vote');
    const uc = players.find((p) => roleOf(p) === 'undercover')!;
    await voteAll(players, (p) => (p === uc ? players.find((x) => x !== uc)! : uc));
    const result = await h.waitFor((v) => v.phase === 'result');
    expect(result.round!.result!.outcome).toEqual({ type: 'eliminated', playerId: uc.id, role: 'undercover' });
    const end = await h.waitFor((v) => v.phase === 'ended');
    expect(end.round!.end!.winnerSide).toBe('civils');
    expect(end.round!.end!.roles).toHaveLength(4);
    expect(end.round!.end!.civilWord).toBeTruthy();

    // Revanche : même salon, mêmes paramètres, statuts remis à zéro.
    const settings = h.view.settings;
    await h.ok('game:replay');
    const lobby = await h.waitFor((v) => v.phase === 'lobby');
    expect(lobby.settings).toEqual(settings);
    expect(lobby.players.every((p) => !p.ready && p.status === 'lobby')).toBe(true);
    for (const p of players.slice(1)) await p.ok('lobby:ready', { ready: true });
    await h.ok('game:start');
    const next = await h.waitFor((v) => v.phase === 'reveal');
    expect(next.round!.number).toBe(2);
  });

  it('gère égalité, second scrutin, abstentions et nouveau tour d’indices', async () => {
    const { h, players, room } = await startedRound(4);
    await playClues(players);
    await h.waitFor((v) => v.phase === 'vote');
    const [a, b, c, d] = players;
    await voteAll(players, (p) => (p === a ? b : p === b ? a : p === c ? a : b));
    const tie = await h.waitFor((v) => v.phase === 'result');
    expect(tie.round!.result!.outcome).toEqual({ type: 'tie', tied: expect.arrayContaining([a.id, b.id]) });
    const runoff = await h.waitFor((v) => v.phase === 'vote' && v.round!.ballot!.runoff);
    expect(runoff.round!.ballot!.candidates.sort()).toEqual([a.id, b.id].sort());
    expect(runoff.round!.ballot!.voters).toHaveLength(4);
    expect((await c.emit('game:vote', { ballotId: runoff.round!.ballot!.id, targetId: d.id })).error?.code).toBe('INVALID_TARGET');
    // Deux votes seulement, les autres s'abstiennent jusqu'à l'échéance : égalité persistante.
    await a.ok('game:vote', { ballotId: runoff.round!.ballot!.id, targetId: b.id });
    await b.ok('game:vote', { ballotId: runoff.round!.ballot!.id, targetId: a.id });
    const persist = await h.waitFor((v) => v.phase === 'result', 8000);
    expect(persist.round!.result!.outcome.type).toBe('tie-persist');
    expect(persist.round!.result!.votes.filter((v) => v.targetId === null)).toHaveLength(2);
    const again = await h.waitFor((v) => v.phase === 'clues');
    expect(again.round!.cycle).toBe(2);
    expect(room.round!.alive.size).toBe(4);
  });

  it('refuse les actions répétées ou envoyées après un changement de phase', async () => {
    const { h, players } = await startedRound(3);
    const turn = h.view.round!.turn!;
    const first = players.find((p) => p.id === turn.playerId)!;
    const other = players.find((p) => p.id !== turn.playerId)!;
    expect((await other.emit('game:clue', { turnId: turn.turnId, text: 'hop' })).error?.code).toBe('NOT_YOUR_TURN');
    const [r1, r2] = await Promise.all([
      first.emit('game:clue', { turnId: turn.turnId, text: 'un' }),
      first.emit('game:clue', { turnId: turn.turnId, text: 'deux' }),
    ]);
    expect([r1.ok, r2.ok].sort()).toEqual([false, true]);
    expect([r1.error?.code, r2.error?.code]).toContain('STALE_ACTION');
    await playClues(players);
    await h.waitFor((v) => v.phase === 'vote');
    const ballotId = h.view.round!.ballot!.id;
    await h.ok('game:vote', { ballotId, targetId: players[1].id });
    expect((await h.emit('game:vote', { ballotId, targetId: players[2].id })).error?.code).toBe('ALREADY_DONE');
    expect((await h.emit('game:vote', { ballotId, targetId: h.id })).error?.code).toBe('ALREADY_DONE');
    expect((await players[1].emit('game:vote', { ballotId, targetId: players[1].id })).error?.code).toBe('SELF_VOTE');
    // Après la clôture, un vote tardif est refusé.
    await players[1].ok('game:vote', { ballotId, targetId: players[2].id });
    await players[2].ok('game:vote', { ballotId, targetId: players[1].id });
    await h.waitFor((v) => v.phase !== 'vote');
    expect((await players[2].emit('game:vote', { ballotId, targetId: h.id })).error?.code).toBe('WRONG_PHASE');
    expect((await h.emit('game:clue', { turnId: turn.turnId, text: 'trop tard' })).error?.code).toMatch(/WRONG_PHASE|STALE_ACTION/);
  });
});

describe('rôles spéciaux sur le réseau', () => {
  it('ne transmet les liens, rôles et effets secrets qu’à leurs destinataires', async () => {
    const { h, players, room } = await startedRound(9, {
      specialRoles: ['justice', 'lovers', 'duelists', 'falafel', 'boomerang', 'ghost'],
    });
    const r = room.round!;
    const special = (c: Client) => r.special.get(c.id) ?? null;
    const lovers = r.lovers!;
    const duel = [r.duel!.a, r.duel!.b];
    for (const p of players) {
      for (const raw of p.received) {
        const msg = JSON.parse(raw) as { event: string; args: unknown[] };
        if (msg.event !== 'state') continue;
        const v = msg.args[0] as GameView;
        // Rôles d'autrui : seule la Justice est publique.
        for (const other of v.players) {
          if (other.id === p.id || !other.special) continue;
          expect(other.special).toBe('justice');
        }
        // Liens secrets : seulement pour les Amoureux et les Duellistes concernés.
        const partner = v.me.special?.partnerId ?? null;
        if (v.phase === 'lobby') expect(v.me.special).toBeNull();
        else if (lovers.includes(p.id)) expect(partner).toBe(lovers.find((id) => id !== p.id));
        else if (duel.includes(p.id)) expect(partner).toBe(duel.find((id) => id !== p.id));
        else expect(partner).toBeNull();
      }
      const all = p.received.join(' ');
      // L'effet du falafel n'est jamais transmis avant la fin de la manche.
      expect(all).not.toContain('"effect"');
      // Le bénéficiaire ne découvre pas qui lui a offert son falafel.
      if (r.falafel?.targetId === p.id && special(p) !== 'falafel') {
        expect(JSON.stringify(p.view.me)).not.toContain(r.falafel.vendorId);
      }
    }
    expect(h.view.settings.specialRoles).toEqual(['justice', 'lovers', 'duelists', 'ghost', 'falafel', 'boomerang']);
  });
});

describe('Mr. White', () => {
  async function mrWhiteEliminated() {
    const ctx = await startedRound(5, { mrWhite: true, undercoverCount: 1 });
    await playClues(ctx.players);
    await ctx.h.waitFor((v) => v.phase === 'vote');
    const mw = ctx.players.find((p) => ctx.roleOf(p) === 'mrwhite')!;
    await voteAll(ctx.players, (p) => (p === mw ? ctx.players.find((x) => x !== mw)! : mw));
    await ctx.h.waitFor((v) => v.phase === 'mrwhite');
    return { ...ctx, mw };
  }

  it('gagne immédiatement avec le bon mot, malgré casse, accents et espaces', async () => {
    const { h, mw, room } = await mrWhiteEliminated();
    const attemptId = mw.view.round!.mrWhite!.attemptId;
    const civil = room.round!.pair.civil;
    const messy = `  ${civil.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '').split(' ').join('   ')} `;
    await mw.ok('game:guess', { attemptId, text: messy });
    const end = await h.waitFor((v) => v.phase === 'ended');
    expect(end.round!.end).toMatchObject({ winnerSide: 'mrwhite', winners: [mw.id] });
  });

  it('échoue sur un mauvais mot et la manche continue ; un autre joueur ne peut pas répondre', async () => {
    const { h, mw, players } = await mrWhiteEliminated();
    const attemptId = mw.view.round!.mrWhite!.attemptId;
    const other = players.find((p) => p !== mw)!;
    expect((await other.emit('game:guess', { attemptId, text: 'triche' })).error?.code).toBe('NOT_ACTIVE');
    await mw.ok('game:guess', { attemptId, text: 'certainement pas ça' });
    expect((await mw.emit('game:guess', { attemptId, text: 'encore' })).error?.code).toBe('ALREADY_DONE');
    const resolved = await h.waitFor((v) => v.round?.mrWhite?.resolved === true);
    expect(resolved.round!.mrWhite).toMatchObject({ correct: false, guess: 'certainement pas ça' });
    // 3 Civils et 1 Undercover restants : la manche continue.
    const next = await h.waitFor((v) => v.phase === 'clues');
    expect(next.round!.cycle).toBe(2);
  });
});

describe('connexions', () => {
  it('restaure la même identité et le même mot après un rafraîchissement', async () => {
    const { players, roleOf } = await startedRound(3);
    const p = players[1];
    const before = p.view.me;
    await p.refresh();
    const after = await p.waitFor((v) => v.phase === 'clues');
    expect(after.me.id).toBe(before.id);
    expect(after.me.secret).toEqual(before.secret);
    expect(roleOf(p)).toBeTruthy();
  });

  it('fait passer le tour d’un joueur déconnecté, compte son vote comme abstention, puis le laisse revenir', async () => {
    const { h, players } = await startedRound(4);
    const turn = h.view.round!.turn!;
    const absent = players.find((p) => p.id === turn.playerId && p !== h) ?? players.find((p) => p !== h)!;
    absent.socket.disconnect();
    await h.waitFor((v) => v.players.find((p) => p.id === absent.id)!.connected === false);
    // Les autres jouent ; le tour de l'absent passe après le délai de grâce.
    while (h.view.phase === 'clues') {
      const t = h.view.round!.turn!;
      const current = players.find((p) => p.id === t.playerId)!;
      if (current !== absent) await current.ok('game:clue', { turnId: t.turnId, text: 'ok' });
      await h.waitFor((v) => v.phase !== 'clues' || v.round!.turn!.turnId !== t.turnId);
    }
    const passed = h.view.round!.clues.find((c) => c.playerId === absent.id);
    expect(passed?.text).toBeNull();
    const ballotId = h.view.round!.ballot!.id;
    for (const p of players) if (p !== absent) await p.ok('game:vote', { ballotId, targetId: p === h ? players[1].id : h.id });
    const result = await h.waitFor((v) => v.phase === 'result');
    expect(result.round!.result!.votes.find((v) => v.voterId === absent.id)?.targetId).toBeNull();
    await absent.open();
    await absent.ok('session:resume', { code: h.code, token: absent.token });
    const back = await absent.waitFor(() => true);
    expect(back.me.id).toBe(absent.id);
    expect(back.me.secret).not.toBeNull();
  });

  it('transfère l’hôte après 60 s de déconnexion selon l’ordre d’arrivée, et immédiatement s’il quitte', async () => {
    const h = await host('Hôte');
    const a = await join(h.code, 'Alice');
    const b = await join(h.code, 'Bob');
    h.socket.disconnect();
    await new Promise((r) => setTimeout(r, 60_000 * SCALE * 0.5));
    expect(a.view.hostId).toBe(h.id);
    const transferred = await a.waitFor((v) => v.hostId === a.id, 3000);
    expect(transferred.players.find((p) => p.id === a.id)!.isHost).toBe(true);
    await a.ok('room:leave');
    await b.waitFor((v) => v.hostId === b.id, 2000);
  });

  it('fait attendre un joueur arrivé pendant la manche, sans aucune information secrète', async () => {
    const { h, players, room } = await startedRound(3);
    const late = await join(h.code, 'Retard');
    const v = late.view;
    expect(v.me.status).toBe('waiting');
    expect(v.me.secret).toBeNull();
    const all = late.received.join('\n');
    expect(all).not.toContain(room.round!.pair.civil);
    expect(all).not.toContain(room.round!.pair.undercover);
    expect((await late.emit('game:vote', { ballotId: 'x', targetId: h.id })).error?.code).toBe('WRONG_PHASE');
    await playClues(players);
    await h.waitFor((x) => x.phase === 'vote');
    expect((await late.emit('game:vote', { ballotId: h.view.round!.ballot!.id, targetId: h.id })).error?.code).toBe('NOT_ACTIVE');
  });

  it('met la manche en pause quand tout le monde est déconnecté, puis la reprend', async () => {
    const { h, players, room } = await startedRound(3);
    for (const p of players) p.socket.disconnect();
    await new Promise((r) => setTimeout(r, 150));
    expect(room.paused).toBe(true);
    const phase = room.phase;
    await new Promise((r) => setTimeout(r, 2500)); // bien au-delà des échéances accélérées
    expect(room.phase).toBe(phase);
    await h.open();
    await h.ok('session:resume', { code: h.code, token: h.token });
    const resumed = await h.waitFor((v) => !v.paused);
    expect(resumed.deadline).not.toBeNull();
  });
});
