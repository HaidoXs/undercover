import { Pause } from 'lucide-react';
import type { GameView } from '../../../shared/types';
import { useCountdown } from '../hooks/time';
import { cls } from '../lib/util';

const R = 22;
const C = 2 * Math.PI * R;

export function Timer({ view, size = 52 }: { view: GameView; size?: number }) {
  const cd = useCountdown(view);
  if (!cd) return null;
  const urgent = !cd.paused && cd.remaining <= 5_000;
  const warn = !cd.paused && !urgent && cd.ratio <= 0.33;
  return (
    <div
      className={cls('timer', cd.paused && 'is-paused', warn && 'is-warn', urgent && 'is-urgent')}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={cd.paused ? 'Partie en pause' : `${cd.seconds} secondes restantes`}
    >
      <svg viewBox="0 0 52 52" aria-hidden="true">
        <circle className="track" cx="26" cy="26" r={R} fill="none" strokeWidth="4" />
        <circle
          className="bar"
          cx="26"
          cy="26"
          r={R}
          fill="none"
          strokeWidth="4"
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
