// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: your content → rooms
//   • notes    → a room per folder, per tag shared by 2+ notes, plus
//                Loose Notes for the rest (note = object)
//   • decks    → a room per Training Grounds deck (card = object)
//   • projects → the Project Forge room (project = object)
// A content type with nothing in it gets an empty starter room whose
// sign says how to fill it. Pure (no React / three.js): the scene runs
// these inside useMemo on the store's decks / reviews / projects.
// ═══════════════════════════════════════════════════════════

import type { Card, CardReview, Deck } from '@/types/learning';
import type { ForgeProject } from '@/types/project-forge';
import { cardAnswerText, computeTopicMastery } from '@/stores/useLearningStore';
import {
  normalizeName,
  type PalaceGroup,
  type PalaceItem,
  type PalaceNote,
  type RoomLevel,
} from './palaceData';

/** A tag forms a room once this many notes share it. */
const MIN_TAG_ROOM = 2;
const MAX_WORDS = 5;
const MAX_WORD_CHARS = 28;
const MAX_TITLE_CHARS = 90;

export const LOOSE_NOTES_KEY = 'notes:loose';
export const PROJECTS_KEY = 'projects';

export const PROJECT_STAGES: readonly { stage: string; label: string }[] = [
  { stage: 'ideas', label: 'Ideas' },
  { stage: 'building', label: 'Build' },
  { stage: 'testing', label: 'Test' },
  { stage: 'shipped', label: 'Ship' },
];

const STAGE_LABEL: Record<string, string> = {
  ideas: 'Idea',
  building: 'Building',
  testing: 'Testing',
  shipped: 'Shipped',
};

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function firstLine(text: string): string {
  return text.split('\n').find((l) => l.trim())?.trim() ?? text.trim();
}

function time(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function earliest(items: PalaceItem[], fallback = Number.POSITIVE_INFINITY): number {
  return items.reduce((min, i) => Math.min(min, i.createdAt), fallback);
}

function recentWords(items: PalaceItem[]): string[] {
  return [...items]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_WORDS)
    .map((i) => clip(i.title, MAX_WORD_CHARS));
}

// ─── Notes ───

function noteGroups(notes: readonly PalaceNote[]): PalaceGroup[] {
  // How many notes share each tag, so a note joins its most shared tag's room.
  const tagCount = new Map<string, number>();
  const tagLabel = new Map<string, string>();
  for (const n of notes) {
    for (const key of new Set(n.tags.map(normalizeName))) {
      if (!key) continue;
      tagCount.set(key, (tagCount.get(key) ?? 0) + 1);
    }
    for (const t of n.tags) {
      const key = normalizeName(t);
      if (key && !tagLabel.has(key)) tagLabel.set(key, t.trim().replace(/^#+/, ''));
    }
  }

  const groups = new Map<string, PalaceGroup>();
  const groupFor = (key: string, label: string, style?: PalaceGroup['style']): PalaceGroup => {
    let g = groups.get(key);
    if (!g) {
      g = { key, contentType: 'notes', label, style, items: [], words: [], since: 0 };
      groups.set(key, g);
    }
    return g;
  };

  for (const n of notes) {
    let group: PalaceGroup;
    if (n.folder) {
      group = groupFor(`folder:${normalizeName(n.folder) || n.folder.toLowerCase()}`, n.folder);
    } else {
      let bestKey: string | null = null;
      let bestCount = 0;
      for (const t of n.tags) {
        const key = normalizeName(t);
        const count = tagCount.get(key) ?? 0;
        if (key && count >= MIN_TAG_ROOM && count > bestCount) {
          bestKey = key;
          bestCount = count;
        }
      }
      group = bestKey
        ? groupFor(`tag:${bestKey}`, `#${tagLabel.get(bestKey) ?? bestKey}`)
        : groupFor(LOOSE_NOTES_KEY, 'Loose Notes', 'archive');
    }
    const createdAt = time(n.createdAt);
    group.items.push({
      id: `note:${n.id}`,
      kind: 'note',
      sourceId: n.id,
      title: n.title,
      body: n.content,
      tags: n.tags,
      context: group.label,
      shape: n.type,
      groupKey: group.key,
      createdAt,
      updatedAt: Math.max(createdAt, time(n.updatedAt)),
    });
  }

  for (const g of groups.values()) {
    g.items.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    g.words = recentWords(g.items);
    g.since = earliest(g.items);
  }
  return [...groups.values()];
}

// ─── Decks ───

function cardItem(card: Card, deck: Deck, topicId: string, topicName: string, groupKey: string): PalaceItem {
  const options = card.kind === 'mcq' || card.kind === 'multi-select' ? card.options : null;
  const correct = card.kind === 'mcq' ? [card.answer] : card.kind === 'multi-select' ? card.answers : null;
  return {
    id: `card:${card.id}`,
    kind: 'card',
    sourceId: card.id,
    title: clip(firstLine(card.prompt), MAX_TITLE_CHARS) || 'Card',
    body: card.prompt,
    tags: card.tags,
    context: `${deck.name} › ${topicName}`,
    shape: 'card',
    groupKey,
    createdAt: card.createdAt,
    updatedAt: Math.max(card.createdAt, card.updatedAt ?? 0),
    card: {
      deckId: deck.id,
      deckName: deck.name,
      topicId,
      topicName,
      cardKind: card.kind,
      answer: cardAnswerText(card),
      explanation: card.explanation?.trim() ? card.explanation : null,
      options,
      correct,
    },
  };
}

function deckGroups(decks: readonly Deck[]): PalaceGroup[] {
  const out: PalaceGroup[] = [];
  for (const deck of decks) {
    const key = `deck:${deck.id}`;
    const items: PalaceItem[] = [];
    for (const topic of deck.topics) {
      for (const card of topic.cards) items.push(cardItem(card, deck, topic.id, topic.name, key));
    }
    if (items.length === 0) continue;
    out.push({
      key,
      contentType: 'deck',
      label: deck.name,
      accent: deck.color,
      items,
      words: deck.topics
        .filter((t) => t.cards.length > 0)
        .slice(0, MAX_WORDS)
        .map((t) => clip(t.name, MAX_WORD_CHARS)),
      since: Number.isFinite(deck.createdAt) ? deck.createdAt : earliest(items),
    });
  }
  return out;
}

// ─── Projects ───

export function projectProgress(p: ForgeProject): number {
  if (p.autoProgress && p.tasks.length > 0) {
    return Math.round((p.tasks.filter((t) => t.done).length / p.tasks.length) * 100);
  }
  return Math.max(0, Math.min(100, Math.round(p.progress)));
}

function projectGroup(projects: readonly ForgeProject[]): PalaceGroup | null {
  if (projects.length === 0) return null;
  const items: PalaceItem[] = [...projects]
    .sort((a, b) => time(a.createdAt) - time(b.createdAt) || a.id.localeCompare(b.id))
    .map((p) => {
      const createdAt = time(p.createdAt);
      const stage = p.onHold ? 'On hold' : STAGE_LABEL[p.stage] ?? p.stage;
      return {
        id: `project:${p.id}`,
        kind: 'project',
        sourceId: p.id,
        title: p.name.trim() || 'Untitled project',
        body: p.description,
        tags: p.techStack,
        context: stage,
        shape: 'project',
        groupKey: PROJECTS_KEY,
        createdAt,
        updatedAt: Math.max(createdAt, time(p.updatedAt)),
        project: {
          stage: p.stage,
          progress: projectProgress(p),
          tasksDone: p.tasks.filter((t) => t.done).length,
          tasksTotal: p.tasks.length,
          techStack: p.techStack,
          onHold: p.onHold,
        },
      } satisfies PalaceItem;
    });
  return {
    key: PROJECTS_KEY,
    contentType: 'projects',
    label: 'Project Forge',
    items,
    words: recentWords(items),
    since: earliest(items),
  };
}

// ─── Starter rooms ───

const STARTERS: Record<PalaceGroup['contentType'], Omit<PalaceGroup, 'items' | 'since'>> = {
  notes: {
    key: 'starter:notes',
    contentType: 'notes',
    label: 'Notes Library',
    style: 'library',
    words: ['your first note'],
    starter: true,
    hint: 'Write a note in Notes Archive',
  },
  deck: {
    key: 'starter:deck',
    contentType: 'deck',
    label: 'Training Hall',
    style: 'laboratory',
    words: ['your first deck'],
    starter: true,
    hint: 'Build a deck in Training Grounds',
  },
  projects: {
    key: 'starter:projects',
    contentType: 'projects',
    label: 'Project Forge',
    style: 'forge',
    words: ['your first project'],
    starter: true,
    hint: 'Start a project in Project Forge',
  },
};

// ─── Public API ───

export interface PalaceContentInput {
  notes: readonly PalaceNote[];
  decks: readonly Deck[];
  projects: readonly ForgeProject[];
}

/**
 * Every room group of the palace, oldest content first; content types
 * with nothing in them contribute an empty starter room (listed last).
 */
export function buildPalaceGroups({ notes, decks, projects }: PalaceContentInput): PalaceGroup[] {
  const groups: PalaceGroup[] = [...noteGroups(notes), ...deckGroups(decks)];
  const forge = projectGroup(projects);
  if (forge) groups.push(forge);
  for (const type of ['notes', 'deck', 'projects'] as const) {
    if (!groups.some((g) => g.contentType === type)) {
      groups.push({ ...STARTERS[type], items: [], since: Number.POSITIVE_INFINITY });
    }
  }
  return groups;
}

/**
 * Data-driven decor values per group: topic mastery for decks (the lab's
 * tubes fill as topics stick), the share of projects per stage for the
 * Project Forge. Depends on reviews, so it lives apart from the layout.
 */
export function buildRoomLevels(
  decks: readonly Deck[],
  reviews: Readonly<Record<string, CardReview>>,
  projects: readonly ForgeProject[]
): Map<string, RoomLevel[]> {
  const out = new Map<string, RoomLevel[]>();
  for (const deck of decks) {
    out.set(
      `deck:${deck.id}`,
      deck.topics
        .filter((t) => t.cards.length > 0)
        .slice(0, 8)
        .map((t) => ({ label: t.name, value: computeTopicMastery(t, reviews).value }))
    );
  }
  if (projects.length > 0) {
    out.set(
      PROJECTS_KEY,
      PROJECT_STAGES.map(({ stage, label }) => ({
        label,
        value: projects.filter((p) => p.stage === stage).length / projects.length,
      }))
    );
  }
  return out;
}
