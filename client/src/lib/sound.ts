import { useEffect, useSyncExternalStore } from 'react';
import { useApp } from '../state/store';

/**
 * Tic-tac discret synthétisé avec Web Audio (aucun fichier à télécharger).
 * - Les navigateurs n'autorisent le son qu'après un geste de l'utilisateur : le contexte audio
 *   est créé et réactivé au premier appui ou clic, jamais avant.
 * - Un seul minuteur existe à la fois : démarrer un tic-tac arrête le précédent (aucun son superposé).
 */

const MUTE_KEY = 'undercover.muted';
const TICK_WINDOW_MS = 10_000;
const FAST_WINDOW_MS = 5_000;
const SLOW_INTERVAL_MS = 1_000;
const FAST_INTERVAL_MS = 650;

let ctx: AudioContext | null = null;
let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    window.localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    /* préférence gardée pour cette visite seulement */
  }
  for (const listener of listeners) listener();
}

export function useMuted(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => muted,
  );
}

const readyListeners = new Set<() => void>();

/** Contexte audio partagé (tic-tac et musique), ou null tant qu'aucun geste ne l'a débloqué. */
export function audioContext(): AudioContext | null {
  return ctx && ctx.state === 'running' ? ctx : null;
}

/** Prévient quand l'audio devient utilisable (premier geste de l'utilisateur). */
export function onAudioReady(listener: () => void): () => void {
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
}

/** À appeler une fois : débloque l'audio au premier geste, comme l'exigent les navigateurs. */
export function installAudioUnlock(): void {
  const notify = () => {
    for (const listener of readyListeners) listener();
  };
  const unlock = () => {
    try {
      if (!ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        ctx = new Ctor();
      }
      if (ctx.state === 'suspended') void ctx.resume().then(notify, () => {});
      else notify();
    } catch {
      ctx = null;
    }
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

/** Un « tic » ou un « tac » : clic boisé très court, volume bas. */
function click(high: boolean): void {
  if (muted || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(high ? 1500 : 1150, t);
  osc.frequency.exponentialRampToValueAtTime(high ? 1100 : 850, t + 0.05);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.07, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.07);
}

let timer: number | null = null;
let generation = 0;

export function stopTicking(): void {
  generation++;
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
}

/**
 * Lance le tic-tac des 10 dernières secondes (plus rapide sur les 5 dernières).
 * `remaining` renvoie le temps restant d'après l'échéance du serveur.
 * Retourne une fonction d'arrêt qui n'interrompt que ce tic-tac-ci.
 */
export function startTicking(remaining: () => number): () => void {
  stopTicking();
  const mine = ++generation;
  let high = true;
  const loop = () => {
    if (mine !== generation) return;
    const left = remaining();
    if (left <= 50) {
      timer = null;
      return;
    }
    if (left <= TICK_WINDOW_MS + 30) {
      click(high);
      high = !high;
    }
    const wait =
      left > TICK_WINDOW_MS + 30 ? left - TICK_WINDOW_MS : Math.min(left <= FAST_WINDOW_MS + 30 ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS, left);
    timer = window.setTimeout(loop, wait);
  };
  loop();
  return () => {
    if (mine === generation) stopTicking();
  };
}

/** Tic-tac actif tant que `active` est vrai et qu'une échéance serveur court. */
export function useTickTock(active: boolean, deadline: number | null, paused: boolean): void {
  const offset = useApp((s) => s.offset);
  useEffect(() => {
    if (!active || deadline === null || paused) return;
    return startTicking(() => deadline - (Date.now() + offset));
  }, [active, deadline, paused, offset]);
}
