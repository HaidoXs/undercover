import { useEffect, useSyncExternalStore } from 'react';
import { audioContext, onAudioReady } from './sound';

/**
 * Musique d'ambiance « lo-fi » générée en direct avec Web Audio : aucun fichier, aucun droit d'auteur.
 * Nappes d'accords feutrées, basse douce et quelques notes éparses avec écho, à 70 BPM.
 *
 * Elle ne joue que dans un salon ou une partie, après un geste de l'utilisateur (règle des navigateurs),
 * s'interrompt quand l'appli passe en arrière-plan, et se coupe à tout moment avec son bouton.
 */

const PREF_KEY = 'undercover.music';
const VOLUME = 0.32;
const FADE_IN_S = 3;
const FADE_OUT_S = 0.5;
const LOOKAHEAD_S = 1.5;

const BEAT = 60 / 70;
const BAR = 4 * BEAT;
/** Fmaj7 · Em7 · Dm7 · Cmaj7, deux mesures chacun (notes MIDI). */
const CHORDS = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
];
const BASS = [41, 40, 38, 36];
/** Pentatonique de do : s'accorde avec tous les accords de la grille. */
const MELODY = [67, 69, 72, 74, 76, 79];

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

let enabled = readPref();
let active = false;
const listeners = new Set<() => void>();

interface Voice {
  master: GainNode;
  pads: BiquadFilterNode;
  lead: GainNode;
  timer: number;
  nextBar: number;
  bar: number;
  seed: number;
}
let voice: Voice | null = null;

function readPref(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function isMusicEnabled(): boolean {
  return enabled;
}

export function setMusicEnabled(value: boolean): void {
  enabled = value;
  try {
    window.localStorage.setItem(PREF_KEY, value ? 'on' : 'off');
  } catch {
    /* préférence gardée pour cette visite seulement */
  }
  for (const listener of listeners) listener();
  update();
}

export function useMusicEnabled(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => enabled,
  );
}

export function isMusicPlaying(): boolean {
  return voice !== null;
}

/** Pseudo-aléatoire léger et reproductible pour les notes de mélodie. */
function random(v: Voice): number {
  v.seed = (v.seed * 1664525 + 1013904223) % 4294967296;
  return v.seed / 4294967296;
}

function note(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  start: number,
  duration: number,
  peak: number,
  attack: number,
  type: OscillatorType,
  detune = 0,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  osc.detune.setValueAtTime(detune, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(dest);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function scheduleBar(ctx: AudioContext, v: Voice, bar: number, t: number): void {
  const chord = Math.floor(bar / 2) % CHORDS.length;
  // Nappe : un accord qui respire sur deux mesures, deux oscillateurs légèrement désaccordés.
  if (bar % 2 === 0) {
    for (const n of CHORDS[chord]) {
      note(ctx, v.pads, midi(n), t, BAR * 2, 0.035, 1.4, 'triangle', -6);
      note(ctx, v.pads, midi(n), t, BAR * 2, 0.025, 1.6, 'sine', 7);
    }
  }
  // Basse ronde sur le premier temps.
  note(ctx, v.pads, midi(BASS[chord]), t, BAR * 0.9, 0.09, 0.04, 'sine');
  // Quelques notes éparses, jamais sur toutes les croches.
  for (let step = 0; step < 8; step++) {
    if (random(v) < 0.2) {
      const n = MELODY[Math.floor(random(v) * MELODY.length)];
      note(ctx, v.lead, midi(n), t + step * (BEAT / 2), 1.2, 0.03, 0.01, 'triangle');
    }
  }
}

function start(ctx: AudioContext): void {
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(VOLUME, ctx.currentTime + FADE_IN_S);
  master.connect(ctx.destination);

  const pads = ctx.createBiquadFilter();
  pads.type = 'lowpass';
  pads.frequency.value = 1400;
  pads.Q.value = 0.4;
  pads.connect(master);

  // Mélodie : son direct, plus un écho discret qui se répète en s'éteignant.
  const lead = ctx.createGain();
  lead.connect(pads);
  const echo = ctx.createDelay(1);
  echo.delayTime.value = BEAT * 0.75;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.35;
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  lead.connect(echo);
  echo.connect(feedback).connect(echo);
  echo.connect(wet).connect(pads);

  const v: Voice = { master, pads, lead, timer: 0, nextBar: ctx.currentTime + 0.1, bar: 0, seed: 20260923 };
  const pump = () => {
    while (v.nextBar < ctx.currentTime + LOOKAHEAD_S) {
      scheduleBar(ctx, v, v.bar++, v.nextBar);
      v.nextBar += BAR;
    }
  };
  pump();
  v.timer = window.setInterval(pump, 250);
  voice = v;
}

function stop(): void {
  const v = voice;
  const ctx = audioContext();
  if (!v) return;
  voice = null;
  window.clearInterval(v.timer);
  if (ctx) {
    const now = ctx.currentTime;
    v.master.gain.cancelScheduledValues(now);
    v.master.gain.setValueAtTime(Math.max(v.master.gain.value, 0.0001), now);
    v.master.gain.exponentialRampToValueAtTime(0.0001, now + FADE_OUT_S);
    window.setTimeout(() => v.master.disconnect(), (FADE_OUT_S + 0.1) * 1000);
  } else {
    v.master.disconnect();
  }
}

/** Démarre ou arrête la musique selon le salon, la préférence, l'audio débloqué et la visibilité. */
function update(): void {
  const ctx = audioContext();
  const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
  const should = active && enabled && visible && ctx !== null;
  if (should && !voice && ctx) start(ctx);
  else if (!should && voice) stop();
}

let installed = false;
function install(): void {
  if (installed) return;
  installed = true;
  onAudioReady(update);
  document.addEventListener('visibilitychange', update);
}

/** Indique si l'on se trouve dans un salon ou une partie (seuls endroits où la musique joue). */
export function setMusicActive(value: boolean): void {
  install();
  active = value;
  update();
}

/** À placer dans les écrans de salon et de partie : la musique ne joue que là. */
export function useAmbientMusic(): void {
  useEffect(() => {
    setMusicActive(true);
    return () => setMusicActive(false);
  }, []);
}
