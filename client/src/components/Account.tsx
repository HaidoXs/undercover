import { CircleUserRound, Eye, EyeOff, KeyRound, Link2, LogIn, LogOut, Mail, MailCheck, Moon, ShieldCheck, Sun, UserPlus } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { setThemePref, useTheme } from '../lib/theme';
import { afterSignIn, authClient, authError, pushPrefs, refreshAccount, signOut, useAccount } from '../net/account';
import { session } from '../net/session';
import { toast } from '../state/store';
import { cls } from '../lib/util';
import { FormError, Spinner } from './Chrome';
import { Sheet } from './Sheet';

// ───────────────────────── thème clair / sombre

export function ThemeToggle() {
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const label = theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre';
  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => {
        setThemePref(next);
        pushPrefs();
      }}
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

// ───────────────────────── bouton et fenêtre de compte

export function AccountButton() {
  const account = useAccount();
  const [open, setOpen] = useState(false);
  if (!account.config?.accounts) return null;
  const signedIn = account.status === 'signed-in';
  const label = signedIn ? 'Mon compte' : 'Se connecter (facultatif)';
  return (
    <>
      <button type="button" className={cls('icon-btn', signedIn && 'is-signed-in')} aria-label={label} title={label} onClick={() => setOpen(true)}>
        {signedIn ? <ShieldCheck size={20} /> : <CircleUserRound size={20} />}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={signedIn ? 'Mon compte' : 'Compte (facultatif)'} icon={<CircleUserRound size={20} />}>
        <AccountPanel onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

/**
 * Encart de l'accueil : la connexion (facultative) bien visible, sous les boutons de jeu.
 * Connecté : rappel que le profil et les réglages sont sauvegardés.
 */
export function HomeAccountCard() {
  const account = useAccount();
  const [open, setOpen] = useState(false);
  const config = account.config;
  if (!config?.accounts || account.status === 'loading') return null;
  const signedIn = account.status === 'signed-in';
  if (!signedIn && !config.google && !config.email) return null;
  const name = account.view?.profile?.name;

  return (
    <section className={cls('home-account', signedIn && 'is-in')} aria-labelledby="home-account-title">
      {signedIn ? (
        <div className="home-account-in">
          <span className="home-account-badge" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          <p className="grow" id="home-account-title">
            <strong>Connecté{name ? ` : ${name}` : ''}</strong>
            <span>Ton pseudo, ton avatar et tes réglages sont sauvegardés.</span>
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
            Mon compte
          </button>
        </div>
      ) : (
        <>
          <p className="home-account-title" id="home-account-title">
            Garde ton profil d’un appareil à l’autre
          </p>
          <p className="home-account-sub">Facultatif : pseudo, avatar, photo et réglages sauvegardés. Tu peux jouer sans compte.</p>
          <div className="home-account-actions">
            {config.google && <GoogleButton />}
            {config.email && (
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen(true)}>
                <Mail size={17} /> {config.google ? 'Ou par e-mail' : 'Se connecter par e-mail'}
              </button>
            )}
          </div>
        </>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={signedIn ? 'Mon compte' : 'Compte (facultatif)'} icon={<CircleUserRound size={20} />}>
        <AccountPanel onDone={() => setOpen(false)} />
      </Sheet>
    </section>
  );
}

type Mode = 'signin' | 'signup' | 'forgot' | 'check-mail' | 'reset-sent';

/** Adresse de retour : on revient là où l'on était (le salon en cours reste le même). */
function here(flag: string): string {
  return `${window.location.pathname}?compte=${flag}`;
}

export function AccountPanel({ onDone }: { onDone: () => void }) {
  const account = useAccount();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');

  // En attente de la confirmation de l'adresse (ouverte dans un autre onglet) : on détecte la connexion.
  useEffect(() => {
    if (mode !== 'check-mail') return;
    const id = window.setInterval(() => void refreshAccount(), 4000);
    return () => window.clearInterval(id);
  }, [mode]);

  useEffect(() => {
    if (mode === 'check-mail' && account.status === 'signed-in') {
      void afterSignIn();
      toast('Adresse confirmée : tu es connecté !', 'success');
      onDone();
    }
  }, [mode, account.status, onDone]);

  if (!account.config) return <Spinner />;
  if (account.status === 'signed-in' && account.view) return <SignedIn onDone={onDone} />;

  return (
    <div className="stack">
      <p className="muted">
        Le compte est <strong>facultatif</strong> : il garde ton pseudo, ton avatar et tes réglages d’un appareil à l’autre. Tu peux toujours jouer
        sans. Te connecter en pleine partie ne change rien à ta place.
      </p>
      {account.config.google && <GoogleButton />}
      {account.config.google && account.config.email && <p className="or-sep">ou avec ton adresse e-mail</p>}
      {!account.config.email && (
        <p className="notice notice-muted">
          <Mail size={18} /> Inscription par e-mail indisponible sur ce serveur (aucun envoi d’e-mail configuré).
        </p>
      )}
      {account.config.email && account.config.emailDevMode && (
        <p className="notice notice-amber">
          <Mail size={18} /> Mode développement : les e-mails de confirmation s’affichent dans le terminal du serveur.
        </p>
      )}
      {account.config.email && mode === 'signin' && <SignInForm email={email} setEmail={setEmail} setMode={setMode} onDone={onDone} />}
      {account.config.email && mode === 'signup' && <SignUpForm email={email} setEmail={setEmail} setMode={setMode} />}
      {account.config.email && mode === 'forgot' && <ForgotForm email={email} setEmail={setEmail} setMode={setMode} />}
      {mode === 'check-mail' && (
        <div className="notice notice-mint" role="status">
          <MailCheck size={18} />
          <span>
            Un lien de confirmation a été envoyé à <strong>{email}</strong> (valable une heure). Ouvre-le : cette fenêtre se mettra à jour toute seule.
          </span>
        </div>
      )}
      {mode === 'reset-sent' && (
        <div className="notice notice-mint" role="status">
          <MailCheck size={18} />
          <span>Si un compte existe pour cette adresse, un lien de réinitialisation valable une heure vient d’être envoyé.</span>
        </div>
      )}
      {(mode === 'check-mail' || mode === 'reset-sent') && (
        <button type="button" className="btn btn-quiet btn-block" onClick={() => setMode('signin')}>
          Retour à la connexion
        </button>
      )}
    </div>
  );
}

function GoogleButton({ link }: { link?: boolean }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const res = link
      ? await authClient.linkSocial({ provider: 'google', callbackURL: here('lie'), errorCallbackURL: window.location.pathname })
      : await authClient.signIn.social({ provider: 'google', callbackURL: here('google'), errorCallbackURL: window.location.pathname });
    if (res?.error) {
      setBusy(false);
      toast(authError(res.error), 'warn');
    }
  };
  return (
    <button type="button" className="btn btn-secondary btn-block google-btn" onClick={go} disabled={busy}>
      {busy ? <Spinner /> : <GoogleMark />} {link ? 'Lier mon compte Google' : 'Continuer avec Google'}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function PasswordField({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="input-wrap">
      <input
        id={id}
        className="input"
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        minLength={8}
        maxLength={128}
        required
      />
      <button type="button" className="input-action" onClick={() => setShown((v) => !v)} aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
        {shown ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

interface FormProps {
  email: string;
  setEmail: (v: string) => void;
  setMode: (m: Mode) => void;
}

function SignInForm({ email, setEmail, setMode, onDone }: FormProps & { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailId = useId();
  const passId = useId();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await authClient.signIn.email({ email: email.trim(), password, callbackURL: here('verifie') });
    setBusy(false);
    if (res.error) {
      if (res.error.code === 'EMAIL_NOT_VERIFIED') setMode('check-mail');
      setError(authError(res.error));
      return;
    }
    await afterSignIn();
    toast('Connexion réussie.', 'success');
    onDone();
  };
  return (
    <form className="stack-sm" onSubmit={submit}>
      <label className="label" htmlFor={emailId}>
        Adresse e-mail
      </label>
      <input id={emailId} className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={254} />
      <label className="label" htmlFor={passId}>
        Mot de passe
      </label>
      <PasswordField id={passId} value={password} onChange={setPassword} autoComplete="current-password" />
      <FormError message={error} />
      <button type="submit" className="btn btn-primary btn-block" disabled={busy || !email || password.length < 8}>
        {busy ? <Spinner /> : <LogIn size={19} />} Se connecter
      </button>
      <div className="row-between account-links">
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setMode('forgot')}>
          <KeyRound size={16} /> Mot de passe oublié ?
        </button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setMode('signup')}>
          <UserPlus size={16} /> Créer un compte
        </button>
      </div>
    </form>
  );
}

function SignUpForm({ email, setEmail, setMode }: FormProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailId = useId();
  const passId = useId();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Nom interne du compte : jamais montré aux autres joueurs (le pseudo de jeu est dans le profil).
    const name = session.getProfile()?.name ?? 'Joueur';
    const res = await authClient.signUp.email({ email: email.trim(), password, name, callbackURL: here('verifie') });
    setBusy(false);
    if (res.error) {
      setError(authError(res.error));
      return;
    }
    setMode('check-mail');
  };
  return (
    <form className="stack-sm" onSubmit={submit}>
      <label className="label" htmlFor={emailId}>
        Adresse e-mail
      </label>
      <input id={emailId} className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={254} />
      <label className="label" htmlFor={passId}>
        Mot de passe (8 caractères minimum)
      </label>
      <PasswordField id={passId} value={password} onChange={setPassword} autoComplete="new-password" />
      <p className="form-hint">Ton adresse reste privée : elle n’est jamais montrée aux autres joueurs.</p>
      <FormError message={error} />
      <button type="submit" className="btn btn-primary btn-block" disabled={busy || !email || password.length < 8}>
        {busy ? <Spinner /> : <UserPlus size={19} />} Créer mon compte
      </button>
      <button type="button" className="btn btn-quiet btn-block" onClick={() => setMode('signin')}>
        J’ai déjà un compte
      </button>
    </form>
  );
}

function ForgotForm({ email, setEmail, setMode }: FormProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailId = useId();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: `${window.location.origin}/reinitialiser` });
    setBusy(false);
    if (res.error) {
      setError(authError(res.error));
      return;
    }
    setMode('reset-sent');
  };
  return (
    <form className="stack-sm" onSubmit={submit}>
      <p className="muted">Indique ton adresse : tu recevras un lien pour choisir un nouveau mot de passe.</p>
      <label className="label" htmlFor={emailId}>
        Adresse e-mail
      </label>
      <input id={emailId} className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={254} />
      <FormError message={error} />
      <button type="submit" className="btn btn-primary btn-block" disabled={busy || !email}>
        {busy ? <Spinner /> : <Mail size={19} />} Envoyer le lien
      </button>
      <button type="button" className="btn btn-quiet btn-block" onClick={() => setMode('signin')}>
        Retour
      </button>
    </form>
  );
}

function SignedIn({ onDone }: { onDone: () => void }) {
  const account = useAccount();
  const view = account.view;
  if (!view) return null;
  const hasGoogle = view.providers.includes('google');
  return (
    <div className="stack">
      <div className="account-card">
        <ShieldCheck size={22} aria-hidden="true" />
        <div className="grow">
          <p className="account-email">{view.user.email}</p>
          <p className="subtle">Adresse privée, jamais visible par les autres joueurs.</p>
        </div>
      </div>
      <ul className="account-methods">
        <li>
          <Mail size={17} /> E-mail et mot de passe : {view.providers.includes('credential') ? <strong>activé</strong> : 'non utilisé'}
        </li>
        <li>
          <GoogleMark /> Google : {hasGoogle ? <strong>lié</strong> : 'non lié'}
        </li>
      </ul>
      {account.config?.google && !hasGoogle && (
        <>
          <GoogleButton link />
          <p className="form-hint">
            <Link2 size={15} /> La liaison se fait seulement depuis ton compte connecté, et avec la même adresse que ton compte Google.
          </p>
        </>
      )}
      <p className="muted">
        Ton pseudo, ton avatar et tes réglages (thème, musique, sons) sont enregistrés sur ce compte.
        {view.profile ? (
          <>
            {' '}
            Pseudo actuel : <strong>{view.profile.name}</strong>.
          </>
        ) : null}
      </p>
      <button
        type="button"
        className="btn btn-danger btn-block"
        onClick={async () => {
          await signOut();
          onDone();
        }}
      >
        <LogOut size={18} /> Se déconnecter
      </button>
    </div>
  );
}

// ───────────────────────── page de réinitialisation (lien reçu par e-mail)

export function ResetPasswordScreen({ onHome }: { onHome: () => void }) {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const invalid = params.get('error') !== null || !token;
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const passId = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    const res = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (res.error) setError(authError(res.error));
    else setDone(true);
  };

  return (
    <div className="shell">
      <div className="page-head enter">
        <h1 className="grow page-title">Nouveau mot de passe</h1>
      </div>
      <div className="card card-feature stack enter-2">
        {invalid ? (
          <>
            <p className="notice notice-amber">
              <KeyRound size={18} /> Ce lien est invalide ou a expiré (il est valable une heure). Demande un nouveau lien depuis « Mot de passe
              oublié ».
            </p>
            <button type="button" className="btn btn-primary btn-block" onClick={onHome}>
              Retour à l’accueil
            </button>
          </>
        ) : done ? (
          <>
            <p className="notice notice-mint" role="status">
              <MailCheck size={18} /> Mot de passe modifié. Tes autres sessions ont été déconnectées : reconnecte-toi avec le nouveau mot de passe.
            </p>
            <button type="button" className="btn btn-primary btn-block" onClick={onHome}>
              Retour à l’accueil
            </button>
          </>
        ) : (
          <form className="stack-sm" onSubmit={submit}>
            <label className="label" htmlFor={passId}>
              Nouveau mot de passe (8 caractères minimum)
            </label>
            <PasswordField id={passId} value={password} onChange={setPassword} autoComplete="new-password" />
            <FormError message={error} />
            <button type="submit" className="btn btn-primary btn-block" disabled={busy || password.length < 8}>
              {busy ? <Spinner /> : <KeyRound size={19} />} Enregistrer
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
