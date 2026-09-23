export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const MR_WHITE_MIN_PLAYERS = 5;

export const NAME_MIN = 2;
export const NAME_MAX = 16;
export const CLUE_MAX = 30;
export const GUESS_MAX = 40;

/** Pas de 0/O, 1/I/L : lisible à l'oral comme à l'écrit. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export const CLUE_SECONDS_OPTIONS = [20, 30, 45, 60, 90] as const;
export const VOTE_SECONDS_OPTIONS = [30, 45, 60, 90, 120] as const;

export const AVATAR_COUNT = 16;

/** Tours d'indices joués avant chaque vote. */
export const CLUE_ROUNDS_MIN = 1;
export const CLUE_ROUNDS_MAX = 5;

/** Photo d'avatar importée : taille maximale du fichier d'origine et côté de l'image réencodée. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_SIZE = 256;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
