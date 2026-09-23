import type { GameView, PublicPlayer, Role } from '../../../shared/types';

export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export const ROLE_LABEL: Record<Role, string> = {
  civil: 'Civil',
  undercover: 'Undercover',
  mrwhite: 'Mr. White',
};

export function playersById(view: GameView): Map<string, PublicPlayer> {
  return new Map(view.players.map((p) => [p.id, p]));
}

export function inviteUrl(code: string): string {
  return `${window.location.origin}/r/${code}`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** Copie avec repli pour les contextes non sécurisés (HTTP sur réseau local). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* repli ci-dessous */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Entrée soumet le formulaire, y compris avec des claviers virtuels qui n'émettent pas d'événement de caractère. */
export function submitOnEnter(e: React.KeyboardEvent<HTMLInputElement>): void {
  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
  e.preventDefault();
  e.currentTarget.form?.requestSubmit();
}
