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

const server = await startServer({ port, host: process.env.HOST ?? '0.0.0.0', staticDir, trustProxy, allowedOrigins });

const shutdown = () => {
  server.close().finally(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
