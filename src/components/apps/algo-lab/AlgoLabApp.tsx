// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab App
// Algorithm visualizer: category sidebar + visualizer, playback
// controls, pseudocode and complexity for sorting, graph and tree
// algorithms, plus a two-algorithm Compare Race.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AlgoLabView } from '@/types/algo';
import { ALGO_LAB_SECTIONS, SORTING_ALGORITHMS, isGraphView, isSortView, isTreeView } from '@/data/algorithms';
import { SORT_ALGORITHM_IDS } from '@/lib/algorithms/sorting';
import { useAlgoLabStore } from './useAlgoLabStore';
import { SortingVisualizer } from './SortingVisualizer';
import { GraphVisualizer } from './GraphVisualizer';
import { TreeVisualizer } from './TreeVisualizer';
import { CompareMode } from './CompareMode';

function renderView(view: AlgoLabView) {
  if (view === 'compare') return <CompareMode />;
  if (isSortView(view)) return <SortingVisualizer algorithm={view} />;
  if (isGraphView(view)) return <GraphVisualizer algorithm={view} />;
  if (isTreeView(view)) return <TreeVisualizer mode={view} />;
  return null;
}

function ProgressRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-white/55">{label}</span>
      <span className="font-mono tabular-nums text-white/85">{value}</span>
    </div>
  );
}

function LabProgressInner() {
  const completedSorts = useAlgoLabStore((s) => s.completedSorts);
  const racesFinished = useAlgoLabStore((s) => s.racesFinished);
  const dijkstraPaths = useAlgoLabStore((s) => s.dijkstraPaths);
  const rotationsSeen = useAlgoLabStore((s) => s.rotationsSeen);
  const totalRuns = useAlgoLabStore((s) => s.totalRuns);

  return (
    <div className="hidden border-t border-white/10 px-3 py-2.5 @4xl/app:block">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/45">Progress</div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-white/55">Sorts run</span>
        <span className="flex items-center gap-1">
          {SORT_ALGORITHM_IDS.map((id) => (
            <span
              key={id}
              title={`${SORTING_ALGORITHMS[id].name}${completedSorts.includes(id) ? ' (done)' : ''}`}
              className={cn('h-1.5 w-1.5 rounded-full', completedSorts.includes(id) ? 'bg-emerald-400' : 'bg-white/15')}
            />
          ))}
          <span className="ml-1 font-mono tabular-nums text-white/85">
            {completedSorts.length}/{SORT_ALGORITHM_IDS.length}
          </span>
        </span>
      </div>
      <ProgressRow label="Races finished" value={racesFinished} />
      <ProgressRow label="Dijkstra paths" value={dijkstraPaths} />
      <ProgressRow label="AVL rotations" value={rotationsSeen} />
      <ProgressRow label="Total runs" value={totalRuns} />
    </div>
  );
}

const LabProgress = memo(LabProgressInner);

function LabSidebarInner() {
  const view = useAlgoLabStore((s) => s.view);
  const setView = useAlgoLabStore((s) => s.setView);
  const completedSorts = useAlgoLabStore((s) => s.completedSorts);

  return (
    <nav
      aria-label="Algorithms"
      className="flex w-14 shrink-0 flex-col border-r border-white/10 bg-black/20 @4xl/app:w-48"
    >
      <div className="flex items-center justify-center gap-2 px-3 py-3 @4xl/app:justify-start">
        <FlaskConical className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
        <h2 className="hidden text-sm font-bold tracking-wider text-cyan-400 @4xl/app:block">ALGO LAB</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {ALGO_LAB_SECTIONS.map((section) => (
          <div key={section.category} className="mb-1.5">
            <div className="hidden px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-white/45 @4xl/app:block">
              {section.icon} {section.label}
            </div>
            <div className="mx-2 my-2 h-px bg-white/10 @4xl/app:hidden" aria-hidden />
            <div className="flex flex-col gap-0.5">
              {section.entries.map((entry) => {
                const active = view === entry.view;
                const done = isSortView(entry.view) && completedSorts.includes(entry.view);
                return (
                  <button
                    key={entry.view}
                    type="button"
                    onClick={() => setView(entry.view)}
                    title={`${entry.label}: ${entry.hint}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg border px-1.5 py-1.5 text-left transition-all',
                      active
                        ? 'border-cyan-500/30 bg-cyan-500/20 text-cyan-200'
                        : 'border-transparent text-white/65 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-8 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-semibold',
                        active ? 'bg-cyan-400/20 text-cyan-100' : 'bg-white/5 text-white/70'
                      )}
                    >
                      {entry.short}
                    </span>
                    <span className="hidden min-w-0 flex-1 @4xl/app:block">
                      <span className="block truncate text-[12.5px]">{entry.label}</span>
                      <span className="block truncate text-[10px] text-white/45">{entry.hint}</span>
                    </span>
                    {done && <Check className="hidden h-3 w-3 shrink-0 text-emerald-400 @4xl/app:block" aria-label="Completed" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <LabProgress />
    </nav>
  );
}

const LabSidebar = memo(LabSidebarInner);

function AlgoLabAppInner() {
  const view = useAlgoLabStore((s) => s.view);
  const touch = useAlgoLabStore((s) => s.touch);

  // Remember when the lab was last opened (NEXUS can nudge after a long gap).
  useEffect(() => {
    touch();
  }, [touch]);

  return (
    <div className="@container/app flex h-full min-h-0 bg-black/30 text-white">
      <LabSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {renderView(view)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export const AlgoLabApp = memo(AlgoLabAppInner);
