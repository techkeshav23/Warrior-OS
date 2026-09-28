// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: add / rename a topic
// ═══════════════════════════════════════════════════════════

'use client';

import { useId, useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLearningStore } from '@/stores/useLearningStore';
import type { Topic } from '@/types/learning';
import { DialogShell } from './Dialog';
import { BTN_GHOST, BTN_PRIMARY, INPUT, LABEL, LIMITS } from './deck-ui';

interface TopicFormProps {
  deckId: string;
  /** null = add a new topic. */
  topic: Topic | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function TopicForm({ deckId, topic, onClose, onSaved }: TopicFormProps) {
  const addTopic = useLearningStore((s) => s.addTopic);
  const updateTopic = useLearningStore((s) => s.updateTopic);
  const uid = useId();
  const [name, setName] = useState(topic?.name ?? '');
  const [description, setDescription] = useState(topic?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name the topic.');
      return;
    }
    if (topic) {
      updateTopic(deckId, topic.id, { name: trimmed, description: description.trim() });
      onSaved(`Topic "${trimmed}" updated`);
    } else if (addTopic(deckId, { name: trimmed, description: description.trim() || undefined })) {
      onSaved(`Topic "${trimmed}" added`);
    } else {
      setError('That deck no longer exists.');
    }
  };

  return (
    <DialogShell
      title={topic ? 'Edit topic' : 'New topic'}
      subtitle="Topics group related cards; quizzes can target a single topic."
      icon={<FolderPlus className="h-4 w-4 text-cyan-300" />}
      size="sm"
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            Cancel
          </button>
          <button type="submit" className={BTN_PRIMARY}>
            {topic ? 'Save topic' : 'Add topic'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
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
            placeholder="e.g. Closures, Past tense, Chords"
            className={INPUT}
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
            placeholder="Optional"
            className={cn(INPUT, 'resize-y leading-snug')}
          />
        </div>
      </div>
    </DialogShell>
  );
}
