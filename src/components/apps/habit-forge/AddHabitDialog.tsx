// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Add habit dialog
// Quick picks (one click adds a preset) or a custom habit: a name and
// an emoji. Presets already on the board show as added.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useId, useState, type FormEvent } from 'react';
import { Check, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Dialog, Divider, Input } from '@/components/ui';
import { HABIT_EMOJI_CHOICES, MAX_HABIT_NAME_LENGTH, PRESET_HABITS, type HabitPreset } from './habit-utils';

interface AddHabitDialogProps {
  open: boolean;
  onClose: () => void;
  /** Names already on the board (case-insensitive duplicates are refused). */
  existingNames: readonly string[];
  onAdd: (preset: HabitPreset) => void;
}

function AddHabitDialogInner({ open, onClose, existingNames, onAdd }: AddHabitDialogProps) {
  const formId = useId();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(HABIT_EMOJI_CHOICES[0]);
  const [submitted, setSubmitted] = useState(false);

  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const trimmed = name.trim();
  const error = !trimmed
    ? 'Name the habit you want to forge.'
    : taken.has(trimmed.toLowerCase())
      ? 'That habit is already on your board.'
      : null;

  const close = () => {
    setName('');
    setIcon(HABIT_EMOJI_CHOICES[0]);
    setSubmitted(false);
    onClose();
  };

  const addPreset = (preset: HabitPreset) => {
    onAdd(preset);
    close();
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    if (error) return;
    onAdd({ name: trimmed.slice(0, MAX_HABIT_NAME_LENGTH), icon, color: 'orange' });
    close();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="New habit"
      description="Pick a quick start or forge your own. Check it off daily to feed your streak."
      icon={Flame}
      iconTone="ember"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant="ember" type="submit" form={formId} leadingIcon={Flame}>
            Forge habit
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section aria-label="Quick picks">
          <p className="hud-label mb-2">Quick picks</p>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_HABITS.map((preset) => {
              const added = taken.has(preset.name.toLowerCase());
              return (
                <button
                  key={preset.name}
                  type="button"
                  disabled={added}
                  onClick={() => addPreset(preset)}
                  className={cn(
                    'focus-ring flex h-10 min-w-0 items-center gap-2.5 rounded-control border px-2.5 text-left text-ui',
                    'transition-colors duration-120 ease-out-quint',
                    added
                      ? 'cursor-default border-line text-fg-subtle'
                      : 'border-line-strong bg-surface-2 text-fg hover:border-ember-500/40 hover:bg-ember-500/[0.06] active:bg-ember-500/10'
                  )}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {preset.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{preset.name}</span>
                  {added && (
                    <span className="flex shrink-0 items-center text-success" title="Already on your board">
                      <Check size={14} strokeWidth={2} aria-hidden />
                      <span className="sr-only">Added</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <Divider label="Or forge your own" />

        <form id={formId} onSubmit={submit} noValidate className="space-y-4">
          <Input
            label="Habit name"
            placeholder="e.g. Code for one hour"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_HABIT_NAME_LENGTH}
            autoComplete="off"
            size="lg"
            error={submitted ? error : undefined}
            hint="Small enough to do every day beats heroic."
          />
          <div>
            <p id={`${formId}-emoji`} className="mb-1.5 text-xs font-medium text-fg-muted">
              Emoji
            </p>
            <div role="radiogroup" aria-labelledby={`${formId}-emoji`} className="flex flex-wrap gap-1.5">
              {HABIT_EMOJI_CHOICES.map((choice) => {
                const active = choice === icon;
                return (
                  <button
                    key={choice}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`Emoji ${choice}`}
                    onClick={() => setIcon(choice)}
                    className={cn(
                      'focus-ring flex size-9 items-center justify-center rounded-control border text-lg leading-none',
                      'transition-[background-color,border-color] duration-120 ease-out-quint',
                      active
                        ? 'border-ember-500/60 bg-ember-500/12'
                        : 'border-line bg-surface-2 hover:border-line-strong hover:bg-surface-hover'
                    )}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

export const AddHabitDialog = memo(AddHabitDialogInner);
