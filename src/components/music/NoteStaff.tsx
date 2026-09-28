// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NoteStaff
// "Bouncing dots on a staff": every generated note drops onto a
// five-line staff at its pitch, bounces, then scrolls left and fades
// over 4 s. Canvas + requestAnimationFrame reading the music store
// directly (no React re-render per frame); the loop sleeps when no
// notes are alive and wakes on the next one.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useMusicGenStore } from '@/stores/useMusicGenStore';

const WINDOW_MS = 4000;
const LOW_MIDI = 24; // C1
const HIGH_MIDI = 96; // C7
const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C#4" → 61. Null for anything unparseable. */
export function noteToMidi(note: string): number | null {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note);
  if (!m) return null;
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (parseInt(m[3], 10) + 1) * 12 + SEMITONE[m[1]] + acc;
}

interface NoteStaffProps {
  className?: string;
  /** Dot colour. */
  color?: string;
}

export function NoteStaff({ className, color = '#00f0ff' }: NoteStaffProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef(color);
  useEffect(() => {
    colorRef.current = color;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let running = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const now = Date.now();
      const { recentNotes } = useMusicGenStore.getState();
      const pad = 10;
      ctx.clearRect(0, 0, w, h);

      // Staff: five hairlines
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = Math.round(pad + (i * (h - pad * 2)) / 4) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      let alive = 0;
      ctx.fillStyle = colorRef.current;
      ctx.shadowColor = colorRef.current;
      for (const n of recentNotes) {
        const age = now - n.at;
        if (age < 0 || age > WINDOW_MS) continue;
        alive++;
        const midi = noteToMidi(n.note) ?? 60;
        const t = (Math.max(LOW_MIDI, Math.min(HIGH_MIDI, midi)) - LOW_MIDI) / (HIGH_MIDI - LOW_MIDI);
        const baseY = h - pad - t * (h - pad * 2);
        const bounce = -Math.abs(Math.sin(age / 110)) * 14 * Math.exp(-age / 520);
        const x = w - 14 - (age / WINDOW_MS) * (w - 28);
        const r = 3 + n.velocity * 3.5;
        ctx.globalAlpha = Math.max(0, 1 - age / WINDOW_MS);
        ctx.shadowBlur = 4 + n.velocity * 10;
        ctx.beginPath();
        ctx.arc(x, baseY + bounce, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      if (alive === 0) {
        running = false; // sleep until the next note arrives
        return;
      }
      raf = requestAnimationFrame(draw);
    };

    const wake = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(draw);
    };

    resize();
    wake();
    // Resizing clears the canvas — redraw (the loop sleeps again if idle).
    const ro = new ResizeObserver(() => {
      resize();
      wake();
    });
    ro.observe(canvas);
    const unsub = useMusicGenStore.subscribe((s, prev) => {
      if (s.recentNotes !== prev.recentNotes) wake();
    });

    return () => {
      unsub();
      ro.disconnect();
      cancelAnimationFrame(raf);
      running = false;
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={cn('block h-full w-full', className)} />;
}
