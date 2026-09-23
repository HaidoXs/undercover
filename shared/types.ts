export type Role = 'civil' | 'undercover' | 'mrwhite';

export type Phase = 'lobby' | 'reveal' | 'clues' | 'vote' | 'result' | 'mrwhite' | 'ended';

/** lobby : salon d'attente · alive : en jeu · eliminated : éliminé · waiting : arrivé pendant une manche */
export type PlayerStatus = 'lobby' | 'alive' | 'eliminated' | 'waiting';

export interface Settings {
  undercoverCount: number;
  mrWhite: boolean;
  packIds: string[];
  clueSeconds: number;
  voteSeconds: number;
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
}

/**
 * Carte privée : envoyée uniquement à son propriétaire.
 * Civils et Undercover reçoivent leur mot et sa description ; Mr. White reçoit seulement le thème commun.
 */
export type Secret = { kind: 'word'; word: string; description: string } | { kind: 'mrwhite'; theme: string };

export interface ClueEntry {
  cycle: number;
  playerId: string;
  /** null = tour passé (temps écoulé ou joueur absent). */
  text: string | null;
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
  | { type: 'tie'; tied: string[] }
  | { type: 'tie-persist'; tied: string[] }
  | { type: 'no-votes' };

export interface ResultView {
  ballotId: string;
  runoff: boolean;
  outcome: VoteOutcome;
  tally: { playerId: string; votes: number }[];
  votes: { voterId: string; targetId: string | null }[];
}

export interface MrWhiteView {
  attemptId: string;
  playerId: string;
  resolved: boolean;
  guess: string | null;
  correct: boolean | null;
}

export type WinnerSide = 'civils' | 'intrus' | 'mrwhite';

export interface EndView {
  winnerSide: WinnerSide;
  winners: string[];
  civilWord: string;
  undercoverWord: string;
  packName: string;
  roles: { playerId: string; role: Role }[];
  mrWhiteGuess: string | null;
}

export interface EliminationEntry {
  playerId: string;
  role: Role;
  cycle: number;
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
