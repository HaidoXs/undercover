import { createHash, randomBytes, randomInt } from 'node:crypto';
import { CODE_ALPHABET, CODE_LENGTH, MAX_PLAYERS } from '../../shared/constants';
import { GameError } from './errors';
import { DEFAULT_TIMINGS, Room, scaleTimings, type Timings } from './Room';

export type Emit = (socketId: string, event: string, payload: unknown) => void;

export interface ManagerOptions {
  /** Multiplie toutes les durées (tests accélérés). 1 en production. */
  timeScale?: number;
  emit: Emit;
}

interface Binding {
  code: string;
  playerId: string;
}

const EXPIRED_MEMORY_MS = 24 * 60 * 60_000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function normalizeCode(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 32) throw new GameError('CODE_INVALID');
  const code = raw.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== CODE_LENGTH || [...code].some((c) => !CODE_ALPHABET.includes(c))) {
    throw new GameError('CODE_INVALID');
  }
  return code;
}

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  readonly timings: Timings;
  readonly timeScale: number;
  /** Empreinte SHA-256 du jeton de session → joueur. Le jeton lui-même n'est jamais stocké. */
  private readonly sessions = new Map<string, Binding>();
  private readonly bindings = new Map<string, Binding>();
  private readonly expired = new Map<string, number>();

  constructor(private readonly options: ManagerOptions) {
    this.timeScale = options.timeScale ?? 1;
    this.timings = scaleTimings(DEFAULT_TIMINGS, this.timeScale);
  }

  // ───────────────────────── codes & sessions

  private generateCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!this.rooms.has(code) && !this.expired.has(code)) return code;
    }
  }

  private getRoom(code: string): Room {
    const room = this.rooms.get(code);
    if (room) return room;
    throw new GameError(this.expired.has(code) ? 'ROOM_EXPIRED' : 'ROOM_NOT_FOUND');
  }

  bindingOf(socketId: string): Binding | undefined {
    return this.bindings.get(socketId);
  }

  private bind(socketId: string, room: Room, playerId: string, now: number): void {
    this.unbind(socketId, now);
    this.bindings.set(socketId, { code: room.code, playerId });
    room.attachSocket(playerId, socketId);
  }

  private unbind(socketId: string, now: number): void {
    const binding = this.bindings.get(socketId);
    if (!binding) return;
    this.bindings.delete(socketId);
    const room = this.rooms.get(binding.code);
    if (!room) return;
    room.detachSocket(binding.playerId, socketId, now);
    this.broadcast(room, now);
  }

  // ───────────────────────── entrée dans un salon

  createRoom(socketId: string, name: unknown, avatar: unknown, now: number) {
    const code = this.generateCode();
    const room = new Room(code, this.timings, this.timeScale, now);
    const token = randomBytes(32).toString('base64url');
    const player = room.addPlayer({ name, avatar, tokenHash: hashToken(token) }, now);
    this.rooms.set(code, room);
    this.sessions.set(player.tokenHash, { code, playerId: player.id });
    this.bind(socketId, room, player.id, now);
    this.broadcast(room, now);
    return { code, token, playerId: player.id };
  }

  checkRoom(rawCode: unknown) {
    const code = normalizeCode(rawCode);
    const room = this.getRoom(code);
    const count = room.members().length;
    if (count >= MAX_PLAYERS) throw new GameError('ROOM_FULL');
    return { code, players: count, inProgress: room.phase !== 'lobby', takenAvatars: room.members().map((p) => p.avatar) };
  }

  joinRoom(socketId: string, rawCode: unknown, name: unknown, avatar: unknown, now: number) {
    const code = normalizeCode(rawCode);
    const room = this.getRoom(code);
    const token = randomBytes(32).toString('base64url');
    const player = room.addPlayer({ name, avatar, tokenHash: hashToken(token) }, now);
    this.sessions.set(player.tokenHash, { code, playerId: player.id });
    this.bind(socketId, room, player.id, now);
    this.broadcast(room, now);
    return { code, token, playerId: player.id };
  }

  /** Reprise de session (rafraîchissement, reconnexion, changement d'onglet). */
  resume(socketId: string, rawCode: unknown, token: unknown, now: number) {
    const code = normalizeCode(rawCode);
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) throw new GameError('SESSION_INVALID');
    const room = this.getRoom(code);
    const hash = hashToken(token);
    const session = this.sessions.get(hash);
    if (!session || session.code !== code) throw new GameError('SESSION_INVALID');
    const player = room.getPlayer(session.playerId);
    if (!player || player.left) {
      this.sessions.delete(hash);
      throw new GameError('SESSION_INVALID');
    }
    this.bind(socketId, room, player.id, now);
    this.broadcast(room, now);
    return { code, playerId: player.id };
  }

  leave(socketId: string, now: number): void {
    const binding = this.bindings.get(socketId);
    if (!binding) throw new GameError('NOT_IN_ROOM');
    const room = this.rooms.get(binding.code);
    this.bindings.delete(socketId);
    if (!room) return;
    const player = room.getPlayer(binding.playerId);
    if (!player) return;
    const otherSockets = [...player.sockets].filter((s) => s !== socketId);
    for (const s of otherSockets) this.bindings.delete(s);
    room.leave(player.id, now);
    this.sessions.delete(player.tokenHash);
    for (const s of otherSockets) this.options.emit(s, 'room:closed', { reason: 'left' });
    if (room.members().length === 0) this.deleteRoom(room.code, now);
    else this.broadcast(room, now);
  }

  disconnect(socketId: string, now: number): void {
    this.unbind(socketId, now);
  }

  /** Exécute une action de jeu pour le joueur lié à ce socket, puis diffuse le nouvel état. */
  act<T>(socketId: string, now: number, action: (room: Room, playerId: string) => T): T {
    const binding = this.bindings.get(socketId);
    if (!binding) throw new GameError('NOT_IN_ROOM');
    const room = this.rooms.get(binding.code);
    if (!room) throw new GameError('ROOM_EXPIRED');
    const before = room.version;
    try {
      return action(room, binding.playerId);
    } finally {
      if (room.version !== before) this.broadcast(room, now);
    }
  }

  // ───────────────────────── diffusion

  broadcast(room: Room, now: number): void {
    const notices = room.drainNotices();
    for (const player of room.players) {
      if (player.sockets.size === 0) continue;
      const view = room.viewFor(player.id, now);
      for (const socketId of player.sockets) {
        this.options.emit(socketId, 'state', view);
        for (const text of notices) this.options.emit(socketId, 'notice', { text });
      }
    }
  }

  private deleteRoom(code: string, now: number): void {
    const room = this.rooms.get(code);
    if (!room) return;
    for (const player of room.players) {
      this.sessions.delete(player.tokenHash);
      for (const socketId of player.sockets) {
        this.bindings.delete(socketId);
        this.options.emit(socketId, 'room:closed', { reason: 'expired' });
      }
    }
    this.rooms.delete(code);
    this.expired.set(code, now);
  }

  tick(now: number): void {
    for (const [code, room] of this.rooms) {
      if (room.members().length === 0) {
        this.deleteRoom(code, now);
        continue;
      }
      if (room.emptySince !== null && now - room.emptySince >= this.timings.roomExpiry) {
        this.deleteRoom(code, now);
        continue;
      }
      if (room.tick(now)) this.broadcast(room, now);
    }
    for (const [code, at] of this.expired) {
      if (now - at > EXPIRED_MEMORY_MS) this.expired.delete(code);
    }
  }
}
