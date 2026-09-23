import { useSyncExternalStore } from 'react';
import type { GameView, PackMeta } from '../../../shared/types';

export type ConnState = 'connecting' | 'online' | 'offline';
export type ToastTone = 'success' | 'info' | 'warn';

export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

export interface Fatal {
  title: string;
  message: string;
  code?: string;
}

export interface AppState {
  conn: ConnState;
  /** true après la première connexion réussie : sert à distinguer « connexion » de « reconnexion ». */
  everOnline: boolean;
  view: GameView | null;
  /** Décalage horloge serveur − horloge locale (ms). */
  offset: number;
  packs: PackMeta[];
  toasts: Toast[];
  fatal: Fatal | null;
  resuming: boolean;
}

let state: AppState = {
  conn: 'connecting',
  everOnline: false,
  view: null,
  offset: 0,
  packs: [],
  toasts: [],
  fatal: null,
  resuming: false,
};

const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Le sélecteur doit renvoyer une valeur stable (une tranche de l'état, pas un nouvel objet). */
export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

let toastSeq = 0;

export function toast(text: string, tone: ToastTone = 'info', durationMs = 2600): void {
  const id = ++toastSeq;
  setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
  window.setTimeout(() => {
    setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  }, durationMs);
}
