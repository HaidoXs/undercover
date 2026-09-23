import type { SpecialRoleId } from './specialRoles';

export type { SpecialRoleId } from './specialRoles';

export type Role = 'civil' | 'undercover' | 'mrwhite';

/** power : décision de la Déesse de la Justice ou de la Vengeuse. */
export type Phase = 'lobby' | 'reveal' | 'clues' | 'vote' | 'power' | 'result' | 'mrwhite' | 'ended';

/** lobby : salon d'attente · alive : en jeu · eliminated : éliminé · waiting : arrivé pendant une manche */
export type PlayerStatus = 'lobby' | 'alive' | 'eliminated' | 'waiting';

export interface Settings {
  undercoverCount: number;
  mrWhite: boolean;
  packIds: string[];
  clueSeconds: number;
  voteSeconds: number;
  /** Rôles spéciaux activés (tous désactivés par défaut). */
  specialRoles: SpecialRoleId[];
}

export interface PackMeta {
  id: string;
  name: string;
  description: string;
  icon: string;
  pairCount: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  avatar: number;
  isHost: boolean;
  connected: boolean;
  ready: boolean;
  left: boolean;
  status: PlayerStatus;
  /** Présent uniquement après révélation autorisée (élimination ou fin de manche). */
  role?: Role;
  /** Rôle spécial public : la Justice dès le début, les autres après élimination ou en fin de manche. */
  special?: SpecialRoleId;
}

/**
 * Carte privée : envoyée uniquement à son propriétaire.
 * Civils et Undercover reçoivent leur mot et sa description ; Mr. White reçoit seulement le thème commun.
 */
export type Secret = { kind: 'word'; word: string; description: string } | { kind: 'mrwhite'; theme: string };

export interface ClueEntry {
  cycle: number;
  playerId: string;
  /** null = tour passé (temps écoulé ou joueur absent) ou indice mimé. */
  text: string | null;
  /** Indice mimé par le joueur désigné par Mr. Meme. */
  mimed?: boolean;
}

export interface BallotView {
  id: string;
  runoff: boolean;
  candidates: string[];
  voters: string[];
  /** Qui a déjà voté — jamais contre qui avant la clôture. */
  voted: string[];
  /** Le choix du joueur qui reçoit cette vue, et seulement le sien. */
  myVote: string | null;
}

export type VoteOutcome =
  | { type: 'eliminated'; playerId: string; role: Role }
  | { type: 'protected'; playerId: string }
  | { type: 'tie'; tied: string[] }
  | { type: 'tie-persist'; tied: string[] }
  | { type: 'no-votes' };

export type EliminationCause = 'vote' | 'justice' | 'lovers' | 'avenger';

/** Étapes publiques d'une résolution de scrutin, dans l'ordre où elles se sont produites. */
export type ResolutionEvent =
  | { type: 'boomerang'; playerId: string }
  | { type: 'protected'; playerId: string }
  | { type: 'justice'; actorId: string; chosenId: string }
  | { type: 'justice-timeout'; actorId: string }
  | { type: 'eliminated'; playerId: string; role: Role; special?: SpecialRoleId; cause: EliminationCause }
  | { type: 'avenger-pass'; playerId: string }
  | { type: 'duel'; winnerId: string; loserId: string }
  | { type: 'duel-draw'; playerIds: [string, string] };

export interface ResultView {
  ballotId: string;
  runoff: boolean;
  outcome: VoteOutcome;
  tally: { playerId: string; votes: number }[];
  votes: { voterId: string; targetId: string | null }[];
  events: ResolutionEvent[];
}

/** Décision en attente : la Justice départage, ou la Vengeuse choisit sa cible. */
export interface PowerView {
  id: string;
  kind: 'justice' | 'avenger';
  actorId: string;
  candidates: string[];
  events: ResolutionEvent[];
}

export interface MrWhiteView {
  attemptId: string;
  playerId: string;
  resolved: boolean;
  guess: string | null;
  correct: boolean | null;
}

export type WinnerSide = 'civils' | 'intrus' | 'mrwhite' | 'lovers' | 'joyfool' | 'draw';

export interface EndView {
  winnerSide: WinnerSide;
  winners: string[];
  civilWord: string;
  undercoverWord: string;
  packName: string;
  roles: { playerId: string; role: Role; special?: SpecialRoleId }[];
  mrWhiteGuess: string | null;
  /** Raison de la victoire, en clair. */
  reason: string;
  lovers: [string, string] | null;
  duel: { playerIds: [string, string]; winnerId: string | null; draw: boolean } | null;
  falafel: { vendorId: string; targetId: string; effect: 'protect' | 'sabotage'; used: boolean } | null;
}

export interface EliminationEntry {
  playerId: string;
  role: Role;
  cycle: number;
  cause: EliminationCause;
}

/**
 * Informations spéciales privées du joueur qui reçoit la vue — jamais celles des autres.
 * falafel : « received » tant que l'effet est inconnu, « sabotaged » pendant le vote qu'il bloque.
 */
export interface MySpecial {
  role: SpecialRoleId | null;
  /** Amoureux : l'âme sœur · Duellistes : l'adversaire. */
  partnerId: string | null;
  /** Vendeur : bénéficiaire choisi (null tant qu'il n'a pas choisi). */
  falafelTargetId: string | null;
  falafel: 'received' | 'sabotaged' | null;
}

export interface RoundView {
  id: string;
  number: number;
  cycle: number;
  order: string[];
  turn: { playerId: string; turnId: string } | null;
  clues: ClueEntry[];
  seen: string[];
  ballot: BallotView | null;
  result: ResultView | null;
  mrWhite: MrWhiteView | null;
  end: EndView | null;
  eliminations: EliminationEntry[];
  composition: { civils: number; undercovers: number; mrWhite: number };
  /** Joueur qui doit mimer son indice pendant ce tour (Mr. Meme), public. */
  memeId: string | null;
  power: PowerView | null;
  /** Fantôme éliminé qui vote encore (public après son élimination). */
  ghostId: string | null;
}

export interface GameView {
  v: number;
  serverNow: number;
  code: string;
  phase: Phase;
  deadline: number | null;
  /** Durée complète de l'échéance en cours (ms), pour afficher la progression. */
  deadlineTotal: number | null;
  paused: boolean;
  pausedRemaining: number | null;
  hostId: string;
  settings: Settings;
  players: PublicPlayer[];
  me: {
    id: string;
    status: PlayerStatus;
    secret: Secret | null;
    hasSeen: boolean;
    special: MySpecial | null;
  };
  round: RoundView | null;
}

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'RATE_LIMITED'
  | 'CODE_INVALID'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_EXPIRED'
  | 'ROOM_FULL'
  | 'NAME_INVALID'
  | 'NAME_TAKEN'
  | 'SESSION_INVALID'
  | 'NOT_IN_ROOM'
  | 'NOT_HOST'
  | 'WRONG_PHASE'
  | 'STALE_ACTION'
  | 'NOT_YOUR_TURN'
  | 'NOT_ACTIVE'
  | 'ALREADY_DONE'
  | 'INVALID_TARGET'
  | 'SELF_VOTE'
  | 'TEXT_INVALID'
  | 'CLUE_IS_WORD'
  | 'NOT_READY'
  | 'CONFIG_INVALID'
  | 'NO_PACK'
  | 'SETTINGS_LOCKED'
  | 'INTERNAL';

export interface ActionError {
  code: ErrorCode;
  message: string;
}

export type Ack<T = Record<string, never>> = ({ ok: true } & T) | { ok: false; error: ActionError };
