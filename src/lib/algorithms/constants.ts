// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Constants
// Playback speeds, input limits and canvas geometry
// ═══════════════════════════════════════════════════════════

/** Playback speeds in frames per second, indexed by the speed slider. */
export const SPEED_LEVELS: readonly number[] = [0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512];

/** Compare-mode race clock in operations per second. */
export const RACE_SPEED_LEVELS: readonly number[] = [10, 25, 50, 100, 200, 400, 800, 1600];

export const DEFAULT_SPEED = {
  sort: 6, // 32 steps/s
  graph: 2, // 2 steps/s
  tree: 2, // 2 steps/s
  race: 4, // 200 ops/s
} as const;

export type SpeedKind = keyof typeof DEFAULT_SPEED;

export function speedLevelsFor(kind: SpeedKind): readonly number[] {
  return kind === 'race' ? RACE_SPEED_LEVELS : SPEED_LEVELS;
}

export function formatSpeed(value: number, kind: SpeedKind): string {
  const unit = kind === 'race' ? 'ops/s' : 'steps/s';
  return `${value < 1 ? value.toFixed(1) : value} ${unit}`;
}

// ─── Sorting input ───
export const ARRAY_SIZE_MIN = 5;
export const ARRAY_SIZE_MAX = 100;
export const ARRAY_SIZE_DEFAULT = 30;
export const CUSTOM_MIN_LENGTH = 2;
export const CUSTOM_MAX_LENGTH = 100;
export const CUSTOM_VALUE_MIN = 1;
export const CUSTOM_VALUE_MAX = 999;
/** Show numeric labels on bars when there are at most this many. */
export const BAR_LABEL_LIMIT = 32;

// ─── Graph canvas (SVG viewBox units) ───
export const GRAPH_VIEW_WIDTH = 1000;
export const GRAPH_VIEW_HEIGHT = 600;
export const GRAPH_NODE_RADIUS = 22;
export const MAX_GRAPH_NODES = 26;
export const EDGE_WEIGHT_MIN = 1;
export const EDGE_WEIGHT_MAX = 99;

// ─── Tree canvas (SVG viewBox units) ───
export const TREE_VIEW_WIDTH = 1000;
export const TREE_VIEW_HEIGHT = 560;
export const MAX_TREE_NODES = 31;
export const TREE_VALUE_MIN = 1;
export const TREE_VALUE_MAX = 99;
