import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import sharp from 'sharp';
import { PHOTO_MAX_BYTES, PHOTO_SIZE } from '../../shared/constants';
import type { Db } from './db';

/** Erreur d'import présentée telle quelle au joueur. */
export class PhotoError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Propriétaire d'une photo : un compte, ou un invité qui détient la clé remise lors de l'import. */
export interface PhotoOwner {
  userId?: string | null;
  ownerKey?: string | null;
}

export interface Crop {
  /** Coin haut-gauche et côté du carré, en fractions de l'image (après correction d'orientation). */
  x: number;
  y: number;
  size: number;
}

const ID_RE = /^[A-Za-z0-9_-]{22}$/;
const MAX_PIXELS = 40_000_000;
const MIN_SIDE = 64;
/** Photo remplacée : conservée un jour (le temps qu'aucun salon ne l'affiche plus), puis supprimée. */
const REPLACED_TTL = 24 * 60 * 60_000;
/** Photo d'invité jamais réutilisée depuis longtemps : supprimée. */
const GUEST_TTL = 90 * 24 * 60 * 60_000;

export function isPhotoId(value: unknown): value is string {
  return typeof value === 'string' && ID_RE.test(value);
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('base64url');
}

/** Signature réelle du fichier (octets magiques), indépendamment du type annoncé. */
export function sniffImage(buf: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export function parseCrop(q: Record<string, unknown>): Crop | null {
  const nums = ['x', 'y', 'size'].map((k) => Number(q[k]));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [x, y, size] = nums;
  if (x < 0 || y < 0 || size <= 0 || size > 1 || x > 1 || y > 1) return null;
  return { x, y, size };
}

export class PhotoStore {
  constructor(private readonly db: Db) {}

  /** Image réencodée (WebP), ou null si l'identifiant est invalide ou inconnu. */
  async image(id: string): Promise<Buffer | null> {
    if (!isPhotoId(id)) return null;
    const row = await this.db.get<{ data: ArrayBuffer | Uint8Array }>('SELECT data FROM photo WHERE id = ?', [id]);
    if (!row?.data) return null;
    return Buffer.from(row.data instanceof ArrayBuffer ? new Uint8Array(row.data) : row.data);
  }

  /**
   * Vérifie réellement le fichier (signature + décodage), applique le recadrage carré,
   * redimensionne, réencode en WebP et écarte toutes les métadonnées (EXIF, GPS, profils).
   */
  async importPhoto(input: Buffer, crop: Crop | null, owner: PhotoOwner, now: number): Promise<{ id: string; ownerKey: string | null }> {
    if (input.length === 0) throw new PhotoError(400, 'Fichier vide.');
    if (input.length > PHOTO_MAX_BYTES) throw new PhotoError(413, 'Photo trop lourde : 5 Mo maximum.');
    const kind = sniffImage(input);
    if (!kind) throw new PhotoError(415, 'Format non pris en charge : JPEG, PNG ou WebP uniquement.');

    let oriented: { data: Buffer; info: { width: number; height: number } };
    try {
      const meta = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
      if (meta.format !== kind) throw new Error('format incohérent');
      // Orientation EXIF appliquée aux pixels, première image seulement (pas d'animation).
      oriented = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'error', pages: 1 }).rotate().toBuffer({ resolveWithObject: true });
    } catch {
      throw new PhotoError(415, 'Image illisible ou endommagée.');
    }
    const { width, height } = oriented.info;
    if (Math.min(width, height) < MIN_SIDE) throw new PhotoError(400, `Image trop petite : ${MIN_SIDE} pixels de côté minimum.`);

    const side = Math.max(MIN_SIDE, Math.min(width, height, Math.round((crop?.size ?? 1) * Math.min(width, height))));
    const left = crop ? Math.min(Math.max(0, Math.round(crop.x * width)), width - side) : Math.round((width - side) / 2);
    const top = crop ? Math.min(Math.max(0, Math.round(crop.y * height)), height - side) : Math.round((height - side) / 2);

    const output = await sharp(oriented.data)
      .extract({ left, top, width: side, height: side })
      .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();

    const id = randomBytes(16).toString('base64url');
    const ownerKey = owner.userId ? null : randomBytes(32).toString('base64url');
    await this.db.run('INSERT INTO photo (id, owner_hash, user_id, data, created_at, used_at, replaced_at) VALUES (?, ?, ?, ?, ?, ?, NULL)', [
      id,
      ownerKey ? hashKey(ownerKey) : null,
      owner.userId ?? null,
      output,
      now,
      now,
    ]);
    return { id, ownerKey };
  }

  /** Vrai si ce propriétaire peut afficher cette photo (compte titulaire, ou clé d'invité). */
  async owns(id: unknown, owner: PhotoOwner): Promise<boolean> {
    if (!isPhotoId(id)) return false;
    const row = await this.db.get<{ owner_hash: string | null; user_id: string | null; replaced_at: number | null }>(
      'SELECT owner_hash, user_id, replaced_at FROM photo WHERE id = ?',
      [id],
    );
    if (!row || row.replaced_at !== null) return false;
    if (owner.userId && row.user_id === owner.userId) return true;
    if (owner.ownerKey && row.owner_hash && typeof owner.ownerKey === 'string' && owner.ownerKey.length < 100) {
      const a = Buffer.from(hashKey(owner.ownerKey));
      const b = Buffer.from(row.owner_hash);
      return a.length === b.length && timingSafeEqual(a, b);
    }
    return false;
  }

  /** Photo d'invité rattachée à un compte au moment de la connexion (la clé prouve la propriété). */
  async adopt(id: string, userId: string): Promise<void> {
    await this.db.run('UPDATE photo SET user_id = ?, owner_hash = NULL WHERE id = ?', [userId, id]);
  }

  async touch(id: string, now: number): Promise<void> {
    await this.db.run('UPDATE photo SET used_at = ? WHERE id = ?', [now, id]);
  }

  /** Remplacement ou retour à l'avatar par défaut : la photo disparaît après un court délai. */
  async retire(id: string, owner: PhotoOwner, now: number): Promise<boolean> {
    if (!(await this.owns(id, owner))) return false;
    await this.db.run('UPDATE photo SET replaced_at = ? WHERE id = ?', [now, id]);
    return true;
  }

  /** Nettoyage : photos retirées depuis un jour, photos d'invités abandonnées. Jamais une photo affichée. */
  async prune(inUse: Set<string>, now: number): Promise<number> {
    const rows = await this.db.all<{ id: string }>(
      `SELECT id FROM photo
       WHERE ((replaced_at IS NOT NULL AND replaced_at < ?) OR (user_id IS NULL AND used_at < ?))
         AND id NOT IN (SELECT photo_id FROM game_profile WHERE photo_id IS NOT NULL)`,
      [now - REPLACED_TTL, now - GUEST_TTL],
    );
    let removed = 0;
    for (const { id } of rows) {
      if (inUse.has(id)) continue;
      removed += await this.db.run('DELETE FROM photo WHERE id = ?', [id]);
    }
    return removed;
  }
}
