import {
  AudioLines,
  Clapperboard,
  Crosshair,
  Drama,
  HeartHandshake,
  PartyPopper,
  Sandwich,
  Scale,
  Undo2,
  Wind,
  Gamepad2,
  Ghost,
  Lamp,
  MicVocal,
  PawPrint,
  Pizza,
  Plane,
  Sparkles,
  Swords,
  Users,
  VenetianMask,
  Volleyball,
  type LucideIcon,
} from 'lucide-react';
import type { SpecialRoleId } from '../../../shared/specialRoles';
import type { Role } from '../../../shared/types';

/** Icônes des packs (nom kebab-case défini côté serveur). Ajouter ici l'icône d'un nouveau pack. */
const PACK_ICONS: Record<string, LucideIcon> = {
  swords: Swords,
  'mic-vocal': MicVocal,
  'audio-lines': AudioLines,
  clapperboard: Clapperboard,
  'gamepad-2': Gamepad2,
  volleyball: Volleyball,
  pizza: Pizza,
  'paw-print': PawPrint,
  lamp: Lamp,
  plane: Plane,
};

export function packIcon(name: string): LucideIcon {
  return PACK_ICONS[name] ?? Sparkles;
}

export const ROLE_ICON: Record<Role, LucideIcon> = {
  civil: Users,
  undercover: VenetianMask,
  mrwhite: Ghost,
};

export const SPECIAL_ICON: Record<SpecialRoleId, LucideIcon> = {
  justice: Scale,
  lovers: HeartHandshake,
  meme: Drama,
  avenger: Crosshair,
  duelists: Swords,
  ghost: Wind,
  falafel: Sandwich,
  boomerang: Undo2,
  joyfool: PartyPopper,
};
