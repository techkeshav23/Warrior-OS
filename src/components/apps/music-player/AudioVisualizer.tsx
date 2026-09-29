// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Audio Visualizer (FORGE HUD)
// Mirrored bar visualizer in the brand palette: bass bars run warm
// (ember), the rest plasma, brightness follows level. `source` picks
// the analyser: 'element' reads the Web Audio analyser the library's
// <audio> element is wired into; 'procedural' reads the Tone.js
// engine's spectrum. Quiet ink ticks show whenever `active` is false.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useRef, useEffect } from 'react';
import { getFrequencyData } from '@/lib/audio-engine';
import { getMusicSpectrum } from '@/lib/procedural-music/engine';
import { EMBER, INK, PLASMA } from '@/styles/tokens';

const BAR_COUNT = 40;
const BAR_WIDTH = 3;
const BAR_GAP = 3;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const WARM = hexToRgb(EMBER[400]);
const COOL = hexToRgb(PLASMA[400]);
const IDLE = INK[600];

/** Bar colour: ember for the lowest bins easing into plasma. */
function barColor(i: number, level: number): string {
  const t = Math.min(1, i / (BAR_COUNT * 0.3));
  const r = Math.round(WARM[0] + (COOL[0] - WARM[0]) * t);
  const g = Math.round(WARM[1] + (COOL[1] - WARM[1]) * t);
  const b = Math.round(WARM[2] + (COOL[2] - WARM[2]) * t);
  return `rgba(${r}, ${g}, ${b}, ${0.35 + level * 0.65})`;
}

interface AudioVisualizerProps {
  /** Draw live data (otherwise flat idle bars). */
  active?: boolean;
  source?: 'element' | 'procedural';
}

function AudioVisualizerInner({ active = false, source = 'element' }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const sourceRef = useRef(source);

  // Sync latest props into refs for the animation loop to consume.
  useEffect(() => {
    activeRef.current = active;
    sourceRef.current = source;
  }, [active, source]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
      const startX = (w - totalWidth) / 2;
      const maxBar = Math.max(8, h - 16);

      const data = activeRef.current
        ? sourceRef.current === 'procedural'
          ? getMusicSpectrum()
          : getFrequencyData()
        : null;

      if (!data) {
        ctx.fillStyle = IDLE;
        for (let i = 0; i < BAR_COUNT; i++) {
          ctx.fillRect(startX + i * (BAR_WIDTH + BAR_GAP), (h - 2) / 2, BAR_WIDTH, 2);
        }
        raf = requestAnimationFrame(draw);
        return;
      }

      const binSize = Math.max(1, Math.floor(data.length / BAR_COUNT));
      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0;
        for (let j = 0; j < binSize; j++) sum += data[Math.min(data.length - 1, i * binSize + j)];
        const avg = sum / binSize / 255;
        const barH = Math.max(2, avg * maxBar);
        const x = startX + i * (BAR_WIDTH + BAR_GAP);
        const y = (h - barH) / 2;
        ctx.fillStyle = barColor(i, avg);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, BAR_WIDTH, barH, 1.5);
        else ctx.rect(x, y, BAR_WIDTH, barH);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />;
}

export const AudioVisualizer = memo(AudioVisualizerInner);
