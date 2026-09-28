# Warrior OS design system: FORGE HUD

A premium sci-fi command center lit by forge-fire. Precise, cold machine UI (**Plasma** cyan) plus warm warrior energy (**Ember** orange) on calm **deep-ink** surfaces. The bar is the restraint and craft of Linear, Raycast and Vercel, with the HUD language of Destiny 2, Halo Infinite menus and JARVIS. It should never read as "neon everywhere".

| Reference | Where |
| --- | --- |
| Tokens, utilities, base styles (**source of truth**) | `src/app/globals.css` |
| The same values for JS (canvas, charts, framer-motion) | `src/styles/tokens.ts` |
| UI kit | `import { … } from '@/components/ui'` |
| Live gallery of every component and token | `/design-system` (dev server) |
| App glyphs and hues | `src/data/app-icons.ts`, `<AppIcon />` |
| Runtime accent and glass opacity | `src/components/os/ThemeSync.tsx` |
| Default wallpaper ("Deep Space") | `src/components/wallpapers/VoidMinimal.tsx`, `src/styles/deep-space.css` |

---

## 1. The ten rules

1. **Tokens only.** Components never contain hex, `rgb()`, Tailwind palette colors (`cyan-400`, `white/10`, `gray-500`, …) or arbitrary color values (`bg-[#0a0a0f]`). Use the utilities in §4, or `var(--color-…)` when a CSS variable is unavoidable.
2. **Calm canvas, loud moments.** About 90% of any screen is quiet ink, hairlines and legible text. Glow, gradients and motion are reserved for focus, live status, the primary action, and achievements or level-ups.
3. **One accent per surface.** `accent` means the machine: interaction, focus, selection, info. `ember` means warrior energy only: streaks, XP, fire, achievements, "forge" actions. Never put two competing CTAs on one surface.
4. **Hierarchy comes from type, weight, color (`fg` → `fg-muted` → `fg-subtle`) and spacing,** not from nested boxes. Use at most **two levels of bordered containers** (window → card).
5. **4px grid.** Radii: control 8, card 12, window 16, sheet 20, pill `rounded-full`. Every border is a 1px hairline.
6. **Every screen has designed empty, loading and error states.** Use `<EmptyState>` and `<Skeleton>`. Raw "Loading…" or "No data" text is never acceptable.
7. **Craft is required, not optional.** That means: `tabular` numbers, truncation with a `title` attribute, a visible focus ring, and hover / active / disabled styles on every interactive element. Hit targets are at least 32px (28px in dense toolbars). No layout shift.
8. **Icons are lucide-react only** in UI chrome: 16px in controls, 18px in nav, `strokeWidth={1.75}`. Emoji appear only as user content (the emoji a user chose for a habit or deck). Apps are always shown with `<AppIcon>`.
9. **Motion runs at 120ms (hover), 180ms (small transitions) and 260ms (panels and windows)** on `ease-out-quint`. Nothing bounces. Honor reduced motion and lite mode.
10. **Accessibility:** body text contrast is at least 4.5:1. `fg-subtle` is only for secondary text at 12px or larger. Focus ring is 2px accent with a 2px offset. Icon-only buttons need an `aria-label`.

---

## 2. Principles in practice

- **Default to quiet.** Start every screen with ink, `text-fg` / `text-fg-muted`, `border-line` and spacing. Add accent only where the user acts or where something is live.
- **One primary action per surface.** It goes on the right side of the header or toolbar as `<Button variant="primary">`. Everything else is `secondary` or `ghost`.
- **Ember is earned.** Use it for streak counters, XP gains, "Forge it" moments, achievement toasts and habit fire. A settings page has no ember. A calculator has no ember.
- **Group without boxing.** Separate sections with 24px of space and a `SectionHeader`, not another bordered panel. Inside a card, group with spacing, `divide-y divide-line`, or an unbordered `bg-surface-2` well.
- **Write like an instrument panel.** Use short sentence-case labels ("New deck", "Delete note") and data in mono. Uppercase only appears through `hud-label` / `Badge`.

---

## 3. Using the tokens

All tokens are Tailwind v4 theme variables, so each one works with every color utility: `bg-*`, `text-*`, `border-*`, `ring-*`, `outline-*`, `divide-*`, `fill-*`, `stroke-*`, `from-*` / `to-*`, `placeholder-*`, `caret-*` and `accent-*`. Opacity modifiers work too (`bg-accent/15`, `border-ember-500/30`). Every value is also a CSS variable on `:root` (`var(--color-ink-900)`, `var(--radius-card)`, `var(--shadow-e2)`, …) for inline styles and SVG.

For canvas, WebGL and recharts props, import the mirrors from `@/styles/tokens`: `INK`, `FG`, `LINE`, `PLASMA`, `EMBER`, `STATUS`, `VIZ`, `CHART`, `TRANSITION`, `readAccent()`.

**Kit components are styled through props, not `className` overrides.** `cn()` (`@/lib/utils`) is plain `clsx`, with no tailwind-merge. When a kit component's own `p-4` and your `p-2` both land on an element, the one that appears later *in the stylesheet* wins, not the one later in the class string, so the result is effectively random. Use the component's props (`size`, `variant`, `tone`, `padding`, `density`, `bodyClassName`, …). For anything else, wrap the component in your own element. Passing `className` is fine for things the component doesn't set itself: layout (`w-full`, `col-span-2`, `mt-6`, `min-w-0`), positioning, and `@container`.

---

## 4. Color

### Ink: solid surfaces (darkest → lightest)

| Token | Value | Use |
| --- | --- | --- |
| `ink-950` | `#04060b` | Page canvas, behind everything; text on bright fills (`text-ink-950`) |
| `ink-900` | `#070a12` | Solid app background, lite-mode glass fallback |
| `ink-850` | `#0b1019` | Wells: code blocks, terminal, editor gutters, input fields |
| `ink-800` | `#0f1520` | Raised solid blocks: AppIcon tiles, avatar backs, kbd |
| `ink-750` | `#141b28` | Hover on solid blocks |
| `ink-700` | `#1a2332` | Tracks (progress, slider), skeleton base |
| `ink-600` | `#243044` | Strong solid dividers, scrollbar thumbs, disabled fills |
| `ink-500` | `#33415a` | Highest solid step: switch-off knob track, chart "rest" series |

### Foreground

| Token | Value | Use |
| --- | --- | --- |
| `fg` | `#e6edf7` | Primary text, titles, values, active icons |
| `fg-muted` | `#a0adc2` | Body copy in windows, secondary labels, inactive icons |
| `fg-subtle` | `#6f7d94` | Meta, captions, placeholders, HUD labels (≥ 12px only; 4.7:1 on ink) |
| `fg-faint` | `#4a566b` | Disabled text, decorative glyphs, separators like `·`. **Never for readable text.** |

### Hairlines

| Token | Value | Use |
| --- | --- | --- |
| `line` | `rgb(148 170 205 / .10)` | Default 1px borders, dividers, chart gridlines |
| `line-strong` | `rgb(148 170 205 / .18)` | Window/popover edges, input borders, hover borders |

### Translucent surfaces

| Token | Value | Use |
| --- | --- | --- |
| `surface` | `rgb(9 13 21 / .86)`* | Window glass (use the `glass-window` material) |
| `surface-2` | `rgb(255 255 255 / .025)` | Cards inside windows (use `glass-panel`), unbordered wells |
| `surface-3` | `rgb(13 18 28 / .94)` | Menus, popovers, tooltips (use `glass-popover`) |
| `surface-hover` | `rgb(255 255 255 / .045)` | Hover fill for rows, ghost buttons, nav items |
| `surface-active` | `rgb(255 255 255 / .07)` | Pressed fill, neutral "on" state |

\* `surface` follows **Settings → Glass Opacity**. ThemeSync maps the slider (0.3–0.9) to alpha 0.74–0.98, so the default of 0.6 gives 0.86: legible glass with the blur still reading through. Decay stage 2 adds +0.05.

### Accent: the live, user-chosen color

| Token | Value | Use |
| --- | --- | --- |
| `accent` | `var(--accent)` (default Plasma `#2fd6f5`) | Primary buttons, focus, selection, links, active nav, live indicators |
| `accent-soft` | accent at 14% | Selected/active backgrounds (nav item, chip, row) |
| `accent-fg` | `#03131a` | Text and icons **on** an accent fill (`bg-accent text-accent-fg`) |

- The accent comes from Settings (or the active workspace). **ThemeSync** writes it into `--accent-primary` on `<html>`, and `--accent` reads that. Decay stage 3 temporarily warms it toward ember. Never hard-code the cyan.
- Tints use opacity modifiers: `bg-accent/10`, `border-accent/30`, `ring-accent/25`, `text-accent`.
- Accent utilities resolve per element (`@theme inline`), so a subtree can be re-tinted with `style={{ '--accent': hue } as React.CSSProperties}`. Use this for **previews** (accent swatches, workspace cards, an AppIcon hue). Don't re-tint whole apps: apps use the user's accent.
- Settings offers `ACCENT_PRESETS` from `@/styles/tokens` (the viz palette, Plasma first). Stored legacy values (`#00f0ff`, the old swatches) are mapped onto the palette by `resolveAccent()`. Use `resolveAccent(ws.accentColor)` wherever a stored accent is painted directly (workspace dots, previews).

### Plasma and Ember

| Plasma | Value | Ember | Value |
| --- | --- | --- | --- |
| `plasma-300` | `#7ce7fb` | `ember-300` | `#ffb27a` |
| `plasma-400` | `#2fd6f5` | `ember-400` | `#ff8a3d` |
| `plasma-500` | `#10b8d8` | `ember-500` | `#f76b15` |
| `plasma-600` | `#0b8fad` | `ember-600` | `#d4520b` |

- **Plasma** is the brand's machine color. In UI, prefer `accent` (it *is* Plasma by default, and it respects the user's choice). Reach for fixed `plasma-*` only where something must stay Plasma regardless of the setting (the logo, NEXUS identity, boot sequence).
- **Ember** is warrior energy. Text and icons use `ember-400`. Fills and gradients use `ember-500` (`bg-linear-to-b from-ember-400 to-ember-500 text-ink-950`, the kit's `variant="ember"`). Soft tints use `bg-ember-500/12 border-ember-500/30`. Hover glow uses `shadow-[0_0_24px_-4px_var(--color-ember-500)]`.

### Status

| Token | Value | Use |
| --- | --- | --- |
| `success` | `#3ddc97` | Done, saved, online, correct answer |
| `warning` | `#f5c04a` | Needs attention, due soon |
| `danger` | `#ff5470` | Errors, destructive actions, wrong answer, overdue |
| `info` | `#6aa8ff` | Neutral notices, tips |
| `gold` | `#f5c04a` | XP, levels, rewards (same hue as warning, different meaning) |

Status colors go on text, icons, dots, and soft fills (`bg-success/12 text-success`). They are never used for large solid panels. Always pair a status color with an icon or label, never color alone.

### Data viz: eight named hues, one series order

The slot number is the hue's **name**, not its position in a chart. `viz-4` is always mint and `viz-5` is always rose, so a mark with one fixed meaning, like a calendar category or a room accent, picks its slot directly (`bg-viz-4`, `VIZ[3]`). That meaning stays with the slot: mint reads success-ish and rose reads alert-ish.

| `viz-1` | `viz-2` | `viz-3` | `viz-4` | `viz-5` | `viz-6` | `viz-7` | `viz-8` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `#2fd6f5` plasma | `#ff8a3d` ember | `#a78bfa` violet | `#3ddc97` mint | `#ff6b8a` rose | `#6aa8ff` azure | `#f5c04a` amber (same hex as `gold`) | `#b8e068` lime |

**Multi-series charts use the series order**: `vizColor(i)` / `VIZ_SERIES[i]` in JS, `series-1`…`series-8` in CSS (`bg-series-3`, `var(--color-series-3)`):

| series | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| hue | plasma | ember | violet | amber | mint | azure | rose | lime |
| token | `viz-1` | `viz-2` | `viz-3` | `viz-7` | `viz-4` | `viz-6` | `viz-5` | `viz-8` |

The order is an accessibility decision, so don't rearrange it:

- The brand hues come first, then the rest are arranged so that neighbors stay distinct for color-blind readers. We checked this with the dataviz palette validator (Machado 2009 protan/deutan simulation, OKLab ΔE) on `ink-900`, `ink-850` and `ink-800`. The worst adjacent CVD ΔE is 8.2 (amber and mint; the target is at least 8), the worst normal-vision ΔE is 19.3 (the floor is 15), and every hue has at least 3:1 contrast.
- **Rose never sits next to mint.** They collapse under deuteranopia (ΔE 6.7). The old slot order put them side by side, and put amber next to lime (ΔE 2.8).
- Stop at 8 series. Fold the rest into "Other" (`fg-subtle`) instead of wrapping. Scatter, bubble and small-multiple charts, where any two marks can touch, carry at most **3** series (plasma, ember, violet pass all-pairs; amber and ember don't).
- The hues are brighter than the generic dark-mode band (OKLCH L 0.71–0.85 against 0.48–0.67). That's a deliberate choice for the neon-on-ink brand, so charts use the relief rules in §13: thin marks, a legend for 2+ series and direct labels. Identity is never carried by color alone.

See §13 for chart rules.

---

## 5. Typography

### Families

| Utility | Font | Use |
| --- | --- | --- |
| `font-sans` (default) | Inter | All UI text: titles, body, buttons, inputs |
| `font-mono` | JetBrains Mono | Data, numbers in tables, code, paths, timestamps, HUD labels, keys |
| `font-display` | Orbitron | **Only** big numbers (clock, stat values, XP, level), hero titles, the logo. Never body text, buttons, nav or labels. |

### Scale

| Utility | Size / line-height | Role |
| --- | --- | --- |
| `text-2xs` | 11 / 16 | HUD labels (via `hud-label`), axis ticks, tiny meta |
| `text-xs` | 12 / 16 | Meta, captions, badges, timestamps, small buttons |
| `text-ui` | 13 / 20 | **Default text inside windows**: list rows, form labels, buttons (md), menus |
| `text-sm` | 14 / 22 | Comfortable body, inputs, dialog copy, section titles |
| `text-base` | 16 / 24 | Reading text (notes, articles, chat), empty-state titles |
| `text-lg` | 18 / 26 | App/window titles (`AppHeader`), card hero values |
| `text-xl` | 22 / 28 | Page titles, dialog hero titles |
| `text-2xl` | 28 / 34 | Stat values (`font-display`), hero titles |
| `text-3xl` | 40 / 44 | Display numbers (timer, level) |
| `text-4xl`–`text-7xl` | 48/52 · 56/60 · 64/68 · 76/80 | Display only: lock clock, level-up, achievement moments |

Sizes from `text-xl` up have slight negative tracking built in. An explicit `tracking-*` utility overrides it (Orbitron in uppercase reads best at `tracking-[0.08em]`).

**Weights:** 400 for body, 500 for labels, buttons and nav, 600 for titles and values. Avoid 700 or heavier outside `font-display` numbers.

**Roles in practice**

| Role | Classes |
| --- | --- |
| App title | `text-lg font-semibold text-fg` (via `AppHeader`) |
| Section title | `text-sm font-semibold text-fg` (via `SectionHeader`) |
| Eyebrow / subtitle / field group | `hud-label` |
| Body in a window | `text-ui text-fg-muted` (titles of rows: `text-ui font-medium text-fg`) |
| Long-form reading | `text-sm` or `text-base`, `text-fg-muted`, `max-w-prose`, `select-text` |
| Meta | `text-xs text-fg-subtle` |
| Stat value | `font-display text-2xl tabular text-fg` (via `StatTile`) |
| Code / data | `font-mono text-ui` (tables: `font-mono text-xs tabular`) |

**HUD label** (`hud-label`): 11px JetBrains Mono, weight 500, uppercase, 0.14em tracking, `fg-subtle`. Recolor it with a text utility (`hud-label text-accent`). It's for eyebrows, table headers, stat labels and group headings. Never use it for sentences.

**Numbers:** anything that updates in place or sits in a column gets `tabular` (clocks, timers, counters, prices, scores).

**Text rules:** use sentence case everywhere except `hud-label` and `Badge`. Truncate single-line labels with `truncate` plus `title={fullText}`. Keep reading text at 72ch or less. No text in `fg-faint` unless it's disabled. The OS sets `user-select: none` globally, so add `select-text` to content people copy (notes, answers, code, chat).

---

## 6. Spacing and sizing (4px grid)

| Thing | Value |
| --- | --- |
| Window body padding | 20px `p-5` (AppLayout's default) |
| Between sections | 24px `space-y-6` / `gap-6` |
| Card padding | 16px `p-4` (dense cards: `p-3`) |
| Inside a card (stack) | 12px `gap-3`; label → value 4px `gap-1` |
| Tile / card grids | 12px `gap-3` (dense) or 16px `gap-4` |
| Icon ↔ label | 8px `gap-2` (small controls `gap-1.5`) |
| Control heights | sm 28 `h-7` · md 32 `h-8` · lg 40 `h-10` |
| Toolbar / list row | 40px |
| Sidebar | 200–232px (AppLayout default 216) |
| Hit targets | ≥ 32px; 28px only in dense toolbars |

**Windows are resizable, so layouts respond to the window, not the viewport.** Put `@container` on the app's content root (`<AppLayout bodyClassName="@container">`) and use container variants (`@md:grid-cols-2 @3xl:grid-cols-4`). Viewport breakpoints (`md:`, `lg:`) are only for full-screen shell surfaces.

---

## 7. Radii

| Utility | Value | Use |
| --- | --- | --- |
| `rounded-control` | 8px | Buttons, inputs, selects, chips, menu items, nav items, segmented controls |
| `rounded-card` | 12px | Cards, panels, popovers, menus, toasts, tooltips (tooltips may use `rounded-control`) |
| `rounded-window` | 16px | Windows, desktop widgets, taskbar island |
| `rounded-sheet` | 20px | Dialogs, sheets, start menu, command palette |
| `rounded-full` | pill | Badges, avatars, dots, switches, progress tracks |
| AppIcon | `rounded-[28%]` | App tiles only (built into `<AppIcon>`) |

Nested corners: inner radius = outer radius − padding. For example, an 8px control inside a 12px card with 4px padding.

---

## 8. Materials and elevation

Each material carries its own elevation. Add a `shadow-*` utility only to change it. Standard `border-*`, `bg-*` and `shadow-*` utilities override a material's defaults.

| Material | Background | Blur | Border | Shadow | Use |
| --- | --- | --- | --- | --- | --- |
| `glass-window` | `surface` | 16px, saturate 1.4 | 1px `line-strong` | `e3` + top highlight | Windows, taskbar, desktop widgets: **anything sitting on the wallpaper** |
| `glass-popover` | `surface-3` | 16px | 1px `line-strong` | `e2` + top highlight | Menus, popovers, tooltips, command palette, start menu, notifications, toasts |
| `glass-panel` | `surface-2` | none | 1px `line` | `e1` + faint highlight | Cards **inside** a window (never directly on the wallpaper) |

| Shadow | Use |
| --- | --- |
| `shadow-e1` | Cards, raised tiles |
| `shadow-e2` | Popovers, menus, toasts, dragged items |
| `shadow-e3` | Windows, dialogs |
| `shadow-glow` | The focused or active accent thing: primary button hover, the focused window's edge, a live indicator. At most one per surface. |

**Stacking:** wallpaper → `glass-window` → `glass-panel` → content. A third bordered level is a smell: use spacing, `divide-line` or an unbordered `bg-surface-2` well instead.

**Lite mode** (`html[data-lite-mode]`: low-end devices, reduced motion, or chosen in Settings) turns off backdrop blur everywhere. The glass materials switch to solid ink automatically. For custom surfaces, use the `lite:` variant: `lite:bg-ink-900`. The same solid fallback applies under `prefers-reduced-transparency` and in browsers without `backdrop-filter`.

Never stack blurs (a blurred panel inside a blurred window). `glass-panel` has no blur on purpose.

---

## 9. Motion

| Duration | Utility | Use |
| --- | --- | --- |
| 120ms | `duration-120` | Hover and press color changes |
| 180ms | `duration-180` | Small transitions: toggles, tabs, tooltips, menus, list reorders |
| 260ms | `duration-260` | Panels, windows, dialogs, sheets, page switches |

- **Easing:** `ease-out-quint` (`cubic-bezier(0.16, 1, 0.3, 1)`) for everything that enters or moves. Exits are faster (120–180ms). No spring overshoot or bounce in chrome.
- **Transition specific properties,** for example `transition-colors duration-120 ease-out-quint` or `transition-[opacity,transform] duration-180 ease-out-quint`. Never `transition-all duration-300`.
- **framer-motion:** `import { TRANSITION, EASE_OUT_QUINT } from '@/styles/tokens'`, then `transition={TRANSITION.panel}`. The standard entrance is `initial={{ opacity: 0, y: 6 }}` (or `scale: 0.97`) → `animate={{ opacity: 1, y: 0 }}`.
- **CSS entrances:** `animate-fade-in` (180ms), `animate-rise-in` (260ms, 6px up), `animate-scale-in` (180ms from 0.97). Loading uses `animate-shimmer` (skeletons) and `animate-spin` (spinners). A live status dot uses `animate-pulse-soft`.
- **Reduced motion:** the base layer makes CSS transitions instant and settles CSS animations on their last frame. Spinners (`animate-spin`, `[data-motion="essential"]`) keep turning. framer-motion is JS, so check `useReducedMotion()` and drop transforms (keep opacity).
- **Lite mode:** no decorative loops, no parallax, no particles, no animated gradients. Legacy loops (`animate-pulse-glow`, `animate-breathe`, `animate-float`, …) already rest under lite mode.
- Motion carries meaning: it shows where something came from, what changed, or that something is alive. Glow pulses are for live status only (recording, timer running, online).

---

## 10. Focus, states and accessibility

- **Focus ring:** every focusable element gets a 2px accent outline with a 2px offset on `:focus-visible` automatically (base layer). Text fields get a hugging ring. Use `focus-ring` on custom focusables (`div role="button"`, cards with `tabIndex={0}`) and `focus-ring-inset` inside `overflow-hidden` containers (rows, tabs in a scroller). Never write `outline-none` without a replacement. Script-focused containers (`tabIndex={-1}`) don't show a ring.
- **Interactive states** (every clickable thing):

| State | Treatment |
| --- | --- |
| Hover | `hover:bg-surface-hover` and/or `hover:text-fg`; borders `hover:border-line-strong` |
| Pressed | `active:bg-surface-active` (primary: `active:brightness-95`) |
| Selected / current | `bg-accent-soft text-accent` + 2px accent indicator (nav, rows); `aria-current` / `aria-selected` |
| Disabled | `disabled:opacity-45 disabled:pointer-events-none`, plus `aria-disabled` on non-buttons |
| Loading | Spinner inside the button (`loading` prop), `Skeleton` for content |
| Error | `text-danger` message under the field + `border-danger/50`; `aria-invalid` |

- Icon-only buttons use `<IconButton icon={…} aria-label="…" tooltip />`.
- Color is never the only signal: pair status colors with an icon, label or shape.
- Dialogs trap focus and return it on close (the kit's `Dialog` does this).

---

## 11. Icons

- **lucide-react only** in chrome. Sizes: 14 (badges, dense meta), **16 (controls, buttons, rows)**, **18 (sidebar nav, app header)**, 20–24 (empty states, stat tiles), 28–32 (hero). Always `strokeWidth={1.75}`.
- Icons inherit `currentColor`: color the parent (`text-fg-muted`, `group-hover:text-fg`). Decorative icons get `aria-hidden`.
- **Emoji are user content only** (the emoji someone picked for a habit, deck or note). Never use them in nav, tabs, buttons, headings, empty states or toasts.
- **Apps are always `<AppIcon appId={id} size={…} />`**: a rounded-[28%] ink tile with a hairline edge, an inner highlight, and the app's lucide glyph in its family hue (Learn: plasma/violet · Build: mint/lime/steel/ember · Discipline: ember/gold · Life: azure/rose/lavender · System: plasma/steel). Pass `active` for running apps, or wrap it in a `.group` for hover glow. Never draw letter tiles or emoji tiles. `getAppHue(appId)` from `@/data/app-icons` gives the hue for matching accents (window title, palette row).

---

## 12. Layout patterns

### App frame

```tsx
import { AppLayout, SidebarNav, AppHeader, Button } from '@/components/ui';
import { NotebookPen, Star, Trash2, Plus } from 'lucide-react';

<AppLayout
  sidebar={
    <SidebarNav
      value={view}
      onChange={setView}
      sections={[{ items: [
        { id: 'all', label: 'All notes', icon: NotebookPen, count: 12 },
        { id: 'starred', label: 'Starred', icon: Star },
        { id: 'trash', label: 'Trash', icon: Trash2 },
      ] }]}
    />
  }
  header={
    <AppHeader
      title="Notes"
      subtitle="12 notes · synced"
      actions={<Button variant="primary" size="sm" leadingIcon={Plus}>New note</Button>}
    />
  }
  bodyClassName="@container"
>
  {/* body: 20px padding, sections 24px apart */}
</AppLayout>
```

- Sidebar (200–232px) holds nav items with a lucide icon and a label. The active item is `accent-soft` + accent text + a 2px accent indicator (built in). Put counts on the right and keep section labels as `hud-label`.
- The header row has the title (`text-lg` semibold), a `hud-label`-style subtitle, and actions on the right: one primary, the rest `ghost` icon buttons.
- Small apps (Calculator, Weather) skip the sidebar but keep the header rhythm and 20px padding.

### Toolbar

`<Toolbar>` is a 40px bar with a hairline edge. Group controls, separate groups with `<ToolbarSeparator/>`, and push trailing items right with `<ToolbarSpacer/>`. Use `size="sm"` controls (28px). Search goes left (`<SearchField>`), view switches in the middle (`<SegmentedControl size="sm">`), and the primary action on the right.

### Cards and sections

- `<Card eyebrow="This week" title="Focus time" actions={…}>`: `glass-panel rounded-card p-4`. Use `tone="ember"` only for warrior-energy cards and `hud` for corner brackets (sparingly: one hero card per screen).
- `<SectionHeader title="Recent decks" description="…" actions={…} />` above a group of cards. Don't wrap sections in bordered panels.
- Clickable cards: `interactive` (hover lift is a border/fill change, not a scale jump) and a real `<button>`/`<a>`, or `role="button"` with `tabIndex={0}` plus `focus-ring`.

### Stat tiles

`<StatTile label="Streak" value={9} unit="days" delta={+2} icon={Flame} tone="ember" />`: a hud-label, a `font-display` tabular value, and a delta chip (green up, red down; `deltaTone="inverse"` when lower is better). Lay them out in a grid: `grid grid-cols-2 gap-3 @2xl:grid-cols-4`. Add a `<Sparkline>` only when the trend matters.

The value `tone` is `default`, `accent`, `ember` or `gold` for hero tiles. When the number itself is a status, use `success`, `warning` or `danger`, for example `tone={due > 0 ? 'danger' : 'success'}` on a "Due now" tile. Keep the label and icon so the color isn't the only signal, and don't recolor the value with descendant selectors.

### Lists and tables

- `<ListRow>` rows are 40px (`density` compact 32 / comfortable 48) with a leading icon or AppIcon, title + description, `meta` in mono, and trailing actions (`revealTrailing` shows them on hover). Put rows in `divide-y divide-line`.
- Tables: a header row with `hud-label` cells, 40px body rows, `border-b border-line` dividers, `hover:bg-surface-hover`, numbers right-aligned with `font-mono tabular`, and truncated text with `title`. There is no zebra striping, and no vertical borders.
- Selection uses `bg-accent-soft` + a 2px accent indicator on the leading edge.

### Forms

- Use `Input`, `Textarea`, `Select`, `SearchField`, `Checkbox`, `Radio` / `RadioGroup`, `Switch`, `Slider` and `SegmentedControl` from the kit. Each takes `label`, `hint` and `error`. Custom controls wrap themselves in `<FieldShell>`.
- **Field width.** `Input`, `Textarea` and `Select` fill their container by default. To narrow one, put a width class on the wrapper (`wrapperClassName="w-48"` or `w-[220px]`), which replaces the default `w-full`. Use `fullWidth={false}` to size the field to its content, for example a `Select` as wide as its longest option in a toolbar. `max-w-*`, `flex-1` and spacing classes still combine with the default full width.
- **Removable chips.** `<Chip onRemove={…} removeLabel="Remove tag Algorithms">Algorithms</Chip>`: name what the × removes. The default label is a bare "Remove", which is ambiguous in a row of chips.
- Put labels above fields (`text-ui` medium). Hints go below in `text-xs text-fg-subtle`, and errors replace hints in `text-danger`. Field groups are 16px apart; related fields sit side by side in a `grid @md:grid-cols-2 gap-4`.
- Settings-style rows: `<Switch layout="row" label="…" description="…" />`, rows separated by `divide-y divide-line`.
- Submit sits at the bottom right (primary) with a `secondary` Cancel on its left.

### Dialogs, menus, popovers, tooltips

- `<Dialog open onClose title description footer size>`: a `glass-window`-weight sheet with `rounded-sheet`, a dimmed backdrop and trapped focus. The footer is right-aligned: `secondary` Cancel, then the primary. Destructive actions use `<ConfirmDialog tone="danger" … />` and name the consequence ("Its 48 cards go too.").
- `<Menu trigger={…} items={[…]} />` for overflow and context actions. Items can have an icon, a `shortcut`, `danger`, `divider` and `heading`.
- `<Tooltip content="Rename" shortcut="F2">` for icon buttons and truncated text. Keep tooltips to one line.
- Custom popovers use `glass-popover rounded-card p-2` + `animate-scale-in`.

### Empty, loading and error states

Every list, board, chart and detail pane handles all three:

```tsx
<EmptyState icon={NotebookPen} title="No notes yet"
  description="Capture your first idea. It saves as you type."
  actions={<Button variant="primary" leadingIcon={Plus}>New note</Button>} />

<Skeleton lines={3} />               {/* loading: match the shape of what's coming */}

<EmptyState tone="danger" icon={TriangleAlert} title="Couldn't load the forecast"
  description="Check your connection and try again."
  actions={<Button leadingIcon={RotateCw} onClick={retry}>Retry</Button>} />
```

Each state is one lucide icon, a title, one line of text and at most one or two actions. Use `size="sm"` inside cards and charts. No emoji, no raw strings.

### Choosing navigation

| Need | Use |
| --- | --- |
| The app's top-level areas (3+ views) | `SidebarNav` |
| Sibling views of one thing (Overview / History / Settings) | `Tabs` (underline, in the header's `tabs` slot) |
| Switching the *representation* of the same data (List / Grid, Week / Month) | `SegmentedControl` |
| Filters | `Chip` (selectable) |

### Shell surfaces (taskbar, start menu, palette, notifications, widgets)

- The taskbar and desktop widgets are `glass-window`. The start menu and command palette are `glass-popover rounded-sheet`. Notifications and toasts are `glass-popover rounded-card`.
- Desktop icons are `<AppIcon size={48…56}>` with a `text-xs text-fg` label under a subtle text shadow for legibility over the wallpaper. Selection is a `bg-surface-active` tile.
- Clocks and counters use `tabular`. Big clocks use `font-display`.
- **Celebrations must not hijack the OS.** Common and uncommon achievements show the compact **achievement toast**: a medallion, "Achievement unlocked", the title, the rarity and the XP in gold on `glass-popover`. It sits bottom-center above the workspace pill in the toast layer and dismisses itself after 5 s. Rare, epic and legendary achievements get the full-screen cinematic, and level-ups keep their effect. The cinematic and its confetti sit below the start menu, palette, menus, notifications and dialogs, and never take a click except on the medallion (click it or press Esc to skip). Every unlock is still filed in the notification center.
- The default wallpaper is **Deep Space** (CSS-only; id `void`). It is what lite mode, no-GPU and headless visitors see. Keep shell surfaces legible on it and on the shader wallpapers.

---

## 13. Charts

- **Series colors** take `vizColor(0)`, `vizColor(1)`, … (`VIZ_SERIES`, CSS `series-1`…`series-8`), which follows the color-blind-safe order in §4. Don't use raw `VIZ[i]` for series i: the slots are hue names, and slot order would put rose next to mint. A single metric with a fixed meaning may use its semantic color instead (XP → `gold`, streak → `ember-400`, errors → `danger`). Don't use `accent` for data series: charts must not change when the user picks a new accent.
- **Series identity is never color alone.** With 2+ series, show a legend and direct-label up to four of them. Keep a 2px surface gap between touching fills (stacked segments, adjacent bars, donut slices).
- **Gridlines** are horizontal only, 1px `line` (`CHART.grid`). No vertical grid and no chart border box.
- **Axes** have no axis lines and no tick marks. Tick labels are 11px mono `fg-subtle` (`CHART.tick`). Wrap the chart in a `font-mono` element so SVG text inherits JetBrains Mono.
- **Tooltips** use `glass-popover rounded-control px-3 py-2 text-xs`: a `hud-label` title, rows of 8px swatch · name (`fg-muted`) · value (`tabular text-fg`).
- **Marks:** lines are 2px with round joins, and dots are hidden until hover (`activeDot` r=4, stroke `INK[950]` 2px). Areas fill from the series color at `CHART.areaOpacity` (0.22) to 0. Bars get 4px top radius, max 28px width, with a 25–40% category gap.
- **Legends** only appear for 2+ series: top-right, `text-xs text-fg-muted`, 8px round swatches.
- **Empty or loading** charts use `<EmptyState size="sm">` or a `Skeleton shape="block"` at the chart's height (no layout shift).
- **Numbers** in charts use `tabular` and are formatted (`1.2k`, `3h 20m`).

```tsx
import { useId } from 'react';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { VIZ, CHART, INK } from '@/styles/tokens';

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-popover rounded-control px-3 py-2 text-xs">
      <div className="hud-label mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-fg-muted">{p.name}</span>
          <span className="ml-auto pl-3 tabular text-fg">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function FocusChart({ data }: { data: { day: string; minutes: number }[] }) {
  const fill = useId(); // unique gradient id per chart
  return (
    <div className="h-48 font-mono">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={VIZ[0]} stopOpacity={CHART.areaOpacity} />
              <stop offset="100%" stopColor={VIZ[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="day" tick={CHART.tick} axisLine={false} tickLine={false} />
          <YAxis tick={CHART.tick} axisLine={false} tickLine={false} width={40} />
          <Tooltip cursor={{ stroke: CHART.cursor }} content={<ChartTooltip />} />
          <Area type="monotone" dataKey="minutes" name="Focus" stroke={VIZ[0]} strokeWidth={CHART.strokeWidth}
                fill={`url(#${fill})`} activeDot={{ r: 4, stroke: INK[950], strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

(Use recharts' own tooltip prop type in real code rather than `any`.) Canvas and SVG visualizations (Algo Lab, Memory Palace overlays) follow the same palette. Pass hex values from `tokens.ts` to canvas, and use `readAccent()` when a canvas must follow the live accent.

---

## 14. HUD flourishes (use sparingly)

| Flourish | How | When |
| --- | --- | --- |
| Corner brackets | `hud-corners` (tune with `--hud-corner-color`, `--hud-corner-size`, `--hud-corner-inset`) | One hero element per screen: the active stat panel, a boss card, a live session |
| HUD label | `hud-label` | Eyebrows, table heads, stat labels |
| Accent glow | `shadow-glow` | The one focused/primary/live thing |
| Ember gradient | Button `variant="ember"`, `Card tone="ember"` | Streaks, XP, forge actions |
| Grid texture | `EmptyState` (built in) | Empty states only |

`hud-corners` paints background layers. It composes with `glass-*` and `bg-*` colors, but not with `bg-linear-*` images on the same element (wrap it instead).

---

## 15. Utility reference

| Utility / variant | What it does |
| --- | --- |
| `glass-window`, `glass-popover`, `glass-panel` | Materials (§8) with lite-mode, reduced-transparency and no-blur fallbacks |
| `hud-label` | 11px mono, uppercase, 0.14em tracking, `fg-subtle` |
| `hud-corners` | Four 10px accent L-brackets, 40% alpha, 6px inside the edge |
| `focus-ring` / `focus-ring-inset` | 2px accent outline on `:focus-visible`, offset +2px / −2px |
| `tabular` | `font-variant-numeric: tabular-nums` |
| `scrollbar-thin` / `scrollbar-none` | Quiet 8px scrollbar / hidden scrollbar that still scrolls |
| `lite:` | Styles applied only in lite mode (`lite:bg-ink-900`, `lite:hidden`) |
| `ease-out-quint`, `duration-120`, `duration-180`, `duration-260` | Motion tokens |
| `animate-fade-in`, `animate-rise-in`, `animate-scale-in`, `animate-shimmer`, `animate-pulse-soft` | Theme animations |
| `shadow-e1`, `shadow-e2`, `shadow-e3`, `shadow-glow` | Elevation (§8) |
| `rounded-control`, `rounded-card`, `rounded-window`, `rounded-sheet` | Radii (§7) |
| `text-2xs`, `text-ui` | Added sizes (§5) |

CSS variables for inline styles: `--accent`, every `--color-*`, `--radius-*`, `--shadow-*`, `--ease-out-quint`, `--duration-hover|small|panel`, `--font-sans|mono|display`, and the z-index scale (`--z-wallpaper` 0, `--z-desktop` 10, `--z-window` 100, `--z-taskbar` 500, `--z-dynamic-island` 600, `--z-start-menu` 700, `--z-command-palette` 800, `--z-context-menu` 850, `--z-notification` 900, `--z-modal` 950, `--z-boot` 1000, `--z-cursor` 9999). Use the z scale; never write `z-[9999]`.

---

## 16. Do / Don't

| Do | Don't |
| --- | --- |
| `bg-accent text-accent-fg` for the one primary action | Cyan text on cyan fills, or two glowing CTAs side by side |
| Spacing and `divide-line` to group | A bordered box inside a bordered box inside a window |
| `text-fg-muted` body, `text-fg` titles | `text-white` everywhere, or grey-on-grey below 4.5:1 |
| `hud-label` for eyebrows | `font-display` / Orbitron for labels, buttons or paragraphs |
| lucide icons at 16/18px, stroke 1.75 | Emoji in nav, tabs, buttons or headings |
| `<AppIcon appId>` | Letter tiles, emoji tiles, or per-app hand-drawn icons |
| `EmptyState` / `Skeleton` / error `EmptyState` | "Loading…", "No data", blank panes |
| `tabular` on changing numbers | Jittering clocks and counters |
| `transition-colors duration-120 ease-out-quint` | `transition-all duration-500`, bouncy springs on chrome |
| `shadow-glow` on the focused thing | Neon glows, `text-glow` on body text, pulsing decorations |
| `@container` + `@md:` inside windows | `md:` / `lg:` viewport breakpoints inside app windows |
| Tokens and `var(--color-…)` | Hex, `rgba()`, `text-cyan-400`, `bg-black/60`, `bg-[#0a0a0f]` |
| Kit props (`size`, `variant`, `tone`, `padding`) or a wrapper element | `className` overrides of a kit component's padding, colors, radius or height (`cn()` has no tailwind-merge) |

---

## 17. Migration guide (legacy → FORGE HUD)

The old variables and classes still work as deprecated aliases (on-palette), so nothing breaks mid-migration. Replace them whenever you touch a file.

### Classes and ad-hoc styles

| Legacy / ad-hoc | Replace with |
| --- | --- |
| `#00f0ff`, `rgba(0,240,255,…)`, `text-cyan-*`, `border-cyan-*`, `text-accent-primary` | `text-accent`, `border-accent/30`, `bg-accent/15`, `ring-accent` |
| `bg-accent-primary/10`, `bg-cyan-500/10` | `bg-accent/10` or `bg-accent-soft` (selected states) |
| `#0a0a0f`, `#050508`, `#020204`, `#111118`, `bg-black`, `bg-[#0a0a0f]`-style page/app backgrounds | `bg-ink-950` (canvas) · `bg-ink-900` (solid app) · `bg-ink-850` (wells) |
| `bg-black/40…80` panels, `rgba(15,15,25,.85)` window glass | `glass-window` / `glass-popover` materials |
| `bg-white/5`, `bg-white/[0.03]` card fills | `glass-panel` (card) or `bg-surface-2` (unbordered well) |
| `hover:bg-white/10`, `bg-white/10` pressed | `hover:bg-surface-hover`, `active:bg-surface-active` |
| `text-white`, `text-text-primary` | `text-fg` |
| `text-white/60–80`, `text-gray-300/400`, `text-text-secondary` | `text-fg-muted` |
| `text-white/40–50`, `text-gray-500`, `text-text-muted` | `text-fg-subtle` |
| `text-white/20–30`, `text-gray-600` | `text-fg-faint` (disabled/decorative only) |
| `border-white/5`, `border-white/10`, `border-gray-800`, `border-[var(--glass-border)]` | `border-line` |
| `border-white/15–20` | `border-line-strong` |
| `divide-white/5`, `divide-white/10` | `divide-line` |
| `text-green-*`, `text-emerald-*`, `#00e676`, `accent-success` | `text-success` |
| `text-red-*`, `text-rose-*`, `#ff1744`, `#ff3d71`, `accent-danger` | `text-danger` |
| `text-yellow-*`, `text-amber-*`, `#ffab00`, `accent-warning` | `text-warning` (attention) / `text-gold` (XP, rewards) |
| `text-orange-*`, streak/fire colors | `text-ember-400` (fills `bg-ember-500`, tints `bg-ember-500/12`) |
| `text-blue-*`, `text-sky-*` | `text-info` (or `text-accent` when it's interactive) |
| `text-purple-*`, `text-violet-*`, `#7b61ff`, `accent-secondary` | `viz-3` in charts; elsewhere drop it (one accent per surface) |
| Orbitron / `font-display` on body, buttons, labels, nav | `font-sans`; labels → `hud-label` |
| `font-mono` on prose | `font-sans` (keep mono for data, code, labels) |
| `text-[10px]`, `text-[11px]` | `text-2xs` (as a label: `hud-label`) |
| `text-[13px]` | `text-ui` |
| `text-xs uppercase tracking-widest text-white/40` | `hud-label` |
| `rounded-md`, `rounded-lg`, `rounded-[var(--radius-sm)]`, `rounded-[var(--radius-md)]` on controls | `rounded-control` |
| `rounded-lg`, `rounded-xl`, `rounded-[var(--radius-lg)]` on cards | `rounded-card` |
| `rounded-xl` / `rounded-2xl` on windows, widgets, dialogs | `rounded-window` / `rounded-sheet` |
| `shadow-lg`, `shadow-xl`, `shadow-2xl` | `shadow-e1` / `shadow-e2` / `shadow-e3` |
| `shadow-[0_0_30px_rgba(0,240,255,0.3)]`, `.neon-border`, `.glass-glow` | `shadow-glow` on the one focused thing, or nothing |
| `.glass`, `.glass-dark`, `.glass-border`, `<GlassPanel>` | `glass-window` / `glass-popover` / `glass-panel`, `<Card>` |
| `.text-glow`, `.text-glow-sm`, `drop-shadow-[0_0_12px_currentColor]` on text | Remove (big display numbers may keep a subtle `text-glow-sm`) |
| `animate-pulse-glow`, `animate-breathe`, `animate-float`, `animate-hologram-flicker` on chrome | Remove; `animate-pulse-soft` for a live dot only |
| `transition-all duration-300` | `transition-colors duration-120 ease-out-quint` / specific properties |
| `<GlowButton>`, `<NeonBadge>`, `<HolographicCard>`, `<Modal>`, `<Toggle>`, `<Dropdown>` | `<Button>`, `<Badge>`, `<Card>`, `<Dialog>`, `<Switch>`, `<Select>` / `<Menu>` |
| Emoji nav/tab/button icons (📝 ⚙️ 🔥 🎯) | lucide icons (18px nav, 16px controls) |
| Letter-in-a-box or emoji app tiles | `<AppIcon appId={id} size={…} />` |
| `style={{ color: '#…', background: 'rgba(…)' }}` | Token utilities; for a dynamic color, set a variable (`style={{ '--accent': hue }}`) and use utilities |
| Raw "Loading…", "No items" text | `<Skeleton>`, `<EmptyState>` |
| `md:` / `lg:` breakpoints inside app windows | `@container` + `@md:` / `@lg:` |
| Ad-hoc `z-[9999]` | The `--z-*` scale |

### CSS variables

| Deprecated variable | Now | Use instead |
| --- | --- | --- |
| `--accent-primary` | ThemeSync's input (the stored accent) | `var(--accent)` |
| `--accent-secondary`, `--accent-tertiary` | viz-3 violet, viz-5 rose | a `--color-viz-*` in charts, otherwise drop |
| `--accent-success`, `--accent-warning`, `--accent-danger` | status colors | `var(--color-success)` … |
| `--bg-void`, `--bg-desktop` | ink-950 | `var(--color-ink-950)` |
| `--bg-surface`, `--bg-elevated` | ink-900, ink-800 | `var(--color-ink-900)`, `var(--color-ink-800)` |
| `--bg-overlay` | ink-950 at 85% | `bg-ink-950/85` |
| `--text-primary`, `--text-secondary`, `--text-muted` | fg, fg-muted, fg-subtle | `var(--color-fg)` … |
| `--glass-bg`, `--glass-border`, `--glass-blur`, `--glass-highlight` | surface, line, 20px, 4% white | the `glass-*` materials |
| `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl` | 6, 8, 12, 16px | `var(--radius-control)`, `--radius-card`, `--radius-window` |
| `--shadow-glow` | the new `shadow-glow` token | `shadow-glow` |
| `--transition-fast`, `--transition-normal`, `--transition-slow` | 120 / 180 / 260ms quint | `duration-*` + `ease-out-quint` |
| `--font-inter`, `--font-jetbrains`, `--font-orbitron` | raw next/font families | `font-sans`, `font-mono`, `font-display` |

**Values that moved** (they apply to untouched markup too): `text-sm` is now 14/22, `text-lg` 18/26, `text-xl` 22/28, `text-2xl` 28/34, `text-3xl` 40/44, and `text-4xl`–`7xl` are larger. `rounded-md` is now 8px, `rounded-lg` 12px, `rounded-xl` 16px and `rounded-2xl` 20px. The legacy utilities `bg-accent-primary`, `text-text-*`, `bg-void` and friends now render FORGE HUD colors.

---

## 18. Pre-flight checklist (before you call a screen done)

- [ ] No hex, `rgb()`, Tailwind palette colors or arbitrary colors in the diff (`rg "#[0-9a-fA-F]{3,8}|rgba?\(|(text|bg|border)-(white|black|gray|slate|cyan|sky|blue|red|green|emerald|yellow|amber|orange|purple|violet|pink|rose)" <your files>`).
- [ ] One primary action per surface. Ember appears only on warrior-energy moments.
- [ ] At most two levels of bordered containers.
- [ ] Empty, loading and error states are designed (EmptyState / Skeleton).
- [ ] Icons are lucide at 16/18px, stroke 1.75. No emoji in chrome. Apps use `<AppIcon>`.
- [ ] Orbitron appears only on big numbers, hero titles and the logo.
- [ ] Numbers are `tabular`. Truncated text has a `title`.
- [ ] Every interactive element has hover, active, focus-visible and disabled states. Icon buttons have `aria-label`.
- [ ] Transitions use 120/180/260ms with `ease-out-quint`, and nothing bounces. It still works with reduced motion and in lite mode (`--lite` screenshot).
- [ ] The layout holds from the window's minimum size to maximized (`@container` variants).
- [ ] Text contrast is at least 4.5:1, and there's no `fg-faint` on readable text.
