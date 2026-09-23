import { CircleAlert, CircleCheck, Info, LoaderCircle, WifiOff } from 'lucide-react';
import type { Role } from '../../../shared/types';
import { cls, ROLE_LABEL } from '../lib/util';
import { useApp } from '../state/store';
import { ROLE_ICON } from './icons';
import { MaskArt } from './Illustrations';

/** Fond crème avec quelques gribouillis discrets dans les coins, comme un tapis de jeu. */
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <svg className="backdrop-doodles" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <g stroke="currentColor" strokeWidth="3">
          <path d="M60 120c20-20 40 20 60 0s40 20 60 0" />
          <path d="M1060 90l14 30 30 4-22 20 6 30-28-15-28 15 6-30-22-20 30-4z" />
          <circle cx="1120" cy="620" r="18" />
          <path d="M90 640h40M110 620v40" />
          <path d="M980 740c20-20 40 20 60 0s40 20 60 0" />
          <rect x="560" y="30" width="22" height="22" rx="5" transform="rotate(20 571 41)" />
          <path d="M30 400q15-25 30 0t30 0" />
          <circle cx="1160" cy="330" r="6" />
          <circle cx="250" cy="760" r="8" />
        </g>
      </svg>
    </div>
  );
}

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <MaskArt size={30} color="#fff" />
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
          <span className="toast-icon">
            {t.tone === 'success' ? <CircleCheck size={18} /> : t.tone === 'warn' ? <CircleAlert size={18} /> : <Info size={18} />}
          </span>
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
