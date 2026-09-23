import {
  Eye,
  Gavel,
  Ghost,
  Hourglass,
  MessageSquareQuote,
  Trophy,
  UserX,
  Users,
  Vote,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import type { GameView, PublicPlayer, RoundView } from '../../../../shared/types';
import { Avatar } from '../../components/Avatar';
import { RoleChip } from '../../components/Chrome';
import { Timer } from '../../components/Timer';
import { cls, playersById } from '../../lib/util';
import { TopBar } from '../Room';
import { CluesPhase, EndPhase, MrWhitePhase, RevealPhase, ResultPhase, VotePhase } from './Phases';

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
      return { Icon: MessageSquareQuote, title: 'Indices', sub: `${manche} · Tour ${round.cycle}`, tone: 'mint' };
    case 'vote':
      return { Icon: Vote, title: round.ballot?.runoff ? 'Second scrutin' : 'Vote', sub: `${manche} · Tour ${round.cycle}` };
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
          <div key={phaseKey} className="phase-swap stack">
            {view.phase === 'reveal' && <RevealPhase view={view} />}
            {view.phase === 'clues' && <CluesPhase view={view} />}
            {view.phase === 'vote' && <VotePhase view={view} />}
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
  if (view.me.status === 'eliminated' && view.phase !== 'ended' && !lastChance) {
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
              avatar={p.avatar}
              size={44}
              dimmed={p.status === 'eliminated' || !p.connected}
              ring={p.id === current ? 'mint' : undefined}
              badge={badgeFor(p)}
              label=""
            />
            <span className="n" aria-hidden="true">
              {p.name}
              {p.id === view.me.id && ' (toi)'}
            </span>
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
              <p className="clue-cycle-title">Tour {cycle}</p>
              {round.clues
                .filter((c) => c.cycle === cycle)
                .map((c, i) => {
                  const p = pmap.get(c.playerId);
                  return (
                    <div className="clue" key={`${cycle}-${i}`}>
                      <Avatar avatar={p?.avatar ?? 0} size={34} label="" dimmed={p?.status === 'eliminated'} />
                      <div className="clue-body">
                        <p className="clue-author">{p?.name ?? 'Joueur parti'}</p>
                        {c.text === null ? (
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
