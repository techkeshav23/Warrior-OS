// ═══════════════════════════════════════════════════════════
// WARRIOR OS — AppLayout, SidebarNav, NavItem, AppHeader (FORGE HUD kit)
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
          className="scrollbar-thin flex h-full shrink-0 flex-col overflow-y-auto border-r border-line bg-ink-950/35"
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

/** Sidebar navigation row: lucide icon + label; active = accent-soft + 2px indicator. */
export function NavItem({ icon, label, active = false, count, badge, className, type = 'button', ...props }: NavItemProps) {
  return (
    <button
      type={type}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'focus-ring group/nav relative flex h-9 w-full min-w-0 items-center gap-2.5 rounded-control px-2.5 text-left text-ui font-medium',
        'transition-colors duration-120 ease-out-quint disabled:pointer-events-none disabled:opacity-40',
        active ? 'bg-accent/10 text-accent' : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'absolute -left-2 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-[opacity,transform] duration-180 ease-out-quint',
          active ? 'scale-y-100 opacity-100 shadow-[0_0_8px_var(--accent,#2fd6f5)]' : 'scale-y-50 opacity-0'
        )}
      />
      {icon != null && (
        <span className={cn('flex shrink-0', active ? 'text-accent' : 'text-fg-subtle group-hover/nav:text-fg-muted')}>
          {renderIcon(icon, 18)}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && (
        <span className={cn('tabular shrink-0 font-mono text-2xs', active ? 'text-accent/80' : 'text-fg-subtle')}>{count}</span>
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
      <nav className={cn('flex min-h-0 flex-1 flex-col gap-4 px-3 py-3', header != null && 'pt-1')} {...props}>
        {groups.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-0.5">
            {group.label != null && <div className="hud-label px-2.5 pb-1.5 pt-1">{group.label}</div>}
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
      {footer != null && <div className="shrink-0 border-t border-line px-3 py-3">{footer}</div>}
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
    <header className={cn('shrink-0', bordered && 'border-b border-line', className)} {...props}>
      <div className={cn('flex min-h-15 items-center gap-3 px-5 py-3', tabs != null && 'pb-2')}>
        {leading != null && <div className="flex shrink-0 items-center">{leading}</div>}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-6.5 tracking-tight text-fg">{title}</h1>
          {subtitle != null && <div className="hud-label mt-0.5 truncate">{subtitle}</div>}
        </div>
        {actions != null && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {tabs != null && <div className="-mb-px px-3">{tabs}</div>}
    </header>
  );
}
