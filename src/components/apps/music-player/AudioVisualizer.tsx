// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Audio Visualizer
// Bar visualizer. `source` picks the analyser: 'element' reads the
// Web Audio analyser the library's <audio> element is wired into;
// 'procedural' reads the Tone.js engine's spectrum. Idle bars show
// whenever `active` is false.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useRef, useEffect } from 'react';
import { getFrequencyData } from '@/lib/audio-engine';
import { getMusicSpectrum } from '@/lib/procedural-music/engine';

const BAR_COUNT = 32;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const MAX_BAR_HEIGHT = 80;

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

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP);
      const startX = (w - totalWidth) / 2;

      const data = activeRef.current
        ? sourceRef.current === 'procedural'
          ? getMusicSpectrum()
          : getFrequencyData()
        : null;

      if (!data) {
        ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
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
        const barH = Math.max(2, avg * MAX_BAR_HEIGHT);
        const x = startX + i * (BAR_WIDTH + BAR_GAP);
        const y = (h - barH) / 2;
        const hue = 180 + (i / BAR_COUNT) * 80;
        ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${0.4 + avg * 0.6})`;
        ctx.fillRect(x, y, BAR_WIDTH, barH);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden />;
}

export const AudioVisualizer = memo(AudioVisualizerInner);
