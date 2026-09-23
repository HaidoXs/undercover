import {
  Check,
  CircleCheck,
  CircleX,
  Crosshair,
  Drama,
  HeartHandshake,
  PartyPopper,
  Sandwich,
  ShieldCheck,
  Swords,
  Target,
  EyeOff,
  Ghost,
  Hourglass,
  Lock,
  MessageSquareQuote,
  LogOut,
  RefreshCw,
  Scale,
  Send,
  Sparkles,
  Trophy,
  Users,
  VenetianMask,
  Vote,
} from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CLUE_MAX, GUESS_MAX } from '../../../../shared/constants';
import type { GameView, PublicPlayer, Role, RoundView } from '../../../../shared/types';
import { Avatar } from '../../components/Avatar';
import { FormError, RoleChip, Spinner } from '../../components/Chrome';
import { CivilsArt, Confetti, GhostArt, HeartsArt, MaskArt, PartyArt, RoleArt } from '../../components/Illustrations';
import { SecretCard, SecretPeek, useConcealOnLeave } from '../../components/Secret';
import { ProgressBar } from '../../components/Timer';
import { useCountdown } from '../../hooks/time';
import { stopTicking, useTickTock } from '../../lib/sound';
import { cls, playersById, ROLE_LABEL, submitOnEnter } from '../../lib/util';
import { game, leaveRoom } from '../../net/controller';
import { EventList, FalafelPicker, MemeForm, MyRolePanel, SpecialChip } from './Specials';
import { toast } from '../../state/store';

const roundOf = (view: GameView) => view.round as RoundView;
const canPlay = (view: GameView) => view.me.status === 'alive';

function Seconds({ view, prefix }: { view: GameView; prefix: string }) {
  const cd = useCountdown(view);
  if (!cd) return null;
  return (
    <span>
      {prefix} {cd.paused ? '(en pause)' : `${cd.seconds} s`}
    </span>
  );
}

/** Univers précis de la manche, connu de tous. */
function ThemeBadge({ name }: { name: string }) {
  return (
    <p className="theme-badge">
      <Target size={15} aria-hidden="true" /> Thème précis : <strong>{name}</strong>
    </p>
  );
}

/** « Tour d’indices 1/2 — vote ensuite » : où en est le bloc de tours avant le prochain vote. */
function RoundProgress({ round }: { round: RoundView }) {
  const { clueRound, clueRounds } = round;
  const left = clueRounds - clueRound;
  const text =
    clueRounds === 1
      ? 'Un tour d’indices — vote ensuite'
      : `Tour d’indices ${clueRound}/${clueRounds} — ${left === 0 ? 'vote ensuite' : `encore ${left} tour${left > 1 ? 's' : ''} avant le vote`}`;
  return (
    <div className="round-progress" role="status" aria-live="polite">
      <span className="round-dots" aria-hidden="true">
        {Array.from({ length: clueRounds }, (_, i) => (
          <i key={i} className={cls(i < clueRound - 1 && 'is-done', i === clueRound - 1 && 'is-now')} />
        ))}
        <b>
          <Vote size={13} />
        </b>
      </span>
      <span>{text}</span>
    </div>
  );
}

// ───────────────────────── 4. découverte privée du mot

export function RevealPhase({ view }: { view: GameView }) {
  const round = roundOf(view);
  const secret = view.me.secret;
  const [revealed, setRevealed] = useState(false);
  const [everRevealed, setEverRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const hide = useCallback(() => setRevealed(false), []);
  useConcealOnLeave(hide);

  const participants = view.players.filter((p) => p.status === 'alive');
  const seenCount = round.seen.length;
  const mustGiveFalafel = view.me.special?.role === 'falafel' && !view.me.special.falafelTargetId;

  if (!secret) {
    return (
      <section className="card center stack">
        <MaskArt className="art-float center-art" size={96} />
        <p className="eyebrow">Manche {round.number}</p>
        <h2 className="display h2">Les joueurs découvrent leur carte</h2>
        {round.themeName && <ThemeBadge name={round.themeName} />}
        <p className="muted">
          {seenCount}/{participants.length} ont mémorisé leur mot.
        </p>
      </section>
    );
  }

  const confirm = async () => {
    setBusy(true);
    setRevealed(false);
    const res = await game.seen(round.id);
    setBusy(false);
    if (!res.ok) toast(res.error.message, 'warn');
  };

  return (
    <section className="card card-feature stack center" aria-labelledby="reveal-title">
      <div className="stack-sm">
        <p className="eyebrow">Carte secrète · Manche {round.number}</p>
        <h2 id="reveal-title" className="display h2">
          Découvre ton mot
        </h2>
        {round.themeName && <ThemeBadge name={round.themeName} />}
        <p className="muted">Vérifie que personne ne regarde ton écran, puis retourne la carte.</p>
      </div>

      <SecretCard
        secret={secret}
        revealed={revealed}
        onReveal={() => {
          setRevealed(true);
          setEverRevealed(true);
        }}
      />
      {revealed && <MyRolePanel view={view} />}
      {revealed && <FalafelPicker view={view} />}

      <div className="stack-sm sticky-cta">
        {revealed && (
          <button type="button" className="btn btn-secondary btn-block" onClick={hide}>
            <EyeOff size={18} /> Masquer ma carte
          </button>
        )}
        {view.me.hasSeen ? (
          <div className="notice notice-mint" role="status">
            <CircleCheck size={18} />
            <span>
              C’est noté ! En attente des autres joueurs ({seenCount}/{participants.length}).
            </span>
          </div>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!everRevealed || busy || mustGiveFalafel} onClick={confirm}>
              {busy ? <Spinner /> : <Check size={20} strokeWidth={3} />} J’ai mémorisé
            </button>
            {!everRevealed && <p className="subtle">Retourne d’abord ta carte pour continuer.</p>}
            {everRevealed && mustGiveFalafel && <p className="subtle">Offre d’abord ton falafel (carte retournée).</p>}
          </>
        )}
        <p className="subtle">
          <Seconds view={view} prefix="Début des indices dans" />
        </p>
      </div>
    </section>
  );
}

// ───────────────────────── 5. tour d'indices

export function CluesPhase({ view }: { view: GameView }) {
  const round = roundOf(view);
  const currentId = round.turn?.playerId;
  const myTurn = currentId === view.me.id && canPlay(view);
  const doneThisCycle = new Map(round.clues.filter((c) => c.cycle === round.cycle).map((c) => [c.playerId, c]));

  return (
    <>
      {myTurn && round.turn && round.memeId !== view.me.id && <ClueForm view={view} turnId={round.turn.turnId} />}
      {myTurn && round.turn && round.memeId === view.me.id && <MemeForm view={view} turnId={round.turn.turnId} />}
      {view.me.secret && canPlay(view) && <SecretPeek secret={view.me.secret} extra={<MyRolePanel view={view} />} />}

      <section className="card card-tight" aria-labelledby="order-title">
        <div className="card-header" style={{ marginBottom: 10 }}>
          <h2 id="order-title" className="card-title">
            <Users size={18} /> Indices · Tour {round.cycle}
          </h2>
          <span className="pill">
            {doneThisCycle.size}/{round.order.length}
          </span>
        </div>
        <RoundProgress round={round} />
        <ClueTrack view={view} currentId={currentId} done={doneThisCycle} />
      </section>
    </>
  );
}

function isInView(container: HTMLElement, el: HTMLElement): boolean {
  // La piste est positionnée : offsetLeft est mesuré depuis son bord gauche.
  return el.offsetLeft >= container.scrollLeft - 8 && el.offsetLeft + el.offsetWidth <= container.scrollLeft + container.clientWidth + 8;
}

/**
 * Cartes d'indices horizontales, dans l'ordre de passage.
 * La vue suit le joueur en cours, sauf si l'utilisateur est parti relire des indices précédents.
 */
function ClueTrack({
  view,
  currentId,
  done,
}: {
  view: GameView;
  currentId: string | undefined;
  done: Map<string, { text: string | null; mimed?: boolean }>;
}) {
  const round = roundOf(view);
  const pmap = playersById(view);
  const trackRef = useRef<HTMLOListElement>(null);
  const followed = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || !currentId) return;
    const card = track.querySelector<HTMLElement>(`[data-player="${CSS.escape(currentId)}"]`);
    if (!card) return;
    const previous = followed.current ? track.querySelector<HTMLElement>(`[data-player="${CSS.escape(followed.current)}"]`) : null;
    const first = followed.current === undefined;
    followed.current = currentId;
    // L'utilisateur relit d'anciens indices (la carte précédente n'est plus visible) : on ne bouge pas.
    if (!first && previous && !isInView(track, previous)) return;
    const target = card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2;
    const smooth = !first && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' });
  }, [currentId]);

  return (
    <ol ref={trackRef} className="clue-track" aria-label={`Indices du tour ${round.cycle}, dans l’ordre de passage`}>
      {round.order.map((id, i) => {
        const p = pmap.get(id);
        const clue = done.get(id);
        const isCurrent = id === currentId;
        const state = clue
          ? clue.mimed
            ? 'indice mimé'
            : clue.text === null
              ? 'passé'
              : `indice : ${clue.text}`
          : isCurrent
            ? round.memeId === id
              ? 'mime en cours'
              : 'réfléchit'
            : 'à venir';
        return (
          <li
            key={id}
            data-player={id}
            className={cls(
              'clue-card',
              isCurrent && 'is-current',
              id === view.me.id && 'is-mine',
              round.memeId === id && 'is-meme',
              !clue && !isCurrent && 'is-upcoming',
            )}
            aria-current={isCurrent ? 'step' : undefined}
            aria-label={`${i + 1}. ${p?.name ?? 'Joueur'}${id === view.me.id ? ' (toi)' : ''}, ${state}`}
          >
            <span className="cc-num" aria-hidden="true">
              {i + 1}
            </span>
            <Avatar
              avatar={p?.avatar ?? 0} photo={p?.photo}
              size={40}
              label=""
              ring={isCurrent ? 'active' : undefined}
              dimmed={!p?.connected}
              badge={!p?.connected ? 'offline' : null}
            />
            <span className="cc-name" aria-hidden="true">
              {p?.name}
            </span>
            {id === view.me.id && (
              <span className="cc-me" aria-hidden="true">
                toi
              </span>
            )}
            <span className="cc-body" aria-hidden="true">
              {clue ? (
                clue.mimed ? (
                  <span key="mimed" className="cc-mime">
                    <Drama size={15} aria-hidden="true" /> Mimé
                  </span>
                ) : clue.text === null ? (
                  <span key="passed" className="cc-passed">
                    Passé
                  </span>
                ) : (
                  <span key="text" className="cc-text">
                    « {clue.text} »
                  </span>
                )
              ) : isCurrent && round.memeId === id ? (
                <span className="cc-mime">
                  <Drama size={15} aria-hidden="true" /> Mime en cours
                </span>
              ) : isCurrent ? (
                <span className="typing">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <span className="cc-wait">À venir</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ClueForm({ view, turnId }: { view: GameView; turnId: string }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  useTickTock(!busy, view.deadline, view.paused);

  useEffect(() => {
    inputRef.current?.focus();
    try {
      navigator.vibrate?.(60);
    } catch {
      /* vibration non disponible */
    }
  }, [turnId]);

  const length = [...text.trim()].length;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!length || busy) return;
    stopTicking(); // silence immédiat dès la validation
    setBusy(true);
    setError(null);
    const res = await game.clue(turnId, text);
    setBusy(false);
    if (!res.ok) setError(res.error.message);
  };

  return (
    <form className="card my-turn stack-sm" onSubmit={submit} noValidate aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="h3 row">
        <MessageSquareQuote size={20} aria-hidden="true" /> Ton indice
      </h2>
      <p className="subtle">Un mot ou une courte expression. Interdit de donner ton mot exact.</p>
      <div className="input-wrap">
        <input
          ref={inputRef}
          className="input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          maxLength={CLUE_MAX}
          placeholder="Ex. « croustillant »"
          autoComplete="off"
          enterKeyHint="send"
          onKeyDown={submitOnEnter}
          aria-label="Ton indice"
          aria-invalid={error ? true : undefined}
        />
        <span className={cls('input-count', length >= CLUE_MAX && 'is-full')} aria-hidden="true">
          {length}/{CLUE_MAX}
        </span>
      </div>
      <FormError message={error} />
      <button type="submit" className="btn btn-mint btn-lg btn-block" disabled={!length || busy}>
        {busy ? <Spinner /> : <Send size={19} />} Envoyer l’indice
      </button>
    </form>
  );
}

// ───────────────────────── 6. vote

export function VotePhase({ view }: { view: GameView }) {
  const round = roundOf(view);
  const ballot = round.ballot;
  const pmap = playersById(view);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!ballot) return null;

  const iAmVoter = ballot.voters.includes(view.me.id);
  const cycleClues = (id: string) =>
    round.clues
      .filter((c) => c.cycle === round.cycle && c.playerId === id)
      .map((c) => (c.mimed ? 'Mimé' : c.text === null ? 'Passé' : `« ${c.text} »`))
      .join(' · ');
  const tiedNames = ballot.candidates.map((id) => pmap.get(id)?.name ?? '?');

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    const res = await game.vote(ballot.id, target);
    setBusy(false);
    if (!res.ok) toast(res.error.message, 'warn');
  };

  return (
    <>
      <section className="card card-feature stack" aria-labelledby="vote-title">
        <div className="stack-sm">
          <p className="eyebrow">{ballot.runoff ? 'Égalité à départager' : `Tour ${round.cycle}`}</p>
          <h2 id="vote-title" className="display h2">
            {ballot.runoff ? 'Second scrutin' : 'Qui est l’intrus ?'}
          </h2>
          <p className="muted">
            {ballot.runoff
              ? `Seuls ${tiedNames.join(' et ')} peuvent être désignés. Tous les joueurs en jeu votent.`
              : 'Vote secret et définitif. Les choix seront révélés à la clôture.'}
          </p>
        </div>

        {view.me.special?.falafel === 'sabotaged' ? (
          <div className="notice notice-amber" role="status">
            <Sandwich size={18} />
            <span>Ton falafel était piégé : tu ne peux pas voter à ce tour de vote (second scrutin compris).</span>
          </div>
        ) : !iAmVoter ? (
          <div className="notice notice-muted">
            <Lock size={18} />
            <span>Tu observes ce scrutin : seuls les joueurs encore en jeu votent.</span>
          </div>
        ) : ballot.myVote ? (
          <div className="locked-vote" role="status">
            <Avatar avatar={pmap.get(ballot.myVote)?.avatar ?? 0} photo={pmap.get(ballot.myVote)?.photo} size={52} label="" />
            <div className="grow">
              <strong>Vote enregistré contre {pmap.get(ballot.myVote)?.name}</strong>
              <p className="subtle">Ton choix est définitif et reste secret jusqu’à la clôture.</p>
            </div>
            <span className="stamp" aria-hidden="true">
              <Lock size={14} strokeWidth={2.8} /> A voté
            </span>
          </div>
        ) : (
          <>
            <div className="vote-grid" role="group" aria-label="Choisis le joueur à éliminer">
              {ballot.candidates.map((id) => {
                const p = pmap.get(id);
                const self = id === view.me.id;
                return (
                  <button
                    key={id}
                    type="button"
                    className="vote-card"
                    aria-pressed={target === id}
                    disabled={self || busy}
                    onClick={() => setTarget(id)}
                    aria-label={self ? `${p?.name} (toi, impossible)` : `Voter contre ${p?.name}`}
                  >
                    {target === id && (
                      <span className="target-mark" aria-hidden="true">
                        <Crosshair size={14} strokeWidth={2.8} /> Ton choix
                      </span>
                    )}
                    <Avatar avatar={p?.avatar ?? 0} photo={p?.photo} size={60} label="" dimmed={self} />
                    <span className="vc-name">
                      {p?.name}
                      {self && ' (toi)'}
                    </span>
                    {!self && cycleClues(id) && <span className="vc-clues">{cycleClues(id)}</span>}
                  </button>
                );
              })}
            </div>
            <div className="sticky-cta">
              <button type="button" className="btn btn-danger-solid btn-lg btn-block" disabled={!target || busy} onClick={submit}>
                {busy ? <Spinner /> : <Vote size={20} />}
                {target ? `Voter contre ${pmap.get(target)?.name}` : 'Choisis un joueur'}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="card card-tight" aria-labelledby="voters-title">
        <div className="card-header" style={{ marginBottom: 10 }}>
          <h2 id="voters-title" className="card-title">
            <Vote size={18} /> Votes reçus
          </h2>
          <span className="pill pill-violet" aria-live="polite">
            {ballot.voted.length}/{ballot.voters.length}
          </span>
        </div>
        <div className="voters">
          {ballot.voters.map((id) => {
            const p = pmap.get(id);
            const has = ballot.voted.includes(id);
            return (
              <span key={id} className="voter" title={`${p?.name} ${has ? 'a voté' : 'n’a pas encore voté'}`}>
                <Avatar
                  avatar={p?.avatar ?? 0} photo={p?.photo}
                  size={40}
                  dimmed={!has}
                  badge={has ? 'check' : !p?.connected ? 'offline' : null}
                  label={`${p?.name}, ${has ? 'a voté' : 'n’a pas encore voté'}`}
                />
              </span>
            );
          })}
        </div>
        <p className="subtle" style={{ marginTop: 10 }}>
          Sans vote à la fin du temps, c’est une abstention.
        </p>
      </section>
    </>
  );
}

// ───────────────────────── 7. résultat de l'élimination

const ROLE_VERDICT: Record<Role, string> = {
  civil: 'Aïe… un Civil innocent quitte la partie.',
  undercover: 'Bien vu : un intrus est démasqué !',
  mrwhite: 'Mr. White est démasqué… mais il a une dernière chance.',
};

export function ResultPhase({ view }: { view: GameView }) {
  const round = roundOf(view);
  const result = round.result;
  const pmap = playersById(view);
  if (!result) return null;
  const outcome = result.outcome;
  const max = Math.max(1, ...result.tally.map((t) => t.votes));

  return (
    <>
      <section className="card card-feature" aria-live="polite">
        {outcome.type === 'eliminated' && (
          <div className="verdict">
            <p className="eyebrow">{result.runoff ? 'Second scrutin' : 'Le groupe a tranché'}</p>
            <div className="verdict-avatar">
              <Avatar avatar={pmap.get(outcome.playerId)?.avatar ?? 0} photo={pmap.get(outcome.playerId)?.photo} size={104} label="" />
              <span className="stamp stamp-out" aria-hidden="true">
                Éliminé
              </span>
            </div>
            <p className="verdict-name">{pmap.get(outcome.playerId)?.name}</p>
            <div className={cls('verdict-role', `role-${outcome.role}`)}>
              <RoleArt role={outcome.role} className="verdict-role-art" size={outcome.role === 'mrwhite' ? 52 : 70} />
              <span className="muted">était</span>
              <RoleChip role={outcome.role} large />
            </div>
            <p className="muted">{ROLE_VERDICT[outcome.role]}</p>
          </div>
        )}
        {(outcome.type === 'tie' || outcome.type === 'tie-persist') && (
          <div className="verdict">
            <span className="state-icon tone-yellow" aria-hidden="true">
              <Scale size={34} strokeWidth={2.3} />
            </span>
            <h2 className="display h2">{outcome.type === 'tie' ? 'Égalité !' : 'Égalité persistante'}</h2>
            <div className="tie-avatars">
              {outcome.tied.map((id) => (
                <div key={id} className="stack-sm" style={{ alignItems: 'center' }}>
                  <Avatar avatar={pmap.get(id)?.avatar ?? 0} photo={pmap.get(id)?.photo} size={64} label="" />
                  <strong>{pmap.get(id)?.name}</strong>
                </div>
              ))}
            </div>
            <p className="muted">
              {outcome.type === 'tie'
                ? 'Second scrutin dans un instant : seuls les ex æquo peuvent être désignés.'
                : 'Personne n’est éliminé. Nouveau tour d’indices !'}
            </p>
          </div>
        )}
        {outcome.type === 'protected' && (
          <div className="verdict">
            <span className="state-icon tone-mint" aria-hidden="true">
              <ShieldCheck size={34} strokeWidth={2.3} />
            </span>
            <h2 className="display h2">Falafel protecteur !</h2>
            <p className="muted">
              {pmap.get(outcome.playerId)?.name} avait reçu un falafel protecteur : l’élimination est annulée.
            </p>
          </div>
        )}
        {outcome.type === 'no-votes' && (
          <div className="verdict">
            <span className="state-icon tone-sky" aria-hidden="true">
              <Hourglass size={34} strokeWidth={2.3} />
            </span>
            <h2 className="display h2">Aucun vote exprimé</h2>
            <p className="muted">Personne n’est éliminé. Nouveau tour d’indices !</p>
          </div>
        )}
        {result.events.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <EventList view={view} events={result.events} />
          </div>
        )}
        <div className="stack-sm" style={{ marginTop: 18 }}>
          <ProgressBar view={view} />
          <p className="subtle center">
            <Seconds view={view} prefix="Suite dans" />
          </p>
        </div>
      </section>

      {result.votes.length > 0 && (
        <section className="card card-tight" aria-labelledby="tally-title">
          <div className="card-header">
            <h2 id="tally-title" className="card-title">
              <Vote size={18} /> Dépouillement
            </h2>
          </div>
          <div className="tally">
            {result.tally.map((t) => {
              const p = pmap.get(t.playerId);
              return (
                <div key={t.playerId} className="tally-row">
                  <Avatar avatar={p?.avatar ?? 0} photo={p?.photo} size={30} label="" />
                  <div className="tally-bar">
                    <span style={{ width: `${(t.votes / max) * 100}%`, opacity: t.votes ? 1 : 0 }} />
                    <em>{p?.name}</em>
                  </div>
                  <span className="tally-count">{t.votes}</span>
                </div>
              );
            })}
          </div>
          <hr className="divider" />
          <div className="ballot-detail">
            {result.votes.map((v) => {
              const voter = pmap.get(v.voterId);
              const target = v.targetId ? pmap.get(v.targetId) : null;
              return (
                <span key={v.voterId} className="ballot-chip">
                  <Avatar avatar={voter?.avatar ?? 0} photo={voter?.photo} size={22} label="" />
                  {voter?.name} → {target ? target.name : <em>abstention</em>}
                </span>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

// ───────────────────────── 8. tentative de Mr. White

export function MrWhitePhase({ view }: { view: GameView }) {
  const round = roundOf(view);
  const attempt = round.mrWhite;
  const pmap = playersById(view);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Tic-tac pour Mr. White pendant sa tentative ; silence dès sa réponse ou la fin du délai.
  useTickTock(attempt?.playerId === view.me.id && !attempt.resolved && !busy, view.deadline, view.paused);
  if (!attempt) return null;
  const mw = pmap.get(attempt.playerId);
  const isMe = attempt.playerId === view.me.id;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    stopTicking();
    setBusy(true);
    setError(null);
    const res = await game.guess(attempt.attemptId, text);
    setBusy(false);
    if (!res.ok) setError(res.error.message);
  };

  return (
    <section className="card card-feature center stack" aria-live="polite">
      <GhostArt className="art-float center-art" size={96} />
      {!attempt.resolved ? (
        isMe ? (
          <form className="stack" onSubmit={submit} noValidate>
            <div className="stack-sm">
              <p className="eyebrow">Dernière chance</p>
              <h2 className="display h2">Devine le mot des Civils</h2>
              <p className="muted">Un seul essai. Majuscules, accents et espaces en trop ne comptent pas.</p>
            </div>
            <div className="input-wrap">
              <input
                className="input"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError(null);
                }}
                maxLength={GUESS_MAX}
                placeholder="Le mot des Civils…"
                autoComplete="off"
                autoFocus
                onKeyDown={submitOnEnter}
                aria-label="Ta proposition"
              />
            </div>
            <FormError message={error} />
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={!text.trim() || busy}>
              {busy ? <Spinner /> : <Sparkles size={20} />} Tenter ma chance
            </button>
          </form>
        ) : (
          <div className="stack-sm">
            <p className="eyebrow">Dernière chance</p>
            <h2 className="display h2">{mw?.name} était Mr. White</h2>
            <p className="muted">Il tente de deviner le mot des Civils. S’il trouve, il gagne immédiatement…</p>
          </div>
        )
      ) : (
        <div className="stack-sm">
          <p className="eyebrow">Tentative de Mr. White</p>
          <h2 className="display h2 row" style={{ justifyContent: 'center' }}>
            <CircleX size={30} className="accent-coral" aria-hidden="true" /> Raté !
          </h2>
          <p className="muted">
            {attempt.guess ? (
              <>
                « <span className="quote">{attempt.guess}</span> » n’est pas le mot des Civils.
              </>
            ) : (
              'Temps écoulé : aucune proposition.'
            )}
          </p>
          <p className="subtle">La manche continue…</p>
        </div>
      )}
      <ProgressBar view={view} />
    </section>
  );
}

// ───────────────────────── 9. fin de manche et revanche

const VICTORY: Record<string, { title: string; icon: typeof Users; art: ReactNode }> = {
  civils: { title: 'Victoire des Civils', icon: Users, art: <CivilsArt size={130} /> },
  intrus: { title: 'Victoire des intrus', icon: VenetianMask, art: <MaskArt size={150} /> },
  mrwhite: { title: 'Mr. White l’emporte !', icon: Ghost, art: <GhostArt size={96} /> },
  lovers: { title: 'Victoire des Amoureux', icon: HeartHandshake, art: <HeartsArt size={130} /> },
  joyfool: { title: 'Le Fou de joie l’emporte !', icon: PartyPopper, art: <PartyArt size={120} /> },
  draw: {
    title: 'Manche nulle',
    icon: Swords,
    art: (
      <span className="state-icon tone-sky big">
        <Swords size={46} strokeWidth={2.2} />
      </span>
    ),
  },
};

export function EndPhase({ view }: { view: GameView }) {
  const round = roundOf(view);
  const end = round.end;
  const pmap = playersById(view);
  const [busy, setBusy] = useState(false);
  if (!end) return null;
  const isHost = view.hostId === view.me.id;
  const iWon = end.winners.includes(view.me.id);
  const myRole = end.roles.find((r) => r.playerId === view.me.id)?.role;
  const v = VICTORY[end.winnerSide];
  const eliminatedAt = new Map(round.eliminations.map((e) => [e.playerId, e.cycle]));

  const replay = async () => {
    setBusy(true);
    const res = await game.replay();
    setBusy(false);
    if (!res.ok) toast(res.error.message, 'warn');
  };

  const myLover = end.lovers?.includes(view.me.id) ?? false;
  const personal = !myRole
    ? 'Tu joueras la prochaine manche.'
    : end.winnerSide === 'draw'
      ? 'Personne ne gagne cette fois.'
      : iWon
        ? `Bravo, tu gagnes ${end.winnerSide === 'lovers' ? 'avec ton âme sœur' : end.winnerSide === 'joyfool' ? 'en Fou de joie' : `en tant que ${ROLE_LABEL[myRole]}`} !`
        : myLover
          ? 'Perdu : un camp a gagné avant que le couple ne reste seul.'
          : `Perdu cette fois : tu étais ${ROLE_LABEL[myRole]}.`;

  return (
    <>
      <section className={cls('card victory', `side-${end.winnerSide}`)} aria-live="polite">
        {iWon && end.winnerSide !== 'draw' && <Confetti />}
        <div className="victory-art" aria-hidden="true">
          {v.art}
        </div>
        <p className="eyebrow row" style={{ justifyContent: 'center' }}>
          <v.icon size={14} /> Manche {round.number} terminée
        </p>
        <h2 className="display victory-title">{v.title}</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          {end.reason}
        </p>
        <p className={cls('personal', iWon ? 'is-win' : myRole && end.winnerSide !== 'draw' && 'is-loss')}>
          {iWon && <Trophy size={18} aria-hidden="true" />}
          {personal}
        </p>
        {end.winnerSide === 'mrwhite' && end.mrWhiteGuess && (
          <p className="muted" style={{ marginTop: 6 }}>
            Il a trouvé : « <span className="quote">{end.mrWhiteGuess}</span> »
          </p>
        )}
      </section>

      <div className="stack-sm replay-block">
        {isHost ? (
          <button type="button" className="btn btn-primary btn-xl btn-block" onClick={replay} disabled={busy}>
            {busy ? <Spinner /> : <RefreshCw size={22} strokeWidth={2.6} />} Rejouer avec le même groupe
          </button>
        ) : (
          <div className="notice notice-violet" role="status">
            <Hourglass size={18} />
            <span>En attente de l’hôte pour lancer la revanche. Le salon et les paramètres sont conservés.</span>
          </div>
        )}
        <button
          type="button"
          className="btn btn-quiet btn-block"
          onClick={async () => {
            const res = await leaveRoom();
            if (res.ok) window.location.assign('/');
          }}
        >
          <LogOut size={18} /> Quitter le salon
        </button>
      </div>
      <section className="card card-tight stack-sm" aria-labelledby="words-title">
        <div className="row-between">
          <h2 id="words-title" className="card-title">
            <Lock size={18} /> Les mots secrets
          </h2>
          <span className="pill">{end.themeName ?? end.packName}</span>
        </div>
        <div className="words-reveal">
          <div className="word-tile role-civil">
            <span className="lbl">
              <Users size={13} /> Civils
            </span>
            <p className="w">{end.civilWord}</p>
          </div>
          <div className="word-tile role-undercover">
            <span className="lbl">
              <VenetianMask size={13} /> Undercover
            </span>
            <p className="w">{end.undercoverWord}</p>
          </div>
        </div>
        {end.mrWhiteGuess && end.winnerSide !== 'mrwhite' && (
          <p className="subtle">
            Proposition de Mr. White : « {end.mrWhiteGuess} »
          </p>
        )}
      </section>

      <section className="card card-tight" aria-labelledby="roles-title">
        <div className="card-header">
          <h2 id="roles-title" className="card-title">
            <VenetianMask size={18} /> Qui était qui ?
          </h2>
        </div>
        <ul className="stack-sm" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {end.roles.map(({ playerId, role, special }, i) => {
            const p: PublicPlayer | undefined = pmap.get(playerId);
            const won = end.winners.includes(playerId);
            const out = eliminatedAt.get(playerId);
            return (
              <li key={playerId} className={cls('final-row', won && 'is-winner')} style={{ animationDelay: `${0.05 * i}s` }}>
                <Avatar avatar={p?.avatar ?? 0} photo={p?.photo} size={40} label="" dimmed={out !== undefined} />
                <div className="grow">
                  <div className="player-name">
                    {p?.name ?? 'Joueur parti'}
                    {playerId === view.me.id && <span className="subtle"> (toi)</span>}
                  </div>
                  <div className="player-meta">{out !== undefined ? `Éliminé au tour ${out}` : 'Toujours en jeu'}</div>
                </div>
                <span className="rail-chips">
                  <RoleChip role={role} />
                  {special && <SpecialChip id={special} />}
                </span>
                {won && (
                  <span className="win-mark" role="img" aria-label="Gagnant">
                    <Trophy size={15} aria-hidden="true" />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {(end.lovers || end.duel || end.falafel) && (
        <section className="card card-tight stack-sm" aria-label="Liens et pouvoirs de la manche">
          {end.lovers && (
            <p className="row">
              <HeartHandshake size={18} className="accent-violet" />
              <span>
                Amoureux : <strong>{pmap.get(end.lovers[0])?.name}</strong> et <strong>{pmap.get(end.lovers[1])?.name}</strong>
              </span>
            </p>
          )}
          {end.duel && (
            <p className="row">
              <Swords size={18} className="accent-violet" />
              <span>
                Duel : <strong>{pmap.get(end.duel.playerIds[0])?.name}</strong> contre <strong>{pmap.get(end.duel.playerIds[1])?.name}</strong>
                {' — '}
                {end.duel.draw ? 'duel nul' : end.duel.winnerId ? `remporté par ${pmap.get(end.duel.winnerId)?.name}` : 'personne n’est tombé'}
              </span>
            </p>
          )}
          {end.falafel && (
            <p className="row">
              <Sandwich size={18} className="accent-violet" />
              <span>
                Falafel de <strong>{pmap.get(end.falafel.vendorId)?.name}</strong> pour <strong>{pmap.get(end.falafel.targetId)?.name}</strong> :{' '}
                {end.falafel.effect === 'protect' ? 'protecteur' : 'piégé'}
                {end.falafel.used ? ' (utilisé)' : ' (jamais utilisé)'}
              </span>
            </p>
          )}
        </section>
      )}

    </>
  );
}
