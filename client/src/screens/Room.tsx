import { LogOut, Music, Volume2, VolumeX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { GameView } from '../../../shared/types';
import { Brand, Spinner } from '../components/Chrome';
import { HelpButton } from '../components/Help';
import { Sheet } from '../components/Sheet';
import { setMusicEnabled, useAmbientMusic, useMusicEnabled } from '../lib/music';
import { setMuted, useMuted } from '../lib/sound';
import { leaveRoom } from '../net/controller';
import { toast } from '../state/store';
import { GameScreen } from './game/Game';
import { Lobby } from './Lobby';

export function RoomScreen({ view, onLeft }: { view: GameView; onLeft: () => void }) {
  useAmbientMusic();
  return view.phase === 'lobby' ? <Lobby view={view} onLeft={onLeft} /> : <GameScreen view={view} onLeft={onLeft} />;
}

export function TopBar({ view, onLeft, children }: { view: GameView; onLeft: () => void; children?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        {children ?? (
          <>
            <Brand />
            <span className="grow" />
            <span className="code-chip" aria-label={`Code du salon ${view.code.split('').join(' ')}`}>
              {view.code}
            </span>
          </>
        )}
        <MusicToggle />
        <SoundToggle />
        <HelpButton roles={view.settings.specialRoles} />
        <LeaveButton view={view} onLeft={onLeft} />
      </div>
    </header>
  );
}

/** Musique d'ambiance : coupée ou relancée à tout moment, choix mémorisé sur cet appareil. */
function MusicToggle() {
  const on = useMusicEnabled();
  return (
    <button
      type="button"
      className={on ? 'icon-btn' : 'icon-btn is-off'}
      aria-pressed={!on}
      aria-label={on ? 'Couper la musique' : 'Remettre la musique'}
      title={on ? 'Couper la musique' : 'Remettre la musique'}
      onClick={() => setMusicEnabled(!on)}
    >
      <Music size={19} />
    </button>
  );
}

/** Coupe ou réactive les sons ; le choix est mémorisé sur cet appareil. */
function SoundToggle() {
  const muted = useMuted();
  return (
    <button
      type="button"
      className="icon-btn"
      aria-pressed={muted}
      aria-label={muted ? 'Réactiver le tic-tac' : 'Couper le tic-tac'}
      title={muted ? 'Réactiver le tic-tac' : 'Couper le tic-tac'}
      onClick={() => setMuted(!muted)}
    >
      {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
    </button>
  );
}

function LeaveButton({ view, onLeft }: { view: GameView; onLeft: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const inRound = view.me.status === 'alive';

  const leave = async () => {
    setBusy(true);
    const res = await leaveRoom();
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      onLeft();
    } else {
      toast(res.error.message, 'warn');
    }
  };

  return (
    <>
      <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label="Quitter le salon" title="Quitter le salon">
        <LogOut size={20} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Quitter le salon ?" icon={<LogOut size={20} />}>
        <div className="stack">
          <p className="muted">
            {inRound
              ? 'Tu es en pleine manche : ta place reste visible jusqu’à la fin, mais tes tours seront passés et tes votes comptés comme abstentions.'
              : 'Tu pourras revenir avec le code du salon, sous un nouveau pseudo si besoin.'}
          </p>
          {view.hostId === view.me.id && (
            <p className="notice notice-amber">Le rôle d’hôte passera au joueur connecté arrivé le plus tôt.</p>
          )}
          <div className="stack-sm">
            <button type="button" className="btn btn-danger btn-block" onClick={leave} disabled={busy}>
              {busy ? <Spinner /> : <LogOut size={18} />} Quitter le salon
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setOpen(false)}>
              Rester
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
