// ═══════════════════════════════════════════════════════════
// WARRIOR OS — JARVIS cloud voice (browser)
//
// Owner sessions on a connected device, when the server has Google
// Cloud Text-to-Speech set up (/api/voice): NEXUS replies are spoken in
// a natural voice through Web Audio, with a live level meter for the
// orb. Anything else (guests, no server voice, a failed request) keeps
// the browser's built-in voice (src/lib/nexus/speech.ts).
// ═══════════════════════════════════════════════════════════

'use client';

import { getVisitorMode } from '@/lib/visitor';
import { getSyncToken } from '@/lib/sync/client';

let configured: boolean | null = null;
let checking = false;

/** Ask the server once whether cloud voice is on (non-blocking). */
export function primeCloudVoice(): void {
  if (configured !== null || checking || typeof window === 'undefined') return;
  checking = true;
  fetch('/api/voice', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : { configured: false }))
    .then((d: { configured?: unknown }) => {
      configured = d.configured === true;
    })
    .catch(() => {
      configured = null; // ask again later
    })
    .finally(() => {
      checking = false;
    });
}

/** Cloud voice can be used right now (owner, connected, server voice on). */
export function cloudVoiceReady(): boolean {
  primeCloudVoice();
  return configured === true && getVisitorMode() === 'owner' && getSyncToken() !== null;
}

// ─── Playback with a level meter ───

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let current: { audio: HTMLAudioElement; url: string } | null = null;
let generation = 0;
const levelBuffer = new Uint8Array(512);

function graph(): { ctx: AudioContext; analyser: AnalyserNode } | null {
  try {
    ctx ??= new AudioContext();
    if (!analyser) {
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.connect(ctx.destination);
    }
    return { ctx, analyser };
  } catch {
    return null;
  }
}

function release() {
  if (!current) return;
  current.audio.pause();
  URL.revokeObjectURL(current.url);
  current = null;
}

/** 0–1 loudness of the voice being played (for the orb). */
export function getCloudSpeechLevel(): number {
  if (!current || !analyser) return 0;
  analyser.getByteTimeDomainData(levelBuffer);
  let sum = 0;
  for (const v of levelBuffer) {
    const x = (v - 128) / 128;
    sum += x * x;
  }
  return Math.min(1, Math.sqrt(sum / levelBuffer.length) * 3);
}

export function isCloudSpeaking(): boolean {
  return current !== null && !current.audio.paused;
}

export function stopCloudSpeech(): void {
  generation += 1; // a request still in flight will not start playing
  release();
}

/**
 * Speak `text` with the server voice. Resolves true once playback has
 * started, false when it could not (the caller then uses the browser
 * voice). `onEnd` runs when playback finishes or is stopped.
 */
export async function speakCloud(text: string, onEnd: () => void): Promise<boolean> {
  const token = getSyncToken();
  if (!token) return false;
  stopCloudSpeech();
  const mine = generation;
  let blob: Blob;
  try {
    const res = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return false;
    blob = await res.blob();
  } catch {
    return false;
  }
  if (mine !== generation) {
    onEnd();
    return true; // stopped while loading: nothing to play, and no fallback either
  }

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  const g = graph();
  if (g) {
    try {
      g.ctx.createMediaElementSource(audio).connect(g.analyser);
      if (g.ctx.state === 'suspended') await g.ctx.resume();
    } catch {
      // Plays without the level meter.
    }
  }
  current = { audio, url };
  let ended = false;
  const finish = () => {
    if (ended) return; // 'ended' and 'pause' both fire at the end
    ended = true;
    if (current?.audio === audio) release();
    onEnd();
  };
  audio.onended = finish;
  audio.onpause = () => {
    if (audio.ended || current?.audio !== audio) finish();
  };
  audio.onerror = finish;
  try {
    await audio.play();
    return true;
  } catch {
    // Autoplay blocked or bad audio: let the browser voice try.
    if (current?.audio === audio) release();
    return false;
  }
}
