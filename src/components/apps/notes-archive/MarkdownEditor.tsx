// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Markdown Editor with wiki-link support
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useRef, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import type { Note } from './NotesApp';

interface Props {
  note: Note;
  onUpdate: (changes: Partial<Note>) => void;
  onNavigate: (title: string) => void;
}

// Simple markdown → HTML converter
function renderMarkdown(text: string): string {
  return text
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-white mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-white mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-white mt-4 mb-2">$1</h1>')
    // Bold/italic
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-white/80 italic">$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code class="bg-white/10 px-1 rounded text-cyan-300 text-xs font-mono">$1</code>')
    // Code blocks
    .replace(/```([^`]+)```/g, '<pre class="bg-black/40 p-3 rounded-lg text-xs font-mono text-green-300 overflow-x-auto my-2">$1</pre>')
    // Wiki links [[Title]]
    .replace(/\[\[(.+?)\]\]/g, '<a class="text-cyan-400 underline cursor-pointer hover:text-cyan-300" data-wikilink="$1">$1</a>')
    // Lists
    .replace(/^- (.+)$/gm, '<li class="text-white/70 ml-4 list-disc text-sm">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="text-white/70 ml-4 list-decimal text-sm">$1</li>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-cyan-500/40 pl-3 text-white/50 italic text-sm my-2">$1</blockquote>')
    // Line breaks
    .replace(/\n/g, '<br/>');
}

function MarkdownEditorInner({ note, onUpdate, onNavigate }: Props) {
  const [isPreview, setIsPreview] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const handlePreviewClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.dataset.wikilink) {
        onNavigate(target.dataset.wikilink);
      }
    },
    [onNavigate]
  );

  const addTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || note.tags.includes(tag)) return;
    onUpdate({ tags: [...note.tags, tag] });
    setTagInput('');
  }, [tagInput, note.tags, onUpdate]);

  const removeTag = useCallback(
    (tag: string) => {
      onUpdate({ tags: note.tags.filter((t) => t !== tag) });
    },
    [note.tags, onUpdate]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-white/10 bg-black/20">
        <input
          value={note.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="bg-transparent text-white font-bold text-sm outline-none flex-1 mr-4"
          placeholder="Note title..."
        />
        <div className="flex gap-1">
          <button
            onClick={() => setIsPreview(false)}
            className={cn(
              'px-3 py-1 rounded text-xs transition-all',
              !isPreview
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-white/40 hover:text-white/60'
            )}
          >
            Edit
          </button>
          <button
            onClick={() => setIsPreview(true)}
            className={cn(
              'px-3 py-1 rounded text-xs transition-all',
              isPreview
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-white/40 hover:text-white/60'
            )}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 bg-black/10">
        {note.tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300/70 flex items-center gap-1"
          >
            #{tag}
            <button onClick={() => removeTag(tag)} className="text-amber-400/50 hover:text-amber-300">
              ×
            </button>
          </span>
        ))}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
          placeholder="+ tag"
          className="bg-transparent text-[10px] text-white/40 outline-none w-16"
        />
      </div>

      {/* Editor / Preview */}
      <div className="flex-1 overflow-y-auto">
        {isPreview ? (
          <div
            className="p-4 text-sm text-white/70 leading-relaxed prose-sm"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content) }}
            onClick={handlePreviewClick}
          />
        ) : (
          <textarea
            ref={editorRef}
            value={note.content}
            onChange={(e) => onUpdate({ content: e.target.value })}
            className="w-full h-full p-4 bg-transparent text-white/80 text-sm font-mono leading-relaxed resize-none outline-none"
            placeholder="Start writing...&#10;&#10;Use **bold**, *italic*, `code`&#10;Use [[Wiki Link]] to link notes&#10;Use # for headings"
          />
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-white/5 text-[10px] text-white/30">
        <span>{note.content.length} chars • {note.content.split(/\s+/).filter(Boolean).length} words</span>
        <span>Updated {new Date(note.updatedAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

export const MarkdownEditor = memo(MarkdownEditorInner);
