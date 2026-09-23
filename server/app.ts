import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { Server, type Socket } from 'socket.io';
import type { ActionError } from '../shared/types';
import { ERROR_MESSAGES, GameError } from './game/errors';
import { RoomManager } from './game/RoomManager';
import { PACK_META, packIssues } from './packs';
import { KeyedLimiter, TokenBucket } from './rateLimit';

export interface ServerOptions {
  port?: number;
  host?: string;
  /** Dossier du client compilé (dist/client). null = API seule (développement, tests). */
  staticDir?: string | null;
  /** Derrière un proxy (Render, Fly, Railway…) : lire l'IP réelle dans X-Forwarded-For. */
  trustProxy?: boolean;
  /** Origines autorisées pour le temps réel. Vide = même origine uniquement. */
  allowedOrigins?: string[];
  timeScale?: number;
  tickMs?: number;
  quiet?: boolean;
}

export interface RunningServer {
  url: string;
  port: number;
  io: Server;
  http: HttpServer;
  manager: RoomManager;
  close(): Promise<void>;
}

type Handler = (payload: Record<string, unknown>, now: number) => unknown;

function failure(error: unknown): { ok: false; error: ActionError } {
  if (error instanceof GameError) return { ok: false, error: { code: error.code, message: error.message } };
  console.error('[undercover] erreur inattendue', error);
  return { ok: false, error: { code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL } };
}

function clientIp(socket: Socket, trustProxy: boolean): string {
  if (trustProxy) {
    const header = socket.handshake.headers['x-forwarded-for'];
    const first = (Array.isArray(header) ? header[0] : header)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return socket.handshake.address || 'unknown';
}

export async function startServer(options: ServerOptions = {}): Promise<RunningServer> {
  const issues = packIssues();
  if (issues.length > 0) throw new Error(`Packs de mots invalides :\n- ${issues.join('\n- ')}`);

  const trustProxy = options.trustProxy ?? false;
  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'font-src': ["'self'", 'data:'],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'", 'ws:', 'wss:'],
          'object-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          // Laisse fonctionner le jeu en HTTP sur un réseau local (test depuis un téléphone).
          'upgrade-insecure-requests': null,
        },
      },
      strictTransportSecurity: false,
    }),
  );

  const http = createServer(app);
  const allowed = new Set(options.allowedOrigins ?? []);
  const io = new Server(http, {
    serveClient: false,
    maxHttpBufferSize: 16_384,
    pingInterval: 10_000,
    pingTimeout: 8_000,
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      if (!origin || allowed.size === 0) return callback(null, true);
      callback(null, allowed.has(origin));
    },
  });

  const manager = new RoomManager({
    timeScale: options.timeScale ?? 1,
    emit: (socketId, event, payload) => io.to(socketId).emit(event, payload),
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: manager.rooms.size });
  });
  app.get('/api/packs', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ packs: PACK_META });
  });

  const staticDir = options.staticDir;
  if (staticDir && existsSync(path.join(staticDir, 'index.html'))) {
    const indexFile = path.join(staticDir, 'index.html');
    app.use('/assets', express.static(path.join(staticDir, 'assets'), { immutable: true, maxAge: '365d', index: false }));
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    // Application monopage : l'accueil et les liens d'invitation (/r/CODE) servent index.html.
    app.use((req, res, next) => {
      if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api') || path.extname(req.path)) return next();
      res.set('Cache-Control', 'no-cache');
      res.sendFile(indexFile);
    });
  }
  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Page introuvable.' } });
  });

  // Limites par adresse IP. Seules les recherches ÉCHOUÉES comptent : un groupe d'amis derrière
  // la même box (même IP publique) peut rejoindre et se reconnecter sans être bloqué, alors que
  // deviner un code au hasard (31^6 possibilités) reste hors de portée.
  const lookupFailures = new KeyedLimiter(12, 10_000);
  const createLimiter = new KeyedLimiter(10, 30_000);
  const LOOKUP_FAILURES = new Set(['CODE_INVALID', 'ROOM_NOT_FOUND', 'ROOM_EXPIRED', 'SESSION_INVALID']);

  io.on('connection', (socket) => {
    const ip = clientIp(socket, trustProxy);
    const bucket = new TokenBucket(40, 125);

    const on = (event: string, handler: Handler) => {
      socket.on(event, (payload: unknown, ack?: unknown) => {
        const reply = typeof ack === 'function' ? (ack as (res: unknown) => void) : () => {};
        const now = Date.now();
        if (!bucket.take(now)) {
          reply({ ok: false, error: { code: 'RATE_LIMITED', message: ERROR_MESSAGES.RATE_LIMITED } });
          return;
        }
        const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
        try {
          const result = handler(body, now);
          reply({ ok: true, ...(result && typeof result === 'object' ? result : {}) });
        } catch (error) {
          reply(failure(error));
        }
      });
    };

    /** Recherche par code : refusée si cette IP a trop échoué récemment ; chaque échec est compté. */
    const lookup = <T>(now: number, run: () => T): T => {
      if (lookupFailures.isBlocked(ip, now)) throw new GameError('RATE_LIMITED');
      try {
        return run();
      } catch (error) {
        if (error instanceof GameError && LOOKUP_FAILURES.has(error.code)) lookupFailures.take(ip, now);
        throw error;
      }
    };

    on('sync', (_p, now) => ({ now }));

    on('room:create', (p, now) => {
      if (!createLimiter.take(ip, now)) throw new GameError('RATE_LIMITED');
      return manager.createRoom(socket.id, p.name, p.avatar, now);
    });
    on('room:check', (p, now) => lookup(now, () => manager.checkRoom(p.code)));
    on('room:join', (p, now) => lookup(now, () => manager.joinRoom(socket.id, p.code, p.name, p.avatar, now)));
    on('session:resume', (p, now) => lookup(now, () => manager.resume(socket.id, p.code, p.token, now)));
    on('room:leave', (_p, now) => {
      manager.leave(socket.id, now);
    });

    on('lobby:ready', (p, now) => {
      manager.act(socket.id, now, (room, id) => room.setReady(id, p.ready));
    });
    on('lobby:settings', (p, now) => {
      const patch = p.patch && typeof p.patch === 'object' ? (p.patch as Record<string, unknown>) : {};
      manager.act(socket.id, now, (room, id) => room.updateSettings(id, patch));
    });
    on('lobby:profile', (p, now) => {
      manager.act(socket.id, now, (room, id) => room.updateProfile(id, { name: p.name, avatar: p.avatar }));
    });
    on('game:start', (_p, now) => {
      manager.act(socket.id, now, (room, id) => room.start(id, now));
    });
    on('game:seen', (p, now) => {
      manager.act(socket.id, now, (room, id) => room.markSeen(id, p.roundId, now));
    });
    on('game:clue', (p, now) => {
      manager.act(socket.id, now, (room, id) => room.submitClue(id, p.turnId, p.text, now));
    });
    on('game:vote', (p, now) => {
      manager.act(socket.id, now, (room, id) => room.castVote(id, p.ballotId, p.targetId, now));
    });
    on('game:guess', (p, now) => {
      manager.act(socket.id, now, (room, id) => room.submitGuess(id, p.attemptId, p.text, now));
    });
    on('game:replay', (_p, now) => {
      manager.act(socket.id, now, (room, id) => room.replay(id));
    });

    socket.on('disconnect', () => manager.disconnect(socket.id, Date.now()));
  });

  const tick = setInterval(() => {
    const now = Date.now();
    manager.tick(now);
  }, options.tickMs ?? 200);
  const prune = setInterval(() => {
    lookupFailures.prune();
    createLimiter.prune();
  }, 60_000);

  await new Promise<void>((resolve) => http.listen(options.port ?? 3000, options.host ?? '0.0.0.0', resolve));
  const port = (http.address() as AddressInfo).port;
  const url = `http://localhost:${port}`;
  if (!options.quiet) console.log(`[undercover] serveur prêt sur ${url}`);

  return {
    url,
    port,
    io,
    http,
    manager,
    close: async () => {
      clearInterval(tick);
      clearInterval(prune);
      io.disconnectSockets(true);
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
