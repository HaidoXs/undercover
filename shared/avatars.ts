export type AvatarPattern = 'dots' | 'stripes' | 'waves' | 'grid' | 'diagonal' | 'rings' | 'zigzag' | 'checks';

export interface AvatarDef {
  /** Personnage dessiné (voir client/src/components/Avatar.tsx). */
  icon: string;
  label: string;
  /** Couleur du fond de la pastille. */
  color: string;
  pattern: AvatarPattern;
}

/**
 * Seize personnages originaux, chacun avec sa silhouette, son expression, sa couleur et son motif de fond :
 * on peut toujours les distinguer sans se fier à la couleur. L'index est ce qui est enregistré.
 */
export const AVATARS: readonly AvatarDef[] = [
  { icon: 'chat', label: 'Chat rusé', color: '#a78bfa', pattern: 'dots' },
  { icon: 'poussin', label: 'Poussin étonné', color: '#7dd3fc', pattern: 'stripes' },
  { icon: 'grenouille', label: 'Grenouille rieuse', color: '#fcd34d', pattern: 'waves' },
  { icon: 'lapin', label: 'Lapin timide', color: '#f9a8d4', pattern: 'grid' },
  { icon: 'renard', label: 'Renard complice', color: '#5eead4', pattern: 'diagonal' },
  { icon: 'ours', label: 'Ours ravi', color: '#fdba74', pattern: 'rings' },
  { icon: 'panda', label: 'Panda zen', color: '#bef264', pattern: 'zigzag' },
  { icon: 'hibou', label: 'Hibou soupçonneux', color: '#fda4af', pattern: 'checks' },
  { icon: 'pieuvre', label: 'Pieuvre farceuse', color: '#a5b4fc', pattern: 'rings' },
  { icon: 'fantome', label: 'Fantôme surpris', color: '#c4b5fd', pattern: 'waves' },
  { icon: 'robot', label: 'Robot déterminé', color: '#fde68a', pattern: 'grid' },
  { icon: 'alien', label: 'Extraterrestre curieux', color: '#f0abfc', pattern: 'stripes' },
  { icon: 'dino', label: 'Dinosaure fier', color: '#93c5fd', pattern: 'diagonal' },
  { icon: 'pingouin', label: 'Pingouin sérieux', color: '#86efac', pattern: 'dots' },
  { icon: 'raton', label: 'Raton laveur espiègle', color: '#fca5a5', pattern: 'checks' },
  { icon: 'licorne', label: 'Licorne rêveuse', color: '#67e8f9', pattern: 'zigzag' },
];
