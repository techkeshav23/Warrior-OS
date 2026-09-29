// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Tabs (FORGE HUD kit)
//   underline  2px accent indicator on a hairline (section tabs, headers)
//   pill       rounded pills, active = accent-soft (filters, sub-views)
// Controlled (`value`) or uncontrolled (`defaultTab`). Arrow keys move
// between tabs (tablist pattern). Old props keep working ('pills' too).
//   <Tabs value={tab} onChange={setTab} tabs={[{ id: 'decks', label: 'Decks', icon: Layers }]} />
// ═══════════════════════════════════════════════════════════

'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { renderIcon, type IconLike } from './icon';

export interface TabItem {
  id: string;
  label: ReactNode;
  icon?: IconLike;
  /** Count or badge after the label. */
  badge?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Controlled active tab id. */
  value?: string;
  /** Initial tab when uncontrolled. */
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  variant?: 'underline' | 'pill' | 'pills';
  size?: 'sm' | 'md';
  /** Stretch tabs to fill the row. */
  fullWidth?: boolean;
  /** Prefix for tab/panel ids: tab = `${idPrefix}-tab-${id}`, panel = `${idPrefix}-panel-${id}`. */
  idPrefix?: string;
  'aria-label'?: string;
  className?: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/** Tab strip. Render the panels yourself (optionally with `idPrefix` ids). */
export function Tabs({
  tabs,
  value,
  defaultTab,
  onChange,
  variant = 'underline',
  size = 'md',
  fullWidth = false,
  idPrefix,
  className,
  ...aria
}: TabsProps) {
  const [inner, setInner] = useState(defaultTab ?? tabs[0]?.id);
  const active = value ?? inner;
  const instanceId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const pill = variant !== 'underline';

  const select = (id: string) => {
    if (value === undefined) setInner(id);
    onChange?.(id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const enabled = tabs.filter((t) => !t.disabled);
    if (!enabled.length) return;
    const i = enabled.findIndex((t) => t.id === active);
    const step = keys[e.key];
    const next =
      step === -Infinity ? enabled[0] : step === Infinity ? enabled[enabled.length - 1] : enabled[(i + step + enabled.length) % enabled.length];
    select(next.id);
    (listRef.current?.children[tabs.indexOf(next)] as HTMLElement | undefined)?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={aria['aria-label']}
      onKeyDown={onKeyDown}
      className={cn(
        'flex items-center',
        pill ? 'gap-1' : 'gap-1 border-b border-line',
        fullWidth && '[&>*]:flex-1',
        className
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${tab.id}` : undefined}
            aria-controls={idPrefix ? `${idPrefix}-panel-${tab.id}` : undefined}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => select(tab.id)}
            className={cn(
              'focus-ring relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium',
              'transition-colors duration-120 ease-out-quint disabled:pointer-events-none disabled:opacity-40',
              pill
                ? cn(
                    'rounded-full',
                    size === 'sm' ? 'h-7 px-3 text-xs' : 'h-8 px-3.5 text-ui',
                    selected ? 'text-accent' : 'text-fg-muted hover:bg-surface-hover hover:text-fg'
                  )
                : cn(
                    'rounded-t-control',
                    size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-10 px-3 text-ui',
                    selected ? 'text-fg' : 'text-fg-muted hover:text-fg'
                  )
            )}
          >
            {selected && pill && (
              <motion.span
                layoutId={`${instanceId}-pill`}
                aria-hidden
                className="absolute inset-0 -z-0 rounded-full bg-accent/12 ring-1 ring-inset ring-accent/25"
                transition={{ duration: 0.22, ease: EASE }}
              />
            )}
            <span className="relative flex items-center gap-2">
              {renderIcon(tab.icon, size === 'sm' ? 14 : 16, selected && !pill ? 'text-accent' : undefined)}
              {tab.label}
              {tab.badge != null && (
                <span
                  className={cn(
                    'tabular rounded-full px-1.5 font-mono text-2xs leading-4',
                    selected ? 'bg-accent/15 text-accent' : 'bg-surface-active text-fg-subtle'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </span>
            {selected && !pill && (
              <motion.span
                layoutId={`${instanceId}-underline`}
                aria-hidden
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent,#2fd6f5)]"
                transition={{ duration: 0.22, ease: EASE }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
