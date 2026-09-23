import {
  ArrowLeft,
  CircleHelp,
  DoorOpen,
  Eye,
  Fingerprint,
  House,
  Info,
  KeyRound,
  MessageSquareQuote,
  RotateCcw,
  Search,
  SearchX,
  Sparkles,
  Users,
  VenetianMask,
  Vote,
  WifiOff,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { AVATARS } from '../../../shared/avatars';
import { CODE_ALPHABET, CODE_LENGTH, MAX_PLAYERS, NAME_MAX, NAME_MIN } from '../../../shared/constants';
import { Avatar } from '../components/Avatar';
import { AvatarPicker } from '../components/AvatarPicker';
import { Brand, FormError, Spinner } from '../components/Chrome';
import { HelpContent } from '../components/Help';
import { Sheet } from '../components/Sheet';
import { cls, submitOnEnter } from '../lib/util';
import { checkRoom, createRoom, fatalTitle, joinRoom, resumeSaved } from '../net/controller';
import { session } from '../net/session';
import { useApp, type Fatal } from '../state/store';

// ───────────────────────── accueil

export function Home({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  const [help, setHelp] = useState(false);
  return (
    <div className="home">
      <div className="shell">
        <header className="hero enter">
          <div className="hero-cards" aria-hidden="true">
            <div className="hero-card">
              <Fingerprint size={40} strokeWidth={1.6} />
            </div>
            <div className="hero-card">
              <Search size={40} strokeWidth={1.6} />
            </div>
            <div className="hero-card">
              <VenetianMask size={50} strokeWidth={1.7} />
            </div>
          </div>
          <p className="eyebrow">Bluff & enquête entre amis</p>
          <h1 className="display hero-title">Undercover</h1>
          <p className="hero-sub">Un mot secret, des indices à double sens et des intrus à démasquer.</p>
        </header>

        <div className="home-actions enter-2">
          <button type="button" className="btn btn-primary btn-lg" onClick={onCreate}>
            <Sparkles size={20} /> Créer une partie
          </button>
          <button type="button" className="btn btn-ghost btn-lg" onClick={onJoin}>
            <DoorOpen size={20} /> Rejoindre une partie
          </button>
        </div>

        <ol className="home-steps enter-3" aria-label="Déroulement d’une manche" style={{ listStyle: 'none', padding: 0, margin: '30px 0 0' }}>
          <li className="step">
            <span className="step-icon">
              <Eye size={20} />
            </span>
            <div>
              <strong>Découvre ton mot</strong>
              <span>En secret. Mais es-tu vraiment Civil ?</span>
            </div>
          </li>
          <li className="step">
            <span className="step-icon">
              <MessageSquareQuote size={20} />
            </span>
            <div>
              <strong>Donne un indice</strong>
              <span>Assez clair pour tes alliés, pas trop.</span>
            </div>
          </li>
          <li className="step">
            <span className="step-icon">
              <Vote size={20} />
            </span>
            <div>
              <strong>Vote et démasque</strong>
              <span>Élimine les intrus avant qu’ils gagnent.</span>
            </div>
          </li>
        </ol>

        <footer className="home-foot">
          <span className="row">
            <Users size={16} /> 3 à {MAX_PLAYERS} joueurs
          </span>
          <span aria-hidden="true">·</span>
          <span>Sans inscription</span>
          <span aria-hidden="true">·</span>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setHelp(true)}>
            <CircleHelp size={16} /> Comment jouer ?
          </button>
        </footer>
      </div>
      <Sheet open={help} onClose={() => setHelp(false)} title="Comment jouer" icon={<CircleHelp size={20} />}>
        <HelpContent />
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
      <h1 className="grow h2 display">{title}</h1>
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
      <form className="card card-glow stack enter-2" onSubmit={onSubmit} noValidate>
        <div className="stack-sm">
          <span className="state-icon" style={{ width: 56, height: 56, borderRadius: 18 }} aria-hidden="true">
            <KeyRound size={26} />
          </span>
          <h2 className="h3">Code du salon</h2>
          <p className="muted">Saisis les 6 caractères partagés par l’hôte, ou ouvre directement son lien d’invitation.</p>
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
  onBack,
}: {
  mode: 'create' | 'join';
  code?: string;
  taken?: number[];
  playerCount?: number;
  inProgress?: boolean;
  onBack: () => void;
}) {
  const saved = session.getProfile();
  const [name, setName] = useState(saved?.name ?? '');
  const [avatar, setAvatar] = useState(() =>
    firstFree(saved?.avatar ?? Math.floor(Math.random() * AVATARS.length), taken),
  );
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
    const res = mode === 'create' ? await createRoom(trimmed, avatar) : await joinRoom(code as string, trimmed, avatar);
    if (!res.ok) {
      setBusy(false);
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
          {resume && (
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

      <form className="card card-glow stack enter-2" onSubmit={submit} noValidate>
        <div className="profile-preview" aria-hidden="true">
          <Avatar avatar={avatar} size={88} label="" />
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
          <AvatarPicker value={avatar} onChange={setAvatar} taken={taken} />
          {mode === 'join' && taken.length > 0 && (
            <p className="form-hint">
              <Info size={15} /> Les avatars barrés sont déjà pris dans ce salon.
            </p>
          )}
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
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ok'; taken: number[]; players: number; inProgress: boolean }
    | { status: 'error'; fatal: Fatal }
  >({ status: 'loading' });

  useEffect(() => {
    if (conn !== 'online') return;
    let cancelled = false;
    void checkRoom(code).then((res) => {
      if (cancelled) return;
      if (res.ok) setState({ status: 'ok', taken: res.takenAvatars, players: res.players, inProgress: res.inProgress });
      else setState({ status: 'error', fatal: { title: fatalTitle(res.error.code), message: res.error.message, code: res.error.code } });
    });
    return () => {
      cancelled = true;
    };
  }, [code, conn]);

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
      onBack={onBack}
    />
  );
}

// ───────────────────────── écrans d'état

export function LoadingScreen({ label, offline, onCancel }: { label: string; offline?: boolean; onCancel?: () => void }) {
  return (
    <div className="shell">
      <div className="state-screen" role="status" aria-live="polite">
        <span className="state-icon loader-mask">
          <VenetianMask size={34} />
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
        <span className="state-icon tone-coral" style={{ marginTop: 18 }}>
          {codeProblem ? <SearchX size={34} /> : <DoorOpen size={34} />}
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
