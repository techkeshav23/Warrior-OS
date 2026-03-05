// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Audio Visualizer
// Circular/bar visualizer widget, reads from audio store
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useRef, useCallback, useEffect } from 'react';
import { useAudioStore } from '@/stores/useAudioStore';
import { getFrequencyData } from '@/lib/audio-engine';

const BAR_COUNT = 32;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const MAX_BAR_HEIGHT = 80;

function AudioVisualizerInner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const isPlaying = useAudioStore((s) => s.isPlaying);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    if (!isPlaying) {
      // Draw idle bars
      const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP);
      const startX = (w - totalWidth) / 2;
      for (let i = 0; i < BAR_COUNT; i++) {
        const x = startX + i * (BAR_WIDTH + BAR_GAP);
        const barH = 2;
        ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.fillRect(x, (h - barH) / 2, BAR_WIDTH, barH);
      }
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    // Get frequency data
    const data = getFrequencyData();
    const binSize = Math.floor(data.length / BAR_COUNT);
    const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP);
    const startX = (w - totalWidth) / 2;

    for (let i = 0; i < BAR_COUNT; i++) {
      // Average the bins for this bar
      let sum = 0;
      for (let j = 0; j < binSize; j++) {
        sum += data[i * binSize + j];
      }
      const avg = sum / binSize / 255;

      const barH = Math.max(2, avg * MAX_BAR_HEIGHT);
      const x = startX + i * (BAR_WIDTH + BAR_GAP);
      const y = (h - barH) / 2;

      // Gradient color: cyan → purple based on frequency
      const hue = 180 + (i / BAR_COUNT) * 80; // 180 (cyan) to 260 (purple)
      const alpha = 0.4 + avg * 0.6;

      ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
      ctx.fillRect(x, y, BAR_WIDTH, barH);

      // Glow effect for loud bars
      if (avg > 0.5) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.5)`;
        ctx.fillRect(x, y, BAR_WIDTH, barH);
        ctx.shadowBlur = 0;
      }
    }

    // Center circle
    const cx = w / 2;
    const cy = h / 2;
    const radius = 15;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    animRef.current = requestAnimationFrame(draw);
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
    />
  );
}

export const AudioVisualizer = memo(AudioVisualizerInner);
