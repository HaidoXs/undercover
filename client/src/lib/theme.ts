import { useSyncExternalStore } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

/** Même clé que public/theme-init.js, qui applique le thème avant le premier affichage. */
const KEY = 'undercover.theme';

function readPref(): ThemePref {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let pref: ThemePref = readPref();
const listeners = new Set<() => void>();

export function resolvedTheme(p: ThemePref = pref): Theme {
  if (p !== 'system') return p;
  return media?.matches ? 'dark' : 'light';
}

function apply(): void {
  const theme = resolvedTheme();
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1a1512' : '#fff6e9');
  for (const l of listeners) l();
}

// Tant que le joueur n'a rien choisi, le thème suit celui de l'appareil, même en cours de partie.
media?.addEventListener('change', () => {
  if (pref === 'system') apply();
});

export function getThemePref(): ThemePref {
  return pref;
}

/** Choix explicite du joueur (mémorisé), ou retour à la préférence du système. */
export function setThemePref(next: ThemePref): void {
  pref = next;
  try {
    if (next === 'system') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, next);
  } catch {
    /* stockage indisponible : le choix vaut pour cette visite */
  }
  apply();
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => resolvedTheme(),
  );
}
