// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Note Hologram
// Clicking a KnowledgeObject unfolds a floating glass panel in
// 3D space rendering the note content. Multiple can be open.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import { cn } from '@/lib/utils';
import type { PalaceNote } from './KnowledgeObject';

interface NoteHologramProps {
  note: PalaceNote;
  /** world position where the hologram floats */
  position: [number, number, number];
  onClose: (id: string) => void;
}

/** Extremely small, safe markdown → HTML-ish renderer (headings, bold, code, lists). */
function renderMarkdown(md: string): { key: number; el: React.ReactNode }[] {
  const lines = md.split('\n');
  return lines.map((raw, i) => {
    const line = raw.trimEnd();
    if (!line.trim()) return { key: i, el: <div key={i} className="h-2" /> };
    if (line.startsWith('### ')) return { key: i, el: <h3 key={i} className="text-sm font-bold text-accent-primary">{inline(line.slice(4))}</h3> };
    if (line.startsWith('## ')) return { key: i, el: <h2 key={i} className="text-base font-bold text-accent-primary">{inline(line.slice(3))}</h2> };
    if (line.startsWith('# ')) return { key: i, el: <h1 key={i} className="text-lg font-bold text-white">{inline(line.slice(2))}</h1> };
    if (line.startsWith('- ') || line.startsWith('* ')) return { key: i, el: <li key={i} className="ml-4 list-disc text-xs text-white/80">{inline(line.slice(2))}</li> };
    return { key: i, el: <p key={i} className="text-xs text-white/80">{inline(line)}</p> };
  });
}

/** Inline formatting: **bold** and `code`. Splits without dangerouslySetInnerHTML. */
function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="text-white">{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="rounded bg-white/10 px-1 font-mono text-accent-primary">{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
}

export function NoteHologram({ note, position, onClose }: NoteHologramProps) {
  const rendered = useMemo(() => renderMarkdown(note.content || '_(empty note)_'), [note.content]);
  // unfold-in transition (no dependency on custom keyframes in globals.css)
  const [unfolded, setUnfolded] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setUnfolded(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <Html
      center
      transform
      distanceFactor={8}
      position={position}
      zIndexRange={[100, 0]}
      style={{ pointerEvents: 'auto' }}
    >
      <div
        className={cn(
          'w-72 max-h-80 overflow-hidden rounded-xl border border-accent-primary/40',
          'bg-black/70 backdrop-blur-md shadow-[0_0_30px_rgba(0,240,255,0.35)]',
          'transition-all duration-300 ease-out'
        )}
        style={{
          opacity: unfolded ? 1 : 0,
          transform: unfolded ? 'scaleY(1)' : 'scaleY(0.1)',
          transformOrigin: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-2">
          <span className="truncate text-xs font-bold text-accent-primary">{note.title}</span>
          <button
            onClick={() => onClose(note.id)}
            className="ml-2 rounded px-1.5 text-white/50 transition-colors hover:text-accent-danger"
            aria-label="Close hologram"
          >
            ×
          </button>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto p-3">
          {rendered.map((r) => r.el)}
          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {note.tags.map((t) => (
                <span key={t} className="rounded bg-accent-secondary/20 px-1.5 py-0.5 text-[10px] text-accent-secondary">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Html>
  );
}
