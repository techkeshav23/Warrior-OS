// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Subject Radar Chart (SVG-based)
// Shows relative mastery across GATE subjects
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { getAvailableSubjects } from '@/data/gate-questions';
import { useQuizHistoryStore } from '@/stores/useQuizHistoryStore';

function RadarChartInner() {
  const subjects = getAvailableSubjects();
  const n = subjects.length;
  const cx = 120;
  const cy = 120;
  const maxR = 90;

  // Subscribe to attempts so the chart re-renders when new quiz data lands.
  // Compute mastery inline — 12 subjects × O(window) is negligible per render.
  useQuizHistoryStore((s) => s.attempts);
  const getMastery = useQuizHistoryStore((s) => s.getMastery);
  const values = subjects.map((s) => getMastery(s));

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
      <p className="text-xs text-white/60 mb-2">Subject Mastery</p>
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
              key={subject}
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
        Mastery updates as you complete quizzes
      </p>
    </div>
  );
}

export const RadarChart = memo(RadarChartInner);
