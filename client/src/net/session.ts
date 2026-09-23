/**
 * Identité du joueur côté navigateur.
 * - Onglet (sessionStorage) : survit au rafraîchissement, propre à chaque onglet,
 *   ce qui permet plusieurs joueurs sur un même ordinateur.
 * - Mémoire locale (localStorage) : permet de « reprendre sa place » après avoir fermé l'onglet.
 * Le stockage peut être indisponible (navigation privée stricte) : tout est protégé.
 */

export interface TabSession {
  code: string;
  token: string;
}

export interface SavedSession {
  token: string;
  name: string;
  avatar: number;
  at: number;
}

/** Photo importée : `key` prouve la propriété d'une photo d'invité (null si elle appartient à un compte). */
export interface ProfilePhoto {
  id: string;
  url: string;
  key: string | null;
}

export interface Profile {
  name: string;
  avatar: number;
  photo?: ProfilePhoto | null;
}

const TAB_KEY = 'undercover.tab';
const SAVED_KEY = 'undercover.saved';
const PROFILE_KEY = 'undercover.profile';
const SAVED_TTL = 24 * 60 * 60_000;

function read<T>(storage: () => Storage, key: string): T | null {
  try {
    const raw = storage().getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: unknown): void {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : la session vivra le temps de l'onglet */
  }
}

const tab = () => window.sessionStorage;
const local = () => window.localStorage;

function savedMap(): Record<string, SavedSession> {
  const map = read<Record<string, SavedSession>>(local, SAVED_KEY) ?? {};
  const now = Date.now();
  for (const [code, entry] of Object.entries(map)) {
    if (!entry || typeof entry.token !== 'string' || now - entry.at > SAVED_TTL) delete map[code];
  }
  return map;
}

export const session = {
  getTab(): TabSession | null {
    const s = read<TabSession>(tab, TAB_KEY);
    return s && typeof s.code === 'string' && typeof s.token === 'string' ? s : null;
  },
  setTab(value: TabSession | null): void {
    write(tab, TAB_KEY, value);
  },
  getSaved(code: string): SavedSession | null {
    return savedMap()[code] ?? null;
  },
  save(code: string, value: SavedSession): void {
    const map = savedMap();
    map[code] = value;
    write(local, SAVED_KEY, map);
  },
  forget(code: string): void {
    const map = savedMap();
    delete map[code];
    write(local, SAVED_KEY, map);
  },
  getProfile(): Profile | null {
    const p = read<Profile>(local, PROFILE_KEY);
    if (!p || typeof p.name !== 'string' || !Number.isInteger(p.avatar)) return null;
    const photo = p.photo && typeof p.photo.id === 'string' && typeof p.photo.url === 'string' ? p.photo : null;
    return { name: p.name, avatar: p.avatar, photo };
  },
  setProfile(value: Profile): void {
    write(local, PROFILE_KEY, value);
  },
};
