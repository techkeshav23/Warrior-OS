// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Wallpaper catalog + mini previews (Settings)
// Exactly the wallpapers WallpaperEngine can draw (its component map);
// any other saved id renders as Deep Space there, so it shows as Deep
// Space here. Each preview is a small CSS + SVG painting of the real
// wallpaper, drawn only with theme tokens (no GPU, no canvas).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type WallpaperId = 'void' | 'nebula' | 'aurora' | 'fluid' | 'starfield' | 'matrix' | 'neural';

export interface WallpaperOption {
  id: WallpaperId;
  label: string;
  hint: string;
}

export const WALLPAPERS: readonly WallpaperOption[] = [
  { id: 'void', label: 'Deep Space', hint: 'CSS · lightest' },
  { id: 'nebula', label: 'Nebula', hint: 'Shader' },
  { id: 'aurora', label: 'Aurora', hint: 'Shader' },
  { id: 'fluid', label: 'Fluid', hint: 'Shader · interactive' },
  { id: 'starfield', label: 'Starfield', hint: 'Canvas' },
  { id: 'matrix', label: 'Matrix Rain', hint: 'Canvas' },
  { id: 'neural', label: 'Neural Net', hint: 'Canvas' },
];

export const FALLBACK_WALLPAPER: WallpaperId = 'void';

export function isKnownWallpaper(id: string): id is WallpaperId {
  return WALLPAPERS.some((w) => w.id === id);
}

/** The id the engine will actually draw for a saved value. */
export function resolveWallpaper(id: string): WallpaperId {
  return isKnownWallpaper(id) ? id : FALLBACK_WALLPAPER;
}

export function wallpaperLabel(id: string): string {
  return WALLPAPERS.find((w) => w.id === resolveWallpaper(id))?.label ?? 'Deep Space';
}

// ─── Painting helpers ───

/** A theme color at some opacity, for gradients. */
const tint = (token: string, pct: number) => `color-mix(in oklab, var(--color-${token}) ${pct}%, transparent)`;
const INK = 'var(--color-ink-950)';

/** Small deterministic PRNG so previews look the same on every render. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
}

function makeStars(seed: number, count: number, maxY = 100, big = 1): Star[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => {
    const bright = rand() > 0.86;
    return {
      x: Math.round(rand() * 1600) / 10,
      y: Math.round(rand() * maxY * 10) / 10,
      r: (bright ? 0.7 + rand() * 0.5 : 0.25 + rand() * 0.35) * big,
      o: bright ? 0.85 : 0.3 + rand() * 0.45,
    };
  });
}

function Stars({ stars, className = 'fill-fg' }: { stars: Star[]; className?: string }) {
  return (
    <g className={className}>
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o} />
      ))}
    </g>
  );
}

// Matrix rain: columns of glyph dashes with a bright head.
const MATRIX = (() => {
  const rand = seeded(41);
  return Array.from({ length: 17 }, (_, col) => {
    const len = 4 + Math.floor(rand() * 9);
    const top = -8 + rand() * 70;
    return { x: 3 + col * 9.4, top, len, dim: rand() > 0.6 };
  });
})();

// Neural net: nodes + edges between near neighbours.
const NEURAL = (() => {
  const rand = seeded(7);
  const nodes = Array.from({ length: 16 }, () => ({ x: 8 + rand() * 144, y: 8 + rand() * 84, hot: rand() > 0.8 }));
  const edges: [number, number][] = [];
  nodes.forEach((a, i) =>
    nodes.forEach((b, j) => {
      if (j <= i) return;
      if (Math.hypot(a.x - b.x, a.y - b.y) < 40) edges.push([i, j]);
    })
  );
  return { nodes, edges };
})();

const STARS_DEEP = makeStars(3, 26, 70);
const STARS_NEBULA = makeStars(11, 18);
const STARS_AURORA = makeStars(23, 22, 45);
const STARS_FIELD = makeStars(97, 64, 100, 1.1);

interface Painting {
  /** Base background layers. */
  base: string;
  /** Soft layer drawn blurred (clouds, swirls). */
  haze?: string;
  /** Crisp SVG detail in a 160×100 box. */
  svg?: ReactNode;
}

const PAINTINGS: Record<WallpaperId, Painting> = {
  void: {
    base: [
      `radial-gradient(50% 40% at 84% 98%, ${tint('ember-500', 26)}, transparent 70%)`,
      `radial-gradient(55% 60% at 16% 20%, ${tint('plasma-400', 24)}, transparent 70%)`,
      `radial-gradient(40% 50% at 4% 58%, ${tint('viz-3', 16)}, transparent 72%)`,
      `radial-gradient(28% 26% at 36% 10%, ${tint('plasma-300', 12)}, transparent 72%)`,
      `linear-gradient(180deg, var(--color-ink-900), ${INK} 65%)`,
    ].join(','),
    svg: (
      <>
        <Stars stars={STARS_DEEP} />
        <circle cx={132} cy={158} r={70} className="fill-ink-950" />
        <circle cx={132} cy={158} r={70} fill="none" strokeWidth={3} opacity={0.22} className="stroke-ember-400" />
        <circle cx={132} cy={158} r={70} fill="none" strokeWidth={0.7} opacity={0.85} className="stroke-ember-300" />
      </>
    ),
  },
  nebula: {
    base: `linear-gradient(160deg, var(--color-ink-900), ${INK})`,
    haze: [
      `radial-gradient(45% 55% at 30% 45%, ${tint('viz-6', 50)}, transparent 70%)`,
      `radial-gradient(45% 50% at 68% 58%, ${tint('viz-3', 55)}, transparent 70%)`,
      `radial-gradient(34% 38% at 52% 26%, ${tint('plasma-500', 45)}, transparent 70%)`,
      `radial-gradient(30% 35% at 84% 84%, ${tint('viz-5', 34)}, transparent 70%)`,
      `radial-gradient(26% 30% at 12% 82%, ${tint('plasma-600', 34)}, transparent 70%)`,
    ].join(','),
    svg: <Stars stars={STARS_NEBULA} />,
  },
  aurora: {
    base: [
      `linear-gradient(to top, ${INK} 0 18%, transparent 34%)`,
      `linear-gradient(180deg, ${INK}, var(--color-ink-900) 70%, ${INK})`,
    ].join(','),
    haze: [
      `radial-gradient(130% 70% at 40% 108%, transparent 50%, ${tint('viz-4', 55)} 57%, ${tint('plasma-400', 38)} 62%, transparent 70%)`,
      `radial-gradient(120% 64% at 72% 104%, transparent 56%, ${tint('viz-3', 42)} 63%, transparent 71%)`,
      `radial-gradient(60% 30% at 40% 62%, ${tint('viz-4', 16)}, transparent 70%)`,
    ].join(','),
    svg: <Stars stars={STARS_AURORA} />,
  },
  fluid: {
    base: INK,
    haze: [
      `radial-gradient(22% 26% at 42% 56%, ${INK}, transparent 72%)`,
      `conic-gradient(from 210deg at 42% 56%, ${tint('viz-6', 55)}, ${tint('viz-3', 60)}, ${tint('plasma-600', 50)}, ${tint('viz-5', 42)}, ${tint('viz-6', 55)})`,
    ].join(','),
    svg: (
      <g fill="none" strokeLinecap="round" className="stroke-plasma-300">
        <path d="M-10 72 C 28 40, 62 92, 100 56 S 150 26, 172 44" strokeWidth={7} opacity={0.12} />
        <path d="M-10 72 C 28 40, 62 92, 100 56 S 150 26, 172 44" strokeWidth={0.8} opacity={0.5} />
        <path d="M-6 30 C 30 14, 58 44, 92 26 S 140 8, 168 18" strokeWidth={0.6} opacity={0.3} />
      </g>
    ),
  },
  starfield: {
    base: [
      `radial-gradient(60% 55% at 72% 28%, ${tint('viz-3', 12)}, transparent 70%)`,
      `radial-gradient(55% 55% at 18% 82%, ${tint('viz-6', 12)}, transparent 70%)`,
      INK,
    ].join(','),
    svg: (
      <>
        <Stars stars={STARS_FIELD} />
        <g className="stroke-fg" strokeWidth={0.35} opacity={0.7}>
          <path d="M44 18 h6 M47 15 v6" />
          <path d="M122 64 h5 M124.5 61.5 v5" />
        </g>
      </>
    ),
  },
  matrix: {
    base: [`linear-gradient(to top, ${tint('viz-4', 12)}, transparent 60%)`, INK].join(','),
    svg: (
      <g>
        {MATRIX.map((c, ci) =>
          Array.from({ length: c.len }, (_, k) => {
            const head = k === c.len - 1;
            return (
              <rect
                key={`${ci}-${k}`}
                x={c.x}
                y={c.top + k * 4.6}
                width={2.4}
                height={3}
                rx={0.4}
                className={head ? 'fill-fg' : 'fill-viz-4'}
                opacity={head ? 0.95 : (c.dim ? 0.35 : 0.75) * ((k + 1) / c.len)}
              />
            );
          })
        )}
      </g>
    ),
  },
  neural: {
    base: [`radial-gradient(60% 60% at 50% 50%, ${tint('plasma-600', 16)}, transparent 72%)`, INK].join(','),
    svg: (
      <>
        <g className="stroke-plasma-400" strokeWidth={0.5} opacity={0.45}>
          {NEURAL.edges.map(([a, b]) => (
            <line key={`${a}-${b}`} x1={NEURAL.nodes[a].x} y1={NEURAL.nodes[a].y} x2={NEURAL.nodes[b].x} y2={NEURAL.nodes[b].y} />
          ))}
        </g>
        <g className="fill-plasma-300">
          {NEURAL.nodes.map((n, i) => (
            <g key={i}>
              {n.hot && <circle cx={n.x} cy={n.y} r={5} opacity={0.18} />}
              <circle cx={n.x} cy={n.y} r={n.hot ? 1.8 : 1.2} opacity={n.hot ? 1 : 0.7} />
            </g>
          ))}
        </g>
      </>
    ),
  },
};

const VIGNETTE: CSSProperties = {
  backgroundImage: `radial-gradient(130% 100% at 50% 40%, transparent 58%, ${tint('ink-950', 70)} 100%)`,
};

/** A 16:10 painting of a wallpaper (decorative). */
function WallpaperThumbInner({ id, className }: { id: string; className?: string }) {
  const p = PAINTINGS[resolveWallpaper(id)];
  return (
    <div
      aria-hidden
      className={cn('relative aspect-[16/10] w-full overflow-hidden bg-ink-950', className)}
      style={{ backgroundImage: p.base }}
    >
      {p.haze && <div className="absolute -inset-[20%] blur-md" style={{ backgroundImage: p.haze }} />}
      {p.svg && (
        <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
          {p.svg}
        </svg>
      )}
      <div className="absolute inset-0" style={VIGNETTE} />
    </div>
  );
}

export const WallpaperThumb = memo(WallpaperThumbInner);
