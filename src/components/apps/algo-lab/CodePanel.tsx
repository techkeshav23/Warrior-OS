// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Code Panel
// Read-only pseudocode with light token colouring; the line the
// current frame is executing is highlighted and kept in view.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo, useRef } from 'react';
import { CodeXml } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokenizePseudocode, type PseudoTokenKind } from '@/lib/algorithms/pseudocode';

const TOKEN_CLASS: Record<PseudoTokenKind, string> = {
  keyword: 'text-fuchsia-300',
  action: 'text-amber-200',
  function: 'text-sky-300',
  number: 'text-orange-300',
  operator: 'text-cyan-300',
  constant: 'text-emerald-300',
  comment: 'text-white/40 italic',
  plain: 'text-white/85',
};

interface CodePanelProps {
  /** Name of the procedure shown in the header. */
  title: string;
  lines: readonly string[];
  /** 0-based line to highlight; -1 for none. */
  activeLine: number;
}

function CodePanelInner({ title, lines, activeLine }: CodePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tokenized = useMemo(() => lines.map((line) => tokenizePseudocode(line)), [lines]);

  // Keep the active line visible without scrolling any ancestor container.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || activeLine < 0) return;
    const row = container.querySelector<HTMLElement>(`[data-line="${activeLine}"]`);
    if (!row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < container.scrollTop + 4) {
      container.scrollTop = Math.max(0, top - 20);
    } else if (bottom > container.scrollTop + container.clientHeight - 4) {
      container.scrollTop = bottom - container.clientHeight + 20;
    }
  }, [activeLine, lines]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-black/40">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/55">
          <CodeXml className="h-3 w-3" aria-hidden />
          Pseudocode
        </span>
        <span className="truncate text-[11px] text-white/60">{title}</span>
      </div>
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto py-1.5 font-mono text-[11.5px] leading-[1.6]"
        aria-label={`${title} pseudocode`}
      >
        {tokenized.map((tokens, i) => {
          const active = i === activeLine;
          return (
            <div
              key={i}
              data-line={i}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-start border-l-2 pr-2 transition-colors duration-150',
                active ? 'border-cyan-400 bg-cyan-400/15' : 'border-transparent'
              )}
            >
              <span
                className={cn(
                  'w-7 shrink-0 select-none pr-2 text-right tabular-nums',
                  active ? 'text-cyan-300' : 'text-white/35'
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 whitespace-pre-wrap break-words">
                {tokens.map((token, j) => (
                  <span key={j} className={TOKEN_CLASS[token.kind]}>
                    {token.text}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const CodePanel = memo(CodePanelInner);
