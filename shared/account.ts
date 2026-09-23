/** Préférences personnelles, gardées sur l'appareil et, si le joueur est connecté, sur son compte. */
export interface Prefs {
  /** « system » : suit la préférence de l'appareil tant que le joueur n'a rien choisi. */
  theme: 'system' | 'light' | 'dark';
  music: boolean;
  sound: boolean;
}

export interface GameProfile {
  name: string;
  avatar: number;
  /** Identifiant de la photo importée, sinon null. */
  photo: string | null;
  photoUrl: string | null;
}

/** Réponse de /api/me : visible par son seul propriétaire (l'adresse n'est jamais montrée aux autres joueurs). */
export interface AccountView {
  user: { id: string; email: string; emailVerified: boolean };
  /** Méthodes de connexion liées : « credential » (e-mail + mot de passe), « google ». */
  providers: string[];
  profile: GameProfile | null;
  prefs: Prefs;
}

/** Fonctionnalités de compte réellement disponibles sur ce serveur. */
export interface AuthConfigView {
  accounts: boolean;
  /** Inscription par e-mail : un moyen d'envoi est configuré. */
  email: boolean;
  /** Développement : les e-mails sont affichés dans le terminal du serveur au lieu d'être envoyés. */
  emailDevMode: boolean;
  google: boolean;
}
