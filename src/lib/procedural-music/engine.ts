// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music :: Engine
// One engine for the whole OS (module singleton, browser only):
//  • playMood(mood) — must first be called from a user gesture; runs
//    Tone.start(), builds the rig once, swaps mood generators and
//    keeps the Transport running.
//  • stopMusic()    — stops the generator, fades out, then stops the
//    Transport and disposes every synth; the AudioContext is suspended.
//  • applyMoodShift / setDecayDetune — event-driven changes (MoodShift).
//  • retainMusicEngine() — ref-counted lifetime: when the last owner
//    (global host, player, or any useProceduralMusic user) unmounts,
//    everything is disposed.
// While playing it credits listening time (achievements), feeds the
// audio-reactive levels, and titles the Dynamic Island track.
// ═══════════════════════════════════════════════════════════

import { getToneRig, loadTone, disposeToneRig, setRigDetune, type ToneRig } from './tone-setup';
import type { GeneratorContext, MusicGenerator } from './generator';
import { createMorningGenerator, MORNING_BPM } from './morning-gen';
import { createStudyAmbientGenerator } from './study-ambient-gen';
import { createTypingRhythmGenerator, TYPING_FALLBACK_BPM } from './typing-rhythm-gen';
import { createNightAmbientGenerator } from './night-ambient-gen';
import { onMusicListenTick, onMusicModeUsed } from './achievements';
import { useMusicGenStore, type MusicMood } from '@/stores/useMusicGenStore';
import { useAudioStore } from '@/stores/useAudioStore';
import { getTodayStudyMinutes } from '@/stores/useDecayStore';
import { generateId } from '@/lib/utils';

/** Event-driven mood shift kinds (achievement/level/streak/decay). */
export type MoodShiftEvent = 'achievement' | 'levelup' | 'streak-broken' | 'decay-increase';

export const MOOD_LABELS: Record<MusicMood, string> = {
  morning: 'Morning',
  study: 'Deep Study',
  coding: 'Typing Rhythm',
  night: 'Night',
};

/** Relative loudness per mode — Deep Study sits lowest by design. */
const MOOD_TRIM: Record<MusicMood, number> = { morning: 1, study: 0.55, coding: 0.9, night: 0.85 };
const MOOD_BPM: Record<MusicMood, number> = {
  morning: MORNING_BPM,
  study: 60,
  coding: TYPING_FALLBACK_BPM,
  night: 60,
};
const TRACK_PREFIX = 'procedural:';
const LISTEN_TICK_MS = 5_000;
const METER_INTERVAL_MS = 66; // ~15 fps for audio-reactive visuals
/** Studied more than this today → the night hero swell plays. */
const HARD_STUDY_MINUTES = 4 * 60;

let rigRef: ToneRig | null = null;
let generator: MusicGenerator | null = null;
let activeMood: MusicMood | null = null;
let opToken = 0;
let transposeSemis = 0;
let transposeUntil = 0;
let decayCents = 0;
let listenTimer: number | null = null;
let lastListenTick = 0;
let meterTimer: number | null = null;
const spectrum = new Uint8Array(64);

// ─── Mood selection ─────────────────────────────────────────

/** Spec 6.53: 6 AM–12 PM morning, 12–6 PM study, 6–10 PM (and overnight) night. */
export function moodForHour(hour: number): MusicMood {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'study';
  return 'night';
}

/** Mood for the current local time (typing override is applied by AutoMood). */
export function moodForNow(): MusicMood {
  return moodForHour(new Date().getHours());
}

export function getActiveMood(): MusicMood | null {
  return activeMood;
}

export function isMusicPlaying(): boolean {
  return generator !== null;
}

function factoryFor(mood: MusicMood): MusicGenerator {
  switch (mood) {
    case 'morning':
      return createMorningGenerator();
    case 'study':
      return createStudyAmbientGenerator();
    case 'coding':
      return createTypingRhythmGenerator();
    case 'night':
      return createNightAmbientGenerator();
  }
}

function makeContext(rig: ToneRig): GeneratorContext {
  return {
    rig,
    seed: useMusicGenStore.getState().seed,
    onNote: (n) => useMusicGenStore.getState().pushNote({ ...n, id: generateId('note'), at: Date.now() }),
    getTranspose: () => (Date.now() < transposeUntil ? transposeSemis : 0),
    studiedHardToday: () => getTodayStudyMinutes() > HARD_STUDY_MINUTES,
  };
}

// ─── Side channels: listening time, levels, island title ────

function flushListenTime(): void {
  const now = Date.now();
  const seconds = Math.min(10, Math.max(0, (now - lastListenTick) / 1000));
  lastListenTick = now;
  if (!activeMood || seconds <= 0) return;
  const totals = useMusicGenStore.getState().addListenTime(activeMood, seconds);
  onMusicListenTick(activeMood, totals, now);
}

function startListenTracking(): void {
  if (listenTimer !== null) return;
  lastListenTick = Date.now();
  listenTimer = window.setInterval(flushListenTime, LISTEN_TICK_MS);
}

function stopListenTracking(): void {
  if (listenTimer === null) return;
  flushListenTime();
  window.clearInterval(listenTimer);
  listenTimer = null;
}

function startMeter(): void {
  if (meterTimer !== null) return;
  meterTimer = window.setInterval(() => {
    const rig = rigRef;
    if (!rig) return;
    const raw = rig.analyser.getValue();
    const values = Array.isArray(raw) ? raw[0] : raw;
    const n = Math.min(spectrum.length, values.length);
    for (let i = 0; i < n; i++) {
      // Same dB window as an AnalyserNode's byte data (-100…-30 dB → 0…255).
      spectrum[i] = Math.max(0, Math.min(255, ((values[i] + 100) / 70) * 255));
    }
    const band = (from: number, to: number) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += spectrum[i];
      return sum / (to - from) / 255;
    };
    useAudioStore.getState().setFrequencyData(band(0, 5), band(5, 32), band(32, 64));
  }, METER_INTERVAL_MS);
}

function stopMeter(): void {
  if (meterTimer !== null) {
    window.clearInterval(meterTimer);
    meterTimer = null;
  }
  spectrum.fill(0);
}

function announceTrack(mood: MusicMood): void {
  useAudioStore.getState().setTrack(`${TRACK_PREFIX}${mood}`, `Procedural · ${MOOD_LABELS[mood]}`);
}

function releaseTrack(): void {
  const audio = useAudioStore.getState();
  if (audio.currentTrack?.startsWith(TRACK_PREFIX)) audio.clearTrack();
}

/** Latest spectrum (64 bins, 0-255) while playing, else null. */
export function getMusicSpectrum(): Uint8Array | null {
  return generator ? spectrum : null;
}

/** True when the OS-wide "now playing" track belongs to the procedural engine. */
export function isProceduralTrack(trackUrl: string | null): boolean {
  return !!trackUrl && trackUrl.startsWith(TRACK_PREFIX);
}

// ─── Transport control ──────────────────────────────────────

/** Start (or switch to) a mood. The first call must come from a user gesture. */
export async function playMood(mood: MusicMood): Promise<void> {
  if (typeof window === 'undefined') return;
  const token = ++opToken;
  useMusicGenStore.getState().setStatus('starting');
  try {
    const Tone = await loadTone();
    await Tone.start(); // resumes the AudioContext (needs the gesture)
    if (token !== opToken) return;
    const rig = await getToneRig();
    if (token !== opToken) return;
    rigRef = rig;

    if (generator) {
      flushListenTime();
      generator.stop();
      generator = null;
    }

    const transport = rig.Tone.getTransport();
    transport.swing = 0;
    transport.bpm.rampTo(MOOD_BPM[mood], 1);
    if (transport.state !== 'started') transport.start('+0.05');
    setRigDetune(rig, decayCents);

    const gen = factoryFor(mood);
    gen.start(makeContext(rig));
    generator = gen;
    activeMood = mood;

    const store = useMusicGenStore.getState();
    rig.master.gain.rampTo(store.volume * MOOD_TRIM[mood], 1.2);
    store.clearNotes();
    store.setMood(mood);
    store.setGenerating(true);
    store.setStatus('playing');

    onMusicModeUsed(mood, Date.now());
    startListenTracking();
    startMeter();
    announceTrack(mood);
  } catch (e) {
    if (token !== opToken) return;
    stopMusic({ immediate: true });
    useMusicGenStore.getState().setStatus('error', e instanceof Error ? e.message : 'Audio failed to start');
  }
}

/**
 * Stop the music. Voices release and the master fades; then the
 * Transport stops, every node is disposed and the AudioContext is
 * suspended — unless playback restarts in the meantime.
 */
export function stopMusic(options: { immediate?: boolean } = {}): void {
  const token = ++opToken;
  stopListenTracking();
  if (generator) {
    try {
      generator.stop();
    } catch {
      /* already stopped */
    }
    generator = null;
  }
  activeMood = null;
  stopMeter();
  releaseTrack();

  const store = useMusicGenStore.getState();
  store.setGenerating(false);
  store.clearNotes();
  store.setTypingActive(false);
  if (store.status !== 'error') store.setStatus('idle');

  const rig = rigRef;
  if (!rig) return;
  const dispose = () => {
    if (token !== opToken) return; // playback restarted — keep the rig
    rigRef = null;
    void disposeToneRig().then(() => {
      if (token !== opToken) return;
      try {
        const raw = rig.Tone.getContext().rawContext;
        if (raw instanceof AudioContext && raw.state === 'running') void raw.suspend();
      } catch {
        /* context closed */
      }
    });
  };
  if (options.immediate) {
    dispose();
    return;
  }
  try {
    rig.master.gain.rampTo(0, 0.4);
  } catch {
    /* disposed */
  }
  window.setTimeout(dispose, 700);
}

/** Tear everything down right now (last owner unmounted). */
export function disposeMusicEngine(): void {
  if (generator || rigRef) stopMusic({ immediate: true });
}

/** Live volume control (0-1); persisted for the next play. */
export function setMusicVolume(volume: number): void {
  useMusicGenStore.getState().setVolume(volume);
  const rig = rigRef;
  if (rig && activeMood) {
    const v = useMusicGenStore.getState().volume;
    rig.master.gain.rampTo(v * MOOD_TRIM[activeMood], 0.2);
  }
}

// ─── Event-driven changes (MoodShift) ──────────────────────

function reportShiftNotes(rig: ToneRig, notes: string[], start: number, spacing: number, velocity: number): void {
  notes.forEach((note, i) => {
    rig.Tone.getDraw().schedule(() => {
      useMusicGenStore.getState().pushNote({
        id: generateId('note'),
        note,
        degree: ['C', 'D', 'E', 'G', 'A'].indexOf(note.replace(/[0-9#b]/g, '')),
        velocity,
        at: Date.now(),
      });
    }, start + i * spacing);
  });
}

/** Audible flourish over whatever is playing. No-op when silent. */
export function applyMoodShift(evt: MoodShiftEvent): void {
  const rig = rigRef;
  if (!rig || !generator) return;
  try {
    const now = rig.Tone.now();
    const transport = rig.Tone.getTransport();
    switch (evt) {
      case 'achievement': {
        // Major chord swell + everything an octave up for 3 s.
        const chord = ['C4', 'E4', 'G4', 'C5'];
        rig.pad.triggerAttackRelease(chord, 3, now, 0.55);
        rig.bell.triggerAttackRelease('C6', '2n', now + 0.05, 0.4);
        transposeSemis = 12;
        transposeUntil = Date.now() + 3000;
        reportShiftNotes(rig, chord, now, 0.08, 0.6);
        break;
      }
      case 'streak-broken': {
        // Minor chord shift + tempo sags for 5 s.
        const chord = ['C4', 'Eb4', 'G4'];
        rig.piano.triggerAttackRelease(chord, '1n', now, 0.4);
        rig.pad.triggerAttackRelease(['C3', 'Eb3', 'G3'], 4, now, 0.4);
        const base = transport.bpm.value;
        transport.bpm.rampTo(Math.max(45, base * 0.7), 0.8);
        transport.scheduleOnce(() => transport.bpm.rampTo(base, 1.5), transport.seconds + 5);
        reportShiftNotes(rig, ['C4', 'G4'], now, 0.1, 0.4);
        break;
      }
      case 'levelup': {
        // Triumphant brass-like FM chord + rising arpeggio.
        rig.brass.triggerAttackRelease(['C4', 'G4', 'C5', 'E5'], 1.6, now, 0.7);
        const arp = ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'];
        arp.forEach((n, i) => rig.piano.triggerAttackRelease(n, '16n', now + 0.12 * i, 0.5));
        reportShiftNotes(rig, arp, now, 0.12, 0.7);
        break;
      }
      case 'decay-increase': {
        // Dissonant cluster; the lasting pitch drop comes from setDecayDetune.
        rig.pad.triggerAttackRelease(['C3', 'Db3', 'F#3'], 4, now, 0.45);
        break;
      }
    }
  } catch {
    /* rig mid-dispose */
  }
}

/** Lower the whole engine's pitch as reality decays (20 cents per stage). */
export function setDecayDetune(stage: number): void {
  decayCents = -20 * Math.max(0, Math.min(5, stage));
  if (rigRef) setRigDetune(rigRef, decayCents);
}

// ─── Ref-counted lifetimes ──────────────────────────────────

/**
 * Wrap an attach function so it runs when the first owner retains and its
 * detach runs when the last owner releases. Returns `retain()` which
 * itself returns an idempotent release.
 */
export function refCounted(attach: () => () => void): () => () => void {
  let users = 0;
  let detach: (() => void) | null = null;
  return () => {
    users++;
    if (users === 1) detach = attach();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      users--;
      if (users === 0 && detach) {
        const d = detach;
        detach = null;
        d();
      }
    };
  };
}

/** Keep the engine alive while at least one owner is mounted. */
export const retainMusicEngine = refCounted(() => () => disposeMusicEngine());
