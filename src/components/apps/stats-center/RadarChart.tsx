// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Mastery Radar (SVG-based)
// Relative mastery across the learning decks: a radar over the six
// most studied decks (the list alone below three decks) plus a list
// with each shown deck's numbers. No decks → a nudge to create one.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo } from 'react';
import { useLearningStore } from '@/stores/useLearningStore';
import { openTrainingGrounds } from '@/components/widgets/os-events';
import { MASTERY_COLOR, RADAR_MAX_DECKS, rankDeckMastery, type DeckMasteryRow } from './learning-stats';

// Wider than tall so side labels have room.
const WIDTH = 300;
const HEIGHT = 240;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;
const MAX_R = 80;
const LABEL_R = 1.12;
const GRID_LEVELS = [0.25, 0.5, 0.75, 1];

function pct(value: number): number {
  return Math.round(value * 100);
}

function shortName(row: DeckMasteryRow): string {
  const name = row.name.length > 8 ? `${row.name.slice(0, 7)}…` : row.name;
  return `${row.icon} ${name}`;
}

function describe(row: DeckMasteryRow): string {
  const m = row.mastery;
  return `${row.name}: ${pct(m.value)}% mastery, ${m.mastered} of ${m.total} cards mastered`;
}

function point(index: number, count: number, value: number) {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return { x: CX + MAX_R * value * Math.cos(angle), y: CY + MAX_R * value * Math.sin(angle), angle };
}

function EmptyDecks() {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <span className="text-3xl" aria-hidden="true">
        🧭
      </span>
      <p className="text-sm font-semibold text-white/80">No decks yet</p>
      <p className="max-w-[260px] text-[11px] text-white/45">
        Build a deck on anything you want to learn. Your mastery map lights up here as you answer cards.
      </p>
      <button
        type="button"
        onClick={() => openTrainingGrounds()}
        className="mt-1 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 transition-colors hover:bg-cyan-500/20 focus-ring"
      >
        Open Training Grounds
      </button>
    </div>
  );
}

function DeckList({ rows }: { rows: DeckMasteryRow[] }) {
  return (
    <ul className="min-w-[180px] flex-1 space-y-2">
      {rows.map((row) => (
        <li key={row.id} title={describe(row)}>
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="truncate text-white/70">
              <span aria-hidden="true">{row.icon}</span> {row.name}
            </span>
            <span className="shrink-0 font-mono text-white/80">{pct(row.mastery.value)}%</span>
          </div>
          <div
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-label={`${row.name} mastery`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct(row.mastery.value)}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${row.mastery.value * 100}%`, background: MASTERY_COLOR }}
            />
          </div>
          <p className="mt-0.5 text-[10px] text-white/35">
            {row.mastery.mastered}/{row.mastery.total} mastered · {row.mastery.seen} studied
          </p>
        </li>
      ))}
    </ul>
  );
}

function Radar({ rows }: { rows: DeckMasteryRow[] }) {
  const n = rows.length;
  const outline = (level: number) =>
    rows
      .map((_, i) => {
        const p = point(i, n, level);
        return `${p.x},${p.y}`;
      })
      .join(' ');

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="mx-auto w-full max-w-[300px] shrink-0 overflow-visible"
      role="img"
      aria-label={`Deck mastery radar. ${rows.map(describe).join('. ')}`}
    >
      {GRID_LEVELS.map((level) => (
        <polygon key={level} points={outline(level)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {rows.map((row, i) => {
        const p = point(i, n, 1);
        return (
          <line key={row.id} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        );
      })}

      <polygon
        points={rows
          .map((row, i) => {
            const p = point(i, n, row.mastery.value);
            return `${p.x},${p.y}`;
          })
          .join(' ')}
        fill={MASTERY_COLOR}
        fillOpacity="0.14"
        stroke={MASTERY_COLOR}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {rows.map((row, i) => {
        const p = point(i, n, row.mastery.value);
        return (
          <g key={row.id}>
            <title>{describe(row)}</title>
            {/* Hover target bigger than the mark. */}
            <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
            <circle cx={p.x} cy={p.y} r="4" fill={MASTERY_COLOR} stroke="#0c0c12" strokeWidth="2" />
          </g>
        );
      })}

      {rows.map((row, i) => {
        const p = point(i, n, LABEL_R);
        const cos = Math.cos(p.angle);
        const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
        return (
          <text
            key={row.id}
            x={p.x}
            y={p.y}
            textAnchor={anchor}
            dominantBaseline="central"
            className="fill-white/55"
            fontSize="10"
          >
            <title>{describe(row)}</title>
            {shortName(row)}
          </text>
        );
      })}
    </svg>
  );
}

function RadarChartInner() {
  const decks = useLearningStore((s) => s.decks);
  const reviews = useLearningStore((s) => s.reviews);
  const ranked = useMemo(() => rankDeckMastery(decks, reviews), [decks, reviews]);
  const shown = ranked.slice(0, RADAR_MAX_DECKS);
  const studied = shown.some((row) => row.mastery.seen > 0);

  return (
    <section className="rounded-xl border border-white/10 bg-black/20 p-4" aria-label="Deck mastery">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs text-white/60">Deck mastery</p>
        {ranked.length > RADAR_MAX_DECKS && (
          <p className="text-[10px] text-white/35">
            Top {RADAR_MAX_DECKS} of {ranked.length} decks · most studied
          </p>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyDecks />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            {/* A radar needs three axes; fewer decks read fine as the list alone. */}
            {shown.length >= 3 && <Radar rows={shown} />}
            <DeckList rows={shown} />
          </div>
          <p className="mt-3 text-center text-[10px] text-white/30">
            {studied
              ? 'Mastery updates as you answer cards'
              : 'Answer a few cards in Training Grounds to light up your map'}
          </p>
        </>
      )}
    </section>
  );
}

export const RadarChart = memo(RadarChartInner);
