// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Appearance Tab (FORGED ARMOR)
// Wallpaper (painted previews in bevelled frames), background slideshow
// + shortcuts, accent color (cut swatches + custom), window glass, CRT
// scanlines and cursor trail. Wallpaper and accent are saved to the
// active workspace, which re-applies them whenever you return.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type CSSProperties } from 'react';
import { ArrowRight, Check, Feather, Plus } from 'lucide-react';
import { Badge, Button, Kbd, SegmentedControl, Slider } from '@/components/ui';
import { BEVEL_RAISED, ENGRAVED_LABEL, STEEL_PLATE } from '@/components/ui/armor';
import { cn } from '@/lib/utils';
import { SLIDESHOW_INTERVALS, useSettingsStore, type SlideshowInterval, type SlideshowOrder } from '@/stores/useSettingsStore';
import {
  NEXT_WALLPAPER_KEYS,
  PREV_WALLPAPER_KEYS,
  slideshowLabel,
  useSlideshowBlocker,
} from '@/hooks/useWallpaperSlideshow';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useLiteMode } from '@/lib/lite-mode';
import { ACCENT_PRESETS, resolveAccent } from '@/styles/tokens';
import {
  Callout,
  RowValue,
  SettingRow,
  SettingsCard,
  SettingsPage,
  SettingsSection,
  SwitchRow,
  type OpenSettingsTab,
} from './parts';
import { WALLPAPERS, WallpaperThumb, resolveWallpaper, type WallpaperOption } from './wallpapers';
import { saveLookToActiveWorkspace } from './workspace-looks';

/** '#abc' / '#aabbccdd' → '#aabbcc' for <input type="color">. */
function toColorInputValue(hex: string): string {
  if (hex.length === 4) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  if (hex.length === 5) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  return hex.slice(0, 7);
}

const accentVar = (value: string) => ({ '--accent': value }) as CSSProperties;

const INTERVAL_OPTIONS = SLIDESHOW_INTERVALS.map((m) => ({
  value: String(m),
  label: m === 0 ? 'Off' : m === 60 ? '1 h' : `${m} min`,
  'aria-label': slideshowLabel(m),
}));

const ORDER_OPTIONS: { value: SlideshowOrder; label: string }[] = [
  { value: 'order', label: 'In order' },
  { value: 'shuffle', label: 'Shuffle' },
];

function AppearanceTabInner({ onOpenTab }: { onOpenTab?: OpenSettingsTab }) {
  const wallpaper = useSettingsStore((s) => s.wallpaper);
  const accentColor = useSettingsStore((s) => s.accentColor);
  const glassOpacity = useSettingsStore((s) => s.glassOpacity);
  const crtEffect = useSettingsStore((s) => s.crtEffect);
  const cursorTrail = useSettingsStore((s) => s.cursorTrail);
  const adaptiveWallpaper = useSettingsStore((s) => s.adaptiveWallpaper);
  const slideshowInterval = useSettingsStore((s) => s.slideshowInterval);
  const slideshowOrder = useSettingsStore((s) => s.slideshowOrder);
  const slideshowBlocker = useSlideshowBlocker();
  const workspaceName = useWorkspaceStore(
    (s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.name ?? 'current'
  );
  const lite = useLiteMode();

  const activeWallpaper = resolveWallpaper(wallpaper);
  const accent = resolveAccent(accentColor);
  const preset = ACCENT_PRESETS.find((p) => p.value === accent);
  const glassPct = Math.round(glassOpacity * 100);

  const settings = useSettingsStore.getState;
  const pickWallpaper = (id: string) => {
    settings().setWallpaper(id);
    saveLookToActiveWorkspace();
  };
  const pickAccent = (value: string) => {
    settings().setAccentColor(value);
    saveLookToActiveWorkspace();
  };
  const liteBadge = lite ? <Badge size="sm">Off in lite mode</Badge> : undefined;

  return (
    <SettingsPage>
      {/* Lite mode keeps the GPU-heavy visuals off whatever is chosen here */}
      {lite && (
        <Callout
          role="note"
          data-testid="appearance-lite-note"
          icon={Feather}
          title="Lite mode is on"
          action={
            onOpenTab && (
              <Button size="sm" trailingIcon={ArrowRight} onClick={() => onOpenTab('performance')}>
                Performance settings
              </Button>
            )
          }
        >
          The wallpaper stays a still Forge Night background, and CRT scanlines and the cursor trail stay off.
          Your choices below are kept for when lite mode is off.
        </Callout>
      )}

      {/* Wallpaper */}
      <SettingsSection
        title="Wallpaper"
        description={`Live backdrops for the desktop, saved to your ${workspaceName} workspace.`}
      >
        <div role="group" aria-label="Wallpaper" className="grid grid-cols-2 gap-3 @sm:grid-cols-3 @3xl:grid-cols-4">
          {WALLPAPERS.map((w) => (
            <WallpaperTile
              key={w.id}
              option={w}
              selected={activeWallpaper === w.id}
              onSelect={() => pickWallpaper(w.id)}
            />
          ))}
        </div>
        <SettingsCard>
          <SwitchRow
            label="Adaptive wallpaper"
            ariaLabel="Adaptive Wallpaper"
            description="Follows the time of day: Starfield at dawn, Nebula, Fluid and Aurora through the day, Forge Night at night and Matrix Rain after midnight."
            checked={adaptiveWallpaper}
            onCheckedChange={() => settings().toggleAdaptiveWallpaper()}
          />
          <SettingRow
            label="Background slideshow"
            labelId="appearance-slideshow-label"
            disabled={slideshowBlocker !== null}
            description={
              slideshowBlocker === 'adaptive'
                ? 'Paused while adaptive wallpaper is on: it already changes the background by time of day. Turn adaptive off to use the slideshow.'
                : slideshowBlocker === 'lite'
                  ? 'Paused in lite mode: the desktop keeps the still Forge Night background.'
                  : slideshowInterval === 0
                    ? 'Rotate through the wallpapers on a timer. Each change is saved to this workspace.'
                    : `${slideshowLabel(slideshowInterval)}, ${slideshowOrder === 'shuffle' ? 'shuffled' : 'in order'}. Each change is saved to this workspace.`
            }
            control={
              <SegmentedControl
                size="sm"
                aria-label="Slideshow interval"
                value={String(slideshowInterval)}
                onChange={(v) => settings().setSlideshowInterval(Number(v) as SlideshowInterval)}
                options={INTERVAL_OPTIONS.map((o) => ({ ...o, disabled: slideshowBlocker !== null }))}
              />
            }
          />
          <SettingRow
            label="Slideshow order"
            disabled={slideshowBlocker !== null || slideshowInterval === 0}
            description="Step through the list, or jump to a random wallpaper each time."
            control={
              <SegmentedControl
                size="sm"
                aria-label="Slideshow order"
                value={slideshowOrder}
                onChange={(v) => settings().setSlideshowOrder(v)}
                options={ORDER_OPTIONS.map((o) => ({
                  ...o,
                  disabled: slideshowBlocker !== null || slideshowInterval === 0,
                }))}
              />
            }
          />
          <SettingRow
            label="Shortcuts"
            description="Anywhere on the desktop. Right-click the desktop and choose Change background… to browse them all."
            control={
              <div className="flex flex-col items-end gap-1.5">
                <span className="flex items-center gap-2">
                  <span className={ENGRAVED_LABEL}>Next</span>
                  <Kbd keys={NEXT_WALLPAPER_KEYS} size="sm" />
                </span>
                <span className="flex items-center gap-2">
                  <span className={ENGRAVED_LABEL}>Previous</span>
                  <Kbd keys={PREV_WALLPAPER_KEYS} size="sm" />
                </span>
              </div>
            }
          />
        </SettingsCard>
      </SettingsSection>

      {/* Accent */}
      <SettingsSection
        title="Accent color"
        description="Tints buttons, focus rings, selection and live status across Warrior OS. Changes apply instantly."
      >
        <SettingsCard>
          <div className="flex flex-col gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden
                className="size-9 shrink-0 chamfer-sm bg-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.4),inset_0_-2px_0_rgb(0_0_0/0.35)]"
              />
              <div className="min-w-0">
                <p className="truncate text-ui font-medium text-fg">{preset ? preset.label : 'Custom color'}</p>
                <p className="tabular font-mono text-xs uppercase text-fg-subtle">{accent}</p>
              </div>
            </div>
            <div role="group" aria-label="Accent color" className="flex flex-wrap items-center gap-3">
              {ACCENT_PRESETS.map((p) => {
                const selected = p.value === accent;
                return (
                  <button
                    key={p.value}
                    type="button"
                    aria-label={p.label}
                    aria-pressed={selected}
                    title={p.label}
                    onClick={() => pickAccent(p.value)}
                    style={accentVar(p.value)}
                    className={cn(
                      'flex size-8 items-center justify-center chamfer [--cut:6px] bg-accent',
                      'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-fg',
                      'transition-[box-shadow,filter] duration-180 ease-out-quint',
                      selected
                        ? 'shadow-[inset_0_0_0_2px_var(--color-ink-950),inset_0_0_0_3.5px_var(--color-fg)]'
                        : 'shadow-[inset_0_1px_0_rgb(255_255_255/0.35),inset_0_-2px_0_rgb(0_0_0/0.35)] hover:brightness-115'
                    )}
                  >
                    {selected && <Check size={14} strokeWidth={2.75} className="text-accent-fg" aria-hidden />}
                  </button>
                );
              })}
              <span aria-hidden className="mx-0.5 h-6 w-px bg-black/60 shadow-[1px_0_0_rgb(255_255_255/0.05)]" />
              <CustomSwatch value={accent} active={!preset} onChange={pickAccent} />
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* Glass & effects */}
      <SettingsSection title="Glass and effects" description="How windows sit on the wallpaper, plus the retro extras.">
        <SettingsCard>
          <SettingRow
            label="Glass opacity"
            htmlFor="appearance-glass-opacity"
            description={
              lite ? 'Windows are solid while lite mode is on.' : 'How solid windows look over the wallpaper.'
            }
            control={<RowValue>{glassPct}%</RowValue>}
          >
            <Slider
              id="appearance-glass-opacity"
              min={0.3}
              max={0.9}
              step={0.05}
              value={glassOpacity}
              onValueChange={(v) => settings().setGlassOpacity(v)}
              aria-valuetext={`${glassPct}%`}
            />
          </SettingRow>
          <SwitchRow
            label="CRT scanlines"
            ariaLabel="CRT Scanlines"
            description="Faint retro scanlines over the whole screen."
            badge={liteBadge}
            checked={crtEffect}
            onCheckedChange={() => settings().toggleCRT()}
          />
          <SwitchRow
            label="Cursor trail"
            ariaLabel="Cursor Trail"
            description="A short fading trail behind the pointer."
            badge={liteBadge}
            checked={cursorTrail}
            onCheckedChange={() => settings().toggleCursorTrail()}
          />
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}

function WallpaperTile({
  option,
  selected,
  onSelect,
}: {
  option: WallpaperOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      title={`${option.label} · ${option.hint}`}
      className={cn(
        'group relative flex min-w-0 flex-col chamfer-md p-1 text-left',
        STEEL_PLATE,
        BEVEL_RAISED,
        'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        'transition-[filter] duration-180 ease-out-quint hover:brightness-110'
      )}
    >
      <span className="relative block chamfer-sm overflow-hidden">
        <WallpaperThumb
          id={option.id}
          className={cn(
            'transition-[transform,filter] duration-260 ease-out-quint group-hover:scale-[1.04]',
            !selected && 'brightness-[0.85] group-hover:brightness-100'
          )}
        />
        {selected && (
          <span className="absolute right-0 top-0 flex h-5 items-center gap-1 bg-linear-to-b from-ember-300 to-ember-500 pl-2 pr-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-950 chamfer [--cut:0px] [--cut-bl:6px]">
            <Check size={11} strokeWidth={3} aria-hidden />
            Active
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col px-2 pb-1 pt-1.5">
        <span className={cn('truncate text-ui font-medium', selected ? 'text-fg' : 'text-fg-muted group-hover:text-fg')}>
          {option.label}
        </span>
        <span className="truncate font-mono text-2xs uppercase tracking-wide text-fg-subtle">{option.hint}</span>
      </span>
      {/* Molten edge on the current wallpaper, drawn over the art. */}
      {selected && <span aria-hidden className="ember-edge pointer-events-none absolute inset-0" />}
    </button>
  );
}

/** Any color: a native color input dressed as the last swatch. */
function CustomSwatch({ value, active, onChange }: { value: string; active: boolean; onChange: (hex: string) => void }) {
  return (
    <label
      title="Custom color"
      style={active ? accentVar(value) : undefined}
      className={cn(
        'relative flex size-8 cursor-pointer items-center justify-center chamfer [--cut:6px]',
        'transition-[box-shadow,filter] duration-180 ease-out-quint',
        'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-fg',
        active
          ? 'bg-accent shadow-[inset_0_0_0_2px_var(--color-ink-950),inset_0_0_0_3.5px_var(--color-fg)]'
          : 'hover:brightness-115'
      )}
    >
      {!active && (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'conic-gradient(var(--color-viz-1), var(--color-viz-6), var(--color-viz-3), var(--color-viz-5), var(--color-viz-2), var(--color-viz-7), var(--color-viz-8), var(--color-viz-4), var(--color-viz-1))',
          }}
        />
      )}
      <span
        aria-hidden
        className={cn(
          'relative flex items-center justify-center',
          active ? 'text-accent-fg' : 'size-6 chamfer [--cut:4px] bg-ink-900 text-fg-muted'
        )}
      >
        {active ? <Check size={14} strokeWidth={2.75} /> : <Plus size={14} strokeWidth={2} />}
      </span>
      <input
        type="color"
        aria-label="Custom accent color"
        value={toColorInputValue(value)}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  );
}

export const AppearanceTab = memo(AppearanceTabInner);
