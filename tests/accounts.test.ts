/**
 * Comptes facultatifs et photos d'avatar, joués contre un vrai serveur (base en mémoire, e-mails en mode console).
 */
import sharp from 'sharp';
import { io, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import type { GameView } from '../shared/types';
import { startServer, type RunningServer } from '../server/app';

let server: RunningServer;
const sockets: Socket[] = [];

afterEach(async () => {
  for (const s of sockets.splice(0)) s.disconnect();
  await server?.close();
});

async function boot(extra: Parameters<typeof startServer>[0] = {}) {
  server = await startServer({ port: 0, host: '127.0.0.1', staticDir: null, quiet: true, dataDir: null, tickMs: 50, ...extra });
  return server;
}

/** Petit navigateur : garde ses cookies et envoie une origine comme le ferait la page. */
class Browser {
  cookies = new Map<string, string>();

  get cookie(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async fetch(path: string, init: RequestInit & { json?: unknown } = {}) {
    const headers = new Headers(init.headers);
    headers.set('origin', server.url);
    if (this.cookies.size) headers.set('cookie', this.cookie);
    let body = init.body;
    if (init.json !== undefined) {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(init.json);
    }
    const res = await fetch(path.startsWith('http') ? path : `${server.url}${path}`, { ...init, headers, body, redirect: 'manual' });
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';');
      const [name, ...rest] = pair.split('=');
      const value = rest.join('=');
      const expired = attrs.some((a) => /max-age=0/i.test(a)) || value === '';
      if (expired) this.cookies.delete(name.trim());
      else this.cookies.set(name.trim(), value);
    }
    return res;
  }

  async socket(): Promise<{ socket: Socket; views: GameView[]; emit: (e: string, p?: object) => Promise<Record<string, any>> }> {
    const socket = io(server.url, { transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: this.cookies.size ? { cookie: this.cookie } : {} });
    sockets.push(socket);
    const views: GameView[] = [];
    socket.on('state', (v: GameView) => views.push(v));
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    return { socket, views, emit: (e, p = {}) => socket.timeout(4000).emitWithAck(e, p) };
  }
}

async function signUpAndVerify(b: Browser, email: string, password = 'motdepasse-solide') {
  const res = await b.fetch('/api/auth/sign-up/email', { method: 'POST', json: { email, password, name: 'Joueur', callbackURL: '/?compte=verifie' } });
  expect(res.status).toBe(200);
  const mail = server.mailer.outbox.findLast((m) => m.to === email)!;
  expect(mail.subject).toMatch(/confirme/i);
  const verify = await b.fetch(mail.link);
  expect([302, 307]).toContain(verify.status);
  expect(verify.headers.get('location')).toContain('compte=verifie');
}

const until = async (cond: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('délai dépassé');
    await new Promise((r) => setTimeout(r, 20));
  }
};

describe('comptes facultatifs', () => {
  it('annonce les fonctions réellement disponibles (Google seulement s’il est configuré)', async () => {
    await boot();
    const cfg = await (await fetch(`${server.url}/api/auth-config`)).json();
    expect(cfg).toEqual({ accounts: true, email: true, emailDevMode: true, google: false });
  });

  it('inscription, vérification obligatoire de l’adresse, puis session restaurée par cookie', async () => {
    await boot();
    const b = new Browser();
    // Avant vérification : connexion refusée, et un nouveau lien est envoyé.
    await b.fetch('/api/auth/sign-up/email', { method: 'POST', json: { email: 'lea@exemple.fr', password: 'motdepasse-solide', name: 'Léa' } });
    expect(b.cookies.size).toBe(0);
    const early = await b.fetch('/api/auth/sign-in/email', { method: 'POST', json: { email: 'lea@exemple.fr', password: 'motdepasse-solide' } });
    expect(early.status).toBe(403);
    expect((await early.json()).code).toBe('EMAIL_NOT_VERIFIED');

    const mail = server.mailer.outbox.findLast((m) => m.to === 'lea@exemple.fr')!;
    await b.fetch(mail.link);
    const me = await b.fetch('/api/me');
    expect(me.status).toBe(200);
    const view = await me.json();
    expect(view.user).toMatchObject({ email: 'lea@exemple.fr', emailVerified: true });
    expect(view.providers).toEqual(['credential']);
    expect(view.profile).toBeNull();

    // Le cookie de session est httpOnly et SameSite=Lax ; aucun secret n'est renvoyé au navigateur.
    const signIn = await new Browser().fetch('/api/auth/sign-in/email', { method: 'POST', json: { email: 'lea@exemple.fr', password: 'motdepasse-solide' } });
    const setCookie = signIn.headers.getSetCookie().join('\n');
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(JSON.stringify(await signIn.json())).not.toMatch(/password|hash/i);
  });

  it('refuse un mauvais mot de passe sans dire si l’adresse existe, et limite les tentatives', async () => {
    await boot();
    const b = new Browser();
    await signUpAndVerify(b, 'max@exemple.fr');
    const attempt = (email: string) => new Browser().fetch('/api/auth/sign-in/email', { method: 'POST', json: { email, password: 'mauvais-mot-de-passe' } });
    const wrong = await attempt('max@exemple.fr');
    const unknown = await attempt('personne@exemple.fr');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect((await wrong.json()).code).toBe((await unknown.json()).code);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await attempt('max@exemple.fr')).status);
    expect(statuses).toContain(429);
  });

  it('limite par adresse IP réelle : un joueur ne bloque pas les autres, et l’en-tête interne ne se falsifie pas', async () => {
    await boot({ trustProxy: true });
    const attempt = (ip: string, extra: Record<string, string> = {}) =>
      new Browser().fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'x-forwarded-for': ip, ...extra },
        json: { email: 'quelquun@exemple.fr', password: 'mauvais-mot-de-passe' },
      });
    const fromA: number[] = [];
    for (let i = 0; i < 7; i++) fromA.push((await attempt('203.0.113.7')).status);
    expect(fromA).toContain(429);
    expect((await attempt('198.51.100.20')).status).toBe(401);
    // Changer l'en-tête interne ne réinitialise pas la limite : le serveur le réécrit toujours.
    expect((await attempt('203.0.113.7', { 'x-undercover-client-ip': '10.9.8.7' })).status).toBe(429);
  });

  it('réinitialise le mot de passe par un lien à usage unique et à durée limitée', async () => {
    await boot();
    const b = new Browser();
    await signUpAndVerify(b, 'zoe@exemple.fr', 'ancien-mot-de-passe');
    const req = await new Browser().fetch('/api/auth/request-password-reset', {
      method: 'POST',
      json: { email: 'zoe@exemple.fr', redirectTo: `${server.url}/reinitialiser` },
    });
    expect(req.status).toBe(200);
    const mail = server.mailer.outbox.findLast((m) => m.to === 'zoe@exemple.fr' && /mot de passe/.test(m.subject))!;
    expect(mail.text).toMatch(/une heure/);
    const open = await new Browser().fetch(mail.link);
    const location = new URL(open.headers.get('location')!, server.url);
    expect(location.pathname).toBe('/reinitialiser');
    const token = location.searchParams.get('token')!;
    expect(token).toBeTruthy();

    const reset = await new Browser().fetch('/api/auth/reset-password', { method: 'POST', json: { newPassword: 'nouveau-mot-de-passe', token } });
    expect(reset.status).toBe(200);
    const again = await new Browser().fetch('/api/auth/reset-password', { method: 'POST', json: { newPassword: 'encore-un-autre', token } });
    expect(again.status).toBe(400);

    // Les sessions ouvertes sont révoquées ; seul le nouveau mot de passe fonctionne.
    expect((await b.fetch('/api/me')).status).toBe(401);
    const old = await new Browser().fetch('/api/auth/sign-in/email', { method: 'POST', json: { email: 'zoe@exemple.fr', password: 'ancien-mot-de-passe' } });
    expect(old.status).toBe(401);
    const fresh = await new Browser().fetch('/api/auth/sign-in/email', { method: 'POST', json: { email: 'zoe@exemple.fr', password: 'nouveau-mot-de-passe' } });
    expect(fresh.status).toBe(200);
  });

  it('garde le profil de jeu et les préférences, seulement pour le propriétaire, et se déconnecte', async () => {
    await boot();
    const b = new Browser();
    await signUpAndVerify(b, 'nina@exemple.fr');
    expect((await b.fetch('/api/me/profile', { method: 'PUT', json: { name: 'N', avatar: 2, photo: null } })).status).toBe(400);
    expect((await b.fetch('/api/me/profile', { method: 'PUT', json: { name: 'Nina', avatar: 99, photo: null } })).status).toBe(400);
    expect((await b.fetch('/api/me/profile', { method: 'PUT', json: { name: 'Nina', avatar: 4, photo: null } })).status).toBe(200);
    expect((await b.fetch('/api/me/prefs', { method: 'PUT', json: { theme: 'fluo' } })).status).toBe(400);
    expect((await b.fetch('/api/me/prefs', { method: 'PUT', json: { theme: 'dark', music: false, sound: true } })).status).toBe(200);
    const me = await (await b.fetch('/api/me')).json();
    expect(me.profile).toMatchObject({ name: 'Nina', avatar: 4, photo: null });
    expect(me.prefs).toEqual({ theme: 'dark', music: false, sound: true });

    // Protection CSRF : une autre origine ne peut pas modifier le profil.
    const evil = await fetch(`${server.url}/api/me/prefs`, {
      method: 'PUT',
      headers: { origin: 'https://pirate.example', cookie: b.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ theme: 'light' }),
    });
    expect(evil.status).toBe(403);

    expect((await b.fetch('/api/auth/sign-out', { method: 'POST', json: {} })).status).toBe(200);
    expect((await b.fetch('/api/me')).status).toBe(401);
  });

  it('connecte un invité en pleine partie sans perdre sa place, son rôle ni sa progression', async () => {
    await boot({ timeScale: 1 });
    const guest = new Browser();
    const a = await guest.socket();
    const created = await a.emit('room:create', { name: 'Invitée', avatar: 0 });
    const code = created.code as string;
    const others = [];
    for (let i = 1; i < 4; i++) {
      const c = await new Browser().socket();
      await c.emit('room:join', { code, name: `Ami ${i}`, avatar: i });
      await c.emit('lobby:ready', { ready: true });
      others.push(c);
    }
    expect((await a.emit('game:start')).ok).toBe(true);
    const before = server.manager.rooms.get(code)!;
    const player = before.getPlayer(created.playerId)!;
    const role = before.round!.roles.get(player.id);
    const secret = a.views.at(-1)!.me.secret;
    expect(player.accountId).toBeNull();

    // Connexion en cours de manche, puis reconnexion du socket avec le cookie : même joueur.
    await signUpAndVerify(guest, 'invitee@exemple.fr');
    a.socket.disconnect();
    const again = await guest.socket();
    const resumed = await again.emit('session:resume', { code, token: created.token });
    expect(resumed).toMatchObject({ ok: true, playerId: player.id });
    await until(() => again.views.length > 0);
    const room = server.manager.rooms.get(code)!;
    expect(room.members()).toHaveLength(4);
    expect(room.getPlayer(player.id)!.accountId).toBeTruthy();
    expect(room.round!.roles.get(player.id)).toBe(role);
    expect(again.views.at(-1)!.me.secret).toEqual(secret);

    // Depuis un autre appareil connecté au même compte : reprise de la même place, jamais un deuxième joueur.
    const device = await guest.socket();
    const check = await device.emit('room:check', { code });
    expect(check.mine).toBe(true);
    const join = await device.emit('room:join', { code, name: 'Doublon', avatar: 5 });
    expect(join).toMatchObject({ ok: true, playerId: player.id, resumed: true });
    expect(room.members()).toHaveLength(4);

    // L'adresse e-mail n'apparaît dans aucun état envoyé aux joueurs.
    for (const c of [again, device, ...others]) expect(JSON.stringify(c.views)).not.toContain('invitee@exemple.fr');
  });

  it('prépare la connexion Google seulement si elle est configurée, avec la bonne adresse de retour', async () => {
    await boot({ google: { clientId: 'client-id-de-test.apps.googleusercontent.com', clientSecret: 'secret-de-test' } });
    const cfg = await (await fetch(`${server.url}/api/auth-config`)).json();
    expect(cfg.google).toBe(true);
    const res = await new Browser().fetch('/api/auth/sign-in/social', { method: 'POST', json: { provider: 'google', callbackURL: '/?compte=google' } });
    expect(res.status).toBe(200);
    const { url } = await res.json();
    const google = new URL(url);
    expect(google.hostname).toBe('accounts.google.com');
    expect(google.searchParams.get('redirect_uri')).toBe(`${server.url}/api/auth/callback/google`);
    expect(google.searchParams.get('client_id')).toBe('client-id-de-test.apps.googleusercontent.com');
  });

  it('désactive les comptes en production sans secret, sans empêcher de jouer', async () => {
    await boot({ production: true });
    const cfg = await (await fetch(`${server.url}/api/auth-config`)).json();
    expect(cfg).toMatchObject({ accounts: false, google: false });
    expect((await fetch(`${server.url}/api/auth/get-session`)).status).toBe(404);
    const c = await new Browser().socket();
    expect((await c.emit('room:create', { name: 'Solo', avatar: 1 })).ok).toBe(true);
  });

  it('n’envoie jamais de faux e-mail en production sans SMTP : inscription par e-mail désactivée', async () => {
    await boot({ production: true, authSecret: 'x'.repeat(40) });
    const cfg = await (await fetch(`${server.url}/api/auth-config`)).json();
    expect(cfg).toMatchObject({ accounts: true, email: false, emailDevMode: false });
    const res = await new Browser().fetch('/api/auth/sign-up/email', { method: 'POST', json: { email: 'a@exemple.fr', password: 'motdepasse-solide', name: 'A' } });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ───────────────────────── photos

async function image(format: 'jpeg' | 'png' | 'webp', width = 640, height = 480): Promise<Buffer> {
  const base = sharp({ create: { width, height, channels: 3, background: { r: 255, g: 140, b: 40 } } });
  if (format === 'jpeg') {
    // Métadonnées EXIF (appareil, position GPS) qui ne doivent jamais ressortir.
    return base.jpeg().withExifMerge({ IFD0: { Make: 'Appareil-Test', Copyright: 'SECRET-EXIF' }, IFD3: { GPSLatitudeRef: 'N' } }).toBuffer();
  }
  return format === 'png' ? base.png().toBuffer() : base.webp().toBuffer();
}

async function upload(b: Browser, body: Buffer, type: string, query = 'x=0.1&y=0&size=0.8') {
  return b.fetch(`/api/avatars?${query}`, { method: 'POST', body: new Uint8Array(body), headers: { 'content-type': type } });
}

describe('photos d’avatar', () => {
  it('vérifie, recadre en carré, réencode en WebP et supprime les métadonnées', async () => {
    await boot();
    const b = new Browser();
    for (const format of ['jpeg', 'png', 'webp'] as const) {
      const res = await upload(b, await image(format), `image/${format}`);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.url).toMatch(/^\/media\/avatars\/[A-Za-z0-9_-]{22}\.webp$/);
      expect(body.ownerKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const file = await fetch(`${server.url}${body.url}`);
      expect(file.headers.get('content-type')).toBe('image/webp');
      expect(file.headers.get('x-robots-tag')).toMatch(/noindex/);
      const bytes = Buffer.from(await file.arrayBuffer());
      const meta = await sharp(bytes).metadata();
      expect(meta).toMatchObject({ format: 'webp', width: 256, height: 256 });
      expect(meta.exif).toBeUndefined();
      expect(bytes.includes(Buffer.from('SECRET-EXIF'))).toBe(false);
    }
  });

  it('refuse un faux fichier image, un format non pris en charge et un fichier de plus de 5 Mo', async () => {
    await boot();
    const b = new Browser();
    const fake = await upload(b, Buffer.from('<?php echo "pas une image"; ?>'.repeat(20)), 'image/jpeg');
    expect(fake.status).toBe(415);
    expect((await fake.json()).error.message).toMatch(/JPEG, PNG ou WebP/);
    const gif = await upload(b, await sharp({ create: { width: 80, height: 80, channels: 3, background: '#fff' } }).gif().toBuffer(), 'image/gif');
    expect(gif.status).toBe(415);
    const huge = await upload(b, Buffer.alloc(5 * 1024 * 1024 + 10, 1), 'image/png');
    expect(huge.status).toBe(413);
    expect((await huge.json()).error.message).toMatch(/5 Mo/);
    const tiny = await upload(b, await image('png', 20, 20), 'image/png');
    expect(tiny.status).toBe(400);
  });

  it('n’associe une photo qu’à son propriétaire (clé d’invité ou compte), et permet de la retirer', async () => {
    await boot();
    const owner = new Browser();
    const up = await (await upload(owner, await image('png'), 'image/png')).json();
    const c = await owner.socket();
    expect((await c.emit('room:create', { name: 'Hôte', avatar: 0, photo: up.id })).error.code).toBe('PHOTO_INVALID');
    expect((await c.emit('room:create', { name: 'Hôte', avatar: 0, photo: up.id, photoKey: 'x'.repeat(43) })).error.code).toBe('PHOTO_INVALID');
    const created = await c.emit('room:create', { name: 'Hôte', avatar: 0, photo: up.id, photoKey: up.ownerKey });
    expect(created.ok).toBe(true);
    await until(() => c.views.length > 0);
    expect(c.views.at(-1)!.players[0].photo).toBe(up.url);

    // Un autre joueur ne peut pas s'approprier la photo en connaissant son adresse.
    const thief = await new Browser().socket();
    expect((await thief.emit('room:join', { code: created.code, name: 'Voleur', avatar: 3, photo: up.id })).error.code).toBe('PHOTO_INVALID');

    // Retour à l'avatar dessiné, puis suppression de la photo.
    expect((await c.emit('lobby:profile', { photo: null })).ok).toBe(true);
    await until(() => c.views.at(-1)!.players[0].photo === undefined);
    expect((await owner.fetch(`/api/avatars/${up.id}`, { method: 'DELETE', headers: { 'x-photo-key': 'mauvaise' } })).status).toBe(404);
    expect((await owner.fetch(`/api/avatars/${up.id}`, { method: 'DELETE', headers: { 'x-photo-key': up.ownerKey } })).status).toBe(200);
    expect((await c.emit('lobby:profile', { photo: up.id, photoKey: up.ownerKey })).error.code).toBe('PHOTO_INVALID');
  });

  it('rattache la photo au compte connecté, la remplace et garde l’ancienne le temps qu’elle serve', async () => {
    await boot();
    const b = new Browser();
    await signUpAndVerify(b, 'photo@exemple.fr');
    const first = await (await upload(b, await image('jpeg'), 'image/jpeg')).json();
    expect(first.ownerKey).toBeNull();
    expect((await b.fetch('/api/me/profile', { method: 'PUT', json: { name: 'Photographe', avatar: 1, photo: first.id } })).status).toBe(200);
    const second = await (await upload(b, await image('webp'), 'image/webp')).json();
    expect((await b.fetch('/api/me/profile', { method: 'PUT', json: { name: 'Photographe', avatar: 1, photo: second.id } })).status).toBe(200);
    const me = await (await b.fetch('/api/me')).json();
    expect(me.profile.photo).toBe(second.id);
    // L'ancienne n'est plus utilisable, mais reste servie un moment pour les salons qui l'affichent encore.
    const c = await b.socket();
    expect((await c.emit('room:create', { name: 'Photographe', avatar: 1, photo: first.id })).error.code).toBe('PHOTO_INVALID');
    expect((await fetch(`${server.url}${first.url}`)).status).toBe(200);
    expect((await c.emit('room:create', { name: 'Photographe', avatar: 1, photo: second.id })).ok).toBe(true);
  });

  it('ne liste jamais les photos et limite le nombre d’envois', async () => {
    await boot();
    expect((await fetch(`${server.url}/media/avatars/`)).status).toBe(404);
    expect((await fetch(`${server.url}/media/avatars/..%2F..%2Fpackage.json`)).status).toBe(404);
    const b = new Browser();
    const png = await image('png', 80, 80);
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await upload(b, png, 'image/png')).status);
    expect(statuses.slice(0, 8).every((s) => s === 201)).toBe(true);
    expect(statuses).toContain(429);
  });
});
