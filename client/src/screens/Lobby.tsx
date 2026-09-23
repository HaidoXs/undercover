import {
  Check,
  ChevronDown,
  Copy,
  Crown,
  Ghost,
  Hourglass,
  Info,
  Link,
  Lock,
  Layers,
  MessageSquareQuote,
  Minus,
  Play,
  Plus,
  ScrollText,
  Scale,
  Settings2,
  Sparkles,
  Timer as TimerIcon,
  Trophy,
  UserPen,
  UserPlus,
  Users,
  VenetianMask,
  Vote,
  WifiOff,
} from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  CLUE_SECONDS_OPTIONS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  MR_WHITE_MIN_PLAYERS,
  NAME_MAX,
  VOTE_SECONDS_OPTIONS,
} from '../../../shared/constants';
import { compositionFor, maxIntruders, settingsError } from '../../../shared/rules';
import { SPECIAL_ROLES, specialRolesError, type SpecialRoleId } from '../../../shared/specialRoles';
import type { GameView, PackMeta, PublicPlayer, Settings } from '../../../shared/types';
import { Avatar } from '../components/Avatar';
import { AvatarPicker } from '../components/AvatarPicker';
import { FormError, Spinner } from '../components/Chrome';
import { packIcon, SPECIAL_ICON } from '../components/icons';
import { RoleInfoButton } from '../components/RoleInfo';
import { Sheet } from '../components/Sheet';
import { cls, copyText, inviteUrl, plural, submitOnEnter } from '../lib/util';
import { game } from '../net/controller';
import { toast, useApp } from '../state/store';
import { TopBar } from './Room';

export function Lobby({ view, onLeft }: { view: GameView; onLeft: () => void }) {
  const isHost = view.hostId === view.me.id;
  const present = view.players.filter((p) => p.connected && !p.left);

  return (
    <div className="shell wide has-bar">
      <TopBar view={view} onLeft={onLeft} />
      <div className="two-col">
        <div className="stack">
          <InviteCard code={view.code} />
          <PlayersCard view={view} />
          <RulesCard />
        </div>
        <div className="stack">
          <SettingsCard view={view} isHost={isHost} presentCount={present.length} />
          <SpecialRolesCard view={view} isHost={isHost} presentCount={present.length} />
          <PacksCard view={view} isHost={isHost} />
        </div>
      </div>
      <LobbyActionBar view={view} isHost={isHost} present={present} />
    </div>
  );
}

// ───────────────────────── invitation

function useCopied(): [string | null, (key: string, text: string, message: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(id);
  }, [copied]);
  const copy = (key: string, text: string, message: string) => {
    void copyText(text).then((ok) => {
      if (ok) {
        setCopied(key);
        toast(message, 'success', 1800);
      } else {
        toast('Copie impossible : sélectionne le texte manuellement.', 'warn');
      }
    });
  };
  return [copied, copy];
}

function InviteCard({ code }: { code: string }) {
  const [copied, copy] = useCopied();
  const url = inviteUrl(code);
  return (
    <section className="card card-glow enter" aria-labelledby="invite-title">
      <div className="card-header">
        <h2 id="invite-title" className="card-title">
          <UserPlus size={20} /> Invite tes amis
        </h2>
        <span className="pill pill-violet">Salon privé</span>
      </div>
      <p className="muted center" style={{ fontSize: '0.92rem' }}>
        Code du salon
      </p>
      <div className="invite-code" aria-label={`Code : ${code.split('').join(' ')}`}>
        {code.split('').map((c, i) => (
          <span key={i} aria-hidden="true">
            {c}
          </span>
        ))}
      </div>
      <div className="invite-actions">
        <button type="button" className="btn btn-ghost" onClick={() => copy('code', code, 'Code copié')}>
          {copied === 'code' ? <Check size={18} className="accent-mint" /> : <Copy size={18} />}
          {copied === 'code' ? 'Copié !' : 'Copier le code'}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => copy('link', url, 'Lien d’invitation copié')}>
          {copied === 'link' ? <Check size={18} /> : <Link size={18} />}
          {copied === 'link' ? 'Copié !' : 'Copier le lien'}
        </button>
      </div>
      <p className="invite-link" title={url}>
        {url.replace(/^https?:\/\//, '')}
      </p>
    </section>
  );
}

// ───────────────────────── joueurs

function statusPill(p: PublicPlayer) {
  if (!p.connected)
    return (
      <span className="pill">
        <WifiOff size={13} /> Hors ligne
      </span>
    );
  if (p.isHost)
    return (
      <span className="pill pill-amber">
        <Crown size={13} /> Hôte
      </span>
    );
  if (p.ready)
    return (
      <span className="pill pill-mint">
        <Check size={13} strokeWidth={3} /> Prêt
      </span>
    );
  return (
    <span className="pill">
      <Hourglass size={13} /> Pas prêt
    </span>
  );
}

function PlayersCard({ view }: { view: GameView }) {
  const [editing, setEditing] = useState(false);
  const players = view.players.filter((p) => !p.left);
  const missing = Math.max(0, MIN_PLAYERS - players.length);
  return (
    <section className="card enter-2" aria-labelledby="players-title">
      <div className="card-header">
        <h2 id="players-title" className="card-title">
          <Users size={20} /> Joueurs
        </h2>
        <span className="pill">
          {players.length}/{MAX_PLAYERS}
        </span>
      </div>
      <ul className="player-list">
        {players.map((p) => {
          const me = p.id === view.me.id;
          return (
            <li key={p.id} className={cls('player-row', me && 'is-me', !p.connected && 'is-offline')}>
              <Avatar
                avatar={p.avatar}
                size={42}
                badge={p.isHost ? 'crown' : null}
                presence={p.connected}
                dimmed={!p.connected}
                label={`${p.name}${p.isHost ? ', hôte' : ''}`}
              />
              <div className="grow">
                <div className="player-name">
                  {p.name}
                  {me && <span className="subtle"> (toi)</span>}
                </div>
              </div>
              {me && (
                <button type="button" className="icon-btn" style={{ width: 38, height: 38 }} onClick={() => setEditing(true)} aria-label="Modifier mon pseudo ou mon avatar">
                  <UserPen size={17} />
                </button>
              )}
              {statusPill(p)}
            </li>
          );
        })}
        {missing > 0 && (
          <li className="empty-slot">
            <span className="dot" aria-hidden="true">
              <UserPlus size={16} />
            </span>
            Encore {plural(missing, 'joueur', 'joueurs')} pour lancer une manche
          </li>
        )}
      </ul>
      <ProfileSheet view={view} open={editing} onClose={() => setEditing(false)} />
    </section>
  );
}

function ProfileSheet({ view, open, onClose }: { view: GameView; open: boolean; onClose: () => void }) {
  const me = view.players.find((p) => p.id === view.me.id);
  const [name, setName] = useState(me?.name ?? '');
  const [avatar, setAvatar] = useState(me?.avatar ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameId = useId();

  useEffect(() => {
    if (open && me) {
      setName(me.name);
      setAvatar(me.avatar);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!me) return null;
  const taken = view.players.filter((p) => p.id !== me.id && !p.left).map((p) => p.avatar);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await game.profile({ name, avatar });
    setBusy(false);
    if (res.ok) onClose();
    else setError(res.error.message);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Mon profil" icon={<UserPen size={20} />}>
      <form className="stack" onSubmit={save} noValidate>
        <div className="profile-preview" aria-hidden="true">
          <Avatar avatar={avatar} size={76} label="" />
        </div>
        <div className="field">
          <label className="label" htmlFor={nameId}>
            Pseudo
          </label>
          <input id={nameId} className="input" value={name} maxLength={NAME_MAX + 4} onChange={(e) => setName(e.target.value)} onKeyDown={submitOnEnter} />
        </div>
        <div className="field">
          <span className="label">Avatar</span>
          <AvatarPicker value={avatar} onChange={setAvatar} taken={taken} />
        </div>
        <FormError message={error} />
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? <Spinner /> : <Check size={18} />} Enregistrer
        </button>
      </form>
    </Sheet>
  );
}

// ───────────────────────── paramètres

function Segmented({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: readonly number[];
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className={cls('segmented', disabled && 'is-locked')} role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          aria-pressed={opt === value}
          disabled={disabled}
          onClick={() => onChange(opt)}
        >
          {opt} s
        </button>
      ))}
    </div>
  );
}

function SettingsCard({ view, isHost, presentCount }: { view: GameView; isHost: boolean; presentCount: number }) {
  const s = view.settings;
  const [busy, setBusy] = useState(false);
  const n = presentCount;
  const compo = compositionFor(s, n);
  const mwAllowed = n >= MR_WHITE_MIN_PLAYERS;
  const ucMin = s.mrWhite ? 0 : 1;
  const ucMax = Math.max(ucMin, maxIntruders(Math.max(n, MIN_PLAYERS)) - (s.mrWhite ? 1 : 0));
  const issue = settingsError(s, n);

  const update = async (patch: Partial<Settings>) => {
    if (!isHost || busy) return;
    setBusy(true);
    const res = await game.settings(patch);
    setBusy(false);
    if (!res.ok) toast(res.error.message, 'warn');
  };

  return (
    <section className="card enter-2" aria-labelledby="settings-title">
      <div className="card-header">
        <h2 id="settings-title" className="card-title">
          <Settings2 size={20} /> Prochaine manche
        </h2>
        {!isHost && (
          <span className="pill">
            <Lock size={13} /> Réglé par l’hôte
          </span>
        )}
      </div>

      <div className="compo" aria-label="Composition de la manche">
        <div className={cls('compo-item role-civil', compo.civils <= 0 && 'is-zero')}>
          <Users size={18} aria-hidden="true" />
          <strong>{Math.max(0, compo.civils)}</strong>
          <span>{compo.civils > 1 ? 'Civils' : 'Civil'}</span>
        </div>
        <div className={cls('compo-item role-undercover', compo.undercovers === 0 && 'is-zero')}>
          <VenetianMask size={18} aria-hidden="true" />
          <strong>{compo.undercovers}</strong>
          <span>Undercover</span>
        </div>
        <div className={cls('compo-item role-mrwhite', compo.mrWhite === 0 && 'is-zero')}>
          <Ghost size={18} aria-hidden="true" />
          <strong>{compo.mrWhite}</strong>
          <span>Mr. White</span>
        </div>
      </div>
      <p className="subtle center" style={{ marginTop: 8 }}>
        Calculée pour {plural(n, 'joueur connecté', 'joueurs connectés')}.
      </p>

      <div className="setting" style={{ marginTop: 10 }}>
        <div className="setting-label">
          <strong>Undercover</strong>
          <span>Mot proche de celui des Civils</span>
        </div>
        <div className="stepper">
          <button
            type="button"
            aria-label="Retirer un Undercover"
            disabled={!isHost || busy || s.undercoverCount <= ucMin}
            onClick={() => update({ undercoverCount: s.undercoverCount - 1 })}
          >
            <Minus size={18} />
          </button>
          <output aria-live="polite" aria-label="Nombre d’Undercover">
            {s.undercoverCount}
          </output>
          <button
            type="button"
            aria-label="Ajouter un Undercover"
            disabled={!isHost || busy || s.undercoverCount >= ucMax}
            onClick={() => update({ undercoverCount: s.undercoverCount + 1 })}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="setting">
        <div className="setting-label" id="mw-label">
          <strong>Mr. White</strong>
          <span>{mwAllowed ? 'Sans mot, il doit bluffer' : `Disponible dès ${MR_WHITE_MIN_PLAYERS} joueurs`}</span>
        </div>
        <button
          type="button"
          role="switch"
          className="switch"
          aria-checked={s.mrWhite}
          aria-labelledby="mw-label"
          disabled={!isHost || busy || (!mwAllowed && !s.mrWhite)}
          onClick={() =>
            update(s.mrWhite && s.undercoverCount === 0 ? { mrWhite: false, undercoverCount: 1 } : { mrWhite: !s.mrWhite })
          }
        />
      </div>

      <div className="setting stacked">
        <div className="setting-label">
          <strong className="row" style={{ gap: 8 }}>
            <MessageSquareQuote size={16} className="accent-violet" /> Temps par indice
          </strong>
        </div>
        <Segmented
          label="Temps par indice"
          options={CLUE_SECONDS_OPTIONS}
          value={s.clueSeconds}
          disabled={!isHost || busy}
          onChange={(v) => update({ clueSeconds: v })}
        />
      </div>

      <div className="setting stacked">
        <div className="setting-label">
          <strong className="row" style={{ gap: 8 }}>
            <TimerIcon size={16} className="accent-violet" /> Temps de vote
          </strong>
        </div>
        <Segmented
          label="Temps de vote"
          options={VOTE_SECONDS_OPTIONS}
          value={s.voteSeconds}
          disabled={!isHost || busy}
          onChange={(v) => update({ voteSeconds: v })}
        />
      </div>

      {issue && n >= MIN_PLAYERS && (
        <div className="notice notice-amber" role="status" style={{ marginTop: 6 }}>
          <Info size={18} />
          <span>{issue}</span>
        </div>
      )}
      {isHost && (
        <p className="subtle" style={{ marginTop: 12 }}>
          Chaque modification remet les statuts « Prêt » à zéro.
        </p>
      )}
    </section>
  );
}

// ───────────────────────── packs

// ───────────────────────── rôles spéciaux

function SpecialRolesCard({ view, isHost, presentCount }: { view: GameView; isHost: boolean; presentCount: number }) {
  const [busy, setBusy] = useState(false);
  const enabled = new Set(view.settings.specialRoles);
  const slots = SPECIAL_ROLES.filter((r) => enabled.has(r.id)).reduce((sum, r) => sum + r.slots, 0);
  const issue = enabled.size > 0 ? specialRolesError(view.settings.specialRoles, presentCount) : null;

  const toggle = async (id: SpecialRoleId) => {
    if (!isHost || busy) return;
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setBusy(true);
    const res = await game.settings({ specialRoles: [...next] });
    setBusy(false);
    if (!res.ok) toast(res.error.message, 'warn');
  };

  return (
    <section className="card enter-3" aria-labelledby="roles-title">
      <div className="card-header">
        <div>
          <h2 id="roles-title" className="card-title">
            <Sparkles size={20} /> Rôles spéciaux
          </h2>
          <p className="subtle" style={{ marginTop: 4 }} aria-live="polite">
            {enabled.size === 0
              ? 'Aucun rôle activé : partie classique.'
              : `${plural(enabled.size, 'rôle activé', 'rôles activés')} · ${plural(slots, 'place', 'places')} pour ${plural(presentCount, 'joueur', 'joueurs')}`}
          </p>
        </div>
        {!isHost && (
          <span className="pill">
            <Lock size={13} /> Réglé par l’hôte
          </span>
        )}
      </div>
      <div className="role-grid">
        {SPECIAL_ROLES.map((def) => {
          const Icon = SPECIAL_ICON[def.id];
          const on = enabled.has(def.id);
          const labelId = `role-${def.id}`;
          return (
            <div key={def.id} className={cls('role-card', on && 'is-on')}>
              <div className="role-card-top">
                <span className="role-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span className="grow">
                  <span className="role-name" id={labelId}>
                    {def.name}
                  </span>
                  <span className="role-meta">
                    {def.minPlayers > 3 ? `${def.minPlayers} joueurs min.` : 'Dès 3 joueurs'}
                    {def.slots > 1 ? ` · ${def.slots} joueurs` : ''}
                  </span>
                </span>
                <RoleInfoButton roleId={def.id} />
              </div>
              <p className="role-tagline">{def.tagline}</p>
              <div className="role-card-foot">
                <span className={cls('pill', on && 'pill-mint')}>{on ? 'Activé' : 'Désactivé'}</span>
                <button
                  type="button"
                  role="switch"
                  className="switch"
                  aria-checked={on}
                  aria-labelledby={labelId}
                  disabled={!isHost || busy}
                  onClick={() => toggle(def.id)}
                />
              </div>
            </div>
          );
        })}
      </div>
      {issue && (
        <div className="notice notice-amber" role="status" style={{ marginTop: 12 }}>
          <Info size={18} />
          <span>{issue}</span>
        </div>
      )}
      <p className="form-hint" style={{ marginTop: 12 }}>
        <Lock size={15} /> Un seul rôle spécial par joueur, en plus de son camp et de son mot. Verrouillé pendant la manche.
      </p>
    </section>
  );
}

function PacksCard({ view, isHost }: { view: GameView; isHost: boolean }) {
  const packs = useApp((s) => s.packs);
  const [busy, setBusy] = useState(false);
  const selected = new Set(view.settings.packIds);
  const pairTotal = packs.filter((p) => selected.has(p.id)).reduce((sum, p) => sum + p.pairCount, 0);
  const allSelected = packs.length > 0 && packs.every((p) => selected.has(p.id));

  const setPacks = async (ids: string[]) => {
    if (!isHost || busy) return;
    setBusy(true);
    const res = await game.settings({ packIds: ids });
    setBusy(false);
    if (!res.ok) toast(res.error.message, 'warn');
  };

  const toggle = (pack: PackMeta) => {
    const next = new Set(selected);
    if (next.has(pack.id)) next.delete(pack.id);
    else next.add(pack.id);
    void setPacks([...next]);
  };

  return (
    <section className="card enter-3" aria-labelledby="packs-title">
      <div className="card-header">
        <div>
          <h2 id="packs-title" className="card-title">
            <Layers size={20} /> Packs de mots
          </h2>
          <p className="subtle" style={{ marginTop: 4 }} aria-live="polite">
            {selected.size === 0
              ? 'Aucun pack sélectionné'
              : `${plural(selected.size, 'pack', 'packs')} · ${plural(pairTotal, 'paire', 'paires')}`}
          </p>
        </div>
        {isHost && packs.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setPacks(allSelected ? [] : packs.map((p) => p.id))}>
            {allSelected ? 'Tout retirer' : 'Tout sélectionner'}
          </button>
        )}
      </div>

      {packs.length === 0 ? (
        <div className="pack-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 118 }} />
          ))}
        </div>
      ) : (
        <div className="pack-grid">
          {packs.map((pack) => {
            const Icon = packIcon(pack.icon);
            const on = selected.has(pack.id);
            return (
              <button
                key={pack.id}
                type="button"
                className="pack-card"
                aria-pressed={on}
                aria-disabled={!isHost || busy}
                aria-label={`${pack.name}, ${pack.pairCount} paires${on ? ', sélectionné' : ''}`}
                onClick={() => isHost && toggle(pack)}
              >
                <span className="pack-check" aria-hidden="true">
                  <Check size={14} strokeWidth={3.2} />
                </span>
                <span className="pack-top">
                  <span className="pack-icon" aria-hidden="true">
                    <Icon size={21} />
                  </span>
                  <span>
                    <span className="pack-name">{pack.name}</span>
                    <span className="pack-count" style={{ display: 'block' }}>
                      {pack.pairCount} paires
                    </span>
                  </span>
                </span>
                <span className="pack-desc">{pack.description}</span>
              </button>
            );
          })}
        </div>
      )}
      <p className="form-hint" style={{ marginTop: 14 }}>
        <Lock size={15} /> La paire est tirée au sort parmi les packs choisis, sans répétition. Aucun mot n’est dévoilé avant la fin de la
        manche.
      </p>
    </section>
  );
}

// ───────────────────────── règles

function RulesCard() {
  return (
    <section className="card enter-3">
      <details className="collapsible">
        <summary>
          <span className="card-title">
            <ScrollText size={20} /> Règles en bref
          </span>
          <ChevronDown size={20} className="chev" />
        </summary>
        <ul className="rules-list">
          <li>
            <VenetianMask size={18} />
            <span>
              <strong>Civils</strong> et <strong>Undercover</strong> reçoivent deux mots proches, sans connaître leur rôle.{' '}
              <strong>Mr. White</strong> n’a pas de mot.
            </span>
          </li>
          <li>
            <MessageSquareQuote size={18} />
            <span>Chacun son tour donne un court indice, sans jamais dire son mot.</span>
          </li>
          <li>
            <Vote size={18} />
            <span>Vote secret et définitif. Le plus désigné est éliminé et son rôle révélé.</span>
          </li>
          <li>
            <Scale size={18} />
            <span>Égalité : second scrutin entre ex æquo. Si elle persiste, personne ne sort.</span>
          </li>
          <li>
            <Trophy size={18} />
            <span>
              Plus d’intrus : les Civils gagnent. Autant d’intrus que de Civils : les intrus gagnent. Mr. White éliminé peut encore
              gagner en devinant le mot.
            </span>
          </li>
        </ul>
      </details>
    </section>
  );
}

// ───────────────────────── barre d'action

function LobbyActionBar({ view, isHost, present }: { view: GameView; isHost: boolean; present: PublicPlayer[] }) {
  const [busy, setBusy] = useState(false);
  const me = view.players.find((p) => p.id === view.me.id);
  const notReady = present.filter((p) => !p.isHost && !p.ready);
  const issue = settingsError(view.settings, present.length);

  let status: { text: string; tone: 'ok' | 'wait' } = { text: 'Tout le monde est prêt !', tone: 'ok' };
  if (present.length < MIN_PLAYERS) {
    status = { text: `Il faut au moins ${MIN_PLAYERS} joueurs connectés (encore ${MIN_PLAYERS - present.length}).`, tone: 'wait' };
  } else if (issue) {
    status = { text: issue, tone: 'wait' };
  } else if (notReady.length > 0) {
    const names = notReady.map((p) => p.name);
    status = {
      text: `En attente de ${names.length > 2 ? `${names.slice(0, 2).join(', ')} et ${names.length - 2} autre${names.length > 3 ? 's' : ''}` : names.join(' et ')}.`,
      tone: 'wait',
    };
  }
  const canStart = status.tone === 'ok';

  const run = async (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok && res.error) toast(res.error.message, 'warn');
  };

  return (
    <div className="action-bar">
      <div className="action-bar-inner">
        {isHost ? (
          <>
            <p className="status-line" role="status" aria-live="polite">
              {canStart ? <Check size={16} className="accent-mint" /> : <Hourglass size={16} />}
              {status.text}
            </p>
            <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!canStart || busy} onClick={() => run(game.start)}>
              {busy ? <Spinner /> : <Play size={20} fill="currentColor" />} Lancer la manche
            </button>
          </>
        ) : me?.ready ? (
          <>
            <p className="status-line" role="status" aria-live="polite">
              <Check size={16} className="accent-mint" /> Tu es prêt. L’hôte lance la manche quand tout le monde l’est.
            </p>
            <button type="button" className="btn btn-ghost btn-lg btn-block" disabled={busy} onClick={() => run(() => game.ready(false))}>
              {busy ? <Spinner /> : null} Finalement, pas encore
            </button>
          </>
        ) : (
          <>
            <p className="status-line">Signale à l’hôte que tu es prêt à jouer.</p>
            <button type="button" className="btn btn-mint btn-lg btn-block" disabled={busy} onClick={() => run(() => game.ready(true))}>
              {busy ? <Spinner /> : <Check size={20} strokeWidth={3} />} Je suis prêt
            </button>
          </>
        )}
      </div>
    </div>
  );
}
