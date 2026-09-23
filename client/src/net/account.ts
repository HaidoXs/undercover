import { createAuthClient } from 'better-auth/client';
import { useSyncExternalStore } from 'react';
import type { AccountView, AuthConfigView, GameProfile, Prefs } from '../../../shared/account';
import { isMusicEnabled, setMusicEnabled } from '../lib/music';
import { isMuted, setMuted } from '../lib/sound';
import { getThemePref, setThemePref } from '../lib/theme';
import { toast } from '../state/store';
import { session } from './session';
import { socket } from './controller';

/**
 * Comptes facultatifs. Aucun secret côté navigateur : la session vit dans un cookie httpOnly posé par le serveur.
 * Après une connexion ou une déconnexion, le socket est rouvert : la place en cours est reprise
 * par son jeton puis liée au compte (même joueur, même rôle, même progression).
 */
export const authClient = createAuthClient({ baseURL: window.location.origin });

export interface AccountState {
  config: AuthConfigView | null;
  status: 'loading' | 'guest' | 'signed-in';
  view: AccountView | null;
}

let state: AccountState = { config: null, status: 'loading', view: null };
const listeners = new Set<() => void>();

function set(patch: Partial<AccountState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function useAccount(): AccountState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function getAccount(): AccountState {
  return state;
}

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  try {
    const res = await fetch(url, { credentials: 'same-origin', ...init });
    const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
    if (!res.ok) return { ok: false, status: res.status, message: body?.error?.message ?? 'Le serveur a refusé la demande.' };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, status: 0, message: 'Connexion au serveur impossible.' };
  }
}

function applyPrefs(prefs: Prefs): void {
  if (prefs.theme !== getThemePref()) setThemePref(prefs.theme);
  if (prefs.music !== isMusicEnabled()) setMusicEnabled(prefs.music);
  if (prefs.sound === isMuted()) setMuted(!prefs.sound);
}

/** Enregistre les préférences visuelles et audio sur le compte connecté (sans effet pour un invité). */
export function pushPrefs(): void {
  if (state.status !== 'signed-in') return;
  const prefs: Prefs = { theme: getThemePref(), music: isMusicEnabled(), sound: !isMuted() };
  void api('/api/me/prefs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prefs) });
}

/** Profil de jeu du compte ; enregistré aussi localement pour préremplir les formulaires. */
export async function saveAccountProfile(profile: { name: string; avatar: number; photo: string | null; photoKey?: string | null }) {
  if (state.status !== 'signed-in') return { ok: true as const };
  const res = await api<{ profile: GameProfile | null; prefs: Prefs }>('/api/me/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (res.ok && state.view) set({ view: { ...state.view, profile: res.data.profile } });
  return res;
}

/** Lecture du compte ; `justSignedIn` : applique les préférences du compte et rattache le profil local. */
export async function refreshAccount(justSignedIn = false): Promise<void> {
  if (!state.config) {
    const cfg = await api<AuthConfigView>('/api/auth-config');
    set({ config: cfg.ok ? cfg.data : { accounts: false, email: false, emailDevMode: false, google: false } });
  }
  if (!state.config?.accounts) {
    set({ status: 'guest', view: null });
    return;
  }
  const res = await api<AccountView>('/api/me', { cache: 'no-store' });
  if (!res.ok) {
    set({ status: 'guest', view: null });
    return;
  }
  const view = res.data;
  set({ status: 'signed-in', view });
  if (!justSignedIn) return;

  // Le profil de jeu du compte prime ; un compte neuf reprend le profil d'invité de cet appareil
  // (jamais le nom ni la photo Google).
  const local = session.getProfile();
  if (view.profile) {
    session.setProfile({ name: view.profile.name, avatar: view.profile.avatar, photo: view.profile.photo ? { id: view.profile.photo, url: view.profile.photoUrl ?? '', key: null } : null });
    applyPrefs(view.prefs);
  } else {
    if (local) await saveAccountProfile({ name: local.name, avatar: local.avatar, photo: local.photo?.id ?? null, photoKey: local.photo?.key ?? null });
    pushPrefs();
  }
}

/** Rouvre la connexion temps réel pour que le serveur lise la nouvelle session (place conservée). */
function reconnectSocket(): void {
  if (!socket.connected) return;
  socket.disconnect();
  socket.connect();
}

export async function afterSignIn(): Promise<void> {
  await refreshAccount(true);
  reconnectSocket();
}

export async function signOut(): Promise<void> {
  await authClient.signOut().catch(() => undefined);
  set({ status: 'guest', view: null });
  reconnectSocket();
  toast('Tu es déconnecté. Tu peux continuer à jouer sans compte.', 'info');
}

/** Messages d'erreur de Better Auth, en français et sans révéler si une adresse existe. */
export function authError(error: { code?: string; status?: number; message?: string } | null | undefined): string {
  if (!error) return 'Erreur inattendue.';
  if (error.status === 429) return 'Trop de tentatives. Patiente quelques minutes avant de réessayer.';
  switch (error.code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'Adresse ou mot de passe incorrect.';
    case 'EMAIL_NOT_VERIFIED':
      return 'Confirme d’abord ton adresse : un nouveau lien vient de t’être envoyé.';
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'Un compte existe déjà avec cette adresse. Connecte-toi, ou utilise « Mot de passe oublié ».';
    case 'PASSWORD_TOO_SHORT':
      return 'Mot de passe trop court : 8 caractères minimum.';
    case 'PASSWORD_TOO_LONG':
      return 'Mot de passe trop long : 128 caractères maximum.';
    case 'INVALID_EMAIL':
      return 'Adresse e-mail invalide.';
    case 'INVALID_TOKEN':
      return 'Lien invalide ou expiré. Demande un nouveau lien.';
    default:
      return error.message ? `Erreur : ${error.message}` : 'Erreur inattendue. Réessaie.';
  }
}

/** Retour d'une redirection (vérification d'e-mail, Google) : message clair, puis adresse nettoyée. */
export function handleAuthRedirect(): void {
  const url = new URL(window.location.href);
  const error = url.searchParams.get('error');
  const flag = url.searchParams.get('compte');
  if (!error && !flag) return;
  if (error === 'account_not_linked') {
    toast('Cette adresse a déjà un compte. Connecte-toi par e-mail, puis lie Google depuis « Mon compte ».', 'warn', 8000);
  } else if (error) {
    toast(error === 'INVALID_TOKEN' || error === 'invalid_token' ? 'Lien invalide ou expiré.' : 'La connexion n’a pas abouti. Réessaie.', 'warn', 6000);
  } else if (flag === 'verifie') {
    toast('Adresse confirmée : tu es connecté !', 'success', 5000);
  } else if (flag === 'google') {
    toast('Connexion réussie.', 'success');
  } else if (flag === 'lie') {
    toast('Google est maintenant lié à ton compte.', 'success', 5000);
  }
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  url.searchParams.delete('compte');
  window.history.replaceState(null, '', url.pathname + url.search);
}

export async function startAccount(): Promise<void> {
  const redirected = new URL(window.location.href).searchParams.has('compte');
  await refreshAccount(redirected);
  handleAuthRedirect();
  // Une session ouverte par redirection (Google, lien de vérification) : le socket doit la connaître.
  if (redirected && state.status === 'signed-in') reconnectSocket();
}
