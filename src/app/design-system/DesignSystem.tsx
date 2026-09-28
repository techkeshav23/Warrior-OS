// ═══════════════════════════════════════════════════════════
// FORGE HUD — the Warrior OS design system (showcase page)
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import {
  Bell,
  Bold,
  CalendarCheck,
  Check,
  Copy,
  Download,
  Flame,
  Gauge,
  Italic,
  LayoutGrid,
  List,
  ListChecks,
  Mail,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Star,
  Swords,
  Target,
  Timer,
  Trash2,
  Trophy,
  Underline,
  Zap,
} from 'lucide-react';
import {
  AppHeader,
  AppIcon,
  AppLayout,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmDialog,
  Dialog,
  Divider,
  EmptyState,
  IconButton,
  Input,
  Kbd,
  ListRow,
  Menu,
  ProgressBar,
  ProgressRing,
  Radio,
  RadioGroup,
  SearchField,
  SectionHeader,
  SegmentedControl,
  Select,
  SidebarNav,
  Skeleton,
  Slider,
  Sparkline,
  StatTile,
  Switch,
  Tabs,
  Textarea,
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
  ToolbarSpacer,
  Tooltip,
  type Tone,
} from '@/components/ui';
import { WindowTitleBar } from '@/components/os/Window';
import { APP_REGISTRY } from '@/data/app-registry';
import { APP_HUES, getAppIconSpec, type AppIconFamily } from '@/data/app-icons';
import { cn } from '@/lib/utils';
import {
  COLOR_GROUPS,
  ELEVATION,
  FG_SWATCHES,
  RADII,
  SPACING,
  SURFACE_SWATCHES,
  TYPE_SCALE,
  VIZ_SERIES_SWATCHES,
  VIZ_SWATCHES,
  type Swatch,
} from './tokens';

const NAV = [
  { id: 'colors', label: 'Color' },
  { id: 'type', label: 'Type' },
  { id: 'layout', label: 'Layout' },
  { id: 'components', label: 'Components' },
  { id: 'icons', label: 'App icons' },
  { id: 'window', label: 'Window' },
];

const TONES: Tone[] = ['neutral', 'accent', 'ember', 'success', 'warning', 'danger', 'info', 'gold'];

const FAMILY_LABEL: Record<AppIconFamily, string> = {
  learn: 'Learn',
  build: 'Build',
  discipline: 'Discipline',
  life: 'Life',
  system: 'System',
};

const TREND = [12, 18, 14, 22, 19, 27, 24, 31, 29, 36];
const SPEND = [42, 38, 45, 30, 33, 26, 28, 22];

// ─── Page scaffolding ─────────────────────────────────────

function Section({ id, eyebrow, title, description, children }: { id: string; eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line py-16">
      <SectionHeader eyebrow={eyebrow} title={title} description={description} size="lg" className="mb-10 max-w-2xl" />
      {children}
    </section>
  );
}

function Specimen({ title, note, children, className }: { title: string; note?: string; children: ReactNode; className?: string }) {
  return (
    <Card eyebrow={note} title={title} className={className} bodyClassName="flex flex-col gap-4">
      {children}
    </Card>
  );
}

function StateLabel({ children }: { children: ReactNode }) {
  return <span className="hud-label w-20 shrink-0 !text-[10px]">{children}</span>;
}

function SwatchChip({ s, dark = false }: { s: Swatch; dark?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className={cn('h-14 rounded-control border border-line-strong', s.cls, dark && 'inset-shadow-[0_1px_0_rgb(255_255_255/0.05)]')} />
      <div className="min-w-0">
        <div className="truncate font-mono text-xs text-fg">{s.name}</div>
        <div className="truncate font-mono text-2xs text-fg-subtle">{s.value}</div>
        {s.note && <div className="truncate text-2xs text-fg-faint">{s.note}</div>}
      </div>
    </div>
  );
}

// ─── Sample window (composed from the kit) ────────────────

function SampleWindow() {
  const [nav, setNav] = useState('today');
  const [done, setDone] = useState<Record<string, boolean>>({ read: true, code: true });
  const habits = [
    { id: 'read', title: 'Read 20 pages', meta: '07:30', streak: 12 },
    { id: 'code', title: 'Ship one commit', meta: '10:00', streak: 9 },
    { id: 'gym', title: 'Strength training', meta: '18:00', streak: 4 },
    { id: 'review', title: 'Review 30 flashcards', meta: '21:00', streak: 21 },
  ];
  const completed = habits.filter((h) => done[h.id]).length;
  return (
    <div className="relative mx-auto w-full max-w-[1080px]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-window"
        style={{ boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent, #2fd6f5) 14%, transparent), 0 0 64px -18px color-mix(in srgb, var(--accent, #2fd6f5) 45%, transparent)' }}
      />
      <div className="glass-window relative flex h-[640px] flex-col overflow-hidden rounded-window border border-line-strong shadow-e3">
        <WindowTitleBar title="Habit Forge" appId="study-planner" focused maximized={false} />
        <div className="min-h-0 flex-1">
          <AppLayout
            sidebar={
              <SidebarNav
                header={
                  <div className="flex items-center gap-2.5">
                    <AppIcon appId="study-planner" size={28} active />
                    <div className="min-w-0">
                      <div className="truncate text-ui font-semibold text-fg">Habit Forge</div>
                      <div className="hud-label !text-[10px]">Discipline</div>
                    </div>
                  </div>
                }
                value={nav}
                onChange={setNav}
                sections={[
                  {
                    items: [
                      { id: 'today', label: 'Today', icon: CalendarCheck, count: 4 },
                      { id: 'habits', label: 'Habits', icon: ListChecks, count: 11 },
                      { id: 'streaks', label: 'Streaks', icon: Flame },
                    ],
                  },
                  {
                    label: 'Insights',
                    items: [
                      { id: 'stats', label: 'Stats', icon: Gauge },
                      { id: 'trophies', label: 'Trophies', icon: Trophy, badge: <Badge tone="ember" size="sm">New</Badge> },
                    ],
                  },
                ]}
                footer={
                  <div className="flex items-center gap-2.5">
                    <Avatar name="Warrior One" size="sm" status="online" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-fg">Warrior One</div>
                      <div className="tabular font-mono text-2xs text-gold">LV 7 · 2,140 XP</div>
                    </div>
                  </div>
                }
              />
            }
            header={
              <AppHeader
                title="Today"
                subtitle={`Mon 28 Sep · ${completed}/${habits.length} done`}
                actions={
                  <>
                    <IconButton icon={Search} aria-label="Search habits" tooltip shortcut="/" />
                    <Button variant="ember" leadingIcon={Flame}>
                      Forge habit
                    </Button>
                  </>
                }
              />
            }
          >
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-3">
                <StatTile label="Streak" value="9" unit="days" tone="ember" icon={Flame} delta={12} deltaLabel="best 21" />
                <StatTile label="XP today" value="+120" tone="gold" icon={Zap} sparkline={<Sparkline data={TREND} tone="gold" />} />
                <StatTile
                  label="Completion"
                  value={`${Math.round((completed / habits.length) * 100)}%`}
                  icon={Target}
                  sparkline={<ProgressBar value={completed} max={habits.length} segments={habits.length} size="md" aria-label="Habits done" />}
                />
              </div>
              <Card
                eyebrow="Routine"
                title="Today’s habits"
                padding="sm"
                actions={
                  <Menu
                    align="end"
                    trigger={<IconButton icon={MoreHorizontal} aria-label="Habit list options" size="sm" />}
                    items={[
                      { id: 'h1', heading: true, label: 'List' },
                      { id: 'edit', label: 'Edit routine', icon: Pencil, shortcut: 'E' },
                      { id: 'share', label: 'Share progress', icon: Share2 },
                      { id: 'd', divider: true },
                      { id: 'reset', label: 'Reset today', icon: Trash2, danger: true },
                    ]}
                  />
                }
              >
                <div className="flex flex-col divide-y divide-line">
                  {habits.map((h) => (
                    <ListRow
                      key={h.id}
                      leading={
                        <Checkbox
                          aria-label={`Mark ${h.title} done`}
                          checked={!!done[h.id]}
                          onCheckedChange={(v) => setDone((d) => ({ ...d, [h.id]: v }))}
                        />
                      }
                      title={<span className={cn(done[h.id] && 'text-fg-subtle line-through decoration-fg-faint')}>{h.title}</span>}
                      description={`${h.streak}-day streak`}
                      meta={h.meta}
                      trailing={<Badge tone={h.streak >= 10 ? 'ember' : 'neutral'} icon={Flame}>{h.streak}</Badge>}
                    />
                  ))}
                </div>
              </Card>
            </div>
          </AppLayout>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────

export function DesignSystem() {
  const [checked, setChecked] = useState(true);
  const [sw, setSw] = useState(true);
  const [sw2, setSw2] = useState(false);
  const [range, setRange] = useState('week');
  const [view, setView] = useState('grid');
  const [tab, setTab] = useState('overview');
  const [pill, setPill] = useState('all');
  const [radio, setRadio] = useState('focus');
  const [slider, setSlider] = useState(60);
  const [query, setQuery] = useState('');
  const [chips, setChips] = useState(['Algorithms', 'Networks', 'OS']);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [emberOpen, setEmberOpen] = useState(false);

  const apps = APP_REGISTRY.map((a) => ({ id: a.id, name: a.name, spec: getAppIconSpec(a.id) }));

  return (
    <div className="h-screen select-text overflow-y-auto overflow-x-hidden bg-ink-900 text-fg scrollbar-thin">
      {/* Backdrop: faint plasma + ember wash and a grid */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 size-[640px] rounded-full bg-accent/[0.07] blur-[120px]" />
        <div className="absolute -right-40 top-[30%] size-[520px] rounded-full bg-ember-500/[0.05] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(to right, var(--color-line, rgba(148,170,205,.10)) 1px, transparent 1px), linear-gradient(to bottom, var(--color-line, rgba(148,170,205,.10)) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'linear-gradient(to bottom, #000, transparent 60%)',
            WebkitMaskImage: 'linear-gradient(to bottom, #000, transparent 60%)',
          }}
        />
      </div>

      {/* Top bar */}
      <header className="glass-popover sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-4 px-6 lg:px-10">
          <a href="#top" className="focus-ring flex items-center gap-2.5 rounded-control">
            <Image src="/icons/icon-192.png" alt="" width={28} height={28} className="rounded-[8px]" />
            <span className="font-display text-sm font-semibold tracking-[0.18em] text-fg">FORGE HUD</span>
          </a>
          <Badge tone="accent">v1.0</Badge>
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Sections">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="focus-ring rounded-control px-2.5 py-1.5 text-ui text-fg-muted transition-colors duration-120 hover:bg-surface-hover hover:text-fg"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <Button size="sm" variant="secondary" trailingIcon={LayoutGrid} onClick={() => (window.location.href = '/')}>
            Open Warrior OS
          </Button>
        </div>
      </header>

      <main id="top" className="relative mx-auto max-w-[1280px] px-6 lg:px-10">
        {/* Hero */}
        <section className="grid items-center gap-10 py-20 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <div className="hud-label mb-5 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent,#2fd6f5)]" />
              The Warrior OS design system
            </div>
            <h1 className="font-display text-[56px] font-bold leading-[1.02] tracking-[0.04em] text-fg">
              FORGE
              <span className="bg-linear-to-r from-plasma-300 via-accent to-ember-400 bg-clip-text text-transparent"> HUD</span>
            </h1>
            <p className="mt-6 max-w-xl text-base text-fg-muted">
              A premium sci-fi command center lit by forge-fire. Cold, precise machine UI in{' '}
              <span className="text-accent">Plasma</span>, warm warrior energy in <span className="text-ember-400">Ember</span>,
              on calm deep-ink surfaces.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="primary" size="lg" leadingIcon={Sparkles} onClick={() => document.getElementById('components')?.scrollIntoView({ behavior: 'smooth' })}>
                Browse components
              </Button>
              <Button variant="ember" size="lg" leadingIcon={Flame} onClick={() => document.getElementById('window')?.scrollIntoView({ behavior: 'smooth' })}>
                See it forged
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: '01', t: 'Calm canvas, loud moments', d: 'Glow and motion only for focus, live status and wins.' },
              { k: '02', t: 'One accent per surface', d: 'Plasma for the machine. Ember only for warrior energy.' },
              { k: '03', t: 'Hierarchy by type', d: 'fg → muted → subtle and spacing, not nested boxes.' },
              { k: '04', t: 'Every state designed', d: 'Empty, loading, error, focus, disabled — never raw text.' },
            ].map((p) => (
              <Card key={p.k} padding="md" hud={p.k === '01'}>
                <div className="tabular font-mono text-2xs text-accent">{p.k}</div>
                <div className="mt-2 text-sm font-semibold text-fg">{p.t}</div>
                <p className="mt-1 text-xs text-fg-muted">{p.d}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Color */}
        <Section id="colors" eyebrow="01 · Color" title="Color tokens" description="Use the utilities (bg-ink-900, text-fg-muted, border-line, text-accent…) — never raw hex in components.">
          <div className="flex flex-col gap-10">
            {COLOR_GROUPS.map((g) => (
              <div key={g.title} className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <div>
                  <div className="text-sm font-semibold text-fg">{g.title}</div>
                  <p className="mt-1 text-xs text-fg-subtle">{g.description}</p>
                </div>
                <div className="grid grid-cols-4 gap-3 xl:grid-cols-8">
                  {g.swatches.map((s) => (
                    <SwatchChip key={s.name} s={s} dark={g.title === 'Ink'} />
                  ))}
                </div>
              </div>
            ))}
            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              <div>
                <div className="text-sm font-semibold text-fg">Foreground</div>
                <p className="mt-1 text-xs text-fg-subtle">Three steps of emphasis, plus faint for decoration.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {FG_SWATCHES.map((s) => (
                  <div key={s.name} className="rounded-card border border-line bg-surface-2 p-4">
                    <div className={cn('text-xl font-semibold', s.cls)}>Aa</div>
                    <div className="mt-2 font-mono text-xs text-fg">{s.name}</div>
                    <div className="font-mono text-2xs text-fg-subtle">{s.value} · {s.note}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              <div>
                <div className="text-sm font-semibold text-fg">Surfaces & lines</div>
                <p className="mt-1 text-xs text-fg-subtle">Translucent layers over the wallpaper; 1px hairlines.</p>
              </div>
              <div className="grid grid-cols-4 gap-3 xl:grid-cols-7">
                {SURFACE_SWATCHES.map((s) => (
                  <SwatchChip key={s.name} s={s} />
                ))}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              <div>
                <div className="text-sm font-semibold text-fg">Data viz</div>
                <p className="mt-1 text-xs text-fg-subtle">Charts only. A mark with one fixed meaning keeps its hue.</p>
              </div>
              <div className="grid grid-cols-4 gap-3 xl:grid-cols-8">
                {VIZ_SWATCHES.map((s) => (
                  <SwatchChip key={s.name} s={s} />
                ))}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              <div>
                <div className="text-sm font-semibold text-fg">Series order</div>
                <p className="mt-1 text-xs text-fg-subtle">
                  Multi-series charts, in this order (VIZ_SERIES, vizColor(i)): neighbours stay apart for colour-blind eyes.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-3 xl:grid-cols-8">
                {VIZ_SERIES_SWATCHES.map((s) => (
                  <SwatchChip key={s.name} s={s} />
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Type */}
        <Section id="type" eyebrow="02 · Typography" title="Type scale" description="Inter for UI, JetBrains Mono for data and HUD labels, Orbitron only for big numbers, hero titles and the logo.">
          <div className="mb-8 grid grid-cols-3 gap-3">
            {[
              { f: 'font-sans', n: 'Inter', u: 'UI · default', s: 'Aa Bb 0123' },
              { f: 'font-mono', n: 'JetBrains Mono', u: 'Data · labels · code', s: 'Aa Bb 0123' },
              { f: 'font-display', n: 'Orbitron', u: 'Numbers · heroes · logo', s: 'AA 0123' },
            ].map((f) => (
              <Card key={f.n}>
                <div className={cn('text-2xl text-fg', f.f)}>{f.s}</div>
                <div className="mt-3 text-sm font-semibold text-fg">{f.n}</div>
                <div className="hud-label mt-1">{f.u}</div>
              </Card>
            ))}
          </div>
          <Card padding="none">
            <div className="divide-y divide-line">
              {TYPE_SCALE.map((t) => (
                <div key={t.token} className="grid grid-cols-[140px_1fr_200px] items-center gap-6 px-5 py-4">
                  <div>
                    <div className="font-mono text-xs text-accent">{t.token}</div>
                    <div className="font-mono text-2xs text-fg-subtle">{t.spec}</div>
                  </div>
                  <div className={cn('truncate text-fg', t.cls)}>{t.sample}</div>
                  <div className="text-right text-xs text-fg-subtle">{t.use}</div>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* Layout */}
        <Section id="layout" eyebrow="03 · Layout" title="Space, shape & depth" description="4px grid. Radii by role. Four elevation steps; glow is a state, not a decoration.">
          <div className="grid gap-4 lg:grid-cols-3">
            <Specimen title="Spacing" note="4px grid">
              <div className="flex flex-col gap-2">
                {SPACING.map((px) => (
                  <div key={px} className="flex items-center gap-3">
                    <span className="tabular w-10 font-mono text-2xs text-fg-subtle">{px}px</span>
                    <span className="h-2.5 rounded-[3px] bg-accent/70" style={{ width: px * 3 }} />
                  </div>
                ))}
              </div>
            </Specimen>
            <Specimen title="Radii" note="By role">
              <div className="grid grid-cols-2 gap-3">
                {RADII.map((r) => (
                  <div key={r.name} className="flex items-center gap-3">
                    <div className={cn('size-12 shrink-0 border border-line-strong bg-linear-to-b from-ink-700 to-ink-800', r.cls)} />
                    <div className="min-w-0">
                      <div className="truncate font-mono text-2xs text-fg">{r.name.replace('rounded-', '')}</div>
                      <div className="font-mono text-2xs text-fg-subtle">{r.value}</div>
                      <div className="truncate text-2xs text-fg-faint">{r.use}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Specimen>
            <Specimen title="Elevation" note="Shadows">
              <div className="grid grid-cols-2 gap-4 p-2">
                {ELEVATION.map((e) => (
                  <div key={e.name} className={cn('flex h-20 flex-col justify-end rounded-card border border-line bg-ink-800 p-3', e.cls)}>
                    <div className="font-mono text-2xs text-fg">{e.name}</div>
                    <div className="text-2xs text-fg-subtle">{e.use}</div>
                  </div>
                ))}
              </div>
            </Specimen>
          </div>
        </Section>

        {/* Components */}
        <Section id="components" eyebrow="04 · Components" title="The kit" description="Everything apps are built from — import from @/components/ui. Every control has hover, active, focus-visible and disabled states.">
          <div className="grid gap-4 lg:grid-cols-2">
            <Specimen title="Button" note="primary · secondary · ghost · danger · ember" className="lg:col-span-2">
              {(['primary', 'secondary', 'ghost', 'danger', 'ember'] as const).map((v) => (
                <div key={v} className="flex flex-wrap items-center gap-3">
                  <StateLabel>{v}</StateLabel>
                  <Button variant={v} size="sm">Small</Button>
                  <Button variant={v} leadingIcon={v === 'ember' ? Flame : v === 'danger' ? Trash2 : Plus}>
                    {v === 'ember' ? 'Forge it' : v === 'danger' ? 'Delete' : 'Medium'}
                  </Button>
                  <Button variant={v} size="lg" trailingIcon={v === 'primary' ? Sparkles : undefined}>Large</Button>
                  <Button variant={v} loading>Saving</Button>
                  <Button variant={v} disabled>Disabled</Button>
                </div>
              ))}
            </Specimen>

            <Specimen title="IconButton & Tooltip" note="aria-label required">
              <div className="flex flex-wrap items-center gap-3">
                <StateLabel>Sizes</StateLabel>
                <IconButton icon={Settings2} aria-label="Settings" size="xs" tooltip />
                <IconButton icon={Settings2} aria-label="Settings" size="sm" tooltip />
                <IconButton icon={Settings2} aria-label="Settings" size="md" tooltip shortcut="Ctrl ," />
                <IconButton icon={Settings2} aria-label="Settings" size="lg" tooltip />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StateLabel>Variants</StateLabel>
                <IconButton icon={Star} aria-label="Favorite" variant="secondary" tooltip />
                <IconButton icon={Plus} aria-label="Add" variant="primary" tooltip />
                <IconButton icon={Trash2} aria-label="Delete" variant="danger" tooltip />
                <IconButton icon={Bold} aria-label="Bold (on)" active tooltip="Bold is on" />
                <IconButton icon={Download} aria-label="Export" loading />
                <IconButton icon={Copy} aria-label="Copy" disabled />
              </div>
              <div className="flex items-center gap-3">
                <StateLabel>Tooltip</StateLabel>
                <Tooltip content="Open the command bar" shortcut="Ctrl K" side="bottom">
                  <Button variant="secondary" leadingIcon={Search}>Hover or focus me</Button>
                </Tooltip>
              </div>
            </Specimen>

            <Specimen title="Menu" note="Anchored · keyboard">
              <div className="flex flex-wrap items-center gap-3">
                <Menu
                  trigger={<Button variant="secondary" trailingIcon={MoreHorizontal}>Deck actions</Button>}
                  items={[
                    { id: 'h', heading: true, label: 'Deck' },
                    { id: 'rename', label: 'Rename', icon: Pencil, shortcut: 'F2' },
                    { id: 'dup', label: 'Duplicate', icon: Copy, shortcut: 'Ctrl D' },
                    { id: 'pin', label: 'Pinned to Today', icon: Star, checked: true },
                    { id: 'x', divider: true },
                    { id: 'del', label: 'Delete deck', icon: Trash2, danger: true },
                  ]}
                />
                <Menu
                  align="end"
                  trigger={<IconButton icon={MoreHorizontal} aria-label="More options" variant="secondary" />}
                  items={[
                    { id: 'share', label: 'Share', icon: Share2, description: 'Copy a read-only link' },
                    { id: 'export', label: 'Export as Markdown', icon: Download },
                    { id: 'arch', label: 'Archive', disabled: true },
                  ]}
                />
              </div>
              <div className="glass-popover w-64 rounded-card border border-line-strong p-1 shadow-e2">
                <div className="flex h-8 items-center gap-2.5 rounded-[6px] bg-surface-active px-2.5 text-ui text-fg">
                  <Pencil size={16} strokeWidth={1.75} className="text-fg" aria-hidden /> Rename
                  <span className="ml-auto font-mono text-2xs text-fg-subtle">F2</span>
                </div>
                <div className="flex h-8 items-center gap-2.5 px-2.5 text-ui text-fg">
                  <Copy size={16} strokeWidth={1.75} className="text-fg-subtle" aria-hidden /> Duplicate
                </div>
                <div className="-mx-1 my-1 h-px bg-line" />
                <div className="flex h-8 items-center gap-2.5 px-2.5 text-ui text-danger">
                  <Trash2 size={16} strokeWidth={1.75} aria-hidden /> Delete
                </div>
              </div>
            </Specimen>

            <Specimen title="Text fields" note="Input · Textarea · Select · Search">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Deck name" placeholder="e.g. Operating Systems" hint="Shown on the card." />
                <Input label="Email" leadingIcon={Mail} defaultValue="warrior@" error="Enter a valid email address." />
                <Select
                  label="Sort by"
                  defaultValue="due"
                  options={[
                    { value: 'due', label: 'Due date' },
                    { value: 'name', label: 'Name' },
                    { value: 'streak', label: 'Streak' },
                  ]}
                />
                <Input label="Disabled" placeholder="Read only" disabled />
                <SearchField value={query} onValueChange={setQuery} placeholder="Search notes" shortcut="/" wrapperClassName="col-span-2" />
                <Textarea label="Reflection" labelAside="0 / 280" placeholder="What did you forge today?" rows={3} wrapperClassName="col-span-2" />
              </div>
            </Specimen>

            <Specimen title="Choice controls" note="Checkbox · Radio · Switch · Slider">
              <div className="grid grid-cols-2 gap-5">
                <div className="flex flex-col gap-3">
                  <Checkbox label="Show completed" checked={checked} onCheckedChange={setChecked} />
                  <Checkbox label="Select all" indeterminate description="3 of 8 selected" />
                  <Checkbox label="Disabled" disabled />
                  <Radio label="Standalone radio" name="demo-radio" defaultChecked />
                </div>
                <RadioGroup
                  name="mode"
                  label="Session mode"
                  value={radio}
                  onValueChange={setRadio}
                  options={[
                    { value: 'focus', label: 'Focus', description: '50 min · deep work' },
                    { value: 'sprint', label: 'Sprint', description: '25 min · pomodoro' },
                    { value: 'free', label: 'Free run', disabled: true },
                  ]}
                />
              </div>
              <Divider />
              <div className="flex flex-col gap-3">
                <Switch layout="row" checked={sw} onCheckedChange={setSw} label="Glass blur" description="Frosted windows over the wallpaper." />
                <Switch layout="row" tone="ember" checked={sw2} onCheckedChange={setSw2} label="Streak protection" description="Ember switches are for warrior toggles." />
                <div className="flex items-center gap-4">
                  <Switch size="sm" checked aria-label="Small on" onCheckedChange={() => {}} />
                  <Switch size="sm" checked={false} aria-label="Small off" onCheckedChange={() => {}} />
                  <Switch checked disabled aria-label="Disabled on" onCheckedChange={() => {}} />
                </div>
              </div>
              <Slider label="Glass opacity" value={slider} onValueChange={setSlider} formatValue={(n) => `${n}%`} />
              <Slider label="Forge intensity" tone="ember" value={35} onValueChange={() => {}} formatValue={(n) => `${n}%`} />
            </Specimen>

            <Specimen title="Tabs & segmented" note="underline · pill · segmented">
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: 'overview', label: 'Overview', icon: LayoutGrid },
                  { id: 'decks', label: 'Decks', badge: 12 },
                  { id: 'review', label: 'Review', badge: 3 },
                  { id: 'locked', label: 'Mock tests', disabled: true },
                ]}
              />
              <Tabs
                variant="pill"
                value={pill}
                onChange={setPill}
                tabs={[
                  { id: 'all', label: 'All' },
                  { id: 'due', label: 'Due today' },
                  { id: 'new', label: 'New' },
                  { id: 'mastered', label: 'Mastered' },
                ]}
              />
              <div className="flex flex-wrap items-center gap-3">
                <SegmentedControl
                  aria-label="Range"
                  value={range}
                  onChange={setRange}
                  options={[
                    { value: 'day', label: 'Day' },
                    { value: 'week', label: 'Week' },
                    { value: 'month', label: 'Month' },
                    { value: 'year', label: 'Year' },
                  ]}
                />
                <SegmentedControl
                  aria-label="View"
                  size="sm"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'grid', icon: LayoutGrid, 'aria-label': 'Grid view' },
                    { value: 'list', icon: List, 'aria-label': 'List view' },
                  ]}
                />
              </div>
            </Specimen>

            <Specimen title="Badges, chips & keys" note="Status · tags · shortcuts">
              <div className="flex flex-wrap items-center gap-2">
                {TONES.map((t) => (
                  <Badge key={t} tone={t}>{t}</Badge>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success" dot pulse>Live</Badge>
                <Badge tone="ember" icon={Flame}>9 day streak</Badge>
                <Badge tone="gold" icon={Zap}>+25 XP</Badge>
                <Badge tone="accent" variant="solid">Pro</Badge>
                <Badge tone="danger" variant="outline">Overdue</Badge>
                <Badge tone="success" variant="dot">Synced</Badge>
                <Badge tone="warning" variant="dot">Offline</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {chips.map((c) => (
                  <Chip key={c} onRemove={() => setChips((cs) => cs.filter((x) => x !== c))}>{c}</Chip>
                ))}
                <Chip selected onClick={() => {}}>Selected</Chip>
                <Chip onClick={() => {}} icon={Plus}>Add tag</Chip>
                <Chip tone="ember" selected icon={Flame}>Hot</Chip>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-fg-muted">
                <span className="flex items-center gap-2">Command bar <Kbd keys={['Ctrl', 'K']} /></span>
                <span className="flex items-center gap-2">Search <Kbd>/</Kbd></span>
                <span className="flex items-center gap-2">Close <Kbd>Esc</Kbd></span>
              </div>
            </Specimen>

            <Specimen title="Stat tiles & meters" note="hud-label · tabular values" className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatTile label="Focus today" value="3h 20m" plainValue icon={Timer} delta={12} deltaLabel="vs last week" />
                <StatTile label="Cards reviewed" value="1,284" icon={NotebookPen} sparkline={<Sparkline data={TREND} />} delta={8} />
                <StatTile label="Spent · Sep" value="₹18.4k" plainValue icon={Swords} delta={-6} deltaTone="inverse" deltaLabel="under budget" sparkline={<Sparkline data={SPEND} tone="success" />} />
                <StatTile label="Warrior level" value="7" unit="Centurion" tone="gold" icon={Trophy} sparkline={<ProgressBar value={2140} max={2500} tone="gold" aria-label="XP to next level" />} />
              </div>
              <div className="grid grid-cols-[1fr_auto] items-center gap-8">
                <div className="flex flex-col gap-4">
                  <ProgressBar label="Daily goal" value={62} showValue />
                  <ProgressBar label="Streak cells" value={7} max={10} segments={10} tone="ember" valueLabel="7 / 10" />
                  <ProgressBar label="Storage" value={91} tone="warning" showValue size="sm" />
                </div>
                <div className="flex items-center gap-5">
                  <ProgressRing value={72} size={96} label="Focus" />
                  <ProgressRing value={45} size={72} tone="ember" />
                  <ProgressRing value={88} size={48} tone="success" />
                </div>
              </div>
            </Specimen>

            <Specimen title="Cards & sections" note="glass-panel · max 2 levels">
              <SectionHeader size="sm" eyebrow="This week" title="Section header" actions={<Button size="sm" variant="ghost" trailingIcon={Share2}>Share</Button>} />
              <div className="grid grid-cols-2 gap-3">
                <Card eyebrow="Default" title="Glass card" description="Hairline edge, e1 shadow." padding="sm">
                  <p className="text-xs text-fg-muted">Body copy sits at fg-muted.</p>
                </Card>
                <Card eyebrow="HUD corners" title="Live card" hud tone="accent" padding="sm">
                  <p className="text-xs text-fg-muted">For hero / live surfaces only.</p>
                </Card>
                <Card eyebrow="Ember" title="Achievement" tone="ember" icon={Trophy} padding="sm">
                  <p className="text-xs text-fg-muted">Warrior moments get ember.</p>
                </Card>
                <Card title="With footer" padding="sm" interactive footer={<><Avatar name="Keshav Upadhyay" size="xs" /><span className="text-xs text-fg-subtle">Edited 2h ago</span></>}>
                  <p className="text-xs text-fg-muted">Hover lifts interactive cards.</p>
                </Card>
              </div>
            </Specimen>

            <Specimen title="Lists, toolbar & avatars" note="40px rows · hairlines">
              <Toolbar className="-mx-4 -mt-1 border-t-0" aria-label="Formatting">
                <ToolbarGroup>
                  <IconButton icon={Bold} aria-label="Bold" size="sm" active />
                  <IconButton icon={Italic} aria-label="Italic" size="sm" />
                  <IconButton icon={Underline} aria-label="Underline" size="sm" />
                </ToolbarGroup>
                <ToolbarSeparator />
                <IconButton icon={Bell} aria-label="Reminders" size="sm" />
                <ToolbarSpacer />
                <Button size="sm" variant="primary" leadingIcon={Check}>Save</Button>
              </Toolbar>
              <div className="-mx-1 flex flex-col divide-y divide-line">
                <ListRow leading={<AppIcon appId="notes" size={28} />} title="Graph theory cheatsheet" description="Notes · edited 2h ago" meta="1.2k words" onClick={() => {}} selected />
                <ListRow leading={<AppIcon appId="flashcards" size={28} />} title="Operating Systems" description="Deck · 48 cards" meta="12 due" onClick={() => {}} trailing={<IconButton icon={MoreHorizontal} aria-label="Row options" size="xs" />} revealTrailing />
                <ListRow leading={<Avatar name="Keshav Upadhyay" size="md" status="online" />} title="Keshav Upadhyay" description="Owner · online" meta="LV 7" />
                <ListRow leading={Trophy} title="Disabled row" description="Not available" disabled onClick={() => {}} />
              </div>
              <div className="flex items-center gap-3">
                <Avatar name="Aria Stone" size="xs" />
                <Avatar name="Aria Stone" size="sm" />
                <Avatar name="Aria Stone" size="md" status="away" />
                <Avatar name="Keshav Upadhyay" size="lg" ring />
                <Avatar name="Warrior" size="xl" shape="square" status="online" />
              </div>
            </Specimen>

            <Specimen title="Empty, loading & error states" note="Every screen designs them" className="lg:col-span-2">
              <div className="grid gap-3 xl:grid-cols-3">
                <Card padding="none">
                  <EmptyState
                    icon={NotebookPen}
                    title="No notes yet"
                    description="Capture your first idea — it saves as you type."
                    actions={<Button variant="primary" size="sm" leadingIcon={Plus}>New note</Button>}
                  />
                </Card>
                <Card padding="none">
                  <EmptyState
                    tone="danger"
                    title="Couldn’t load the forecast"
                    description="The weather service didn’t answer. Try again in a moment."
                    actions={<Button size="sm">Retry</Button>}
                  />
                </Card>
                <Card padding="md" bodyClassName="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <Skeleton shape="circle" className="size-9" />
                    <div className="flex flex-1 flex-col gap-2">
                      <Skeleton className="w-1/2" />
                      <Skeleton className="w-1/3" />
                    </div>
                  </div>
                  <Skeleton lines={3} />
                  <Skeleton shape="block" className="h-16" />
                  <Divider label="Loading" />
                </Card>
              </div>
            </Specimen>

            <Specimen title="Dialogs" note="Focus trap · Esc · focus return" className="lg:col-span-2">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={() => setDialogOpen(true)}>Open dialog</Button>
                <Button variant="danger" leadingIcon={Trash2} onClick={() => setConfirmOpen(true)}>Delete deck…</Button>
                <Button variant="ember" leadingIcon={Flame} onClick={() => setEmberOpen(true)}>Forge a new habit…</Button>
              </div>
              <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                title="Rename deck"
                description="Deck names show on the Training Grounds shelf."
                footer={
                  <>
                    <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button variant="primary" onClick={() => setDialogOpen(false)}>Save</Button>
                  </>
                }
              >
                <Input label="Name" defaultValue="Operating Systems" />
              </Dialog>
              <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={() => setConfirmOpen(false)}
                title="Delete “Operating Systems”?"
                description="Its 48 cards and review history go too. This can’t be undone."
                confirmLabel="Delete deck"
              />
              <ConfirmDialog
                open={emberOpen}
                onClose={() => setEmberOpen(false)}
                onConfirm={() => setEmberOpen(false)}
                tone="ember"
                title="Forge “Read 20 pages”?"
                description="Daily at 07:30. Keep it for 7 days to earn the Kindling badge."
                confirmLabel="Forge habit"
              />
            </Specimen>
          </div>
        </Section>

        {/* App icons */}
        <Section id="icons" eyebrow="05 · App icons" title="One tile, nineteen glyphs" description="<AppIcon appId size /> — ink tile, hairline edge, inner highlight, lucide glyph in the app’s family hue. Glow appears only when active or hovered.">
          <div className="grid grid-cols-4 gap-3 xl:grid-cols-5">
            {apps.map((a) => (
              <div key={a.id} className="group flex items-center gap-3 rounded-card border border-line bg-surface-2 p-3 transition-colors duration-120 hover:border-line-strong hover:bg-surface-hover">
                <AppIcon appId={a.id} size={56} />
                <div className="min-w-0">
                  <div className="truncate text-ui font-semibold text-fg">{a.name}</div>
                  <div className="truncate font-mono text-2xs text-fg-subtle">{a.spec.glyph}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: APP_HUES[a.spec.hue] }} />
                    <span className="hud-label !text-[10px]">{FAMILY_LABEL[a.spec.family]} · {a.spec.hue}</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 rounded-card border border-dashed border-line-strong p-3">
              <AppIcon appId="unknown-app" size={56} />
              <div className="min-w-0">
                <div className="truncate text-ui font-semibold text-fg">Fallback</div>
                <div className="truncate font-mono text-2xs text-fg-subtle">AppWindow</div>
                <div className="hud-label mt-1 !text-[10px]">Unknown ids</div>
              </div>
            </div>
          </div>
          <Card className="mt-6" eyebrow="Sizes & states" title="16 · 20 · 28 · 40 · 56">
            <div className="flex flex-wrap items-end gap-10">
              {['code-editor', 'study-planner', 'nexus-ai'].map((id) => (
                <div key={id} className="flex items-end gap-4">
                  {[16, 20, 28, 40, 56].map((s) => (
                    <AppIcon key={s} appId={id} size={s} />
                  ))}
                  <div className="flex flex-col items-center gap-1.5">
                    <AppIcon appId={id} size={56} active />
                    <span className="hud-label !text-[10px]">Active</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* Sample window */}
        <Section id="window" eyebrow="06 · Composition" title="A window, forged from the kit" description="Window chrome + AppLayout + SidebarNav + AppHeader + StatTile + Card + ListRow. This is what every app should feel like.">
          <SampleWindow />
        </Section>

        <footer className="flex items-center justify-between border-t border-line py-10 text-xs text-fg-subtle">
          <span className="flex items-center gap-2">
            <Image src="/icons/icon-192.png" alt="" width={18} height={18} className="rounded-[5px]" />
            FORGE HUD · Warrior OS
          </span>
          <span className="font-mono">Tokens: src/app/globals.css · Kit: src/components/ui</span>
        </footer>
      </main>
    </div>
  );
}
