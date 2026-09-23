/**
 * Musique d'ambiance : jamais avant un geste, une seule à la fois, coupée à tout moment,
 * mise en pause en arrière-plan, préférence mémorisée.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Music = typeof import('../client/src/lib/music');
type Sound = typeof import('../client/src/lib/sound');

let handlers: Record<string, () => void>;
let docHandlers: Record<string, () => void>;
let oscillators: number;
let doc: { visibilityState: string; addEventListener: (t: string, fn: () => void) => void };
let music: Music;
let sound: Sound;

const param = () => ({
  value: 0,
  setValueAtTime() {},
  exponentialRampToValueAtTime() {},
  cancelScheduledValues() {},
});
const node = () => ({ connect: (n: unknown) => n, disconnect() {} });

class FakeAudioContext {
  state = 'suspended';
  get currentTime() {
    return Date.now() / 1000;
  }
  destination = {};
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  createOscillator() {
    return { ...node(), type: '', frequency: param(), detune: param(), start: () => oscillators++, stop() {} };
  }
  createGain() {
    return { ...node(), gain: param() };
  }
  createBiquadFilter() {
    return { ...node(), type: '', frequency: param(), Q: param() };
  }
  createDelay() {
    return { ...node(), delayTime: param() };
  }
}

async function load() {
  vi.resetModules();
  sound = await import('../client/src/lib/sound');
  music = await import('../client/src/lib/music');
  sound.installAudioUnlock();
}

async function unlock() {
  handlers.pointerdown();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  handlers = {};
  docHandlers = {};
  oscillators = 0;
  const storage = new Map<string, string>();
  doc = { visibilityState: 'visible', addEventListener: (t, fn) => (docHandlers[t] = fn) };
  (globalThis as unknown as { document: unknown }).document = doc;
  (globalThis as unknown as { window: unknown }).window = {
    AudioContext: FakeAudioContext,
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) },
    addEventListener: (type: string, fn: () => void) => (handlers[type] = fn),
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
    clearInterval: (id: ReturnType<typeof setInterval>) => clearInterval(id),
  };
  await load();
});

afterEach(() => {
  music.setMusicActive(false);
  vi.useRealTimers();
});

describe('musique d’ambiance', () => {
  it('attend un geste de l’utilisateur, puis joue en continu', async () => {
    music.setMusicActive(true);
    expect(music.isMusicPlaying()).toBe(false);
    await unlock();
    expect(music.isMusicPlaying()).toBe(true);
    const first = oscillators;
    expect(first).toBeGreaterThan(0);
    vi.advanceTimersByTime(30_000);
    expect(oscillators).toBeGreaterThan(first);
  });

  it('ne joue que dans un salon et jamais en double', async () => {
    await unlock();
    expect(music.isMusicPlaying()).toBe(false);
    music.setMusicActive(true);
    music.setMusicActive(true);
    await unlock();
    expect(vi.getTimerCount()).toBe(1);
    music.setMusicActive(false);
    expect(music.isMusicPlaying()).toBe(false);
  });

  it('se coupe à tout moment et s’en souvient', async () => {
    music.setMusicActive(true);
    await unlock();
    music.setMusicEnabled(false);
    expect(music.isMusicPlaying()).toBe(false);
    const before = oscillators;
    vi.advanceTimersByTime(20_000);
    expect(oscillators).toBe(before);
    await load();
    expect(music.isMusicEnabled()).toBe(false);
    music.setMusicActive(true);
    await unlock();
    expect(music.isMusicPlaying()).toBe(false);
    music.setMusicEnabled(true);
    expect(music.isMusicPlaying()).toBe(true);
  });

  it('se met en pause quand l’appli passe en arrière-plan', async () => {
    music.setMusicActive(true);
    await unlock();
    doc.visibilityState = 'hidden';
    docHandlers.visibilitychange();
    expect(music.isMusicPlaying()).toBe(false);
    doc.visibilityState = 'visible';
    docHandlers.visibilitychange();
    expect(music.isMusicPlaying()).toBe(true);
  });
});
