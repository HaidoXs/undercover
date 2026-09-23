import { io } from 'socket.io-client';
import type { GameView, PackMeta, Settings } from '../../../shared/types';
import { getState, setState, toast } from '../state/store';
import { session } from './session';

export const socket = io({
  autoConnect: false,
  reconnectionDelay: 400,
  reconnectionDelayMax: 3000,
  timeout: 8000,
});

export type Failure = { ok: false; error: { code: string; message: string } };
export type Result<T = object> = ({ ok: true } & T) | Failure;

const OFFLINE: Failure = {
  ok: false,
  error: { code: 'OFFLINE', message: 'Connexion perdue : action non envoyée. Réessaie dès le retour du réseau.' },
};

export async function call<T = object>(event: string, payload: object = {}, timeoutMs = 8000): Promise<Result<T>> {
  if (!socket.connected) return OFFLINE;
  try {
    return (await socket.timeout(timeoutMs).emitWithAck(event, payload)) as Result<T>;
  } catch {
    return { ok: false, error: { code: 'TIMEOUT', message: 'Le serveur ne répond pas. Vérifie ta connexion.' } };
  }
}

/** Erreurs après lesquelles la place dans le salon est perdue pour de bon. */
const LOST_SEAT = new Set(['SESSION_INVALID', 'ROOM_NOT_FOUND', 'ROOM_EXPIRED', 'CODE_INVALID']);

export function fatalTitle(code: string): string {
  switch (code) {
    case 'ROOM_EXPIRED':
      return 'Salon expiré';
    case 'ROOM_NOT_FOUND':
    case 'CODE_INVALID':
      return 'Salon introuvable';
    case 'ROOM_FULL':
      return 'Salon complet';
    case 'SESSION_INVALID':
      return 'Place perdue';
    default:
      return 'Oups';
  }
}

async function syncClock(): Promise<void> {
  let best: { rtt: number; offset: number } | null = null;
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const res = await call<{ now: number }>('sync', {}, 4000);
    const t1 = Date.now();
    if (!res.ok) continue;
    const rtt = t1 - t0;
    const offset = res.now - (t0 + rtt / 2);
    if (!best || rtt < best.rtt) best = { rtt, offset };
  }
  if (best) setState({ offset: best.offset });
}

async function resumeTab(): Promise<void> {
  const tab = session.getTab();
  if (!tab) return;
  setState({ resuming: true });
  const res = await call('session:resume', tab);
  setState({ resuming: false });
  if (res.ok) return;
  if (LOST_SEAT.has(res.error.code)) {
    session.setTab(null);
    session.forget(tab.code);
    // Salon connu de ce navigateur mais inconnu du serveur : il a disparu (redémarrage du serveur).
    const message =
      res.error.code === 'ROOM_NOT_FOUND'
        ? 'Ce salon n’existe plus : le serveur a peut-être redémarré. Crée une nouvelle partie pour rejouer.'
        : res.error.message;
    setState({ view: null, fatal: { title: fatalTitle(res.error.code), message, code: res.error.code } });
  } else {
    toast(res.error.message, 'warn');
  }
}

async function loadPacks(attempt = 0): Promise<void> {
  try {
    const res = await fetch('/api/packs');
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { packs: PackMeta[] };
    setState({ packs: body.packs });
  } catch {
    if (attempt < 5) window.setTimeout(() => void loadPacks(attempt + 1), 1500 * (attempt + 1));
  }
}

export function startConnection(): void {
  socket.on('connect', () => {
    const wasOnline = getState().everOnline;
    setState({ conn: 'online', everOnline: true });
    if (wasOnline) toast('Connexion rétablie', 'success');
    void (async () => {
      await resumeTab();
      await syncClock();
    })();
  });
  socket.on('disconnect', () => setState({ conn: 'offline' }));
  socket.on('connect_error', () => setState({ conn: 'offline' }));

  socket.on('state', (view: GameView) => {
    const current = getState().view;
    if (current && current.code === view.code && view.v < current.v) return;
    setState({ view, fatal: null });
  });
  socket.on('notice', (payload: { text?: unknown }) => {
    if (typeof payload?.text === 'string') toast(payload.text, 'info');
  });
  socket.on('room:closed', (payload: { reason?: string }) => {
    const tab = session.getTab();
    if (tab) {
      session.setTab(null);
      session.forget(tab.code);
    }
    setState({
      view: null,
      fatal:
        payload?.reason === 'left'
          ? { title: 'Tu as quitté le salon', message: 'Tu as quitté ce salon depuis un autre onglet.' }
          : { title: 'Salon fermé', message: 'Ce salon a expiré après une longue période sans joueur connecté.' },
    });
  });

  // Mobile : au retour sur l'application, reconnexion immédiate si besoin.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !socket.connected) socket.connect();
  });
  window.addEventListener('online', () => {
    if (!socket.connected) socket.connect();
  });

  socket.connect();
  void loadPacks();
}

// ───────────────────────── actions

function persist(code: string, token: string, name: string, avatar: number): void {
  session.setTab({ code, token });
  session.save(code, { token, name, avatar, at: Date.now() });
  session.setProfile({ name, avatar });
}

export async function createRoom(name: string, avatar: number) {
  const res = await call<{ code: string; token: string }>('room:create', { name, avatar });
  if (res.ok) persist(res.code, res.token, name, avatar);
  return res;
}

export function checkRoom(code: string) {
  return call<{ code: string; players: number; inProgress: boolean; takenAvatars: number[] }>('room:check', { code });
}

export async function joinRoom(code: string, name: string, avatar: number) {
  const res = await call<{ code: string; token: string }>('room:join', { code, name, avatar });
  if (res.ok) persist(res.code, res.token, name, avatar);
  return res;
}

/** « Reprendre ma place » depuis un onglet neuf, avec la session mémorisée localement. */
export async function resumeSaved(code: string) {
  const saved = session.getSaved(code);
  if (!saved) return { ok: false, error: { code: 'SESSION_INVALID', message: 'Aucune place mémorisée pour ce salon.' } } as Failure;
  const res = await call('session:resume', { code, token: saved.token });
  if (res.ok) {
    session.setTab({ code, token: saved.token });
    session.save(code, { ...saved, at: Date.now() });
  } else if (LOST_SEAT.has(res.error.code)) {
    session.forget(code);
  }
  return res;
}

export async function leaveRoom() {
  const tab = session.getTab();
  const res = await call('room:leave');
  if (res.ok || res.error.code === 'NOT_IN_ROOM') {
    if (tab) {
      session.setTab(null);
      session.forget(tab.code);
    }
    setState({ view: null, fatal: null });
    return { ok: true } as const;
  }
  return res;
}

export const game = {
  ready: (ready: boolean) => call('lobby:ready', { ready }),
  settings: (patch: Partial<Settings>) => call('lobby:settings', { patch }),
  profile: (patch: { name?: string; avatar?: number }) => call('lobby:profile', patch),
  start: () => call('game:start'),
  seen: (roundId: string) => call('game:seen', { roundId }),
  clue: (turnId: string, text: string) => call('game:clue', { turnId, text }),
  vote: (ballotId: string, targetId: string) => call('game:vote', { ballotId, targetId }),
  guess: (attemptId: string, text: string) => call('game:guess', { attemptId, text }),
  mime: (turnId: string) => call('game:mime', { turnId }),
  power: (powerId: string, targetId: string) => call('game:power', { powerId, targetId }),
  falafel: (roundId: string, targetId: string) => call('game:falafel', { roundId, targetId }),
  replay: () => call('game:replay'),
};
