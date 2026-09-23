import { MAX_PLAYERS, MIN_PLAYERS, MR_WHITE_MIN_PLAYERS } from './constants';
import { specialRolesError } from './specialRoles';
import type { Settings } from './types';

export interface Composition {
  civils: number;
  undercovers: number;
  mrWhite: number;
}

export function compositionFor(settings: Settings, players: number): Composition {
  const mrWhite = settings.mrWhite ? 1 : 0;
  return {
    civils: players - settings.undercoverCount - mrWhite,
    undercovers: settings.undercoverCount,
    mrWhite,
  };
}

/** Nombre maximal d'intrus (Undercover + Mr. White) pour que les Civils restent strictement majoritaires. */
export function maxIntruders(players: number): number {
  return Math.max(0, Math.floor((players - 1) / 2));
}

/**
 * Règle de composition, appliquée à l'identique par le serveur (au lancement)
 * et par l'interface (pour expliquer pourquoi le lancement est bloqué).
 */
export function compositionError(settings: Settings, players: number): string | null {
  if (players < MIN_PLAYERS) {
    return `Il faut au moins ${MIN_PLAYERS} joueurs présents pour lancer une manche.`;
  }
  if (players > MAX_PLAYERS) {
    return `Une manche accepte au plus ${MAX_PLAYERS} joueurs.`;
  }
  if (!Number.isInteger(settings.undercoverCount) || settings.undercoverCount < 0) {
    return "Nombre d'Undercover invalide.";
  }
  if (settings.mrWhite && players < MR_WHITE_MIN_PLAYERS) {
    return `Mr. White n'est disponible qu'à partir de ${MR_WHITE_MIN_PLAYERS} joueurs.`;
  }
  const { civils, undercovers, mrWhite } = compositionFor(settings, players);
  const intruders = undercovers + mrWhite;
  if (intruders < 1) {
    return 'Il faut au moins un intrus (Undercover ou Mr. White).';
  }
  if (civils <= intruders) {
    return `Trop d'intrus pour ${players} joueurs : les Civils doivent être strictement majoritaires.`;
  }
  return null;
}

export function settingsError(settings: Settings, players: number): string | null {
  if (settings.packIds.length === 0) return 'Sélectionne au moins un pack de mots.';
  return compositionError(settings, players) ?? specialRolesError(settings.specialRoles, players);
}
