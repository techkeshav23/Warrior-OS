// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Hologram (spec 6.27)
// Click a knowledge object → it lifts off the shelf → flies to you and
// turns to face you → unfolds into a floating forged hologram plate:
//   • note    → the note as markdown · Mark revised · Open in Notes
//   • card    → the prompt · Reveal answer · Forgot / Recalled (graded
//               into Training Grounds spaced repetition) · Open deck
//   • project → description, stage, tasks, stack · Open in Project Forge
// Close folds it back up and it drifts home to its shelf. Any number
// can be open at once.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { BookOpen, CircleCheck, ExternalLink, Eye, Hammer, Layers, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BEVEL_SUNK, SLOT_FILL } from '@/components/ui/armor';
import { Button, IconButton } from '@/components/ui';
import type { PalaceItem, PalaceReview } from './palaceData';
import { DUE_COLOR, KIND_LABELS, NEW_COLOR, RECENCY_STYLES, ShapeGeometry } from './KnowledgeObject';
import { PALACE } from './palaceTheme';

// ─────────────────────────────────────────────────────────────
// Safe markdown → React (no dangerouslySetInnerHTML)
// ─────────────────────────────────────────────────────────────

function inline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\]|\$[^$]+\$|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g).filter(Boolean);
  return parts.map((p, i) => {
    const key = `${keyBase}-${i}`;
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={key} className="font-semibold text-fg">{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`')) return <code key={key} className="bg-steel-950/80 px-1 font-mono text-[11px] text-ember-200 shadow-[inset_0_1px_0_rgb(0_0_0/0.6)]">{p.slice(1, -1)}</code>;
    if (p.startsWith('[[') && p.endsWith(']]')) return <span key={key} className="text-info underline decoration-dotted underline-offset-2">{p.slice(2, -2)}</span>;
    if (p.startsWith('$') && p.endsWith('$') && p.length > 2) return <span key={key} className="font-mono italic text-gold">{p.slice(1, -1)}</span>;
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
        <pre key={k} className={cn('chamfer-xs my-1 overflow-x-auto p-2 font-mono text-[11px] leading-snug text-fg-muted', SLOT_FILL, BEVEL_SUNK)}>
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
            'font-semibold tracking-tight',
            level === 1 ? 'mt-1 text-sm text-fg' : level === 2 ? 'mt-1 text-[13px] text-fg' : 'text-xs text-fg-muted'
          )}
        >
          {inline(text, k)}
        </div>
      );
    } else if (/^[-*+]\s+\[( |x|X)\]\s/.test(trimmed)) {
      const done = /^[-*+]\s+\[(x|X)\]/.test(trimmed);
      out.push(
        <div key={k} className="flex items-start gap-1.5 text-xs text-fg-muted">
          <span className={cn('mt-0.5 inline-block size-2.5 shrink-0 border', done ? 'border-success bg-success/60' : 'border-fg-subtle')} />
          <span className={cn(done && 'line-through opacity-60')}>{inline(trimmed.replace(/^[-*+]\s+\[.\]\s/, ''), k)}</span>
        </div>
      );
    } else if (/^[-*+]\s/.test(trimmed)) {
      out.push(
        <div key={k} className="flex gap-1.5 pl-1 text-xs text-fg-muted">
          <span className="text-ember-400">▪</span>
          <span>{inline(trimmed.slice(2), k)}</span>
        </div>
      );
    } else if (/^\d+[.)]\s/.test(trimmed)) {
      const num = trimmed.match(/^\d+/)?.[0];
      out.push(
        <div key={k} className="flex gap-1.5 pl-1 text-xs text-fg-muted">
          <span className="tabular font-mono text-accent">{num}.</span>
          <span>{inline(trimmed.replace(/^\d+[.)]\s/, ''), k)}</span>
        </div>
      );
    } else if (trimmed.startsWith('>')) {
      out.push(
        <div key={k} className="border-l-2 border-accent/50 pl-2 text-xs italic text-fg-muted">
          {inline(trimmed.replace(/^>\s?/, ''), k)}
        </div>
      );
    } else if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      out.push(<hr key={k} className="my-1 border-line" />);
    } else {
      out.push(
        <p key={k} className="text-xs leading-relaxed text-fg-muted">
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
const DAY_MS = 86_400_000;

function ease(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function seg(p: number, a: number, b: number): number {
  return Math.min(1, Math.max(0, (p - a) / (b - a)));
}

export interface NoteHologramProps {
  item: PalaceItem;
  review: PalaceReview;
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
  /** Notes: mark revised in the palace. */
  onRevise: (item: PalaceItem) => void;
  /** Cards: self-graded recall, recorded in Training Grounds. */
  onGrade: (item: PalaceItem, recalled: boolean) => void;
  /** Open the note / deck / project in its own app. */
  onOpenSource: (item: PalaceItem) => void;
}

const _tmp = new THREE.Vector3();
const _look = new THREE.Object3D();

const OPEN_LABEL: Record<PalaceItem['kind'], string> = {
  note: 'Open in Notes',
  card: 'Open deck',
  project: 'Open in Project Forge',
};

function KindIcon({ kind, color }: { kind: PalaceItem['kind']; color: string }) {
  const props = { size: 14, strokeWidth: 1.75, className: 'shrink-0', style: { color }, 'aria-hidden': true } as const;
  if (kind === 'card') return <Layers {...props} />;
  if (kind === 'project') return <Hammer {...props} />;
  return <BookOpen {...props} />;
}

function ScheduleLabel({ item, review, now }: { item: PalaceItem; review: PalaceReview; now: number }) {
  if (item.kind === 'project') {
    return <span className="text-fg-subtle">{item.project?.onHold ? 'parked' : `${item.project?.progress ?? 0}% done`}</span>;
  }
  if (review.isNew) return <span className="text-warning">new · not studied yet</span>;
  const word = item.kind === 'card' ? 'review' : 'revision';
  if (review.isDue) {
    return (
      <span className="text-danger">
        {review.overdueDays > 0 ? `${word} ${review.overdueDays}d overdue` : `${word} due`}
      </span>
    );
  }
  const dueIn = Math.max(1, Math.ceil((review.dueAt - now) / DAY_MS));
  return <span className="text-fg-subtle">next {word} in {dueIn}d</span>;
}

function CardBody({ item, revealed }: { item: PalaceItem; revealed: boolean }) {
  const card = item.card;
  const prompt = useMemo(() => renderNoteMarkdown(item.body), [item.body]);
  if (!card) return null;
  return (
    <>
      {prompt}
      {card.options && (
        <div className="space-y-0.5 pt-1">
          {card.options.map((o, i) => {
            const right = revealed && (card.correct?.includes(i) ?? false);
            return (
              <div
                key={`${i}:${o}`}
                className={cn('chamfer-xs flex gap-1.5 px-1.5 py-0.5 text-xs [--cut:3px]', right ? 'bg-success/12 text-success' : 'text-fg-muted')}
              >
                <span className="font-mono text-fg-subtle">{String.fromCharCode(65 + i)}</span>
                <span>{o}</span>
              </div>
            );
          })}
        </div>
      )}
      {revealed && (
        <div className="chamfer-sm mt-2 bg-success/[0.08] px-2.5 py-2 shadow-[inset_0_0_0_1px_rgb(61_220_151/0.25),inset_2px_0_0_var(--color-success)]">
          <div className="engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-success">Answer</div>
          <div className="mt-0.5 text-xs font-semibold text-fg">{card.answer || '—'}</div>
          {card.explanation && <div className="mt-1 text-xs leading-relaxed text-fg-muted">{card.explanation}</div>}
        </div>
      )}
    </>
  );
}

function ProjectBody({ item }: { item: PalaceItem }) {
  const project = item.project;
  const description = useMemo(
    () => renderNoteMarkdown(item.body.trim() ? item.body : '*No description yet.*'),
    [item.body]
  );
  if (!project) return null;
  return (
    <>
      {description}
      <div className="pt-2">
        <div className="flex items-center justify-between text-2xs text-fg-subtle">
          <span>Progress</span>
          <span className="tabular font-mono">
            {project.tasksTotal > 0 ? `${project.tasksDone}/${project.tasksTotal} tasks · ` : ''}
            {project.progress}%
          </span>
        </div>
        <div className={cn('mt-1 h-1.5 overflow-hidden', SLOT_FILL, BEVEL_SUNK)}>
          <div className="forge-heat h-full" style={{ width: `${project.progress}%` }} />
        </div>
      </div>
      {project.techStack.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-2">
          {project.techStack.map((t) => (
            <span key={t} className="chamfer-xs bevel bg-steel-700 px-2 py-0.5 font-mono text-[10px] text-fg-muted [--cut:3px]">
              {t}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function NoteHologramInner({
  item,
  review,
  origin,
  target,
  now,
  closing,
  onRequestClose,
  onClosed,
  onRevise,
  onGrade,
  onOpenSource,
}: NoteHologramProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group | null>(null);
  const tokenRef = useRef<THREE.Mesh | null>(null);
  const panelRef = useRef<THREE.Group | null>(null);
  const progress = useRef(0);
  const closedFired = useRef(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState<'recalled' | 'forgot' | null>(null);
  const style = RECENCY_STYLES[review.recency];
  const color = review.isDue ? DUE_COLOR : review.isNew ? NEW_COLOR : review.recency === 'stale' ? PALACE.archive : style.color;
  const noteBody = useMemo(
    () => (item.kind === 'note' ? renderNoteMarkdown(item.body.trim() ? item.body : '*This note is empty.*') : null),
    [item.kind, item.body]
  );

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
      onClosed(item.id);
    }
  });

  const lastTouched = review.lastTouched > 0 ? new Date(review.lastTouched) : null;
  const grade = (recalled: boolean) => {
    setGraded(recalled ? 'recalled' : 'forgot');
    onGrade(item, recalled);
  };

  return (
    <group ref={groupRef} position={origin}>
      {/* The object itself, carried to you */}
      <mesh ref={tokenRef}>
        <ShapeGeometry type={item.shape} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>

      <group ref={panelRef} scale={[0.35, 0.02, 1]}>
        {/* Holographic slab behind the DOM plate */}
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[1.75, 1.95]} />
          <meshBasicMaterial color={color} transparent opacity={0.07} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {panelVisible && (
          <Html transform distanceFactor={2} zIndexRange={[60, 0]} style={{ pointerEvents: 'auto' }}>
            <div
              className="armor-popover rivets relative w-[340px] select-text overflow-hidden text-left text-fg [--cut:14px] [--cut-tr:0px] [--cut-bl:0px] [--rivet-inset:3px]"
              style={{ '--holo': color } as React.CSSProperties}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              <span aria-hidden className="notch pointer-events-none absolute left-1/2 top-0 h-1 w-28 -translate-x-1/2 bg-[var(--holo)] shadow-[0_0_10px_var(--holo)] [--notch:4px]" />
              <div className="flex items-center gap-2.5 px-3 pb-2 pt-3">
                <span
                  className="armor-plate flex size-7 shrink-0 items-center justify-center [--cut:5px]"
                  style={{ color }}
                >
                  <KindIcon kind={item.kind} color={color} />
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold tracking-[0.02em] text-fg" title={item.title}>
                  {item.title}
                </span>
                <IconButton icon={X} size="xs" aria-label="Close hologram" tooltip shortcut="X" onClick={() => onRequestClose(item.id)} />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2 font-mono shadow-[inset_0_-1px_0_rgb(0_0_0/0.6),0_1px_0_rgb(255_255_255/0.04)] text-[10px] uppercase tracking-[0.1em]">
                <span
                  className="chamfer-xs max-w-[180px] truncate px-2 py-0.5 [--cut:3px]"
                  style={{ backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`, color }}
                  title={item.context}
                >
                  {item.context}
                </span>
                <span className="text-fg-subtle">{KIND_LABELS[item.kind]}</span>
                <span className="text-fg-faint">·</span>
                <ScheduleLabel item={item} review={review} now={now} />
              </div>

              <div className="scrollbar-thin max-h-[300px] space-y-1.5 overflow-y-auto px-3 py-2.5">
                {item.kind === 'note' && noteBody}
                {item.kind === 'card' && <CardBody item={item} revealed={revealed || graded !== null} />}
                {item.kind === 'project' && <ProjectBody item={item} />}
                {item.kind !== 'project' && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {item.tags.map((t) => (
                      <span key={t} className="chamfer-xs bg-info/12 px-2 py-0.5 text-[10px] text-info [--cut:3px]">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="brushed flex flex-wrap items-center gap-1.5 bg-steel-900/80 px-3 py-2 shadow-[inset_0_1px_0_rgb(0_0_0/0.6),inset_0_2px_0_rgb(255_255_255/0.035)]">
                {item.kind === 'note' &&
                  (review.revisedToday ? (
                    <span className="flex h-7 items-center gap-1.5 px-1 text-xs font-medium text-success">
                      <CircleCheck size={14} strokeWidth={1.75} aria-hidden />
                      Revised today
                    </span>
                  ) : (
                    <Button size="sm" variant="primary" leadingIcon={CircleCheck} onClick={() => onRevise(item)}>
                      Mark revised
                    </Button>
                  ))}
                {item.kind === 'card' &&
                  (graded ? (
                    <span
                      className={cn(
                        'flex h-7 items-center gap-1.5 px-1 text-xs font-medium',
                        graded === 'recalled' ? 'text-success' : 'text-warning'
                      )}
                    >
                      <CircleCheck size={14} strokeWidth={1.75} aria-hidden />
                      {graded === 'recalled' ? 'Recalled' : 'Back in the queue'}
                    </span>
                  ) : !revealed ? (
                    <Button size="sm" variant="primary" leadingIcon={Eye} onClick={() => setRevealed(true)}>
                      Reveal answer
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="secondary" leadingIcon={RotateCcw} onClick={() => grade(false)}>
                        Forgot
                      </Button>
                      <Button size="sm" variant="primary" leadingIcon={CircleCheck} onClick={() => grade(true)}>
                        Recalled
                      </Button>
                    </>
                  ))}
                <Button size="sm" variant="ghost" leadingIcon={ExternalLink} onClick={() => onOpenSource(item)}>
                  {OPEN_LABEL[item.kind]}
                </Button>
                <span className="tabular ml-auto font-mono text-[10px] text-fg-subtle">
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
