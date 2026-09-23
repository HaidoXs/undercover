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
import {
  isSpecialRoleId,
  orderSpecialRoles,
  POWER_SECONDS,
  specialRole,
  specialRolesError,
  type SpecialRoleId,
} from '../../shared/specialRoles';
import type {
  ClueEntry,
  EliminationCause,
  EliminationEntry,
  EndView,
  GameView,
  MrWhiteView,
  MySpecial,
  Phase,
  PlayerStatus,
  PublicPlayer,
  ResolutionEvent,
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
  /** Décision de la Déesse de la Justice ou de la Vengeuse. */
  power: number;
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
  power: POWER_SECONDS * 1000,
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
    specialRoles: [],
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
  /** Votants privés de vote par un falafel piégé. */
  blocked: Set<string>;
}

interface Victory {
  side: WinnerSide;
  winners: string[];
  reason: string;
}

type ResultBase = Omit<ResultView, 'outcome' | 'events'>;

/** Résolution d'un scrutin : éliminations en chaîne, pouvoirs, tentatives de Mr. White. */
interface Resolution {
  base: ResultBase;
  primary: string | null;
  queue: { playerId: string; cause: EliminationCause }[];
  events: ResolutionEvent[];
  dead: string[];
  mrWhite: string[];
}

interface PendingPower {
  id: string;
  kind: 'justice' | 'avenger';
  actorId: string;
  candidates: string[];
}

interface Falafel {
  vendorId: string;
  targetId: string | null;
  effect: 'protect' | 'sabotage';
  used: boolean;
  /** Tour de vote bloqué par le sabotage (fixé au premier vote après le don). */
  sabotageCycle: number | null;
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
  next: 'runoff' | 'cycle' | 'resolved' | null;
  runoffCandidates: string[];
  mrWhite: MrWhiteView | null;
  end: EndView | null;
  composition: { civils: number; undercovers: number; mrWhite: number };
  // Rôles spéciaux
  special: Map<string, SpecialRoleId>;
  memeEnabled: boolean;
  memeId: string | null;
  memeUsed: Set<string>;
  lovers: [string, string] | null;
  duel: { a: string; b: string; winnerId: string | null; draw: boolean; done: boolean } | null;
  falafel: Falafel | null;
  boomerangUsed: boolean;
  avengerUsed: boolean;
  resolution: Resolution | null;
  power: PendingPower | null;
}

const IN_ROUND: readonly Phase[] = ['reveal', 'clues', 'vote', 'power', 'result', 'mrwhite'];

const REASONS: Record<WinnerSide, string> = {
  civils: 'Tous les intrus ont été démasqués.',
  intrus: 'Les intrus encore en jeu sont aussi nombreux que les Civils restants.',
  mrwhite: 'Mr. White a deviné le mot des Civils.',
  lovers: 'Les Amoureux sont les deux derniers joueurs en vie.',
  joyfool: 'Le Fou de joie a été éliminé par le vote dès le premier tour.',
  draw: 'Personne n’a survécu : la manche est nulle.',
};

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

  /** Joueur portant ce rôle spécial dans la manche en cours (vivant ou non). */
  private holderOf(role: SpecialRoleId): string | null {
    const r = this.round;
    if (!r) return null;
    for (const [id, s] of r.special) if (s === role) return id;
    return null;
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
    const next: Settings = { ...this.settings, packIds: [...this.settings.packIds], specialRoles: [...this.settings.specialRoles] };

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
    if ('specialRoles' in patch) {
      const v = patch.specialRoles;
      if (!Array.isArray(v) || v.length > 20 || !v.every(isSpecialRoleId)) throw new GameError('BAD_REQUEST');
      next.specialRoles = orderSpecialRoles(v);
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
    const compoError = compositionError(this.settings, present.length) ?? specialRolesError(this.settings.specialRoles, present.length);
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

    // Rôles spéciaux : tirés indépendamment des camps, un seul par joueur.
    // Mr. Meme n'est attribué à personne ici : un joueur sans autre rôle est désigné à chaque tour.
    const special = new Map<string, SpecialRoleId>();
    const pool = shuffle(ids);
    let lovers: [string, string] | null = null;
    let duel: Round['duel'] = null;
    let falafel: Falafel | null = null;
    for (const id of this.settings.specialRoles) {
      if (id === 'meme') continue;
      const holders = pool.splice(0, specialRole(id).slots);
      for (const h of holders) special.set(h, id);
      if (id === 'lovers') lovers = [holders[0], holders[1]];
      if (id === 'duelists') duel = { a: holders[0], b: holders[1], winnerId: null, draw: false, done: false };
      if (id === 'falafel') {
        falafel = { vendorId: holders[0], targetId: null, effect: randomInt(2) === 0 ? 'protect' : 'sabotage', used: false, sabotageCycle: null };
      }
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
      special,
      memeEnabled: this.settings.specialRoles.includes('meme'),
      memeId: null,
      memeUsed: new Set(),
      lovers,
      duel,
      falafel,
      boomerangUsed: false,
      avengerUsed: false,
      resolution: null,
      power: null,
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
    if (r.falafel?.vendorId === playerId && r.falafel.targetId === null) {
      throw new GameError('BAD_REQUEST', 'Offre d’abord ton falafel à un joueur.');
    }
    if (r.seen.has(playerId)) return;
    r.seen.add(playerId);
    this.touch();
    if (this.everyoneSeen(now)) this.enterClues(now, 1);
  }

  /** Le Vendeur de Falafels choisit son bénéficiaire pendant la découverte des cartes. */
  giveFalafel(playerId: string, roundId: unknown, targetId: unknown): void {
    const r = this.requirePhase('reveal');
    this.requireMember(playerId);
    if (roundId !== r.id) throw new GameError('STALE_ACTION');
    const f = r.falafel;
    if (!f || f.vendorId !== playerId) throw new GameError('NOT_ACTIVE');
    if (f.targetId !== null) throw new GameError('ALREADY_DONE', 'Ton falafel est déjà offert.');
    if (typeof targetId !== 'string' || targetId === playerId || !r.roles.has(targetId)) throw new GameError('INVALID_TARGET');
    f.targetId = targetId;
    this.touch();
  }

  private everyoneSeen(now: number): boolean {
    const r = this.round as Round;
    return r.baseOrder.every((id) => r.seen.has(id) || this.isAbsent(id, now));
  }

  // ───────────────────────── indices

  private enterClues(now: number, cycle: number): void {
    const r = this.round as Round;
    // Falafel non offert à la fin de la découverte : le serveur choisit un bénéficiaire au hasard.
    if (r.falafel && r.falafel.targetId === null) {
      const others = r.baseOrder.filter((id) => id !== r.falafel?.vendorId);
      r.falafel.targetId = others[randomInt(others.length)];
    }
    const alive = r.baseOrder.filter((id) => r.alive.has(id));
    const offset = (cycle - 1) % alive.length;
    r.cycle = cycle;
    r.order = [...alive.slice(offset), ...alive.slice(0, offset)];
    r.turnIndex = 0;
    r.turnId = newId();
    r.ballot = null;
    r.result = null;
    r.mrWhite = null;
    r.resolution = null;
    r.power = null;
    // Mr. Meme : un joueur sans autre rôle spécial, jamais deux fois le même.
    r.memeId = null;
    if (r.memeEnabled) {
      const eligible = r.order.filter((id) => !r.special.has(id) && !r.memeUsed.has(id));
      if (eligible.length > 0) {
        r.memeId = eligible[randomInt(eligible.length)];
        r.memeUsed.add(r.memeId);
      }
    }
    this.phase = 'clues';
    this.setDeadline(now, this.clueMs());
    this.touch();
  }

  private requireCurrentTurn(playerId: string, turnId: unknown): Round {
    const r = this.requirePhase('clues');
    this.requireMember(playerId);
    if (!r.alive.has(playerId)) throw new GameError('NOT_ACTIVE');
    if (turnId !== r.turnId) throw new GameError('STALE_ACTION');
    if (r.order[r.turnIndex] !== playerId) throw new GameError('NOT_YOUR_TURN');
    return r;
  }

  submitClue(playerId: string, turnId: unknown, raw: unknown, now: number): void {
    const r = this.requireCurrentTurn(playerId, turnId);
    if (r.memeId === playerId) {
      throw new GameError('BAD_REQUEST', 'Tu es Mr. Meme ce tour-ci : mime ton indice, puis appuie sur « Mime terminé ».');
    }
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

  /** Mr. Meme : le joueur désigné signale qu'il a fini de mimer son indice. */
  finishMime(playerId: string, turnId: unknown, now: number): void {
    const r = this.requireCurrentTurn(playerId, turnId);
    if (r.memeId !== playerId) throw new GameError('NOT_ACTIVE');
    r.clues.push({ cycle: r.cycle, playerId, text: null, mimed: true });
    this.advanceTurn(now);
  }

  private passTurn(now: number): void {
    const r = this.round as Round;
    const playerId = r.order[r.turnIndex];
    // Le mime se joue en silence devant les autres : encore présent à la fin du temps, il a mimé.
    if (r.memeId === playerId && !this.isAbsent(playerId, now)) {
      r.clues.push({ cycle: r.cycle, playerId, text: null, mimed: true });
    } else {
      r.clues.push({ cycle: r.cycle, playerId, text: null });
    }
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

  private ghostId(): string | null {
    const r = this.round as Round;
    const id = this.holderOf('ghost');
    return id && !r.alive.has(id) ? id : null;
  }

  private enterVote(now: number, runoff: boolean, candidates: string[]): void {
    const r = this.round as Round;
    const voters = r.baseOrder.filter((id) => r.alive.has(id));
    // Le Fantôme éliminé vote encore, sans jamais redevenir une cible.
    const ghost = this.ghostId();
    if (ghost && !this.getPlayer(ghost)?.left) voters.push(ghost);
    const blocked = new Set<string>();
    const f = r.falafel;
    if (f && f.effect === 'sabotage' && !f.used && f.targetId && (f.sabotageCycle === null || f.sabotageCycle === r.cycle)) {
      f.sabotageCycle = r.cycle;
      if (voters.includes(f.targetId)) blocked.add(f.targetId);
    }
    r.ballot = { id: newId(), runoff, candidates: [...candidates], voters, votes: new Map(), blocked };
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
    if (ballot.blocked.has(playerId)) {
      throw new GameError('NOT_ACTIVE', 'Ton falafel était piégé : tu ne peux pas voter à ce tour de vote.');
    }
    if (ballot.votes.has(playerId)) throw new GameError('ALREADY_DONE', 'Ton vote est déjà enregistré : il est définitif.');
    if (targetId === playerId) throw new GameError('SELF_VOTE');
    if (typeof targetId !== 'string' || !ballot.candidates.includes(targetId)) throw new GameError('INVALID_TARGET');
    ballot.votes.set(playerId, targetId);
    this.touch();
    if (this.ballotComplete(now)) this.closeBallot(now);
  }

  private ballotComplete(now: number): boolean {
    const ballot = (this.round as Round).ballot as Ballot;
    return ballot.voters.every((id) => ballot.votes.has(id) || ballot.blocked.has(id) || this.isAbsent(id, now));
  }

  /** Premier du scrutin : aucun vote, un désigné, ou des ex æquo. */
  private evaluate(counts: Map<string, number>): { kind: 'none' } | { kind: 'single'; id: string } | { kind: 'tie'; ids: string[] } {
    const entries = [...counts].filter(([, n]) => n > 0);
    if (entries.length === 0) return { kind: 'none' };
    const top = Math.max(...entries.map(([, n]) => n));
    const leaders = entries.filter(([, n]) => n === top).map(([id]) => id);
    return leaders.length === 1 ? { kind: 'single', id: leaders[0] } : { kind: 'tie', ids: leaders };
  }

  private toTally(counts: Map<string, number>): ResultBase['tally'] {
    return [...counts].map(([playerId, votes]) => ({ playerId, votes })).sort((a, b) => b.votes - a.votes);
  }

  private closeBallot(now: number): void {
    const r = this.round as Round;
    const ballot = r.ballot as Ballot;
    let counts = new Map<string, number>(ballot.candidates.map((id) => [id, 0]));
    for (const target of ballot.votes.values()) counts.set(target, (counts.get(target) ?? 0) + 1);
    const events: ResolutionEvent[] = [];
    let pick = this.evaluate(counts);

    // Boomerang : une seule fois, les votes contre lui se retournent contre leurs auteurs. Recalcul unique.
    if (pick.kind === 'single' && r.special.get(pick.id) === 'boomerang' && !r.boomerangUsed) {
      const boomerang = pick.id;
      r.boomerangUsed = true;
      events.push({ type: 'boomerang', playerId: boomerang });
      const reflected = new Map<string, number>(ballot.candidates.map((id) => [id, 0]));
      for (const [voter, target] of ballot.votes) {
        const dest = target === boomerang ? voter : target;
        if (r.alive.has(dest)) reflected.set(dest, (reflected.get(dest) ?? 0) + 1);
      }
      counts = reflected;
      pick = this.evaluate(counts);
    }

    const base: ResultBase = {
      ballotId: ballot.id,
      runoff: ballot.runoff,
      tally: this.toTally(counts),
      votes: ballot.voters.map((voterId) => ({ voterId, targetId: ballot.votes.get(voterId) ?? null })),
    };
    r.ballot = null;

    if (pick.kind === 'none') {
      this.finishVoting();
      this.showResult(now, base, { type: 'no-votes' }, events, 'cycle');
      return;
    }
    if (pick.kind === 'tie') {
      // La Déesse de la Justice remplace le départage habituel, même éliminée.
      const justice = this.holderOf('justice');
      if (!ballot.runoff && justice && !this.isAbsent(justice, now)) {
        r.resolution = { base, primary: null, queue: [], events, dead: [], mrWhite: [] };
        r.runoffCandidates = pick.ids;
        this.enterPower(now, 'justice', justice, pick.ids);
        return;
      }
      if (!ballot.runoff) {
        r.runoffCandidates = pick.ids;
        this.showResult(now, base, { type: 'tie', tied: pick.ids }, events, 'runoff');
        return;
      }
      this.finishVoting();
      this.showResult(now, base, { type: 'tie-persist', tied: pick.ids }, events, 'cycle');
      return;
    }
    this.finishVoting();
    this.designate(now, pick.id, 'vote', base, events);
  }

  /** Fin d'un tour de vote (second scrutin compris) : le sabotage d'un falafel est consommé. */
  private finishVoting(): void {
    const r = this.round as Round;
    const f = r.falafel;
    if (f && f.effect === 'sabotage' && !f.used && f.sabotageCycle === r.cycle) f.used = true;
  }

  /** Joueur désigné par le scrutin (vote ou décision de la Justice). */
  private designate(now: number, id: string, cause: 'vote' | 'justice', base: ResultBase, events: ResolutionEvent[]): void {
    const r = this.round as Round;
    const f = r.falafel;
    if (f && f.effect === 'protect' && !f.used && f.targetId === id) {
      f.used = true;
      events.push({ type: 'protected', playerId: id });
      this.showResult(now, base, { type: 'protected', playerId: id }, events, 'cycle');
      return;
    }
    const res: Resolution = { base, primary: id, queue: [], events, dead: [], mrWhite: [] };
    r.resolution = res;
    // Fou de joie éliminé directement au premier tour : il gagne seul, tout s'arrête.
    if (r.special.get(id) === 'joyfool' && r.cycle === 1) {
      this.eliminate(id, cause, res);
      this.endRound({ side: 'joyfool', winners: [id], reason: REASONS.joyfool });
      return;
    }
    res.queue.push({ playerId: id, cause });
    this.processResolution(now);
  }

  private eliminate(id: string, cause: EliminationCause, res: Resolution): void {
    const r = this.round as Round;
    const role = r.roles.get(id) as Role;
    r.alive.delete(id);
    r.eliminations.push({ playerId: id, role, cycle: r.cycle, cause });
    const special = r.special.get(id);
    res.events.push(special ? { type: 'eliminated', playerId: id, role, special, cause } : { type: 'eliminated', playerId: id, role, cause });
    res.dead.push(id);
    if (role === 'mrwhite') res.mrWhite.push(id);
  }

  /** Éliminations en chaîne (Amoureux, Vengeuse), chaque pouvoir au plus une fois. */
  private processResolution(now: number): void {
    const r = this.round as Round;
    const res = r.resolution as Resolution;
    while (res.queue.length > 0) {
      const { playerId, cause } = res.queue.shift() as Resolution['queue'][number];
      if (!r.alive.has(playerId)) continue;
      this.eliminate(playerId, cause, res);
      if (r.lovers?.includes(playerId)) {
        const partner = r.lovers[0] === playerId ? r.lovers[1] : r.lovers[0];
        if (r.alive.has(partner)) res.queue.push({ playerId: partner, cause: 'lovers' });
      }
      if (r.special.get(playerId) === 'avenger' && !r.avengerUsed) {
        r.avengerUsed = true;
        const targets = r.baseOrder.filter((id) => r.alive.has(id));
        if (targets.length > 0) {
          this.enterPower(now, 'avenger', playerId, targets);
          return;
        }
      }
    }
    this.finishResolution(now);
  }

  private finishResolution(now: number): void {
    const r = this.round as Round;
    const res = r.resolution as Resolution;
    const d = r.duel;
    if (d && !d.done) {
      const deadA = res.dead.includes(d.a);
      const deadB = res.dead.includes(d.b);
      if (deadA && deadB) {
        d.done = true;
        d.draw = true;
        res.events.push({ type: 'duel-draw', playerIds: [d.a, d.b] });
      } else if (deadA || deadB) {
        d.done = true;
        d.winnerId = deadA ? d.b : d.a;
        res.events.push({ type: 'duel', winnerId: d.winnerId, loserId: deadA ? d.a : d.b });
      }
    }
    const primary = res.primary;
    const outcome: VoteOutcome = primary
      ? { type: 'eliminated', playerId: primary, role: r.roles.get(primary) as Role }
      : { type: 'no-votes' };
    this.showResult(now, res.base, outcome, res.events, 'resolved');
  }

  private showResult(
    now: number,
    base: ResultBase,
    outcome: VoteOutcome,
    events: ResolutionEvent[],
    next: 'runoff' | 'cycle' | 'resolved',
  ): void {
    const r = this.round as Round;
    r.result = { ...base, outcome, events: [...events] };
    r.next = next;
    r.power = null;
    this.phase = 'result';
    const extra = Math.min(Math.max(events.length - 1, 0), 4) * Math.round(1500 * this.timeScale);
    this.setDeadline(now, (outcome.type === 'tie' ? this.timings.tieNotice : this.timings.result) + extra);
    this.touch();
  }

  // ───────────────────────── pouvoirs : Justice et Vengeuse

  private enterPower(now: number, kind: PendingPower['kind'], actorId: string, candidates: string[]): void {
    const r = this.round as Round;
    r.power = { id: newId(), kind, actorId, candidates: [...candidates] };
    this.phase = 'power';
    this.setDeadline(now, this.timings.power);
    this.touch();
  }

  usePower(playerId: string, powerId: unknown, targetId: unknown, now: number): void {
    const r = this.requirePhase('power');
    this.requireMember(playerId);
    const power = r.power as PendingPower;
    if (powerId !== power.id) throw new GameError('STALE_ACTION');
    if (playerId !== power.actorId) throw new GameError('NOT_ACTIVE');
    if (typeof targetId !== 'string' || !power.candidates.includes(targetId)) throw new GameError('INVALID_TARGET');
    this.resolvePower(now, targetId);
  }

  private resolvePower(now: number, targetId: string | null): void {
    const r = this.round as Round;
    const power = r.power as PendingPower;
    const res = r.resolution as Resolution;
    r.power = null;
    if (power.kind === 'justice') {
      if (targetId) {
        res.events.push({ type: 'justice', actorId: power.actorId, chosenId: targetId });
        this.finishVoting();
        this.designate(now, targetId, 'justice', res.base, res.events);
      } else {
        // Sans décision : départage habituel (second scrutin entre les ex æquo).
        res.events.push({ type: 'justice-timeout', actorId: power.actorId });
        r.resolution = null;
        this.showResult(now, res.base, { type: 'tie', tied: power.candidates }, res.events, 'runoff');
      }
      return;
    }
    if (targetId) res.queue.push({ playerId: targetId, cause: 'avenger' });
    else res.events.push({ type: 'avenger-pass', playerId: power.actorId });
    this.processResolution(now);
  }

  private afterResult(now: number): void {
    const r = this.round as Round;
    switch (r.next) {
      case 'runoff':
        this.enterVote(now, true, r.runoffCandidates);
        return;
      case 'resolved':
        this.continueAfterResolution(now);
        return;
      default:
        this.enterClues(now, r.cycle + 1);
    }
  }

  /** Après une résolution : tentatives de Mr. White, puis Amoureux, victoires classiques, manche nulle. */
  private continueAfterResolution(now: number): void {
    const r = this.round as Round;
    const nextMrWhite = r.resolution?.mrWhite.shift();
    if (nextMrWhite) {
      this.enterMrWhite(now, nextMrWhite);
      return;
    }
    r.resolution = null;
    const victory = this.checkVictory();
    if (victory) this.endRound(victory);
    else this.enterClues(now, r.cycle + 1);
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
      this.endRound({ side: 'mrwhite', winners: [attempt.playerId], reason: REASONS.mrwhite });
      return;
    }
    this.setDeadline(now, this.timings.mrWhiteResult);
    this.touch();
  }

  // ───────────────────────── victoire

  private checkVictory(): Victory | null {
    const r = this.round as Round;
    const aliveIds = r.baseOrder.filter((id) => r.alive.has(id));
    const lovers = r.lovers;
    // Victoire prioritaire du couple : les deux derniers vivants.
    if (lovers && aliveIds.length === 2 && aliveIds.includes(lovers[0]) && aliveIds.includes(lovers[1])) {
      return { side: 'lovers', winners: [...lovers], reason: REASONS.lovers };
    }
    if (aliveIds.length === 0) return { side: 'draw', winners: [], reason: REASONS.draw };
    const civils = aliveIds.filter((id) => r.roles.get(id) === 'civil').length;
    const intruders = aliveIds.filter((id) => r.roles.get(id) !== 'civil');
    // L'objectif des Amoureux remplace celui de leur camp : ils ne gagnent jamais avec lui.
    const notLover = (id: string) => !lovers?.includes(id);
    if (intruders.length === 0) {
      return { side: 'civils', winners: r.baseOrder.filter((id) => r.roles.get(id) === 'civil' && notLover(id)), reason: REASONS.civils };
    }
    if (intruders.length >= civils) {
      return { side: 'intrus', winners: intruders.filter(notLover), reason: REASONS.intrus };
    }
    return null;
  }

  private endRound(victory: Victory): void {
    const r = this.round as Round;
    const f = r.falafel;
    r.end = {
      winnerSide: victory.side,
      winners: victory.winners,
      reason: victory.reason,
      civilWord: r.pair.civil,
      undercoverWord: r.pair.undercover,
      packName: r.pair.packName,
      roles: r.baseOrder.map((playerId) => {
        const special = r.special.get(playerId);
        const role = r.roles.get(playerId) as Role;
        return special ? { playerId, role, special } : { playerId, role };
      }),
      mrWhiteGuess: r.mrWhite?.guess ?? null,
      lovers: r.lovers ? [...r.lovers] : null,
      duel: r.duel ? { playerIds: [r.duel.a, r.duel.b], winnerId: r.duel.winnerId, draw: r.duel.draw } : null,
      falafel: f && f.targetId ? { vendorId: f.vendorId, targetId: f.targetId, effect: f.effect, used: f.used } : null,
    };
    r.power = null;
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
      case 'power': {
        const power = r.power as PendingPower;
        if (due || this.isAbsent(power.actorId, now)) {
          this.resolvePower(now, null);
          return true;
        }
        return false;
      }
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
          this.continueAfterResolution(now);
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

  /** Rôle spécial visible par tous : la Justice toujours, les autres après élimination ou en fin de manche. */
  private publicSpecial(id: string): SpecialRoleId | undefined {
    const r = this.round;
    const s = r?.special.get(id);
    if (!r || !s) return undefined;
    if (s === 'justice' || this.phase === 'ended' || !r.alive.has(id)) return s;
    return undefined;
  }

  /** Secrets de rôle du seul joueur concerné. */
  private mySpecial(viewerId: string): MySpecial | null {
    const r = this.round;
    if (!r || !r.roles.has(viewerId)) return null;
    const role = r.special.get(viewerId) ?? null;
    let partnerId: string | null = null;
    if (role === 'lovers' && r.lovers) partnerId = r.lovers[0] === viewerId ? r.lovers[1] : r.lovers[0];
    if (role === 'duelists' && r.duel) partnerId = r.duel.a === viewerId ? r.duel.b : r.duel.a;
    const f = r.falafel;
    const falafelTargetId = f && f.vendorId === viewerId ? f.targetId : null;
    let falafel: MySpecial['falafel'] = null;
    if (f && f.targetId === viewerId && !f.used) {
      // L'effet reste secret ; le sabotage n'est annoncé qu'au moment où il empêche de voter.
      const sabotageNow = f.effect === 'sabotage' && f.sabotageCycle === r.cycle && ['vote', 'power', 'result'].includes(this.phase);
      falafel = sabotageNow ? 'sabotaged' : 'received';
    }
    if (!role && !falafel) return null;
    return { role, partnerId, falafelTargetId, falafel };
  }

  /**
   * Construit l'état envoyé à un joueur précis. Chaque champ est choisi explicitement :
   * aucun mot, rôle, lien secret ou vote d'autrui n'y figure avant sa révélation autorisée.
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
        const special = this.publicSpecial(p.id);
        if (special) view.special = special;
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
        memeId: this.phase === 'clues' ? r.memeId : null,
        power:
          this.phase === 'power' && r.power
            ? {
                id: r.power.id,
                kind: r.power.kind,
                actorId: r.power.actorId,
                candidates: [...r.power.candidates],
                events: structuredClone(r.resolution?.events ?? []),
              }
            : null,
        ghostId: this.ghostId(),
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
      settings: { ...this.settings, packIds: [...this.settings.packIds], specialRoles: [...this.settings.specialRoles] },
      players,
      me: {
        id: viewerId,
        status: this.statusOf(viewerId),
        secret,
        hasSeen: r?.seen.has(viewerId) ?? false,
        special: this.mySpecial(viewerId),
      },
      round,
    };
  }
}
