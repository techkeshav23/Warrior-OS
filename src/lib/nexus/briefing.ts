// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Daily Briefing
// The morning briefing / evening debrief the owner gets once a day:
//   · buildLocalBriefing(kind): a data-driven template (no AI) over the
//     live stores: weather, calendar, cards, habits, spending, project,
//     and for the evening what got done + tomorrow's first task.
//   · buildJarvisBriefingPrompt(kind): the instruction sent to JARVIS
//     when the server has a model (it gathers the same data with tools).
//   · The run bookkeeping + preferences under 'warrior-os-briefing' (a
//     'warrior*' key, so owner sync mirrors it and a second device does
//     not repeat a briefing that already ran).
// Hinglish for the owner, English for guests. Never throws.
// ═══════════════════════════════════════════════════════════

import { OWNER } from '@/config/owner';
import { getVisitorMode } from '@/lib/visitor';
import { getLastKnownWeather, getLocalWeather, type WeatherData } from '@/lib/weather';
import { announceStorageWrite, STORAGE_SYNC_EVENT, type StorageSyncDetail } from '@/lib/storage-sync';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { monthKeyOfDate, resolveMonthBudget, sumExpenses, useExpenseStore } from '@/stores/useExpenseStore';
import { effectiveProgress, useProjectForgeStore } from '@/stores/useProjectForgeStore';
import { useLearningStore } from '@/stores/useLearningStore';
import { nexusDayKey, useNexusStore } from '@/stores/useNexusStore';
import { expandOccurrences, shiftDateKey, toDateKey } from '@/components/apps/calendar/calendar-utils';
import type { CalendarOccurrence } from '@/types/calendar';
import { listHabits } from './quick-actions';
import { computeHabitStreak, getLearningInsights, loadHabitsLite } from './context';

export type BriefingKind = 'morning' | 'evening';

export interface LocalBriefing {
  kind: BriefingKind;
  /** Sentence-case title ("Morning briefing", "Evening debrief", …). */
  title: string;
  /** The briefing as NEXUS markdown. */
  markdown: string;
  /** A shorter version for text-to-speech. */
  spoken: string;
}

const HOUR_MS = 3_600_000;
/** The briefing day starts at 05:00: 00:00–04:59 still belongs to the evening before. */
const DAY_START_HOUR = 5;
const EVENING_HOUR = 20;
/** An evening debrief never follows a briefing by less than this. */
const MIN_GAP_MS = HOUR_MS;
const WEATHER_TIMEOUT_MS = 3500;
const FRESH_WEATHER_MS = 3 * HOUR_MS;

// ═══════════════════════════════════════════════════════════
// Run bookkeeping + preferences (localStorage 'warrior-os-briefing')
// ═══════════════════════════════════════════════════════════

export const BRIEFING_STORAGE_KEY = 'warrior-os-briefing';
/** Settings → NEXUS "Brief me now" asks the mounted DailyBriefing for a run. */
export const BRIEFING_NOW_EVENT = 'warrior:briefing-now';

export interface BriefingState {
  morningEnabled: boolean;
  eveningEnabled: boolean;
  /** Briefing day (see briefingDayKey) the morning slot last ran. */
  lastMorning: string | null;
  /** Briefing day the evening debrief last ran. */
  lastEvening: string | null;
  /** Epoch ms of the last run of either kind. */
  lastRunAt: number | null;
}

const DEFAULT_STATE: BriefingState = Object.freeze({
  morningEnabled: true,
  eveningEnabled: true,
  lastMorning: null,
  lastEvening: null,
  lastRunAt: null,
}) as BriefingState;

function parseState(raw: string | null): BriefingState {
  if (!raw) return DEFAULT_STATE;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object') return DEFAULT_STATE;
    const o = v as Record<string, unknown>;
    const day = (x: unknown) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);
    return {
      morningEnabled: o.morningEnabled !== false,
      eveningEnabled: o.eveningEnabled !== false,
      lastMorning: day(o.lastMorning),
      lastEvening: day(o.lastEvening),
      lastRunAt: typeof o.lastRunAt === 'number' && Number.isFinite(o.lastRunAt) ? o.lastRunAt : null,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function readRaw(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(BRIEFING_STORAGE_KEY);
  } catch {
    return null;
  }
}

let cache: { raw: string | null; state: BriefingState } = { raw: null, state: DEFAULT_STATE };

/** Current bookkeeping (re-read from storage, so sync pulls are seen). Stable per stored value. */
export function readBriefingState(): BriefingState {
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, state: parseState(raw) };
  return cache.state;
}

const listeners = new Set<() => void>();

export function updateBriefingState(patch: Partial<BriefingState>): void {
  if (typeof window === 'undefined') return;
  const next = { ...readBriefingState(), ...patch };
  try {
    window.localStorage.setItem(BRIEFING_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the briefing may repeat, nothing breaks */
  }
  announceStorageWrite(BRIEFING_STORAGE_KEY);
  listeners.forEach((l) => l());
}

/** useSyncExternalStore subscribe: this tab, other tabs and owner-sync pulls. */
export function subscribeBriefingState(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === BRIEFING_STORAGE_KEY) listener();
  };
  const onSync = (e: Event) => {
    if ((e as CustomEvent<StorageSyncDetail>).detail?.key === BRIEFING_STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(STORAGE_SYNC_EVENT, onSync);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(STORAGE_SYNC_EVENT, onSync);
  };
}

export function getServerBriefingState(): BriefingState {
  return DEFAULT_STATE;
}

/** Local day a briefing belongs to (the day rolls over at 05:00). */
export function briefingDayKey(now: number): string {
  return toDateKey(new Date(now - DAY_START_HOUR * HOUR_MS));
}

/** Is it evening-debrief time (20:00–04:59 local)? */
export function isEveningTime(now: number): boolean {
  const hour = new Date(now).getHours();
  return hour >= EVENING_HOUR || hour < DAY_START_HOUR;
}

/** The kind "Brief me now" should run: evening from 17:00 until the day rolls over. */
export function briefingKindForNow(now: number): BriefingKind {
  const hour = new Date(now).getHours();
  return hour >= 17 || hour < DAY_START_HOUR ? 'evening' : 'morning';
}

/** Which briefing is due now (null: none). */
export function dueBriefing(now: number, state: BriefingState = readBriefingState()): BriefingKind | null {
  const day = briefingDayKey(now);
  if (isEveningTime(now)) {
    if (!state.eveningEnabled || state.lastEvening === day) return null;
    if (state.lastRunAt !== null && now - state.lastRunAt >= 0 && now - state.lastRunAt < MIN_GAP_MS) return null;
    return 'evening';
  }
  if (!state.morningEnabled || state.lastMorning === day) return null;
  return 'morning';
}

export function markBriefingRun(kind: BriefingKind, now: number): void {
  const day = briefingDayKey(now);
  updateBriefingState(kind === 'morning' ? { lastMorning: day, lastRunAt: now } : { lastEvening: day, lastRunAt: now });
}

/** Did the morning briefing run today? (NEXUS skips its own morning nudge then.) */
export function morningBriefingRanToday(now: number): boolean {
  return readBriefingState().lastMorning === briefingDayKey(now);
}

// ═══════════════════════════════════════════════════════════
// Titles
// ═══════════════════════════════════════════════════════════

export function briefingTitle(kind: BriefingKind, now: number): string {
  if (kind === 'evening') return 'Evening debrief';
  const hour = new Date(now).getHours();
  if (hour >= DAY_START_HOUR && hour < 12) return 'Morning briefing';
  if (hour >= 12 && hour < 17) return 'Afternoon briefing';
  return 'Evening briefing';
}

// ═══════════════════════════════════════════════════════════
// Data gathering (each piece fails soft)
// ═══════════════════════════════════════════════════════════

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

async function briefingWeather(): Promise<WeatherData | null> {
  const recent = safe(() => getLastKnownWeather(FRESH_WEATHER_MS), null);
  if (recent) return recent;
  try {
    const { data } = await getLocalWeather({ signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS) });
    return data;
  } catch {
    return safe(() => getLastKnownWeather(), null);
  }
}

function eventsOn(dateKey: string): CalendarOccurrence[] {
  return safe(() => {
    const list = expandOccurrences(useCalendarStore.getState().events, dateKey, dateKey);
    return [...list].sort((a, b) => (a.event.time ?? '').localeCompare(b.event.time ?? ''));
  }, []);
}

function formatINR(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function eventLine(occ: CalendarOccurrence): string {
  return `${occ.event.time ?? 'all-day'} ${clip(occ.event.title, 48)}`;
}

function listNames(names: string[], max: number): string {
  const shown = names.slice(0, max).map((n) => clip(n, 28));
  return names.length > max ? `${shown.join(', ')} +${names.length - max}` : shown.join(', ');
}

interface Snapshot {
  now: number;
  owner: boolean;
  weather: WeatherData | null;
  today: CalendarOccurrence[];
  tomorrow: CalendarOccurrence[];
  dueCards: number;
  dueTomorrow: number;
  focusDeck: string | null;
  reviewedToday: number;
  habits: { name: string; doneToday: boolean }[];
  streak: number;
  spending: { spent: number; budget: number } | null;
  project: { name: string; stage: string; progress: number } | null;
  focusMinutes: number;
  pomodoros: number;
}

async function collect(now: number): Promise<Snapshot> {
  const date = new Date(now);
  const todayKey = toDateKey(date);
  const tomorrowKey = safe(() => shiftDateKey(todayKey, 1), todayKey);
  const learning = safe(() => getLearningInsights(now), null);
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const endOfTomorrow = startOfDay + 2 * 24 * HOUR_MS;
  const reviews = safe(() => Object.values(useLearningStore.getState().reviews ?? {}), []);
  const pomodoro = safe(() => useNexusStore.getState().pomodoro, null);
  const pomodoroToday = pomodoro !== null && pomodoro.dayKey === nexusDayKey(now);

  const spending = safe(() => {
    const { expenses, budgets } = useExpenseStore.getState();
    const month = todayKey.slice(0, 7);
    const spent = sumExpenses(expenses.filter((e) => monthKeyOfDate(e.date) === month));
    const budget = resolveMonthBudget(budgets, month).amount;
    // Nothing spent yet: no line (a bare "₹0 of budget" is noise).
    return spent > 0 ? { spent, budget } : null;
  }, null);

  const project = safe(() => {
    const store = useProjectForgeStore.getState();
    store.ensureMigrated();
    const active = useProjectForgeStore
      .getState()
      .projects.filter((p) => p.stage !== 'shipped' && !p.onHold)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
    return active ? { name: active.name, stage: active.stage, progress: effectiveProgress(active) } : null;
  }, null);

  return {
    now,
    owner: getVisitorMode() === 'owner',
    weather: await briefingWeather(),
    today: eventsOn(todayKey),
    tomorrow: eventsOn(tomorrowKey),
    dueCards: learning?.dueCards ?? 0,
    dueTomorrow: reviews.filter((r) => r.dueAt > now && r.dueAt <= endOfTomorrow).length,
    focusDeck: learning?.focus?.name ?? null,
    reviewedToday: reviews.filter((r) => r.lastReviewedAt >= startOfDay).length,
    habits: safe(() => listHabits().map((h) => ({ name: h.name, doneToday: h.doneToday })), []),
    streak: safe(() => computeHabitStreak(loadHabitsLite(), now), 0),
    spending,
    project,
    focusMinutes: pomodoroToday ? pomodoro.focusMinutesToday : 0,
    pomodoros: pomodoroToday ? pomodoro.completedToday : 0,
  };
}

// ═══════════════════════════════════════════════════════════
// Local template
// ═══════════════════════════════════════════════════════════

function greeting(s: Snapshot, kind: BriefingKind): string {
  const hour = new Date(s.now).getHours();
  const name = s.owner ? OWNER.shortName : 'Warrior';
  if (kind === 'evening') return s.owner ? `Din khatam hone wala hai, ${name}.` : `Evening wrap-up, ${name}.`;
  const part = hour >= DAY_START_HOUR && hour < 12 ? 'morning' : hour < 17 && hour >= 12 ? 'afternoon' : 'evening';
  return `Good ${part}, ${name}.`;
}

function weatherLine(w: WeatherData | null): string | null {
  if (!w) return null;
  const condition = (w.description || w.condition || '').toLowerCase();
  const range = Number.isFinite(w.min) && Number.isFinite(w.max) && w.max > w.min ? ` (${Math.round(w.min)}–${Math.round(w.max)}°C)` : '';
  return `${w.city} ${Math.round(w.temp)}°C${condition ? `, ${condition}` : ''}${range}`;
}

function morningPriority(s: Snapshot, t: (hi: string, en: string) => string): string {
  const hour = new Date(s.now).getHours();
  const nowHm = `${String(hour).padStart(2, '0')}:${String(new Date(s.now).getMinutes()).padStart(2, '0')}`;
  const nextTimed = s.today.find((o) => o.event.time && o.event.time > nowHm);
  const pending = s.habits.filter((h) => !h.doneToday);
  if (s.dueCards > 0 && s.focusDeck) {
    const cards = t(`Pehle ${s.focusDeck} ke ${s.dueCards} due cards clear kar`, `Clear the ${s.dueCards} due cards in ${s.focusDeck} first`);
    return nextTimed
      ? t(`${cards}, ${nextTimed.event.time} ke "${clip(nextTimed.event.title, 40)}" se pehle.`, `${cards}, before "${clip(nextTimed.event.title, 40)}" at ${nextTimed.event.time}.`)
      : `${cards}.`;
  }
  if (nextTimed) {
    return t(
      `${nextTimed.event.time} pe "${clip(nextTimed.event.title, 40)}" hai; uske pehle ek 25 min ka focus block laga.`,
      `"${clip(nextTimed.event.title, 40)}" is at ${nextTimed.event.time}; fit one 25-minute focus block before it.`
    );
  }
  if (s.project) {
    return t(
      `${s.project.name} pe ek focused pomodoro: sabse chhota agla task khatam kar.`,
      `One focused pomodoro on ${s.project.name}: finish its smallest next task.`
    );
  }
  if (pending.length > 0) {
    return t(`Pehle "${clip(pending[0].name, 30)}" habit tick kar, streak safe.`, `Tick off "${clip(pending[0].name, 30)}" first to keep the streak safe.`);
  }
  return t('Aaj ek naya topic chun aur uske 5 flashcards bana.', 'Pick one new topic today and make five flashcards for it.');
}

function tomorrowTask(s: Snapshot, t: (hi: string, en: string) => string): string {
  const first = s.tomorrow.find((o) => o.event.time) ?? s.tomorrow[0];
  if (first) {
    return t(
      `${first.event.time ? `${first.event.time} pe ` : ''}"${clip(first.event.title, 40)}" hai; uski tayyari aaj raat 10 min me kar le.`,
      `tomorrow starts with "${clip(first.event.title, 40)}"${first.event.time ? ` at ${first.event.time}` : ''}; spend 10 minutes preparing tonight.`
    );
  }
  if (s.dueTomorrow + s.dueCards > 0 && s.focusDeck) {
    return t(
      `subah sabse pehle ${s.focusDeck} ke cards (${s.dueTomorrow + s.dueCards} due honge).`,
      `first thing tomorrow: ${s.focusDeck} reviews (${s.dueTomorrow + s.dueCards} will be due).`
    );
  }
  if (s.project) return t(`${s.project.name} ka agla task, subah ke pehle 25 min me.`, `the next task on ${s.project.name}, in the first 25 minutes.`);
  return t('kal ke liye ek hard topic abhi chun le, subah seedha shuru.', 'pick one hard topic for tomorrow now, so the morning starts fast.');
}

/** A briefing built only from local data (no AI). Never throws. */
export async function buildLocalBriefing(kind: BriefingKind, now: number = Date.now()): Promise<LocalBriefing> {
  const title = briefingTitle(kind, now);
  try {
    const s = await collect(now);
    const t = (hi: string, en: string) => (s.owner ? hi : en);
    const lines: string[] = [];
    const spoken: string[] = [greeting(s, kind)];
    const done = s.habits.filter((h) => h.doneToday);
    const pending = s.habits.filter((h) => !h.doneToday);
    const weekday = new Date(now).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

    const header = `**${greeting(s, kind)}** ${t(`Aaj ${weekday}.`, `It is ${weekday}.`)}`;

    const weather = weatherLine(s.weather);
    if (kind === 'morning') {
      if (weather) {
        lines.push(`- **${t('Mausam', 'Weather')}:** ${weather}`);
        spoken.push(t(`Bahar ${Math.round(s.weather!.temp)} degree hai.`, `It is ${Math.round(s.weather!.temp)} degrees outside.`));
      }
      if (s.today.length > 0) {
        lines.push(`- **${t('Calendar', 'Calendar')}:** ${s.today.slice(0, 4).map(eventLine).join(' · ')}${s.today.length > 4 ? ` +${s.today.length - 4}` : ''}`);
        spoken.push(t(`Aaj calendar me ${s.today.length} cheez${s.today.length > 1 ? 'en' : ''} hai.`, `You have ${s.today.length} event${s.today.length > 1 ? 's' : ''} today.`));
      } else {
        lines.push(`- **Calendar:** ${t('aaj kuch schedule nahi, din tera hai.', 'nothing scheduled today.')}`);
      }
      if (s.dueCards > 0) {
        lines.push(`- **${t('Cards', 'Cards')}:** ${s.dueCards} ${t('due', 'due')}${s.focusDeck ? ` · ${t('focus deck', 'focus deck')}: ${s.focusDeck}` : ''}`);
      } else if (s.focusDeck) {
        lines.push(`- **Cards:** ${t('koi due nahi', 'none due')} · ${t('next deck', 'next deck')}: ${s.focusDeck}`);
      }
      if (s.habits.length > 0) {
        lines.push(
          `- **Habits:** ${done.length}/${s.habits.length} ${t('done', 'done')}${pending.length ? ` · ${t('pending', 'pending')}: ${listNames(pending.map((h) => h.name), 3)}` : ''}${s.streak > 0 ? ` · ${t(`streak ${s.streak} din`, `${s.streak}-day streak`)}` : ''}`
        );
      }
    } else {
      const got: string[] = [];
      if (s.reviewedToday > 0) got.push(t(`${s.reviewedToday} cards review`, `${s.reviewedToday} cards reviewed`));
      if (s.habits.length > 0) got.push(`${done.length}/${s.habits.length} habits`);
      if (s.focusMinutes > 0) got.push(t(`${s.focusMinutes} min focus`, `${s.focusMinutes} focus minutes`) + (s.pomodoros > 0 ? ` (${s.pomodoros} pomodoro)` : ''));
      lines.push(`- **${t('Aaj kiya', 'Done today')}:** ${got.length ? got.join(' · ') : t('kuch log nahi hua abhi tak.', 'nothing logged yet.')}`);
      spoken.push(
        got.length
          ? t(`Aaj ${got.join(', ')} ho gaya.`, `Today: ${got.join(', ')}.`)
          : t('Aaj ka koi kaam log nahi hua.', 'Nothing was logged today.')
      );
      const left: string[] = [];
      if (pending.length) left.push(`${pending.length} habit${pending.length > 1 ? 's' : ''} (${listNames(pending.map((h) => h.name), 3)})`);
      if (s.dueCards > 0) left.push(t(`${s.dueCards} cards due`, `${s.dueCards} cards due`));
      if (left.length) {
        lines.push(`- **${t('Baaki', 'Pending')}:** ${left.join(' · ')}`);
        spoken.push(t(`Baaki: ${left.join(', ')}.`, `Still pending: ${left.join(', ')}.`));
      }
      if (s.streak > 0) lines.push(`- **Streak:** ${t(`${s.streak} din`, `${s.streak} days`)}${pending.length && done.length === 0 ? t(' — aaj ek habit tick kar, warna toot jayegi', ' — tick one habit today to keep it') : ''}`);
      if (s.tomorrow.length > 0) lines.push(`- **${t('Kal', 'Tomorrow')}:** ${s.tomorrow.slice(0, 3).map(eventLine).join(' · ')}`);
    }

    if (s.spending) {
      const pct = s.spending.budget > 0 ? Math.round((s.spending.spent / s.spending.budget) * 100) : null;
      lines.push(
        `- **${t('Kharcha', 'Spending')}:** ${formatINR(s.spending.spent)}${s.spending.budget > 0 ? ` / ${formatINR(s.spending.budget)} (${pct}%)` : ''} ${t('is mahine', 'this month')}${pct !== null && pct >= 90 ? t(' — budget ke kareeb, dhyaan se', ' — close to the budget') : ''}`
      );
    }
    if (kind === 'morning' && s.project) {
      lines.push(`- **Project:** ${s.project.name} · ${s.project.stage} · ${s.project.progress}%`);
    }

    let closing: string;
    if (kind === 'morning') {
      const priority = morningPriority(s, t);
      closing = `**${t('Aaj ki priority', 'Priority for today')}:** ${priority}`;
      spoken.push(t(`Aaj ki priority: ${priority}`, `Priority: ${priority}`));
    } else {
      const next = tomorrowTask(s, t);
      closing = `**${t('Kal ka pehla kaam', "Tomorrow's first task")}:** ${next.charAt(0).toUpperCase()}${next.slice(1)}`;
      spoken.push(t(`Kal ka pehla kaam: ${next}`, `Tomorrow: ${next}`));
    }

    return {
      kind,
      title,
      markdown: [header, lines.join('\n'), closing].filter(Boolean).join('\n\n'),
      spoken: spoken.join(' '),
    };
  } catch {
    const text =
      kind === 'evening'
        ? 'Din ka debrief abhi nahi bana paaya. NEXUS se "aaj kya kiya" pooch le.'
        : 'Briefing ka data abhi load nahi hua. NEXUS se "aaj ka plan" pooch le.';
    return { kind, title, markdown: text, spoken: text };
  }
}

// ═══════════════════════════════════════════════════════════
// JARVIS prompt
// ═══════════════════════════════════════════════════════════

/** The instruction sent to runJarvis for a briefing. */
export function buildJarvisBriefingPrompt(kind: BriefingKind, now: number = Date.now()): string {
  const title = briefingTitle(kind, now);
  const common = [
    'Reply in Hinglish (Roman script), warm but crisp, like a personal chief of staff speaking aloud.',
    'Maximum 8 short sentences, no headings, no tables, at most a few bold words. Do not invent data: only mention what the tools returned, and skip anything empty or unavailable.',
    'If your memory has dated facts (exams, deadlines, trips), add a countdown for any that are coming up soon.',
    'This is read-only: do not create, change or open anything.',
  ];
  if (kind === 'evening') {
    return [
      `[${title}] Give me my evening debrief for today.`,
      'First call get_overview, then list_habits, list_events (today and tomorrow), and list_reminders if available.',
      'Cover: what I got done today (cards reviewed, habits done, focus time, spending), what is still pending tonight, and end with exactly one concrete first task for tomorrow morning.',
      ...common,
    ].join('\n');
  }
  return [
    `[${title}] Give me my daily briefing.`,
    'First call get_overview, then get_weather, list_events for today, list_habits and list_reminders if available (call them in parallel when you can).',
    'Cover: a greeting for the time of day, the weather in one line, today\'s events, cards due and the focus deck, habits pending and the streak, this month\'s spending against the budget, and the active project.',
    'End with exactly one concrete priority for the day (what to do first, and for how long).',
    ...common,
  ].join('\n');
}
