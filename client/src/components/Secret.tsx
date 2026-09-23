import { Eye, EyeOff } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Secret } from '../../../shared/types';
import { cls } from '../lib/util';
import { GhostArt, MaskArt } from './Illustrations';

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

/** Dos de carte : rayures et petits losanges, comme un jeu de cartes maison. */
function CardBack() {
  return (
    <svg className="pattern" viewBox="0 0 200 280" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="card-back-stripes" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="9" height="18" fill="#fff" opacity=".16" />
        </pattern>
      </defs>
      <rect width="200" height="280" fill="url(#card-back-stripes)" />
      <rect x="14" y="14" width="172" height="252" rx="16" fill="none" stroke="#2a1b12" strokeWidth="2.5" strokeDasharray="1 9" strokeLinecap="round" />
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
          <CardBack />
          <span className="corner-q" aria-hidden="true">?</span>
          <span className="corner-q br" aria-hidden="true">?</span>
          <span className="seal">
            <MaskArt size={96} />
          </span>
          <span className="cta">Touche pour retourner</span>
          <span className="cta-sub">Cache ton écran des regards indiscrets</span>
        </button>
        <div className={cls('secret-face secret-back', secret.kind === 'mrwhite' && 'is-mrwhite')} aria-hidden={!revealed}>
          {revealed &&
            (secret.kind === 'word' ? (
              <>
                <span className="secret-corner" aria-hidden="true">
                  <MaskArt size={34} />
                </span>
                <span className="secret-corner br" aria-hidden="true">
                  <MaskArt size={34} />
                </span>
                <p className="secret-label">Ton mot secret</p>
                <p className="secret-word">{secret.word}</p>
                <hr className="secret-rule" />
                <p className="secret-desc">{secret.description}</p>
                <p className="secret-foot">Civil ou Undercover ? Écoute les autres pour le deviner.</p>
              </>
            ) : (
              <>
                <GhostArt className="art-float" size={78} />
                <p className="secret-label">Ton rôle</p>
                <p className="secret-word">Mr. White</p>
                <p className="secret-desc">
                  Tu n’as pas de mot. Écoute les indices, fonds-toi dans la masse et devine le mot des Civils.
                </p>
                <div className="secret-theme">
                  <span className="lbl">Petit indice : le thème</span>
                  <span className="val">{secret.theme}</span>
                </div>
              </>
            ))}
        </div>
      </div>
    </div>
  );
}

/** Rappel discret de la carte pendant la manche : masqué par défaut, remasqué automatiquement. */
/** `extra` : informations privées complémentaires (rôle spécial), masquées avec la carte. */
export function SecretPeek({ secret, extra }: { secret: Secret; extra?: ReactNode }) {
  const [shown, setShown] = useState(false);
  const hide = useCallback(() => setShown(false), []);
  useConcealOnLeave(hide);

  useEffect(() => {
    if (!shown) return;
    const id = window.setTimeout(hide, 6000);
    return () => window.clearTimeout(id);
  }, [shown, hide]);

  return (
    <div className="stack-sm">
      <div className="peek">
        <span className="peek-icon" aria-hidden="true">
          {secret.kind === 'mrwhite' ? <GhostArt size={30} /> : <MaskArt size={36} />}
        </span>
        <div className="grow" aria-live="polite">
          <p className="peek-label">{secret.kind === 'word' ? 'Ta carte secrète' : 'Ton rôle'}</p>
          {shown ? (
            secret.kind === 'word' ? (
              <>
                <p className="peek-word">{secret.word}</p>
                <p className="peek-desc">{secret.description}</p>
              </>
            ) : (
              <>
                <p className="peek-word">Mr. White · aucun mot</p>
                <p className="peek-desc">Thème : {secret.theme}</p>
              </>
            )
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
      {shown && extra}
    </div>
  );
}
