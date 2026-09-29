// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: card editor
// One editor for every card kind: MCQ (options + the correct one),
// multi-select (options + every correct one), numeric (answer,
// tolerance, unit) and flashcard (front / back). Explanation,
// difficulty, tags and topic for all of them.
// ═══════════════════════════════════════════════════════════

'use client';

import { useId, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Check, CircleCheck, Plus, StickyNote, X } from 'lucide-react';
import {
  Button,
  FieldShell,
  IconButton,
  Input,
  Kbd,
  SegmentedControl,
  Select,
  Textarea,
  TONE_DOT,
  type SegmentedOption,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { deckCards, findCardLocation, normalizeCardInput, useLearningStore } from '@/stores/useLearningStore';
import type { Card, CardInput, CardKind, Deck, Difficulty } from '@/types/learning';
import { DialogShell, SubmitButton } from './Dialog';
import { CARD_KINDS, DIFFICULTIES, DIFFICULTY_META, KIND_META, LIMITS, mergeTags, plural } from './deck-ui';

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

/** The field a validation error belongs to (none = a general error, shown in the footer). */
type ErrorField = 'prompt' | 'options' | 'numeric' | 'tolerance' | 'back';

interface DraftError {
  text: string;
  field?: ErrorField;
}

/** Validate the draft into store input, or explain what is missing (and where). */
function draftToInput(d: CardDraft): { input: CardInput } | { error: DraftError } {
  const fail = (text: string, field?: ErrorField) => ({ error: { text, field } });
  const prompt = d.prompt.trim();
  if (!prompt) return fail(d.kind === 'flashcard' ? 'Write the front of the card.' : 'Write the question.', 'prompt');
  const explanation = d.explanation.trim();
  const base = { prompt, difficulty: d.difficulty, tags: d.tags, ...(explanation ? { explanation } : {}) };

  switch (d.kind) {
    case 'mcq':
    case 'multi-select': {
      const options = d.options.map((o) => o.trim());
      if (options.length < 2) return fail('Add at least two options.', 'options');
      if (options.some((o) => !o)) return fail('Fill in every option, or remove the empty ones.', 'options');
      if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
        return fail('Two options are identical.', 'options');
      }
      if (d.kind === 'mcq') {
        if (d.answer < 0 || d.answer >= options.length) return fail('Mark the correct option.', 'options');
        return { input: { ...base, kind: 'mcq', options, answer: d.answer } };
      }
      const answers = [...new Set(d.answers)].filter((i) => i >= 0 && i < options.length).sort((a, b) => a - b);
      if (answers.length === 0) return fail('Mark at least one correct option.', 'options');
      return { input: { ...base, kind: 'multi-select', options, answers } };
    }
    case 'numeric': {
      const answer = parseNumber(d.numeric);
      if (answer === null) return fail('The answer must be a number, e.g. 42, -3.5 or 1e6.', 'numeric');
      let tolerance = 0;
      if (d.tolerance.trim()) {
        const t = parseNumber(d.tolerance);
        if (t === null || t < 0) return fail('A positive number, or empty for an exact answer.', 'tolerance');
        tolerance = t;
      }
      const unit = d.unit.trim();
      return {
        input: { ...base, kind: 'numeric', answer, ...(tolerance > 0 ? { tolerance } : {}), ...(unit ? { unit } : {}) },
      };
    }
    case 'flashcard': {
      const back = d.back.trim();
      if (!back) return fail('Write the back of the card.', 'back');
      return { input: { ...base, kind: 'flashcard', back } };
    }
  }
}

const letter = (i: number) => String.fromCharCode(65 + i);

/** Label + control + hint for controls that are groups, not single inputs (so no <label for>). */
function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      {children}
      {hint && <p className="text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}

const KIND_OPTIONS: SegmentedOption<CardKind>[] = CARD_KINDS.map((kind) => ({
  value: kind,
  label: KIND_META[kind].label,
  icon: KIND_META[kind].icon,
}));

const DIFFICULTY_OPTIONS: SegmentedOption<Difficulty>[] = DIFFICULTIES.map((level) => ({
  value: level,
  label: DIFFICULTY_META[level].label,
  icon: <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[DIFFICULTY_META[level].tone])} />,
}));

interface CardEditorProps {
  deck: Deck;
  /** null = add a new card. */
  cardId: string | null;
  /** Topic preselected for a new card (null = the deck's first topic). */
  topicId: string | null;
  /** Kind a new card starts as. */
  defaultKind?: CardKind;
  open?: boolean;
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
  open = true,
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
  const [initial] = useState<CardDraft>(() => (existing ? draftFromCard(existing.card) : emptyDraft(defaultKind)));
  const [draft, setDraft] = useState<CardDraft>(initial);
  const [topicChoice, setTopicChoice] = useState<string | null>(
    () => existing?.topicId ?? (topicId && deck.topics.some((t) => t.id === topicId) ? topicId : deck.topics[0]?.id ?? null)
  );
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<DraftError | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [autoFocusOption, setAutoFocusOption] = useState<number | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const optionRefs = useRef<(HTMLInputElement | null)[]>([]);
  const numericRef = useRef<HTMLInputElement | null>(null);
  const toleranceRef = useRef<HTMLInputElement | null>(null);
  const backRef = useRef<HTMLTextAreaElement | null>(null);

  const knownTags = useMemo(() => {
    const seen = new Set<string>();
    for (const card of deckCards(deck)) for (const tag of card.tags) seen.add(tag);
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [deck]);

  // Unsaved input: a stray backdrop click must not throw the card away.
  const dirty = tagInput.trim() !== '' || JSON.stringify(draft) !== JSON.stringify(initial);

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

  /** Move focus to the field an error points at. */
  const focusField = (field: ErrorField | undefined) => {
    if (field === 'prompt') promptRef.current?.focus();
    else if (field === 'back') backRef.current?.focus();
    else if (field === 'numeric') numericRef.current?.focus();
    else if (field === 'tolerance') toleranceRef.current?.focus();
    else if (field === 'options') {
      const empty = draft.options.findIndex((o) => !o.trim());
      optionRefs.current[empty >= 0 ? empty : 0]?.focus();
    }
  };

  const save = (addAnother: boolean) => {
    const tags = tagInput.trim() ? mergeTags(draft.tags, tagInput) : draft.tags;
    const result = draftToInput({ ...draft, tags });
    if ('error' in result) {
      setError(result.error);
      focusField(result.error.field);
      return;
    }
    if (!normalizeCardInput(result.input)) {
      setError({ text: 'This card could not be saved. Check its fields.' });
      return;
    }
    onKindUsed?.(draft.kind);

    if (existing) {
      if (!updateCard(existing.card.id, result.input)) {
        setError({ text: 'This card no longer exists.' });
        return;
      }
      if (topicChoice && topicChoice !== existing.topicId) moveCard(existing.card.id, deck.id, topicChoice);
      onSaved('Card updated');
      return;
    }

    const id = addCard(deck.id, topicChoice, result.input);
    if (!id) {
      setError({ text: 'Could not add the card: its topic or deck is gone.' });
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
  const correctCount = draft.kind === 'mcq' ? (draft.answer >= 0 ? 1 : 0) : draft.answers.length;
  const fieldError = (field: ErrorField) => (error?.field === field ? error.text : undefined);
  const generalError = error && !error.field ? error.text : null;

  return (
    <DialogShell
      open={open}
      title={existing ? 'Edit card' : 'New card'}
      subtitle={`${deck.icon} ${deck.name}${topicName ? ` › ${topicName}` : ''}`}
      icon={StickyNote}
      size="xl"
      dirty={dirty}
      initialFocus={promptRef}
      onClose={onClose}
      onSubmit={() => save(false)}
      footer={
        <>
          <span
            className={cn(
              'mr-auto flex min-w-0 items-center gap-1.5 text-xs',
              generalError ? 'text-danger' : addedCount > 0 ? 'text-success' : 'text-fg-subtle'
            )}
            role={generalError ? 'alert' : undefined}
            title={generalError ?? undefined}
          >
            {generalError ? (
              <span className="line-clamp-2">{generalError}</span>
            ) : addedCount > 0 ? (
              <>
                <CircleCheck size={14} strokeWidth={2} aria-hidden className="shrink-0" />
                <span className="truncate">{plural(addedCount, 'card')} added. Keep going.</span>
              </>
            ) : (
              <span className="hidden items-center gap-1.5 sm:flex">
                <Kbd keys={['Ctrl', 'Enter']} size="sm" /> saves
              </span>
            )}
          </span>
          <Button variant="ghost" onClick={onClose}>
            {addedCount > 0 ? 'Done' : 'Cancel'}
          </Button>
          {!existing && (
            <Button variant="secondary" leadingIcon={Plus} onClick={() => save(true)}>
              Save &amp; add another
            </Button>
          )}
          <SubmitButton>{existing ? 'Save card' : 'Add card'}</SubmitButton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Kind */}
        <Group label="Card type" hint={KIND_META[draft.kind].hint}>
          <SegmentedControl<CardKind>
            aria-label="Card type"
            value={draft.kind}
            onChange={switchKind}
            options={KIND_OPTIONS}
            fullWidth
          />
        </Group>

        {/* Topic + difficulty */}
        <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
          <Select
            id={`${uid}-topic`}
            label="Topic"
            value={topicChoice ?? ''}
            onChange={(e) => setTopicChoice(e.target.value || null)}
          >
            {deck.topics.length === 0 && <option value="">General (created with this card)</option>}
            {deck.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Group label="Difficulty">
            <SegmentedControl<Difficulty>
              aria-label="Difficulty"
              value={draft.difficulty}
              onChange={(level) => patch({ difficulty: level })}
              options={DIFFICULTY_OPTIONS}
              fullWidth
            />
          </Group>
        </div>

        {/* Prompt */}
        <Textarea
          ref={promptRef}
          id={`${uid}-prompt`}
          label={draft.kind === 'flashcard' ? 'Front' : 'Question'}
          labelAside={draft.prompt.length > LIMITS.prompt * 0.8 ? `${draft.prompt.length}/${LIMITS.prompt}` : undefined}
          value={draft.prompt}
          maxLength={LIMITS.prompt}
          onChange={(e) => patch({ prompt: e.target.value })}
          error={fieldError('prompt')}
          rows={3}
          placeholder={draft.kind === 'flashcard' ? 'e.g. What is a closure?' : 'e.g. Which HTTP status code means Not Found?'}
        />

        {/* Options: MCQ + multi-select */}
        {isChoice && (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium text-fg-muted">Options</span>
              <span className="truncate text-xs text-fg-subtle">
                {draft.kind === 'mcq' ? 'Mark the correct option' : 'Tick every correct option'} · paste a list to fill
              </span>
            </div>
            <div className="flex flex-col gap-1.5" role="group" aria-label="Options">
              {draft.options.map((option, i) => {
                const correct = draft.kind === 'mcq' ? draft.answer === i : draft.answers.includes(i);
                return (
                  <div
                    key={i}
                    className={cn(
                      '-mx-1.5 flex items-center gap-2 rounded-control px-1.5 py-1 transition-colors duration-120 ease-out-quint',
                      correct && 'bg-success/[0.06]'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => markCorrect(i)}
                      aria-pressed={correct}
                      aria-label={`Option ${letter(i)} is correct`}
                      title={correct ? 'Correct' : 'Mark as correct'}
                      className={cn(
                        'focus-ring flex size-8 shrink-0 items-center justify-center border font-mono text-xs font-medium transition-colors duration-120 ease-out-quint',
                        draft.kind === 'mcq' ? 'rounded-full' : 'rounded-control',
                        correct
                          ? 'border-success/60 bg-success/15 text-success'
                          : 'border-line-strong bg-ink-950/40 text-fg-subtle hover:border-fg-faint hover:bg-surface-hover hover:text-fg'
                      )}
                    >
                      {correct ? <Check size={14} strokeWidth={2.5} aria-hidden /> : letter(i)}
                    </button>
                    <Input
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
                      wrapperClassName="flex-1"
                    />
                    <IconButton
                      icon={X}
                      onClick={() => removeOption(i)}
                      disabled={draft.options.length <= 2}
                      aria-label={`Remove option ${letter(i)}`}
                    />
                  </div>
                );
              })}
            </div>
            {fieldError('options') && (
              <p role="alert" className="text-xs text-danger">
                {fieldError('options')}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={Plus}
                onClick={addOption}
                disabled={draft.options.length >= LIMITS.options}
              >
                Add option
              </Button>
              <span className="tabular font-mono text-xs text-fg-subtle">
                {draft.options.length}/{LIMITS.options} · {correctCount} correct
              </span>
            </div>
          </div>
        )}

        {/* Numeric */}
        {draft.kind === 'numeric' && (
          <div className="grid grid-cols-3 gap-3">
            <Input
              ref={numericRef}
              id={`${uid}-answer`}
              error={fieldError('numeric')}
              label="Answer"
              inputMode="decimal"
              value={draft.numeric}
              onChange={(e) => patch({ numeric: e.target.value })}
              placeholder="42"
              className="tabular font-mono"
            />
            <Input
              ref={toleranceRef}
              id={`${uid}-tolerance`}
              error={fieldError('tolerance')}
              label="± Tolerance"
              inputMode="decimal"
              value={draft.tolerance}
              onChange={(e) => patch({ tolerance: e.target.value })}
              placeholder="exact"
              className="tabular font-mono"
            />
            <Input
              id={`${uid}-unit`}
              label="Unit"
              value={draft.unit}
              maxLength={LIMITS.unit}
              onChange={(e) => patch({ unit: e.target.value })}
              placeholder="ms, kg, %"
            />
          </div>
        )}

        {/* Flashcard back */}
        {draft.kind === 'flashcard' && (
          <Textarea
            ref={backRef}
            id={`${uid}-back`}
            error={fieldError('back')}
            label="Back"
            value={draft.back}
            maxLength={LIMITS.text}
            onChange={(e) => patch({ back: e.target.value })}
            rows={3}
            placeholder="The answer you want to recall."
          />
        )}

        {/* Explanation */}
        <Textarea
          id={`${uid}-explanation`}
          label="Explanation"
          labelAside="Optional"
          value={draft.explanation}
          maxLength={LIMITS.text}
          onChange={(e) => patch({ explanation: e.target.value })}
          rows={2}
          placeholder={
            draft.kind === 'flashcard' ? 'Extra context shown under the back.' : 'Why the answer is right; shown after answering.'
          }
        />

        {/* Tags */}
        <FieldShell
          id={`${uid}-tag`}
          label="Tags"
          labelAside={draft.tags.length > 0 ? `${draft.tags.length}/${LIMITS.tags}` : undefined}
          hint="Enter or comma adds a tag, Backspace removes the last one."
        >
          <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-control border border-line-strong bg-ink-950/55 px-1.5 py-1 transition-[border-color,box-shadow] duration-120 ease-out-quint focus-within:border-accent/70 focus-within:ring-3 focus-within:ring-accent/15 hover:border-fg-faint">
            {draft.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex h-6 max-w-full items-center gap-0.5 rounded-full border border-line-strong bg-surface-2 pl-2.5 pr-0.5 text-xs font-medium text-fg-muted"
              >
                <span className="truncate">#{tag}</span>
                <button
                  type="button"
                  onClick={() => patch({ tags: draft.tags.filter((t) => t !== tag) })}
                  aria-label={`Remove tag ${tag}`}
                  className="focus-ring flex size-5 shrink-0 items-center justify-center rounded-full text-fg-subtle transition-colors duration-120 ease-out-quint hover:bg-surface-active hover:text-fg"
                >
                  <X size={12} strokeWidth={2} aria-hidden />
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
              className="h-6 min-w-24 flex-1 bg-transparent px-1 text-ui text-fg outline-none placeholder:text-fg-subtle [&::-webkit-calendar-picker-indicator]:opacity-0"
            />
            <datalist id={`${uid}-tags`}>
              {knownTags
                .filter((t) => !draft.tags.includes(t))
                .map((t) => (
                  <option key={t} value={t} />
                ))}
            </datalist>
          </div>
        </FieldShell>
      </div>
    </DialogShell>
  );
}
