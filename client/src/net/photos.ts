import type { ProfilePhoto } from './session';

export interface CropBox {
  /** Coin haut-gauche et côté du carré, en fractions de l'image (le côté, en fraction de la plus petite dimension). */
  x: number;
  y: number;
  size: number;
}

type Result = { ok: true; photo: ProfilePhoto } | { ok: false; message: string };

/** Envoie le fichier d'origine et le recadrage : le serveur vérifie, recadre, réduit et réencode lui-même. */
export async function uploadPhoto(file: Blob, crop: CropBox): Promise<Result> {
  const q = new URLSearchParams({ x: crop.x.toFixed(5), y: crop.y.toFixed(5), size: crop.size.toFixed(5) });
  try {
    const res = await fetch(`/api/avatars?${q}`, {
      method: 'POST',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      credentials: 'same-origin',
    });
    const body = (await res.json().catch(() => null)) as { id?: string; url?: string; ownerKey?: string | null; error?: { message?: string } } | null;
    if (!res.ok || !body?.id || !body.url) {
      return { ok: false, message: body?.error?.message ?? (res.status === 413 ? 'Photo trop lourde : 5 Mo maximum.' : 'Import impossible. Réessaie.') };
    }
    return { ok: true, photo: { id: body.id, url: body.url, key: body.ownerKey ?? null } };
  } catch {
    return { ok: false, message: 'Connexion au serveur impossible : la photo n’a pas été envoyée.' };
  }
}

/** Photo d'invité remplacée ou retirée : supprimée côté serveur (après un court délai de grâce). */
export function discardGuestPhoto(photo: ProfilePhoto | null | undefined): void {
  if (!photo?.key) return;
  void fetch(`/api/avatars/${encodeURIComponent(photo.id)}`, {
    method: 'DELETE',
    headers: { 'X-Photo-Key': photo.key },
    credentials: 'same-origin',
  }).catch(() => undefined);
}
