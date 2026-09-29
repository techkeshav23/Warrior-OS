// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Dataset Controls (FORGE HUD)
// Array-size slider, dataset shapes (segmented), reshuffle and a
// validated custom-input editor that opens as a sub-bar under the
// toolbar. Shared by the sorting visualizer and Compare Mode (both
// sort the same dataset). useDatasetControls() returns the toolbar
// content and the sub-bar so LabLayout can place each one.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Check, Keyboard, Shuffle, X } from 'lucide-react';
import { Button, IconButton, Input, SegmentedControl, Slider, ToolbarSeparator } from '@/components/ui';
import { DATASET_SHAPES, parseCustomArray } from '@/lib/algorithms/dataset';
import {
  ARRAY_SIZE_MAX,
  ARRAY_SIZE_MIN,
  CUSTOM_MAX_LENGTH,
  CUSTOM_MIN_LENGTH,
  CUSTOM_VALUE_MAX,
  CUSTOM_VALUE_MIN,
} from '@/lib/algorithms/constants';
import { useAlgoLabStore, type DatasetSource } from './useAlgoLabStore';

const SHAPE_OPTIONS: { value: DatasetSource; label: string; icon?: typeof Keyboard }[] = [
  ...DATASET_SHAPES.map((shape) => ({ value: shape.id as DatasetSource, label: shape.label })),
  { value: 'custom', label: 'Custom', icon: Keyboard },
];

export function useDatasetControls(): { toolbar: ReactNode; subbar: ReactNode } {
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

  const openEditor = () => {
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

  const onShape = (value: DatasetSource) => {
    if (value === 'custom') {
      if (editorOpen) setEditorOpen(false);
      else openEditor();
      return;
    }
    setEditorOpen(false);
    regenerate(value, sizeDraft);
  };

  const shapeHint = DATASET_SHAPES.find((shape) => shape.id === source)?.hint ?? 'Your own values';

  const toolbar = (
    <>
      <div className="flex shrink-0 items-center gap-2.5" title="Array size (applies when you let go)">
        <span className="hud-label">Size</span>
        <div className="w-24">
          <Slider
            value={sizeDraft}
            onValueChange={setSizeDraft}
            min={ARRAY_SIZE_MIN}
            max={ARRAY_SIZE_MAX}
            step={1}
            onPointerUp={commitSize}
            onKeyUp={commitSize}
            onBlur={commitSize}
            aria-label="Array size"
          />
        </div>
        <span className="tabular w-12 font-mono text-xs text-fg">
          <span className="text-fg-subtle">n=</span>
          {sizeDraft === arraySize ? dataset.length : sizeDraft}
        </span>
      </div>

      <ToolbarSeparator />

      <div title={shapeHint}>
        <SegmentedControl<DatasetSource>
          size="sm"
          aria-label="Dataset shape"
          value={editorOpen ? 'custom' : source}
          onChange={onShape}
          options={SHAPE_OPTIONS}
        />
      </div>

      <IconButton
        icon={Shuffle}
        size="sm"
        aria-label="New dataset of the same shape"
        tooltip
        onClick={() => regenerate(undefined, sizeDraft)}
      />
    </>
  );

  const subbar = editorOpen ? (
    <form
      onSubmit={applyCustom}
      className="flex shrink-0 flex-wrap items-start gap-x-2 gap-y-1 border-b border-line bg-ink-950/30 px-3 py-2 animate-fade-in"
    >
      <div className="min-w-[14rem] flex-1">
        <Input
          size="sm"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g. 42, 7, 19, 3, 25"
          aria-label="Custom values"
          leadingIcon={Keyboard}
          error={error ?? undefined}
          hint={
            error
              ? undefined
              : `${CUSTOM_MIN_LENGTH}–${CUSTOM_MAX_LENGTH} whole numbers from ${CUSTOM_VALUE_MIN} to ${CUSTOM_VALUE_MAX}, separated by commas or spaces.`
          }
          spellCheck={false}
          autoFocus
          className="font-mono"
        />
      </div>
      <Button type="submit" size="sm" variant="primary" leadingIcon={Check}>
        Apply
      </Button>
      <IconButton icon={X} size="sm" aria-label="Cancel custom input" tooltip onClick={() => setEditorOpen(false)} />
    </form>
  ) : null;

  return { toolbar, subbar };
}
