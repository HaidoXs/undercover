import { MIN_PLAYERS } from './constants';

export type SpecialRoleId =
  | 'justice'
  | 'lovers'
  | 'meme'
  | 'avenger'
  | 'duelists'
  | 'ghost'
  | 'falafel'
  | 'boomerang'
  | 'joyfool';

export interface SpecialRoleDef {
  id: SpecialRoleId;
  name: string;
  /** Nom d'icône Lucide (voir client/src/components/icons.ts). */
  icon: string;
  /** Résumé d'une ligne pour la carte du salon. */
  tagline: string;
  power: string;
  objective: string;
  victory: string;
  restrictions: string[];
  minPlayers: number;
  /** Nombre de joueurs occupés par ce rôle (un joueur ne porte qu'un rôle spécial). */
  slots: number;
}

/** Délai laissé à la Justice et à la Vengeuse pour décider. */
export const POWER_SECONDS = 15;

export const SPECIAL_ROLES: readonly SpecialRoleDef[] = [
  {
    id: 'justice',
    name: 'Déesse de la Justice',
    icon: 'scale',
    tagline: 'Identité publique. Elle tranche les égalités.',
    power:
      'En cas d’égalité en tête d’un scrutin, c’est elle qui choisit l’éliminé parmi les ex æquo, même après sa propre élimination.',
    objective: 'Faire gagner son camp de départ (Civil, Undercover ou Mr. White).',
    victory: 'Gagne avec son camp.',
    restrictions: [
      'Son identité est connue de tous dès le début.',
      'Elle ne peut choisir qu’un joueur à égalité.',
      `Sans réponse après ${POWER_SECONDS} secondes, le second scrutin habituel a lieu.`,
    ],
    minPlayers: MIN_PLAYERS,
    slots: 1,
  },
  {
    id: 'lovers',
    name: 'Les Amoureux',
    icon: 'heart-handshake',
    tagline: 'Deux joueurs liés en secret, pour le meilleur et pour le pire.',
    power:
      'Le serveur lie deux joueurs, parfois de camps différents. Chacun connaît l’identité de l’autre, mais ni son camp ni son mot. Si l’un est éliminé, l’autre l’est aussi.',
    objective: 'Survivre ensemble. Cet objectif remplace celui de leur camp de départ.',
    victory:
      'S’ils sont les deux derniers joueurs vivants, ils gagnent seuls et la manche s’arrête aussitôt. Si un camp gagne avant, le couple a perdu.',
    restrictions: ['5 joueurs minimum.', 'Le couple est formé par le serveur : pas de Cupidon.'],
    minPlayers: 5,
    slots: 2,
  },
  {
    id: 'meme',
    name: 'Mr. Meme',
    icon: 'drama',
    tagline: 'À chaque tour, un joueur doit mimer son indice.',
    power:
      'À chaque tour d’indices, un joueur différent est désigné : il mime son indice sans parler, puis appuie sur « Mime terminé ».',
    objective: 'Le joueur désigné garde l’objectif de son camp.',
    victory: 'Gagne avec son camp.',
    restrictions: [
      'À activer seulement si les joueurs peuvent se voir.',
      'Désigné parmi les joueurs sans autre rôle spécial, jamais deux fois le même dans la manche.',
      'Si le temps s’écoule pendant le mime, le tour compte comme mimé (« Passé » si le joueur est déconnecté).',
    ],
    minPlayers: MIN_PLAYERS,
    slots: 1,
  },
  {
    id: 'avenger',
    name: 'La Vengeuse',
    icon: 'crosshair',
    tagline: 'Éliminée, elle peut emporter quelqu’un avec elle.',
    power: `Quand elle est éliminée, quelle qu’en soit la raison, elle dispose de ${POWER_SECONDS} secondes pour emporter un joueur encore en vie.`,
    objective: 'Faire gagner son camp de départ.',
    victory: 'Gagne avec son camp.',
    restrictions: [
      '5 joueurs minimum.',
      'Pouvoir utilisable une seule fois ; sans choix dans le délai, elle renonce.',
      'Le falafel protecteur ne bloque pas sa vengeance.',
    ],
    minPlayers: 5,
    slots: 1,
  },
  {
    id: 'duelists',
    name: 'Les Duellistes',
    icon: 'swords',
    tagline: 'Deux adversaires secrets : le premier éliminé perd le duel.',
    power: 'Deux joueurs s’affrontent en secret et connaissent l’identité de leur adversaire.',
    objective: 'Survivre plus longtemps que son adversaire, en plus de l’objectif de son camp.',
    victory:
      'Le survivant remporte le duel, annoncé à tous, sans mettre fin à la manche ni rapporter de points. Si les deux tombent pendant la même résolution, le duel est nul. Pour la manche, chacun gagne avec son camp.',
    restrictions: ['5 joueurs minimum.'],
    minPlayers: 5,
    slots: 2,
  },
  {
    id: 'ghost',
    name: 'Le Fantôme',
    icon: 'wind',
    tagline: 'Éliminé, il continue de discuter et de voter.',
    power: 'Après son élimination, il peut encore discuter et voter à chaque scrutin.',
    objective: 'Faire gagner son camp de départ.',
    victory: 'Gagne avec son camp.',
    restrictions: [
      'Une fois éliminé, il ne compte plus parmi les vivants, ne donne plus d’indice et ne peut plus être visé.',
      'Il ne reçoit aucun secret supplémentaire.',
    ],
    minPlayers: MIN_PLAYERS,
    slots: 1,
  },
  {
    id: 'falafel',
    name: 'Le Vendeur de Falafels',
    icon: 'sandwich',
    tagline: 'Offre un falafel mystère, protecteur ou piégé.',
    power:
      'Au début de la manche, il offre un falafel à un autre joueur. Le serveur tire l’effet en secret, à chances égales : protection (annule une élimination directe par scrutin) ou sabotage (le bénéficiaire ne peut pas voter au prochain tour de vote, second scrutin compris).',
    objective: 'Faire gagner son camp de départ.',
    victory: 'Gagne avec son camp.',
    restrictions: [
      '4 joueurs minimum.',
      'Effet unique, consommé après usage ; le bénéficiaire est prévenu en privé au moment utile.',
      'La protection ne bloque ni la Vengeuse ni le lien des Amoureux.',
    ],
    minPlayers: 4,
    slots: 1,
  },
  {
    id: 'boomerang',
    name: 'Le Boomerang',
    icon: 'undo-2',
    tagline: 'Une fois, les votes contre lui reviennent à l’envoyeur.',
    power:
      'La première fois qu’un scrutin le désigne, avant son élimination, chaque vote contre lui devient un vote contre son auteur. Le résultat est recalculé une seule fois, sans renvoi en chaîne.',
    objective: 'Faire gagner son camp de départ.',
    victory: 'Gagne avec son camp.',
    restrictions: [
      'Une seule utilisation par manche.',
      'Ne se déclenche que sur un résultat de vote (pas sur une décision de la Justice ni une vengeance).',
    ],
    minPlayers: MIN_PLAYERS,
    slots: 1,
  },
  {
    id: 'joyfool',
    name: 'Le Fou de joie',
    icon: 'party-popper',
    tagline: 'Il rêve de se faire éliminer dès la première phase de vote.',
    power: 'Il cherche à attirer les soupçons pour être éliminé au plus vite.',
    objective: 'Se faire éliminer lors de la première phase de vote de la manche ; sinon, l’objectif de son camp de départ.',
    victory:
      'Éliminé directement lors de la première phase de vote (second scrutin ou décision de la Justice compris), il gagne seul et la manche s’arrête — même si plusieurs tours d’indices l’ont précédée. S’il survit à cette phase, il gagne avec son camp.',
    restrictions: [
      'Seule la première phase de vote compte, quel que soit le réglage « Tours d’indices avant le vote ».',
      'Une mort par vengeance, par lien amoureux ou par déconnexion ne compte pas.',
      'Une protection de falafel l’empêche d’être éliminé.',
    ],
    minPlayers: MIN_PLAYERS,
    slots: 1,
  },
];

const BY_ID = new Map(SPECIAL_ROLES.map((r) => [r.id, r]));

export function specialRole(id: SpecialRoleId): SpecialRoleDef {
  return BY_ID.get(id) as SpecialRoleDef;
}

export function isSpecialRoleId(value: unknown): value is SpecialRoleId {
  return typeof value === 'string' && BY_ID.has(value as SpecialRoleId);
}

/** Ordre canonique et sans doublon. */
export function orderSpecialRoles(ids: readonly SpecialRoleId[]): SpecialRoleId[] {
  const wanted = new Set(ids);
  return SPECIAL_ROLES.filter((r) => wanted.has(r.id)).map((r) => r.id);
}

/** Vérifie qu'il y a assez de joueurs pour les rôles spéciaux activés (un rôle par joueur au maximum). */
export function specialRolesError(ids: readonly SpecialRoleId[], players: number): string | null {
  for (const id of ids) {
    const def = specialRole(id);
    if (players < def.minPlayers) return `${def.name} demande au moins ${def.minPlayers} joueurs.`;
  }
  const slots = ids.reduce((sum, id) => sum + specialRole(id).slots, 0);
  if (slots > players) {
    return `Pas assez de joueurs pour les rôles spéciaux choisis : ${slots} places nécessaires pour ${players} joueurs (un seul rôle spécial par joueur).`;
  }
  return null;
}
