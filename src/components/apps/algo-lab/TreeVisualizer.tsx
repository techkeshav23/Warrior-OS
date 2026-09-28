// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Tree Visualizer
// Animated BST insert / delete / search, AVL mode that shows every
// rotation, and inorder / preorder / postorder traversals
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dices, Eraser, Plus, RotateCcw, Search, Shuffle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AlgoTreeFrame, AlgoTreeMode, AlgoTreeRun } from '@/types/algo';
import { TREE_MODES, TREE_OPERATIONS } from '@/data/algorithms';
import {
  buildTree,
  idleTreeFrame,
  layoutTree,
  runTreeOperation,
  treeContains,
  treeHeight,
  treeSize,
  type TraversalKind,
  type TreeAction,
} from '@/lib/algorithms/tree';
import {
  DEFAULT_SPEED,
  MAX_TREE_NODES,
  SPEED_LEVELS,
  TREE_VALUE_MAX,
  TREE_VALUE_MIN,
  TREE_VIEW_HEIGHT,
  TREE_VIEW_WIDTH,
} from '@/lib/algorithms/constants';
import { useAlgoLabStore } from './useAlgoLabStore';
import { handlePlaybackKeys, usePlayback } from './usePlayback';
import { PlaybackControls } from './PlaybackControls';
import { CodePanel } from './CodePanel';
import { ComplexityCard } from './ComplexityCard';
import { LabLayout, Stat, StepMessage } from './LabLayout';

type TreeNodeState = 'idle' | 'path' | 'visited' | 'current' | 'rotating' | 'found' | 'removing';

const NODE_STYLE: Record<TreeNodeState, { fill: string; stroke: string; text: string; width: number }> = {
  idle: { fill: '#0f172a', stroke: 'rgba(34, 211, 238, 0.5)', text: '#e2e8f0', width: 2 },
  path: { fill: '#0f172a', stroke: '#22d3ee', text: '#cffafe', width: 3 },
  visited: { fill: 'rgba(59, 130, 246, 0.38)', stroke: '#60a5fa', text: '#dbeafe', width: 2.5 },
  current: { fill: 'rgba(250, 204, 21, 0.35)', stroke: '#facc15', text: '#fef9c3', width: 3.5 },
  rotating: { fill: 'rgba(251, 146, 60, 0.32)', stroke: '#fb923c', text: '#ffedd5', width: 3.5 },
  found: { fill: 'rgba(16, 185, 129, 0.42)', stroke: '#34d399', text: '#d1fae5', width: 3.5 },
  removing: { fill: 'rgba(244, 63, 94, 0.38)', stroke: '#f43f5e', text: '#ffe4e6', width: 3.5 },
};

const LEGEND: { label: string; color: string }[] = [
  { label: 'Comparing', color: '#facc15' },
  { label: 'Search path', color: '#22d3ee' },
  { label: 'Found / inserted', color: '#34d399' },
  { label: 'Rotating', color: '#fb923c' },
  { label: 'Deleting', color: '#f43f5e' },
  { label: 'Visited', color: '#60a5fa' },
];

const SPRING = { type: 'spring', stiffness: 260, damping: 28 } as const;

const TRAVERSALS: { id: TraversalKind; label: string }[] = [
  { id: 'inorder', label: 'Inorder' },
  { id: 'preorder', label: 'Preorder' },
  { id: 'postorder', label: 'Postorder' },
];

function parseKey(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= TREE_VALUE_MIN && value <= TREE_VALUE_MAX ? value : null;
}

function randomUniqueKeys(count: number, exclude: (value: number) => boolean): number[] {
  const picked = new Set<number>();
  let guard = 0;
  while (picked.size < count && guard < 2000) {
    guard++;
    const value = TREE_VALUE_MIN + Math.floor(Math.random() * (TREE_VALUE_MAX - TREE_VALUE_MIN + 1));
    if (!exclude(value)) picked.add(value);
  }
  return [...picked];
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

// ─── Canvas ───

function TreeCanvasInner({ frame, mode }: { frame: AlgoTreeFrame; mode: AlgoTreeMode }) {
  const layout = useMemo(() => layoutTree(frame.root, TREE_VIEW_WIDTH, TREE_VIEW_HEIGHT), [frame.root]);
  const path = new Set(frame.path);
  const visited = new Set(frame.visited);
  const rotating = new Set(frame.rotating);
  const r = layout.radius;
  const fontSize = Math.max(9, Math.min(15, r * 0.7));

  const stateOf = (id: string): TreeNodeState => {
    if (frame.removing === id) return 'removing';
    if (frame.found === id) return 'found';
    if (rotating.has(id)) return 'rotating';
    if (frame.current === id) return 'current';
    if (visited.has(id)) return 'visited';
    if (path.has(id)) return 'path';
    return 'idle';
  };

  if (layout.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/50">
        The tree is empty. Type a key and press Insert, or reset to the preset tree.
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${TREE_VIEW_WIDTH} ${TREE_VIEW_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full select-none"
      role="img"
      aria-label={`Tree with ${layout.nodes.length} nodes`}
    >
      <AnimatePresence initial={false}>
        {layout.edges.map((edge) => {
          const highlighted = path.has(edge.id) && path.has(edge.parentId);
          const turning = rotating.has(edge.id) && rotating.has(edge.parentId);
          return (
            <motion.line
              key={`edge-${edge.id}`}
              initial={{ opacity: 0, x1: edge.x1, y1: edge.y1, x2: edge.x2, y2: edge.y2 }}
              animate={{ opacity: 1, x1: edge.x1, y1: edge.y1, x2: edge.x2, y2: edge.y2 }}
              exit={{ opacity: 0 }}
              transition={SPRING}
              stroke={turning ? '#fb923c' : highlighted ? '#22d3ee' : 'rgba(255, 255, 255, 0.25)'}
              strokeWidth={turning || highlighted ? 3 : 2}
              strokeLinecap="round"
            />
          );
        })}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {layout.nodes.map((node) => {
          const style = NODE_STYLE[stateOf(node.id)];
          const unbalanced = Math.abs(node.balance) > 1;
          return (
            <motion.g
              key={node.id}
              initial={{ opacity: 0, scale: 0.3, x: node.x, y: node.y }}
              animate={{ opacity: 1, scale: 1, x: node.x, y: node.y }}
              exit={{ opacity: 0, scale: 0.3 }}
              transition={SPRING}
            >
              <circle
                r={r}
                style={{
                  fill: style.fill,
                  stroke: style.stroke,
                  strokeWidth: style.width,
                  transition: 'fill 200ms, stroke 200ms',
                }}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                fontWeight={600}
                fontFamily="var(--font-mono), monospace"
                fill={style.text}
              >
                {node.value}
              </text>
              {mode === 'avl' && (
                <text
                  x={r + 3}
                  y={-r + 2}
                  fontSize={Math.max(8, fontSize * 0.75)}
                  fontFamily="var(--font-mono), monospace"
                  fontWeight={unbalanced ? 700 : 400}
                  fill={unbalanced ? '#fb7185' : 'rgba(255, 255, 255, 0.55)'}
                >
                  {signed(node.balance)}
                </text>
              )}
            </motion.g>
          );
        })}
      </AnimatePresence>
    </svg>
  );
}

const TreeCanvas = memo(TreeCanvasInner);

// ─── Visualizer ───

function TreeVisualizerInner({ mode }: { mode: AlgoTreeMode }) {
  const info = TREE_MODES[mode];
  const root = useAlgoLabStore((s) => s.trees[mode]);
  const setTree = useAlgoLabStore((s) => s.setTree);
  const resetTree = useAlgoLabStore((s) => s.resetTree);
  const speedLevel = useAlgoLabStore((s) => s.speeds.tree);
  const setSpeed = useAlgoLabStore((s) => s.setSpeed);
  const recordRun = useAlgoLabStore((s) => s.recordRun);
  const recordRotations = useAlgoLabStore((s) => s.recordRotations);

  const [run, setRun] = useState<AlgoTreeRun | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const size = treeSize(root);
  const idleFrames = useMemo(
    () => [idleTreeFrame(root, `${info.name} with ${treeSize(root)} nodes. Type a key and pick an operation.`)],
    [root, info.name]
  );
  const frames = run ? run.frames : idleFrames;

  const stepsPerSecond = SPEED_LEVELS[speedLevel] ?? SPEED_LEVELS[DEFAULT_SPEED.tree];
  const player = usePlayback(frames, {
    stepsPerSecond,
    autoPlay: true,
    onComplete: () => {
      if (!run) return;
      recordRun('tree');
      if (run.rotations > 0) recordRotations(run.rotations);
    },
  });
  const frame = player.frame ?? idleFrames[0];
  const opMeta = TREE_OPERATIONS[run ? run.operation : mode === 'avl' ? 'avl-insert' : 'bst-insert'];

  const perform = (action: TreeAction, explicitKey?: number) => {
    let key = 0;
    if (action === 'insert' || action === 'delete' || action === 'search') {
      const parsed = explicitKey ?? parseKey(keyInput);
      if (parsed === null) {
        setError(`Type a whole number from ${TREE_VALUE_MIN} to ${TREE_VALUE_MAX} first.`);
        return;
      }
      if (action === 'insert' && size >= MAX_TREE_NODES && !treeContains(root, parsed)) {
        setError(`The tree is full (${MAX_TREE_NODES} nodes). Delete a key first.`);
        return;
      }
      key = parsed;
    }
    setError(null);
    const result = runTreeOperation(mode, root, action, key);
    setRun(result);
    if (result.changed) setTree(mode, result.root);
  };

  const insertRandom = () => {
    if (size >= MAX_TREE_NODES) {
      setError(`The tree is full (${MAX_TREE_NODES} nodes). Delete a key first.`);
      return;
    }
    const picks = randomUniqueKeys(1, (candidate) => treeContains(root, candidate));
    if (picks.length === 0) return;
    setKeyInput(String(picks[0]));
    perform('insert', picks[0]);
  };

  const randomTree = () => {
    const values = randomUniqueKeys(9, () => false);
    setTree(mode, buildTree(mode, values));
    setRun(null);
    setError(null);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    perform('insert');
  };

  const buttonClass =
    'flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-white/75 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40';

  const toolbar = (
    <div className="flex flex-col gap-1.5">
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px]">
        <label className="flex items-center gap-1.5 text-white/60">
          Key
          <input
            type="number"
            inputMode="numeric"
            min={TREE_VALUE_MIN}
            max={TREE_VALUE_MAX}
            value={keyInput}
            onChange={(event) => {
              setKeyInput(event.target.value);
              if (error) setError(null);
            }}
            placeholder={`${TREE_VALUE_MIN}-${TREE_VALUE_MAX}`}
            aria-label="Key"
            aria-invalid={error !== null}
            className={cn(
              'w-16 rounded-md border bg-black/40 px-2 py-1 font-mono text-[12px] text-white outline-none placeholder:text-white/35',
              error ? 'border-rose-500/60' : 'border-white/15 focus:border-cyan-400/60'
            )}
          />
        </label>
        <button
          type="submit"
          className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-emerald-100 transition-colors hover:bg-emerald-500/25"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Insert
        </button>
        <button type="button" onClick={() => perform('delete')} className={buttonClass}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Delete
        </button>
        <button type="button" onClick={() => perform('search')} className={buttonClass}>
          <Search className="h-3.5 w-3.5" aria-hidden />
          Search
        </button>
        <button type="button" onClick={insertRandom} className={buttonClass} title="Insert a random key">
          <Dices className="h-3.5 w-3.5" aria-hidden />
          Random
        </button>

        <span className="mx-1 h-4 w-px bg-white/10" aria-hidden />

        <span className="text-white/55">Traverse</span>
        {TRAVERSALS.map((traversal) => (
          <button
            key={traversal.id}
            type="button"
            onClick={() => perform(traversal.id)}
            disabled={size === 0}
            className={cn(
              buttonClass,
              run?.operation === traversal.id && 'border-sky-400/40 bg-sky-400/15 text-sky-100'
            )}
          >
            {traversal.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={randomTree} className={buttonClass} title="Build a random tree with 9 keys">
            <Shuffle className="h-3.5 w-3.5" aria-hidden />
            Random tree
          </button>
          <button
            type="button"
            onClick={() => {
              resetTree(mode);
              setRun(null);
              setError(null);
            }}
            className={buttonClass}
            title="Rebuild the starting tree"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Preset
          </button>
          <button
            type="button"
            onClick={() => {
              setTree(mode, null);
              setRun(null);
              setError(null);
            }}
            className={buttonClass}
            title="Remove every node"
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden />
            Clear
          </button>
        </div>
      </form>
      <p className={cn('min-h-[1rem] text-[11px]', error ? 'text-rose-300' : 'text-white/50')} role={error ? 'alert' : undefined}>
        {error ?? info.hint}
      </p>
    </div>
  );

  const stage = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <TreeCanvas frame={frame} mode={mode} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-2 text-[10.5px] text-white/60">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: item.color }} aria-hidden />
            {item.label}
          </span>
        ))}
        {mode === 'avl' && <span className="text-white/50">Small numbers = balance factor</span>}
      </div>
    </div>
  );

  const isTraversal = run !== null && (run.operation === 'inorder' || run.operation === 'preorder' || run.operation === 'postorder');

  const footer = (
    <>
      {isTraversal && (
        <div className="flex min-w-0 items-center gap-2 px-1 text-[11px] text-white/60">
          <span className="shrink-0">Output:</span>
          <span className="truncate font-mono text-sky-200">
            {frame.output.length > 0 ? frame.output.join(', ') : '–'}
          </span>
        </div>
      )}
      <StepMessage message={frame.message}>
        <Stat label="nodes" value={treeSize(frame.root)} />
        <Stat label="height" value={treeHeight(frame.root)} />
        {run && run.rotations > 0 && <Stat label="rotations" value={run.rotations} className="text-orange-300" />}
      </StepMessage>
      <PlaybackControls
        player={player}
        speedKind="tree"
        speedLevel={speedLevel}
        onSpeedChange={(level) => setSpeed('tree', level)}
        disabled={!run}
      />
    </>
  );

  return (
    <LabLayout
      title={info.name}
      subtitle={info.description}
      category="tree"
      badgeLabel={mode === 'avl' ? 'Tree · self-balancing' : 'Tree'}
      toolbar={toolbar}
      stage={stage}
      stageLabel="Tree canvas. Space plays or pauses; arrow keys step through the operation."
      footer={footer}
      code={<CodePanel title={opMeta.name} lines={opMeta.pseudocode} activeLine={frame.line} />}
      details={<ComplexityCard meta={opMeta} />}
      onStageKeyDown={(event) => handlePlaybackKeys(event, player)}
    />
  );
}

export const TreeVisualizer = memo(TreeVisualizerInner);
