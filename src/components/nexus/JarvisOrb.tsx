// ═══════════════════════════════════════════════════════════
// WARRIOR OS — JARVIS Orb
// The arc-reactor orb NEXUS shows while voice is engaged: it floats
// bottom-center above the taskbar whenever a command is being
// captured, thought about or spoken, and stays hidden otherwise
// (wake mode's idle listening is shown by the HUD indicator only).
//
//   listening → breathing core, rim ticks react to the mic level
//   thinking  → counter-rotating segmented rings
//   speaking  → wave ring + core pulse with the cloud voice level
//               (a procedural wave for the browser voice)
//
// Canvas + requestAnimationFrame, only while visible. The mic level
// comes from its own echo-cancelled stream, opened only while
// capturing and closed right after. Lite mode / reduced motion get a
// static glow with a CSS opacity pulse instead. Click or Escape stops
// the reply / cancels the capture.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNexusVoiceStore } from '@/lib/nexus/voice-store';
import { getCloudSpeechLevel, isCloudSpeaking } from '@/lib/jarvis/voice';
import { useLiteMode } from '@/lib/lite-mode';
import { cn } from '@/lib/utils';
import { cancelNexusVoice } from './NexusVoice';

type OrbState = 'listening' | 'thinking' | 'speaking';

const ORB_PX = 112;

const STATE_LABEL: Record<OrbState, string> = {
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking',
};

const ORB_ARIA: Record<OrbState, string> = {
  listening: 'Cancel listening',
  thinking: 'Cancel NEXUS request',
  speaking: 'Stop NEXUS speaking',
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// ─── Mic level (own stream, only while capturing) ───

interface MicTap {
  analyser: AnalyserNode;
  buffer: Uint8Array<ArrayBuffer>;
}

function useMicLevel(active: boolean) {
  const tap = useRef<MicTap | null>(null);

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;

    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.6;
        ctx.createMediaStreamSource(s).connect(analyser);
        tap.current = { analyser, buffer: new Uint8Array(analyser.fftSize) };
      })
      .catch(() => {
        /* denied / no mic: the orb animates procedurally */
      });

    return () => {
      cancelled = true;
      tap.current = null;
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close().catch(() => {});
    };
  }, [active]);

  return tap;
}

function readLevel(tap: MicTap | null): number | null {
  if (!tap) return null;
  tap.analyser.getByteTimeDomainData(tap.buffer);
  let sum = 0;
  for (const v of tap.buffer) {
    const x = (v - 128) / 128;
    sum += x * x;
  }
  return Math.min(1, Math.sqrt(sum / tap.buffer.length) * 4);
}

// ─── Canvas renderer ───

interface Palette {
  core: string;
  p300: string;
  p400: string;
  p500: string;
  p600: string;
  ember: string;
}

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    core: '#f2fdff',
    p300: v('--color-plasma-300', '#7ce7fb'),
    p400: v('--color-plasma-400', '#2fd6f5'),
    p500: v('--color-plasma-500', '#10b8d8'),
    p600: v('--color-plasma-600', '#0b8fad'),
    ember: v('--color-ember-400', '#ff8a3d'),
  };
}

function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(47,214,245,${a})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}

function segmentedRing(
  ctx: CanvasRenderingContext2D,
  c: number,
  r: number,
  segments: number,
  fill: number,
  rotation: number,
  width: number,
  color: string
) {
  const step = (Math.PI * 2) / segments;
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  for (let i = 0; i < segments; i++) {
    const a0 = rotation + i * step;
    ctx.beginPath();
    ctx.arc(c, c, r, a0, a0 + step * fill);
    ctx.stroke();
  }
}

function OrbCanvas({ state, micActive }: { state: OrbState; micActive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const mic = useMicLevel(micActive);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = ORB_PX * dpr;
    canvas.height = ORB_PX * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pal = readPalette();
    const c = ORB_PX / 2;
    const ticks = Array.from({ length: 40 }, (_, i) => 0.55 + 0.45 * Math.abs(Math.sin(i * 12.9898) * 0.5 + Math.sin(i * 3.7) * 0.5));

    let raf = 0;
    let level = 0;
    let spin = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const s = stateRef.current;

      // Target energy for this frame.
      let target: number;
      if (s === 'speaking') {
        const cloud = isCloudSpeaking() ? getCloudSpeechLevel() : 0;
        target = isCloudSpeaking()
          ? cloud
          : Math.max(0, 0.38 + 0.26 * Math.sin(t * 9.1) * Math.sin(t * 3.3) + 0.14 * Math.sin(t * 17.3));
      } else if (s === 'listening') {
        const heard = readLevel(mic.current);
        target = heard ?? 0.12 + 0.08 * Math.sin(t * 2.4);
      } else {
        target = 0.18;
      }
      level += (target - level) * (target > level ? 0.35 : 0.12);

      const spinSpeed = s === 'thinking' ? 2.6 : s === 'speaking' ? 0.5 : 0.22;
      spin += spinSpeed * dt;
      const breathe = 0.5 + 0.5 * Math.sin(t * (s === 'listening' ? 2.2 : 1.4));

      ctx.clearRect(0, 0, ORB_PX, ORB_PX);

      // Halo
      const halo = ctx.createRadialGradient(c, c, 8, c, c, c);
      halo.addColorStop(0, alpha(pal.p400, 0.28 + level * 0.35));
      halo.addColorStop(0.55, alpha(pal.p500, 0.1 + level * 0.12));
      halo.addColorStop(1, alpha(pal.p600, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, ORB_PX, ORB_PX);

      ctx.lineCap = 'butt';

      // Outer housing ring (arc-reactor segments)
      segmentedRing(ctx, c, 48, 12, 0.72, spin, 2, alpha(pal.p300, s === 'thinking' ? 0.85 : 0.55));
      // Fine tick ring
      ctx.lineWidth = 1;
      for (let i = 0; i < ticks.length; i++) {
        const a = (i / ticks.length) * Math.PI * 2 - spin * 0.5;
        const len = s === 'listening' ? 2 + ticks[i] * level * 10 : 2;
        ctx.strokeStyle = alpha(pal.p400, s === 'listening' ? 0.35 + level * 0.6 : 0.3);
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * 41, c + Math.sin(a) * 41);
        ctx.lineTo(c + Math.cos(a) * (41 - len), c + Math.sin(a) * (41 - len));
        ctx.stroke();
      }

      // Inner ring: three arcs, counter-rotating (fast while thinking)
      segmentedRing(
        ctx,
        c,
        s === 'thinking' ? 30 : 29,
        3,
        s === 'thinking' ? 0.55 : 0.8,
        -spin * (s === 'thinking' ? 1.6 : 0.8),
        s === 'thinking' ? 3 : 2,
        alpha(pal.p400, 0.7)
      );

      // Speaking: a wave ring around the core
      if (s === 'speaking') {
        ctx.beginPath();
        const points = 96;
        for (let i = 0; i <= points; i++) {
          const a = (i / points) * Math.PI * 2;
          const wobble =
            Math.sin(a * 6 + t * 7) * 0.55 + Math.sin(a * 11 - t * 5.3) * 0.3 + Math.sin(a * 3 + t * 2.1) * 0.15;
          const r = 22 + level * 3 + wobble * (1.5 + level * 7);
          const x = c + Math.cos(a) * r;
          const y = c + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = alpha(pal.p300, 0.55 + level * 0.45);
        ctx.stroke();
      }

      // Listening: an expanding pulse ring driven by the voice level
      if (s === 'listening') {
        const pr = 22 + ((t * 0.8) % 1) * 18;
        ctx.lineWidth = 1;
        ctx.strokeStyle = alpha(pal.p300, (1 - ((t * 0.8) % 1)) * (0.25 + level * 0.5));
        ctx.beginPath();
        ctx.arc(c, c, pr, 0, Math.PI * 2);
        ctx.stroke();
        // Ember notch: the mic is hot
        ctx.fillStyle = alpha(pal.ember, 0.75 + breathe * 0.25);
        ctx.beginPath();
        ctx.arc(c, c - 48, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core
      const coreR =
        s === 'speaking' ? 13 + level * 9 : s === 'listening' ? 12 + breathe * 2.5 + level * 6 : 11 + breathe * 1.5;
      const core = ctx.createRadialGradient(c, c, 0, c, c, coreR * 1.6);
      core.addColorStop(0, pal.core);
      core.addColorStop(0.3, alpha(pal.p300, 0.95));
      core.addColorStop(0.62, alpha(pal.p500, 0.55));
      core.addColorStop(1, alpha(pal.p600, 0));
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(c, c, coreR * 1.6, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mic]);

  return <canvas ref={canvasRef} aria-hidden className="size-full" style={{ width: ORB_PX, height: ORB_PX }} />;
}

// ─── Static orb (lite mode / reduced motion) ───

function StaticOrb({ state }: { state: OrbState }) {
  return (
    <span aria-hidden className="relative block size-full">
      <span
        className="absolute inset-0 rounded-full motion-safe:animate-pulse"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--color-plasma-400) 38%, transparent) 0%, color-mix(in oklab, var(--color-plasma-600) 12%, transparent) 55%, transparent 72%)',
        }}
      />
      <span
        className={cn(
          'absolute inset-[10%] rounded-full border-2',
          state === 'thinking' ? 'border-dashed border-plasma-300/80' : 'border-plasma-300/50'
        )}
      />
      <span className="absolute inset-[24%] rounded-full border border-plasma-400/60" />
      <span
        className="absolute inset-[36%] rounded-full"
        style={{
          background:
            'radial-gradient(circle, #f2fdff 0%, var(--color-plasma-300) 35%, color-mix(in oklab, var(--color-plasma-500) 50%, transparent) 70%, transparent 100%)',
          opacity: state === 'speaking' ? 1 : 0.85,
        }}
      />
      {state === 'listening' && <span className="absolute left-1/2 top-[6%] size-1.5 -translate-x-1/2 rounded-full bg-ember-400" />}
    </span>
  );
}

// ─── Orb + caption ───

function JarvisOrbInner() {
  const mode = useNexusVoiceStore((s) => s.mode);
  const micActive = useNexusVoiceStore((s) => s.micActive);
  const capturing = useNexusVoiceStore((s) => s.capturing);
  const processing = useNexusVoiceStore((s) => s.processing);
  const speaking = useNexusVoiceStore((s) => s.speaking);
  const conversing = useNexusVoiceStore((s) => s.conversing);
  const interim = useNexusVoiceStore((s) => s.interim);
  const lastHeard = useNexusVoiceStore((s) => s.lastHeard);
  const lastReply = useNexusVoiceStore((s) => s.lastReply);
  const lite = useLiteMode();
  const reduce = useReducedMotion();
  const staticOrb = lite || !!reduce;

  const listening = capturing || (micActive && (mode === 'push' || mode === 'follow'));
  const state: OrbState | null = speaking ? 'speaking' : processing ? 'thinking' : listening ? 'listening' : null;
  const visible = state !== null;

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelNexusVoice();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  let caption = '';
  if (state === 'listening') {
    caption = interim ? `“${truncate(interim, 70)}”` : conversing ? 'Go on… say “bas” to end' : '';
  } else if (state === 'thinking') {
    caption = lastHeard ? `“${truncate(lastHeard, 70)}”` : '';
  } else if (state === 'speaking') {
    caption = lastReply ? truncate(lastReply, 90) : lastHeard ? `“${truncate(lastHeard, 70)}”` : '';
  }

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          key="jarvis-orb"
          data-jarvis-orb={state}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.9 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none flex flex-col items-center gap-1.5"
        >
          <button
            type="button"
            onClick={cancelNexusVoice}
            aria-label={ORB_ARIA[state]}
            title={`${ORB_ARIA[state]} (Esc)`}
            className="focus-ring pointer-events-auto relative block cursor-pointer rounded-full"
            style={{
              width: ORB_PX,
              height: ORB_PX,
              // Ink backdrop so the reactor reads cleanly over windows and toasts.
              background:
                'radial-gradient(circle, color-mix(in oklab, var(--color-ink-950) 88%, transparent) 0%, color-mix(in oklab, var(--color-ink-950) 70%, transparent) 50%, transparent 71%)',
            }}
          >
            {staticOrb ? <StaticOrb state={state} /> : <OrbCanvas state={state} micActive={state === 'listening'} />}
          </button>
          <div className="armor-popover chamfer-sm pointer-events-auto flex max-w-[min(360px,calc(100vw_-_32px))] flex-col items-center px-3 py-1.5 text-center">
            <p role="status" aria-live="polite" className="hud-label flex items-center gap-1.5 text-plasma-300">
              {state === 'listening' && <span aria-hidden className="size-1.5 rounded-full bg-ember-400" />}
              {STATE_LABEL[state]}
            </p>
            {caption && <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted">{caption}</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const JarvisOrb = memo(JarvisOrbInner);
