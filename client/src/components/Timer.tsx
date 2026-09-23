import { Pause } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { GameView } from '../../../shared/types';
import { useCountdown, type Countdown } from '../hooks/time';
import { cls } from '../lib/util';

const R = 21;
const C = 2 * Math.PI * R;

/**
 * 0 → 1 à l'approche de zéro : le chrono grossit et se colore progressivement, sans clignoter.
 * La montée commence à 10 s de la fin (ou à mi-parcours pour les phases courtes).
 */
function urgency(cd: Countdown): number {
  if (cd.paused) return 0;
  const window = Math.min(10_000, cd.total / 2);
  return Math.max(0, Math.min(1, 1 - cd.remaining / window));
}

export function Timer({ view, size = 52 }: { view: GameView; size?: number }) {
  const cd = useCountdown(view);
  if (!cd) return null;
  const u = urgency(cd);
  const urgent = !cd.paused && cd.remaining <= 5_000;
  const warn = !cd.paused && !urgent && u > 0;
  return (
    <div
      className={cls('timer', cd.paused && 'is-paused', warn && 'is-warn', urgent && 'is-urgent')}
      style={{ width: size, height: size, '--u': u.toFixed(3) } as CSSProperties}
      role="timer"
      aria-label={cd.paused ? 'Partie en pause' : `${cd.seconds} secondes restantes`}
    >
      <svg viewBox="0 0 52 52" aria-hidden="true">
        <circle className="face" cx="26" cy="26" r="24.5" />
        <circle className="track" cx="26" cy="26" r={R} fill="none" strokeWidth="5" />
        <circle
          className="bar"
          cx="26"
          cy="26"
          r={R}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - cd.ratio)}
        />
      </svg>
      <span className="value" aria-hidden="true">
        {cd.paused ? <Pause size={16} /> : cd.seconds}
      </span>
    </div>
  );
}

export function ProgressBar({ view }: { view: GameView }) {
  const cd = useCountdown(view);
  if (!cd) return null;
  return (
    <div className="progress" aria-hidden="true">
      <span style={{ width: `${Math.round(cd.ratio * 100)}%` }} />
    </div>
  );
}
