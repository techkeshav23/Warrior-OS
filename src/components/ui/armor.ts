// ═══════════════════════════════════════════════════════════
// WARRIOR OS — FORGED ARMOR kit recipes
// Shared class strings for the kit's metal: bevels drawn as inset
// shadows (they survive clip-path, a border+radius would not), heated
// edges, sunk slots and the inside focus edge that chamfered parts need
// (clip-path eats an outside outline).
// The shapes (chamfer-*), materials (armor-*) and details (rivets,
// engraved, forge-heat…) are utilities in src/app/globals.css.
// ═══════════════════════════════════════════════════════════

/** Raised plate: light top/left edge, dark bottom/right edge. */
export const BEVEL_RAISED =
  'shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_1px_0_0_rgb(255_255_255/0.05),inset_0_-1px_0_rgb(0_0_0/0.6),inset_-1px_0_0_rgb(0_0_0/0.35)]';

/** Pressed plate: the bevel flips (the plate sinks into the frame). */
export const BEVEL_PRESSED =
  'active:shadow-[inset_0_1px_0_rgb(0_0_0/0.55),inset_0_2px_5px_rgb(0_0_0/0.35),inset_0_-1px_0_rgb(255_255_255/0.06)]';

/** Recessed slot (inputs, tracks): dark lip on top, faint light lip below. */
export const BEVEL_SUNK =
  'shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_2px_6px_rgb(0_0_0/0.45),inset_0_-1px_0_rgb(255_255_255/0.07),inset_1px_0_0_rgb(0_0_0/0.35),inset_-1px_0_0_rgb(255_255_255/0.03)]';

/** Steel plate fill (secondary buttons, chips, tabs). */
export const STEEL_PLATE =
  'bg-linear-to-b from-[#2b323c] via-[#20262e] to-[#171b21] text-fg';

/** Hotter steel for hover (heat-up). */
export const STEEL_PLATE_HOT =
  'hover:from-[#353d48] hover:via-[#29303a] hover:to-[#1c2128]';

/** Molten ember plate (primary): hot core on top, deep ember below. */
export const EMBER_PLATE =
  'bg-linear-to-b from-ember-300 via-ember-400 to-ember-600 text-[#1a0a02] ' +
  'shadow-[inset_0_1px_0_rgb(255_240_220/0.75),inset_0_-1px_0_rgb(90_25_0/0.7),inset_1px_0_0_rgb(255_220_190/0.25),inset_-1px_0_0_rgb(90_25_0/0.4)]';

/** Recessed dark slot fill (inputs, tracks, segmented wells). */
export const SLOT_FILL = 'bg-linear-to-b from-[#07090c] to-[#0e1116]';

/** Inside focus edge (chamfered parts clip an outside outline). */
export const FOCUS_EDGE =
  'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent';

/** Heated bottom edge line (active tabs, focused slots), as a class for an absolutely placed span. */
export const HEAT_LINE =
  'bg-linear-to-r from-ember-600 via-ember-400 to-ember-300 shadow-[0_0_10px_var(--color-ember-500,#f76b15)]';

/** Engraved label: display face, caps, tracked, pressed-into-metal shadow. */
export const ENGRAVED_LABEL =
  'engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-fg-subtle';
