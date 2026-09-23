import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './app';

const port = Number(process.env.PORT ?? 3000);
// Compilé, le serveur vit dans dist/server : le client est à côté, dans dist/client.
const here = path.dirname(fileURLToPath(import.meta.url));
const bundled = path.basename(here) === 'server' && path.basename(path.dirname(here)) === 'dist';
const staticDir = process.env.STATIC_DIR ?? (bundled ? path.resolve(here, '../client') : path.resolve(process.cwd(), 'dist/client'));
const trustProxy = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const env = (key: string) => process.env[key]?.trim() || undefined;
/** `npm run dev` passe l'adresse du serveur Vite (les liens des e-mails pointent vers l'interface). */
const argPublicUrl = process.argv.find((a) => a.startsWith('--public-url='))?.slice('--public-url='.length);
const production = process.env.NODE_ENV === 'production';
const smtpHost = env('SMTP_HOST');
const googleId = env('GOOGLE_CLIENT_ID');
const googleSecret = env('GOOGLE_CLIENT_SECRET');

const server = await startServer({
  port,
  host: env('HOST') ?? '0.0.0.0',
  staticDir,
  trustProxy,
  allowedOrigins,
  production,
  dataDir: path.resolve(env('DATA_DIR') ?? 'data'),
  // Base Turso gratuite (hébergeur sans disque) ; sinon fichier local dans DATA_DIR.
  databaseUrl: env('DATABASE_URL'),
  databaseAuthToken: env('DATABASE_AUTH_TOKEN'),
  publicUrl: env('PUBLIC_URL') ?? argPublicUrl,
  authSecret: env('BETTER_AUTH_SECRET'),
  google: googleId && googleSecret ? { clientId: googleId, clientSecret: googleSecret } : null,
  smtp: smtpHost
    ? {
        host: smtpHost,
        port: Number(env('SMTP_PORT') ?? 587),
        secure: env('SMTP_SECURE') === 'true' || env('SMTP_PORT') === '465',
        user: env('SMTP_USER'),
        pass: env('SMTP_PASS'),
        from: env('MAIL_FROM') ?? 'Undercover <no-reply@localhost>',
      }
    : null,
}).catch((error: unknown) => {
  // Message lisible dans les journaux de l'hébergeur (Render → Logs), puis arrêt.
  console.error(`[undercover] Démarrage impossible : ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

const shutdown = () => {
  server.close().finally(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
