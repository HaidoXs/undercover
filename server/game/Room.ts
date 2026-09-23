import { randomBytes, randomInt } from 'node:crypto';
import {
  AVATAR_COUNT,
  CLUE_MAX,
  CLUE_SECONDS_OPTIONS,
  GUESS_MAX,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NAME_MAX,
  NAME_MIN,
  VOTE_SECONDS_OPTIONS,
} from '../../shared/constants';
import { compositionError, compositionFor } from '../../shared/rules';
import type {
  ClueEntry,
  EliminationEntry,
  EndView,
  GameView,
  MrWhiteView,
  Phase,
  PlayerStatus,
  PublicPlayer,
  ResultView,
  Role,
  RoundView,
  Settings,
  VoteOutcome,
  WinnerSide,
} from '../../shared/types';
import { drawPair, isPackId, orderPackIds, PACKS, type DrawnPair } from '../packs';
import { cleanLine, clueRevealsWord, foldForCompare, guessMatches } from '../text';
import { GameError } from './errors';

export interface Timings {
  /** Durée maximale de la découverte des cartes. */
  revealMax: number;
  /** Affichage du résultat d'un scrutin. */
  result: number;
  /** Annonce d'une égalité avant le second scrutin. */
  tieNotice: number;
  mrWhiteGuess: number;
  mrWhiteResult: number;
  /** Au-delà, un joueur déconnecté est considéré absent : son tour passe, son vote devient abstention. */
  disconnectGrace: number;
  hostTransfer: number;
  roomExpiry: number;
  lobbyDisconnectRemoval: number;
  minResume: number;
}

export const DEFAULT_TIMINGS: Timings = {
  revealMax: 30_000,
  result: 7_000,
  tieNotice: 5_000,
  mrWhiteGuess: 45_000,
  mrWhiteResult: 5_000,
  disconnectGrace: 10_000,
  hostTransfer: 60_000,
  roomExpiry: 30 * 60_000,
  lobbyDisconnectRemoval: 10 * 60_000,
  minResume: 8_000,
};

export function scaleTimings(base: Timings, scale: number): Timings {
  const out = { ...base };
  for (const key of Object.keys(out) as (keyof Timings)[]) out[key] = Math.round(out[key] * scale);
  return out;
}

export function newId(bytes = 9): string {
  return randomBytes(bytes).toString('base64url');
}

export function shuffle<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function defaultSettings(): Settings {
  return {
    undercoverCount: 1,
    mrWhite: false,
    packIds: PACKS.map((p) => p.id),
    clueSeconds: 45,
    voteSeconds: 60,
  };
}

export interface Player {
  id: string;
  tokenHash: string;
  name: string;
  avatar: number;
  seq: number;
  ready: boolean;
  sockets: Set<string>;
  disconnectedAt: number | null;
  left: boolean;
}

interface Ballot {
  id: string;
  runoff: boolean;
  candidates: string[];
  voters: string[];
  votes: Map<string, string>;
}

interface Victory {
  side: WinnerSide;
  winners: string[];
}

interface Round {
  id: string;
  number: number;
  pair: DrawnPair;
  roles: Map<string, Role>;
  baseOrder: string[];
  alive: Set<string>;
  eliminations: EliminationEntry[];
  cycle: number;
  order: string[];
  turnIndex: number;
  turnId: string;
  clues: ClueEntry[];
  seen: Set<string>;
  ballot: Ballot | null;
  result: ResultView | null;
  next: 'runoff' | 'cycle' | 'mrwhite' | 'check' | null;
  runoffCandidates: string[];
  mrWhite: MrWhiteView | null;
  end: EndView | null;
  composition: { civils: number; undercovers: number; mrWhite: number };
}

const IN_ROUND: readonly Phase[] = ['reveal', 'clues', 'vote', 'result', 'mrwhite'];

export class Room {
  version = 0;
  players: Player[] = [];
  hostId = '';
  settings: Settings = defaultSettings();
  phase: Phase = 'lobby';
  deadline: number | null = null;
  deadlineTotal: number | null = null;
  paused = false;
  pausedRemaining: number | null = null;
  round: Round | null = null;
  readonly usedPairs = new Set<string>();
  emptySince: number | null = null;
  private roundCounter = 0;
  private seq = 0;
  private notices: string[] = [];

  constructor(
    readonly code: string,
    private readonly timings: Timings,
    private readonly timeScale: number,
    readonly createdAt: number,
  ) {}

  // ───────────────────────── utilitaires

  getPlayer(id: string): Player | undefined {
    return this.players.find((p) => p.id === id);
  }

  members(): Player[] {
    return this.players.filter((p) => !p.left);
  }

  connectedMembers(): Player[] {
    return this.players.filter((p) => !p.left && p.sockets.size > 0);
  }

  isInRound(): boolean {
    return IN_ROUND.includes(this.phase);
  }

  drainNotices(): string[] {
    const out = this.notices;
    this.notices = [];
    return out;
  }

  private notice(text: string): void {
    this.notices.push(text);
  }

  private touch(): void {
    this.version++;
  }

  private requireMember(id: string): Player {
    const p = this.getPlayer(id);
    if (!p || p.left) throw new GameError('NOT_IN_ROOM');
    return p;
  }

  private requireHost(id: string): Player {
    const p = this.requireMember(id);
    if (id !== this.hostId) throw new GameError('NOT_HOST');
    return p;
  }

  private requirePhase(...phases: Phase[]): Round {
    if (!phases.includes(this.phase)) throw new GameError('WRONG_PHASE');
    return this.round as Round;
  }

  private isAbsent(id: string, now: number): boolean {
    const p = this.getPlayer(id);
    if (!p || p.left) return true;
    if (p.sockets.size > 0) return false;
    return p.disconnectedAt !== null && now - p.disconnectedAt >= this.timings.disconnectGrace;
  }

  private setDeadline(now: number, ms: number): void {
    this.deadline = now + ms;
    this.deadlineTotal = ms;
  }

  private clueMs(): number {
    return Math.round(this.settings.clueSeconds * 1000 * this.timeScale);
  }

  private voteMs(): number {
    return Math.round(this.settings.voteSeconds * 1000 * this.timeScale);
  }

  private validName(raw: unknown, selfId: string | null): string {
    const name = cleanLine(raw, NAME_MAX);
    if (!name || [...name].length < NAME_MIN) throw new GameError('NAME_INVALID');
    const folded = foldForCompare(name);
    if (this.members().some((p) => p.id !== selfId && foldForCompare(p.name) === folded)) {
      throw new GameError('NAME_TAKEN');
    }
    return name;
  }

  private avatarTaken(avatar: number, selfId: string | null): boolean {
    return this.members().some((p) => p.id !== selfId && p.avatar === avatar);
  }

  private pickAvatar(requested: unknown): number {
    const valid = Number.isInteger(requested) && (requested as number) >= 0 && (requested as number) < AVATAR_COUNT;
    if (valid && !this.avatarTaken(requested as number, null)) return requested as number;
    for (let i = 0; i < AVATAR_COUNT; i++) if (!this.avatarTaken(i, null)) return i;
    return 0;
  }

  // ───────────────────────── membres & connexions

  addPlayer(input: { name: unknown; avatar: unknown; tokenHash: string }, now: number): Player {
    if (this.members().length >= MAX_PLAYERS) throw new GameError('ROOM_FULL');
    const name = this.validName(input.name, null);
    const player: Player = {
      id: newId(),
      tokenHash: input.tokenHash,
      name,
      avatar: this.pickAvatar(input.avatar),
      seq: this.seq++,
      ready: false,
      sockets: new Set(),
      disconnectedAt: now,
      left: false,
    };
    this.players.push(player);
    if (!this.hostId) this.hostId = player.id;
    else this.notice(this.isInRound() ? `${name} attend la prochaine manche.` : `${name} a rejoint le salon.`);
    this.touch();
    return player;
  }

  attachSocket(playerId: string, socketId: string): void {
    const p = this.requireMember(playerId);
    p.sockets.add(socketId);
    p.disconnectedAt = null;
    this.emptySince = null;
    this.touch();
  }

  detachSocket(playerId: string, socketId: string, now: number): void {
    const p = this.getPlayer(playerId);
    if (!p || !p.sockets.delete(socketId)) return;
    if (p.sockets.size === 0) p.disconnectedAt = now;
    if (this.connectedMembers().length === 0 && this.emptySince === null) this.emptySince = now;
    this.touch();
  }

  /** Départ volontaire. Pendant une manche, la place est conservée (tours passés, votes en abstention). */
  leave(playerId: string, now: number): Player {
    const p = this.requireMember(playerId);
    p.left = true;
    p.ready = false;
    p.sockets.clear();
    p.disconnectedAt = now;
    if (!this.round?.roles.has(p.id)) this.players = this.players.filter((x) => x.id !== p.id);
    this.notice(`${p.name} a quitté le salon.`);
    if (this.hostId === p.id) this.transferHost(true);
    if (this.connectedMembers().length === 0 && this.emptySince === null) this.emptySince = now;
    this.touch();
    return p;
  }

  /** Ordre stable : ancienneté dans le salon, en privilégiant les joueurs connectés. */
  private transferHost(force: boolean): boolean {
    const candidates = this.members()
      .filter((p) => p.id !== this.hostId)
      .sort((a, b) => a.seq - b.seq);
    const next = candidates.find((p) => p.sockets.size > 0) ?? (force ? candidates[0] : undefined);
    if (!next) return false;
    this.hostId = next.id;
    this.notice(`${next.name} est maintenant l’hôte du salon.`);
    this.touch();
    return true;
  }

  // ───────────────────────── salon d'attente

  setReady(playerId: string, ready: unknown): void {
    this.requirePhase('lobby');
    const p = this.requireMember(playerId);
    if (typeof ready !== 'boolean') throw new GameError('BAD_REQUEST');
    if (p.ready === ready) return;
    p.ready = ready;
    this.touch();
  }

  updateSettings(playerId: string, patch: Record<string, unknown>): void {
    this.requireHost(playerId);
    if (this.phase !== 'lobby') throw new GameError('SETTINGS_LOCKED');
    const next: Settings = { ...this.settings, packIds: [...this.settings.packIds] };

    if ('undercoverCount' in patch) {
      const v = patch.undercoverCount;
      if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > MAX_PLAYERS - 1) throw new GameError('BAD_REQUEST');
      next.undercoverCount = v as number;
    }
    if ('mrWhite' in patch) {
      if (typeof patch.mrWhite !== 'boolean') throw new GameError('BAD_REQUEST');
      next.mrWhite = patch.mrWhite;
    }
    if ('packIds' in patch) {
      const v = patch.packIds;
      if (!Array.isArray(v) || v.length > PACKS.length * 2 || !v.every(isPackId)) throw new GameError('BAD_REQUEST');
      next.packIds = orderPackIds(v);
    }
    if ('clueSeconds' in patch) {
      if (!(CLUE_SECONDS_OPTIONS as readonly unknown[]).includes(patch.clueSeconds)) throw new GameError('BAD_REQUEST');
      next.clueSeconds = patch.clueSeconds as number;
    }
    if ('voteSeconds' in patch) {
      if (!(VOTE_SECONDS_OPTIONS as readonly unknown[]).includes(patch.voteSeconds)) throw new GameError('BAD_REQUEST');
      next.voteSeconds = patch.voteSeconds as number;
    }

    if (JSON.stringify(next) === JSON.stringify(this.settings)) return;
    this.settings = next;
    // Toute modification de la configuration réinitialise les statuts « Prêt ».
    for (const p of this.players) p.ready = false;
    this.touch();
  }

  updateProfile(playerId: string, patch: { name?: unknown; avatar?: unknown }): void {
    this.requirePhase('lobby');
    const p = this.requireMember(playerId);
    const name = patch.name === undefined ? p.name : this.validName(patch.name, p.id);
    let avatar = p.avatar;
    if (patch.avatar !== undefined) {
      const v = patch.avatar;
      if (!Number.isInteger(v) || (v as number) < 0 || (v as number) >= AVATAR_COUNT) throw new GameError('BAD_REQUEST');
      if (this.avatarTaken(v as number, p.id)) throw new GameError('INVALID_TARGET', 'Cet avatar est déjà pris.');
      avatar = v as number;
    }
    if (name === p.name && avatar === p.avatar) return;
    p.name = name;
    p.avatar = avatar;
    this.touch();
  }

  // ───────────────────────── lancement

  start(playerId: string, now: number): void {
    this.requireHost(playerId);
    this.requirePhase('lobby');
    const present = this.connectedMembers();
    if (present.length < MIN_PLAYERS) {
      throw new GameError('CONFIG_INVALID', `Il faut au moins ${MIN_PLAYERS} joueurs présents pour lancer une manche.`);
    }
    if (this.settings.packIds.length === 0) throw new GameError('NO_PACK');
    const compoError = compositionError(this.settings, present.length);
    if (compoError) throw new GameError('CONFIG_INVALID', compoError);
    const notReady = present.filter((p) => p.id !== this.hostId && !p.ready);
    if (notReady.length > 0) {
      throw new GameError('NOT_READY', `En attente de : ${notReady.map((p) => p.name).join(', ')}.`);
    }

    const pair = drawPair(this.settings.packIds, this.usedPairs);
    const composition = compositionFor(this.settings, present.length);
    const ids = shuffle(present.map((p) => p.id));
    const roles = new Map<string, Role>();
    ids.forEach((id, i) => {
      const role: Role =
        i < composition.undercovers ? 'undercover' : i < composition.undercovers + composition.mrWhite ? 'mrwhite' : 'civil';
      roles.set(id, role);
    });

    // Ordre de passage défini par le serveur ; Mr. White ne commence jamais le premier tour.
    const baseOrder = shuffle(ids);
    if (roles.get(baseOrder[0]) === 'mrwhite') {
      const j = 1 + randomInt(baseOrder.length - 1);
      [baseOrder[0], baseOrder[j]] = [baseOrder[j], baseOrder[0]];
    }

    this.roundCounter++;
    this.round = {
      id: newId(),
      number: this.roundCounter,
      pair,
      roles,
      baseOrder,
      alive: new Set(ids),
      eliminations: [],
      cycle: 0,
      order: [],
      turnIndex: 0,
      turnId: '',
      clues: [],
      seen: new Set(),
      ballot: null,
      result: null,
      next: null,
      runoffCandidates: [],
      mrWhite: null,
      end: null,
      composition,
    };
    for (const p of this.players) p.ready = false;
    this.phase = 'reveal';
    this.setDeadline(now, this.timings.revealMax);
    this.touch();
  }

  // ───────────────────────── découverte des cartes

  markSeen(playerId: string, roundId: unknown, now: number): void {
    const r = this.requirePhase('reveal');
    this.requireMember(playerId);
    if (roundId !== r.id) throw new GameError('STALE_ACTION');
    if (!r.roles.has(playerId)) throw new GameError('NOT_ACTIVE');
    if (r.seen.has(playerId)) return;
    r.seen.add(playerId);
    this.touch();
    if (this.everyoneSeen(now)) this.enterClues(now, 1);
  }

  private everyoneSeen(now: number): boolean {
    const r = this.round as Round;
    return r.baseOrder.every((id) => r.seen.has(id) || this.isAbsent(id, now));
  }

  // ───────────────────────── indices

  private enterClues(now: number, cycle: number): void {
    const r = this.round as Round;
    const alive = r.baseOrder.filter((id) => r.alive.has(id));
    const offset = (cycle - 1) % alive.length;
    r.cycle = cycle;
    r.order = [...alive.slice(offset), ...alive.slice(0, offset)];
    r.turnIndex = 0;
    r.turnId = newId();
    r.ballot = null;
    r.result = null;
    r.mrWhite = null;
    this.phase = 'clues';
    this.setDeadline(now, this.clueMs());
    this.touch();
  }

  submitClue(playerId: string, turnId: unknown, raw: unknown, now: number): void {
    const r = this.requirePhase('clues');
    this.requireMember(playerId);
    if (!r.alive.has(playerId)) throw new GameError('NOT_ACTIVE');
    if (turnId !== r.turnId) throw new GameError('STALE_ACTION');
    if (r.order[r.turnIndex] !== playerId) throw new GameError('NOT_YOUR_TURN');
    const text = cleanLine(raw, CLUE_MAX);
    if (!text) throw new GameError('TEXT_INVALID', `Ton indice doit faire entre 1 et ${CLUE_MAX} caractères.`);
    const role = r.roles.get(playerId);
    if (role !== 'mrwhite') {
      const word = role === 'civil' ? r.pair.civil : r.pair.undercover;
      if (clueRevealsWord(text, word)) throw new GameError('CLUE_IS_WORD');
    }
    r.clues.push({ cycle: r.cycle, playerId, text });
    this.advanceTurn(now);
  }

  private passTurn(now: number): void {
    const r = this.round as Round;
    r.clues.push({ cycle: r.cycle, playerId: r.order[r.turnIndex], text: null });
    this.advanceTurn(now);
  }

  private advanceTurn(now: number): void {
    const r = this.round as Round;
    r.turnIndex++;
    if (r.turnIndex >= r.order.length) {
      this.enterVote(now, false, r.baseOrder.filter((id) => r.alive.has(id)));
      return;
    }
    r.turnId = newId();
    this.setDeadline(now, this.clueMs());
    this.touch();
  }

  // ───────────────────────── vote

  private enterVote(now: number, runoff: boolean, candidates: string[]): void {
    const r = this.round as Round;
    r.ballot = {
      id: newId(),
      runoff,
      candidates: [...candidates],
      voters: r.baseOrder.filter((id) => r.alive.has(id)),
      votes: new Map(),
    };
    r.result = null;
    this.phase = 'vote';
    this.setDeadline(now, this.voteMs());
    this.touch();
  }

  castVote(playerId: string, ballotId: unknown, targetId: unknown, now: number): void {
    const r = this.requirePhase('vote');
    this.requireMember(playerId);
    const ballot = r.ballot as Ballot;
    if (ballotId !== ballot.id) throw new GameError('STALE_ACTION');
    if (!ballot.voters.includes(playerId)) throw new GameError('NOT_ACTIVE');
    if (ballot.votes.has(playerId)) throw new GameError('ALREADY_DONE', 'Ton vote est déjà enregistré : il est définitif.');
    if (targetId === playerId) throw new GameError('SELF_VOTE');
    if (typeof targetId !== 'string' || !ballot.candidates.includes(targetId)) throw new GameError('INVALID_TARGET');
    ballot.votes.set(playerId, targetId);
    this.touch();
    if (this.ballotComplete(now)) this.closeBallot(now);
  }

  private ballotComplete(now: number): boolean {
    const ballot = (this.round as Round).ballot as Ballot;
    return ballot.voters.every((id) => ballot.votes.has(id) || this.isAbsent(id, now));
  }

  private closeBallot(now: number): void {
    const r = this.round as Round;
    const ballot = r.ballot as Ballot;
    const counts = new Map<string, number>(ballot.candidates.map((id) => [id, 0]));
    for (const target of ballot.votes.values()) counts.set(target, (counts.get(target) ?? 0) + 1);
    const tally = ballot.candidates
      .map((playerId) => ({ playerId, votes: counts.get(playerId) ?? 0 }))
      .sort((a, b) => b.votes - a.votes);
    const total = tally.reduce((sum, t) => sum + t.votes, 0);
    const votes = ballot.voters.map((voterId) => ({ voterId, targetId: ballot.votes.get(voterId) ?? null }));

    let outcome: VoteOutcome;
    if (total === 0) {
      outcome = { type: 'no-votes' };
      r.next = 'cycle';
    } else {
      const top = tally[0].votes;
      const leaders = tally.filter((t) => t.votes === top).map((t) => t.playerId);
      if (leaders.length === 1) {
        const eliminated = leaders[0];
        const role = r.roles.get(eliminated) as Role;
        r.alive.delete(eliminated);
        r.eliminations.push({ playerId: eliminated, role, cycle: r.cycle });
        outcome = { type: 'eliminated', playerId: eliminated, role };
        r.next = role === 'mrwhite' ? 'mrwhite' : 'check';
      } else if (!ballot.runoff) {
        outcome = { type: 'tie', tied: leaders };
        r.runoffCandidates = leaders;
        r.next = 'runoff';
      } else {
        outcome = { type: 'tie-persist', tied: leaders };
        r.next = 'cycle';
      }
    }

    r.result = { ballotId: ballot.id, runoff: ballot.runoff, outcome, tally, votes };
    r.ballot = null;
    this.phase = 'result';
    this.setDeadline(now, (outcome.type === 'tie' ? this.timings.tieNotice : this.timings.result));
    this.touch();
  }

  private afterResult(now: number): void {
    const r = this.round as Round;
    const outcome = r.result?.outcome;
    switch (r.next) {
      case 'runoff':
        this.enterVote(now, true, r.runoffCandidates);
        return;
      case 'mrwhite':
        if (outcome?.type === 'eliminated') {
          this.enterMrWhite(now, outcome.playerId);
          return;
        }
        break;
      case 'check': {
        const victory = this.checkVictory();
        if (victory) {
          this.endRound(victory);
          return;
        }
        break;
      }
      default:
        break;
    }
    this.enterClues(now, r.cycle + 1);
  }

  // ───────────────────────── Mr. White

  private enterMrWhite(now: number, playerId: string): void {
    const r = this.round as Round;
    r.mrWhite = { attemptId: newId(), playerId, resolved: false, guess: null, correct: null };
    this.phase = 'mrwhite';
    this.setDeadline(now, this.timings.mrWhiteGuess);
    this.touch();
  }

  submitGuess(playerId: string, attemptId: unknown, raw: unknown, now: number): void {
    const r = this.requirePhase('mrwhite');
    this.requireMember(playerId);
    const attempt = r.mrWhite as MrWhiteView;
    if (attemptId !== attempt.attemptId) throw new GameError('STALE_ACTION');
    if (playerId !== attempt.playerId) throw new GameError('NOT_ACTIVE');
    if (attempt.resolved) throw new GameError('ALREADY_DONE');
    const guess = cleanLine(raw, GUESS_MAX);
    if (!guess) throw new GameError('TEXT_INVALID', `Ta proposition doit faire entre 1 et ${GUESS_MAX} caractères.`);
    this.resolveMrWhite(now, guess, guessMatches(guess, r.pair.civil));
  }

  private resolveMrWhite(now: number, guess: string | null, correct: boolean): void {
    const r = this.round as Round;
    const attempt = r.mrWhite as MrWhiteView;
    attempt.resolved = true;
    attempt.guess = guess;
    attempt.correct = correct;
    if (correct) {
      // Mr. White gagne immédiatement.
      this.endRound({ side: 'mrwhite', winners: [attempt.playerId] });
      return;
    }
    this.setDeadline(now, this.timings.mrWhiteResult);
    this.touch();
  }

  private afterMrWhite(now: number): void {
    const victory = this.checkVictory();
    if (victory) this.endRound(victory);
    else this.enterClues(now, (this.round as Round).cycle + 1);
  }

  // ───────────────────────── victoire

  private checkVictory(): Victory | null {
    const r = this.round as Round;
    const aliveIds = [...r.alive];
    const civils = aliveIds.filter((id) => r.roles.get(id) === 'civil').length;
    const intruders = aliveIds.filter((id) => r.roles.get(id) !== 'civil');
    if (intruders.length === 0) {
      return { side: 'civils', winners: r.baseOrder.filter((id) => r.roles.get(id) === 'civil') };
    }
    if (intruders.length >= civils) {
      return { side: 'intrus', winners: r.baseOrder.filter((id) => intruders.includes(id)) };
    }
    return null;
  }

  private endRound(victory: Victory): void {
    const r = this.round as Round;
    r.end = {
      winnerSide: victory.side,
      winners: victory.winners,
      civilWord: r.pair.civil,
      undercoverWord: r.pair.undercover,
      packName: r.pair.packName,
      roles: r.baseOrder.map((playerId) => ({ playerId, role: r.roles.get(playerId) as Role })),
      mrWhiteGuess: r.mrWhite?.guess ?? null,
    };
    this.phase = 'ended';
    this.deadline = null;
    for (const p of this.players) p.ready = false;
    this.touch();
  }

  replay(playerId: string): void {
    this.requireHost(playerId);
    this.requirePhase('ended');
    this.round = null;
    this.phase = 'lobby';
    this.deadline = null;
    this.players = this.players.filter((p) => !p.left);
    for (const p of this.players) p.ready = false;
    this.touch();
  }

  // ───────────────────────── horloge serveur

  /** Fait avancer la partie selon les échéances. Retourne true si l'état a changé. */
  tick(now: number): boolean {
    const before = this.version;
    if (this.connectedMembers().length === 0) {
      if (this.emptySince === null) this.emptySince = now;
      if (this.isInRound() && !this.paused) this.pause(now);
      return this.version !== before;
    }
    this.emptySince = null;
    if (this.paused) this.resume(now);
    this.checkHost(now);
    this.pruneLobby(now);
    for (let i = 0; i < 16 && this.step(now); i++);
    return this.version !== before;
  }

  private pause(now: number): void {
    this.paused = true;
    this.pausedRemaining = this.deadline === null ? null : Math.max(0, this.deadline - now);
    this.deadline = null;
    this.touch();
  }

  private resume(now: number): void {
    this.paused = false;
    if (this.pausedRemaining !== null) this.setDeadline(now, Math.max(this.pausedRemaining, this.timings.minResume));
    this.pausedRemaining = null;
    this.notice('La partie reprend !');
    this.touch();
  }

  private checkHost(now: number): void {
    const host = this.getPlayer(this.hostId);
    if (!host || host.left) {
      this.transferHost(true);
      return;
    }
    if (host.sockets.size === 0 && host.disconnectedAt !== null && now - host.disconnectedAt >= this.timings.hostTransfer) {
      this.transferHost(false);
    }
  }

  private pruneLobby(now: number): void {
    if (this.phase !== 'lobby') return;
    const stale = this.players.filter(
      (p) =>
        p.id !== this.hostId &&
        p.sockets.size === 0 &&
        p.disconnectedAt !== null &&
        now - p.disconnectedAt >= this.timings.lobbyDisconnectRemoval,
    );
    if (stale.length === 0) return;
    this.players = this.players.filter((p) => !stale.includes(p));
    this.touch();
  }

  private step(now: number): boolean {
    if (this.paused || !this.round) return false;
    const r = this.round;
    const due = this.deadline !== null && now >= this.deadline;
    switch (this.phase) {
      case 'reveal':
        if (due || this.everyoneSeen(now)) {
          this.enterClues(now, 1);
          return true;
        }
        return false;
      case 'clues':
        if (due || this.isAbsent(r.order[r.turnIndex], now)) {
          this.passTurn(now);
          return true;
        }
        return false;
      case 'vote':
        if (due || this.ballotComplete(now)) {
          this.closeBallot(now);
          return true;
        }
        return false;
      case 'result':
        if (due) {
          this.afterResult(now);
          return true;
        }
        return false;
      case 'mrwhite': {
        const attempt = r.mrWhite as MrWhiteView;
        if (!attempt.resolved && (due || this.isAbsent(attempt.playerId, now))) {
          this.resolveMrWhite(now, null, false);
          return true;
        }
        if (attempt.resolved && due) {
          this.afterMrWhite(now);
          return true;
        }
        return false;
      }
      default:
        return false;
    }
  }

  // ───────────────────────── vues par joueur (confidentialité)

  private statusOf(id: string): PlayerStatus {
    const r = this.round;
    if (!r || this.phase === 'lobby') return 'lobby';
    if (r.roles.has(id)) return r.alive.has(id) ? 'alive' : 'eliminated';
    return 'waiting';
  }

  /** Rôle visible par tous : seulement après élimination, ou à la fin de la manche. */
  private publicRole(id: string): Role | undefined {
    const r = this.round;
    if (!r || !r.roles.has(id)) return undefined;
    if (this.phase === 'ended' || !r.alive.has(id)) return r.roles.get(id);
    return undefined;
  }

  /**
   * Construit l'état envoyé à un joueur précis. Chaque champ est choisi explicitement :
   * aucun mot, rôle ou vote d'autrui n'y figure avant sa révélation autorisée.
   */
  viewFor(viewerId: string, now: number): GameView {
    const r = this.round;
    const players: PublicPlayer[] = this.players
      .filter((p) => !p.left || (r?.roles.has(p.id) ?? false))
      .map((p) => {
        const view: PublicPlayer = {
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          isHost: p.id === this.hostId,
          connected: p.sockets.size > 0,
          ready: p.ready,
          left: p.left,
          status: this.statusOf(p.id),
        };
        const role = this.publicRole(p.id);
        if (role) view.role = role;
        return view;
      });

    let secret: GameView['me']['secret'] = null;
    if (r && r.roles.has(viewerId)) {
      const role = r.roles.get(viewerId);
      secret =
        role === 'mrwhite'
          ? { kind: 'mrwhite', theme: r.pair.theme }
          : role === 'civil'
            ? { kind: 'word', word: r.pair.civil, description: r.pair.civilDescription }
            : { kind: 'word', word: r.pair.undercover, description: r.pair.undercoverDescription };
    }

    let round: RoundView | null = null;
    if (r && this.phase !== 'lobby') {
      const ballot = r.ballot;
      round = {
        id: r.id,
        number: r.number,
        cycle: r.cycle,
        order: [...r.order],
        turn: this.phase === 'clues' ? { playerId: r.order[r.turnIndex], turnId: r.turnId } : null,
        clues: r.clues.map((c) => ({ ...c })),
        seen: this.phase === 'reveal' ? [...r.seen] : [],
        ballot:
          this.phase === 'vote' && ballot
            ? {
                id: ballot.id,
                runoff: ballot.runoff,
                candidates: [...ballot.candidates],
                voters: [...ballot.voters],
                voted: ballot.voters.filter((id) => ballot.votes.has(id)),
                myVote: ballot.votes.get(viewerId) ?? null,
              }
            : null,
        result: this.phase === 'result' && r.result ? structuredClone(r.result) : null,
        mrWhite:
          r.mrWhite && (this.phase === 'mrwhite' || this.phase === 'ended')
            ? {
                attemptId: r.mrWhite.attemptId,
                playerId: r.mrWhite.playerId,
                resolved: r.mrWhite.resolved,
                guess: r.mrWhite.resolved ? r.mrWhite.guess : null,
                correct: r.mrWhite.resolved ? r.mrWhite.correct : null,
              }
            : null,
        end: this.phase === 'ended' && r.end ? structuredClone(r.end) : null,
        eliminations: r.eliminations.map((e) => ({ ...e })),
        composition: { ...r.composition },
      };
    }

    return {
      v: this.version,
      serverNow: now,
      code: this.code,
      phase: this.phase,
      deadline: this.deadline,
      deadlineTotal: this.deadlineTotal,
      paused: this.paused,
      pausedRemaining: this.pausedRemaining,
      hostId: this.hostId,
      settings: { ...this.settings, packIds: [...this.settings.packIds] },
      players,
      me: {
        id: viewerId,
        status: this.statusOf(viewerId),
        secret,
        hasSeen: r?.seen.has(viewerId) ?? false,
      },
      round,
    };
  }
}
