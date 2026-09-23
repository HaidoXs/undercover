import { Check, Crosshair, Drama, Gavel, HeartCrack, Scale, ShieldCheck, Sandwich, Swords, Undo2, UserX, Wind } from 'lucide-react';
import { useState } from 'react';
import { specialRole } from '../../../../shared/specialRoles';
import type { GameView, PublicPlayer, ResolutionEvent, RoundView } from '../../../../shared/types';
import { Avatar } from '../../components/Avatar';
import { RoleChip, Spinner } from '../../components/Chrome';
import { SPECIAL_ICON } from '../../components/icons';
import { RoleInfoButton } from '../../components/RoleInfo';
import { ProgressBar } from '../../components/Timer';
import { stopTicking, useTickTock } from '../../lib/sound';
import { cls, playersById } from '../../lib/util';
import { game } from '../../net/controller';
import { toast } from '../../state/store';

const nameOf = (pmap: Map<string, PublicPlayer>, id: string | null | undefined) => (id ? (pmap.get(id)?.name ?? 'un joueur') : '…');

// ───────────────────────── rôle privé

/** Rôle spécial du joueur, avec sa fiche ⓘ. Affiché uniquement quand la carte privée est visible. */
export function MyRolePanel({ view }: { view: GameView }) {
  const special = view.me.special;
  const round = view.round as RoundView;
  const pmap = playersById(view);
  if (!special) return null;
  const lines: string[] = [];
  if (special.role === 'lovers') lines.push(`Ton âme sœur : ${nameOf(pmap, special.partnerId)}. Vous gagnez seuls si vous êtes les deux derniers en vie.`);
  if (special.role === 'duelists') lines.push(`Ton adversaire : ${nameOf(pmap, special.partnerId)}. Le premier éliminé perd le duel.`);
  if (special.role === 'justice') lines.push('Ton identité est publique : tu tranches les égalités.');
  if (special.role === 'falafel' && special.falafelTargetId) lines.push(`Falafel offert à ${nameOf(pmap, special.falafelTargetId)}. Son effet reste secret.`);
  if (special.role && !['lovers', 'duelists', 'justice', 'falafel'].includes(special.role)) lines.push(specialRole(special.role).tagline);
  if (special.falafel === 'received') lines.push('Tu as reçu un falafel mystère : son effet se révélera au moment utile.');
  if (special.falafel === 'sabotaged') lines.push('Ton falafel était piégé : tu ne peux pas voter à ce tour de vote.');
  const Icon = special.role ? SPECIAL_ICON[special.role] : Sandwich;
  return (
    <div className="my-role">
      <span className="role-dot" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="grow">
        <span className="lbl">{special.role ? 'Ton rôle spécial' : 'Falafel'}</span>
        <span className="val">{special.role ? specialRole(special.role).name : 'Falafel mystère'}</span>
        {lines.map((l) => (
          <span key={l} className="extra">
            {l}
          </span>
        ))}
      </span>
      {special.role && <RoleInfoButton roleId={special.role} />}
      {!special.role && special.falafel && <RoleInfoButton roleId="falafel" />}
      {round.memeId === view.me.id && <RoleInfoButton roleId="meme" />}
    </div>
  );
}

/** Le Vendeur de Falafels choisit son bénéficiaire pendant la découverte des cartes. */
export function FalafelPicker({ view }: { view: GameView }) {
  const round = view.round as RoundView;
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (view.me.special?.role !== 'falafel' || view.me.special.falafelTargetId) return null;
  const others = view.players.filter((p) => p.id !== view.me.id && (p.status === 'alive' || p.status === 'eliminated'));
  const give = async () => {
    if (!target) return;
    setBusy(true);
    const res = await game.falafel(round.id, target);
    setBusy(false);
    if (!res.ok) toast(res.error.message, 'warn');
  };
  return (
    <div className="stack-sm" style={{ textAlign: 'left' }}>
      <p className="h3">Offre ton falafel</p>
      <p className="subtle">Choisis un joueur. L’effet, protecteur ou piégé, est tiré en secret par le serveur.</p>
      <div className="power-grid" role="group" aria-label="Bénéficiaire du falafel">
        {others.map((p) => (
          <button key={p.id} type="button" className="vote-card" aria-pressed={target === p.id} onClick={() => setTarget(p.id)} disabled={busy}>
            <Avatar avatar={p.avatar} size={44} label="" />
            <span className="vc-name">{p.name}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-mint btn-block" disabled={!target || busy} onClick={give}>
        {busy ? <Spinner /> : <Sandwich size={18} />} {target ? `Offrir à ${nameOf(playersById(view), target)}` : 'Choisis un joueur'}
      </button>
    </div>
  );
}

// ───────────────────────── Mr. Meme

export function MemeForm({ view, turnId }: { view: GameView; turnId: string }) {
  const [busy, setBusy] = useState(false);
  useTickTock(!busy, view.deadline, view.paused);
  const done = async () => {
    stopTicking();
    setBusy(true);
    const res = await game.mime(turnId);
    setBusy(false);
    if (!res.ok) toast(res.error.message, 'warn');
  };
  return (
    <div className="card meme-form stack-sm">
      <div className="row-between">
        <h2 className="h3 row">
          <Drama size={20} className="accent-violet" /> Tu es Mr. Meme ce tour-ci
        </h2>
        <RoleInfoButton roleId="meme" />
      </div>
      <p className="muted">Mime ton indice sans parler ni écrire. Quand tu as fini, préviens tout le monde.</p>
      <button type="button" className="btn btn-mint btn-lg btn-block" onClick={done} disabled={busy}>
        {busy ? <Spinner /> : <Check size={20} strokeWidth={3} />} Mime terminé
      </button>
    </div>
  );
}

// ───────────────────────── Justice et Vengeuse

export function PowerPhase({ view }: { view: GameView }) {
  const round = view.round as RoundView;
  const power = round.power;
  const pmap = playersById(view);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!power) return null;
  const actor = pmap.get(power.actorId);
  const isMe = power.actorId === view.me.id;
  const justice = power.kind === 'justice';

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    const res = await game.power(power.id, target);
    setBusy(false);
    if (!res.ok) toast(res.error.message, 'warn');
  };

  return (
    <>
      <section className="card card-glow stack" aria-live="polite">
        <div className="stack-sm center">
          <span className="state-icon" aria-hidden="true" style={{ margin: '0 auto' }}>
            {justice ? <Scale size={32} /> : <Crosshair size={32} />}
          </span>
          <p className="eyebrow row" style={{ justifyContent: 'center' }}>
            {justice ? 'Égalité en tête du scrutin' : 'Dernier souffle'}
            <RoleInfoButton roleId={justice ? 'justice' : 'avenger'} />
          </p>
          <h2 className="display h2">
            {justice
              ? isMe
                ? 'À toi de trancher'
                : `${actor?.name ?? 'La Justice'} tranche…`
              : isMe
                ? 'Qui emportes-tu ?'
                : `${actor?.name ?? 'La Vengeuse'} choisit sa cible…`}
          </h2>
          <p className="muted">
            {justice
              ? 'La Déesse de la Justice désigne l’éliminé parmi les ex æquo. Sans décision à temps, un second scrutin a lieu.'
              : 'La Vengeuse éliminée peut emporter un joueur encore en vie. Sans choix à temps, elle renonce.'}
          </p>
        </div>
        {isMe ? (
          <>
            <div className="power-grid" role="group" aria-label={justice ? 'Ex æquo' : 'Joueurs en vie'}>
              {power.candidates.map((id) => {
                const p = pmap.get(id);
                return (
                  <button key={id} type="button" className="vote-card" aria-pressed={target === id} onClick={() => setTarget(id)} disabled={busy}>
                    <Avatar avatar={p?.avatar ?? 0} size={52} label="" />
                    <span className="vc-name">
                      {p?.name}
                      {id === view.me.id && ' (toi)'}
                    </span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!target || busy} onClick={confirm}>
              {busy ? <Spinner /> : justice ? <Gavel size={20} /> : <Crosshair size={20} />}
              {target ? `${justice ? 'Éliminer' : 'Emporter'} ${nameOf(pmap, target)}` : 'Choisis un joueur'}
            </button>
          </>
        ) : (
          <div className="tie-avatars">
            {power.candidates.slice(0, justice ? undefined : 0).map((id) => (
              <div key={id} className="stack-sm" style={{ alignItems: 'center' }}>
                <Avatar avatar={pmap.get(id)?.avatar ?? 0} size={60} label="" />
                <strong>{pmap.get(id)?.name}</strong>
              </div>
            ))}
          </div>
        )}
        <ProgressBar view={view} />
      </section>
      {power.events.length > 0 && (
        <section className="card card-tight">
          <EventList view={view} events={power.events} />
        </section>
      )}
    </>
  );
}

// ───────────────────────── journal de résolution

/** Tournures sans accord : le genre des joueurs est inconnu. */
const CAUSE: Record<string, [string, string]> = {
  vote: ['Vote : ', ' quitte la partie.'],
  justice: ['Décision de la Justice : ', ' quitte la partie.'],
  lovers: ['Chagrin d’amour : ', ' suit son âme sœur et quitte la partie.'],
  avenger: ['Vengeance : ', ' quitte la partie.'],
};

export function EventList({ view, events }: { view: GameView; events: ResolutionEvent[] }) {
  const pmap = playersById(view);
  const n = (id: string) => <strong>{nameOf(pmap, id)}</strong>;
  return (
    <ul className="events" aria-label="Déroulé de la résolution">
      {events.map((e, i) => {
        switch (e.type) {
          case 'boomerang':
            return (
              <li key={i}>
                <Undo2 size={18} />
                <span>
                  Boomerang ! Les votes contre {n(e.playerId)} reviennent à leurs auteurs.
                </span>
              </li>
            );
          case 'protected':
            return (
              <li key={i}>
                <ShieldCheck size={18} />
                <span>Falafel protecteur : {n(e.playerId)} échappe à l’élimination.</span>
              </li>
            );
          case 'justice':
            return (
              <li key={i}>
                <Scale size={18} />
                <span>
                  La Déesse de la Justice ({n(e.actorId)}) tranche : {n(e.chosenId)}.
                </span>
              </li>
            );
          case 'justice-timeout':
            return (
              <li key={i}>
                <Scale size={18} />
                <span>La Justice n’a pas tranché à temps : second scrutin.</span>
              </li>
            );
          case 'eliminated':
            return (
              <li key={i}>
                {e.cause === 'lovers' ? <HeartCrack size={18} /> : e.cause === 'avenger' ? <Crosshair size={18} /> : <UserX size={18} />}
                <span className="grow">
                  {CAUSE[e.cause][0]}
                  {n(e.playerId)}
                  {CAUSE[e.cause][1]}{' '}
                  <span className="row" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <RoleChip role={e.role} />
                    {e.special && <SpecialChip id={e.special} />}
                  </span>
                </span>
              </li>
            );
          case 'avenger-pass':
            return (
              <li key={i}>
                <Crosshair size={18} />
                <span>{n(e.playerId)}, la Vengeuse, renonce à se venger.</span>
              </li>
            );
          case 'duel':
            return (
              <li key={i}>
                <Swords size={18} />
                <span>
                  Duel remporté par {n(e.winnerId)} face à {n(e.loserId)} !
                </span>
              </li>
            );
          case 'duel-draw':
            return (
              <li key={i}>
                <Swords size={18} />
                <span>
                  Duel nul : {n(e.playerIds[0])} et {n(e.playerIds[1])} sont tombés ensemble.
                </span>
              </li>
            );
          default:
            return null;
        }
      })}
    </ul>
  );
}

export function SpecialChip({ id, tone }: { id: Parameters<typeof specialRole>[0]; tone?: 'mint' | 'amber' }) {
  const Icon = SPECIAL_ICON[id];
  return (
    <span className={cls('special-chip', tone)} title={specialRole(id).name}>
      <Icon size={12} aria-hidden="true" />
      <span className="chip-label">{specialRole(id).name}</span>
    </span>
  );
}

export function GhostBadge() {
  return (
    <span className="special-chip mint" title="Fantôme : vote encore">
      <Wind size={12} aria-hidden="true" /> <span className="chip-label">Vote encore</span>
    </span>
  );
}
