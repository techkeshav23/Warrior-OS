// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Mastery Radar (SVG-based)
// Relative mastery across the learning decks: a radar over the six
// most studied decks (the list alone below three decks) plus a list
// with each shown deck's numbers. No decks → a nudge to create one.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useId, useMemo } from 'react';
import { Compass, Swords } from 'lucide-react';
import { Button, Card, EmptyState, ProgressBar } from '@/components/ui';
import { useLearningStore } from '@/stores/useLearningStore';
import { openTrainingGrounds } from '@/components/widgets/os-events';
import { CHART, INK, LINE } from '@/styles/tokens';
import { MASTERY_COLOR, RADAR_MAX_DECKS, rankDeckMastery, type DeckMasteryRow } from './learning-stats';

// Wider than tall so side labels have room.
const WIDTH = 300;
const HEIGHT = 236;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;
const MAX_R = 78;
const LABEL_R = 1.16;
const GRID_LEVELS = [0.25, 0.5, 0.75, 1];

function pct(value: number): number {
  return Math.round(value * 100);
}

function shortName(row: DeckMasteryRow): string {
  const name = row.name.length > 9 ? `${row.name.slice(0, 8)}…` : row.name;
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

function DeckList({ rows }: { rows: DeckMasteryRow[] }) {
  return (
    <ul className="min-w-[180px] flex-1 divide-y divide-line">
      {rows.map((row) => (
        <li key={row.id} title={describe(row)} className="py-2 first:pt-0 last:pb-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-ui text-fg">
              <span aria-hidden="true">{row.icon}</span> {row.name}
            </span>
            <span className="tabular shrink-0 font-mono text-xs text-fg">{pct(row.mastery.value)}%</span>
          </div>
          <ProgressBar
            className="mt-1.5"
            value={row.mastery.value * 100}
            size="sm"
            color={MASTERY_COLOR}
            animated={false}
            aria-label={`${row.name} mastery`}
          />
          <p className="tabular mt-1 font-mono text-2xs text-fg-subtle">
            {row.mastery.mastered}/{row.mastery.total} mastered · {row.mastery.seen} studied
          </p>
        </li>
      ))}
    </ul>
  );
}

function Radar({ rows }: { rows: DeckMasteryRow[] }) {
  const fillId = `radar-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
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
      className="mx-auto w-full max-w-[300px] shrink-0 overflow-visible font-mono"
      role="img"
      aria-label={`Deck mastery radar. ${rows.map(describe).join('. ')}`}
    >
      <defs>
        <radialGradient id={fillId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={MASTERY_COLOR} stopOpacity={0.08} />
          <stop offset="100%" stopColor={MASTERY_COLOR} stopOpacity={CHART.areaOpacity} />
        </radialGradient>
      </defs>
      {GRID_LEVELS.map((level) => (
        <polygon
          key={level}
          points={outline(level)}
          fill="none"
          stroke={level === 1 ? LINE.strong : CHART.grid}
          strokeWidth="1"
        />
      ))}
      {rows.map((row, i) => {
        const p = point(i, n, 1);
        return <line key={row.id} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke={CHART.grid} strokeWidth="1" />;
      })}
      {/* 50% ring label */}
      <text x={CX + 3} y={CY - MAX_R * 0.5 - 3} fontSize="9" fill={CHART.axis} opacity={0.8}>
        50
      </text>

      <polygon
        points={rows
          .map((row, i) => {
            const p = point(i, n, row.mastery.value);
            return `${p.x},${p.y}`;
          })
          .join(' ')}
        fill={`url(#${fillId})`}
        stroke={MASTERY_COLOR}
        strokeWidth={CHART.strokeWidth}
        strokeLinejoin="round"
      />

      {rows.map((row, i) => {
        const p = point(i, n, row.mastery.value);
        return (
          <g key={row.id}>
            <title>{describe(row)}</title>
            {/* Hover target bigger than the mark. */}
            <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
            <circle cx={p.x} cy={p.y} r="3.5" fill={MASTERY_COLOR} stroke={INK[950]} strokeWidth="2" />
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
            fill={CHART.axis}
            fontSize={CHART.axisFontSize}
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
    <Card
      eyebrow="Decks"
      title="Mastery map"
      role="region"
      aria-label="Deck mastery"
      className="h-full"
      actions={
        ranked.length > RADAR_MAX_DECKS ? (
          <span className="tabular font-mono text-2xs text-fg-subtle">
            Top {RADAR_MAX_DECKS} of {ranked.length}
          </span>
        ) : undefined
      }
      footer={
        shown.length > 0 ? (
          <p className="text-xs text-fg-subtle">
            {studied
              ? 'Mastery updates as you answer cards.'
              : 'Answer a few cards in Training Grounds to light up your map.'}
          </p>
        ) : undefined
      }
    >
      {shown.length === 0 ? (
        <EmptyState
          size="sm"
          icon={Compass}
          title="No decks yet"
          description="Build a deck on anything you want to learn. Your mastery map lights up as you answer cards."
          actions={
            <Button size="sm" variant="secondary" leadingIcon={Swords} onClick={() => openTrainingGrounds()}>
              Open Training Grounds
            </Button>
          }
        />
      ) : (
        <div className="flex flex-wrap items-center gap-5">
          {/* A radar needs three axes; fewer decks read fine as the list alone. */}
          {shown.length >= 3 && <Radar rows={shown} />}
          <DeckList rows={shown} />
        </div>
      )}
    </Card>
  );
}

export const RadarChart = memo(RadarChartInner);
