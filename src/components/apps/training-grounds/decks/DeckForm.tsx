// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: create / edit a deck
// Name, description, icon and accent colour, with a live preview.
// ═══════════════════════════════════════════════════════════

'use client';

import { useId, useState } from 'react';
import { Check, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLearningStore } from '@/stores/useLearningStore';
import type { Deck } from '@/types/learning';
import { DialogShell } from './Dialog';
import { MasteryRing } from './MasteryRing';
import {
  BTN_GHOST,
  BTN_PRIMARY,
  DECK_COLOR_CHOICES,
  DECK_ICON_CHOICES,
  INPUT,
  LABEL,
  LIMITS,
  withAlpha,
} from './deck-ui';

interface DeckFormProps {
  /** null = create a new deck. */
  deck: Deck | null;
  onClose: () => void;
  /** Called with the deck id after saving. */
  onSaved: (deckId: string, created: boolean) => void;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function DeckForm({ deck, onClose, onSaved }: DeckFormProps) {
  const createDeck = useLearningStore((s) => s.createDeck);
  const updateDeck = useLearningStore((s) => s.updateDeck);
  const deckCount = useLearningStore((s) => s.decks.length);
  const uid = useId();

  const [name, setName] = useState(deck?.name ?? '');
  const [description, setDescription] = useState(deck?.description ?? '');
  const [icon, setIcon] = useState(deck?.icon ?? DECK_ICON_CHOICES[0]);
  const [color, setColor] = useState(deck?.color ?? DECK_COLOR_CHOICES[deckCount % DECK_COLOR_CHOICES.length]);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name the deck.');
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

  return (
    <DialogShell
      title={deck ? 'Edit deck' : 'Forge a new deck'}
      subtitle={deck ? undefined : 'A deck holds topics, and topics hold cards. You can change all of this later.'}
      icon={<Layers className="h-4 w-4 text-cyan-300" />}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <span className="mr-auto text-[10px] text-white/30">Ctrl+Enter saves</span>
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            Cancel
          </button>
          <button type="submit" className={BTN_PRIMARY}>
            {deck ? 'Save deck' : 'Create deck'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Preview */}
        <div
          className="flex items-center gap-3 rounded-xl border p-3"
          style={{
            borderColor: withAlpha(color, 0.35),
            background: `linear-gradient(135deg, ${withAlpha(color, 0.12)}, transparent 70%)`,
          }}
        >
          <MasteryRing value={0.62} color={color} size={48}>
            <span className="text-xl">{icon || DECK_ICON_CHOICES[0]}</span>
          </MasteryRing>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold" style={{ color }}>
              {name.trim() || 'Untitled deck'}
            </p>
            <p className="line-clamp-2 text-[11px] text-white/50">
              {description.trim() || 'What will this deck make you unstoppable at?'}
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor={`${uid}-name`} className={LABEL}>
            Name
          </label>
          <input
            id={`${uid}-name`}
            autoFocus
            value={name}
            maxLength={LIMITS.name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. System Design, Spanish verbs, Guitar theory"
            className={cn(INPUT, 'text-base font-semibold')}
          />
          {error && <p className="text-[11px] text-red-300">{error}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor={`${uid}-desc`} className={LABEL}>
            Description
          </label>
          <textarea
            id={`${uid}-desc`}
            value={description}
            maxLength={LIMITS.description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional: what it covers, where the material comes from."
            className={cn(INPUT, 'resize-y leading-snug')}
          />
        </div>

        <div className="space-y-1.5">
          <p className={LABEL}>Icon</p>
          <div className="grid grid-cols-8 gap-1 @md:grid-cols-12">
            {DECK_ICON_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                aria-label={`Icon ${choice}`}
                aria-pressed={icon === choice}
                onClick={() => setIcon(choice)}
                className={cn(
                  'flex h-8 items-center justify-center rounded-md border text-lg transition-colors',
                  icon === choice ? 'border-cyan-400/50 bg-cyan-400/15' : 'border-white/5 bg-white/[0.03] hover:bg-white/10'
                )}
              >
                {choice}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={`${uid}-icon`} className="text-[11px] text-white/45">
              Or any emoji:
            </label>
            <input
              id={`${uid}-icon`}
              value={icon}
              maxLength={LIMITS.icon}
              onChange={(e) => setIcon(e.target.value)}
              className={cn(INPUT, 'w-20 text-center text-base')}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className={LABEL}>Accent colour</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {DECK_COLOR_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                aria-label={`Colour ${choice}`}
                aria-pressed={color.toLowerCase() === choice}
                onClick={() => setColor(choice)}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  background: choice,
                  borderColor: color.toLowerCase() === choice ? '#fff' : 'transparent',
                  boxShadow: `0 0 10px ${withAlpha(choice, 0.45)}`,
                }}
              >
                {color.toLowerCase() === choice && <Check className="h-3.5 w-3.5 text-black/70" />}
              </button>
            ))}
            <label
              className="relative ml-1 flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-2 text-[11px] text-white/60 hover:bg-white/10"
              title="Custom colour"
            >
              <span className="h-3.5 w-3.5 rounded-full" style={{ background: color }} />
              Custom
              <input
                type="color"
                value={HEX.test(color) && color.length === 7 ? color : '#22d3ee'}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Custom colour"
              />
            </label>
          </div>
        </div>
      </div>
    </DialogShell>
  );
}
