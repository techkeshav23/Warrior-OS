// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: create / edit a deck
// Name, description, emoji and colour, with a live preview of the
// deck card.
// ═══════════════════════════════════════════════════════════

'use client';

import { useId, useRef, useState } from 'react';
import { Check, Layers, Pipette } from 'lucide-react';
import { Button, FieldShell, Input, Kbd, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useLearningStore } from '@/stores/useLearningStore';
import type { Deck } from '@/types/learning';
import { DialogShell, SubmitButton } from './Dialog';
import { MasteryRing } from './MasteryRing';
import { DECK_COLOR_CHOICES, DECK_ICON_CHOICES, LIMITS, deckHue, deckStyle } from './deck-ui';

interface DeckFormProps {
  /** null = create a new deck. */
  deck: Deck | null;
  open?: boolean;
  onClose: () => void;
  /** Called with the deck id after saving. */
  onSaved: (deckId: string, created: boolean) => void;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function DeckForm({ deck, open = true, onClose, onSaved }: DeckFormProps) {
  const createDeck = useLearningStore((s) => s.createDeck);
  const updateDeck = useLearningStore((s) => s.updateDeck);
  const deckCount = useLearningStore((s) => s.decks.length);
  const uid = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(deck?.name ?? '');
  const [description, setDescription] = useState(deck?.description ?? '');
  const [icon, setIcon] = useState(deck?.icon ?? DECK_ICON_CHOICES[0]);
  const [color, setColor] = useState(() =>
    deck ? deckHue(deck.color) : DECK_COLOR_CHOICES[deckCount % DECK_COLOR_CHOICES.length]
  );
  const [error, setError] = useState<string | null>(null);

  const dirty = deck
    ? name !== deck.name || description !== deck.description || icon !== deck.icon || color !== deckHue(deck.color)
    : name.trim() !== '' || description.trim() !== '';

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name the deck.');
      nameRef.current?.focus();
      return;
    }
    const patch = {
      name: trimmed,
      description: description.trim(),
      icon: icon.trim() || DECK_ICON_CHOICES[0],
      color: HEX.test(color) ? color : DECK_COLOR_CHOICES[0],
    };
    if (deck) {
      updateDeck(deck.id, patch);
      onSaved(deck.id, false);
    } else {
      onSaved(createDeck({ ...patch, topics: [] }), true);
    }
  };

  const lowerColor = color.toLowerCase();
  const isPreset = DECK_COLOR_CHOICES.some((c) => c.toLowerCase() === lowerColor);

  return (
    <DialogShell
      open={open}
      title={deck ? 'Edit deck' : 'New deck'}
      subtitle={deck ? 'Rename it, or give it a new look.' : 'A deck holds topics, and topics hold cards. You can change all of this later.'}
      icon={Layers}
      size="lg"
      dirty={dirty}
      initialFocus={nameRef}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <span className="mr-auto hidden items-center gap-1.5 text-xs text-fg-subtle sm:flex">
            <Kbd keys={['Ctrl', 'Enter']} size="sm" /> saves
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton>{deck ? 'Save deck' : 'Create deck'}</SubmitButton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Preview */}
        <div
          style={deckStyle(color)}
          className="glass-panel relative isolate flex items-center gap-3.5 overflow-hidden rounded-card p-4"
          aria-hidden
        >
          <span className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(110%_100%_at_0%_0%,color-mix(in_srgb,var(--deck)_16%,transparent),transparent_60%)]" />
          <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-(--deck)/60 to-transparent" />
          <MasteryRing value={0.62} color={color} size={52}>
            <span className="text-xl leading-none">{icon || DECK_ICON_CHOICES[0]}</span>
          </MasteryRing>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{name.trim() || 'Untitled deck'}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted">
              {description.trim() || 'What will this deck make you unstoppable at?'}
            </p>
          </div>
          <span className="hud-label ml-auto shrink-0 self-start">Preview</span>
        </div>

        <Input
          ref={nameRef}
          id={`${uid}-name`}
          label="Name"
          size="lg"
          value={name}
          maxLength={LIMITS.name}
          error={error ?? undefined}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g. System Design, Spanish verbs, Guitar theory"
        />

        <Textarea
          id={`${uid}-desc`}
          label="Description"
          labelAside={`${description.length}/${LIMITS.description}`}
          value={description}
          maxLength={LIMITS.description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Optional: what it covers, where the material comes from."
        />

        <FieldShell id={`${uid}-icon`} label="Icon" hint="Pick one, or type any emoji in the box.">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-8 gap-1 @md:grid-cols-12" role="group" aria-label="Icon choices">
              {DECK_ICON_CHOICES.map((choice) => {
                const selected = icon === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    aria-label={`Icon ${choice}`}
                    aria-pressed={selected}
                    onClick={() => setIcon(choice)}
                    className={cn(
                      'focus-ring flex h-9 items-center justify-center rounded-control text-lg transition-colors duration-120 ease-out-quint',
                      selected
                        ? 'bg-accent/12 ring-1 ring-inset ring-accent/40'
                        : 'bg-surface-2 hover:bg-surface-hover active:bg-surface-active'
                    )}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor={`${uid}-icon`} className="text-xs text-fg-subtle">
                Or any emoji
              </label>
              {/* The kit field is w-full: size it with a wrapper. */}
              <div className="w-20 shrink-0">
                <Input
                  id={`${uid}-icon`}
                  size="sm"
                  value={icon}
                  maxLength={LIMITS.icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="text-center text-base"
                />
              </div>
            </div>
          </div>
        </FieldShell>

        <FieldShell id={`${uid}-custom-color`} label="Colour">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Colour choices">
            {DECK_COLOR_CHOICES.map((choice) => {
              const selected = lowerColor === choice.toLowerCase();
              return (
                <button
                  key={choice}
                  type="button"
                  aria-label={`Colour ${choice}`}
                  aria-pressed={selected}
                  onClick={() => setColor(choice)}
                  style={{ background: choice }}
                  className={cn(
                    'focus-ring flex size-7 items-center justify-center rounded-full transition-[box-shadow,transform] duration-120 ease-out-quint hover:scale-105',
                    selected
                      ? 'ring-2 ring-fg ring-offset-2 ring-offset-ink-900'
                      : 'ring-1 ring-inset ring-ink-950/30'
                  )}
                >
                  {selected && <Check size={14} strokeWidth={2.5} aria-hidden className="text-ink-950" />}
                </button>
              );
            })}
            <span aria-hidden className="mx-1 h-5 w-px bg-line-strong" />
            <label
              className={cn(
                'relative flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors duration-120 ease-out-quint has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
                isPreset
                  ? 'border-line-strong text-fg-muted hover:border-fg-faint hover:bg-surface-hover hover:text-fg'
                  : 'border-accent/40 bg-accent/12 text-accent'
              )}
              title="Custom colour"
            >
              <span className="size-3.5 rounded-full ring-1 ring-inset ring-ink-950/30" style={{ background: deckHue(color) }} />
              <Pipette size={14} strokeWidth={1.75} aria-hidden />
              Custom
              <input
                id={`${uid}-custom-color`}
                type="color"
                value={HEX.test(color) && color.length === 7 ? color : DECK_COLOR_CHOICES[0]}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Custom colour"
              />
            </label>
          </div>
        </FieldShell>
      </div>
    </DialogShell>
  );
}
