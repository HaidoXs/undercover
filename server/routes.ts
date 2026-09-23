import express, { type Express, type Request, type Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { AVATAR_COUNT, NAME_MAX, NAME_MIN, PHOTO_MAX_BYTES } from '../shared/constants';
import type { AccountView, AuthConfigView, GameProfile, Prefs } from '../shared/account';
import { sessionUser, type Auth } from './auth';
import { photoUrl } from './game/Room';
import type { Mailer } from './mail';
import { KeyedLimiter } from './rateLimit';
import type { Db } from './storage/db';
import { parseCrop, PhotoError, type PhotoStore } from './storage/photos';
import { cleanLine } from './text';

export interface RouteDeps {
  app: Express;
  auth: Auth | null;
  db: Db;
  photos: PhotoStore;
  mailer: Mailer;
  googleEnabled: boolean;
  /** Origines acceptées pour les requêtes qui modifient des données (protection CSRF). */
  sameOrigin: (req: Request) => boolean;
  clientIp: (req: Request) => string;
}

interface ProfileRow {
  name: string | null;
  avatar: number;
  photo_id: string | null;
  theme: string;
  music: number;
  sound: number;
}

const THEMES = ['system', 'light', 'dark'] as const;

function fail(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ ok: false, error: { code, message } });
}

export async function readProfile(db: Db, userId: string): Promise<{ profile: GameProfile | null; prefs: Prefs }> {
  const row = await db.get<ProfileRow>('SELECT name, avatar, photo_id, theme, music, sound FROM game_profile WHERE user_id = ?', [userId]);
  const prefs: Prefs = {
    theme: (THEMES as readonly string[]).includes(row?.theme ?? '') ? (row?.theme as Prefs['theme']) : 'system',
    music: row ? row.music === 1 : true,
    sound: row ? row.sound === 1 : true,
  };
  if (!row || !row.name) return { profile: null, prefs };
  return { profile: { name: row.name, avatar: Number(row.avatar), photo: row.photo_id, photoUrl: row.photo_id ? photoUrl(row.photo_id) : null }, prefs };
}

async function ensureRow(db: Db, userId: string, now: number): Promise<void> {
  await db.run('INSERT OR IGNORE INTO game_profile (user_id, updated_at) VALUES (?, ?)', [userId, now]);
}

export function registerRoutes(deps: RouteDeps): void {
  const { app, auth, db, photos } = deps;
  const uploadLimiter = new KeyedLimiter(8, 75_000);
  const json = express.json({ limit: '8kb' });

  const requireSameOrigin = (req: Request, res: Response, next: () => void) => {
    if (!deps.sameOrigin(req)) return fail(res, 403, 'FORBIDDEN', 'Origine de la requête refusée.');
    next();
  };

  app.get('/api/auth-config', (_req, res) => {
    const view: AuthConfigView = {
      accounts: auth !== null,
      email: auth !== null && deps.mailer.enabled,
      emailDevMode: deps.mailer.mode === 'console',
      google: auth !== null && deps.googleEnabled,
    };
    res.set('Cache-Control', 'no-store').json(view);
  });

  // ───────────── compte connecté (données visibles par leur seul propriétaire)

  app.get('/api/me', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const user = await sessionUser(auth, req.headers);
    if (!user || !auth) return fail(res, 401, 'UNAUTHENTICATED', 'Non connecté.');
    const accounts = await auth.api.listUserAccounts({ headers: fromNodeHeaders(req.headers) }).catch(() => []);
    const { profile, prefs } = await readProfile(db, user.id);
    const view: AccountView = {
      user: { id: user.id, email: user.email, emailVerified: user.emailVerified },
      providers: [...new Set(accounts.map((a: { providerId: string }) => a.providerId))],
      profile,
      prefs,
    };
    res.json(view);
  });

  app.put('/api/me/profile', requireSameOrigin, json, async (req, res) => {
    const user = await sessionUser(auth, req.headers);
    if (!user) return fail(res, 401, 'UNAUTHENTICATED', 'Non connecté.');
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = cleanLine(body.name, NAME_MAX);
    if (!name || [...name].length < NAME_MIN) return fail(res, 400, 'NAME_INVALID', `Ton pseudo doit faire entre ${NAME_MIN} et ${NAME_MAX} caractères.`);
    const avatar = body.avatar;
    if (!Number.isInteger(avatar) || (avatar as number) < 0 || (avatar as number) >= AVATAR_COUNT) return fail(res, 400, 'BAD_REQUEST', 'Avatar invalide.');
    let photo: string | null = null;
    if (body.photo !== null && body.photo !== undefined) {
      const key = typeof body.photoKey === 'string' ? body.photoKey : null;
      if (await photos.owns(body.photo, { userId: user.id })) photo = body.photo as string;
      else if (key && (await photos.owns(body.photo, { ownerKey: key }))) {
        // Photo importée en invité, rattachée au compte : la clé d'invité prouve la propriété.
        await photos.adopt(body.photo as string, user.id);
        photo = body.photo as string;
      } else return fail(res, 403, 'PHOTO_INVALID', 'Cette photo n’est pas disponible pour ton profil.');
    }
    const now = Date.now();
    await ensureRow(db, user.id, now);
    const previous = (await readProfile(db, user.id)).profile?.photo ?? null;
    await db.run('UPDATE game_profile SET name = ?, avatar = ?, photo_id = ?, updated_at = ? WHERE user_id = ?', [name, avatar as number, photo, now, user.id]);
    if (previous && previous !== photo) await photos.retire(previous, { userId: user.id }, now);
    res.json({ ok: true, ...(await readProfile(db, user.id)) });
  });

  app.put('/api/me/prefs', requireSameOrigin, json, async (req, res) => {
    const user = await sessionUser(auth, req.headers);
    if (!user) return fail(res, 401, 'UNAUTHENTICATED', 'Non connecté.');
    const body = (req.body ?? {}) as Record<string, unknown>;
    const now = Date.now();
    // Tout est validé avant la moindre écriture.
    if ('theme' in body && !(THEMES as readonly unknown[]).includes(body.theme)) return fail(res, 400, 'BAD_REQUEST', 'Thème invalide.');
    for (const key of ['music', 'sound'] as const) {
      if (key in body && typeof body[key] !== 'boolean') return fail(res, 400, 'BAD_REQUEST', 'Préférence invalide.');
    }
    await ensureRow(db, user.id, now);
    if ('theme' in body) await db.run('UPDATE game_profile SET theme = ?, updated_at = ? WHERE user_id = ?', [body.theme as string, now, user.id]);
    for (const key of ['music', 'sound'] as const) {
      if (key in body) await db.run(`UPDATE game_profile SET ${key} = ?, updated_at = ? WHERE user_id = ?`, [body[key] ? 1 : 0, now, user.id]);
    }
    res.json({ ok: true, prefs: (await readProfile(db, user.id)).prefs });
  });

  // ───────────── photos d'avatar

  app.post(
    '/api/avatars',
    requireSameOrigin,
    (req, res, next) => {
      if (!uploadLimiter.take(deps.clientIp(req))) return fail(res, 429, 'RATE_LIMITED', 'Trop d’envois de photos : réessaie dans quelques minutes.');
      const length = Number(req.headers['content-length'] ?? 0);
      if (length > PHOTO_MAX_BYTES) return fail(res, 413, 'PHOTO_TOO_LARGE', 'Photo trop lourde : 5 Mo maximum.');
      next();
    },
    express.raw({ type: () => true, limit: PHOTO_MAX_BYTES }),
    async (req, res) => {
      const user = await sessionUser(auth, req.headers);
      try {
        const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        const result = await photos.importPhoto(body, parseCrop(req.query as Record<string, unknown>), { userId: user?.id ?? null }, Date.now());
        res.status(201).json({ ok: true, id: result.id, url: photoUrl(result.id), ownerKey: result.ownerKey });
      } catch (error) {
        if (error instanceof PhotoError) return fail(res, error.status, 'PHOTO_INVALID', error.message);
        console.error('[undercover] import de photo', error);
        fail(res, 500, 'INTERNAL', 'Erreur pendant le traitement de la photo.');
      }
    },
  );

  app.delete('/api/avatars/:id', requireSameOrigin, async (req, res) => {
    const user = await sessionUser(auth, req.headers);
    const key = req.headers['x-photo-key'];
    const ok = await photos.retire(String(req.params.id), { userId: user?.id ?? null, ownerKey: typeof key === 'string' ? key : null }, Date.now());
    if (!ok) return fail(res, 404, 'NOT_FOUND', 'Photo introuvable.');
    res.json({ ok: true });
  });

  // Fichiers servis un par un (identifiant aléatoire de 128 bits), jamais listés ni indexés.
  app.get('/media/avatars/:file', async (req, res) => {
    const id = String(req.params.file).replace(/\.webp$/, '');
    const image = await photos.image(id);
    if (!image) return fail(res, 404, 'NOT_FOUND', 'Image introuvable.');
    res.set({
      // Une photo ne change jamais sous le même identifiant.
      'Cache-Control': 'private, max-age=86400, immutable',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    res.type('image/webp').send(image);
  });

  // Toute requête JSON trop lourde ou mal formée : réponse propre plutôt qu'une page d'erreur.
  app.use((error: { type?: string; status?: number }, _req: Request, res: Response, next: (e?: unknown) => void) => {
    if (error?.type === 'entity.too.large') return fail(res, 413, 'PHOTO_TOO_LARGE', 'Photo trop lourde : 5 Mo maximum.');
    if (error?.type === 'entity.parse.failed') return fail(res, 400, 'BAD_REQUEST', 'Requête invalide.');
    next(error);
  });
}
