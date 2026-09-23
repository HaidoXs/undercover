import type { ReactNode } from 'react';
import type { Role } from '../../../shared/types';

/**
 * Illustrations originales, dessinées à la main en SVG : trait brun épais, aplats de couleur.
 * Toutes sont décoratives (aria-hidden) : le sens est toujours porté par le texte voisin.
 * Les couleurs reprennent les jetons de app.css (les attributs SVG n'acceptent pas var()).
 */
export const PAL = {
  ink: '#2A1B12',
  paper: '#FFFDF9',
  cream: '#FFF6E9',
  orange: '#FF8A2B',
  orangeSoft: '#FFE3C8',
  yellow: '#FFD34E',
  yellowSoft: '#FFF1BF',
  coral: '#FF6F61',
  pink: '#FF9EC4',
  mint: '#5ED6B0',
  violet: '#9B7BF7',
  sky: '#7CC7F5',
  skySoft: '#DDF1FD',
  snow: '#F1F4F8',
};

type ArtProps = { size?: number; className?: string };

function Art({ viewBox, size, className, children }: ArtProps & { viewBox: string; children: ReactNode }) {
  const [, , w, h] = viewBox.split(' ').map(Number);
  return (
    <svg
      className={className}
      viewBox={viewBox}
      width={size}
      height={size ? (size * h) / w : undefined}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

// ───────────────────────── formes réutilisables (repère local)

/** Loup vénitien aux yeux qui louchent : repère 0 0 120 72. */
export function MaskShapes({ color = PAL.violet }: { color?: string }) {
  return (
    <g>
      <path d="M109 28c9-3 13 5 9 12M111 34c7 1 8 10 3 14" stroke={PAL.ink} strokeWidth="3" />
      <path
        d="M8 28C8 14 22 8 38 10c10 1 17 6 22 12 5-6 12-11 22-12 16-2 30 4 30 18 0 18-12 30-28 30-11 0-19-6-24-14-5 8-13 14-24 14C20 58 8 46 8 28Z"
        fill={color}
        stroke={PAL.ink}
        strokeWidth="3.5"
      />
      <path d="M18 21c4-5 11-7 18-7" stroke="#fff" strokeOpacity=".75" strokeWidth="3" />
      <path d="m60 25 4 5-4 5-4-5 4-5Z" fill={PAL.yellow} stroke={PAL.ink} strokeWidth="2" />
      <ellipse cx="37" cy="33" rx="12" ry="8" fill={PAL.paper} stroke={PAL.ink} strokeWidth="3" />
      <ellipse cx="83" cy="33" rx="12" ry="8" fill={PAL.paper} stroke={PAL.ink} strokeWidth="3" />
      <g className="art-eyes">
        <circle cx="41" cy="34" r="4.2" fill={PAL.ink} />
        <circle cx="87" cy="34" r="4.2" fill={PAL.ink} />
      </g>
    </g>
  );
}

/** Petit fantôme étonné : repère 0 0 100 110. */
export function GhostShapes() {
  return (
    <g>
      <path d="M82 58c10-4 14-12 10-18" stroke={PAL.ink} strokeWidth="3.5" />
      <path
        d="M18 46c0-22 14-36 32-36s32 14 32 36v50c0 5-5 7-9 3-4-4-8-4-11 0-4 5-8 5-12 0-4-4-8-4-12 0-4 5-8 5-11 0-3-4-9 1-9-5V46Z"
        fill="#fff"
        stroke={PAL.ink}
        strokeWidth="3.5"
      />
      <path d="M28 34c3-8 9-13 16-14" stroke={PAL.snow} strokeWidth="4" />
      <ellipse cx="40" cy="48" rx="4.2" ry="6" fill={PAL.ink} />
      <ellipse cx="60" cy="48" rx="4.2" ry="6" fill={PAL.ink} />
      <circle cx="41.4" cy="45.6" r="1.5" fill="#fff" />
      <circle cx="61.4" cy="45.6" r="1.5" fill="#fff" />
      <ellipse cx="32" cy="60" rx="5" ry="3" fill={PAL.coral} opacity=".55" />
      <ellipse cx="68" cy="60" rx="5" ry="3" fill={PAL.coral} opacity=".55" />
      <ellipse cx="50" cy="64" rx="3.6" ry="4.6" fill={PAL.ink} />
    </g>
  );
}

/** Loupe : repère 0 0 100 100. */
export function MagnifierShapes() {
  return (
    <g>
      <path d="m63 63 25 25" stroke={PAL.ink} strokeWidth="17" />
      <path d="m63 63 25 25" stroke={PAL.orange} strokeWidth="9" />
      <circle cx="40" cy="40" r="28" fill={PAL.skySoft} stroke={PAL.ink} strokeWidth="5" />
      <path d="M24 34a18 18 0 0 1 12-12" stroke="#fff" strokeWidth="4.5" />
      <circle cx="52" cy="50" r="2.5" fill="#fff" />
    </g>
  );
}

function Heart({ x, y, s, r, color }: { x: number; y: number; s: number; r: number; color: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}
      d="M0-6C-4-14-16-12-16-2c0 10 12 16 16 22 4-6 16-12 16-22 0-10-12-12-16-4Z"
      fill={color}
      stroke={PAL.ink}
      strokeWidth="3"
      vectorEffect="non-scaling-stroke"
    />
  );
}

function Sparkle({ x, y, s = 1, color = PAL.yellow }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0-9C1-3 3-1 9 0 3 1 1 3 0 9-1 3-3 1-9 0-3-1-1-3 0-9Z"
      fill={color}
      stroke={PAL.ink}
      strokeWidth="2"
      vectorEffect="non-scaling-stroke"
    />
  );
}

// ───────────────────────── illustrations autonomes

export function MaskArt(props: ArtProps & { color?: string }) {
  return (
    <Art viewBox="0 0 122 64" {...props}>
      <MaskShapes color={props.color} />
    </Art>
  );
}

export function GhostArt(props: ArtProps) {
  return (
    <Art viewBox="0 0 100 110" {...props}>
      <GhostShapes />
    </Art>
  );
}

export function MagnifierArt(props: ArtProps) {
  return (
    <Art viewBox="0 0 100 100" {...props}>
      <MagnifierShapes />
    </Art>
  );
}

export function HeartsArt(props: ArtProps) {
  return (
    <Art viewBox="0 0 110 90" {...props}>
      <Heart x={42} y={48} s={1.55} r={-12} color={PAL.coral} />
      <Heart x={72} y={42} s={1.25} r={14} color={PAL.pink} />
      <Sparkle x={94} y={16} s={0.8} />
      <Sparkle x={14} y={20} s={0.6} color={PAL.mint} />
    </Art>
  );
}

export function PartyArt(props: ArtProps) {
  return (
    <Art viewBox="0 0 110 100" {...props}>
      <path d="M16 92 34 38l38 38-56 16Z" fill={PAL.yellow} stroke={PAL.ink} strokeWidth="3.5" />
      <path d="m27 60 22 22M22 75l9 9" stroke={PAL.coral} strokeWidth="5" />
      <path d="M34 38c6-8 16-6 22 0s16 8 22 0" stroke={PAL.ink} strokeWidth="3.5" />
      <path d="M56 22c4-10 14-10 16-2M82 44c10-2 14 6 10 12" stroke={PAL.violet} strokeWidth="4" />
      <rect x="84" y="14" width="8" height="8" rx="2" transform="rotate(20 88 18)" fill={PAL.mint} stroke={PAL.ink} strokeWidth="2" />
      <rect x="62" y="52" width="7" height="7" rx="2" transform="rotate(-25 65 55)" fill={PAL.coral} stroke={PAL.ink} strokeWidth="2" />
      <circle cx="96" cy="72" r="4" fill={PAL.sky} stroke={PAL.ink} strokeWidth="2" />
      <Sparkle x={44} y={14} s={0.8} />
    </Art>
  );
}

/** Trois têtes qui partagent la même bulle : les Civils. */
export function CivilsArt(props: ArtProps) {
  const head = (x: number, y: number, r: number, color: string) => (
    <g key={x}>
      <circle cx={x} cy={y} r={r} fill={color} stroke={PAL.ink} strokeWidth="3.5" />
      <circle cx={x - r * 0.32} cy={y - r * 0.12} r="2.4" fill={PAL.ink} />
      <circle cx={x + r * 0.32} cy={y - r * 0.12} r="2.4" fill={PAL.ink} />
      <path d={`M${x - r * 0.3} ${y + r * 0.3}q${r * 0.3} ${r * 0.28} ${r * 0.6} 0`} stroke={PAL.ink} strokeWidth="2.6" />
    </g>
  );
  return (
    <Art viewBox="0 0 120 100" {...props}>
      <path d="M36 8h48a10 10 0 0 1 10 10v12a10 10 0 0 1-10 10H66l-6 8-6-8H36a10 10 0 0 1-10-10V18A10 10 0 0 1 36 8Z" fill={PAL.paper} stroke={PAL.ink} strokeWidth="3" />
      <circle cx="47" cy="24" r="3.2" fill={PAL.ink} />
      <circle cx="60" cy="24" r="3.2" fill={PAL.ink} />
      <circle cx="73" cy="24" r="3.2" fill={PAL.ink} />
      {head(28, 76, 17, PAL.mint)}
      {head(92, 76, 17, PAL.sky)}
      {head(60, 70, 20, PAL.yellow)}
    </Art>
  );
}

export function RoleArt({ role, ...props }: ArtProps & { role: Role }) {
  if (role === 'undercover') return <MaskArt {...props} />;
  if (role === 'mrwhite') return <GhostArt {...props} />;
  return <CivilsArt {...props} />;
}

/** Scène d'accueil : cartes secrètes distribuées sur la table, un loup, une loupe et un fantôme curieux. */
export function BluffScene({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 340 214" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="bs-stripes" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="6" height="12" fill="#fff" opacity=".22" />
        </pattern>
      </defs>

      <ellipse cx="170" cy="182" rx="150" ry="26" fill={PAL.orangeSoft} stroke={PAL.ink} strokeWidth="3" />
      <path d="M44 184c30 10 80 14 126 14" stroke="#fff" strokeOpacity=".8" strokeWidth="3" />

      <g transform="translate(58 30) scale(.52)">
        <g className="art-float">
          <GhostShapes />
        </g>
      </g>

      <g transform="translate(94 112) rotate(-17)">
        <g className="art-deal" style={{ animationDelay: '.05s' }}>
          <rect x="-34" y="-48" width="68" height="96" rx="12" fill={PAL.mint} stroke={PAL.ink} strokeWidth="3.5" />
          <rect x="-25" y="-39" width="50" height="78" rx="8" fill="#fff" opacity=".35" />
          <path d="M-9-14c0-9 18-9 18 1 0 8-9 8-9 16" stroke={PAL.ink} strokeWidth="6" />
          <circle cx="0" cy="17" r="3.8" fill={PAL.ink} />
        </g>
      </g>

      <g transform="translate(248 110) rotate(15)">
        <g className="art-deal" style={{ animationDelay: '.12s' }}>
          <rect x="-34" y="-48" width="68" height="96" rx="12" fill={PAL.coral} stroke={PAL.ink} strokeWidth="3.5" />
          <path d="M-20-16h40a8 8 0 0 1 8 8v12a8 8 0 0 1-8 8H2l-7 8-2-8h-13a8 8 0 0 1-8-8V-8a8 8 0 0 1 8-8Z" fill={PAL.paper} stroke={PAL.ink} strokeWidth="3" />
          <circle cx="-10" cy="-2" r="2.8" fill={PAL.ink} />
          <circle cx="0" cy="-2" r="2.8" fill={PAL.ink} />
          <circle cx="10" cy="-2" r="2.8" fill={PAL.ink} />
        </g>
      </g>

      <g transform="translate(170 100) rotate(-3)">
        <g className="art-deal" style={{ animationDelay: '.2s' }}>
          <rect x="-44" y="-62" width="88" height="124" rx="14" fill={PAL.orange} stroke={PAL.ink} strokeWidth="3.5" />
          <rect x="-44" y="-62" width="88" height="124" rx="14" fill="url(#bs-stripes)" />
          <rect x="-34" y="-52" width="68" height="104" rx="9" stroke={PAL.ink} strokeWidth="2.5" strokeDasharray="1 7" />
          <circle cx="0" cy="0" r="34" fill={PAL.cream} stroke={PAL.ink} strokeWidth="3" />
          <g transform="translate(-29 -17) scale(.48)">
            <MaskShapes />
          </g>
        </g>
      </g>

      <g transform="translate(250 128) scale(.62)">
        <g className="art-deal" style={{ animationDelay: '.3s' }}>
          <MagnifierShapes />
        </g>
      </g>

      <Sparkle x={36} y={112} s={0.9} />
      <Sparkle x={306} y={40} s={1.1} color={PAL.mint} />
      <Sparkle x={216} y={20} s={0.7} color={PAL.pink} />
      <rect x="126" y="12" width="10" height="10" rx="2.5" transform="rotate(24 131 17)" fill={PAL.yellow} stroke={PAL.ink} strokeWidth="2" />
      <rect x="306" y="96" width="9" height="9" rx="2.5" transform="rotate(-18 310 100)" fill={PAL.violet} stroke={PAL.ink} strokeWidth="2" />
      <circle cx="24" cy="66" r="5" fill={PAL.coral} stroke={PAL.ink} strokeWidth="2" />
      <path d="M284 170c6-6 12 2 18-4" stroke={PAL.ink} strokeWidth="3" />
      <path d="M30 160c6-6 12 2 18-4" stroke={PAL.violet} strokeWidth="3.5" />
    </svg>
  );
}

// ───────────────────────── confettis

const CONFETTI_COLORS = [PAL.orange, PAL.yellow, PAL.mint, PAL.violet, PAL.coral, PAL.sky];

/** Pluie de confettis brève (≈ 2 s, une seule fois). Masquée si l'utilisateur limite les animations. */
export function Confetti({ count = 30 }: { count?: number }) {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        // Répartition pseudo-aléatoire mais stable : pas de saut entre deux rendus.
        const x = (i * 37) % 100;
        const drift = ((i * 53) % 60) - 30;
        const turn = 180 + ((i * 71) % 540);
        const delay = (i % 6) * 0.07;
        const shape = i % 3;
        return (
          <i
            key={i}
            className={`cf cf-${shape}`}
            style={
              {
                left: `${x}%`,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDelay: `${delay}s`,
                '--drift': `${drift}px`,
                '--turn': `${turn}deg`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
