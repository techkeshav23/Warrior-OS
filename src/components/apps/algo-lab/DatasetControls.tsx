// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Dataset Controls
// Array-size slider, dataset shapes, reshuffle and a validated
// custom-input editor. Shared by the sorting visualizer and
// Compare Mode (both sort the same dataset).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState, type FormEvent } from 'react';
import { Check, Keyboard, Shuffle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DATASET_SHAPES, parseCustomArray } from '@/lib/algorithms/dataset';
import {
  ARRAY_SIZE_MAX,
  ARRAY_SIZE_MIN,
  CUSTOM_MAX_LENGTH,
  CUSTOM_MIN_LENGTH,
  CUSTOM_VALUE_MAX,
  CUSTOM_VALUE_MIN,
} from '@/lib/algorithms/constants';
import { useAlgoLabStore } from './useAlgoLabStore';

function DatasetControlsInner() {
  const dataset = useAlgoLabStore((s) => s.dataset);
  const source = useAlgoLabStore((s) => s.datasetSource);
  const arraySize = useAlgoLabStore((s) => s.arraySize);
  const regenerate = useAlgoLabStore((s) => s.regenerateDataset);
  const setCustomDataset = useAlgoLabStore((s) => s.setCustomDataset);

  // The slider edits a draft and only regenerates when released, so dragging
  // does not rebuild thousands of frames on every pixel.
  const [sizeDraft, setSizeDraft] = useState(arraySize);
  const [syncedSize, setSyncedSize] = useState(arraySize);
  if (syncedSize !== arraySize) {
    setSyncedSize(arraySize);
    setSizeDraft(arraySize);
  }

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const commitSize = () => {
    if (sizeDraft !== arraySize) regenerate(undefined, sizeDraft);
  };

  const toggleEditor = () => {
    if (editorOpen) {
      setEditorOpen(false);
      return;
    }
    setDraft(dataset.join(', '));
    setError(null);
    setEditorOpen(true);
  };

  const applyCustom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseCustomArray(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setCustomDataset(parsed.values);
    setError(null);
    setEditorOpen(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex items-center gap-2 text-[11px] text-white/60">
          <span className="whitespace-nowrap">Array size</span>
          <input
            type="range"
            min={ARRAY_SIZE_MIN}
            max={ARRAY_SIZE_MAX}
            step={1}
            value={sizeDraft}
            onChange={(event) => setSizeDraft(Number(event.target.value))}
            onPointerUp={commitSize}
            onKeyUp={commitSize}
            onBlur={commitSize}
            aria-label="Array size"
            className="w-24 accent-cyan-400"
          />
          <span className="w-12 font-mono tabular-nums text-white/80">n = {sizeDraft === arraySize ? dataset.length : sizeDraft}</span>
        </label>

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Dataset shape">
          {DATASET_SHAPES.map((shape) => (
            <button
              key={shape.id}
              type="button"
              title={shape.hint}
              aria-pressed={source === shape.id}
              onClick={() => regenerate(shape.id, sizeDraft)}
              className={cn(
                'rounded-md border px-2 py-1 text-[11px] transition-colors',
                source === shape.id
                  ? 'border-cyan-500/40 bg-cyan-500/20 text-cyan-200'
                  : 'border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'
              )}
            >
              {shape.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => regenerate(undefined, sizeDraft)}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            title="Generate a new dataset of the same shape"
          >
            <Shuffle className="h-3.5 w-3.5" aria-hidden />
            New data
          </button>
          <button
            type="button"
            onClick={toggleEditor}
            aria-expanded={editorOpen}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors',
              editorOpen || source === 'custom'
                ? 'border-cyan-500/40 bg-cyan-500/20 text-cyan-200'
                : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white'
            )}
            title="Type your own values"
          >
            <Keyboard className="h-3.5 w-3.5" aria-hidden />
            Custom
          </button>
        </div>
      </div>

      {editorOpen && (
        <form onSubmit={applyCustom} className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. 42, 7, 19, 3, 25"
              aria-label="Custom values"
              aria-invalid={error !== null}
              spellCheck={false}
              autoFocus
              className={cn(
                'min-w-0 flex-1 rounded-md border bg-black/40 px-2.5 py-1.5 font-mono text-[12px] text-white outline-none placeholder:text-white/35',
                error ? 'border-rose-500/60 focus:border-rose-400' : 'border-white/15 focus:border-cyan-400/60'
              )}
            />
            <button
              type="submit"
              className="flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/20 px-2.5 py-1.5 text-[11px] text-cyan-100 hover:bg-cyan-500/30"
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Apply
            </button>
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              aria-label="Cancel custom input"
              className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className={cn('text-[11px]', error ? 'text-rose-300' : 'text-white/50')} role={error ? 'alert' : undefined}>
            {error ??
              `${CUSTOM_MIN_LENGTH}–${CUSTOM_MAX_LENGTH} whole numbers from ${CUSTOM_VALUE_MIN} to ${CUSTOM_VALUE_MAX}, separated by commas or spaces.`}
          </p>
        </form>
      )}
    </div>
  );
}

export const DatasetControls = memo(DatasetControlsInner);
