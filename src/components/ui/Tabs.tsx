// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Tabs (FORGED ARMOR kit)
//   underline  armor tabs: notched plates on a rule, active = raised steel + ember edge
//   pill       small cut plates, active = heated ember plate (filters, sub-views)
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
        pill ? 'gap-1' : 'gap-0.5 shadow-[inset_0_-1px_0_rgb(0_0_0/0.6),inset_0_-2px_0_rgb(255_255_255/0.05)]',
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
              'focus-ring-inset relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-display font-semibold uppercase tracking-[0.1em]',
              'transition-colors duration-120 ease-out-quint disabled:pointer-events-none disabled:opacity-40',
              pill
                ? cn(
                    'chamfer [--cut:5px]',
                    size === 'sm' ? 'h-7 px-3 text-[11px]' : 'h-8 px-3.5 text-xs',
                    selected ? 'text-ember-300' : 'text-fg-muted hover:bg-white/[0.05] hover:text-fg'
                  )
                : cn(
                    // Armor tab: notched top-left corner; active = raised steel plate
                    '[clip-path:polygon(7px_0,100%_0,100%_100%,0_100%,0_7px)]',
                    size === 'sm' ? 'h-8 px-3 text-[11px]' : 'h-10 px-3.5 text-xs',
                    selected
                      ? 'bg-linear-to-b from-[#2c333d] to-[#161a20] text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_1px_0_0_rgb(255_255_255/0.05)]'
                      : 'text-fg-subtle hover:bg-white/[0.03] hover:text-fg'
                  )
            )}
          >
            {selected && pill && (
              <motion.span
                layoutId={`${instanceId}-pill`}
                aria-hidden
                className="absolute inset-0 -z-0 bg-linear-to-b from-ember-500/25 to-ember-600/10 shadow-[inset_0_1px_0_rgb(255_200_160/0.25),inset_0_-2px_0_var(--color-ember-400,#ff8a3d)]"
                transition={{ duration: 0.22, ease: EASE }}
              />
            )}
            <span className="relative flex items-center gap-2">
              {renderIcon(tab.icon, size === 'sm' ? 14 : 16, selected ? 'text-ember-400' : undefined)}
              {tab.label}
              {tab.badge != null && (
                <span
                  className={cn(
                    'tabular chamfer [--cut:3px] px-1.5 font-mono text-2xs leading-4 tracking-normal',
                    selected ? 'bg-ember-500/20 text-ember-300' : 'bg-white/[0.06] text-fg-subtle'
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
                className="absolute inset-x-0 bottom-0 h-0.5 bg-linear-to-r from-ember-600 via-ember-400 to-ember-300"
                transition={{ duration: 0.22, ease: EASE }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
