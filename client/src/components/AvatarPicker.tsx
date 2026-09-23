import { Check } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import { AVATARS } from '../../../shared/avatars';
import { Avatar } from './Avatar';

/** Groupe de boutons radio accessible : flèches pour se déplacer, un seul arrêt de tabulation. */
export function AvatarPicker({
  value,
  onChange,
  taken = [],
  label = 'Choisis ton avatar',
}: {
  value: number;
  onChange: (avatar: number) => void;
  taken?: number[];
  label?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const available = AVATARS.map((_, i) => i).filter((i) => !taken.includes(i) || i === value);

  const move = (e: KeyboardEvent, delta: number) => {
    e.preventDefault();
    const pos = available.indexOf(value);
    const next = available[(pos + delta + available.length) % available.length];
    onChange(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const cols = window.innerWidth >= 420 ? 8 : 4;
    if (e.key === 'ArrowRight') move(e, 1);
    else if (e.key === 'ArrowLeft') move(e, -1);
    else if (e.key === 'ArrowDown') move(e, cols);
    else if (e.key === 'ArrowUp') move(e, -cols);
  };

  return (
    <div className="avatar-grid" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {AVATARS.map((def, i) => {
        const isTaken = taken.includes(i) && i !== value;
        const selected = i === value;
        return (
          <button
            key={def.icon}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={isTaken ? `${def.label} (déjà pris)` : def.label}
            tabIndex={selected ? 0 : -1}
            disabled={isTaken}
            className="avatar-option"
            onClick={() => onChange(i)}
          >
            <Avatar avatar={i} size={46} label="" />
            {selected && (
              <span className="check" aria-hidden="true">
                <Check size={12} strokeWidth={3.4} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
