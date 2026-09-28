// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Radar Chart (SVG-based)
// Shows relative mastery across the learning decks
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { computeDeckMastery, deckCards, useLearningStore } from '@/stores/useLearningStore';
import type { Deck } from '@/types/learning';

/** Most axes the radar shows: the decks with the most cards. */
const MAX_AXES = 8;

function chartDecks(decks: readonly Deck[]): Deck[] {
  return [...decks].sort((a, b) => deckCards(b).length - deckCards(a).length).slice(0, MAX_AXES);
}

function RadarChartInner() {
  const cx = 120;
  const cy = 120;
  const maxR = 90;

  // Mastery is computed inside the store selector so it re-runs on every
  // answer (a getter called during render could be memoised by the React
  // Compiler); useShallow keeps the arrays stable when unchanged.
  const subjects = useLearningStore(useShallow((s) => chartDecks(s.decks).map((d) => d.name)));
  const values = useLearningStore(
    useShallow((s) => chartDecks(s.decks).map((d) => computeDeckMastery(d, s.reviews).value))
  );
  const n = subjects.length;

  // A radar needs three axes; fewer decks read better as bars.
  if (n < 3) {
    return (
      <div className="p-4 rounded-xl border border-white/10 bg-black/20">
        <p className="text-xs text-white/60 mb-2">Deck Mastery</p>
        {n === 0 && <p className="text-[11px] text-white/40">No decks yet.</p>}
        <div className="space-y-2">
          {subjects.map((name, i) => (
            <div key={`${name}-${i}`}>
              <div className="flex justify-between text-[11px] text-white/60">
                <span className="truncate">{name}</span>
                <span>{Math.round(values[i] * 100)}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400/70 rounded-full" style={{ width: `${values[i] * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-white/30 text-center mt-3">Mastery updates as you answer cards</p>
      </div>
    );
  }

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const r = maxR * value;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="p-4 rounded-xl border border-white/10 bg-black/20">
      <p className="text-xs text-white/60 mb-2">Deck Mastery</p>
      <svg viewBox="0 0 240 240" className="w-full max-w-[240px] mx-auto">
        {/* Grid */}
        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={Array.from({ length: n }, (_, i) => {
              const p = getPoint(i, level);
              return `${p.x},${p.y}`;
            }).join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.5"
          />
        ))}

        {/* Axes */}
        {subjects.map((_, i) => {
          const p = getPoint(i, 1);
          return (
            <line
              key={i}
              x1={cx} y1={cy}
              x2={p.x} y2={p.y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={values.map((v, i) => {
            const p = getPoint(i, v);
            return `${p.x},${p.y}`;
          }).join(' ')}
          fill="rgba(34,211,238,0.15)"
          stroke="rgba(34,211,238,0.5)"
          strokeWidth="1.5"
        />

        {/* Data points */}
        {values.map((v, i) => {
          const p = getPoint(i, v);
          return (
            <circle
              key={i}
              cx={p.x} cy={p.y}
              r="2.5"
              fill="#22d3ee"
              opacity="0.8"
            />
          );
        })}

        {/* Labels */}
        {subjects.map((subject, i) => {
          const p = getPoint(i, 1.2);
          return (
            <text
              key={`${subject}-${i}`}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-white/40 text-[5px]"
            >
              {subject.length > 8 ? subject.slice(0, 7) + '…' : subject}
            </text>
          );
        })}
      </svg>
      <p className="text-[10px] text-white/30 text-center mt-1">
        Mastery updates as you answer cards
      </p>
    </div>
  );
}

export const RadarChart = memo(RadarChartInner);
