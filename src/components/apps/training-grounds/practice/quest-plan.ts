// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Quest Plan
// Turns a Quest Planner plan into today's quests and a day-by-day
// schedule. Never-seen cards are spread evenly over the days left
// (the target day is kept for review and a boss fight when there is
// room); reviews come from each card's schedule plus an estimate of
// the reviews the planned new cards will bring. Quest progress is
// read from today's attempts, so studying anywhere counts.
// ═══════════════════════════════════════════════════════════

import { computeMastery, deckCards, isQuizCard } from '@/stores/useLearningStore';
import type { CardAttempt, CardReview, Deck, Mastery, Topic } from '@/types/learning';
import type { DeckTarget, TrainingLinkMode } from '../deep-link';
import type { QuestPlan } from './quest-plan-store';
import { DAY_MS, daysBetween, parseDayKey, utcDayStart } from './schedule';

/** Longest stretch of the schedule that is computed and shown. */
export const PLAN_DAYS_SHOWN = 60;
/** Quiz answers the daily topic quest asks for. */
const QUIZ_QUEST_ANSWERS = 5;
/** Boss fights (mock tests) on the target day. */
const MAX_BOSS_QUESTS = 3;
/** Days after learning a card when its first reviews land if you answer Good (1d, then 3d, then ~8d). */
const FOLLOW_UP_OFFSETS = [1, 4, 12] as const;

export type QuestKind = 'boss' | 'review' | 'learn' | 'quiz';

export interface Quest {
  /** Stable within a day: `${kind}:${deckId}`, or `quiz:${topicId}`. */
  id: string;
  kind: QuestKind;
  title: string;
  detail: string;
  deckId: string;
  deckName: string;
  deckIcon: string;
  deckColor: string;
  target: number;
  progress: number;
  /** Reached through today's study activity. */
  achieved: boolean;
  /** Where "Start" takes you. */
  mode: TrainingLinkMode;
  launchTarget: DeckTarget;
}

export interface PlanDay {
  /** 00:00 UTC. */
  dayStart: number;
  /** 0 = today. */
  offset: number;
  /** New cards to learn. */
  learn: number;
  /** Reviews expected (scheduled + estimated). */
  review: number;
  /** Part of `review` is an estimate. */
  estimated: boolean;
  isTarget: boolean;
}

export type PlanStatus = 'active' | 'ended' | 'empty';

export interface PlanView {
  status: PlanStatus;
  /** Plan decks that still exist. */
  decks: Deck[];
  /** Whole days from today to the target (0 = today, < 0 = passed). */
  daysLeft: number;
  /** 00:00 UTC of the target day. */
  targetStart: number;
  mastery: Mastery;
  /** Never-answered cards in the plan decks. */
  unseen: number;
  quests: Quest[];
  /** Today → target (at most PLAN_DAYS_SHOWN days). */
  days: PlanDay[];
}

/**
 * Days left for learning new cards, counting from `offset` (0 = today). With
 * 3+ days to go, the target day itself is kept free for review.
 */
export function learningDaysFrom(offset: number, daysLeft: number): number {
  if (daysLeft < 0) return 0;
  const lastLearningDay = daysLeft >= 3 ? daysLeft - 1 : daysLeft;
  return Math.max(0, lastLearningDay - offset + 1);
}

interface DeckLoad {
  deck: Deck;
  unseenNow: number;
  learnedToday: number;
  /** Answers today that were reviews (a new card's first answer is learning, not review). */
  reviewsDone: number;
  dueNow: number;
  laterToday: number;
  /** Reviews already scheduled per day offset (index 0 unused). */
  scheduled: number[];
  learnTarget: number;
}

function questBase(deck: Deck): Pick<Quest, 'deckId' | 'deckName' | 'deckIcon' | 'deckColor'> {
  return { deckId: deck.id, deckName: deck.name, deckIcon: deck.icon, deckColor: deck.color };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function buildPlanView(
  plan: QuestPlan,
  allDecks: readonly Deck[],
  reviews: Readonly<Record<string, CardReview>>,
  attempts: readonly CardAttempt[],
  now: number
): PlanView {
  const todayStart = utcDayStart(now);
  const tomorrowStart = todayStart + DAY_MS;
  const targetStart = parseDayKey(plan.targetDate) ?? todayStart;
  const daysLeft = daysBetween(todayStart, targetStart);
  const wanted = new Set(plan.deckIds);
  const decks = allDecks.filter((d) => wanted.has(d.id));
  const cards = decks.flatMap((d) => deckCards(d));
  const mastery = computeMastery(cards, reviews);
  const unseen = cards.reduce((n, c) => n + (reviews[c.id] ? 0 : 1), 0);
  const base = { decks, daysLeft, targetStart, mastery, unseen };
  if (decks.length === 0) return { ...base, status: 'empty', quests: [], days: [] };
  if (daysLeft < 0) return { ...base, status: 'ended', quests: [], days: [] };

  // ─── Today's activity (from the attempt log) ───
  const answersToday = new Map<string, number>();
  const answeredBefore = new Set<string>();
  const quizzedToday = new Set<string>();
  const mockDecksToday = new Set<string>();
  for (const attempt of attempts) {
    if (attempt.timestamp < todayStart) {
      answeredBefore.add(attempt.cardId);
    } else if (attempt.timestamp < tomorrowStart) {
      answersToday.set(attempt.cardId, (answersToday.get(attempt.cardId) ?? 0) + 1);
      if (attempt.source === 'quiz' || attempt.source === 'mock') quizzedToday.add(attempt.cardId);
      if (attempt.source === 'mock') mockDecksToday.add(attempt.deckId);
    }
  }
  // First seen today: every result the card holds is from today (the log is capped, the review is not).
  const isNewToday = (cardId: string, answers: number): boolean =>
    (reviews[cardId]?.recent.length ?? 0) <= answers && !answeredBefore.has(cardId);

  const shown = Math.min(daysLeft, PLAN_DAYS_SHOWN - 1) + 1;
  const firstLearningDays = learningDaysFrom(0, daysLeft);

  // ─── Per-deck load ───
  const loads: DeckLoad[] = decks.map((deck) => {
    const load: DeckLoad = {
      deck,
      unseenNow: 0,
      learnedToday: 0,
      reviewsDone: 0,
      dueNow: 0,
      laterToday: 0,
      scheduled: new Array<number>(shown).fill(0),
      learnTarget: 0,
    };
    for (const card of deckCards(deck)) {
      const answers = answersToday.get(card.id) ?? 0;
      if (answers > 0) {
        if (isNewToday(card.id, answers)) {
          load.learnedToday += 1;
          load.reviewsDone += answers - 1;
        } else {
          load.reviewsDone += answers;
        }
      }
      const review = reviews[card.id];
      if (!review) load.unseenNow += 1;
      else if (review.dueAt <= now) load.dueNow += 1;
      else if (review.dueAt < tomorrowStart) load.laterToday += 1;
      else {
        const offset = Math.floor((review.dueAt - todayStart) / DAY_MS);
        if (offset < shown) load.scheduled[offset] += 1;
      }
    }
    const unseenAtDayStart = load.unseenNow + load.learnedToday;
    load.learnTarget = firstLearningDays > 0 ? Math.ceil(unseenAtDayStart / firstLearningDays) : 0;
    return load;
  });

  // ─── Today's quests ───
  const quests: Quest[] = [];

  if (daysLeft === 0) {
    for (const deck of decks.filter((d) => deckCards(d).some(isQuizCard)).slice(0, MAX_BOSS_QUESTS)) {
      const done = mockDecksToday.has(deck.id);
      quests.push({
        ...questBase(deck),
        id: `boss:${deck.id}`,
        kind: 'boss',
        title: 'Boss fight: mock test',
        detail: 'Target day. Prove it under the clock',
        target: 1,
        progress: done ? 1 : 0,
        achieved: done,
        mode: 'mock',
        launchTarget: { deckId: deck.id, topicId: null },
      });
    }
  }

  for (const load of loads) {
    const remaining = load.dueNow + load.laterToday;
    const total = load.reviewsDone + remaining;
    if (total === 0) continue;
    quests.push({
      ...questBase(load.deck),
      id: `review:${load.deck.id}`,
      kind: 'review',
      title: "Clear today's reviews",
      detail:
        remaining === 0
          ? 'Queue cleared'
          : `${load.dueNow} due now${load.laterToday > 0 ? ` · ${load.laterToday} more later today` : ''}`,
      target: total,
      progress: load.reviewsDone,
      achieved: remaining === 0,
      mode: 'flashcards',
      launchTarget: { deckId: load.deck.id, topicId: null },
    });
  }

  for (const load of loads) {
    if (load.learnTarget === 0) continue;
    quests.push({
      ...questBase(load.deck),
      id: `learn:${load.deck.id}`,
      kind: 'learn',
      title: `Learn ${plural(load.learnTarget, 'new card')}`,
      detail: `${load.unseenNow} unseen left`,
      target: load.learnTarget,
      progress: load.learnedToday,
      achieved: load.learnedToday >= load.learnTarget,
      mode: 'flashcards',
      launchTarget: { deckId: load.deck.id, topicId: null },
    });
  }

  // One quiz a day, rotating through the plan's topics that have quiz cards.
  if (daysLeft > 0) {
    const eligible: { deck: Deck; topic: Topic; quizCards: string[] }[] = [];
    for (const deck of decks) {
      for (const topic of deck.topics) {
        const quizCards = topic.cards.filter(isQuizCard).map((c) => c.id);
        if (quizCards.length > 0) eligible.push({ deck, topic, quizCards });
      }
    }
    if (eligible.length > 0) {
      const startMs = parseDayKey(plan.startDate) ?? todayStart;
      const dayIndex = Math.max(0, daysBetween(startMs, todayStart));
      const pick = eligible[dayIndex % eligible.length];
      const target = Math.min(QUIZ_QUEST_ANSWERS, pick.quizCards.length);
      const progress = pick.quizCards.filter((id) => quizzedToday.has(id)).length;
      quests.push({
        ...questBase(pick.deck),
        id: `quiz:${pick.topic.id}`,
        kind: 'quiz',
        title: `Quiz: ${pick.topic.name}`,
        detail: `Answer ${plural(target, 'question')}`,
        target,
        progress,
        achieved: progress >= target,
        mode: 'quiz',
        launchTarget: { deckId: pick.deck.id, topicId: pick.topic.id },
      });
    }
  }

  // ─── Schedule ───
  const learnByDay = new Array<number>(shown).fill(0);
  const reviewByDay = new Array<number>(shown).fill(0);
  const estimateByDay = new Array<number>(shown).fill(0);
  for (const load of loads) {
    learnByDay[0] += load.learnTarget;
    reviewByDay[0] += load.reviewsDone + load.dueNow + load.laterToday;
    // New cards still to learn: today's rest, then the remainder spread over the learning days left.
    const planned = new Array<number>(shown).fill(0);
    const todayRest = Math.max(0, load.learnTarget - load.learnedToday);
    planned[0] = todayRest;
    let remaining = Math.max(0, load.unseenNow - todayRest);
    for (let offset = 1; offset < shown; offset++) {
      reviewByDay[offset] += load.scheduled[offset];
      const learningDays = learningDaysFrom(offset, daysLeft);
      const n = learningDays > 0 ? Math.ceil(remaining / learningDays) : 0;
      planned[offset] = n;
      learnByDay[offset] += n;
      remaining -= n;
    }
    // Cards learned on the plan come back for review (already-learned ones are in `scheduled`).
    for (let day = 0; day < shown; day++) {
      if (planned[day] === 0) continue;
      for (const gap of FOLLOW_UP_OFFSETS) if (day + gap < shown) estimateByDay[day + gap] += planned[day];
    }
  }

  const days: PlanDay[] = learnByDay.map((learn, offset) => ({
    dayStart: todayStart + offset * DAY_MS,
    offset,
    learn,
    review: reviewByDay[offset] + estimateByDay[offset],
    estimated: estimateByDay[offset] > 0,
    isTarget: offset === daysLeft,
  }));

  return { ...base, status: 'active', quests, days };
}
