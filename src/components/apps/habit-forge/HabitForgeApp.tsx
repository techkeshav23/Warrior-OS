// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Habit Forge App
// Daily habit tracking: streak hero, check-off cards, the 90-day
// forge map, and the daily routine checklist
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, ListChecks, Plus, Zap } from 'lucide-react';
import { Button, ConfirmDialog, EmptyState, ProgressBar, Tabs } from '@/components/ui';
import { utcDayKey } from '@/components/achievements/award';
import { currentStreak, longestStreak } from '@/components/achievements/day-streak';
import { collectStudyDays } from '@/components/achievements/study-streak';
import { AddHabitDialog } from './AddHabitDialog';
import { HabitCard } from './HabitCard';
import { HabitGrid } from './HabitGrid';
import { RoutineChecklist } from './RoutineChecklist';
import { StreakHero } from './StreakHero';
import { habitRun, lastDays, loadRoutineDone, type HabitPreset } from './habit-utils';
import { rewardHabitCompletion } from './streak';

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  completions: string[]; // UTC day keys ('YYYY-MM-DD')
}

export interface RoutineItem {
  id: string;
  text: string;
  time: string;
  category: 'morning' | 'study' | 'night';
}

function loadHabits(): Habit[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('warrior-habits') || '[]'); }
  catch { return []; }
}

function saveHabits(habits: Habit[]) {
  localStorage.setItem('warrior-habits', JSON.stringify(habits));
}

const DEFAULT_ROUTINES: RoutineItem[] = [
  { id: 'r1', text: 'Wake up early', time: '6:00', category: 'morning' },
  { id: 'r2', text: 'Exercise / Walk', time: '6:30', category: 'morning' },
  { id: 'r3', text: 'Cold shower', time: '7:00', category: 'morning' },
  { id: 'r4', text: 'Study Session 1', time: '8:00', category: 'study' },
  { id: 'r5', text: 'Revise notes', time: '10:00', category: 'study' },
  { id: 'r6', text: 'Practice problems', time: '11:00', category: 'study' },
  { id: 'r7', text: 'Study Session 2', time: '14:00', category: 'study' },
  { id: 'r8', text: 'Quiz or mock test', time: '16:00', category: 'study' },
  { id: 'r9', text: 'Light reading', time: '21:00', category: 'night' },
  { id: 'r10', text: 'Plan tomorrow', time: '22:00', category: 'night' },
];

/** How long the "+XP" toast stays visible after checking a habit. */
const REWARD_VISIBLE_MS = 3500;
/** Days in the streak hero's chain (the older half only shows in wide windows). */
const CHAIN_DAYS = 28;

type Tab = 'habits' | 'routine';

interface RewardNotice {
  habitXp: number;
  streak: number;
  streakBonus: number;
  nonce: number;
}

function HabitForgeAppInner() {
  const [habits, setHabits] = useState<Habit[]>(loadHabits);
  const [activeTab, setActiveTab] = useState<Tab>('habits');
  const [reward, setReward] = useState<RewardNotice | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Habit | null>(null);
  // Study days (habits, routines, quizzes, notes, study time) — refreshed on each check-off.
  const [studyDays, setStudyDays] = useState(() => collectStudyDays());
  const [routineDone, setRoutineDone] = useState(() => loadRoutineDone(utcDayKey()).size);

  // Hide the reward line after a moment (cleared from a timer, never synchronously).
  useEffect(() => {
    if (!reward) return;
    const id = setTimeout(() => setReward(null), REWARD_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [reward]);

  const refreshStreak = useCallback(() => {
    setStudyDays(collectStudyDays());
  }, []);

  const onRoutineProgress = useCallback(() => {
    setStudyDays(collectStudyDays());
    setRoutineDone(loadRoutineDone(utcDayKey()).size);
  }, []);

  const addHabit = useCallback((preset: HabitPreset) => {
    const habit: Habit = {
      id: `habit-${Date.now()}`,
      name: preset.name,
      icon: preset.icon,
      color: preset.color,
      completions: [],
    };
    const updated = [...habits, habit];
    setHabits(updated);
    saveHabits(updated);
  }, [habits]);

  const toggleHabitToday = useCallback((habitId: string) => {
    const today = utcDayKey();
    const target = habits.find((h) => h.id === habitId);
    if (!target) return;
    const wasDone = target.completions.includes(today);
    const updated = habits.map((h) =>
      h.id !== habitId
        ? h
        : {
            ...h,
            completions: wasDone
              ? h.completions.filter((d) => d !== today)
              : [...h.completions, today],
          }
    );
    setHabits(updated);
    saveHabits(updated);

    if (wasDone) {
      refreshStreak();
      return;
    }
    // Habit XP (once per habit per day), then the study streak: streak
    // achievements + the once-a-day streak bonus.
    const result = rewardHabitCompletion(habitId);
    setStudyDays(collectStudyDays());
    if (result.habitXp > 0 || result.streakBonus > 0) {
      setReward((prev) => ({
        habitXp: result.habitXp,
        streak: result.streak,
        streakBonus: result.streakBonus,
        nonce: (prev?.nonce ?? 0) + 1,
      }));
    }
  }, [habits, refreshStreak]);

  const removeHabit = useCallback((habitId: string) => {
    const updated = habits.filter((h) => h.id !== habitId);
    setHabits(updated);
    saveHabits(updated);
    refreshStreak();
  }, [habits, refreshStreak]);

  const today = utcDayKey();
  const streak = currentStreak(studyDays, today);
  const best = Math.max(streak, longestStreak(studyDays));

  const week = useMemo(() => lastDays(today, 7), [today]);
  const chain = useMemo(
    () => lastDays(today, CHAIN_DAYS).map((key) => ({ key, active: studyDays.has(key), isToday: key === today })),
    [today, studyDays]
  );

  const doneToday = habits.filter((h) => h.completions.includes(today)).length;
  const allForged = habits.length > 0 && doneToday === habits.length;

  return (
    <div className="@container relative flex h-full flex-col text-fg">
      {/* Tabs + action */}
      <div className="flex shrink-0 items-end gap-3 border-b border-line pl-3 pr-4">
        <Tabs
          value={activeTab}
          onChange={(id) => setActiveTab(id as Tab)}
          idPrefix="habit-forge"
          aria-label="Habit Forge sections"
          className="-mb-px"
          tabs={[
            {
              id: 'habits',
              label: 'Habits',
              icon: Flame,
              badge: habits.length > 0 ? `${doneToday}/${habits.length}` : undefined,
            },
            { id: 'routine', label: 'Routine', icon: ListChecks, badge: `${routineDone}/${DEFAULT_ROUTINES.length}` },
          ]}
        />
        <div className="ml-auto flex h-10 items-center">
          {activeTab === 'habits' && habits.length > 0 && (
            <Button size="sm" variant="secondary" leadingIcon={Plus} onClick={() => setAdding(true)}>
              New habit
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'habits' && (
          <div
            role="tabpanel"
            id="habit-forge-panel-habits"
            aria-labelledby="habit-forge-tab-habits"
            className="space-y-6 p-5"
          >
            <StreakHero streak={streak} best={best} chain={chain} />

            <div className={`grid grid-cols-1 gap-6 ${habits.length > 0 ? '@5xl:grid-cols-2 @5xl:items-start' : ''}`}>
              <section aria-labelledby="habit-forge-today" className="min-w-0 space-y-3">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <h3 id="habit-forge-today" className="text-sm font-semibold text-fg">
                      Today&apos;s habits
                    </h3>
                    <p className="mt-0.5 text-xs text-fg-subtle">
                      {habits.length === 0
                        ? 'Nothing on the anvil yet.'
                        : allForged
                          ? 'Every habit forged. Come back tomorrow to extend the chain.'
                          : 'Select a habit to forge it for today.'}
                    </p>
                  </div>
                  {habits.length > 0 && (
                    <div className="flex w-36 shrink-0 flex-col items-end gap-1.5">
                      <span className="tabular font-mono text-xs text-fg-muted">
                        <span className={allForged ? 'text-ember-400' : 'text-fg'}>{doneToday}</span> / {habits.length} forged
                      </span>
                      <ProgressBar
                        value={doneToday}
                        max={habits.length}
                        segments={habits.length}
                        tone="ember"
                        size="sm"
                        glow={allForged}
                        aria-label="Habits forged today"
                      />
                    </div>
                  )}
                </div>

                {habits.length === 0 ? (
                  <div className="rounded-card border border-dashed border-line-strong">
                    <EmptyState
                      icon={Flame}
                      tone="ember"
                      title="Forge your first habit"
                      description="Pick a quick start or name your own. Every check-off feeds your streak and earns XP."
                      actions={
                        <Button variant="ember" leadingIcon={Plus} onClick={() => setAdding(true)}>
                          New habit
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2">
                    {habits.map((habit) => (
                      <HabitCard
                        key={habit.id}
                        habit={habit}
                        done={habit.completions.includes(today)}
                        run={habitRun(habit.completions, today)}
                        week={week.map((key) => ({ key, done: habit.completions.includes(key), isToday: key === today }))}
                        onToggle={toggleHabitToday}
                        onRemove={setRemoving}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Habit Grid Visualization */}
              {habits.length > 0 && <HabitGrid habits={habits} />}
            </div>
          </div>
        )}

        {activeTab === 'routine' && (
          <div
            role="tabpanel"
            id="habit-forge-panel-routine"
            aria-labelledby="habit-forge-tab-routine"
            className="p-5"
          >
            <RoutineChecklist routines={DEFAULT_ROUTINES} onProgress={onRoutineProgress} />
          </div>
        )}
      </div>

      {/* Reward toast */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4" role="status" aria-live="polite">
        <AnimatePresence>
          {reward && (
            <motion.div
              key={reward.nonce}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="glass-popover flex items-center gap-3 rounded-full py-1.5 pl-2 pr-4 text-ui"
            >
              {reward.habitXp > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-gold/12 px-2 py-0.5 font-mono text-xs font-semibold text-gold ring-1 ring-inset ring-gold/25">
                  <Zap size={12} strokeWidth={2} aria-hidden />+{reward.habitXp} XP
                </span>
              )}
              {reward.streakBonus > 0 ? (
                <span className="flex items-center gap-1.5 text-fg">
                  <Flame size={14} strokeWidth={2} className="text-ember-400" aria-hidden />
                  {reward.streak}-day streak bonus
                  <span className="tabular font-mono text-xs font-semibold text-gold">+{reward.streakBonus} XP</span>
                </span>
              ) : (
                <span className="text-fg-muted">Habit forged</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AddHabitDialog
        open={adding}
        onClose={() => setAdding(false)}
        existingNames={habits.map((h) => h.name)}
        onAdd={addHabit}
      />
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) removeHabit(removing.id);
          setRemoving(null);
        }}
        tone="danger"
        title={removing ? `Remove “${removing.name}”?` : 'Remove habit?'}
        description={
          removing && removing.completions.length > 0
            ? `Its ${removing.completions.length} check-in${removing.completions.length === 1 ? '' : 's'} leave the forge map too. XP you earned stays.`
            : 'It leaves your board. XP you earned stays.'
        }
        confirmLabel="Remove habit"
      />
    </div>
  );
}

export const HabitForgeApp = memo(HabitForgeAppInner);
