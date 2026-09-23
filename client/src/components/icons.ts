import {
  Anchor,
  AudioLines,
  Bird,
  Cat,
  Clapperboard,
  Clover,
  Dog,
  Fish,
  Flame,
  Gamepad2,
  Gem,
  Ghost,
  Lamp,
  MicVocal,
  Moon,
  Panda,
  PawPrint,
  Pizza,
  Plane,
  Rabbit,
  Rocket,
  Snail,
  Sparkles,
  Squirrel,
  Swords,
  Turtle,
  Users,
  VenetianMask,
  Volleyball,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '../../../shared/types';

export const AVATAR_ICONS: Record<string, LucideIcon> = {
  cat: Cat,
  bird: Bird,
  fish: Fish,
  rabbit: Rabbit,
  squirrel: Squirrel,
  turtle: Turtle,
  snail: Snail,
  dog: Dog,
  panda: Panda,
  ghost: Ghost,
  rocket: Rocket,
  gem: Gem,
  flame: Flame,
  moon: Moon,
  clover: Clover,
  anchor: Anchor,
};

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
