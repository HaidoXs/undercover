import { CircleAlert, CircleCheck, Info, LoaderCircle, VenetianMask, WifiOff } from 'lucide-react';
import type { Role } from '../../../shared/types';
import { cls, ROLE_LABEL } from '../lib/util';
import { useApp } from '../state/store';
import { ROLE_ICON } from './icons';

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <svg className="backdrop-rings" viewBox="0 0 400 400" fill="none" stroke="currentColor">
        {Array.from({ length: 11 }, (_, i) => {
          const r = 40 + i * 15;
          const c = 2 * Math.PI * r;
          return (
            <circle
              key={r}
              cx="200"
              cy="200"
              r={r}
              strokeWidth={1}
              strokeDasharray={`${c * (0.18 + (i % 3) * 0.07)} ${c * 0.05} ${c * 0.3} ${c * 0.04}`}
              transform={`rotate(${i * 37} 200 200)`}
            />
          );
        })}
      </svg>
      <div className="backdrop-grain" />
    </div>
  );
}

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <VenetianMask size={22} strokeWidth={2.2} />
      </span>
      {!compact && <span className="brand-name">Undercover</span>}
    </span>
  );
}

export function RoleChip({ role, large }: { role: Role; large?: boolean }) {
  const Icon = ROLE_ICON[role];
  return (
    <span className={cls('role-chip', `role-${role}`, large && 'lg')}>
      <Icon size={large ? 18 : 14} strokeWidth={2.4} aria-hidden="true" />
      {ROLE_LABEL[role]}
    </span>
  );
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cls('toast', `tone-${t.tone}`)}>
          {t.tone === 'success' ? <CircleCheck size={18} /> : t.tone === 'warn' ? <CircleAlert size={18} /> : <Info size={18} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

export function ConnectionBanner() {
  const conn = useApp((s) => s.conn);
  const everOnline = useApp((s) => s.everOnline);
  if (conn === 'online' || !everOnline) return null;
  return (
    <div className="conn-banner" role="alert">
      <WifiOff size={18} />
      Connexion perdue — reconnexion…
      <LoaderCircle className="spinner" size={16} />
    </div>
  );
}

export function FormError({ message, id }: { message: string | null; id?: string }) {
  if (!message) return null;
  return (
    <div className="form-error" role="alert" id={id}>
      <CircleAlert size={18} />
      <span>{message}</span>
    </div>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <LoaderCircle className="spinner" size={size} aria-hidden="true" />;
}
