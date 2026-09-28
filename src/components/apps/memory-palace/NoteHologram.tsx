// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Note Hologram (spec 6.27)
// Click a knowledge object → it lifts off the shelf → flies to you and
// turns to face you → unfolds into a floating holographic glass panel
// with the note rendered as markdown. Close folds it back up and it
// drifts home to its shelf. Any number can be open at once.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { BookOpen, CheckCircle2, ExternalLink, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NoteReview, PalaceNote } from './palaceData';
import { DUE_COLOR, RECENCY_STYLES } from './KnowledgeObject';

// ─────────────────────────────────────────────────────────────
// Safe markdown → React (no dangerouslySetInnerHTML)
// ─────────────────────────────────────────────────────────────

function inline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\]|\$[^$]+\$|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g).filter(Boolean);
  return parts.map((p, i) => {
    const key = `${keyBase}-${i}`;
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={key} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`')) return <code key={key} className="rounded bg-white/10 px-1 font-mono text-[11px] text-accent-primary">{p.slice(1, -1)}</code>;
    if (p.startsWith('[[') && p.endsWith(']]')) return <span key={key} className="text-accent-secondary underline decoration-dotted">{p.slice(2, -2)}</span>;
    if (p.startsWith('$') && p.endsWith('$') && p.length > 2) return <span key={key} className="font-mono italic text-amber-200">{p.slice(1, -1)}</span>;
    if ((p.startsWith('*') && p.endsWith('*')) || (p.startsWith('_') && p.endsWith('_'))) return <em key={key}>{p.slice(1, -1)}</em>;
    return <span key={key}>{p}</span>;
  });
}

export function renderNoteMarkdown(md: string): React.ReactNode[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    const k = `l${i}`;
    if (trimmed.startsWith('```')) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      out.push(
        <pre key={k} className="my-1 overflow-x-auto rounded-md border border-white/10 bg-black/60 p-2 font-mono text-[10.5px] leading-snug text-emerald-200">
          {code.join('\n')}
        </pre>
      );
      continue;
    }
    if (!trimmed) {
      out.push(<div key={k} className="h-1.5" />);
    } else if (/^#{1,6}\s/.test(trimmed)) {
      const level = trimmed.match(/^#+/)?.[0].length ?? 1;
      const text = trimmed.replace(/^#+\s*/, '');
      out.push(
        <div
          key={k}
          className={cn(
            'font-display font-bold tracking-wide',
            level === 1 ? 'mt-1 text-[15px] text-white' : level === 2 ? 'mt-1 text-[13px] text-accent-primary' : 'text-[12px] text-accent-primary/80'
          )}
        >
          {inline(text, k)}
        </div>
      );
    } else if (/^[-*+]\s+\[( |x|X)\]\s/.test(trimmed)) {
      const done = /^[-*+]\s+\[(x|X)\]/.test(trimmed);
      out.push(
        <div key={k} className="flex items-start gap-1.5 text-[12px] text-white/80">
          <span className={cn('mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-sm border', done ? 'border-accent-success bg-accent-success/60' : 'border-white/40')} />
          <span className={cn(done && 'line-through opacity-60')}>{inline(trimmed.replace(/^[-*+]\s+\[.\]\s/, ''), k)}</span>
        </div>
      );
    } else if (/^[-*+]\s/.test(trimmed)) {
      out.push(
        <div key={k} className="flex gap-1.5 pl-1 text-[12px] text-white/80">
          <span className="text-accent-primary">•</span>
          <span>{inline(trimmed.slice(2), k)}</span>
        </div>
      );
    } else if (/^\d+[.)]\s/.test(trimmed)) {
      const num = trimmed.match(/^\d+/)?.[0];
      out.push(
        <div key={k} className="flex gap-1.5 pl-1 text-[12px] text-white/80">
          <span className="font-mono text-accent-primary">{num}.</span>
          <span>{inline(trimmed.replace(/^\d+[.)]\s/, ''), k)}</span>
        </div>
      );
    } else if (trimmed.startsWith('>')) {
      out.push(
        <div key={k} className="border-l-2 border-accent-primary/50 pl-2 text-[12px] italic text-white/60">
          {inline(trimmed.replace(/^>\s?/, ''), k)}
        </div>
      );
    } else if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      out.push(<hr key={k} className="my-1 border-white/10" />);
    } else {
      out.push(
        <p key={k} className="text-[12px] leading-relaxed text-white/80">
          {inline(trimmed, k)}
        </p>
      );
    }
    i += 1;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Hologram
// ─────────────────────────────────────────────────────────────

const OPEN_S = 1.0;
const CLOSE_S = 0.8;

function ease(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function seg(p: number, a: number, b: number): number {
  return Math.min(1, Math.max(0, (p - a) / (b - a)));
}

export interface NoteHologramProps {
  note: PalaceNote;
  review: NoteReview;
  /** World position of the object on its shelf. */
  origin: [number, number, number];
  /** World position the panel floats at (in front of the player). */
  target: [number, number, number];
  /** Current time (ms), ticked by the app. */
  now: number;
  /** Folding back to the shelf. */
  closing: boolean;
  onRequestClose: (id: string) => void;
  /** Fired when the close animation finished (remove it then). */
  onClosed: (id: string) => void;
  onRevise: (note: PalaceNote) => void;
  onOpenInNotes: (note: PalaceNote) => void;
}

const _tmp = new THREE.Vector3();
const _look = new THREE.Object3D();

function NoteHologramInner({
  note,
  review,
  origin,
  target,
  now,
  closing,
  onRequestClose,
  onClosed,
  onRevise,
  onOpenInNotes,
}: NoteHologramProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group | null>(null);
  const tokenRef = useRef<THREE.Mesh | null>(null);
  const panelRef = useRef<THREE.Group | null>(null);
  const progress = useRef(0);
  const closedFired = useRef(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const style = RECENCY_STYLES[review.recency];
  const color = review.isDue ? DUE_COLOR : style.color === '#4a3f33' ? '#b0bec5' : style.color;
  const rendered = useMemo(() => renderNoteMarkdown(note.content.trim() ? note.content : '*This note is empty.*'), [note.content]);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const d = Math.min(dt, 0.05);
    progress.current = closing
      ? Math.max(0, progress.current - d / CLOSE_S)
      : Math.min(1, progress.current + d / OPEN_S);
    const p = progress.current;

    // 0 → 0.3 lift, 0.3 → 0.75 travel (with an arc), 0.7 → 1 unfold.
    const lift = ease(seg(p, 0, 0.3));
    const travel = ease(seg(p, 0.3, 0.75));
    const unfold = ease(seg(p, 0.7, 1));
    const sx = origin[0];
    const sy = origin[1] + lift * 0.45;
    const sz = origin[2];
    g.position.set(
      sx + (target[0] - sx) * travel,
      sy + (target[1] - sy) * travel + Math.sin(travel * Math.PI) * 0.35,
      sz + (target[2] - sz) * travel
    );

    // Turn to face the player (continuously, so it stays readable).
    _look.position.copy(g.position);
    _look.lookAt(camera.getWorldPosition(_tmp));
    g.quaternion.slerp(_look.quaternion, Math.min(1, d * (travel > 0 ? 6 : 2)));

    if (tokenRef.current) {
      tokenRef.current.scale.setScalar(Math.max(0.001, 1 - unfold));
      tokenRef.current.rotation.y += d * (2 + travel * 6);
    }
    if (panelRef.current) {
      panelRef.current.scale.set(0.35 + 0.65 * unfold, Math.max(0.02, unfold), 1);
    }
    const shouldShow = unfold > 0.04;
    if (shouldShow !== panelVisible) setPanelVisible(shouldShow);

    if (closing && p <= 0 && !closedFired.current) {
      closedFired.current = true;
      onClosed(note.id);
    }
  });

  const lastTouched = review.lastTouched > 0 ? new Date(review.lastTouched) : null;
  const dueIn = Math.ceil((review.dueAt - now) / 86_400_000);

  return (
    <group ref={groupRef} position={origin}>
      {/* The object itself, carried to you */}
      <mesh ref={tokenRef}>
        {note.type === 'question' ? (
          <sphereGeometry args={[0.24, 20, 20]} />
        ) : note.type === 'formula' ? (
          <cylinderGeometry args={[0.11, 0.11, 0.5, 14]} />
        ) : (
          <boxGeometry args={[0.36, 0.36, 0.36]} />
        )}
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>

      <group ref={panelRef} scale={[0.35, 0.02, 1]}>
        {/* Holographic glass slab behind the DOM panel */}
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[1.75, 1.95]} />
          <meshBasicMaterial color={color} transparent opacity={0.07} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {panelVisible && (
          <Html transform distanceFactor={2} zIndexRange={[60, 0]} style={{ pointerEvents: 'auto' }}>
            <div
              className="w-[340px] select-text overflow-hidden rounded-xl border bg-black/75 text-left backdrop-blur-md"
              style={{ borderColor: `${color}66`, boxShadow: `0 0 36px ${color}40, inset 0 0 24px ${color}14` }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-3 py-2">
                <BookOpen className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                <span className="flex-1 truncate font-display text-[12px] font-bold tracking-wide text-white">{note.title}</span>
                <button
                  onClick={() => onRequestClose(note.id)}
                  className="rounded p-0.5 text-white/50 transition-colors hover:bg-white/10 hover:text-accent-danger"
                  aria-label="Close hologram"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 border-b border-white/5 px-3 py-1.5 text-[9.5px] uppercase tracking-wider">
                <span className="rounded px-1.5 py-0.5" style={{ backgroundColor: `${note.subject === 'General' ? '#b0bec5' : color}22`, color }}>
                  {note.subject}
                  {note.topic ? ` · ${note.topic}` : ''}
                </span>
                <span className="text-white/40">{note.type}</span>
                <span className="text-white/25">·</span>
                {review.isDue ? (
                  <span className="font-semibold text-accent-danger">
                    {review.overdueDays > 0 ? `revision ${review.overdueDays}d overdue` : 'revision due'}
                  </span>
                ) : (
                  <span className="text-white/50">next revision in {Math.max(1, dueIn)}d</span>
                )}
              </div>

              <div className="max-h-[300px] space-y-1 overflow-y-auto px-3 py-2">
                {rendered}
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

              <div className="flex items-center gap-2 border-t border-white/10 bg-white/[0.03] px-3 py-2">
                <button
                  onClick={() => onRevise(note)}
                  disabled={review.revisedToday}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors',
                    review.revisedToday
                      ? 'cursor-default bg-accent-success/15 text-accent-success/80'
                      : 'bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25'
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {review.revisedToday ? 'Revised today' : 'Mark revised'}
                </button>
                <button
                  onClick={() => onOpenInNotes(note)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in Notes
                </button>
                <span className="ml-auto text-[9.5px] text-white/35">
                  {lastTouched ? `touched ${lastTouched.toLocaleDateString()}` : ''}
                </span>
              </div>
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}

export const NoteHologram = memo(NoteHologramInner);
