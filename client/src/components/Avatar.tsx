import { Check, Crown, WifiOff, X } from 'lucide-react';
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { AVATARS, type AvatarPattern } from '../../../shared/avatars';
import { cls } from '../lib/util';

const INK = 'rgba(42, 27, 18, 0.16)';
const K = '#2a1b12';
const W = '#fffdf9';
const BLUSH = '#ff8f8f';
const S = { stroke: K, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

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

// ───────────────────────── éléments d'expression (repère 48 × 48)

function Dot({ x, y, r = 2 }: { x: number; y: number; r?: number }) {
  return (
    <>
      <circle cx={x} cy={y} r={r} fill={K} />
      <circle cx={x - r * 0.35} cy={y - r * 0.4} r={r * 0.35} fill="#fff" />
    </>
  );
}

/** Œil rieur (arc vers le haut). */
function Happy({ x, y }: { x: number; y: number }) {
  return <path d={`M${x - 2.2} ${y + 0.8}q2.2 -2.8 4.4 0`} fill="none" {...S} />;
}

/** Œil fermé et rêveur (arc vers le bas). */
function Closed({ x, y }: { x: number; y: number }) {
  return <path d={`M${x - 2.2} ${y - 0.6}q2.2 2.6 4.4 0`} fill="none" {...S} />;
}

/** Œil mi-clos (malice, méfiance). */
function Sly({ x, y }: { x: number; y: number }) {
  return (
    <>
      <path d={`M${x - 2.3} ${y}a2.3 2.3 0 0 0 4.6 0z`} fill={K} />
      <path d={`M${x - 2.8} ${y}h5.6`} fill="none" {...S} />
    </>
  );
}

function Big({ x, y, r = 3.6, lookX = 0, lookY = 0 }: { x: number; y: number; r?: number; lookX?: number; lookY?: number }) {
  return (
    <>
      <circle cx={x} cy={y} r={r} fill="#fff" stroke={K} strokeWidth="1.3" />
      <circle cx={x + lookX} cy={y + lookY} r={r * 0.46} fill={K} />
      <circle cx={x + lookX - r * 0.15} cy={y + lookY - r * 0.2} r={r * 0.15} fill="#fff" />
    </>
  );
}

function Blush({ y = 30, dx = 8.5 }: { y?: number; dx?: number }) {
  return (
    <>
      <ellipse cx={24 - dx} cy={y} rx="2.4" ry="1.4" fill={BLUSH} opacity=".6" />
      <ellipse cx={24 + dx} cy={y} rx="2.4" ry="1.4" fill={BLUSH} opacity=".6" />
    </>
  );
}

function Smile({ y, w = 7 }: { y: number; w?: number }) {
  return <path d={`M${24 - w / 2} ${y}q${w / 2} ${w * 0.42} ${w} 0`} fill="none" {...S} />;
}

// ───────────────────────── personnages

const CHARACTERS: Record<string, () => ReactNode> = {
  chat: () => (
    <>
      <path d="M12.5 20 14 7.5l8.5 6.5z" fill="#ffb86b" {...S} />
      <path d="M35.5 20 34 7.5l-8.5 6.5z" fill="#ffb86b" {...S} />
      <path d="m15 11.5 1 4.5 3-2z" fill={BLUSH} />
      <path d="m33 11.5-1 4.5-3-2z" fill={BLUSH} />
      <ellipse cx="24" cy="27" rx="13.5" ry="12" fill="#ffb86b" {...S} />
      <path d="M22 16v3M24 15.5v3.5M26 16v3" fill="none" {...S} />
      <Sly x={19} y={25.5} />
      <Sly x={29} y={25.5} />
      <path d="m22.6 29 1.4 1.4 1.4-1.4z" fill="#ff7a90" {...S} strokeWidth={1.2} />
      <path d="M21 32.2q3 1.8 6.6-1.4" fill="none" {...S} />
      <path d="M8 27.5h6M8.5 31l5.5-1.4M40 27.5h-6M39.5 31l-5.5-1.4" fill="none" {...S} strokeWidth={1.2} />
    </>
  ),
  poussin: () => (
    <>
      <circle cx="24" cy="28" r="14" fill="#ffe066" {...S} />
      <path d="M21.5 14.5q.5-5 2.5-1.2q1.5-4.5 3 .8" fill="none" {...S} />
      <Big x={19} y={25} r={3.2} />
      <Big x={29} y={25} r={3.2} />
      <path d="M21.4 30.2 24 28.4l2.6 1.8L24 34z" fill="#ff9f43" {...S} strokeWidth={1.3} />
      <path d="M21.4 30.2h5.2" fill="none" {...S} strokeWidth={1.1} />
      <Blush y={31} dx={9} />
    </>
  ),
  grenouille: () => (
    <>
      <circle cx="16.5" cy="18.5" r="5.8" fill="#7ed957" {...S} />
      <circle cx="31.5" cy="18.5" r="5.8" fill="#7ed957" {...S} />
      <ellipse cx="24" cy="29.5" rx="15.5" ry="11" fill="#7ed957" {...S} />
      <Big x={16.5} y={18.5} r={3.4} lookX={0.6} />
      <Big x={31.5} y={18.5} r={3.4} lookX={-0.6} />
      <path d="M13.5 29q10.5 10 21 0q-10.5 4-21 0z" fill={K} />
      <ellipse cx="24" cy="34" rx="3.2" ry="1.6" fill="#ff6f61" />
      <circle cx="19" cy="24.5" r=".8" fill={K} opacity=".5" />
      <circle cx="29" cy="24.5" r=".8" fill={K} opacity=".5" />
    </>
  ),
  lapin: () => (
    <>
      <ellipse cx="18.5" cy="11" rx="3.8" ry="10" transform="rotate(-14 18.5 11)" fill={W} {...S} />
      <ellipse cx="29.5" cy="11" rx="3.8" ry="10" transform="rotate(14 29.5 11)" fill={W} {...S} />
      <ellipse cx="18.5" cy="12" rx="1.6" ry="6.5" transform="rotate(-14 18.5 12)" fill={BLUSH} opacity=".7" />
      <ellipse cx="29.5" cy="12" rx="1.6" ry="6.5" transform="rotate(14 29.5 12)" fill={BLUSH} opacity=".7" />
      <circle cx="24" cy="29.5" r="12.8" fill={W} {...S} />
      <Dot x={19.5} y={28} r={1.6} />
      <Dot x={28.5} y={28} r={1.6} />
      <path d="M23 31.2h2l-1 1.1z" fill="#ff7a90" {...S} strokeWidth={1} />
      <path d="M21.6 33.2q1.2 1.2 2.4 0q1.2 1.2 2.4 0" fill="none" {...S} strokeWidth={1.3} />
      <rect x="22.6" y="33.8" width="2.8" height="2.6" rx=".6" fill="#fff" stroke={K} strokeWidth="1" />
      <Blush y={31.5} dx={8} />
    </>
  ),
  renard: () => (
    <>
      <path d="M10.5 22 12 7l9 8z" fill="#ff8a3d" {...S} />
      <path d="M37.5 22 36 7l-9 8z" fill="#ff8a3d" {...S} />
      <path d="M9.5 21Q12 13.5 24 14q12-.5 14.5 7q-1.5 11-14.5 17.5Q11 32 9.5 21z" fill="#ff8a3d" {...S} />
      <path d="M11 24q6 1 9 6q2 3 4 8.3q2-5.3 4-8.3q3-5 9-6q-2 9-13 14.3Q13 33 11 24z" fill={W} />
      <Dot x={18.5} y={24} r={1.9} />
      <Happy x={29.5} y={24.4} />
      <ellipse cx="24" cy="31" rx="2.2" ry="1.6" fill={K} />
      <path d="M21.5 34q2.5 1.8 5 0" fill="none" {...S} strokeWidth={1.3} />
    </>
  ),
  ours: () => (
    <>
      <circle cx="13" cy="15.5" r="5" fill="#b07a4f" {...S} />
      <circle cx="35" cy="15.5" r="5" fill="#b07a4f" {...S} />
      <circle cx="13" cy="15.5" r="2.3" fill="#e2b48b" />
      <circle cx="35" cy="15.5" r="2.3" fill="#e2b48b" />
      <circle cx="24" cy="28" r="13.5" fill="#b07a4f" {...S} />
      <ellipse cx="24" cy="32" rx="6.4" ry="4.8" fill="#f0d3b0" {...S} strokeWidth={1.3} />
      <Happy x={18.5} y={25} />
      <Happy x={29.5} y={25} />
      <ellipse cx="24" cy="30.2" rx="2.1" ry="1.5" fill={K} />
      <path d="M22 33.4q2 1.6 4 0" fill="none" {...S} strokeWidth={1.3} />
      <Blush y={30} dx={9.5} />
    </>
  ),
  panda: () => (
    <>
      <circle cx="13" cy="15.5" r="5" fill={K} />
      <circle cx="35" cy="15.5" r="5" fill={K} />
      <circle cx="24" cy="28" r="13.5" fill={W} {...S} />
      <ellipse cx="18.5" cy="26" rx="3.6" ry="4.6" transform="rotate(30 18.5 26)" fill={K} />
      <ellipse cx="29.5" cy="26" rx="3.6" ry="4.6" transform="rotate(-30 29.5 26)" fill={K} />
      <path d="M17 26.4q1.8 1.8 3.6 0M27.4 26.4q1.8 1.8 3.6 0" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="24" cy="31" rx="2" ry="1.4" fill={K} />
      <Smile y={33.5} w={5} />
    </>
  ),
  hibou: () => (
    <>
      <path d="M11 25Q11 13 16.5 10l2.5 5.2q5-2 10 0L31.5 10Q37 13 37 25q0 13.5-13 14Q11 38.5 11 25z" fill="#9c7a63" {...S} />
      <path d="M16 33q8 6 16 0q-2 5-8 5.5q-6-.5-8-5.5z" fill="#d9b99b" />
      <circle cx="18.5" cy="23.5" r="5.6" fill={W} {...S} />
      <circle cx="29.5" cy="23.5" r="5.6" fill={W} {...S} />
      <circle cx="20.2" cy="24.2" r="2.4" fill={K} />
      <circle cx="31.2" cy="24.2" r="2.4" fill={K} />
      <path d="M13.8 17.2l8.5 2.8M34.4 16.6l-8.4 1.2" fill="none" {...S} strokeWidth={1.8} />
      <path d="M22.3 28.6h3.4L24 31.6z" fill="#ffb13d" {...S} strokeWidth={1.2} />
    </>
  ),
  pieuvre: () => (
    <>
      <path d="M10 26Q10 10 24 10q14 0 14 16v14q-2.4 4-4.6 0q-2.3 4-4.6 0q-2.4 4-4.6 0q-2.3 4-4.6 0q-2.4 4-4.6 0q-2.3 4-4.6 0z" fill="#ff7eb6" {...S} />
      <circle cx="17" cy="15.5" r="1.6" fill="#ffb3d4" />
      <circle cx="30.5" cy="14" r="2.2" fill="#ffb3d4" />
      <circle cx="33" cy="19" r="1.2" fill="#ffb3d4" />
      <Big x={19} y={23.5} r={3.4} lookX={-0.8} />
      <Big x={29} y={23.5} r={3.4} lookX={0.8} />
      <path d="M20.5 29.5q3.5 3 7 0" fill="none" {...S} />
      <path d="M24.8 30.9q1.4 3.4 2.9.4" fill="#ff5a5a" {...S} strokeWidth={1.2} />
    </>
  ),
  fantome: () => (
    <>
      <path d="M12.5 42V24q0-12.5 11.5-12.5T35.5 24v18q-2.9-3-5.8 0q-2.8-3-5.7 0q-2.9-3-5.7 0q-2.9-3-5.8 0z" fill={W} {...S} />
      <ellipse cx="19.5" cy="23.5" rx="2.2" ry="3.2" fill={K} />
      <ellipse cx="28.5" cy="23.5" rx="2.2" ry="3.2" fill={K} />
      <circle cx="18.9" cy="22.4" r=".8" fill="#fff" />
      <circle cx="27.9" cy="22.4" r=".8" fill="#fff" />
      <ellipse cx="24" cy="31" rx="2.6" ry="3.4" fill={K} />
      <Blush y={28.5} dx={9} />
    </>
  ),
  robot: () => (
    <>
      <path d="M24 13V7.5" fill="none" {...S} />
      <circle cx="24" cy="6.5" r="2.2" fill="#ff6f61" {...S} strokeWidth={1.3} />
      <rect x="8.5" y="21" width="4" height="8" rx="1.5" fill="#8d99ae" {...S} strokeWidth={1.3} />
      <rect x="35.5" y="21" width="4" height="8" rx="1.5" fill="#8d99ae" {...S} strokeWidth={1.3} />
      <rect x="12" y="12.5" width="24" height="24" rx="6" fill="#c3cddc" {...S} />
      <rect x="15.5" y="19.5" width="17" height="8" rx="3" fill="#2f3542" />
      <rect x="17.8" y="21.6" width="3.6" height="3.6" rx="1" fill="#7cf0c5" />
      <rect x="26.6" y="21.6" width="3.6" height="3.6" rx="1" fill="#7cf0c5" />
      <path d="M16 17.6l5 1.4M32 17.6l-5 1.4" fill="none" {...S} strokeWidth={1.8} />
      <path d="M18 31.5l2-1.6 2 1.6 2-1.6 2 1.6 2-1.6 2 1.6" fill="none" {...S} strokeWidth={1.4} />
    </>
  ),
  alien: () => (
    <>
      <path d="M17 13.5 13.5 6M31 13.5 34.5 6" fill="none" {...S} />
      <circle cx="13.2" cy="5.6" r="2" fill="#ffd34e" {...S} strokeWidth={1.2} />
      <circle cx="34.8" cy="5.6" r="2" fill="#ffd34e" {...S} strokeWidth={1.2} />
      <path d="M24 11q14 0 14 12.5Q38 34 24 39.5Q10 34 10 23.5Q10 11 24 11z" fill="#8be28b" {...S} />
      <ellipse cx="18.2" cy="24" rx="3.6" ry="4.8" transform="rotate(-24 18.2 24)" fill={K} />
      <ellipse cx="29.8" cy="24" rx="3.6" ry="4.8" transform="rotate(24 29.8 24)" fill={K} />
      <circle cx="17.2" cy="22.4" r="1.2" fill="#fff" />
      <circle cx="28.8" cy="22.4" r="1.2" fill="#fff" />
      <ellipse cx="24" cy="32.6" rx="1.6" ry="1.2" fill={K} />
    </>
  ),
  dino: () => (
    <>
      <path d="M15 14l2.5-6 3 5.2 3.5-6.4 3.5 6.4 3-5.2L33 14z" fill="#ffb13d" {...S} strokeWidth={1.3} />
      <ellipse cx="24" cy="26.5" rx="14.5" ry="13" fill="#5fc9a0" {...S} />
      <circle cx="16" cy="20" r="1.2" fill="#3aa27b" />
      <circle cx="33" cy="19" r="1.6" fill="#3aa27b" />
      <Happy x={18} y={23.5} />
      <Happy x={30} y={23.5} />
      <path d="M17 23l2-2.2M31 23l-2-2.2" fill="none" {...S} strokeWidth={1.2} />
      <circle cx="21.5" cy="28.4" r=".8" fill={K} />
      <circle cx="26.5" cy="28.4" r=".8" fill={K} />
      <path d="M16.5 31h15q-1.2 6-7.5 6t-7.5-6z" fill={K} />
      <path d="M17.6 31l1.4 2 1.4-2 1.4 2 1.5-2 1.4 2 1.5-2 1.4 2 1.4-2 1.4 2 1.4-2" fill="#fff" stroke="#fff" strokeWidth=".6" strokeLinejoin="round" />
    </>
  ),
  pingouin: () => (
    <>
      <circle cx="24" cy="27" r="14.5" fill="#2f3542" {...S} />
      <path d="M24 19.5q-5-6-10 1.5q-1.5 11 10 15.5q11.5-4.5 10-15.5q-5-7.5-10-1.5z" fill={W} />
      <Dot x={19.5} y={25} r={1.8} />
      <Dot x={28.5} y={25} r={1.8} />
      <path d="M16.6 21.4l5 1.2M31.4 21.4l-5 1.2" fill="none" {...S} strokeWidth={1.8} />
      <path d="M21.4 28.6h5.2L24 32.4z" fill="#ffa13d" {...S} strokeWidth={1.2} />
      <Blush y={30.5} dx={7.5} />
    </>
  ),
  raton: () => (
    <>
      <path d="M11.5 20.5 13.5 9l7.5 6z" fill="#a4abb4" {...S} />
      <path d="M36.5 20.5 34.5 9 27 15z" fill="#a4abb4" {...S} />
      <path d="M9.5 24q1-11 14.5-11t14.5 11q-1 13-14.5 15.5Q10.5 37 9.5 24z" fill="#a4abb4" {...S} />
      <path d="M24 30q-4.5 8-8 3q-2-3 8-3zM24 30q4.5 8 8 3q2-3-8-3z" fill={W} />
      <path d="M10.5 23q4-4.5 9-2.5q3 1.3 4.5 1.3t4.5-1.3q5-2 9 2.5q-2 5-8 4.2q-3.5-.5-5.5-1.8q-2 1.3-5.5 1.8q-6 .8-8-4.2z" fill="#2f3542" />
      <Dot x={18.5} y={23.6} r={1.6} />
      <Dot x={29.5} y={23.6} r={1.6} />
      <ellipse cx="24" cy="29.6" rx="1.9" ry="1.4" fill={K} />
      <path d="M20.5 33q3.5 2.6 7-.8" fill="none" {...S} strokeWidth={1.3} />
      <path d="M25.4 32.6l.4 1.8 1.2-1.5" fill="#fff" stroke={K} strokeWidth=".8" strokeLinejoin="round" />
    </>
  ),
  licorne: () => (
    <>
      <path d="M22 13.5 25.5 2 28 13z" fill="#ffd34e" {...S} strokeWidth={1.3} />
      <path d="M23.2 10.2l3.4-.6M23.8 7l2.2-.4" fill="none" {...S} strokeWidth={1} />
      <path d="M31 13l3-4 1 5.5z" fill={W} {...S} strokeWidth={1.3} />
      <ellipse cx="25" cy="27.5" rx="12.5" ry="12.5" fill={W} {...S} />
      <path d="M13.5 16q-5 6-2 14q1-5 4-7q-2 7 1 12q.5-7 4-11q-2-4-1-9q-3 .5-6 1z" fill="#c4a1ff" {...S} strokeWidth={1.3} />
      <path d="M16 14.5q4-3 9-1q-3 1-4.5 4q-2-3-4.5-3z" fill="#ff9ec4" {...S} strokeWidth={1.2} />
      <Closed x={22} y={25} />
      <Closed x={31} y={25} />
      <path d="M19.4 24l-.9-1.1M33.6 24l.9-1.1" fill="none" {...S} strokeWidth={1.1} />
      <Smile y={31.5} w={5} />
      <Blush y={29} dx={7.8} />
    </>
  ),
};

export interface AvatarProps {
  avatar: number;
  /** Photo importée (adresse servie par le serveur) : remplace le personnage si elle se charge. */
  photo?: string | null;
  size?: number;
  dimmed?: boolean;
  /** active : joueur attendu (anneau orange épais). */
  ring?: 'active';
  label?: string;
  badge?: 'crown' | 'check' | 'offline' | 'out' | null;
  presence?: boolean | null;
  className?: string;
}

export function avatarDef(avatar: number) {
  return AVATARS[((avatar % AVATARS.length) + AVATARS.length) % AVATARS.length];
}

export function Avatar({ avatar, photo, size = 44, dimmed, ring, label, badge, presence, className }: AvatarProps) {
  const def = avatarDef(avatar);
  const draw = CHARACTERS[def.icon] ?? CHARACTERS.chat;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [broken, setBroken] = useState<string | null>(null);
  const showPhoto = Boolean(photo) && broken !== photo;
  const badgeSize = Math.max(11, Math.round(size * 0.24));
  return (
    <span
      className={cls('avatar', dimmed && 'is-dimmed', ring && `ring-${ring}`, showPhoto && 'has-photo', className)}
      style={{ width: size, height: size } as CSSProperties}
      role={label === '' ? undefined : 'img'}
      aria-hidden={label === '' ? true : undefined}
      aria-label={label === '' ? undefined : (label ?? (showPhoto ? 'Photo de profil' : `Avatar ${def.label}`))}
    >
      {showPhoto ? (
        <img src={photo as string} alt="" width={size} height={size} loading="lazy" decoding="async" draggable={false} onError={() => setBroken(photo as string)} />
      ) : (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <defs>
            <pattern id={`p${uid}`} width="8" height="8" patternUnits="userSpaceOnUse">
              {patternShape(def.pattern)}
            </pattern>
            <clipPath id={`c${uid}`}>
              <circle cx="24" cy="24" r="22.6" />
            </clipPath>
          </defs>
          <circle cx="24" cy="24" r="22.6" fill={def.color} />
          <circle cx="24" cy="24" r="22.6" fill={`url(#p${uid})`} />
          <g clipPath={`url(#c${uid})`}>{draw()}</g>
          <circle cx="24" cy="24" r="22.6" fill="none" stroke="#2a1b12" strokeWidth="2.2" />
        </svg>
      )}
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
  return avatarDef(avatar).label;
}
