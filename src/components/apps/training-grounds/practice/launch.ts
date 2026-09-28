// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Training Launch
// Skill Tree nodes and Quest Planner quests open a Training Grounds
// mode on a deck or topic. The shell passes a launcher down; without
// one, the start event (the NEXUS / terminal deep link) is dispatched
// to the mounted Training Grounds window instead.
// ═══════════════════════════════════════════════════════════

import { useLearningStore } from '@/stores/useLearningStore';
import type { Deck } from '@/types/learning';
import {
  TRAINING_START_EVENT,
  resolveDeckTarget,
  type DeckTarget,
  type TrainingLinkMode,
  type TrainingStartDetail,
} from '../deep-link';

/** Switches Training Grounds to `mode` with `target` preselected. */
export type TrainingLauncher = (mode: TrainingLinkMode, target: DeckTarget | null) => void;

function sameTarget(a: DeckTarget | null, b: DeckTarget): boolean {
  return a !== null && a.deckId === b.deckId && (a.topicId ?? null) === (b.topicId ?? null);
}

/**
 * Subject text the start event resolves back to `target`: the topic name when
 * it is unambiguous, else the deck name (a deck-wide focus), else none.
 */
export function subjectForTarget(target: DeckTarget, decks: readonly Deck[]): string | undefined {
  const deck = decks.find((d) => d.id === target.deckId);
  if (!deck) return undefined;
  const topic = target.topicId ? deck.topics.find((t) => t.id === target.topicId) : undefined;
  if (topic && sameTarget(resolveDeckTarget(topic.name, decks), target)) return topic.name;
  if (sameTarget(resolveDeckTarget(deck.name, decks), { deckId: deck.id, topicId: null })) return deck.name;
  return undefined;
}

/**
 * Open `mode` on `target` through the shell's launcher when there is one.
 * Otherwise dispatch the live start event (no pending copy: the sender lives
 * inside a mounted Training Grounds window, which is the listener).
 */
export function launchTraining(
  launcher: TrainingLauncher | undefined,
  mode: TrainingLinkMode,
  target: DeckTarget | null
): void {
  if (launcher) {
    launcher(mode, target);
    return;
  }
  if (typeof window === 'undefined') return;
  const subject = target ? subjectForTarget(target, useLearningStore.getState().decks) : undefined;
  const detail: TrainingStartDetail = subject ? { subject, mode } : { mode };
  window.dispatchEvent(new CustomEvent<TrainingStartDetail>(TRAINING_START_EVENT, { detail }));
}
