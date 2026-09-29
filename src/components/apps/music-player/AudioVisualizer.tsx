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
import { EMBER, INK } from '@/styles/tokens';

const BAR_COUNT = 40;
const BAR_WIDTH = 3;
const BAR_GAP = 3;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Forge-heat ramp: cooling iron → ember → white-hot. */
const HEAT = [EMBER[700], EMBER[500], EMBER[400], EMBER[300], EMBER[100]].map(hexToRgb);
const IDLE = INK[600];

/** Bar colour: louder bars run hotter (the bar heats up like struck metal). */
function barColor(level: number): string {
  const t = Math.min(1, Math.max(0, level * 1.15)) * (HEAT.length - 1);
  const k = Math.min(HEAT.length - 2, Math.floor(t));
  const f = t - k;
  const [a, b] = [HEAT[k], HEAT[k + 1]];
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  return `rgba(${r}, ${g}, ${bl}, ${0.5 + level * 0.5})`;
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
        ctx.fillStyle = barColor(avg);
        ctx.fillRect(x, y, BAR_WIDTH, barH);
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
