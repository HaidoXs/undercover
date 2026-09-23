import { MAX_PLAYERS, NAME_MAX, NAME_MIN } from '../../shared/constants';
import type { ErrorCode } from '../../shared/types';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: 'Requête invalide.',
  RATE_LIMITED: 'Doucement ! Trop de tentatives, réessaie dans quelques secondes.',
  CODE_INVALID: 'Un code de salon comporte 6 caractères (lettres et chiffres).',
  ROOM_NOT_FOUND: 'Aucun salon ne correspond à ce code. Vérifie-le auprès de l’hôte.',
  ROOM_EXPIRED: 'Ce salon a expiré ou a été fermé. Lance une nouvelle partie !',
  ROOM_FULL: `Ce salon est complet (${MAX_PLAYERS} joueurs maximum).`,
  NAME_INVALID: `Ton pseudo doit faire entre ${NAME_MIN} et ${NAME_MAX} caractères.`,
  NAME_TAKEN: 'Ce pseudo est déjà pris dans ce salon.',
  SESSION_INVALID: 'Ta place dans ce salon n’est plus disponible.',
  NOT_IN_ROOM: 'Tu ne fais partie d’aucun salon.',
  NOT_HOST: 'Seul l’hôte peut faire ça.',
  WRONG_PHASE: 'Trop tard : la partie est passée à l’étape suivante.',
  STALE_ACTION: 'Cette action n’est plus valable : la partie a avancé.',
  NOT_YOUR_TURN: 'Ce n’est pas ton tour.',
  NOT_ACTIVE: 'Tu ne participes pas à cette étape de la manche.',
  ALREADY_DONE: 'C’est déjà fait : une seule action est permise.',
  INVALID_TARGET: 'Ce joueur ne peut pas être visé.',
  SELF_VOTE: 'Tu ne peux pas voter contre toi-même.',
  TEXT_INVALID: 'Texte vide ou trop long.',
  CLUE_IS_WORD: 'Interdit de donner ton mot ! Trouve un indice plus subtil.',
  NOT_READY: 'Tous les joueurs présents doivent être prêts.',
  CONFIG_INVALID: 'Configuration invalide.',
  NO_PACK: 'Sélectionne au moins un pack de mots.',
  SETTINGS_LOCKED: 'Les paramètres sont verrouillés pendant la manche.',
  NO_THEME: 'Aucun thème précis n’est disponible dans les packs sélectionnés.',
  PHOTO_INVALID: 'Cette photo n’est pas disponible pour ton profil.',
  INTERNAL: 'Erreur inattendue du serveur. Réessaie.',
};

export class GameError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? ERROR_MESSAGES[code]);
  }
}
