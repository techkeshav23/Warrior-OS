// ═══════════════════════════════════════════════════════════
// WARRIOR OS — AppLayout, SidebarNav, NavItem, AppHeader (FORGED ARMOR kit)
// The standard frame for app windows:
//
//   ┌──────────┬──────────────────────────────────────┐
//   │ sidebar  │ AppHeader: title · hud subtitle · ⋯  │
//   │ (216px)  ├──────────────────────────────────────┤
//   │ NavItem  │ toolbar (optional, 40px)             │
//   │ NavItem  ├──────────────────────────────────────┤
//   │ …        │ scrollable body (p-5)                │
//   └──────────┴──────────────────────────────────────┘
//
//   <AppLayout
//     sidebar={<SidebarNav value={tab} onChange={setTab} sections={[{ items: NAV }]} />}
//     header={<AppHeader title="Appearance" subtitle="System · Theme" actions={…} />}>
//     …content…
//   </AppLayout>
// ═══════════════════════════════════════════════════════════

'use client';

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { renderIcon, type IconLike } from './icon';
import { ENGRAVED_LABEL } from './armor';

// ─── AppLayout ────────────────────────────────────────────

export interface AppLayoutProps extends HTMLAttributes<HTMLDivElement> {
  /** Left column (usually <SidebarNav/>). */
  sidebar?: ReactNode;
  /** Sidebar width in px, 200–232 (default 216). */
  sidebarWidth?: number;
  /** Header row (usually <AppHeader/>). */
  header?: ReactNode;
  /** Toolbar row under the header. */
  toolbar?: ReactNode;
  /** Pinned bottom row (status bar, composer). */
  footer?: ReactNode;
  /** Body padding 20px (default true). */
  padded?: boolean;
  /** Body scrolls (default). false = body is a fixed flex column the app lays out itself. */
  scroll?: boolean;
  bodyClassName?: string;
}

/** Standard app frame: optional sidebar + header + toolbar + scrollable body. */
export function AppLayout({
  sidebar,
  sidebarWidth = 216,
  header,
  toolbar,
  footer,
  padded = true,
  scroll = true,
  className,
  bodyClassName,
  children,
  ...props
}: AppLayoutProps) {
  const width = Math.min(232, Math.max(200, sidebarWidth));
  return (
    <div className={cn('flex h-full min-h-0 w-full min-w-0 text-ui text-fg', className)} {...props}>
      {sidebar != null && (
        <aside
          className={cn(
            'scrollbar-thin relative flex h-full shrink-0 flex-col overflow-y-auto',
            // Armor rail: darker brushed steel, beveled right edge with a groove
            'bg-linear-to-b from-[#12161b] via-[#0d1014] to-[#0a0c0f] brushed',
            'shadow-[inset_-1px_0_0_rgb(0_0_0/0.7),inset_-2px_0_0_rgb(255_255_255/0.05),inset_-6px_0_10px_-6px_rgb(0_0_0/0.6)]'
          )}
          style={{ width }}
        >
          {sidebar}
        </aside>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {header}
        {toolbar}
        <main
          className={cn(
            'min-h-0 flex-1',
            scroll ? 'scrollbar-thin overflow-y-auto' : 'flex flex-col overflow-hidden',
            padded && 'p-5',
            bodyClassName
          )}
        >
          {children}
        </main>
        {footer}
      </div>
    </div>
  );
}

// ─── NavItem ──────────────────────────────────────────────

export interface NavItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon?: IconLike;
  label: ReactNode;
  active?: boolean;
  /** Count shown on the right (tabular). */
  count?: number;
  /** Badge / dot / Kbd on the right. */
  badge?: ReactNode;
}

/** Sidebar navigation row: lucide icon + label; active = heated plate + ember notch on the rail edge. */
export function NavItem({ icon, label, active = false, count, badge, className, type = 'button', ...props }: NavItemProps) {
  return (
    <button
      type={type}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'focus-ring-inset group/nav relative flex h-9 w-full min-w-0 items-center gap-2.5 px-3 text-left text-ui font-medium',
        '[clip-path:polygon(0_0,calc(100%-8px)_0,100%_8px,100%_100%,0_100%)]',
        'transition-[background-color,color,box-shadow] duration-120 ease-out-quint disabled:pointer-events-none disabled:opacity-40',
        active
          ? 'bg-linear-to-r from-ember-500/22 via-[#2a2520] to-[#1c1f24] text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_-1px_0_rgb(0_0_0/0.6),inset_-2px_0_0_var(--color-ember-500,#f76b15)]'
          : 'text-fg-muted hover:bg-white/[0.045] hover:text-fg hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]',
        className
      )}
      {...props}
    >
      {/* Ember notch: a molten wedge on the rail edge */}
      <span
        aria-hidden
        className={cn(
          'absolute left-0 top-1/2 h-5 w-1.5 -translate-y-1/2 bg-ember-400 transition-[opacity,transform] duration-180 ease-out-quint',
          '[clip-path:polygon(0_0,100%_4px,100%_calc(100%-4px),0_100%)]',
          active ? 'scale-y-100 opacity-100 shadow-[0_0_10px_var(--color-ember-500,#f76b15)]' : 'scale-y-50 opacity-0'
        )}
      />
      {icon != null && (
        <span className={cn('flex shrink-0', active ? 'text-ember-400' : 'text-fg-subtle group-hover/nav:text-fg-muted')}>
          {renderIcon(icon, 18)}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && (
        <span className={cn('tabular shrink-0 font-mono text-2xs', active ? 'text-ember-300' : 'text-fg-subtle')}>{count}</span>
      )}
      {badge}
    </button>
  );
}

// ─── SidebarNav ───────────────────────────────────────────

export interface NavItemDef {
  id: string;
  label: ReactNode;
  icon?: IconLike;
  count?: number;
  badge?: ReactNode;
  disabled?: boolean;
}

export interface NavSection {
  /** hud-label heading (omit for the first/only group). */
  label?: ReactNode;
  items: NavItemDef[];
}

export interface SidebarNavProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  /** Flat list (shorthand for one unlabeled section). */
  items?: NavItemDef[];
  sections?: NavSection[];
  /** Active item id. */
  value?: string;
  onChange?: (id: string) => void;
  /** Top area (app title, workspace switcher). */
  header?: ReactNode;
  /** Bottom area (profile, settings, storage meter). */
  footer?: ReactNode;
  'aria-label'?: string;
}

/** Sidebar with sectioned NavItems. Children render after the sections. */
export function SidebarNav({
  items,
  sections,
  value,
  onChange,
  header,
  footer,
  className,
  children,
  ...props
}: SidebarNavProps) {
  const groups: NavSection[] = sections ?? (items ? [{ items }] : []);
  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {header != null && <div className="shrink-0 px-4 pb-2 pt-4">{header}</div>}
      <nav className={cn('flex min-h-0 flex-1 flex-col gap-4 py-3 pl-0 pr-2', header != null && 'pt-1')} {...props}>
        {groups.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-0.5">
            {group.label != null && (
              <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-1">
                <span className={cn(ENGRAVED_LABEL, 'shrink-0')}>{group.label}</span>
                <span aria-hidden className="h-px flex-1 bg-black/60 shadow-[0_1px_0_rgb(255_255_255/0.05)]" />
              </div>
            )}
            {group.items.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                count={item.count}
                badge={item.badge}
                disabled={item.disabled}
                active={item.id === value}
                onClick={() => onChange?.(item.id)}
              />
            ))}
          </div>
        ))}
        {children}
      </nav>
      {footer != null && (
        <div className="shrink-0 px-3 py-3 shadow-[inset_0_1px_0_rgb(0_0_0/0.6),inset_0_2px_0_rgb(255_255_255/0.04)]">{footer}</div>
      )}
    </div>
  );
}

// ─── AppHeader ────────────────────────────────────────────

export interface AppHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  /** hud-label line under the title (context, counts, status). */
  subtitle?: ReactNode;
  /** Leading icon / AppIcon / back button. */
  leading?: ReactNode;
  /** Right-aligned actions. */
  actions?: ReactNode;
  /** Row under the title (e.g. underline <Tabs/>), sits on the bottom hairline. */
  tabs?: ReactNode;
  /** Hairline under the header (default true). */
  bordered?: boolean;
}

/** App content header: title (text-lg semibold) + hud-label subtitle + actions. */
export function AppHeader({ title, subtitle, leading, actions, tabs, bordered = true, className, ...props }: AppHeaderProps) {
  return (
    <header
      className={cn(
        'relative shrink-0 bg-linear-to-b from-white/[0.035] to-transparent',
        bordered && 'shadow-[inset_0_-1px_0_rgb(0_0_0/0.65),inset_0_-2px_0_rgb(255_255_255/0.04)]',
        className
      )}
      {...props}
    >
      <div className={cn('flex min-h-15 items-center gap-3 px-5 py-3', tabs != null && 'pb-2')}>
        {leading != null && <div className="flex shrink-0 items-center">{leading}</div>}
        <div className="min-w-0 flex-1">
          <h1 className="engraved truncate font-display text-lg font-bold uppercase leading-6.5 tracking-[0.05em] text-fg">{title}</h1>
          {subtitle != null && <div className={cn(ENGRAVED_LABEL, 'mt-0.5 truncate')}>{subtitle}</div>}
        </div>
        {actions != null && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {tabs != null && <div className="-mb-px px-3">{tabs}</div>}
    </header>
  );
}
