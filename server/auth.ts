import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { fromNodeHeaders } from 'better-auth/node';
import { LibsqlDialect } from '@libsql/kysely-libsql';
import type { IncomingHttpHeaders } from 'node:http';
import { actionMail, type Mailer } from './mail';
import type { Db } from './storage/db';

export interface AuthConfig {
  db: Db;
  /** Adresse publique du site (ex. https://undercover.example), utilisée dans les liens et pour Google. */
  baseURL: string;
  secret: string;
  mailer: Mailer;
  google: { clientId: string; clientSecret: string } | null;
  trustedOrigins: string[];
  trustProxy: boolean;
}

/** En-tête interne portant l'adresse du client, toujours réécrit par le serveur (jamais celui du navigateur). */
export const CLIENT_IP_HEADER = 'x-undercover-client-ip';

/**
 * Comptes facultatifs, gérés par Better Auth (bibliothèque éprouvée) :
 * mots de passe hachés (scrypt), sessions en cookie httpOnly, vérification de l'e-mail obligatoire,
 * lien de réinitialisation valable une heure, limitation des tentatives, connexion Google.
 * Aucune fusion implicite : un compte Google dont l'adresse existe déjà doit être lié depuis le compte connecté.
 */

export async function createAuth(config: AuthConfig) {
  const { mailer } = config;
  const options = {
    appName: 'Undercover',
    baseURL: config.baseURL,
    basePath: '/api/auth',
    secret: config.secret,
    // Même base et même connexion libSQL que le reste (fichier local ou Turso), via Kysely. Le dialecte embarque
    // une version plus ancienne du client, dont il n'utilise que execute, transaction et close, identiques ici.
    database: { dialect: new LibsqlDialect({ client: config.db.client as never }), type: 'sqlite' as const },
    trustedOrigins: config.trustedOrigins,
    emailAndPassword: {
      enabled: mailer.enabled,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await mailer.send(
          actionMail(
            user.email,
            'Undercover — réinitialiser ton mot de passe',
            'Tu as demandé à changer le mot de passe de ton compte Undercover.',
            'Choisir un nouveau mot de passe',
            url,
            'Ce lien est valable une heure et ne sert qu’une fois. Si tu n’es pas à l’origine de la demande, ignore ce message.',
          ),
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await mailer.send(
          actionMail(
            user.email,
            'Undercover — confirme ton adresse e-mail',
            'Bienvenue ! Confirme ton adresse pour activer ton compte Undercover.',
            'Confirmer mon adresse',
            url,
            'Ce lien est valable une heure. Si tu n’as pas créé de compte, ignore ce message.',
          ),
        );
      },
    },
    socialProviders: config.google
      ? { google: { clientId: config.google.clientId, clientSecret: config.google.clientSecret, prompt: 'select_account' } }
      : {},
    account: {
      accountLinking: {
        enabled: true,
        // Jamais de fusion sur la seule correspondance d'adresse : la liaison se fait depuis le compte connecté.
        disableImplicitLinking: true,
        requireLocalEmailVerified: true,
        allowDifferentEmails: false,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 10 * 60, max: 5 },
        '/request-password-reset': { window: 15 * 60, max: 3 },
        '/send-verification-email': { window: 15 * 60, max: 3 },
        '/reset-password': { window: 15 * 60, max: 5 },
        '/sign-in/social': { window: 60, max: 10 },
      },
    },
    advanced: {
      // Limitation par adresse : l'adresse vient de la connexion (ou du proxy de confiance), jamais d'un en-tête choisi par le client.
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
      useSecureCookies: config.baseURL.startsWith('https://'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' as const },
    },
  } satisfies BetterAuthOptions;

  // Tables créées ou complétées avant l'initialisation (aucune erreur de schéma au premier démarrage).
  const { runMigrations } = await getMigrations(options);
  await runMigrations();
  return betterAuth(options);
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;

export interface SessionUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

/** Utilisateur connecté d'après les cookies d'une requête (HTTP ou poignée de main Socket.IO). */
export async function sessionUser(auth: Auth | null, headers: IncomingHttpHeaders): Promise<SessionUser | null> {
  if (!auth || !headers.cookie) return null;
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(headers) });
    if (!session?.user) return null;
    return { id: session.user.id, email: session.user.email, emailVerified: session.user.emailVerified };
  } catch {
    return null;
  }
}
