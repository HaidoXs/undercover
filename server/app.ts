import { toNodeHandler } from 'better-auth/node';
import express, { type Request } from 'express';
import helmet from 'helmet';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { Server, type Socket } from 'socket.io';
import type { ActionError } from '../shared/types';
import { ERROR_MESSAGES, GameError } from './game/errors';
import { RoomManager } from './game/RoomManager';
import { CLIENT_IP_HEADER, createAuth, sessionUser, type Auth } from './auth';
import { Mailer, type SmtpConfig } from './mail';
import { PACK_META, packIssues } from './packs';
import { KeyedLimiter, TokenBucket } from './rateLimit';
import { registerRoutes } from './routes';
import { databaseConfig, describeDatabase, openDatabase } from './storage/db';
import { PhotoStore } from './storage/photos';

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
  /** Dossier local (secret de développement, base locale par défaut). null : base en mémoire (tests). */
  dataDir?: string | null;
  /** Base distante (ex. Turso : libsql://…turso.io). Prioritaire sur le fichier local du dossier de données. */
  databaseUrl?: string;
  databaseAuthToken?: string;
  /** Adresse publique du site, pour les liens des e-mails et la redirection Google. Défaut : http://localhost:<port>. */
  publicUrl?: string;
  /** Secret des sessions (32 caractères ou plus). Sans lui, en production, les comptes sont désactivés. */
  authSecret?: string;
  google?: { clientId: string; clientSecret: string } | null;
  smtp?: SmtpConfig | null;
  /** Production : aucun e-mail simulé, secret obligatoire. */
  production?: boolean;
}

export interface RunningServer {
  url: string;
  port: number;
  io: Server;
  http: HttpServer;
  manager: RoomManager;
  mailer: Mailer;
  auth: Auth | null;
  close(): Promise<void>;
}

type Handler = (payload: Record<string, unknown>, now: number) => unknown;

function isPromise(value: unknown): value is Promise<unknown> {
  return typeof (value as Promise<unknown> | null)?.then === 'function';
}

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

/** Base temporaire (tests) : supprimée à l'arrêt ; sous Windows le fichier peut rester verrouillé un instant. */
function removeTemporary(file: string, attempt = 0): void {
  try {
    for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(file + suffix, { force: true });
  } catch {
    if (attempt < 5) setTimeout(() => removeTemporary(file, attempt + 1), 200).unref();
  }
}

/** Secret des sessions : fourni, sinon (hors production) généré une fois et gardé dans le dossier de données. */
function resolveSecret(options: ServerOptions, quiet: boolean): string | null {
  if (options.authSecret && options.authSecret.length >= 32) return options.authSecret;
  if (options.authSecret && !quiet) console.warn('[undercover] BETTER_AUTH_SECRET trop court (32 caractères minimum) : ignoré.');
  if (options.production) return null;
  if (!options.dataDir) return randomBytes(32).toString('base64url');
  const file = path.join(options.dataDir, '.auth-secret');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  const secret = randomBytes(32).toString('base64url');
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export async function startServer(options: ServerOptions = {}): Promise<RunningServer> {
  const issues = packIssues();
  if (issues.length > 0) throw new Error(`Packs de mots invalides :\n- ${issues.join('\n- ')}`);

  const quiet = options.quiet ?? false;
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
          // blob: aperçu local de la photo avant import (jamais envoyée ailleurs).
          'img-src': ["'self'", 'data:', 'blob:'],
          'connect-src': ["'self'", 'ws:', 'wss:'],
          'object-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"],
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

  await new Promise<void>((resolve) => http.listen(options.port ?? 3000, options.host ?? '0.0.0.0', resolve));
  const port = (http.address() as AddressInfo).port;
  const url = `http://localhost:${port}`;
  const publicUrl = (options.publicUrl ?? url).replace(/\/+$/, '');

  // ───────────── données persistantes, comptes, photos
  const dataDir = options.dataDir ?? null;
  const dbConfig = databaseConfig(dataDir, options.databaseUrl, options.databaseAuthToken);
  const db = await openDatabase(dbConfig);
  if (!quiet) console.log(`[undercover] données : ${describeDatabase(dbConfig)}`);
  const photos = new PhotoStore(db);
  const mailer = new Mailer(options.smtp ?? null, !options.production, quiet);
  const secret = resolveSecret(options, quiet);
  const origins = [...new Set([publicUrl, url, ...allowed, ...(options.production ? [] : ['http://localhost:5180'])].map((o) => new URL(o).origin))];
  let auth: Auth | null = null;
  if (secret) {
    auth = await createAuth({ db, baseURL: publicUrl, secret, mailer, google: options.google ?? null, trustedOrigins: origins, trustProxy });
  } else if (!quiet) {
    console.warn('[undercover] Comptes désactivés : définir BETTER_AUTH_SECRET (32 caractères ou plus). Le jeu reste jouable sans compte.');
  }
  if (!quiet && auth && mailer.mode === 'console') console.log('[undercover] E-mails de compte en mode développement : les liens s’affichent ici.');
  if (!quiet && auth && mailer.mode === 'off') console.warn('[undercover] SMTP non configuré : inscription par e-mail désactivée.');

  const clientIpOf = (req: Request) => req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const sameOrigin = (req: Request) => {
    const origin = req.headers.origin;
    if (!origin) return req.headers['sec-fetch-site'] === undefined || req.headers['sec-fetch-site'] === 'same-origin';
    return origins.includes(origin) || origin === `${req.protocol}://${req.headers.host}`;
  };

  // Better Auth lit lui-même le corps de ses requêtes : monté avant tout analyseur JSON.
  if (auth) {
    const handler = toNodeHandler(auth);
    app.all('/api/auth/*splat', (req, res) => {
      req.headers[CLIENT_IP_HEADER] = clientIpOf(req);
      void handler(req, res);
    });
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: manager.rooms.size });
  });
  app.get('/api/packs', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ packs: PACK_META });
  });
  registerRoutes({ app, auth, db, photos, mailer, googleEnabled: Boolean(options.google), sameOrigin, clientIp: clientIpOf });

  const staticDir = options.staticDir;
  if (staticDir && existsSync(path.join(staticDir, 'index.html'))) {
    const indexFile = path.join(staticDir, 'index.html');
    app.use('/assets', express.static(path.join(staticDir, 'assets'), { immutable: true, maxAge: '365d', index: false }));
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    // Application monopage : l'accueil, les liens d'invitation (/r/CODE) et les pages de compte servent index.html.
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

  // Le compte connecté (cookie de session) est lu à la connexion. Après une connexion ou une déconnexion,
  // le client rouvre son socket : sa place est reprise par son jeton, puis liée au compte.
  io.use((socket, next) => {
    void sessionUser(auth, socket.request.headers).then((user) => {
      socket.data.userId = user?.id ?? null;
      next();
    });
  });

  io.on('connection', (socket) => {
    const ip = clientIp(socket, trustProxy);
    const bucket = new TokenBucket(40, 125);
    const userId = (socket.data.userId as string | null) ?? null;

    const on = (event: string, handler: Handler) => {
      socket.on(event, (payload: unknown, ack?: unknown) => {
        const reply = typeof ack === 'function' ? (ack as (res: unknown) => void) : () => {};
        const now = Date.now();
        if (!bucket.take(now)) {
          reply({ ok: false, error: { code: 'RATE_LIMITED', message: ERROR_MESSAGES.RATE_LIMITED } });
          return;
        }
        const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
        const success = (result: unknown) => reply({ ok: true, ...(result && typeof result === 'object' ? result : {}) });
        try {
          // Les actions de jeu sont synchrones ; seules celles qui vérifient une photo attendent la base.
          const result = handler(body, now);
          if (isPromise(result)) result.then(success, (error: unknown) => reply(failure(error)));
          else success(result);
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

    /** Photo demandée : elle doit appartenir au compte connecté ou à l'invité qui présente sa clé. */
    const checkedPhoto = async (p: Record<string, unknown>, now: number): Promise<string | null | undefined> => {
      if (!('photo' in p)) return undefined;
      if (p.photo === null) return null;
      const ownerKey = typeof p.photoKey === 'string' ? p.photoKey : null;
      if (!(await photos.owns(p.photo, { userId, ownerKey }))) throw new GameError('PHOTO_INVALID');
      void photos.touch(p.photo as string, now).catch(() => undefined);
      return p.photo as string;
    };

    on('sync', (_p, now) => ({ now }));

    on('room:create', async (p, now) => {
      if (!createLimiter.take(ip, now)) throw new GameError('RATE_LIMITED');
      const photo = (await checkedPhoto(p, now)) ?? null;
      return manager.createRoom(socket.id, p.name, p.avatar, now, { accountId: userId, photo });
    });
    on('room:check', (p, now) => lookup(now, () => manager.checkRoom(p.code, userId)));
    on('room:join', async (p, now) => {
      const photo = (await checkedPhoto(p, now)) ?? null;
      return lookup(now, () => manager.joinRoom(socket.id, p.code, p.name, p.avatar, now, { accountId: userId, photo }));
    });
    on('session:resume', (p, now) => lookup(now, () => manager.resume(socket.id, p.code, p.token, now, userId)));
    on('session:resume-account', (p, now) => lookup(now, () => manager.resumeByAccount(socket.id, p.code, userId, now)));
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
    on('lobby:profile', async (p, now) => {
      const photo = await checkedPhoto(p, now);
      manager.act(socket.id, now, (room, id) => room.updateProfile(id, { name: p.name, avatar: p.avatar, photo }));
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
    on('game:mime', (p, now) => {
      manager.act(socket.id, now, (room, id) => room.finishMime(id, p.turnId, now));
    });
    on('game:power', (p, now) => {
      manager.act(socket.id, now, (room, id) => room.usePower(id, p.powerId, p.targetId, now));
    });
    on('game:falafel', (p, now) => {
      manager.act(socket.id, now, (room, id) => room.giveFalafel(id, p.roundId, p.targetId));
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
  const prunePhotos = () => {
    photos.prune(manager.photosInUse(), Date.now()).catch((error) => console.error('[undercover] nettoyage des photos', error));
  };
  const photoPrune = setInterval(prunePhotos, 60 * 60_000);

  if (!quiet) console.log(`[undercover] serveur prêt sur ${url}`);

  return {
    url,
    port,
    io,
    http,
    manager,
    mailer,
    auth,
    close: async () => {
      clearInterval(tick);
      clearInterval(prune);
      clearInterval(photoPrune);
      io.disconnectSockets(true);
      await new Promise<void>((resolve) => io.close(() => resolve()));
      db.close();
      if (dbConfig.temporary) removeTemporary(dbConfig.temporary);
    },
  };
}
