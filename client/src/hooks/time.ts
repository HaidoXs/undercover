import { useEffect, useState } from 'react';
import type { GameView } from '../../../shared/types';
import { useApp } from '../state/store';

export function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

export interface Countdown {
  remaining: number;
  total: number;
  seconds: number;
  ratio: number;
  paused: boolean;
}

/** Compte à rebours calé sur l'échéance serveur (corrigée du décalage d'horloge). */
export function useCountdown(view: GameView): Countdown | null {
  const offset = useApp((s) => s.offset);
  const running = view.deadline !== null && !view.paused;
  const now = useNow(running);
  if (view.paused && view.pausedRemaining !== null) {
    const total = view.deadlineTotal ?? view.pausedRemaining;
    return {
      remaining: view.pausedRemaining,
      total,
      seconds: Math.ceil(view.pausedRemaining / 1000),
      ratio: total > 0 ? view.pausedRemaining / total : 0,
      paused: true,
    };
  }
  if (view.deadline === null) return null;
  const remaining = Math.max(0, view.deadline - (now + offset));
  const total = Math.max(view.deadlineTotal ?? remaining, 1);
  return {
    remaining,
    total,
    seconds: Math.ceil(remaining / 1000),
    ratio: Math.min(1, remaining / total),
    paused: false,
  };
}
