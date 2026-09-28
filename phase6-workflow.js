export const meta = {
  name: 'warrior-phase6-godlevel',
  description: 'Build all 8 Phase-6 god-level features for Warrior OS via parallel agents, then integrate + verify build',
  phases: [
    { title: 'Recon', detail: 'Extract exact codebase conventions into a shared contract' },
    { title: 'Build', detail: 'Eight feature agents build new files in isolation, each returns an integration manifest' },
    { title: 'Integrate', detail: 'One sequential agent wires shared files (page.tsx, registry, achievements, barrels)' },
    { title: 'Verify', detail: 'Run npm run build and fix compile errors until green' },
  ],
};

const ROOT = 'c:/Users/KESHAV UPADHYAY/Desktop/warrior/warrior-os';
const TASK = 'c:/Users/KESHAV UPADHYAY/Desktop/warrior/TASK.md';

// ─── Feature definitions (each owns a disjoint set of NEW files) ───
const FEATURES = [
  {
    key: 'creature',
    title: 'Warrior Creature (digital pet)',
    specLines: '504-514 (section 6D) plus type 6.1, store 6.6',
    owns: [
      'src/types/creature.ts',
      'src/stores/useCreatureStore.ts (zustand+immer+persist, name "warrior-os-creature")',
      'src/components/creature/CreatureEngine.tsx (stage state machine: egg/baby/teen/adult/legendary/mythic at XP thresholds 0/100/500/2000/10000/50000)',
      'src/components/creature/CreatureRenderer.tsx (canvas/framer sprite that sits at taskbar right; idle/happy/sad/sleeping/dance/eating states — use emoji+CSS/framer, NOT external sprite assets)',
      'src/components/creature/CreatureEvolution.tsx (3 forms by dominant activity: Scholar Phoenix / Code Serpent / Warrior Dragon)',
      'src/components/creature/CreatureReactions.tsx (subscribes to useXPStore recentUnlock + window events)',
      'src/components/creature/CreatureStats.tsx (glass popup on click)',
      'src/components/creature/CreatureHatch.tsx (hatch cinematic)',
      'src/components/creature/index.ts (barrel: export a single <WarriorCreature/> that mounts engine+renderer+reactions and is safe to drop in page.tsx)',
    ],
    notes: 'Feed creature XP from useXPStore.xp (read it, derive stage). Provide a single default-safe <WarriorCreature/> component from the barrel that renders the taskbar creature + handles clicks to open stats. No external image assets.',
  },
  {
    key: 'memory-palace',
    title: 'Memory Palace (3D walkable space)',
    specLines: '516-526 (section 6E)',
    owns: [
      'src/components/apps/memory-palace/MemoryPalaceApp.tsx (default export component with NO props, named export MemoryPalaceApp, wrapped in memo — this is an OS app like HabitForgeApp)',
      'src/components/apps/memory-palace/PalaceRoomGenerator.tsx',
      'src/components/apps/memory-palace/KnowledgeObject.tsx',
      'src/components/apps/memory-palace/PalaceNavigation.tsx',
      'src/components/apps/memory-palace/NoteHologram.tsx',
    ],
    notes: 'Use @react-three/fiber + @react-three/drei (already installed: Canvas, PointerLockControls/OrbitControls). WASD + mouse-look first-person, a few procedural themed rooms keyed to GATE subjects. Read notes from localStorage key "warrior-notes" if present, else use a few seed objects. IMPORTANT: guard all browser/three usage so it builds under Next.js (component is already client "use client"; three runs client-side). Keep FPS-friendly. Export MemoryPalaceApp for the registry.',
  },
  {
    key: 'ghost',
    title: 'Ghost Warriors (anonymous presence)',
    specLines: '528-538 (section 6F) plus type 6.3, store 6.8, hook 6.15',
    owns: [
      'src/types/ghost.ts',
      'src/stores/useGhostStore.ts',
      'src/hooks/useGhostPresence.ts (LOCAL-SIM fallback: no Firebase keys available — simulate 3-12 anonymous warriors with jittered stats + your own presence; if firebase later configured it can be swapped)',
      'src/components/ghost/GhostAvatars.tsx (translucent walkers across desktop bottom)',
      'src/components/ghost/WarriorLeaderboard.tsx (glass panel)',
      'src/components/ghost/CampfireWidget.tsx (canvas campfire scaling with online count, draggable)',
      'src/components/ghost/WarCrySystem.tsx (floating bubbles; local only)',
      'src/components/ghost/OnlineCounter.tsx (system-tray-style badge)',
      'src/components/ghost/index.ts (barrel exporting a <GhostLayer/> desktop overlay + the widgets)',
    ],
    notes: 'NO Firebase dependency at runtime — pure local simulation with graceful design so it always renders. Do not import firebase in a way that throws when env is empty. Use deterministic-ish jitter seeded by index/time (avoid crashing if Math.random unavailable is NOT a concern here — this is app runtime, Math.random is fine in the browser).',
  },
  {
    key: 'decay',
    title: 'Reality Decay Engine',
    specLines: '540-552 (section 6G) plus store 6.10, hook 6.13',
    owns: [
      'src/stores/useDecayStore.ts',
      'src/hooks/useDecayEngine.ts (timer on first interaction; stages at 120/150/180/210/240 min; auto-pause after 10 min idle)',
      'src/components/decay/DecayEngine.tsx (master controller mounting the CSS/overlay stages)',
      'src/components/decay/DecayStages.tsx (stages 1-5 visual effects as overlays/filters; keep them as one file exporting per-stage layers)',
      'src/components/decay/BreakMode.tsx (full-screen 4-7-8 breathing overlay, 5-min timer, cannot Esc)',
      'src/components/decay/DecayRepair.tsx (reverse effects + 50 XP via useXPStore.addXP)',
      'src/components/decay/index.ts (barrel exporting <RealityDecay/> that mounts engine+stages; safe in page.tsx)',
    ],
    notes: 'For testing, expose a way to accelerate (e.g. store action to set stage). Apply global filters via a fixed overlay div / CSS variables on a wrapper, NOT by mutating document.body in SSR-unsafe ways. Award XP through useXPStore. Provide a settings-friendly enabled flag in the store.',
  },
  {
    key: 'music',
    title: 'Procedural Music Engine',
    specLines: '554-565 (section 6H) plus store 6.11, hook 6.14',
    owns: [
      'src/stores/useMusicGenStore.ts',
      'src/lib/procedural-music/tone-setup.ts (Tone.js synths + effects; lazy-init, must not run at import/SSR)',
      'src/lib/procedural-music/morning-gen.ts',
      'src/lib/procedural-music/study-ambient-gen.ts',
      'src/lib/procedural-music/typing-rhythm-gen.ts (reads BPM from useBiometricsStore typing metrics — import the store from stores/useBiometricsStore)',
      'src/lib/procedural-music/night-ambient-gen.ts',
      'src/hooks/useProceduralMusic.ts (generate(mood)/stop(); Tone.start() on user gesture only)',
      'src/components/music/ProceduralMusicPlayer.tsx (self-contained panel component that can be shown inside the existing Music app OR standalone)',
      'src/components/music/index.ts (barrel)',
    ],
    notes: 'Tone.js is installed. CRITICAL: never call Tone/AudioContext at module top-level or during SSR — lazy-init inside functions/effects and only after a user gesture. It reads typing tempo from useBiometricsStore (owned by the biometrics agent) — code against a store shape with typing metrics { wpm } / a bpm value; if unsure, import the store and read defensively with optional chaining and fallbacks.',
  },
  {
    key: 'phantom',
    title: 'Phantom Windows',
    specLines: '567-574 (section 6I) plus type 6.4, store 6.9',
    owns: [
      'src/types/phantom.ts',
      'src/stores/usePhantomStore.ts',
      'src/components/phantom/PhantomEngine.tsx (subscribe to useWindowStore.windows; on a window disappearing, create a phantom from last-known {appId,title,icon,position,size}; max 5)',
      'src/components/phantom/PhantomRenderer.tsx (translucent drifting ghost cards on desktop layer)',
      'src/components/phantom/PhantomResurrect.tsx (click → reopen app via useAppStore/launch; import how apps are launched)',
      'src/components/phantom/PhantomDissolve.tsx (particle dissolve after 8s)',
      'src/components/phantom/index.ts (barrel exporting <PhantomLayer/> safe for page.tsx)',
    ],
    notes: 'html2canvas is NOT installed — do NOT snapshot real DOM. Instead render a stylized ghost card using the window title/icon/appId (no external deps). Detect closes by diffing useWindowStore.windows across renders (subscribe). Resurrect by launching the app again through the existing app launch store (inspect useAppStore / useWindowStore for how apps open).',
  },
  {
    key: 'biometrics',
    title: 'Typing Biometrics',
    specLines: '576-584 (section 6J) plus type 6.2, store 6.7, hook 6.12',
    owns: [
      'src/types/biometrics.ts',
      'src/stores/useBiometricsStore.ts (current state {energy,focus,fatigue,stress} 0-100 + typing metrics {wpm,errorRate,pauseAvg,rhythmScore} + history[]; expose updateMetrics + getAverages)',
      'src/lib/biometric-calculator.ts (pure calcEnergy/calcFatigue/calcFocus/calcStress with sigmoid curves)',
      'src/hooks/useTypingBiometrics.ts (global keydown/keyup listener; rolling 60s WPM, backspace rate, pause intervals, rhythm stddev; updates store every ~5s via interval)',
      'src/components/biometrics/TypingTracker.tsx (mount-once global component that runs the hook — safe in page.tsx)',
      'src/components/biometrics/VitalsWidget.tsx (draggable glass panel, 4 color-coded bars, smooth updates)',
      'src/components/biometrics/BiometricHistory.tsx (recharts line/heatmap from history; persist snapshots to localStorage since no Firestore keys)',
      'src/components/biometrics/index.ts (barrel)',
    ],
    notes: 'This agent OWNS useBiometricsStore.ts and useTypingBiometrics.ts (the music agent imports the store). recharts is installed for charts. Persist history to localStorage "warrior-biometrics". Keep the key listener throttled/efficient.',
  },
  {
    key: 'dreams',
    title: 'NEXUS Dreams (daily cinematic recap)',
    specLines: '586-595 (section 6K) plus type 6.5',
    owns: [
      'src/types/dream.ts',
      'src/data/dream-themes.ts (subject → {objects,color,ambient,narration}; include idle/mixed/project edge cases)',
      'src/components/dream/DreamEngine.tsx (reads yesterday activity from localStorage — no Firestore keys; builds DreamScene)',
      'src/components/dream/DreamRenderer.tsx (full-screen 5s canvas/framer scene with drifting subject objects)',
      'src/components/dream/DreamNarration.tsx (Orbitron 50% opacity fading whisper text)',
      'src/components/dream/DreamSequence.tsx (orchestrates renderer+narration+transition, calls onComplete after ~5s; default export usable as the "dream" OS phase)',
      'src/components/dream/index.ts (barrel exporting <DreamSequence onComplete/>)',
    ],
    notes: 'The OS phase machine already has a "dream" phase (useOSStore PHASE_ORDER = ["dream","boot","lock","desktop"]). Build <DreamSequence onComplete={...}/> so the integration agent can render it when phase==="dream". Read activity from localStorage; if none, render the "void" idle dream. Do NOT change page.tsx yourself.',
  },
];

// ─── Manifest schema every builder returns ───
const MANIFEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['feature', 'filesCreated', 'globalMounts', 'registryEntries', 'achievements', 'barrelExports', 'settingsToggles', 'notes'],
  properties: {
    feature: { type: 'string' },
    filesCreated: { type: 'array', items: { type: 'string' }, description: 'Absolute or repo-relative paths actually written' },
    globalMounts: {
      type: 'array',
      description: 'Components the integration agent must mount in page.tsx desktop phase (or dream phase). Empty if none.',
      items: {
        type: 'object', additionalProperties: false,
        required: ['component', 'importPath', 'where'],
        properties: {
          component: { type: 'string', description: 'e.g. "<WarriorCreature/>" or "<DreamSequence onComplete={handleDreamDone}/>"' },
          importPath: { type: 'string', description: 'e.g. "@/components/creature"' },
          where: { type: 'string', enum: ['desktop-phase', 'dream-phase', 'root'], description: 'where in page.tsx to mount' },
        },
      },
    },
    registryEntries: {
      type: 'array',
      description: 'New app-registry.ts entries (only Memory Palace expected). Empty otherwise.',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'name', 'icon', 'importName', 'importPath', 'category'],
        properties: {
          id: { type: 'string' }, name: { type: 'string' }, icon: { type: 'string' },
          importName: { type: 'string' }, importPath: { type: 'string' },
          category: { type: 'string' }, shortcut: { type: 'string' },
        },
      },
    },
    achievements: {
      type: 'array',
      description: 'Achievement objects to add to data/achievements.ts for this feature',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'title', 'description', 'icon', 'category', 'xpReward'],
        properties: {
          id: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' },
          icon: { type: 'string' }, category: { type: 'string' }, xpReward: { type: 'number' },
        },
      },
    },
    barrelExports: {
      type: 'array',
      description: 'Lines to add to existing barrels (types/index.ts, hooks/index.ts). Empty if the agent created only self-contained barrels.',
      items: {
        type: 'object', additionalProperties: false,
        required: ['file', 'line'],
        properties: { file: { type: 'string' }, line: { type: 'string' } },
      },
    },
    settingsToggles: {
      type: 'array',
      description: 'Feature on/off toggles that should appear in Settings (name + store selector). Empty if none.',
      items: { type: 'string' },
    },
    notes: { type: 'string', description: 'Anything the integration/verify agent must know: interface contracts, gotchas, TODOs' },
  },
};

// ═══════════════════════════════════════════════════════════
// PHASE 1 — RECON
// ═══════════════════════════════════════════════════════════
phase('Recon');
const conventions = await agent(
  `You are a codebase recon agent for the "Warrior OS" Next.js 16 + TypeScript + Tailwind project at ${ROOT}.
Produce a precise CONVENTIONS CONTRACT (markdown) that other agents will follow to write compatible code. READ the actual files — do not guess.

Cover exactly these, with short code snippets copied from the repo:
1. Zustand store pattern: read src/stores/useXPStore.ts and useSettingsStore.ts. Show the create()/immer/persist shape, persist "name" convention, and how actions use immer set.
2. How OS apps are structured & registered: read src/components/apps/habit-forge/HabitForgeApp.tsx and src/data/app-registry.ts. Note: apps are named exports wrapped in memo, no props, render full-height (h-full). Show the AppDefinition shape from src/types/app.ts.
3. Global component mounting: read src/app/page.tsx. List EXACTLY where desktop-phase global overlays are mounted (e.g. near <CursorTrail/>, <ScreenEffects/>) and how the phase state machine works (useOSStore). Note the existing "dream" phase and that page.tsx currently does NOT render it.
4. Theme tokens: read src/app/globals.css + tailwind usage. List the accent/bg/text class tokens available (e.g. text-accent-primary, bg-bg-void, text-text-primary/secondary/muted, bg-bg-surface) and common patterns (glass, cn util from @/lib/utils).
5. Achievements: read src/types/achievement.ts and src/data/achievements.ts. Show the Achievement type and the exact array/export shape so new achievement objects can be appended.
6. Constants: read src/lib/constants.ts. Show OSPhase type, LEVEL_THRESHOLDS, and any accent color maps.
7. GATE subjects available: read src/data/gate-questions/index.ts (subject keys/names) for Memory Palace + Dreams theming.
8. Barrels: read src/types/index.ts and src/hooks/index.ts — show how they re-export so new files can be added.
9. Settings store shape: read src/stores/useSettingsStore.ts — how toggles are stored, so new feature toggles can follow suit.
10. Window/App launching: read src/stores/useAppStore.ts — how an app is launched (for Phantom resurrect).

Output the contract as clear markdown with real snippets. Be concise but complete — this is the single source of truth for 8 downstream builders.`,
  { label: 'recon:conventions', phase: 'Recon' }
);

// ═══════════════════════════════════════════════════════════
// PHASE 2 — BUILD (8 features in parallel)
// ═══════════════════════════════════════════════════════════
phase('Build');
const builderPrompt = (f) => `You are building ONE god-level feature for "Warrior OS" (Next.js 16 + TS + Tailwind) at ${ROOT}.

FEATURE: ${f.title}
SPEC: Read ${TASK} lines ${f.specLines} for the full requirements (use the Read tool with offset). Follow it closely but adapt where noted below.

CONVENTIONS CONTRACT (follow these patterns EXACTLY):
${conventions}

FILES YOU OWN (create these, and only these — plus any small helpers inside the same directories):
${f.owns.map((o) => '  - ' + o).join('\n')}

FEATURE-SPECIFIC NOTES:
${f.notes}

HARD RULES:
1. Create NEW files only. DO NOT edit shared files (src/app/page.tsx, src/data/app-registry.ts, src/data/achievements.ts, src/types/index.ts, src/hooks/index.ts, src/lib/constants.ts, src/stores/useSettingsStore.ts). The integration agent wires those — you just report what's needed in your manifest.
2. All components: 'use client' at top. Match the repo's Tailwind token style and cn() usage. No new npm packages — only what's already installed (framer-motion, three, @react-three/fiber, @react-three/drei, tone, howler, recharts, canvas-confetti, zustand, immer, lucide-react, date-fns).
3. SSR-safe: never touch window/document/AudioContext/Tone at module top-level; guard with typeof window checks or run inside effects. This MUST compile with \`next build\`.
4. TypeScript strict: no \`any\` leaks that break build, no unused imports, type all props. Prefer explicit types.
5. Persist state to localStorage with "warrior-*" keys (matching existing convention) unless using an existing store.
6. Provide a single safe barrel export (index.ts) that gives the integration agent one component to drop in where relevant.
7. Firebase keys are NOT configured — anything "multiplayer"/"cloud" must work as a local simulation and never throw.

After writing all files, VERIFY your own TypeScript by reading your files back for obvious errors. Then return your integration manifest (the StructuredOutput tool). List every file you created, every global mount point, any registry entry, all achievement objects for this feature, barrel export lines, settings toggles, and critical notes/interface contracts for downstream agents.`;

const manifests = await parallel(
  FEATURES.map((f) => () =>
    agent(builderPrompt(f), { label: `build:${f.key}`, phase: 'Build', schema: MANIFEST_SCHEMA })
  )
);
const validManifests = manifests.filter(Boolean);
log(`Built ${validManifests.length}/${FEATURES.length} features`);

// ═══════════════════════════════════════════════════════════
// PHASE 3 — INTEGRATE (sequential, single agent to avoid shared-file conflicts)
// ═══════════════════════════════════════════════════════════
phase('Integrate');
const integration = await agent(
  `You are the INTEGRATION agent for Warrior OS Phase 6 at ${ROOT}. Eight feature agents built new files and returned manifests. Your job: wire them into the shared files WITHOUT breaking anything. Work carefully and sequentially.

CONVENTIONS CONTRACT:
${conventions}

MANIFESTS (JSON) from the 8 builders:
${JSON.stringify(validManifests, null, 2)}

TASKS:
1. src/data/app-registry.ts — add every registryEntries item (expect Memory Palace, icon 🏛️, category study, shortcut ctrl+shift+m if free — verify no shortcut clash by reading the file). Import the component and add the AppDefinition entry following existing shape.
2. src/data/achievements.ts — append ALL achievement objects from every manifest, matching the existing Achievement type/shape exactly (read the file first; map fields; if the existing objects use a "condition" or "unlockedAt" field, follow that shape — set condition to a sensible string/placeholder if required).
3. src/app/page.tsx — mount every globalMounts item at the correct place:
   - "desktop-phase" components: add inside the desktop phase block near the existing <CursorTrail/> / <ScreenEffects/> mounts.
   - "dream-phase": render the dream component when phase === 'dream'. The OS phase machine (useOSStore) already lists 'dream' first but page.tsx doesn't render it. Add a dream phase branch that renders the DreamSequence and calls nextPhase() (or setPhase('lock')) on complete. Keep boot→lock→desktop working for new users; only returning users should see dream (you may gate simply: render dream branch only when phase==='dream', and leave initial phase as-is unless a manifest says otherwise — do NOT break the current boot-first flow).
   - Add all needed imports at the top.
4. Barrels — apply every barrelExports line to src/types/index.ts and src/hooks/index.ts (dedupe; don't double-add).
5. Settings — if straightforward, add feature on/off toggles to the Settings app for the settingsToggles reported (read src/components/apps/settings/* to find the right tab; if it's risky/large, SKIP and note it — do not break Settings).
6. Do NOT touch the feature files themselves; only shared wiring files.

After editing, read back each shared file you changed to sanity-check imports resolve and syntax is valid. Return a concise summary: what you wired, any manifest item you intentionally skipped and why, and any risks the verify agent should watch for.`,
  { label: 'integrate:shared-files', phase: 'Integrate' }
);
log('Integration done');

// ═══════════════════════════════════════════════════════════
// PHASE 4 — VERIFY (build + fix loop)
// ═══════════════════════════════════════════════════════════
phase('Verify');
const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['buildPassed', 'attempts', 'errorsFixed', 'remainingIssues', 'summary'],
  properties: {
    buildPassed: { type: 'boolean' },
    attempts: { type: 'number' },
    errorsFixed: { type: 'array', items: { type: 'string' } },
    remainingIssues: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
};
const verify = await agent(
  `You are the VERIFY & FIX agent for Warrior OS at ${ROOT}. Phase 6 feature files + integration wiring are in place.

DO THIS:
1. Run: \`cd "${ROOT}" && npm run build\` (use the Bash tool; it may take ~30-60s).
2. If it fails, read the errors, open the offending files, and FIX them (type errors, missing imports, SSR issues like top-level window/Tone/AudioContext access, unused vars if the build is strict, wrong import paths, barrel mismatches). Prefer minimal, correct fixes that preserve each feature's intent.
3. Re-run the build. Repeat up to 6 times until it passes (exit code 0) or you can no longer make progress.
4. Common Phase-6 pitfalls to check proactively: Tone.js/AudioContext must be lazy (not module-scope); @react-three/fiber Canvas must be client-only; recharts imports correct; framer-motion variant typing; any Firebase import must not execute with empty env.

Report the final build status honestly. If some feature still won't compile, and it's isolated, you may stub/comment its mount to get a green build — but clearly list that in remainingIssues so it can be revisited. Do NOT delete feature files wholesale.

Return the structured verification result.`,
  { label: 'verify:build', phase: 'Verify', schema: VERIFY_SCHEMA }
);

return {
  featuresBuilt: validManifests.map((m) => m.feature),
  integration,
  verify,
};
