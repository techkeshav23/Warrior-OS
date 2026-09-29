// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Glitch Transition
// On every OS phase change (dream/boot → lock → desktop) the whole
// app glitches for ~420 ms: an SVG filter slices it into horizontally
// displaced bands (turbulence quantised into a displacement map) and
// splits the red and blue channels apart, while a canvas overlay adds
// static noise and colour tears. Two bursts — one as the old screen
// leaves, one as the new one arrives. Mount once at the root; it
// subscribes to the phase store itself. Off under reduced motion.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef } from 'react';
import { useOSStore } from '@/stores/useOSStore';
import { playGlitchSound } from './effects-sfx';
import { FX_Z, prefersReducedMotion } from './effects-utils';

const FILTER_ID = 'warrior-glitch-filter';
/** Glitch-on windows (ms from the phase change). ~420 ms of glitch in total. */
const BURSTS = [
  { start: 0, duration: 190 },
  { start: 470, duration: 230 },
] as const;
const TOTAL_MS = 720;
/** New random slice pattern every STEP_MS (glitches step, they don't glide). */
const STEP_MS = 45;
const TABLE_SIZE = 14;

function randomTable(intensity: number): string {
  const values: string[] = [];
  for (let i = 0; i < TABLE_SIZE; i++) {
    const shifted = Math.random() < 0.35 + intensity * 0.3;
    const v = shifted ? 0.5 + (Math.random() - 0.5) * 0.9 : 0.5;
    values.push(v.toFixed(3));
  }
  return values.join(' ');
}

function GlitchTransitionInner() {
  const rootRef = useRef<HTMLDivElement>(null);
  const noiseRef = useRef<HTMLCanvasElement>(null);
  const turbulenceRef = useRef<SVGFETurbulenceElement>(null);
  const tableRef = useRef<SVGFEFuncRElement>(null);
  const displaceRef = useRef<SVGFEDisplacementMapElement>(null);
  const redRef = useRef<SVGFEOffsetElement>(null);
  const blueRef = useRef<SVGFEOffsetElement>(null);

  useEffect(() => {
    let raf = 0;
    let startedAt = 0;
    let lastStep = -1;
    let target: HTMLElement | null = null;
    let previousFilter = '';
    let filterOn = false;
    let noiseImage: ImageData | null = null;

    const setFilter = (on: boolean) => {
      if (!target || on === filterOn) return;
      target.style.filter = on ? `url(#${FILTER_ID})` : previousFilter;
      filterOn = on;
    };

    const clearNoise = () => {
      const canvas = noiseRef.current;
      if (!canvas) return;
      canvas.style.opacity = '0';
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    };

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      setFilter(false);
      target = null;
      clearNoise();
    };

    const randomize = (intensity: number) => {
      const shift = (4 + Math.random() * 12) * intensity * (Math.random() < 0.5 ? -1 : 1);
      turbulenceRef.current?.setAttribute('seed', String(Math.floor(Math.random() * 1000)));
      turbulenceRef.current?.setAttribute(
        'baseFrequency',
        `0.00001 ${(0.015 + Math.random() * 0.09).toFixed(4)}`
      );
      tableRef.current?.setAttribute('tableValues', randomTable(intensity));
      displaceRef.current?.setAttribute('scale', String(Math.round((40 + Math.random() * 110) * intensity)));
      redRef.current?.setAttribute('dx', shift.toFixed(1));
      blueRef.current?.setAttribute('dx', (-shift).toFixed(1));
    };

    const drawNoise = (intensity: number) => {
      const canvas = noiseRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      if (!noiseImage || noiseImage.width !== canvas.width || noiseImage.height !== canvas.height) {
        noiseImage = ctx.createImageData(canvas.width, canvas.height);
      }
      const data = noiseImage.data;
      const density = 0.05 + intensity * 0.12;
      for (let i = 0; i < data.length; i += 4) {
        if (Math.random() < density) {
          const v = 150 + Math.random() * 105;
          const tint = Math.random();
          data[i] = tint < 0.33 ? 255 : v;
          data[i + 1] = tint > 0.66 ? 255 : v;
          data[i + 2] = v;
          data[i + 3] = 60 + Math.random() * 120 * intensity;
        } else {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(noiseImage, 0, 0);
      const bars = 2 + Math.floor(Math.random() * 4);
      for (let b = 0; b < bars; b++) {
        const y = Math.random() * canvas.height;
        const hgt = 1 + Math.random() * 5;
        ctx.fillStyle =
          Math.random() < 0.5
            ? `rgba(47, 214, 245, ${0.22 + Math.random() * 0.3})` // plasma-400
            : `rgba(255, 138, 61, ${0.18 + Math.random() * 0.3})`; // ember-400
        ctx.fillRect(Math.random() * canvas.width * 0.3, y, canvas.width * (0.4 + Math.random() * 0.6), hgt);
      }
      canvas.style.opacity = String(Math.min(1, 0.35 + intensity * 0.65));
    };

    const frame = (now: number) => {
      const elapsed = now - startedAt;
      if (elapsed >= TOTAL_MS) {
        stop();
        return;
      }
      const burst = BURSTS.find((b) => elapsed >= b.start && elapsed < b.start + b.duration);
      if (burst) {
        const local = (elapsed - burst.start) / burst.duration;
        // Quick attack, longer decay, with random flicker-offs.
        const envelope = local < 0.2 ? local / 0.2 : 1 - (local - 0.2) / 0.8;
        const intensity = Math.random() < 0.12 ? 0 : 0.35 + envelope * 0.65;
        const step = Math.floor(elapsed / STEP_MS);
        if (step !== lastStep) {
          lastStep = step;
          randomize(Math.max(0.2, intensity));
        }
        setFilter(intensity > 0);
        drawNoise(intensity);
      } else {
        setFilter(false);
        clearNoise();
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (prefersReducedMotion()) return;
      const host = rootRef.current?.parentElement ?? document.body;
      if (target !== host) {
        setFilter(false);
        target = host;
        previousFilter = host.style.filter;
      }
      const canvas = noiseRef.current;
      if (canvas) {
        canvas.width = Math.max(1, Math.round(window.innerWidth / 3));
        canvas.height = Math.max(1, Math.round(window.innerHeight / 3));
      }
      startedAt = performance.now();
      lastStep = -1;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
      playGlitchSound();
    };

    const unsub = useOSStore.subscribe((state, prev) => {
      if (state.phase !== prev.phase) start();
    });

    return () => {
      unsub();
      stop();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-fx-ignore=""
      aria-hidden="true"
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: FX_Z.glitch }}
    >
      <svg width="0" height="0" focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <filter id={FILTER_ID} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
            {/* Horizontal bands: noise that only varies along y, quantised into hard slices */}
            <feTurbulence
              ref={turbulenceRef}
              type="fractalNoise"
              baseFrequency="0.00001 0.06"
              numOctaves={1}
              seed={1}
              result="noise"
            />
            <feComponentTransfer in="noise" result="bands">
              <feFuncR ref={tableRef} type="discrete" tableValues="0.5 0.5" />
              <feFuncG type="discrete" tableValues="0.5" />
              <feFuncA type="discrete" tableValues="1" />
            </feComponentTransfer>
            <feDisplacementMap
              ref={displaceRef}
              in="SourceGraphic"
              in2="bands"
              scale={0}
              xChannelSelector="R"
              yChannelSelector="G"
              result="sliced"
            />
            {/* RGB split: offset the red and blue channels in opposite directions */}
            <feColorMatrix in="sliced" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
            <feOffset ref={redRef} in="red" dx={0} dy={0} result="redShift" />
            <feColorMatrix in="sliced" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
            <feColorMatrix in="sliced" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
            <feOffset ref={blueRef} in="blue" dx={0} dy={0} result="blueShift" />
            <feBlend in="redShift" in2="green" mode="screen" result="redGreen" />
            <feBlend in="redGreen" in2="blueShift" mode="screen" />
          </filter>
        </defs>
      </svg>
      <canvas
        ref={noiseRef}
        className="absolute inset-0 h-full w-full"
        style={{ opacity: 0, imageRendering: 'pixelated' }}
      />
    </div>
  );
}

export const GlitchTransition = memo(GlitchTransitionInner);
