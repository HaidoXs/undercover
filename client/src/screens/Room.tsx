import { ArrowLeft, ChevronRight, CircleHelp, CircleUserRound, LogOut, Moon, Music, SlidersHorizontal, Sun, Volume2, VolumeX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { GameView } from '../../../shared/types';
import { Brand, Spinner } from '../components/Chrome';
import { AccountButton, AccountPanel, ThemeToggle } from '../components/Account';
import { HelpButton, HelpContent } from '../components/Help';
import { Sheet } from '../components/Sheet';
import { setMusicEnabled, useAmbientMusic, useMusicEnabled } from '../lib/music';
import { setMuted, useMuted } from '../lib/sound';
import { pushPrefs, useAccount } from '../net/account';
import { setThemePref, useTheme } from '../lib/theme';
import type { SpecialRoleId } from '../../../shared/specialRoles';
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
        {/* Sur ordinateur, chaque réglage a son bouton ; sur téléphone, ils sont réunis dans un menu. */}
        <span className="topbar-tools">
          <MusicToggle />
          <SoundToggle />
        </span>
        <ThemeToggle />
        <span className="topbar-tools">
          <AccountButton />
          <HelpButton roles={view.settings.specialRoles} />
        </span>
        <SettingsMenu roles={view.settings.specialRoles} />
        <LeaveButton view={view} onLeft={onLeft} />
      </div>
    </header>
  );
}

/** Menu du téléphone : musique, tic-tac, thème, compte et règles, avec des lignes faciles à toucher. */
function SettingsMenu({ roles }: { roles: readonly SpecialRoleId[] }) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<'menu' | 'account' | 'help'>('menu');
  const music = useMusicEnabled();
  const muted = useMuted();
  const theme = useTheme();
  const account = useAccount();
  const close = () => {
    setOpen(false);
    setPanel('menu');
  };
  const title = panel === 'account' ? (account.status === 'signed-in' ? 'Mon compte' : 'Compte (facultatif)') : panel === 'help' ? 'Comment jouer' : 'Réglages';
  return (
    <>
      <button type="button" className="icon-btn topbar-menu" aria-label="Réglages, compte et aide" title="Réglages" onClick={() => setOpen(true)}>
        <SlidersHorizontal size={20} />
      </button>
      <Sheet open={open} onClose={close} title={title} icon={<SlidersHorizontal size={20} />}>
        {panel !== 'menu' && (
          <button type="button" className="btn btn-quiet btn-sm menu-back" onClick={() => setPanel('menu')}>
            <ArrowLeft size={17} /> Réglages
          </button>
        )}
        {panel === 'menu' && (
          <div className="menu-list">
            <button type="button" className="menu-row" aria-pressed={music} onClick={() => { setMusicEnabled(!music); pushPrefs(); }}>
              <Music size={20} /> <span className="grow">Musique d’ambiance</span> <span className="menu-state">{music ? 'Activée' : 'Coupée'}</span>
            </button>
            <button type="button" className="menu-row" aria-pressed={!muted} onClick={() => { setMuted(!muted); pushPrefs(); }}>
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />} <span className="grow">Tic-tac du chrono</span>{' '}
              <span className="menu-state">{muted ? 'Coupé' : 'Activé'}</span>
            </button>
            <button type="button" className="menu-row" onClick={() => { setThemePref(theme === 'dark' ? 'light' : 'dark'); pushPrefs(); }}>
              {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />} <span className="grow">Thème</span>{' '}
              <span className="menu-state">{theme === 'dark' ? 'Sombre' : 'Clair'}</span>
            </button>
            {account.config?.accounts && (
              <button type="button" className="menu-row" onClick={() => setPanel('account')}>
                <CircleUserRound size={20} /> <span className="grow">{account.status === 'signed-in' ? 'Mon compte' : 'Se connecter (facultatif)'}</span>
                <ChevronRight size={18} />
              </button>
            )}
            <button type="button" className="menu-row" onClick={() => setPanel('help')}>
              <CircleHelp size={20} /> <span className="grow">Comment jouer</span> <ChevronRight size={18} />
            </button>
          </div>
        )}
        {panel === 'account' && <AccountPanel onDone={close} />}
        {panel === 'help' && <HelpContent roles={roles} />}
      </Sheet>
    </>
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
      onClick={() => {
        setMusicEnabled(!on);
        pushPrefs();
      }}
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
      onClick={() => {
        setMuted(!muted);
        pushPrefs();
      }}
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
