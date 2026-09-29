// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Tree Visualizer
// Animated BST insert / delete / search, AVL mode that shows every
// rotation, and inorder / preorder / postorder traversals
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dices, Eraser, GitFork, Info, Plus, RotateCcw, Search, Shuffle, Trash2, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, EmptyState, IconButton, Input, ToolbarSeparator } from '@/components/ui';
import { EASE_OUT_QUINT } from '@/styles/tokens';
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
import { LabLayout, StageLegend, Stat, StepMessage, type LegendItem } from './LabLayout';
import { ACCENT, LAB, nodeStyle, tint, type NodeStyle } from './labTheme';

type TreeNodeState = 'idle' | 'path' | 'visited' | 'current' | 'rotating' | 'found' | 'removing';

const NODE_STYLE: Record<TreeNodeState, NodeStyle> = {
  idle: nodeStyle(tint(LAB.plasma[400], 45)),
  path: nodeStyle(ACCENT, { width: 2.5 }),
  visited: nodeStyle(LAB.visited, { hot: true, width: 2.5 }),
  current: nodeStyle(LAB.compare, { hot: true, width: 3 }),
  rotating: nodeStyle(LAB.rotate, { hot: true, width: 3 }),
  found: nodeStyle(LAB.sorted, { hot: true, width: 3 }),
  removing: nodeStyle(LAB.swap, { hot: true, width: 3 }),
};

const LEGEND: LegendItem[] = [
  { label: 'Comparing', color: LAB.compare, ring: true },
  { label: 'Search path', color: ACCENT, ring: true },
  { label: 'Found / inserted', color: LAB.sorted, ring: true },
  { label: 'Rotating', color: LAB.rotate, ring: true },
  { label: 'Deleting', color: LAB.swap, ring: true },
  { label: 'Visited', color: LAB.visited, ring: true },
];

/** Tree moves glide (no spring overshoot): 260ms panel easing. */
const GLIDE = { duration: 0.26, ease: EASE_OUT_QUINT } as const;

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
      <EmptyState
        className="h-full"
        size="sm"
        icon={GitFork}
        title="The tree is empty"
        description="Type a key and press Insert, or rebuild the preset tree."
      />
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
              transition={GLIDE}
              style={{
                stroke: turning ? LAB.rotate : highlighted ? ACCENT : LAB.edge,
                transition: 'stroke 180ms',
              }}
              strokeWidth={turning || highlighted ? 2.5 : 1.5}
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
              transition={GLIDE}
            >
              <circle
                r={r}
                style={{
                  fill: style.fill,
                  stroke: style.stroke,
                  strokeWidth: style.width,
                  transition: 'fill 180ms, stroke 180ms',
                }}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                fontWeight={600}
                fontFamily="var(--font-mono), monospace"
                style={{ fill: style.text }}
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
                  fill={unbalanced ? LAB.swap : LAB.fg.subtle}
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

  const clearRun = () => {
    setRun(null);
    setError(null);
  };

  const toolbar = (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <div className="w-24 shrink-0">
        <Input
          size="sm"
          type="number"
          inputMode="numeric"
          min={TREE_VALUE_MIN}
          max={TREE_VALUE_MAX}
          value={keyInput}
          onChange={(event) => {
            setKeyInput(event.target.value);
            if (error) setError(null);
          }}
          placeholder={`${TREE_VALUE_MIN}–${TREE_VALUE_MAX}`}
          aria-label="Key"
          aria-invalid={error !== null}
          className="tabular font-mono"
        />
      </div>
      <Button type="submit" size="sm" variant="primary" leadingIcon={Plus}>
        Insert
      </Button>
      <Button size="sm" variant="secondary" leadingIcon={Trash2} onClick={() => perform('delete')}>
        Delete
      </Button>
      <Button size="sm" variant="secondary" leadingIcon={Search} onClick={() => perform('search')}>
        Search
      </Button>
      <IconButton icon={Dices} size="sm" aria-label="Insert a random key" tooltip onClick={insertRandom} />

      <ToolbarSeparator />

      <span className="hud-label shrink-0">Traverse</span>
      <div className="flex items-center gap-0.5" role="group" aria-label="Traversals">
        {TRAVERSALS.map((traversal) => {
          const active = run?.operation === traversal.id;
          return (
            <Button
              key={traversal.id}
              size="sm"
              variant={active ? 'secondary' : 'ghost'}
              aria-pressed={active}
              onClick={() => perform(traversal.id)}
              disabled={size === 0}
            >
              {traversal.label}
            </Button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-0.5 pl-2">
        <IconButton icon={Shuffle} size="sm" aria-label="Random tree (9 keys)" tooltip onClick={randomTree} />
        <IconButton
          icon={RotateCcw}
          size="sm"
          aria-label="Rebuild the preset tree"
          tooltip
          onClick={() => {
            resetTree(mode);
            clearRun();
          }}
        />
        <IconButton
          icon={Eraser}
          size="sm"
          variant="ghost-danger"
          aria-label="Remove every node"
          tooltip
          onClick={() => {
            setTree(mode, null);
            clearRun();
          }}
        />
      </div>
    </form>
  );

  const subbar = (
    <div
      className={cn('flex h-9 shrink-0 items-center gap-2 border-b border-line px-4 text-xs', error ? 'text-danger' : 'text-fg-subtle')}
      role={error ? 'alert' : undefined}
    >
      {error ? (
        <TriangleAlert size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
      ) : (
        <Info size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
      )}
      <span className="truncate" title={error ?? info.hint}>
        {error ?? info.hint}
      </span>
    </div>
  );

  const isTraversal = run !== null && (run.operation === 'inorder' || run.operation === 'preorder' || run.operation === 'postorder');

  const stage = (
    <>
      {isTraversal && (
        <div className="flex min-w-0 shrink-0 items-center gap-3 border-b border-line px-3 py-2">
          <span className="hud-label shrink-0">Output</span>
          <span className="tabular min-w-0 truncate font-mono text-xs text-info">
            {frame.output.length > 0 ? frame.output.join(', ') : '–'}
          </span>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <TreeCanvas frame={frame} mode={mode} />
      </div>
      <StageLegend items={LEGEND} note={mode === 'avl' ? 'Small numbers = balance factor' : undefined} />
    </>
  );

  return (
    <LabLayout
      view={mode}
      title={info.name}
      category="tree"
      badgeLabel={mode === 'avl' ? 'Tree · self-balancing' : 'Tree'}
      toolbar={toolbar}
      subbar={subbar}
      stage={stage}
      stageLabel="Tree canvas. Space plays or pauses; arrow keys step through the operation."
      narration={
        <StepMessage message={frame.message}>
          <Stat label="nodes" value={treeSize(frame.root)} />
          <Stat label="height" value={treeHeight(frame.root)} />
          {run && run.rotations > 0 && <Stat label="rotations" value={run.rotations} tone="ember" />}
        </StepMessage>
      }
      aside={
        <>
          <ComplexityCard meta={opMeta} />
          <CodePanel title={opMeta.name} lines={opMeta.pseudocode} activeLine={frame.line} meta={opMeta} className="flex-1" />
        </>
      }
      playback={
        <PlaybackControls
          player={player}
          speedKind="tree"
          speedLevel={speedLevel}
          onSpeedChange={(level) => setSpeed('tree', level)}
          disabled={!run}
          emphasis="soft"
        />
      }
      onStageKeyDown={(event) => handlePlaybackKeys(event, player)}
    />
  );
}

export const TreeVisualizer = memo(TreeVisualizerInner);
