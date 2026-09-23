import { Cat, Check, Crown, WifiOff, X } from 'lucide-react';
import { useId, type CSSProperties, type ReactNode } from 'react';
import { AVATARS, type AvatarPattern } from '../../../shared/avatars';
import { cls } from '../lib/util';
import { AVATAR_ICONS } from './icons';

const INK = 'rgba(11, 18, 38, 0.2)';

function patternShape(pattern: AvatarPattern): ReactNode {
  switch (pattern) {
    case 'dots':
      return <circle cx="4" cy="4" r="1.3" fill={INK} />;
    case 'stripes':
      return <rect x="0" y="0" width="8" height="2.6" fill={INK} />;
    case 'waves':
      return <path d="M0 4.5 Q2 1.5 4 4.5 T8 4.5" fill="none" stroke={INK} strokeWidth="1.3" />;
    case 'grid':
      return <path d="M0 .5H8M.5 0V8" fill="none" stroke={INK} strokeWidth="1" />;
    case 'diagonal':
      return <path d="M-2 2L2-2M0 8L8 0M6 10L10 6" fill="none" stroke={INK} strokeWidth="1.6" />;
    case 'rings':
      return <circle cx="4" cy="4" r="2.4" fill="none" stroke={INK} strokeWidth="1.1" />;
    case 'zigzag':
      return <path d="M0 6L2 2L4 6L6 2L8 6" fill="none" stroke={INK} strokeWidth="1.2" />;
    case 'checks':
      return (
        <>
          <rect x="0" y="0" width="4" height="4" fill={INK} />
          <rect x="4" y="4" width="4" height="4" fill={INK} />
        </>
      );
  }
}

export interface AvatarProps {
  avatar: number;
  size?: number;
  dimmed?: boolean;
  ring?: 'mint' | 'violet';
  label?: string;
  badge?: 'crown' | 'check' | 'offline' | 'out' | null;
  presence?: boolean | null;
  className?: string;
}

export function Avatar({ avatar, size = 44, dimmed, ring, label, badge, presence, className }: AvatarProps) {
  const def = AVATARS[((avatar % AVATARS.length) + AVATARS.length) % AVATARS.length];
  const Icon = AVATAR_ICONS[def.icon] ?? Cat;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const badgeSize = Math.max(11, Math.round(size * 0.24));
  return (
    <span
      className={cls('avatar', dimmed && 'is-dimmed', ring && `ring-${ring}`, className)}
      style={{ width: size, height: size } as CSSProperties}
      role={label === '' ? undefined : 'img'}
      aria-hidden={label === '' ? true : undefined}
      aria-label={label === '' ? undefined : (label ?? `Avatar ${def.label}`)}
    >
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <radialGradient id={`g${uid}`} cx="32%" cy="24%" r="85%">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="0.35" stopColor={def.color} />
            <stop offset="1" stopColor={def.color} stopOpacity="0.78" />
          </radialGradient>
          <pattern id={`p${uid}`} width="8" height="8" patternUnits="userSpaceOnUse">
            {patternShape(def.pattern)}
          </pattern>
        </defs>
        <circle cx="24" cy="24" r="24" fill="#0b1226" />
        <circle cx="24" cy="24" r="24" fill={`url(#g${uid})`} />
        <circle cx="24" cy="24" r="24" fill={`url(#p${uid})`} />
      </svg>
      <Icon className="avatar-icon" size={Math.round(size * 0.5)} strokeWidth={2.2} aria-hidden="true" />
      {badge === 'crown' && (
        <span className="avatar-badge top badge-crown" style={{ width: badgeSize + 10, height: badgeSize + 10 }}>
          <Crown size={badgeSize} strokeWidth={2.6} aria-hidden="true" />
        </span>
      )}
      {badge === 'check' && (
        <span className="avatar-badge badge-check" style={{ width: badgeSize + 8, height: badgeSize + 8 }}>
          <Check size={badgeSize - 1} strokeWidth={3.2} aria-hidden="true" />
        </span>
      )}
      {badge === 'offline' && (
        <span className="avatar-badge badge-off" style={{ width: badgeSize + 8, height: badgeSize + 8 }}>
          <WifiOff size={badgeSize - 2} strokeWidth={2.6} aria-hidden="true" />
        </span>
      )}
      {badge === 'out' && (
        <span className="avatar-badge badge-out" style={{ width: badgeSize + 8, height: badgeSize + 8 }}>
          <X size={badgeSize - 1} strokeWidth={3} aria-hidden="true" />
        </span>
      )}
      {presence !== undefined && presence !== null && <span className={cls('presence', !presence && 'is-off')} />}
    </span>
  );
}

export function avatarLabel(avatar: number): string {
  return AVATARS[avatar % AVATARS.length]?.label ?? 'Avatar';
}
