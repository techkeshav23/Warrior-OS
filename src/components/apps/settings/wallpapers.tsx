// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Wallpaper catalog + mini previews (Settings)
// Exactly the wallpapers WallpaperEngine can draw (its component map);
// any other saved id renders as Forge Night there, so it shows as Forge
// Night here. Each preview is a small CSS + SVG painting of the real
// wallpaper, drawn only with theme tokens (no GPU, no canvas).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type WallpaperId =
  | 'void'
  | 'embers'
  | 'molten'
  | 'dusk'
  | 'steelrain'
  | 'nebula'
  | 'aurora'
  | 'fluid'
  | 'starfield'
  | 'matrix'
  | 'neural';

export interface WallpaperOption {
  id: WallpaperId;
  label: string;
  hint: string;
}

export const WALLPAPERS: readonly WallpaperOption[] = [
  { id: 'void', label: 'Forge Night', hint: 'CSS · lightest' },
  { id: 'embers', label: 'Ember Storm', hint: 'Canvas · pointer' },
  { id: 'molten', label: 'Molten Core', hint: 'Shader' },
  { id: 'dusk', label: 'Battlefield Dusk', hint: 'Canvas · depth' },
  { id: 'steelrain', label: 'Steel Rain', hint: 'Canvas' },
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
  return WALLPAPERS.find((w) => w.id === resolveWallpaper(id))?.label ?? 'Forge Night';
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

// Ember Storm: short rising streaks, hotter (whiter) near the forge bed.
const SPARKS = (() => {
  const rand = seeded(313);
  return Array.from({ length: 46 }, () => {
    const bell = (rand() + rand() + rand()) / 3 - 0.5;
    const x = 80 + bell * 190;
    const y = 8 + Math.pow(rand(), 0.6) * 92;
    const len = 1.6 + rand() * 3.2;
    const lean = (rand() - 0.5) * 1.6;
    const tone = y > 70 ? 'stroke-ember-200' : y > 40 ? 'stroke-ember-300' : 'stroke-ember-500';
    return { x, y, len, lean, tone, o: 0.35 + (y / 100) * 0.6, big: rand() > 0.88 };
  });
})();

// Molten Core: a crack network (jittered lattice edges) over dark rock.
const CRACKS = (() => {
  const rand = seeded(59);
  const pts: { x: number; y: number }[][] = [];
  for (let gy = 0; gy < 5; gy++) {
    const row: { x: number; y: number }[] = [];
    for (let gx = 0; gx < 7; gx++) row.push({ x: -8 + gx * 29 + (rand() - 0.5) * 24, y: -6 + gy * 28 + (rand() - 0.5) * 22 });
    pts.push(row);
  }
  const d: string[] = [];
  const seg = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const mx = (a.x + b.x) / 2 + (rand() - 0.5) * 12;
    const my = (a.y + b.y) / 2 + (rand() - 0.5) * 12;
    d.push(`M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${mx.toFixed(1)} ${my.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
  };
  pts.forEach((row, y) =>
    row.forEach((p, x) => {
      if (x + 1 < row.length) seg(p, row[x + 1]);
      if (y + 1 < pts.length) seg(p, pts[y + 1][(x + (y % 2)) % row.length]);
    })
  );
  return d.join('');
})();

// Steel Rain: slanted streaks and sliding drops with wet trails.
const RAIN = (() => {
  const rand = seeded(808);
  const streaks = Array.from({ length: 34 }, () => ({ x: rand() * 170 - 5, y: rand() * 100, len: 4 + rand() * 6, o: 0.15 + rand() * 0.3 }));
  const drops = Array.from({ length: 12 }, () => ({ x: 6 + rand() * 148, y: 10 + rand() * 84, trail: 8 + rand() * 26, r: 0.7 + rand() * 0.7 }));
  const rivets = [34, 78].flatMap((y) => Array.from({ length: 9 }, (_, i) => ({ x: 8 + i * 18, y: y - 3 })));
  return { streaks, drops, rivets };
})();

/** Ridge silhouettes for the Battlefield Dusk preview (160×100 box). */
const DUSK_FAR = 'M0 62 L10 55 L18 58 L28 47 L36 53 L46 44 L56 52 L66 49 L76 56 L86 50 L98 57 L110 51 L122 58 L134 52 L146 57 L160 53 V100 H0Z';
const DUSK_MID =
  'M0 74 L20 71 L34 73 L40 72 V60 h1.5 v-1.5 h1.5 v1.5 h1.5 v-1.5 h1.5 v1.5 h1.5 V64 H54 V52 h2 v-2 h2 v2 h2 v-2 h2 v2 h2 V64 H70 V58 h1.5 v-1.5 h1.5 v1.5 h1.5 v-1.5 h1.5 V64 H80 V61 h1.5 v-1.5 h1.5 v1.5 h1.5 V72 L100 74 L126 71 L160 75 V100 H0Z';
const DUSK_NEAR = 'M0 86 L18 83 L36 85 L60 82 L84 86 L110 84 L134 87 L160 83 V100 H0Z';
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
  embers: {
    base: [
      `radial-gradient(70% 55% at 46% 108%, ${tint('ember-400', 55)}, ${tint('ember-700', 28)} 45%, transparent 75%)`,
      `radial-gradient(40% 40% at 12% -5%, ${tint('steel-400', 16)}, transparent 70%)`,
      `linear-gradient(180deg, ${INK}, var(--color-steel-900) 50%, var(--color-steel-850))`,
    ].join(','),
    haze: [
      `radial-gradient(40% 22% at 30% 62%, ${tint('steel-500', 22)}, transparent 70%)`,
      `radial-gradient(45% 20% at 74% 48%, ${tint('steel-500', 16)}, transparent 70%)`,
    ].join(','),
    svg: (
      <g strokeLinecap="round">
        {SPARKS.map((s, i) => (
          <g key={i} opacity={s.o}>
            {s.big && <circle cx={s.x} cy={s.y} r={2.4} className="fill-ember-400" opacity={0.25} />}
            <line
              x1={s.x - s.lean}
              y1={s.y + s.len}
              x2={s.x}
              y2={s.y}
              strokeWidth={s.big ? 0.9 : 0.55}
              className={s.tone}
            />
          </g>
        ))}
      </g>
    ),
  },
  molten: {
    base: [
      `radial-gradient(55% 60% at 30% 80%, ${tint('ember-700', 45)}, transparent 72%)`,
      `radial-gradient(35% 40% at 82% 30%, ${tint('ember-800', 40)}, transparent 72%)`,
      `linear-gradient(160deg, var(--color-steel-800), var(--color-steel-950))`,
    ].join(','),
    svg: (
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={CRACKS} strokeWidth={4} opacity={0.18} className="stroke-ember-600" />
        <path d={CRACKS} strokeWidth={1.4} opacity={0.7} className="stroke-ember-500" />
        <path d={CRACKS} strokeWidth={0.6} opacity={0.9} className="stroke-ember-200" />
      </g>
    ),
  },
  dusk: {
    base: [
      `radial-gradient(45% 45% at 64% 60%, ${tint('ember-300', 60)}, ${tint('ember-500', 30)} 30%, transparent 70%)`,
      `linear-gradient(180deg, ${INK}, var(--color-steel-900) 22%, var(--color-ember-800) 52%, var(--color-ember-700) 62%, var(--color-ember-600) 70%, var(--color-ember-800))`,
    ].join(','),
    svg: (
      <>
        <g className="fill-steel-900" opacity={0.55}>
          <ellipse cx={60} cy={38} rx={60} ry={1.4} />
          <ellipse cx={112} cy={47} rx={44} ry={1.2} />
          <ellipse cx={40} cy={52} rx={36} ry={1} />
        </g>
        <circle cx={102} cy={60} r={6.5} className="fill-ember-100" />
        <circle cx={102} cy={60} r={6.5} fill="none" strokeWidth={1} opacity={0.6} className="stroke-ember-300" />
        <path d={DUSK_FAR} className="fill-ember-800" />
        <path d={DUSK_MID} className="fill-steel-950" opacity={0.92} />
        <g className="fill-ember-400">
          <rect x={57} y={56} width={0.8} height={1.6} />
          <rect x={60.5} y={56} width={0.8} height={1.6} />
          <rect x={73} y={60} width={0.8} height={1.6} />
        </g>
        <path d={DUSK_NEAR} className="fill-ink-950" />
        <g className="stroke-ink-950" strokeWidth={0.8}>
          <line x1={18} y1={84} x2={18} y2={50} />
          <line x1={140} y1={86} x2={140} y2={56} />
        </g>
        <path d="M18 51 h9 v14 l-2 -2.5 l-2.5 3.5 l-4.5 -3 Z" className="fill-ember-800" />
        <path d="M140 57 h8 v12 l-2 -2 l-2 3 l-4 -2.5 Z" className="fill-ember-800" />
        <path d="M18 51 h9 v14 l-2 -2.5" fill="none" strokeWidth={0.4} opacity={0.7} className="stroke-ember-400" />
      </>
    ),
  },
  steelrain: {
    base: [
      `radial-gradient(45% 45% at 4% 104%, ${tint('ember-600', 26)}, transparent 70%)`,
      `linear-gradient(180deg, transparent 20%, ${tint('steel-200', 7)} 42%, transparent 60%)`,
      `repeating-linear-gradient(180deg, ${tint('steel-200', 5)} 0 1px, transparent 1px 3px)`,
      `linear-gradient(160deg, var(--color-steel-600), var(--color-steel-750) 45%, var(--color-steel-900))`,
    ].join(','),
    svg: (
      <>
        <g strokeWidth={0.7}>
          <line x1={0} y1={34} x2={160} y2={34} className="stroke-ink-950" opacity={0.8} />
          <line x1={0} y1={35} x2={160} y2={35} className="stroke-steel-300" opacity={0.25} />
          <line x1={0} y1={78} x2={160} y2={78} className="stroke-ink-950" opacity={0.8} />
          <line x1={0} y1={79} x2={160} y2={79} className="stroke-steel-300" opacity={0.25} />
          <line x1={44} y1={0} x2={44} y2={34} className="stroke-ink-950" opacity={0.8} />
          <line x1={112} y1={34} x2={112} y2={78} className="stroke-ink-950" opacity={0.8} />
        </g>
        <g className="fill-steel-300" opacity={0.55}>
          {RAIN.rivets.map((r, i) => (
            <circle key={i} cx={r.x} cy={r.y} r={0.8} />
          ))}
        </g>
        <path
          d="M96 -2 L92 12 L98 16 L90 32 L96 36 L86 58"
          fill="none"
          strokeWidth={0.7}
          strokeLinejoin="round"
          opacity={0.55}
          className="stroke-plasma-300"
        />
        <g className="stroke-steel-200" strokeLinecap="round">
          {RAIN.drops.map((d, i) => (
            <line key={i} x1={d.x} y1={d.y - d.trail} x2={d.x} y2={d.y} strokeWidth={d.r} opacity={0.18} />
          ))}
          {RAIN.streaks.map((s, i) => (
            <line key={`s${i}`} x1={s.x - s.len * 0.16} y1={s.y - s.len} x2={s.x} y2={s.y} strokeWidth={0.35} opacity={s.o} />
          ))}
        </g>
        <g className="fill-fg">
          {RAIN.drops.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r * 0.9} opacity={0.75} />
          ))}
        </g>
      </>
    ),
  },
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
