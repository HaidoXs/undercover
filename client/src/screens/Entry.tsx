import {
  ArrowLeft,
  CircleHelp,
  DoorOpen,
  Eye,
  House,
  Info,
  KeyRound,
  MessageSquareQuote,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Vote,
  WifiOff,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { BluffScene, GhostArt, MagnifierArt, MaskArt } from '../components/Illustrations';
import { AVATARS } from '../../../shared/avatars';
import { CODE_ALPHABET, CODE_LENGTH, MAX_PLAYERS, NAME_MAX, NAME_MIN } from '../../../shared/constants';
import { Avatar } from '../components/Avatar';
import { AvatarPicker } from '../components/AvatarPicker';
import { Brand, FormError, Spinner } from '../components/Chrome';
import { HelpContent } from '../components/Help';
import { SPECIAL_ROLES } from '../../../shared/specialRoles';
import { Sheet } from '../components/Sheet';
import { cls, submitOnEnter } from '../lib/util';
import { saveAccountProfile, useAccount } from '../net/account';
import { checkRoom, createRoom, fatalTitle, joinRoom, resumeSaved, resumeWithAccount } from '../net/controller';
import { discardGuestPhoto } from '../net/photos';
import { session, type ProfilePhoto } from '../net/session';
import { PhotoPicker } from '../components/PhotoPicker';
import { AccountButton, HomeAccountCard, ThemeToggle } from '../components/Account';
import { useApp, type Fatal } from '../state/store';
import { SoundToggle } from './Room';

// ───────────────────────── accueil

export function Home({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  const [help, setHelp] = useState(false);
  return (
    <div className="home">
      <div className="home-top">
        <SoundToggle />
        <ThemeToggle />
        <AccountButton />
      </div>
      <div className="shell">
        <header className="hero">
          <BluffScene className="hero-scene" />
          <p className="hero-kicker enter">
            <span>Bluff</span>
            <span>Indices</span>
            <span>Votes</span>
          </p>
          <h1 className="hero-title" aria-label="Undercover">
            {'Undercover'.split('').map((c, i) => (
              <span key={i} aria-hidden="true" style={{ '--i': i } as CSSProperties}>
                {c}
              </span>
            ))}
          </h1>
          <p className="hero-sub enter-2">Un mot secret, des indices à double sens et des intrus à démasquer entre amis.</p>
        </header>

        <div className="home-actions enter-2">
          <button type="button" className="btn btn-primary btn-xl" onClick={onCreate}>
            <span className="btn-icon" aria-hidden="true">
              <Sparkles size={22} />
            </span>
            <span className="btn-text">
              Créer une partie
              <small>Tu seras l’hôte du salon</small>
            </span>
          </button>
          <button type="button" className="btn btn-secondary btn-xl" onClick={onJoin}>
            <span className="btn-icon" aria-hidden="true">
              <DoorOpen size={22} />
            </span>
            <span className="btn-text">
              Rejoindre une partie
              <small>Avec un code ou un lien</small>
            </span>
          </button>
        </div>

        <div className="enter-3">
          <HomeAccountCard />
        </div>

        <ol className="home-steps enter-3" aria-label="Déroulement d’une manche">
          <li className="step">
            <span className="step-icon">
              <Eye size={18} />
            </span>
            <span>
              <strong>Découvre ton mot</strong> en secret
            </span>
          </li>
          <li className="step">
            <span className="step-icon">
              <MessageSquareQuote size={18} />
            </span>
            <span>
              <strong>Donne un indice</strong> sans te trahir
            </span>
          </li>
          <li className="step">
            <span className="step-icon">
              <Vote size={18} />
            </span>
            <span>
              <strong>Vote</strong> contre l’intrus
            </span>
          </li>
        </ol>

        <footer className="home-foot enter-3">
          <span className="row">
            <Users size={16} /> 3 à {MAX_PLAYERS} joueurs
          </span>
          <span aria-hidden="true">·</span>
          <span>Sans inscription</span>
          <span aria-hidden="true">·</span>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setHelp(true)}>
            <CircleHelp size={16} /> Comment jouer ?
          </button>
          <span className="home-legal">
            <a href="/confidentialite.html">Confidentialité</a> · <a href="/conditions.html">Conditions</a>
          </span>
        </footer>
      </div>
      <Sheet open={help} onClose={() => setHelp(false)} title="Comment jouer" icon={<CircleHelp size={20} />}>
        <HelpContent roles={SPECIAL_ROLES.map((r) => r.id)} rolesTitle="Rôles spéciaux (optionnels)" />
      </Sheet>
    </div>
  );
}

function PageHead({ onBack, title, children }: { onBack: () => void; title: string; children?: React.ReactNode }) {
  return (
    <div className="page-head enter">
      <button type="button" className="icon-btn" onClick={onBack} aria-label="Retour">
        <ArrowLeft size={20} />
      </button>
      <h1 className="grow page-title">{title}</h1>
      {children}
    </div>
  );
}

// ───────────────────────── saisie du code

function sanitizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((c) => CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, CODE_LENGTH);
}

export function JoinCode({ onBack, onFound }: { onBack: () => void; onFound: (code: string) => void }) {
  const conn = useApp((s) => s.conn);
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (code: string) => {
    if (code.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    const res = await checkRoom(code);
    setBusy(false);
    if (res.ok) {
      onFound(res.code);
      return;
    }
    setError(res.error.message);
    // Le champ a été désactivé pendant la recherche : on lui rend le focus pour corriger.
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onChange = (raw: string) => {
    // Champ plein : une nouvelle frappe recommence la saisie au lieu d'être ignorée.
    const fresh = value.length === CODE_LENGTH && raw.startsWith(value) ? raw.slice(CODE_LENGTH) : raw;
    const clean = sanitizeCode(fresh);
    const dropped = raw.replace(/[\s-]/g, '').length > clean.length && clean.length < CODE_LENGTH;
    setHint(dropped ? 'Les codes n’utilisent ni O, 0, I, 1 ni L : seulement des caractères sans ambiguïté.' : null);
    setValue(clean);
    setError(null);
    if (clean.length === CODE_LENGTH) void submit(clean);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(value);
  };

  return (
    <div className="shell">
      <PageHead onBack={onBack} title="Rejoindre une partie" />
      <form className="card card-feature stack enter-2" onSubmit={onSubmit} noValidate>
        <div className="form-intro">
          <MagnifierArt className="form-intro-art" size={64} />
          <div className="stack-xs">
            <h2 className="h3">Code du salon</h2>
            <p className="muted">Saisis les 6 caractères partagés par l’hôte, ou ouvre directement son lien d’invitation.</p>
          </div>
        </div>

        <div
          className={cls('code-field', focused && 'is-focused', error && 'is-invalid')}
          onClick={() => inputRef.current?.focus()}
        >
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={(e) => {
              setFocused(true);
              e.currentTarget.select();
            }}
            onBlur={() => setFocused(false)}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={12}
            aria-label="Code du salon, 6 caractères"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            disabled={busy}
          />
          {Array.from({ length: CODE_LENGTH }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={cls(
                'code-cell',
                value[i] && 'is-filled',
                (i === value.length || (value.length === CODE_LENGTH && i === CODE_LENGTH - 1)) && 'is-active',
              )}
            >
              {value[i] ?? ''}
            </span>
          ))}
        </div>

        {hint && !error && (
          <p className="form-hint">
            <Info size={15} /> {hint}
          </p>
        )}
        <FormError message={error} id={errorId} />
        {conn === 'offline' && (
          <p className="form-hint">
            <WifiOff size={15} /> Connexion au serveur en cours…
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={value.length !== CODE_LENGTH || busy}>
          {busy ? <Spinner /> : <Search size={20} />}
          {busy ? 'Recherche du salon…' : 'Trouver le salon'}
        </button>
      </form>
    </div>
  );
}

// ───────────────────────── profil (création ou arrivée)

function firstFree(preferred: number, taken: number[]): number {
  if (!taken.includes(preferred)) return preferred;
  return AVATARS.findIndex((_, i) => !taken.includes(i));
}

export function ProfileForm({
  mode,
  code,
  taken = [],
  playerCount,
  inProgress,
  mine,
  onBack,
}: {
  mode: 'create' | 'join';
  code?: string;
  taken?: number[];
  playerCount?: number;
  inProgress?: boolean;
  /** Le compte connecté a déjà une place dans ce salon. */
  mine?: boolean;
  onBack: () => void;
}) {
  const account = useAccount();
  // Profil du compte connecté en priorité, sinon celui mémorisé sur cet appareil.
  const accountProfile = account.view?.profile ?? null;
  const saved = accountProfile
    ? { name: accountProfile.name, avatar: accountProfile.avatar, photo: accountProfile.photo ? { id: accountProfile.photo, url: accountProfile.photoUrl ?? '', key: null } : null }
    : session.getProfile();
  const [name, setName] = useState(saved?.name ?? '');
  const [avatar, setAvatar] = useState(() =>
    firstFree(saved?.avatar ?? Math.floor(Math.random() * AVATARS.length), taken),
  );
  const [photo, setPhoto] = useState<ProfilePhoto | null>(saved?.photo ?? null);
  const [accountBusy, setAccountBusy] = useState(false);
  const dirty = useRef(false);

  // Compte chargé après l'ouverture du formulaire : on reprend son profil tant que rien n'a été modifié.
  useEffect(() => {
    if (!accountProfile || dirty.current) return;
    setName(accountProfile.name);
    setAvatar(firstFree(accountProfile.avatar, taken));
    setPhoto(accountProfile.photo ? { id: accountProfile.photo, url: accountProfile.photoUrl ?? '', key: null } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountProfile?.name, accountProfile?.avatar, accountProfile?.photo]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);
  const resume = code ? session.getSaved(code) : null;
  const nameId = useId();
  const errorId = useId();

  const trimmed = name.trim().replace(/\s+/g, ' ');
  const length = [...trimmed].length;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (length < NAME_MIN || length > NAME_MAX) {
      setError(`Ton pseudo doit faire entre ${NAME_MIN} et ${NAME_MAX} caractères.`);
      return;
    }
    setBusy(true);
    setError(null);
    const res = mode === 'create' ? await createRoom(trimmed, avatar, photo) : await joinRoom(code as string, trimmed, avatar, photo);
    if (!res.ok) {
      setBusy(false);
      setError(res.error.message);
      return;
    }
    void saveAccountProfile({ name: trimmed, avatar, photo: photo?.id ?? null, photoKey: photo?.key ?? null });
  };

  const changePhoto = (next: ProfilePhoto | null) => {
    dirty.current = true;
    if (photo && photo.id !== next?.id) discardGuestPhoto(photo);
    setPhoto(next);
    setError(null);
  };

  const onResumeAccount = async () => {
    if (!code) return;
    setAccountBusy(true);
    const res = await resumeWithAccount(code);
    if (!res.ok) {
      setAccountBusy(false);
      setError(res.error.message);
    }
  };

  const onResume = async () => {
    if (!code) return;
    setResumeBusy(true);
    const res = await resumeSaved(code);
    if (!res.ok) {
      setResumeBusy(false);
      setError(res.error.message);
    }
  };

  return (
    <div className="shell">
      <PageHead onBack={onBack} title={mode === 'create' ? 'Créer une partie' : 'Rejoindre le salon'}>
        {code && <span className="code-chip">{code}</span>}
      </PageHead>

      {mode === 'join' && (
        <div className="stack-sm enter" style={{ marginBottom: 16 }}>
          {inProgress ? (
            <div className="notice notice-violet">
              <Info size={18} />
              <span>Une manche est en cours : tu rejoindras le groupe dès la prochaine, sans rien manquer de secret.</span>
            </div>
          ) : (
            <div className="notice notice-mint">
              <Users size={18} />
              <span>
                {playerCount} joueur{(playerCount ?? 0) > 1 ? 's' : ''} déjà dans le salon. Choisis ton pseudo pour entrer.
              </span>
            </div>
          )}
          {mine && (
            <div className="resume-card">
              <ShieldCheck size={26} aria-hidden="true" />
              <div className="grow">
                <strong>Ta place t’attend</strong>
                <p className="subtle">Ton compte est déjà assis dans ce salon : reprends-la sans créer de deuxième joueur.</p>
              </div>
              <button type="button" className="btn btn-mint btn-sm" onClick={onResumeAccount} disabled={accountBusy}>
                {accountBusy ? <Spinner size={16} /> : <RotateCcw size={16} />} Reprendre
              </button>
            </div>
          )}
          {resume && !mine && (
            <div className="resume-card">
              <Avatar avatar={resume.avatar} size={44} label="" />
              <div className="grow">
                <strong>Tu étais déjà là</strong>
                <p className="subtle">Reprends ta place en tant que {resume.name}.</p>
              </div>
              <button type="button" className="btn btn-mint btn-sm" onClick={onResume} disabled={resumeBusy}>
                {resumeBusy ? <Spinner size={16} /> : <RotateCcw size={16} />} Reprendre
              </button>
            </div>
          )}
        </div>
      )}

      <form className="card card-feature stack enter-2" onSubmit={submit} noValidate>
        <div className="profile-preview" aria-hidden="true">
          <Avatar avatar={avatar} photo={photo?.url} size={88} label="" />
          <span className="name">{trimmed || 'Ton pseudo'}</span>
        </div>

        <div className="field">
          <label className="label" htmlFor={nameId}>
            Ton pseudo
          </label>
          <div className="input-wrap">
            <input
              id={nameId}
              className="input"
              value={name}
              onChange={(e) => {
                dirty.current = true;
                setName(e.target.value);
                setError(null);
              }}
              maxLength={NAME_MAX + 4}
              placeholder="Ex. Léa, Max, Inspecteur G."
              autoComplete="nickname"
              onKeyDown={submitOnEnter}
              enterKeyHint="go"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              autoFocus={!saved?.name}
            />
            <span className={cls('input-count', length > NAME_MAX && 'is-full')} aria-hidden="true">
              {length}/{NAME_MAX}
            </span>
          </div>
        </div>

        <div className="field">
          <span className="label">Ton avatar</span>
          <AvatarPicker
            value={avatar}
            onChange={(v) => {
              dirty.current = true;
              setAvatar(v);
            }}
            taken={taken}
          />
          {mode === 'join' && taken.length > 0 && (
            <p className="form-hint">
              <Info size={15} /> Les avatars barrés sont déjà pris dans ce salon.
            </p>
          )}
        </div>

        <div className="field">
          <span className="label">Ou ta propre photo</span>
          <PhotoPicker value={photo} onChange={changePhoto} />
        </div>

        <FormError message={error} id={errorId} />

        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || length < NAME_MIN}>
          {busy ? <Spinner /> : mode === 'create' ? <Sparkles size={20} /> : <DoorOpen size={20} />}
          {busy ? 'Un instant…' : mode === 'create' ? 'Créer le salon' : 'Entrer dans le salon'}
        </button>
        {mode === 'create' && (
          <p className="subtle center">Tu seras l’hôte : tu choisis les règles et lances les manches.</p>
        )}
      </form>
    </div>
  );
}

/** Arrivée par code ou par lien d'invitation : on vérifie le salon avant d'afficher le formulaire. */
export function JoinFlow({ code, onBack, onRetry }: { code: string; onBack: () => void; onRetry: () => void }) {
  const conn = useApp((s) => s.conn);
  // Après une connexion au compte, le salon est revérifié : une place existante peut être reprise.
  const signedIn = useAccount().status === 'signed-in';
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ok'; taken: number[]; players: number; inProgress: boolean; mine: boolean }
    | { status: 'error'; fatal: Fatal }
  >({ status: 'loading' });

  useEffect(() => {
    if (conn !== 'online') return;
    let cancelled = false;
    void checkRoom(code).then((res) => {
      if (cancelled) return;
      if (res.ok) setState({ status: 'ok', taken: res.takenAvatars, players: res.players, inProgress: res.inProgress, mine: res.mine });
      else setState({ status: 'error', fatal: { title: fatalTitle(res.error.code), message: res.error.message, code: res.error.code } });
    });
    return () => {
      cancelled = true;
    };
  }, [code, conn, signedIn]);

  if (state.status === 'loading') {
    return <LoadingScreen label={conn === 'online' ? 'Recherche du salon…' : 'Connexion au serveur…'} offline={conn === 'offline'} />;
  }
  if (state.status === 'error') {
    return <FatalScreen fatal={state.fatal} onHome={onBack} onRetry={onRetry} />;
  }
  return (
    <ProfileForm
      mode="join"
      code={code}
      taken={state.taken}
      playerCount={state.players}
      inProgress={state.inProgress}
      mine={state.mine}
      onBack={onBack}
    />
  );
}

// ───────────────────────── écrans d'état

export function LoadingScreen({ label, offline, onCancel }: { label: string; offline?: boolean; onCancel?: () => void }) {
  return (
    <div className="shell">
      <div className="state-screen" role="status" aria-live="polite">
        <span className="state-art loader-mask" aria-hidden="true">
          <MaskArt size={96} />
        </span>
        <p className="h3">{label}</p>
        {offline ? (
          <p className="muted row">
            <WifiOff size={16} /> Le serveur est injoignable pour l’instant, nouvelle tentative automatique.
          </p>
        ) : (
          <div className="skeleton" style={{ width: 180, height: 10 }} />
        )}
        {onCancel && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={onCancel}>
            <House size={16} /> Retour à l’accueil
          </button>
        )}
      </div>
    </div>
  );
}

export function FatalScreen({ fatal, onHome, onRetry }: { fatal: Fatal; onHome: () => void; onRetry?: () => void }) {
  const codeProblem = fatal.code === 'ROOM_NOT_FOUND' || fatal.code === 'CODE_INVALID' || fatal.code === 'ROOM_FULL';
  return (
    <div className="shell">
      <div className="state-screen enter">
        <Brand />
        <span className="state-art" aria-hidden="true">
          {codeProblem ? <MagnifierArt size={96} /> : <GhostArt size={88} />}
        </span>
        <h1 className="h2 display">{fatal.title}</h1>
        <p className="muted" style={{ maxWidth: '36ch' }}>
          {fatal.message}
        </p>
        <div className="stack-sm" style={{ width: '100%', maxWidth: 360, marginTop: 8 }}>
          {onRetry && codeProblem && (
            <button type="button" className="btn btn-primary btn-block" onClick={onRetry}>
              <KeyRound size={18} /> Saisir un autre code
            </button>
          )}
          <button type="button" className={cls('btn btn-block', onRetry && codeProblem ? 'btn-ghost' : 'btn-primary')} onClick={onHome}>
            <House size={18} /> Retour à l’accueil
          </button>
        </div>
      </div>
    </div>
  );
}
