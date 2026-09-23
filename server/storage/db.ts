import { createClient, type Client, type InValue } from '@libsql/client';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Base libSQL (compatible SQLite) : comptes, sessions, profils et photos.
 * - Un fichier local (développement, ou hébergeur avec disque persistant) : `file:data/undercover.db`.
 * - Une base distante gratuite chez Turso (hébergeur sans disque, comme Render gratuit) : `libsql://…turso.io` + jeton.
 * - Sans dossier ni adresse (tests) : un fichier temporaire. Une base « :memory: » ne convient pas, car libSQL ouvre
 *   une nouvelle connexion après chaque transaction et retrouverait alors une base vide.
 */
export interface DbConfig {
  url: string;
  authToken?: string;
  /** Fichier temporaire (tests) : supprimé à l'arrêt du serveur. */
  temporary?: string;
}

export class Db {
  constructor(readonly client: Client) {}

  async get<T>(sql: string, args: InValue[] = []): Promise<T | undefined> {
    const res = await this.client.execute({ sql, args });
    return res.rows[0] as T | undefined;
  }

  async all<T>(sql: string, args: InValue[] = []): Promise<T[]> {
    const res = await this.client.execute({ sql, args });
    return res.rows as unknown as T[];
  }

  async run(sql: string, args: InValue[] = []): Promise<number> {
    const res = await this.client.execute({ sql, args });
    return res.rowsAffected;
  }

  close(): void {
    this.client.close();
  }
}

const fileUrl = (file: string) => `file:${file.replace(/\\/g, '/')}`;

/** Description sans secret, pour le journal du serveur. */
export function describeDatabase(config: DbConfig): string {
  if (config.url.startsWith('file:')) return `fichier local ${config.url.slice(5)}`;
  return `base distante ${safeHost(config.url)}`;
}

/** Adresse de la base : DATABASE_URL si fournie, sinon un fichier du dossier de données, sinon un fichier temporaire. */
export function databaseConfig(dataDir: string | null, url?: string, authToken?: string): DbConfig {
  if (url) return { url, authToken };
  if (!dataDir) {
    const file = path.join(tmpdir(), `undercover-${randomBytes(6).toString('hex')}.db`);
    return { url: fileUrl(file), temporary: file };
  }
  mkdirSync(dataDir, { recursive: true });
  return { url: fileUrl(path.join(dataDir, 'undercover.db')) };
}

/** Explication en français d'un échec de connexion à la base, pour les journaux de l'hébergeur. */
function explain(config: DbConfig, error: unknown): string {
  const text = String((error as Error)?.message ?? error);
  const where = config.url.startsWith('file:') ? 'le fichier local' : `la base ${safeHost(config.url)}`;
  if (!/^(libsql|https?|wss?|file):/.test(config.url)) return 'DATABASE_URL doit commencer par libsql:// (adresse affichée sur turso.tech, sans guillemets ni espaces).';
  if (/401|403|unauthori[sz]ed|forbidden|token/i.test(text)) return `Accès refusé par ${where} : DATABASE_AUTH_TOKEN est absent, expiré ou ne correspond pas à cette base. Créez un nouveau jeton sur turso.tech et remplacez-le.`;
  if (/404|not found/i.test(text)) return `${where} est introuvable : vérifiez DATABASE_URL (nom exact de la base, copié depuis turso.tech).`;
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(text)) return `Adresse inconnue pour ${where} : DATABASE_URL contient probablement une faute de frappe.`;
  return `Connexion impossible à ${where} : ${text}`;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '(adresse illisible)';
  }
}

export async function openDatabase(config: DbConfig): Promise<Db> {
  if (!config.url.startsWith('file:') && !/^(libsql|https?|wss?):\/\//.test(config.url)) throw new Error(explain(config, ''));
  const db = new Db(createClient({ url: config.url, authToken: config.authToken }));
  try {
    await db.client.execute('SELECT 1');
  } catch (error) {
    db.close();
    throw new Error(explain(config, error));
  }
  await db.client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS game_profile (
      user_id TEXT PRIMARY KEY,
      name TEXT,
      avatar INTEGER NOT NULL DEFAULT 0,
      photo_id TEXT,
      theme TEXT NOT NULL DEFAULT 'system',
      music INTEGER NOT NULL DEFAULT 1,
      sound INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS photo (
      id TEXT PRIMARY KEY,
      owner_hash TEXT,
      user_id TEXT,
      data BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      used_at INTEGER NOT NULL,
      replaced_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS photo_user ON photo(user_id);
  `);
  return db;
}
