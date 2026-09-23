import { Eye, EyeOff, Ghost, VenetianMask } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { Secret } from '../../../shared/types';
import { cls } from '../lib/util';

/** Remasque dès que l'application passe en arrière-plan (onglet caché, autre application, fenêtre quittée). */
export function useConcealOnLeave(hide: () => void): void {
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hide();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', hide);
    window.addEventListener('pagehide', hide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', hide);
      window.removeEventListener('pagehide', hide);
    };
  }, [hide]);
}

function Guilloche() {
  return (
    <svg className="pattern" viewBox="0 0 200 280" fill="none" stroke="currentColor" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      {Array.from({ length: 14 }, (_, i) => (
        <ellipse key={i} cx="100" cy="140" rx={14 + i * 9} ry={20 + i * 12} strokeWidth="0.9" strokeDasharray={i % 2 ? '6 4' : '14 3'} />
      ))}
    </svg>
  );
}

export function SecretCard({
  secret,
  revealed,
  onReveal,
}: {
  secret: Secret;
  revealed: boolean;
  onReveal: () => void;
}) {
  return (
    <div className={cls('secret', revealed && 'is-revealed')}>
      <div className="secret-inner">
        <button
          type="button"
          className="secret-face secret-front"
          onClick={onReveal}
          aria-hidden={revealed}
          tabIndex={revealed ? -1 : 0}
          aria-label="Révéler ma carte secrète"
        >
          <Guilloche />
          <span className="seal">
            <VenetianMask size={46} strokeWidth={1.7} />
          </span>
          <span className="cta">Touche pour révéler</span>
          <span className="cta-sub">Cache ton écran des regards indiscrets</span>
        </button>
        <div className={cls('secret-face secret-back', secret.kind === 'mrwhite' && 'is-mrwhite')} aria-hidden={!revealed}>
          {revealed &&
            (secret.kind === 'word' ? (
              <>
                <VenetianMask className="secret-corner" size={22} aria-hidden="true" />
                <VenetianMask className="secret-corner br" size={22} aria-hidden="true" />
                <p className="eyebrow">Ton mot secret</p>
                <p className="secret-word">{secret.word}</p>
                <p className="muted" style={{ fontSize: '0.9rem', maxWidth: '26ch' }}>
                  Civil ou Undercover ? Écoute les autres pour le deviner… sans te trahir.
                </p>
              </>
            ) : (
              <>
                <span className="ghost-orb" style={{ width: 88, height: 88 }} aria-hidden="true">
                  <Ghost size={40} />
                </span>
                <p className="eyebrow" style={{ color: '#e2e8f0' }}>
                  Ton rôle
                </p>
                <p className="secret-word">Mr. White</p>
                <p className="muted" style={{ fontSize: '0.9rem', maxWidth: '28ch' }}>
                  Tu n’as pas de mot. Écoute les indices, fonds-toi dans la masse et devine le mot des Civils.
                </p>
              </>
            ))}
        </div>
      </div>
    </div>
  );
}

/** Rappel discret de la carte pendant la manche : masqué par défaut, remasqué automatiquement. */
export function SecretPeek({ secret }: { secret: Secret }) {
  const [shown, setShown] = useState(false);
  const hide = useCallback(() => setShown(false), []);
  useConcealOnLeave(hide);

  useEffect(() => {
    if (!shown) return;
    const id = window.setTimeout(hide, 6000);
    return () => window.clearTimeout(id);
  }, [shown, hide]);

  return (
    <div className="peek">
      <span className="pack-icon" style={{ background: 'rgba(139,92,246,.2)', color: 'var(--violet-3)' }} aria-hidden="true">
        {secret.kind === 'mrwhite' ? <Ghost size={20} /> : <VenetianMask size={20} />}
      </span>
      <div className="grow" aria-live="polite">
        <p className="subtle">{secret.kind === 'word' ? 'Ta carte' : 'Ton rôle'}</p>
        {shown ? (
          <p className="peek-word">{secret.kind === 'word' ? secret.word : 'Mr. White · aucun mot'}</p>
        ) : (
          <span className="peek-hidden" aria-label="Carte masquée">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        )}
      </div>
      <button type="button" className="btn btn-ghost btn-sm" aria-pressed={shown} onClick={() => setShown((v) => !v)}>
        {shown ? <EyeOff size={17} /> : <Eye size={17} />}
        {shown ? 'Masquer' : 'Voir'}
      </button>
    </div>
  );
}
