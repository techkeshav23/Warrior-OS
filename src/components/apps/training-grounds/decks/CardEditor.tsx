// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: card editor
// One editor for every card kind: MCQ (options + the correct one),
// multi-select (options + every correct one), numeric (answer,
// tolerance, unit) and flashcard (front / back). Explanation,
// difficulty, tags and topic for all of them.
// ═══════════════════════════════════════════════════════════

'use client';

import { useId, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Check, CircleDot, Hash, ListChecks, Plus, StickyNote, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deckCards, findCardLocation, normalizeCardInput, useLearningStore } from '@/stores/useLearningStore';
import type { Card, CardInput, CardKind, Deck, Difficulty } from '@/types/learning';
import { DialogShell } from './Dialog';
import {
  BTN_GHOST,
  BTN_PRIMARY,
  CARD_KINDS,
  DIFFICULTIES,
  DIFFICULTY_META,
  ICON_BTN,
  INPUT,
  KIND_META,
  LABEL,
  LIMITS,
  mergeTags,
  plural,
} from './deck-ui';

const KIND_ICONS: Readonly<Record<CardKind, LucideIcon>> = {
  mcq: CircleDot,
  'multi-select': ListChecks,
  numeric: Hash,
  flashcard: StickyNote,
};

const KIND_HINTS: Readonly<Record<CardKind, string>> = {
  mcq: 'One correct option. Auto-graded in quizzes and mock tests.',
  'multi-select': 'Every correct option (and only those) must be picked.',
  numeric: 'A typed number, optionally within a tolerance.',
  flashcard: 'Front and back. You grade your own recall in reviews.',
};

/** Everything the form edits; the kind decides which fields are saved. */
interface CardDraft {
  kind: CardKind;
  prompt: string;
  explanation: string;
  difficulty: Difficulty;
  tags: string[];
  options: string[];
  /** MCQ: index of the correct option, -1 while none is marked. */
  answer: number;
  /** Multi-select: indexes of the correct options. */
  answers: number[];
  numeric: string;
  tolerance: string;
  unit: string;
  back: string;
}

function emptyDraft(kind: CardKind, difficulty: Difficulty = 'medium', tags: string[] = []): CardDraft {
  return {
    kind,
    prompt: '',
    explanation: '',
    difficulty,
    tags,
    options: ['', '', '', ''],
    answer: -1,
    answers: [],
    numeric: '',
    tolerance: '',
    unit: '',
    back: '',
  };
}

function draftFromCard(card: Card): CardDraft {
  const draft = emptyDraft(card.kind, card.difficulty, [...card.tags]);
  draft.prompt = card.prompt;
  draft.explanation = card.explanation ?? '';
  switch (card.kind) {
    case 'mcq':
      draft.options = [...card.options];
      draft.answer = card.answer;
      draft.answers = [card.answer];
      break;
    case 'multi-select':
      draft.options = [...card.options];
      draft.answers = [...card.answers];
      draft.answer = card.answers[0] ?? -1;
      break;
    case 'numeric':
      draft.numeric = String(card.answer);
      draft.tolerance = card.tolerance ? String(card.tolerance) : '';
      draft.unit = card.unit ?? '';
      break;
    case 'flashcard':
      draft.back = card.back;
      break;
  }
  return draft;
}

function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Validate the draft into store input, or explain what is missing. */
function draftToInput(d: CardDraft): { input: CardInput } | { error: string } {
  const prompt = d.prompt.trim();
  if (!prompt) return { error: d.kind === 'flashcard' ? 'Write the front of the card.' : 'Write the question.' };
  const explanation = d.explanation.trim();
  const base = { prompt, difficulty: d.difficulty, tags: d.tags, ...(explanation ? { explanation } : {}) };

  switch (d.kind) {
    case 'mcq':
    case 'multi-select': {
      const options = d.options.map((o) => o.trim());
      if (options.length < 2) return { error: 'Add at least two options.' };
      if (options.some((o) => !o)) return { error: 'Fill in every option, or remove the empty ones.' };
      if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
        return { error: 'Two options are identical.' };
      }
      if (d.kind === 'mcq') {
        if (d.answer < 0 || d.answer >= options.length) return { error: 'Mark the correct option.' };
        return { input: { ...base, kind: 'mcq', options, answer: d.answer } };
      }
      const answers = [...new Set(d.answers)].filter((i) => i >= 0 && i < options.length).sort((a, b) => a - b);
      if (answers.length === 0) return { error: 'Mark at least one correct option.' };
      return { input: { ...base, kind: 'multi-select', options, answers } };
    }
    case 'numeric': {
      const answer = parseNumber(d.numeric);
      if (answer === null) return { error: 'The answer must be a number, e.g. 42, -3.5 or 1e6.' };
      let tolerance = 0;
      if (d.tolerance.trim()) {
        const t = parseNumber(d.tolerance);
        if (t === null || t < 0) return { error: 'Tolerance must be a positive number, or empty for an exact answer.' };
        tolerance = t;
      }
      const unit = d.unit.trim();
      return {
        input: { ...base, kind: 'numeric', answer, ...(tolerance > 0 ? { tolerance } : {}), ...(unit ? { unit } : {}) },
      };
    }
    case 'flashcard': {
      const back = d.back.trim();
      if (!back) return { error: 'Write the back of the card.' };
      return { input: { ...base, kind: 'flashcard', back } };
    }
  }
}

const letter = (i: number) => String.fromCharCode(65 + i);

interface CardEditorProps {
  deck: Deck;
  /** null = add a new card. */
  cardId: string | null;
  /** Topic preselected for a new card (null = the deck's first topic). */
  topicId: string | null;
  /** Kind a new card starts as. */
  defaultKind?: CardKind;
  onClose: () => void;
  /** Called after a save that closes the editor. */
  onSaved: (message: string) => void;
  /** Remembers the kind last used, so the next new card starts with it. */
  onKindUsed?: (kind: CardKind) => void;
}

export function CardEditor({
  deck,
  cardId,
  topicId,
  defaultKind = 'flashcard',
  onClose,
  onSaved,
  onKindUsed,
}: CardEditorProps) {
  const addCard = useLearningStore((s) => s.addCard);
  const updateCard = useLearningStore((s) => s.updateCard);
  const moveCard = useLearningStore((s) => s.moveCard);
  const uid = useId();

  // The card being edited, captured once: the form owns the draft from here on.
  const [existing] = useState(() => (cardId ? findCardLocation([deck], cardId) ?? null : null));
  const [draft, setDraft] = useState<CardDraft>(() =>
    existing ? draftFromCard(existing.card) : emptyDraft(defaultKind)
  );
  const [topicChoice, setTopicChoice] = useState<string | null>(
    () => existing?.topicId ?? (topicId && deck.topics.some((t) => t.id === topicId) ? topicId : deck.topics[0]?.id ?? null)
  );
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [autoFocusOption, setAutoFocusOption] = useState<number | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const optionRefs = useRef<(HTMLInputElement | null)[]>([]);

  const knownTags = useMemo(() => {
    const seen = new Set<string>();
    for (const card of deckCards(deck)) for (const tag of card.tags) seen.add(tag);
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [deck]);

  const patch = (next: Partial<CardDraft>) => {
    setDraft((d) => ({ ...d, ...next }));
    if (error) setError(null);
  };

  const switchKind = (kind: CardKind) => {
    setDraft((d) => {
      const next = { ...d, kind };
      // Carry the correct answer across MCQ ↔ multi-select.
      if (kind === 'mcq' && d.answer < 0 && d.answers.length > 0) next.answer = d.answers[0];
      if (kind === 'multi-select' && d.answers.length === 0 && d.answer >= 0) next.answers = [d.answer];
      return next;
    });
    setAutoFocusOption(null);
    if (error) setError(null);
  };

  // ─── Options ───

  const setOption = (i: number, value: string) =>
    patch({ options: draft.options.map((o, j) => (j === i ? value : o)) });

  const markCorrect = (i: number) => {
    if (draft.kind === 'mcq') patch({ answer: i, answers: [i] });
    else {
      const answers = draft.answers.includes(i) ? draft.answers.filter((a) => a !== i) : [...draft.answers, i];
      patch({ answers: answers.sort((a, b) => a - b), answer: answers[0] ?? -1 });
    }
  };

  const addOption = () => {
    if (draft.options.length >= LIMITS.options) return;
    setAutoFocusOption(draft.options.length);
    patch({ options: [...draft.options, ''] });
  };

  const removeOption = (i: number) => {
    if (draft.options.length <= 2) return;
    const shift = (a: number) => (a > i ? a - 1 : a);
    patch({
      options: draft.options.filter((_, j) => j !== i),
      answer: draft.answer === i ? -1 : shift(draft.answer),
      answers: draft.answers.filter((a) => a !== i).map(shift),
    });
  };

  const onOptionKeyDown = (event: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (event.key !== 'Enter' || event.ctrlKey || event.metaKey) return;
    event.preventDefault(); // Enter moves on instead of submitting
    if (i < draft.options.length - 1) optionRefs.current[i + 1]?.focus();
    else addOption();
  };

  /** Pasting several lines into an option fills the options from there on. */
  const onOptionPaste = (event: ClipboardEvent<HTMLInputElement>, i: number) => {
    const lines = event.clipboardData
      .getData('text')
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*(?:[-*•]|[A-Ja-j][.)]|\d{1,2}[.)])\s+/, '').trim())
      .filter(Boolean);
    if (lines.length < 2) return;
    event.preventDefault();
    const options = [...draft.options.slice(0, i), ...lines].slice(0, LIMITS.options);
    // Options from `i` on are new text: their correct marks no longer apply.
    patch({
      options: options.length >= 2 ? options : [...options, ''],
      answer: draft.answer >= i ? -1 : draft.answer,
      answers: draft.answers.filter((a) => a < i),
    });
  };

  // ─── Tags ───

  const commitTagInput = () => {
    if (!tagInput.trim()) return;
    patch({ tags: mergeTags(draft.tags, tagInput) });
    setTagInput('');
  };

  const onTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'Enter' && !event.ctrlKey && !event.metaKey) || event.key === ',') {
      event.preventDefault();
      commitTagInput();
    } else if (event.key === 'Backspace' && tagInput === '' && draft.tags.length > 0) {
      patch({ tags: draft.tags.slice(0, -1) });
    }
  };

  // ─── Save ───

  const save = (addAnother: boolean) => {
    const tags = tagInput.trim() ? mergeTags(draft.tags, tagInput) : draft.tags;
    const result = draftToInput({ ...draft, tags });
    if ('error' in result) {
      setError(result.error);
      return;
    }
    if (!normalizeCardInput(result.input)) {
      setError('This card could not be saved. Check its fields.');
      return;
    }
    onKindUsed?.(draft.kind);

    if (existing) {
      if (!updateCard(existing.card.id, result.input)) {
        setError('This card no longer exists.');
        return;
      }
      if (topicChoice && topicChoice !== existing.topicId) moveCard(existing.card.id, deck.id, topicChoice);
      onSaved('Card updated');
      return;
    }

    const id = addCard(deck.id, topicChoice, result.input);
    if (!id) {
      setError('Could not add the card: its topic or deck is gone.');
      return;
    }
    if (!addAnother) {
      onSaved(addedCount > 0 ? `${plural(addedCount + 1, 'card')} added` : 'Card added');
      return;
    }
    // Keep kind, difficulty, tags and topic for fast entry (a first card may have created "General").
    if (topicChoice === null) setTopicChoice(findCardLocation(useLearningStore.getState().decks, id)?.topicId ?? null);
    setDraft(emptyDraft(draft.kind, draft.difficulty, tags));
    setTagInput('');
    setAddedCount((n) => n + 1);
    setAutoFocusOption(null);
    setError(null);
    promptRef.current?.focus();
  };

  const isChoice = draft.kind === 'mcq' || draft.kind === 'multi-select';
  const topicName = deck.topics.find((t) => t.id === topicChoice)?.name;

  return (
    <DialogShell
      title={existing ? 'Edit card' : 'New card'}
      subtitle={`${deck.icon} ${deck.name}${topicName ? ` › ${topicName}` : ''}`}
      icon={<StickyNote className="h-4 w-4 text-cyan-300" />}
      size="lg"
      onClose={onClose}
      onSubmit={() => save(false)}
      footer={
        <>
          <span className={cn('mr-auto text-[11px]', error ? 'text-red-300' : 'text-white/35')} role={error ? 'alert' : undefined}>
            {error ??
              (addedCount > 0 ? `✓ ${plural(addedCount, 'card')} added. Keep going.` : 'Ctrl+Enter saves')}
          </span>
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            {addedCount > 0 ? 'Done' : 'Cancel'}
          </button>
          {!existing && (
            <button type="button" onClick={() => save(true)} className={BTN_GHOST}>
              <Plus className="h-3.5 w-3.5" />
              Save &amp; add another
            </button>
          )}
          <button type="submit" className={BTN_PRIMARY}>
            {existing ? 'Save card' : 'Add card'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Kind */}
        <div className="space-y-1.5">
          <p className={LABEL}>Card type</p>
          <div className="grid grid-cols-2 gap-1.5 @lg:grid-cols-4">
            {CARD_KINDS.map((kind) => {
              const Icon = KIND_ICONS[kind];
              const active = draft.kind === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={active}
                  onClick={() => switchKind(kind)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors',
                    active ? KIND_META[kind].badge : 'border-white/10 text-white/55 hover:bg-white/5'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {KIND_META[kind].label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-white/35">{KIND_HINTS[draft.kind]}</p>
        </div>

        {/* Topic + difficulty */}
        <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor={`${uid}-topic`} className={LABEL}>
              Topic
            </label>
            <select
              id={`${uid}-topic`}
              value={topicChoice ?? ''}
              onChange={(e) => setTopicChoice(e.target.value || null)}
              className={cn(INPUT, 'bg-[#101521]')}
            >
              {deck.topics.length === 0 && <option value="">General (created with this card)</option>}
              {deck.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <p className={LABEL}>Difficulty</p>
            <div className="grid grid-cols-3 gap-1.5">
              {DIFFICULTIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={draft.difficulty === level}
                  onClick={() => patch({ difficulty: level })}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors',
                    draft.difficulty === level
                      ? DIFFICULTY_META[level].active
                      : 'border-white/10 text-white/55 hover:bg-white/5'
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', DIFFICULTY_META[level].dot)} />
                  {DIFFICULTY_META[level].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Prompt */}
        <div className="space-y-1">
          <label htmlFor={`${uid}-prompt`} className={LABEL}>
            {draft.kind === 'flashcard' ? 'Front' : 'Question'}
          </label>
          <textarea
            id={`${uid}-prompt`}
            ref={promptRef}
            autoFocus
            value={draft.prompt}
            maxLength={LIMITS.prompt}
            onChange={(e) => patch({ prompt: e.target.value })}
            rows={3}
            placeholder={
              draft.kind === 'flashcard' ? 'e.g. What is a closure?' : 'e.g. Which HTTP status code means Not Found?'
            }
            className={cn(INPUT, 'resize-y leading-snug')}
          />
        </div>

        {/* Options: MCQ + multi-select */}
        {isChoice && (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className={LABEL}>Options</p>
              <p className="text-[10px] text-white/35">
                {draft.kind === 'mcq' ? 'Mark the correct option' : 'Tick every correct option'} · paste a list to fill
              </p>
            </div>
            {draft.options.map((option, i) => {
              const correct = draft.kind === 'mcq' ? draft.answer === i : draft.answers.includes(i);
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => markCorrect(i)}
                    aria-pressed={correct}
                    aria-label={`Option ${letter(i)} is correct`}
                    title={correct ? 'Correct' : 'Mark as correct'}
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center border text-[11px] font-bold transition-colors',
                      draft.kind === 'mcq' ? 'rounded-full' : 'rounded-md',
                      correct
                        ? 'border-green-400/60 bg-green-500/20 text-green-200'
                        : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/70'
                    )}
                  >
                    {correct ? <Check className="h-3.5 w-3.5" /> : letter(i)}
                  </button>
                  <input
                    ref={(el) => {
                      optionRefs.current[i] = el;
                    }}
                    autoFocus={autoFocusOption === i}
                    value={option}
                    maxLength={LIMITS.option}
                    onChange={(e) => setOption(i, e.target.value)}
                    onKeyDown={(e) => onOptionKeyDown(e, i)}
                    onPaste={(e) => onOptionPaste(e, i)}
                    placeholder={`Option ${letter(i)}`}
                    aria-label={`Option ${letter(i)}`}
                    className={cn(INPUT, correct && 'border-green-400/40')}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    disabled={draft.options.length <= 2}
                    aria-label={`Remove option ${letter(i)}`}
                    className={ICON_BTN}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addOption}
              disabled={draft.options.length >= LIMITS.options}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-cyan-300/80 hover:bg-cyan-400/10 hover:text-cyan-200 disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
              Add option
              <span className="text-white/30">
                ({draft.options.length}/{LIMITS.options})
              </span>
            </button>
          </div>
        )}

        {/* Numeric */}
        {draft.kind === 'numeric' && (
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label htmlFor={`${uid}-answer`} className={LABEL}>
                Answer
              </label>
              <input
                id={`${uid}-answer`}
                inputMode="decimal"
                value={draft.numeric}
                onChange={(e) => patch({ numeric: e.target.value })}
                placeholder="42"
                className={cn(INPUT, 'font-mono')}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${uid}-tolerance`} className={LABEL}>
                ± Tolerance
              </label>
              <input
                id={`${uid}-tolerance`}
                inputMode="decimal"
                value={draft.tolerance}
                onChange={(e) => patch({ tolerance: e.target.value })}
                placeholder="exact"
                className={cn(INPUT, 'font-mono')}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${uid}-unit`} className={LABEL}>
                Unit
              </label>
              <input
                id={`${uid}-unit`}
                value={draft.unit}
                maxLength={LIMITS.unit}
                onChange={(e) => patch({ unit: e.target.value })}
                placeholder="ms, kg, %"
                className={INPUT}
              />
            </div>
          </div>
        )}

        {/* Flashcard back */}
        {draft.kind === 'flashcard' && (
          <div className="space-y-1">
            <label htmlFor={`${uid}-back`} className={LABEL}>
              Back
            </label>
            <textarea
              id={`${uid}-back`}
              value={draft.back}
              maxLength={LIMITS.text}
              onChange={(e) => patch({ back: e.target.value })}
              rows={3}
              placeholder="The answer you want to recall."
              className={cn(INPUT, 'resize-y leading-snug')}
            />
          </div>
        )}

        {/* Explanation */}
        <div className="space-y-1">
          <label htmlFor={`${uid}-explanation`} className={LABEL}>
            Explanation <span className="normal-case tracking-normal text-white/30">(optional)</span>
          </label>
          <textarea
            id={`${uid}-explanation`}
            value={draft.explanation}
            maxLength={LIMITS.text}
            onChange={(e) => patch({ explanation: e.target.value })}
            rows={2}
            placeholder={
              draft.kind === 'flashcard' ? 'Extra context shown under the back.' : 'Why the answer is right; shown after answering.'
            }
            className={cn(INPUT, 'resize-y leading-snug')}
          />
        </div>

        {/* Tags */}
        <div className="space-y-1">
          <label htmlFor={`${uid}-tag`} className={LABEL}>
            Tags
          </label>
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] p-1.5 focus-within:border-cyan-400/50">
            {draft.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded border border-cyan-400/25 bg-cyan-400/10 py-0.5 pl-1.5 pr-0.5 text-[11px] text-cyan-200"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => patch({ tags: draft.tags.filter((t) => t !== tag) })}
                  aria-label={`Remove tag ${tag}`}
                  className="rounded p-0.5 text-cyan-200/60 hover:bg-white/10 hover:text-red-300"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            <input
              id={`${uid}-tag`}
              list={`${uid}-tags`}
              value={tagInput}
              maxLength={LIMITS.tag * 2}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={onTagKeyDown}
              onBlur={commitTagInput}
              placeholder={draft.tags.length === 0 ? 'closures, async…' : 'Add tag'}
              className="min-w-[90px] flex-1 bg-transparent px-1 py-0.5 text-xs text-white/90 outline-none placeholder:text-white/30"
            />
            <datalist id={`${uid}-tags`}>
              {knownTags
                .filter((t) => !draft.tags.includes(t))
                .map((t) => (
                  <option key={t} value={t} />
                ))}
            </datalist>
          </div>
          <p className="text-[10px] text-white/30">Enter or comma adds a tag, Backspace removes the last one.</p>
        </div>
      </div>
    </DialogShell>
  );
}
