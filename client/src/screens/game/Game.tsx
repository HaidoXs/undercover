import {
  Crosshair,
  Drama,
  Eye,
  Gavel,
  Ghost,
  Hourglass,
  MessageSquareQuote,
  Scale,
  Trophy,
  UserX,
  Users,
  Vote,
  WifiOff,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { specialRole } from '../../../../shared/specialRoles';
import type { GameView, PublicPlayer, RoundView } from '../../../../shared/types';
import { Avatar } from '../../components/Avatar';
import { RoleChip } from '../../components/Chrome';
import { Timer } from '../../components/Timer';
import { cls, playersById } from '../../lib/util';
import { TopBar } from '../Room';
import { CluesPhase, EndPhase, MrWhitePhase, RevealPhase, ResultPhase, VotePhase } from './Phases';
import { GhostBadge, PowerPhase, SpecialChip } from './Specials';

interface PhaseMeta {
  Icon: LucideIcon;
  title: string;
  sub: string;
  tone?: 'mint' | 'amber' | 'snow';
}

function phaseMeta(view: GameView, round: RoundView): PhaseMeta {
  const manche = `Manche ${round.number}`;
  switch (view.phase) {
    case 'reveal':
      return { Icon: Eye, title: 'Découverte', sub: manche };
    case 'clues':
      return {
        Icon: MessageSquareQuote,
        title: 'Indices',
        sub: round.clueRounds > 1 ? `${manche} · Tour ${round.clueRound}/${round.clueRounds} avant le vote` : `${manche} · Tour ${round.cycle}`,
        tone: 'mint',
      };
    case 'vote':
      return { Icon: Vote, title: round.ballot?.runoff ? 'Second scrutin' : 'Vote', sub: `${manche} · Tour ${round.cycle}` };
    case 'power':
      return round.power?.kind === 'avenger'
        ? { Icon: Crosshair, title: 'Vengeance', sub: `${manche} · Tour ${round.cycle}`, tone: 'amber' }
        : { Icon: Scale, title: 'Justice', sub: 'Départage des ex æquo', tone: 'amber' };
    case 'result':
      return { Icon: Gavel, title: 'Verdict', sub: `${manche} · Tour ${round.cycle}`, tone: 'amber' };
    case 'mrwhite':
      return { Icon: Ghost, title: 'Mr. White', sub: 'Dernière chance', tone: 'snow' };
    default:
      return { Icon: Trophy, title: 'Fin de manche', sub: manche, tone: 'amber' };
  }
}

export function GameScreen({ view, onLeft }: { view: GameView; onLeft: () => void }) {
  const round = view.round as RoundView;
  const meta = phaseMeta(view, round);
  const phaseKey = `${view.phase}-${round.id}-${round.cycle}-${round.ballot?.id ?? ''}-${round.result?.ballotId ?? ''}`;

  return (
    <div className="shell wide">
      <TopBar view={view} onLeft={onLeft}>
        <div className="phase-head grow" style={{ minWidth: 0 }}>
          <span className={cls('phase-badge', meta.tone && `tone-${meta.tone}`)} aria-hidden="true">
            <meta.Icon size={22} />
          </span>
          <div className="grow" style={{ minWidth: 0 }}>
            <p className="phase-title">{meta.title}</p>
            <p className="phase-sub">{meta.sub}</p>
          </div>
          <Timer view={view} />
        </div>
      </TopBar>
      <p className="sr-only" aria-live="polite">
        Phase : {meta.title}.
      </p>

      <div className="game-grid">
        <div className="stack">
          <StatusBanner view={view} />
          <TurnBanner view={view} meta={meta} />
          <div key={phaseKey} className="phase-swap stack">
            {view.phase === 'reveal' && <RevealPhase view={view} />}
            {view.phase === 'clues' && <CluesPhase view={view} />}
            {view.phase === 'vote' && <VotePhase view={view} />}
            {view.phase === 'power' && <PowerPhase view={view} />}
            {view.phase === 'result' && <ResultPhase view={view} />}
            {view.phase === 'mrwhite' && <MrWhitePhase view={view} />}
            {view.phase === 'ended' && <EndPhase view={view} />}
          </div>
        </div>
        {view.phase !== 'ended' && (
          <aside className="stack sticky-side" aria-label="Joueurs et indices">
            <PlayersPanel view={view} />
            <ClueLog view={view} />
          </aside>
        )}
      </div>
    </div>
  );
}

interface Expectation {
  who?: PublicPlayer;
  mine: boolean;
  title: string;
  action: string;
}

/** Qui doit agir, et quoi faire : lisible d'un coup d'œil, en tête de la colonne principale. */
function expectation(view: GameView): Expectation | null {
  const round = view.round as RoundView;
  const pmap = playersById(view);
  const playing = view.me.status === 'alive';
  switch (view.phase) {
    case 'reveal': {
      const total = view.players.filter((p) => p.status === 'alive').length;
      if (view.me.secret && !view.me.hasSeen)
        return { mine: true, title: 'À toi : découvre ta carte', action: 'En secret, puis confirme « J’ai mémorisé ».' };
      return { mine: false, title: 'Chacun découvre sa carte', action: `${round.seen.length}/${total} joueurs ont mémorisé leur mot.` };
    }
    case 'clues': {
      const who = round.turn ? pmap.get(round.turn.playerId) : undefined;
      const mime = !!who && round.memeId === who.id;
      const mine = !!who && who.id === view.me.id && playing;
      if (mine)
        return { who, mine, title: mime ? 'À toi de mimer !' : 'À toi de jouer !', action: mime ? 'Mime ton indice sans parler, puis valide.' : 'Écris un indice court, sans dire ton mot.' };
      if (!who) return { mine: false, title: 'Tour suivant…', action: 'Le prochain joueur arrive.' };
      return { who, mine, title: `Au tour de ${who.name}`, action: mime ? 'Mime en cours : regarde bien !' : 'Écoute son indice et cherche l’intrus.' };
    }
    case 'vote': {
      const ballot = round.ballot;
      if (!ballot) return null;
      const count = `${ballot.voted.length}/${ballot.voters.length} ont voté.`;
      const canVote = ballot.voters.includes(view.me.id) && view.me.special?.falafel !== 'sabotaged';
      if (canVote && !ballot.myVote) return { mine: true, title: 'À toi de voter !', action: `Choisis qui éliminer, puis confirme. ${count}` };
      if (ballot.myVote) return { mine: false, title: 'Vote enregistré', action: `En attente des autres : ${count}` };
      return { mine: false, title: ballot.runoff ? 'Second scrutin en cours' : 'Vote en cours', action: count };
    }
    case 'power': {
      const power = round.power;
      if (!power) return null;
      const who = pmap.get(power.actorId);
      const mine = power.actorId === view.me.id;
      const justice = power.kind === 'justice';
      return {
        who,
        mine,
        title: mine ? (justice ? 'À toi de trancher !' : 'À toi : choisis ta cible') : `${who?.name ?? 'Un joueur'} ${justice ? 'tranche…' : 'choisit sa cible…'}`,
        action: justice ? 'Désigner l’éliminé parmi les ex æquo.' : 'Emporter un joueur encore en vie.',
      };
    }
    case 'mrwhite': {
      const attempt = round.mrWhite;
      if (!attempt || attempt.resolved) return null;
      const who = pmap.get(attempt.playerId);
      const mine = attempt.playerId === view.me.id;
      return mine
        ? { who, mine, title: 'Dernière chance !', action: 'Devine le mot des Civils : un seul essai.' }
        : { who, mine, title: `${who?.name ?? 'Mr. White'} tente sa chance`, action: 'S’il trouve le mot des Civils, il gagne.' };
    }
    default:
      return null;
  }
}

function TurnBanner({ view, meta }: { view: GameView; meta: PhaseMeta }) {
  const exp = expectation(view);
  if (!exp) return null;
  return (
    <div key={`${view.phase}-${exp.who?.id ?? ''}-${exp.mine}`} className={cls('turn-banner', exp.mine && 'is-me')} role="status" aria-live="polite">
      {exp.who ? (
        <Avatar avatar={exp.who.avatar} photo={exp.who?.photo} size={50} ring={exp.mine ? 'active' : undefined} label="" />
      ) : (
        <span className="turn-banner-icon" aria-hidden="true">
          <meta.Icon size={24} />
        </span>
      )}
      <div className="grow">
        {exp.mine && <span className="turn-tag">Ton tour</span>}
        <p className="turn-title">{exp.title}</p>
        <p className="turn-action">{exp.action}</p>
      </div>
      {!exp.mine && exp.who && (
        <span className="typing" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
    </div>
  );
}

function StatusBanner({ view }: { view: GameView }) {
  if (view.paused) {
    return (
      <div className="notice notice-amber" role="status">
        <WifiOff size={18} />
        <span>Partie en pause : tous les joueurs étaient déconnectés. Elle reprend automatiquement.</span>
      </div>
    );
  }
  if (view.me.status === 'waiting' && view.phase !== 'ended') {
    return (
      <div className="notice notice-violet" role="status">
        <Hourglass size={18} />
        <span>Manche en cours : tu suis la partie en spectateur et tu joueras dès la prochaine.</span>
      </div>
    );
  }
  const lastChance = view.phase === 'mrwhite' && view.round?.mrWhite?.playerId === view.me.id;
  const deciding = view.phase === 'power' && view.round?.power?.actorId === view.me.id;
  if (view.me.status === 'eliminated' && view.phase !== 'ended' && view.round?.ghostId === view.me.id && !lastChance && !deciding) {
    return (
      <div className="notice notice-mint" role="status">
        <Wind size={18} />
        <span>Tu es le Fantôme : éliminé, tu peux encore discuter et voter, sans donner d’indice.</span>
      </div>
    );
  }
  if (view.me.status === 'eliminated' && view.phase !== 'ended' && !lastChance && !deciding) {
    return (
      <div className="notice notice-muted" role="status">
        <UserX size={18} />
        <span>Tu as été éliminé : tu peux suivre la fin de la manche, sans voter ni donner d’indice.</span>
      </div>
    );
  }
  return null;
}

// ───────────────────────── panneau des joueurs

function PlayersPanel({ view }: { view: GameView }) {
  const round = view.round as RoundView;
  const current = round.turn?.playerId;
  const voted = new Set(round.ballot?.voted ?? []);
  const participants = view.players.filter((p) => p.status === 'alive' || p.status === 'eliminated');
  const waiting = view.players.filter((p) => p.status === 'waiting');

  const badgeFor = (p: PublicPlayer) => {
    if (p.status === 'eliminated') return 'out' as const;
    if (!p.connected) return 'offline' as const;
    if (view.phase === 'vote' && voted.has(p.id)) return 'check' as const;
    if (view.phase === 'reveal' && round.seen.includes(p.id)) return 'check' as const;
    return null;
  };

  const describe = (p: PublicPlayer) => {
    const parts = [p.name];
    if (p.id === view.me.id) parts.push('toi');
    if (p.isHost) parts.push('hôte');
    if (p.status === 'eliminated') parts.push('éliminé');
    if (!p.connected) parts.push('hors ligne');
    if (p.id === current) parts.push('joue en ce moment');
    if (p.special) parts.push(`rôle spécial public : ${specialRole(p.special).name}`);
    if (round.memeId === p.id) parts.push('doit mimer son indice');
    if (round.ghostId === p.id) parts.push('vote encore');
    if (view.phase === 'vote' && voted.has(p.id)) parts.push('a voté');
    return parts.join(', ');
  };

  return (
    <section className="card card-tight" aria-labelledby="panel-players">
      <div className="card-header" style={{ marginBottom: 8 }}>
        <h2 id="panel-players" className="card-title">
          <Users size={18} /> Joueurs
        </h2>
        <span className="pill">{participants.filter((p) => p.status === 'alive').length} en jeu</span>
      </div>
      <ul className="rail" style={{ listStyle: 'none', margin: 0 }}>
        {participants.map((p) => (
          <li
            key={p.id}
            className={cls('rail-item', p.id === current && 'is-current', p.status === 'eliminated' && 'is-out')}
            aria-label={describe(p)}
          >
            <Avatar
              avatar={p.avatar} photo={p?.photo}
              size={44}
              dimmed={p.status === 'eliminated' || !p.connected}
              ring={p.id === current ? 'active' : undefined}
              badge={badgeFor(p)}
              label=""
            />
            <span className="n" aria-hidden="true">
              {p.name}
              {p.id === view.me.id && ' (toi)'}
            </span>
            {(p.special || round.memeId === p.id || round.ghostId === p.id) && (
              <span className="rail-chips" aria-hidden="true">
                {p.special && <SpecialChip id={p.special} />}
                {round.memeId === p.id && (
                  <span className="special-chip amber">
                    <Drama size={12} /> Mime
                  </span>
                )}
                {round.ghostId === p.id && <GhostBadge />}
              </span>
            )}
            {p.role && (
              <span className="rail-extra" aria-hidden="true">
                <RoleChip role={p.role} />
              </span>
            )}
          </li>
        ))}
      </ul>
      {waiting.length > 0 && (
        <p className="subtle" style={{ marginTop: 8 }}>
          En attente de la prochaine manche : {waiting.map((p) => p.name).join(', ')}
        </p>
      )}
    </section>
  );
}

// ───────────────────────── historique des indices

export function ClueLog({ view, compact }: { view: GameView; compact?: boolean }) {
  const round = view.round as RoundView;
  const pmap = playersById(view);
  // Pendant les indices, le tour en cours est déjà présenté en cartes horizontales : on n'affiche ici que les tours précédents.
  const duringClues = view.phase === 'clues';
  const cycles = [...new Set(round.clues.map((c) => c.cycle))]
    .filter((cycle) => !duringClues || cycle !== round.cycle)
    .sort((a, b) => b - a);
  if (duringClues && cycles.length === 0) return null;

  return (
    <section className="card card-tight" aria-labelledby="panel-clues">
      <div className="card-header" style={{ marginBottom: 10 }}>
        <h2 id="panel-clues" className="card-title">
          <MessageSquareQuote size={18} /> {duringClues ? 'Tours précédents' : 'Historique des indices'}
        </h2>
      </div>
      {cycles.length === 0 ? (
        <p className="subtle">Aucun indice pour l’instant. Le premier joueur réfléchit…</p>
      ) : (
        <div className="clue-log">
          {cycles.slice(0, compact ? 1 : undefined).map((cycle) => (
            <div key={cycle}>
              <p className="clue-cycle-title">Tour d’indices {cycle}</p>
              {round.clues
                .filter((c) => c.cycle === cycle)
                .map((c, i) => {
                  const p = pmap.get(c.playerId);
                  return (
                    <div className="clue" key={`${cycle}-${i}`}>
                      <Avatar avatar={p?.avatar ?? 0} photo={p?.photo} size={34} label="" dimmed={p?.status === 'eliminated'} />
                      <div className="clue-body">
                        <p className="clue-author">{p?.name ?? 'Joueur parti'}</p>
                        {c.mimed ? (
                          <p className="clue-text cc-mime">
                            <Drama size={15} aria-hidden="true" /> Mimé
                          </p>
                        ) : c.text === null ? (
                          <p className="clue-text is-passed">Passé</p>
                        ) : (
                          <p className="clue-text">« {c.text} »</p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
