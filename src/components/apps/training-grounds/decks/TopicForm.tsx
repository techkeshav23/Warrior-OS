// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: add / rename a topic
// ═══════════════════════════════════════════════════════════

'use client';

import { useId, useRef, useState } from 'react';
import { FolderPlus, FolderPen } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';
import { useLearningStore } from '@/stores/useLearningStore';
import type { Topic } from '@/types/learning';
import { DialogShell, SubmitButton } from './Dialog';
import { LIMITS } from './deck-ui';

interface TopicFormProps {
  deckId: string;
  /** null = add a new topic. */
  topic: Topic | null;
  open?: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function TopicForm({ deckId, topic, open = true, onClose, onSaved }: TopicFormProps) {
  const addTopic = useLearningStore((s) => s.addTopic);
  const updateTopic = useLearningStore((s) => s.updateTopic);
  const uid = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(topic?.name ?? '');
  const [description, setDescription] = useState(topic?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  const dirty = name !== (topic?.name ?? '') || description !== (topic?.description ?? '');

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name the topic.');
      nameRef.current?.focus();
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
      open={open}
      title={topic ? 'Edit topic' : 'New topic'}
      subtitle="Topics group related cards; quizzes can target a single topic."
      icon={topic ? FolderPen : FolderPlus}
      size="md"
      dirty={dirty}
      initialFocus={nameRef}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton>{topic ? 'Save topic' : 'Add topic'}</SubmitButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          ref={nameRef}
          id={`${uid}-name`}
          label="Name"
          value={name}
          maxLength={LIMITS.name}
          error={error ?? undefined}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g. Closures, Past tense, Chords"
        />
        <Textarea
          id={`${uid}-desc`}
          label="Description"
          labelAside="Optional"
          value={description}
          maxLength={LIMITS.description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What this topic covers"
        />
      </div>
    </DialogShell>
  );
}
