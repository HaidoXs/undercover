export type AvatarPattern = 'dots' | 'stripes' | 'waves' | 'grid' | 'diagonal' | 'rings' | 'zigzag' | 'checks';

export interface AvatarDef {
  icon: string;
  label: string;
  color: string;
  pattern: AvatarPattern;
}

/**
 * Chaque avatar combine une silhouette unique, une couleur et un motif :
 * on peut toujours les distinguer sans se fier à la couleur.
 */
export const AVATARS: readonly AvatarDef[] = [
  { icon: 'cat', label: 'Chat', color: '#a78bfa', pattern: 'dots' },
  { icon: 'bird', label: 'Oiseau', color: '#5eead4', pattern: 'stripes' },
  { icon: 'fish', label: 'Poisson', color: '#7dd3fc', pattern: 'waves' },
  { icon: 'rabbit', label: 'Lapin', color: '#f9a8d4', pattern: 'grid' },
  { icon: 'squirrel', label: 'Écureuil', color: '#fcd34d', pattern: 'diagonal' },
  { icon: 'turtle', label: 'Tortue', color: '#6ee7b7', pattern: 'rings' },
  { icon: 'snail', label: 'Escargot', color: '#fda4af', pattern: 'zigzag' },
  { icon: 'dog', label: 'Chien', color: '#a5b4fc', pattern: 'checks' },
  { icon: 'panda', label: 'Panda', color: '#bef264', pattern: 'rings' },
  { icon: 'ghost', label: 'Fantôme', color: '#ddd6fe', pattern: 'waves' },
  { icon: 'rocket', label: 'Fusée', color: '#fdba74', pattern: 'stripes' },
  { icon: 'gem', label: 'Gemme', color: '#67e8f9', pattern: 'diagonal' },
  { icon: 'flame', label: 'Flamme', color: '#fca5a5', pattern: 'dots' },
  { icon: 'moon', label: 'Lune', color: '#fde68a', pattern: 'grid' },
  { icon: 'clover', label: 'Trèfle', color: '#86efac', pattern: 'checks' },
  { icon: 'anchor', label: 'Ancre', color: '#93c5fd', pattern: 'zigzag' },
];
