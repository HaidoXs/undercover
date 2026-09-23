/**
 * Tic-tac du chrono : fenêtre des 10 dernières secondes, accélération sur les 5 dernières,
 * arrêt immédiat, jamais deux tic-tac en même temps, silence quand le son est coupé.
 * Son des boutons : une fois par activation, jamais sur un bouton désactivé, soumis au même réglage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type SoundModule = typeof import('../client/src/lib/sound');

let clicks: number[];
let handlers: Record<string, () => void>;
let sound: SoundModule;

class FakeAudioContext {
  state = 'suspended';
  currentTime = 0;
  destination = {};
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  createOscillator() {
    const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
    return {
      type: '',
      frequency: param,
      connect: (node: unknown) => node,
      start: () => clicks.push(Date.now()),
      stop() {},
    };
  }
  createGain() {
    const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
    return { gain: param, connect: (node: unknown) => node };
  }
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  clicks = [];
  handlers = {};
  const storage = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    AudioContext: FakeAudioContext,
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) },
    addEventListener: (type: string, fn: () => void) => (handlers[type] = fn),
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
  };
  docHandlers = {};
  (globalThis as unknown as { document: unknown }).document = {
    addEventListener: (type: string, fn: (e: { target: unknown }) => void) => (docHandlers[type] = fn),
  };
  vi.resetModules();
  sound = await import('../client/src/lib/sound');
  sound.installAudioUnlock();
  sound.installClickSound();
});

let docHandlers: Record<string, (e: { target: unknown }) => void>;

/** Élément minimal : un bouton (éventuellement désactivé) ou un élément quelconque hors bouton. */
function element(kind: 'button' | 'other', opts: { disabled?: boolean; ariaDisabled?: boolean } = {}) {
  const el = {
    closest: (sel: string) => (kind === 'button' && sel.includes('button') ? el : null),
    matches: (sel: string) => sel === ':disabled' && !!opts.disabled,
    getAttribute: (name: string) => (name === 'aria-disabled' && opts.ariaDisabled ? 'true' : null),
  };
  return el;
}

/** Une activation, puis une pause avant la suivante. */
function press(target: unknown) {
  docHandlers.click({ target });
  vi.advanceTimersByTime(100);
}

afterEach(() => {
  sound.stopTicking();
  vi.useRealTimers();
});

const secondsLeft = (deadline: number) => clicks.map((t) => Math.round((deadline - t) / 10) / 100);

describe('tic-tac', () => {
  it('reste muet tant qu’aucun geste n’a débloqué l’audio', () => {
    const deadline = Date.now() + 8_000;
    sound.startTicking(() => deadline - Date.now());
    vi.advanceTimersByTime(9_000);
    expect(clicks).toHaveLength(0);
  });

  it('bat chaque seconde de 10 à 5 s, un peu plus vite ensuite, puis s’arrête seul', () => {
    handlers.pointerdown();
    const deadline = Date.now() + 15_000;
    sound.startTicking(() => deadline - Date.now());
    vi.advanceTimersByTime(4_990);
    expect(clicks).toHaveLength(0);
    vi.advanceTimersByTime(20_000);
    const left = secondsLeft(deadline);
    expect(left.slice(0, 6)).toEqual([10, 9, 8, 7, 6, 5]);
    const fast = left.slice(6);
    expect(fast.length).toBe(7);
    for (let i = 1; i < fast.length; i++) expect(Math.round((fast[i - 1] - fast[i]) * 100)).toBe(65);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('s’arrête immédiatement à la validation', () => {
    handlers.pointerdown();
    const deadline = Date.now() + 10_000;
    const stop = sound.startTicking(() => deadline - Date.now());
    vi.advanceTimersByTime(2_500);
    const before = clicks.length;
    stop();
    vi.advanceTimersByTime(10_000);
    expect(clicks.length).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ne superpose jamais deux tic-tac', () => {
    handlers.pointerdown();
    const first = Date.now() + 10_000;
    const stopFirst = sound.startTicking(() => first - Date.now());
    vi.advanceTimersByTime(1_000);
    const second = Date.now() + 10_000;
    sound.startTicking(() => second - Date.now());
    stopFirst(); // l'arrêt périmé du premier ne coupe pas le second
    vi.advanceTimersByTime(3_000);
    expect(vi.getTimerCount()).toBe(1);
    expect(secondsLeft(second).slice(-4)).toEqual([10, 9, 8, 7]);
  });

  it('respecte le son coupé, mémorisé sur l’appareil', async () => {
    handlers.pointerdown();
    sound.setMuted(true);
    const deadline = Date.now() + 6_000;
    sound.startTicking(() => deadline - Date.now());
    vi.advanceTimersByTime(3_000);
    expect(clicks).toHaveLength(0);
    sound.setMuted(false);
    vi.advanceTimersByTime(1_000);
    expect(clicks.length).toBeGreaterThan(0);
    sound.setMuted(true);
    vi.resetModules();
    const reloaded = await import('../client/src/lib/sound');
    expect(reloaded.isMuted()).toBe(true);
  });
});

describe('son des boutons', () => {
  it('joue un seul son discret par activation d’un bouton, seulement une fois l’audio débloqué', () => {
    press(element('button'));
    expect(clicks).toHaveLength(0);
    handlers.pointerdown();
    press(element('button'));
    expect(clicks).toHaveLength(1);
    press(element('button'));
    expect(clicks).toHaveLength(2);
  });

  it('ignore les boutons désactivés, les éléments qui ne sont pas des boutons et le survol', () => {
    handlers.pointerdown();
    press(element('button', { disabled: true }));
    press(element('button', { ariaDisabled: true }));
    press(element('other'));
    expect(clicks).toHaveLength(0);
    expect(Object.keys(docHandlers)).toEqual(['click']);
  });

  it('ne double jamais le son d’une même activation', () => {
    handlers.pointerdown();
    const button = element('button');
    docHandlers.click({ target: button });
    docHandlers.click({ target: button });
    vi.advanceTimersByTime(1);
    expect(clicks).toHaveLength(1);
  });

  it('respecte le son coupé, y compris pour le bouton qui coupe le son', () => {
    handlers.pointerdown();
    sound.setMuted(true);
    press(element('button'));
    expect(clicks).toHaveLength(0);
    // Le bouton « Réactiver les sons » : le réglage change pendant le clic, le son suit le nouvel état.
    docHandlers.click({ target: element('button') });
    sound.setMuted(false);
    vi.advanceTimersByTime(1);
    expect(clicks).toHaveLength(1);
    vi.advanceTimersByTime(100);
    docHandlers.click({ target: element('button') });
    sound.setMuted(true);
    vi.advanceTimersByTime(1);
    expect(clicks).toHaveLength(1);
  });
});
