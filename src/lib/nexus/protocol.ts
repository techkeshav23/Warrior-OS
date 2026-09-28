// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS AI Protocol
// Shared limits, Gemini response schema and sanitizers used by
// both the /api/ai route (server) and the NEXUS client.
// Pure module: no env access, no browser APIs.
// ═══════════════════════════════════════════════════════════

import type { NexusWireAction, NexusWireActionType } from '@/types/nexus';

/** Free AI Studio model used by the NEXUS route. */
export const NEXUS_GEMINI_MODEL = 'gemini-2.5-flash';

export const NEXUS_LIMITS = {
  /** Max characters of the user message (route rejects longer with 400). */
  messageChars: 2000,
  /** Only the most recent N history turns are forwarded upstream. */
  historyTurns: 12,
  /** Each forwarded history turn is clipped to this many characters. */
  historyTurnChars: 4000,
  /** Max JSON length of the OS context object (route rejects longer with 400). */
  contextChars: 4000,
  /** Max raw request body size in characters (route rejects larger with 400). */
  bodyChars: 64_000,
  /** Max characters of a reply we hand back to the client. */
  replyChars: 8000,
  /** Max suggested action buttons per reply. */
  actions: 3,
} as const;

export const NEXUS_WIRE_ACTION_TYPES: readonly NexusWireActionType[] = [
  'open_app',
  'close_app',
  'focus_app',
  'search_notes',
  'start_quiz',
  'start_mock_test',
  'open_flashcards',
  'study_mode',
  'chill_mode',
  'change_wallpaper',
  'start_pomodoro',
  'stop_pomodoro',
  'switch_workspace',
  'show_stats',
  'show_decks',
  'take_break',
  'ask',
];

// Compile-time guard: every NexusWireActionType must be listed above.
type _MissingWireTypes = Exclude<NexusWireActionType, (typeof NEXUS_WIRE_ACTION_TYPES)[number]>;
const _wireTypesComplete: [_MissingWireTypes] extends [never] ? true : never = true;
void _wireTypesComplete;

export function isWireActionType(value: string): value is NexusWireActionType {
  return (NEXUS_WIRE_ACTION_TYPES as readonly string[]).includes(value);
}

/** OpenAPI-subset schema for one action object (Gemini `responseSchema`). */
const ACTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    type: { type: 'STRING', enum: [...NEXUS_WIRE_ACTION_TYPES] },
    target: { type: 'STRING' },
    label: { type: 'STRING' },
  },
  required: ['type'],
  propertyOrdering: ['type', 'target', 'label'],
} as const;

/**
 * Structured-output schema Gemini must follow:
 *   { reply: string, command: Action | null, actions: Action[] }
 */
export const NEXUS_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    command: { ...ACTION_SCHEMA, nullable: true },
    actions: { type: 'ARRAY', items: ACTION_SCHEMA, maxItems: NEXUS_LIMITS.actions },
  },
  required: ['reply'],
  propertyOrdering: ['reply', 'command', 'actions'],
} as const;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Validate one raw action object; returns null when it is unusable. */
export function sanitizeWireAction(raw: unknown): NexusWireAction | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const type = typeof record.type === 'string' ? record.type.trim() : '';
  if (!isWireActionType(type)) return null;
  const action: NexusWireAction = { type };
  if (typeof record.target === 'string') {
    const target = record.target.replace(/\s+/g, ' ').trim();
    if (target) action.target = clip(target, 160);
  }
  if (typeof record.label === 'string') {
    const label = record.label.replace(/\s+/g, ' ').trim();
    if (label) action.label = clip(label, 40);
  }
  return action;
}

/** Validate a raw action list, dropping junk and capping the count. */
export function sanitizeWireActions(raw: unknown, max: number = NEXUS_LIMITS.actions): NexusWireAction[] {
  if (!Array.isArray(raw)) return [];
  const out: NexusWireAction[] = [];
  for (const item of raw) {
    const action = sanitizeWireAction(item);
    if (action) out.push(action);
    if (out.length >= max) break;
  }
  return out;
}
