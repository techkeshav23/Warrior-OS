// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Code Panel (FORGE HUD)
// Read-only pseudocode with token syntax colours; the line the
// current frame is executing sits on an accent-soft band with a 2px
// accent edge and is kept in view. A Guide tab holds the plain-
// language walkthrough and exam notes.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { BookOpenText, ChevronRight, CodeXml } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ENGRAVED_LABEL } from '@/components/ui/armor';
import { Tabs } from '@/components/ui';
import type { AlgorithmMeta } from '@/types/algo';
import { tokenizePseudocode, type PseudoTokenKind } from '@/lib/algorithms/pseudocode';

const TOKEN_CLASS: Record<PseudoTokenKind, string> = {
  keyword: 'text-viz-3',
  action: 'text-ember-300',
  function: 'text-info',
  number: 'text-viz-7',
  operator: 'text-plasma-300',
  constant: 'text-success',
  comment: 'text-fg-subtle italic',
  plain: 'text-fg',
};

interface CodePanelProps {
  /** Name of the procedure shown in the header. */
  title: string;
  lines: readonly string[];
  /** 0-based line to highlight; -1 for none. */
  activeLine: number;
  /** Adds a Guide tab (description, steps, exam notes). */
  meta?: AlgorithmMeta;
  className?: string;
}

function Guide({ meta }: { meta: AlgorithmMeta }) {
  return (
    <div className="space-y-4 px-4 py-3">
      <p className="select-text text-ui text-fg-muted">{meta.description}</p>
      <section>
        <h4 className={cn(ENGRAVED_LABEL, 'mb-2')}>How it works</h4>
        <ol className="space-y-1.5">
          {meta.steps.map((step, i) => (
            <li key={step} className="flex gap-2.5 text-ui text-fg-muted">
              <span className="tabular chamfer-xs bevel mt-px flex size-5 shrink-0 items-center justify-center bg-steel-700 font-display text-2xs font-semibold text-ember-300 [--cut:4px]">
                {i + 1}
              </span>
              <span className="min-w-0 select-text">{step}</span>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h4 className={cn(ENGRAVED_LABEL, 'mb-2')}>Exam notes</h4>
        <ul className="space-y-1.5">
          {meta.facts.map((fact) => (
            <li key={fact} className="flex gap-1.5 text-ui text-fg-muted">
              <ChevronRight size={14} strokeWidth={1.75} className="mt-[3px] shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 select-text">{fact}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CodePanelInner({ title, lines, activeLine, meta, className }: CodePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'code' | 'guide'>('code');
  const tokenized = useMemo(() => lines.map((line) => tokenizePseudocode(line)), [lines]);
  const idPrefix = `algo-code-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // Keep the active line visible without scrolling any ancestor container.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || activeLine < 0 || tab !== 'code') return;
    const row = container.querySelector<HTMLElement>(`[data-line="${activeLine}"]`);
    if (!row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < container.scrollTop + 4) {
      container.scrollTop = Math.max(0, top - 20);
    } else if (bottom > container.scrollTop + container.clientHeight - 4) {
      container.scrollTop = bottom - container.clientHeight + 20;
    }
  }, [activeLine, lines, tab]);

  const showGuide = meta !== undefined && tab === 'guide';

  return (
    <div
      className={cn(
        'armor-panel flex min-h-[12rem] min-w-0 flex-col overflow-hidden [--cut:10px]',
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 pl-1 pr-3">
        {meta ? (
          <Tabs
            size="sm"
            value={tab}
            onChange={(id) => setTab(id === 'guide' ? 'guide' : 'code')}
            idPrefix={idPrefix}
            aria-label="Code panel"
            className="-mb-px border-b-0"
            tabs={[
              { id: 'code', label: 'Pseudocode', icon: CodeXml },
              { id: 'guide', label: 'Guide', icon: BookOpenText },
            ]}
          />
        ) : (
          <span className="flex h-8 items-center gap-1.5 pl-2 text-xs font-medium text-fg">
            <CodeXml size={14} strokeWidth={1.75} className="text-accent" aria-hidden />
            Pseudocode
          </span>
        )}
        <span className="min-w-0 truncate font-mono text-2xs text-fg-subtle" title={title}>
          {title}
        </span>
      </div>
      <div
        ref={scrollRef}
        role={meta ? 'tabpanel' : undefined}
        id={meta ? `${idPrefix}-panel-${tab}` : undefined}
        aria-labelledby={meta ? `${idPrefix}-tab-${tab}` : undefined}
        className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto bg-steel-950/80 shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_3px_8px_rgb(0_0_0/0.4)]"
        aria-label={meta ? undefined : `${title} pseudocode`}
      >
        {showGuide ? (
          <Guide meta={meta} />
        ) : (
          <div className="select-text py-2 font-mono text-xs leading-[1.7]">
            {tokenized.map((tokens, i) => {
              const active = i === activeLine;
              return (
                <div
                  key={i}
                  data-line={i}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'relative flex items-start pr-3 transition-colors duration-120 ease-out-quint',
                    active ? 'bg-linear-to-r from-ember-500/20 via-ember-500/[0.07] to-transparent' : 'hover:bg-surface-hover'
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-y-0 left-0 w-0.5 bg-ember-400 shadow-[0_0_8px_var(--color-ember-500)] transition-opacity duration-120',
                      active ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span
                    className={cn(
                      'tabular w-9 shrink-0 select-none pr-3 text-right',
                      active ? 'text-ember-300' : 'text-fg-subtle'
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
        )}
      </div>
    </div>
  );
}

export const CodePanel = memo(CodePanelInner);
