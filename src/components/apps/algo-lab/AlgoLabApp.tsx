// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab App (FORGE HUD)
// Algorithm visualizer: AppLayout with a category sidebar (sorting /
// graphs / trees) + the visualizer frame (LabLayout): playback,
// pseudocode and complexity for sorting, graph and tree algorithms,
// plus a two-algorithm Compare Race. In a narrow window the sidebar
// folds into an algorithm picker in the header.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDownUp,
  Check,
  GitFork,
  ListPlus,
  Merge,
  Pyramid,
  Radar,
  Route,
  Scale,
  ScanSearch,
  Split,
  Swords,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppIcon, AppLayout, NavItem, Select, SidebarNav } from '@/components/ui';
import type { AlgoLabView } from '@/types/algo';
import { ALGO_LAB_SECTIONS, SORTING_ALGORITHMS, isAlgoLabView, isGraphView, isSortView, isTreeView } from '@/data/algorithms';
import { SORT_ALGORITHM_IDS } from '@/lib/algorithms/sorting';
import { TRANSITION } from '@/styles/tokens';
import { useAlgoLabStore } from './useAlgoLabStore';
import { SortingVisualizer } from './SortingVisualizer';
import { GraphVisualizer } from './GraphVisualizer';
import { TreeVisualizer } from './TreeVisualizer';
import { CompareMode } from './CompareMode';
import { LabChromeContext } from './LabLayout';

/** Below this window width the sidebar becomes a header picker. */
const COMPACT_BELOW_PX = 760;

const VIEW_ICON: Record<AlgoLabView, LucideIcon> = {
  'bubble-sort': ArrowDownUp,
  'selection-sort': ScanSearch,
  'insertion-sort': ListPlus,
  'merge-sort': Merge,
  'quick-sort': Split,
  'heap-sort': Pyramid,
  compare: Swords,
  bfs: Radar,
  dfs: Workflow,
  dijkstra: Route,
  bst: GitFork,
  avl: Scale,
};

function renderView(view: AlgoLabView) {
  if (view === 'compare') return <CompareMode />;
  if (isSortView(view)) return <SortingVisualizer algorithm={view} />;
  if (isGraphView(view)) return <GraphVisualizer algorithm={view} />;
  if (isTreeView(view)) return <TreeVisualizer mode={view} />;
  return null;
}

// ─── Progress (sidebar footer) ───

function ProgressCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-control bg-surface-2 px-2 py-1.5">
      <div className="hud-label truncate">{label}</div>
      <div className="tabular font-mono text-ui font-medium text-fg">{value}</div>
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
    <div className="flex flex-col gap-2 px-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="hud-label">Progress</span>
        <span className="tabular font-mono text-xs text-fg">
          {completedSorts.length}
          <span className="text-fg-subtle">/{SORT_ALGORITHM_IDS.length} sorts</span>
        </span>
      </div>
      <div className="flex gap-1" role="img" aria-label={`${completedSorts.length} of ${SORT_ALGORITHM_IDS.length} sorting algorithms run`}>
        {SORT_ALGORITHM_IDS.map((id) => {
          const done = completedSorts.includes(id);
          return (
            <span
              key={id}
              title={`${SORTING_ALGORITHMS[id].name}${done ? ' (done)' : ''}`}
              className={cn('h-1 flex-1 rounded-full', done ? 'bg-success shadow-[0_0_6px_var(--color-success)]' : 'bg-ink-600')}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <ProgressCell label="Races" value={racesFinished} />
        <ProgressCell label="Paths" value={dijkstraPaths} />
        <ProgressCell label="Rotations" value={rotationsSeen} />
        <ProgressCell label="Runs" value={totalRuns} />
      </div>
    </div>
  );
}

const LabProgress = memo(LabProgressInner);

// ─── Sidebar ───

function LabSidebarInner() {
  const view = useAlgoLabStore((s) => s.view);
  const setView = useAlgoLabStore((s) => s.setView);
  const completedSorts = useAlgoLabStore((s) => s.completedSorts);

  return (
    <SidebarNav
      aria-label="Algorithms"
      header={
        <div className="flex items-center gap-2.5">
          <AppIcon appId="algo-lab" size={28} active />
          <div className="min-w-0">
            <div className="truncate text-ui font-semibold text-fg">Algo Lab</div>
            <div className="hud-label truncate">Visualizer</div>
          </div>
        </div>
      }
      footer={<LabProgress />}
    >
      {/* The kit nav doesn't scroll; this column does, so the footer never overlaps it. */}
      <div className="scrollbar-thin -mx-3 -my-3 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-3">
        {ALGO_LAB_SECTIONS.map((section) => (
          <div key={section.category} className="flex flex-col gap-0.5">
            <div className="hud-label px-2.5 pb-1.5 pt-1">{section.label}</div>
            {section.entries.map((entry) => {
              const done = isSortView(entry.view) && completedSorts.includes(entry.view);
              return (
                <NavItem
                  key={entry.view}
                  icon={VIEW_ICON[entry.view]}
                  label={entry.label}
                  active={view === entry.view}
                  title={`${entry.label}: ${entry.hint}`}
                  onClick={() => setView(entry.view)}
                  badge={
                    done ? (
                      <Check size={14} strokeWidth={2} className="shrink-0 text-success" aria-label="Completed" />
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
    </SidebarNav>
  );
}

const LabSidebar = memo(LabSidebarInner);

// ─── Compact picker ───

function AlgorithmPicker() {
  const view = useAlgoLabStore((s) => s.view);
  const setView = useAlgoLabStore((s) => s.setView);
  return (
    <div className="w-44">
      <Select
        size="sm"
        aria-label="Algorithm"
        value={view}
        onValueChange={(value) => {
          if (isAlgoLabView(value)) setView(value);
        }}
      >
        {ALGO_LAB_SECTIONS.map((section) => (
          <optgroup key={section.category} label={section.label}>
            {section.entries.map((entry) => (
              <option key={entry.view} value={entry.view}>
                {entry.label}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </div>
  );
}

// ─── App ───

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w !== undefined) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function AlgoLabAppInner() {
  const view = useAlgoLabStore((s) => s.view);
  const touch = useAlgoLabStore((s) => s.touch);
  const reduceMotion = useReducedMotion();
  const [rootRef, width] = useElementWidth<HTMLDivElement>();
  const compact = width !== null && width < COMPACT_BELOW_PX;
  const chrome = useMemo(() => ({ picker: compact ? <AlgorithmPicker /> : null }), [compact]);

  // Remember when the lab was last opened (NEXUS can nudge after a long gap).
  useEffect(() => {
    touch();
  }, [touch]);

  return (
    <div ref={rootRef} className="h-full min-h-0 w-full bg-ink-950/25">
      <LabChromeContext.Provider value={chrome}>
        <AppLayout sidebar={compact ? undefined : <LabSidebar />} padded={false} scroll={false}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, x: reduceMotion ? 0 : 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={TRANSITION.small}
              className="flex min-h-0 flex-1 flex-col"
            >
              {renderView(view)}
            </motion.div>
          </AnimatePresence>
        </AppLayout>
      </LabChromeContext.Provider>
    </div>
  );
}

export const AlgoLabApp = memo(AlgoLabAppInner);
