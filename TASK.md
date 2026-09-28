# ⚔️ WARRIOR OS v4.0 — MASTER TASK LIST (THE LIVING WORLD)

## Direction update (overrides anything below that conflicts)

Warrior OS is **Keshav Upadhyay's personal OS and portfolio showcase**, not an exam-prep product. The GATE exam-prep focus was added by mistake and has been replaced.

- **Core feel, all four at once:** my digital home (it knows me: my creature, my NEXUS), a sci-fi command center (Jarvis vibes, 3D, cinematic), a discipline machine (habits, focus, streaks, decay) and a creative playground (music, Code Lab, experiments).
- **Learn anything:** the study hub is **Training Grounds** (`training-grounds`, formerly `gate-prep`), built over the user's **own decks** (`types/learning.ts`, `stores/useLearningStore.ts`, sample decks in `data/learning/`). Tabs: **Decks** (the default: create, import, export or forge decks from notes), Quiz, Review (the due-card queue), Skill Tree, Question Bank, Mock Test and **Quest Planner**.
- **Fixed app names:** Training Grounds (`training-grounds`), **Habit Forge** (`study-planner`: habits, routines, streaks), Flashcards (`flashcards`). "Quest Planner" is the Training Grounds planner tab, not an app. NEXUS AI opens with **Ctrl+.** (Ctrl+N belongs to the browser). Owner details live in `src/config/owner.ts`; visitors get **Explore as Guest** on the lock screen.
- **Shipping:** CI in `.github/workflows/ci.yml`, Playwright smoke test in `tests/e2e/`, deploy steps in `DEPLOY.md`.

> **Ye file project ka single source of truth hai.**  
> Har task numbered hai, dependency clear hai, estimated time hai.  
> Koi task skip mat karna. Order follow karna. Har task ke baad verify karna.  
> **v4.0 = v3.0 + 8 GOD-LEVEL features jo duniya mein kisi ke paas nahi hain.**

---

## 📋 STATUS LEGEND

- ⬜ Not Started
- 🔄 In Progress
- ✅ Completed
- 🔒 Blocked (dependency not met)
- ⚠️ Needs Review

---

## 📦 PRE-REQUISITES (Before Any Code)

| # | Task | Est. Time | Status | Verify |
|---|------|-----------|--------|--------|
| 0.1 | Install Node.js (v18+ LTS) | 5 min | ⬜ | `node -v` shows 18+ |
| 0.2 | Install Git | 5 min | ⬜ | `git --version` works |
| 0.3 | Create GitHub repo "warrior-os" | 5 min | ⬜ | Repo visible on GitHub |
| 0.4 | Create Firebase project (console.firebase.google.com) | 10 min | ⬜ | Project visible in Firebase console |
| 0.5 | Enable Firebase Auth (Email + Google) | 5 min | ⬜ | Auth providers enabled in console |
| 0.6 | Create Firestore database (test mode) | 5 min | ⬜ | Firestore visible in console |
| 0.7 | Get Firebase config keys (apiKey, authDomain, etc.) | 5 min | ⬜ | All 6 config values copied |
| 0.8 | Get OpenWeatherMap free API key | 5 min | ⬜ | API key from openweathermap.org |
| 0.9 | Get Gemini API key (free tier) from aistudio.google.com | 5 min | ⬜ | API key ready |
| 0.10 | VS Code Extensions: Tailwind IntelliSense, ESLint, Prettier | 5 min | ⬜ | Extensions installed |

---

## 🏗️ PHASE 1: PROJECT SETUP & OS KERNEL (Week 1-3)

### 1A. Project Initialization

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 1.1 | Run `npx create-next-app@latest warrior-os --typescript --tailwind --app --src-dir --eslint` | 5 min | 0.1, 0.2 | ⬜ | `npm run dev` shows Next.js default page |
| 1.2 | Install core dependencies: `npm i framer-motion zustand @react-three/fiber @react-three/drei three react-rnd @dnd-kit/core @dnd-kit/sortable lucide-react date-fns howler react-hotkeys-hook immer tone` | 5 min | 1.1 | ⬜ | All packages in package.json (including Tone.js) |
| 1.3 | Install dev dependencies: `npm i -D @types/three @types/howler` | 2 min | 1.2 | ⬜ | No TS errors on import |
| 1.4 | Install Firebase: `npm i firebase` | 2 min | 1.2 | ⬜ | `firebase` importable |
| 1.5 | Install additional: `npm i tsparticles @tsparticles/react recharts canvas-confetti` | 3 min | 1.2 | ⬜ | All importable |
| 1.6 | Install dev: `npm i -D @types/canvas-confetti` | 1 min | 1.5 | ⬜ | Types available |
| 1.7 | Setup Git: `git init`, create `.gitignore`, initial commit | 5 min | 1.1 | ⬜ | `git log` shows initial commit |
| 1.8 | Connect to GitHub remote, push | 3 min | 0.3, 1.7 | ⬜ | Code visible on GitHub |

### 1B. Design System & Configuration

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 1.9 | Configure `tailwind.config.ts` — add custom colors (bg-desktop, accent-primary, etc.), fonts (Inter, JetBrains Mono, Orbitron), custom shadows, border-radius, z-index scale | 30 min | 1.1 | ⬜ | Tailwind classes like `bg-desktop`, `text-accent-primary`, `font-mono` work |
| 1.10 | Setup `globals.css` — CSS custom properties (--bg-desktop, --accent-primary, etc.), glass utilities, base styles, scrollbar styling | 30 min | 1.9 | ⬜ | CSS variables accessible via `var(--bg-desktop)` |
| 1.11 | Create `styles/animations.css` — @keyframes: pulse-glow, float, glitch, scanline-move, typewriter, breathe, rotate-border, fade-in-up, shake, disintegrate | 45 min | 1.10 | ⬜ | At least 15 keyframe animations defined |
| 1.12 | Create `styles/glass.css` — Glassmorphism utility classes (.glass, .glass-dark, .glass-border, .glass-glow) | 20 min | 1.10 | ⬜ | `.glass` class shows frosted glass on dark bg |
| 1.13 | Create `styles/scanlines.css` — CRT scanline overlay, vignette | 15 min | 1.10 | ⬜ | Scanline effect visible when class applied |
| 1.14 | Create `styles/cursors.css` — Custom cursor definitions per context | 15 min | 1.10 | ⬜ | Different cursors on different areas |
| 1.15 | Download & place fonts in `public/fonts/` — Inter-Variable.woff2, JetBrainsMono-Variable.woff2, Orbitron-Variable.woff2 | 15 min | 1.1 | ⬜ | Fonts load correctly on page |
| 1.16 | Update `app/layout.tsx` — load fonts, set metadata, wrap with providers, set dark bg on html/body, import all CSS files | 20 min | 1.15 | ⬜ | Page loads with correct fonts, dark bg, no flash of unstyled content |

### 1C. TypeScript Types

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 1.17 | Create `types/window.ts` — WindowState (id, title, icon, position, size, isMinimized, isMaximized, isFocused, zIndex, appId) | 15 min | 1.1 | ⬜ | Type exports without TS errors |
| 1.18 | Create `types/app.ts` — AppDefinition (id, name, icon, component, defaultSize, minSize, category, shortcut) | 15 min | 1.1 | ⬜ | Type exports without TS errors |
| 1.19 | Create `types/user.ts` — UserProfile (uid, displayName, email, avatar, level, xp, streak, createdAt) | 10 min | 1.1 | ⬜ | Type exports without TS errors |
| 1.20 | Create `types/workspace.ts` — Workspace (id, name, accentColor, wallpaper, openWindows[]) | 10 min | 1.1 | ⬜ | Type exports without TS errors |
| 1.21 | Create `types/achievement.ts` — Achievement (id, title, description, icon, category, condition, xpReward, unlockedAt?) | 10 min | 1.1 | ⬜ | Type exports without TS errors |
| 1.22 | Create `types/learning.ts` — Deck → Topic → Card (kind: mcq / multi-select / numeric / flashcard; prompt, options, answer, explanation, difficulty, tags), CardAttempt, spaced-repetition review state | 10 min | 1.1 | ⬜ | Type exports without TS errors |
| 1.23 | Create `types/project.ts` — Project (id, name, description, techStack[], status, progress, tasks[], githubUrl?, deployUrl?, createdAt) | 10 min | 1.1 | ⬜ | Type exports without TS errors |
| 1.24 | Create `types/nexus.ts` — NexusMessage (role, content, timestamp), NexusContext (openApps, currentWorkspace, userStats, timeOfDay) | 10 min | 1.1 | ⬜ | Type exports without TS errors |

### 1D. State Management (Zustand Stores)

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 1.25 | Create `stores/useAuthStore.ts` — user, isAuthenticated, isLoading, login(), logout(), setUser() | 20 min | 1.19 | ⬜ | Store initializes, login/logout methods exist |
| 1.26 | Create `stores/useWindowStore.ts` — windows[], openWindow(), closeWindow(), minimizeWindow(), maximizeWindow(), focusWindow(), updatePosition(), updateSize(), getTopZIndex() | 40 min | 1.17 | ⬜ | Can open/close/focus windows, z-index updates |
| 1.27 | Create `stores/useAppStore.ts` — openApps[], launchApp(), closeApp(), getRunningApps(), focusedAppId | 25 min | 1.18, 1.26 | ⬜ | App launch creates window, close removes it |
| 1.28 | Create `stores/useSettingsStore.ts` — wallpaper, accentColor, soundEnabled, soundVolume, cursorTrail, glassOpacity, crtEffect, setWallpaper(), toggleSound() | 25 min | 1.1 | ⬜ | Settings persist and toggle correctly |
| 1.29 | Create `stores/useWorkspaceStore.ts` — activeWorkspace, workspaces[3], switchWorkspace(), getActiveWindows() | 20 min | 1.20, 1.26 | ⬜ | Switching workspace changes active windows |
| 1.30 | Create `stores/useXPStore.ts` — xp, level, achievements[], addXP(), checkAchievements(), unlockAchievement(), getLevelTitle() | 30 min | 1.21 | ⬜ | XP adds correctly, level thresholds work, achievements unlock |
| 1.31 | Create `stores/useNotificationStore.ts` — notifications[], addNotification(), removeNotification(), clearAll() | 15 min | 1.1 | ⬜ | Notifications can be added/removed |
| 1.32 | Create `stores/useAudioStore.ts` — isPlaying, currentTrack, volume, bassLevel, midsLevel, highsLevel, setFrequencyData() | 15 min | 1.1 | ⬜ | Audio state updates correctly |
| 1.33 | Create `stores/useNexusStore.ts` — messages[], context, isProcessing, addMessage(), setContext(), clearHistory() | 15 min | 1.24 | ⬜ | Messages can be added, context updates |

### 1E. Firebase Setup

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 1.34 | Create `lib/firebase.ts` — initializeApp with config from env vars, export auth, db, storage | 15 min | 0.4, 0.7, 1.4 | ⬜ | Firebase initializes without errors |
| 1.35 | Create `.env.local` — NEXT_PUBLIC_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID, WEATHER_API_KEY, GEMINI_API_KEY (server-only, never NEXT_PUBLIC_) | 10 min | 0.7, 0.8, 0.9 | ⬜ | Env vars accessible in code |
| 1.36 | Create `lib/auth.ts` — signInWithEmail(), signUpWithEmail(), signInWithGoogle(), signOut(), onAuthChange() | 25 min | 1.34 | ⬜ | Can create account, login, logout, Google login |
| 1.37 | Create `lib/firestore.ts` — generic CRUD: getDoc(), setDoc(), updateDoc(), deleteDoc(), queryCollection(), onSnapshot() wrappers | 25 min | 1.34 | ⬜ | Can read/write to Firestore |
| 1.38 | Add `.env.local` to `.gitignore` | 2 min | 1.35 | ⬜ | `.env.local` not tracked by git |

### 1F. Reusable UI Components

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 1.39 | Create `components/ui/GlassPanel.tsx` — glassmorphism container with configurable blur, opacity, border glow, padding | 25 min | 1.12 | ⬜ | Renders frosted glass panel on dark bg |
| 1.40 | Create `components/ui/GlowButton.tsx` — neon-bordered button with hover glow, click ripple, loading state | 25 min | 1.11 | ⬜ | Button glows on hover, has click animation |
| 1.41 | Create `components/ui/TypewriterText.tsx` — text types character by character, configurable speed, cursor blink, callback onComplete | 25 min | 1.11 | ⬜ | Text types out smoothly with blinking cursor |
| 1.42 | Create `components/ui/GlitchText.tsx` — text with RGB chromatic aberration glitch effect, configurable intensity | 20 min | 1.11 | ⬜ | Text visibly glitches with color split |
| 1.43 | Create `components/ui/ProgressBar.tsx` — linear progress with glow, animated fill, optional label, noise texture inside | 20 min | 1.11 | ⬜ | Progress bar fills with animation + glow |
| 1.44 | Create `components/ui/ProgressRing.tsx` — circular SVG progress with glow trail | 20 min | 1.11 | ⬜ | Circular ring fills correctly |
| 1.45 | Create `components/ui/ScanlineOverlay.tsx` — full-screen CRT scanline + subtle vignette, toggleable | 15 min | 1.13 | ⬜ | Horizontal lines visible over content |
| 1.46 | Create `components/ui/NeonBadge.tsx` — small label with neon border, configurable color | 10 min | 1.11 | ⬜ | Badge renders with colored glow |
| 1.47 | Create `components/ui/HolographicCard.tsx` — card with rotating gradient border animation | 25 min | 1.12 | ⬜ | Border gradient rotates continuously |
| 1.48 | Create `components/ui/Input.tsx` — styled input with glass bg, glow on focus, optional icon | 15 min | 1.12 | ⬜ | Input styled consistently, glows on focus |
| 1.49 | Create `components/ui/Modal.tsx` — centered modal with glass bg, backdrop blur, close on Esc, Framer Motion enter/exit | 20 min | 1.39 | ⬜ | Modal opens/closes with animation |
| 1.50 | Create `components/ui/Tooltip.tsx` — hover tooltip with glass style, fade-in, arrow pointing to element | 15 min | 1.12 | ⬜ | Tooltip appears on hover with delay |
| 1.51 | Create `components/ui/Tabs.tsx` — tab component with animated active indicator, glass style | 15 min | 1.12 | ⬜ | Tabs switch content, indicator slides |
| 1.52 | Create `components/ui/Toggle.tsx` — iOS-style toggle switch with glow | 10 min | 1.11 | ⬜ | Toggle switches smoothly |
| 1.53 | Create `components/ui/Dropdown.tsx` — dropdown menu with glass bg, staggered item animation, click-outside close | 20 min | 1.39 | ⬜ | Dropdown opens with animation |
| 1.54 | Create `components/ui/HexGrid.tsx` — hexagonal grid background pattern, subtle, configurable opacity | 15 min | 1.10 | ⬜ | Hex pattern visible as background |

### 1G. OS Kernel Components

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 1.55 | Create `components/os/BootScreen.tsx` — Phase 0 (particle logo assembly on Canvas) + Phase 1 (system log typewriter + progress bar) + CRT overlay. Ends with white flash transition | 3 hrs | 1.41, 1.43, 1.45, 1.42 | ⬜ | Boot plays fully: particles assemble → log types → progress fills → white flash |
| 1.56 | Create `components/os/LockScreen.tsx` — 3 parallax layers (bg shader, floating particles, foreground UI). Avatar with rotating ring. Name with glow. Password input with "biometric scan" animation. Date/time/streak/level/weather/quote display. Shattering unlock transition | 3 hrs | 1.39, 1.48, 1.41, 1.25 | ⬜ | Lock screen shows with parallax, password works, shattering unlock plays |
| 1.57 | Create `components/os/DesktopIcon.tsx` — icon + label, double-click to launch app, drag to rearrange (@dnd-kit), 3D hover lift (translateZ), glow on hover, bounce on click | 1 hr | 1.27 | ⬜ | Icon hovers up in 3D, double-click opens app |
| 1.58 | Create `components/os/Desktop.tsx` — 3D perspective container, icon grid (from app-registry), wallpaper layer behind, right-click handler, workspace dots indicator | 2 hrs | 1.57, 1.29 | ⬜ | Desktop renders with tilted icons, wallpaper behind |
| 1.59 | Create `components/os/Window.tsx` — glassmorphism window with title bar (icon, title, min/max/close buttons), draggable (react-rnd), resizable, 3D tilt on drag, rotating edge glow when focused, reflection below | 3 hrs | 1.39, 1.26 | ⬜ | Window drags, resizes, minimizes, maximizes, closes, tilts 3D, glows when focused |
| 1.60 | Create `components/os/WindowAnimations.tsx` — open (holographic grid assembly with Framer Motion), close (disintegrate/Thanos effect on Canvas), minimize (morph down to taskbar) | 2 hrs | 1.59 | ⬜ | Window open assembles, close disintegrates, minimize morphs |
| 1.61 | Create `components/os/WindowManager.tsx` — renders all open windows from store, manages z-index stacking on click, handles window snapping to edges (left half, right half, maximize on top) | 2 hrs | 1.59, 1.60, 1.26 | ⬜ | Multiple windows render, clicking brings to front, edge snap works |
| 1.62 | Create `components/os/Taskbar.tsx` — glass bar at bottom, Start button (left), running app icons (middle, from store), system tray (right: notifications, sound, sync, clock) | 2 hrs | 1.39, 1.27, 1.46 | ⬜ | Taskbar shows running apps, click toggles focus/minimize, clock updates |
| 1.63 | Create `components/os/SystemTray.tsx` — live clock (useClock hook), sound icon + toggle, notification bell + count badge, sync status dot, "energy" meter (study hours) | 1 hr | 1.31, 1.28 | ⬜ | Clock ticks, sound toggles, notification count shows |
| 1.64 | Create `components/os/StartMenu.tsx` — slides up from taskbar, pinned apps grid (from registry), recent items list, user info (avatar, name, level), logout button. Click outside to close. Staggered item animation | 2 hrs | 1.39, 1.27, 1.25 | ⬜ | Start menu slides up, apps launch on click, closes on outside click |
| 1.65 | Create `components/os/DynamicIsland.tsx` — top-center floating pill. States: collapsed (streak+level), music (track+progress), achievement (badge+title), timer (pomodoro). Framer Motion `layout` morphing between states | 2 hrs | 1.39, 1.30, 1.32 | ⬜ | Island morphs between states smoothly |
| 1.66 | Create `components/os/ContextMenu.tsx` — appears at mouse position on right-click, glass bg, menu items with icons, staggered fade-in, close on click/outside. Items: New Note, Change Wallpaper, Display Settings, Refresh, System Info | 1 hr | 1.39, 1.53 | ⬜ | Right-click shows menu at cursor position, items clickable |
| 1.67 | Create `components/os/CommandPalette.tsx` — Ctrl+K overlay, centered input, search results below (apps, actions, notes), keyboard navigation (up/down/enter), close on Esc. Glass style | 2 hrs | 1.39, 1.48, 1.27 | ⬜ | Ctrl+K opens palette, typing filters results, Enter executes |
| 1.68 | Create `components/os/NotificationCenter.tsx` — slide-out panel from right, notification cards grouped by time, mark read, clear all, action buttons on each notification | 1.5 hrs | 1.39, 1.31 | ⬜ | Panel slides in/out, notifications display, clear works |
| 1.69 | Create `components/os/ToastNotification.tsx` — small popup at top-right, auto-dismiss after 5s, slide-in/out animation, icon + title + message | 30 min | 1.31 | ⬜ | Toast appears, stays 5s, slides out |
| 1.70 | Create `components/os/CursorManager.tsx` — reads cursor context from nearest parent, applies custom SVG cursor, renders canvas trail | 1 hr | 1.14 | ⬜ | Cursor changes per area, trail visible on fast move |
| 1.71 | Create `components/os/ScreenEffects.tsx` — optional CRT scanline overlay + vignette + grain noise. Toggleable from settings store | 30 min | 1.45, 1.28 | ⬜ | CRT effect visible when enabled, gone when disabled |

### 1H. Utility Files & Hooks

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 1.72 | Create `lib/utils.ts` — cn() (clsx+twMerge), formatDate(), formatTime(), average(), clamp(), generateId() | 15 min | 1.1 | ⬜ | Functions export correctly |
| 1.73 | Create `lib/constants.ts` — BOOT_MESSAGES[], WARRIOR_QUOTES[], KEYBOARD_SHORTCUTS{}, LEVEL_THRESHOLDS[] | 20 min | 1.1 | ⬜ | All constants accessible |
| 1.74 | Create `data/app-registry.ts` — array of all 13 apps with id, name, icon (Lucide), defaultSize, minSize, category, keyboard shortcut | 25 min | 1.18 | ⬜ | All 13 apps defined with correct metadata |
| 1.75 | Create `data/achievements.ts` — all achievements with id, title, description, category, condition function, xpReward | 30 min | 1.21 | ⬜ | At least 30 achievements defined |
| 1.76 | Create `data/quotes.ts` — 50+ warrior/discipline motivational quotes array | 15 min | 1.1 | ⬜ | Array with 50+ strings |
| 1.77 | Create `hooks/useClock.ts` — returns current time (HH:MM:SS), date, day. Updates every second | 10 min | 1.1 | ⬜ | Clock updates every second |
| 1.78 | Create `hooks/useKeyboardShortcuts.ts` — registers global shortcuts (Ctrl+K, Ctrl+1/2/3, Esc, etc.) using react-hotkeys-hook | 20 min | 1.2 | ⬜ | Ctrl+K triggers palette, Esc closes modals |
| 1.79 | Create `hooks/useContextMenu.ts` — handles right-click, tracks position, manages open/close state | 15 min | 1.1 | ⬜ | Right-click captures position, returns state |
| 1.80 | Create `hooks/useSound.ts` — play(soundName), preloads sounds via Howler, respects sound enabled setting | 20 min | 1.2, 1.28 | ⬜ | Calling play('click') plays sound when enabled |
| 1.81 | Create `hooks/useParallax.ts` — tracks mouse position, returns x/y offsets for parallax layers | 10 min | 1.1 | ⬜ | Moving mouse returns smooth offset values |
| 1.82 | Create `hooks/useAuth.ts` — wraps useAuthStore + Firebase onAuthStateChanged listener, auto-login on refresh | 20 min | 1.25, 1.36 | ⬜ | User persists across page refresh |
| 1.82a | Create `hooks/use3DPerspective.ts` — calculates 3D tilt values (rotateX, rotateY) based on mouse position relative to element center | 15 min | 1.1 | ⬜ | Returns tilt values that change on mouse move |
| 1.82b | Create `hooks/useVoiceCommand.ts` — wraps Web Speech API SpeechRecognition, returns transcript, isListening, start/stop methods | 20 min | 1.1 | ⬜ | Voice transcription works in Chrome |
| 1.82c | Create `hooks/useCursorContext.ts` — determines cursor type based on hovered element (icon, window, text, button), returns cursor name | 10 min | 1.1 | ⬜ | Returns correct cursor name per element |
| 1.82d | Create `hooks/useUserPatterns.ts` — logs app open times to Firestore, calculates daily usage patterns, returns predictions | 20 min | 1.37 | ⬜ | Usage patterns tracked and retrievable |
| 1.82e | Create `lib/speech.ts` — Web Speech API wrapper: startListening(), stopListening(), speak(text), onResult callback | 20 min | 1.1 | ⬜ | Speech functions work in Chrome |

### 1I. Main Page Assembly

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 1.83 | Create `app/page.tsx` — state machine: 'boot' → 'lock' → 'desktop'. Renders BootScreen → LockScreen → Desktop+Taskbar+WindowManager+DynamicIsland+CommandPalette+ContextMenu+NotificationCenter+ScreenEffects | 2 hrs | 1.55 thru 1.71 | ⬜ | Full flow works: boot animation → lock screen → desktop with all OS elements |
| 1.84 | Full Phase 1 integration test — boot, login, desktop icons double-click open windows, drag/resize windows, minimize/maximize/close, taskbar, start menu, right-click, Ctrl+K, multi-window z-index | 2 hrs | 1.83 | ⬜ | All OS interactions work together without crashes |
| 1.85 | Git commit: "Phase 1 complete — OS Kernel" | 5 min | 1.84 | ⬜ | Commit on GitHub |

---

## 🌌 PHASE 2: WALLPAPERS + WORKSPACES + AUDIO (Week 3-5)

### 2A. WebGL Shader Wallpapers

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 2.1 | Create `components/wallpapers/WallpaperEngine.tsx` — renders active wallpaper component, passes mouse/time/audio uniforms, handles switching | 1 hr | 1.28 | ⬜ | Wallpaper component renders behind desktop |
| 2.2 | Create `components/wallpapers/VoidMinimal.tsx` — near-black with subtle grain noise + breathing center glow (CSS only, no WebGL) | 30 min | 2.1 | ⬜ | Dark wallpaper with faint pulse, lightweight |
| 2.3 | Create `components/wallpapers/StarField.tsx` — canvas-based stars with parallax on mouse move, twinkling | 1 hr | 2.1, 1.81 | ⬜ | Stars visible, parallax on mouse, some twinkle |
| 2.4 | Create `components/wallpapers/NebulaShader.tsx` — React Three Fiber + GLSL: fractal noise nebula, time-animated, mouse-reactive ripple, color shifts by time-of-day | 2 hrs | 2.1 | ⬜ | Colored nebula clouds move slowly, mouse creates ripple |
| 2.5 | Create `components/wallpapers/AuroraShader.tsx` — GLSL sine waves with noise, green/purple bands, star layer behind | 2 hrs | 2.1 | ⬜ | Aurora bands undulate, colors shift |
| 2.6 | Create `components/wallpapers/FluidSimulation.tsx` — GLSL Navier-Stokes-style fluid, mouse creates ink swirls, audio-reactive turbulence | 3 hrs | 2.1 | ⬜ | Mouse creates fluid swirls, bass increases turbulence |
| 2.7 | Create `components/wallpapers/CyberpunkRain.tsx` — canvas: falling matrix columns + "glass screen" rain drops + neon reflections at bottom | 2 hrs | 2.1 | ⬜ | Matrix text falls, raindrops slide, neon reflects |
| 2.8 | Create `components/wallpapers/NeuralNetwork.tsx` — canvas: hundreds of nodes with connections, random pulse animations, cascade on app open | 2 hrs | 2.1, 1.27 | ⬜ | Nodes visible, connections glow, cascade on app launch |
| 2.9 | Create `hooks/useAdaptiveWallpaper.ts` — checks time of day, auto-switches wallpaper (morning=sunrise, afternoon=blue, evening=purple, night=void/stars, latenight=matrix) | 30 min | 2.1, 1.28, 1.77 | ⬜ | Wallpaper changes when time bracket changes |
| 2.10 | Create GLSL shader files in `shaders/` — nebula.frag, fluid.vert, fluid.frag, aurora.frag, noise.glsl (simplex/perlin noise functions), post-processing.frag (CRT + vignette + grain) | 1.5 hrs | 2.4, 2.5, 2.6 | ⬜ | All shader files exist, import correctly |

### 2B. Workspaces

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 2.11 | Create `components/os/WorkspaceManager.tsx` — manages 3 workspaces (Study/Build/Chill), renders active desktop, remembers windows per workspace | 1.5 hrs | 1.29, 1.58 | ⬜ | 3 separate desktops with independent windows |
| 2.12 | Add 3D cube rotation transition between workspaces (CSS rotateY + Framer Motion) | 1 hr | 2.11 | ⬜ | Switching workspace does 3D cube rotation |
| 2.13 | Add workspace indicator dots on desktop + Ctrl+1/2/3 keyboard switching | 30 min | 2.11, 1.78 | ⬜ | Dots show active workspace, Ctrl+1/2/3 switches |
| 2.14 | Each workspace has own accent color + wallpaper (Study=cyan+focus, Build=green+matrix, Chill=purple+aurora) | 30 min | 2.11, 2.1, 1.28 | ⬜ | Switching workspace changes accent + wallpaper |

### 2C. Audio System

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 2.15 | Create `lib/audio-engine.ts` — Web Audio API setup: AudioContext, AnalyserNode, getFrequencyData(), getBassLevel(), getMidsLevel(), getHighsLevel() | 1 hr | 1.1 | ⬜ | Frequency analysis returns real-time levels |
| 2.16 | Create `hooks/useAudioAnalyzer.ts` — connects to audio element, runs requestAnimationFrame loop reading frequency data, updates useAudioStore | 1 hr | 2.15, 1.32 | ⬜ | Bass/mids/highs update in store in real-time |
| 2.17 | Create sound effect files placeholder — download/create short .mp3: boot, login, open-window, close-window, click, notification, achievement, error, levelup (use freesound.org / mixkit.co) | 1 hr | 1.1 | ⬜ | 9+ sound files in public/sounds/ |
| 2.18 | Create `data/sounds.ts` — sound file registry mapping name → path | 10 min | 2.17 | ⬜ | Registry maps all sound names to paths |
| 2.19 | Integrate useSound hook with OS actions — play boot sound on boot, login chime on unlock, whoosh on window open, click on menu items, etc | 1 hr | 1.80, 2.18 | ⬜ | Sounds play on corresponding actions |
| 2.20 | Create `components/effects/AudioReactive.tsx` — engine that reads audio store levels and applies: wallpaper shader uniforms, taskbar pulse, window border glow intensity, particle speed | 2 hrs | 2.16, 2.1 | ⬜ | When music plays, wallpaper/taskbar/windows respond to beat |

### 2D. Music Player App

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 2.21 | Create `components/apps/music-player/MusicApp.tsx` — embedded YouTube iframe or audio element, playlist UI (Deep Focus, Chill Study, High Energy, Late Night), play/pause/next/prev, progress bar, volume | 2 hrs | 1.59, 2.16 | ⬜ | Music player opens as window, can play/pause, connects to audio analyzer |
| 2.22 | Create `components/apps/music-player/AudioVisualizer.tsx` — small circular/bar visualizer widget, pinnable to desktop, reads from audio store | 1.5 hrs | 2.16 | ⬜ | Visualizer moves with music in real-time |

### 2E. Cursor Effects

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 2.23 | Create custom SVG cursor files — crosshair.svg, pointer-glow.svg, grab.svg, loading-hex.svg (simple, small, with glow effect) | 1 hr | 1.1 | ⬜ | 4 SVG cursor files in public/cursors/ |
| 2.24 | Create `components/effects/CursorTrail.tsx` — canvas overlay, tracks mouse position, draws fading comet trail on fast movement | 1 hr | 1.1 | ⬜ | Moving mouse fast shows glowing trail |
| 2.25 | Integrate CursorManager with cursor SVGs + trail | 30 min | 1.70, 2.23, 2.24 | ⬜ | Different cursors per area + trail on fast move |

### 2F. Phase 2 Finalization

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 2.26 | Integration test — all wallpapers render, workspaces switch with animation, music plays with audio-reactive response, cursors work | 1.5 hrs | All 2.x | ⬜ | All Phase 2 features work together |
| 2.27 | Git commit: "Phase 2 complete — Wallpapers, Workspaces, Audio" | 5 min | 2.26 | ⬜ | Commit on GitHub |

---

## 📱 PHASE 3: CORE APPS (Week 5-8)

### 3A. Training Grounds (Learn anything)

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 3.1 | Create `data/learning/` sample deck ("Warrior OS Basics") — cards of every kind (MCQ, multi-select, numeric, flashcard) with options, answer, explanation, topic, difficulty | 2 hrs | 1.22 | ⬜ | Deck validates, seeds on first run, covers every card kind |
| 3.2 | Create `stores/useLearningStore.ts` — the user's decks → topics → cards, per-card review state, capped attempt log, mastery; seeds sample decks once, never over user edits | 2 hrs | 1.22 | ⬜ | Decks persist across reloads, sample deck appears once |
| 3.3 | Deck editor — create/rename/delete decks and topics, add/edit cards on any subject | 2 hrs | 3.2 | ⬜ | A new deck can be built from scratch and quizzed |
| 3.4 | Deck import/export as JSON (versioned format, validated on import) | 1.5 hrs | 3.2 | ⬜ | Export → import round-trips a deck; bad JSON shows a clear error |
| 3.5 | Optional starter decks for other topics (languages, CS basics, music theory…) — 15-20 cards each | 4 hrs | 1.22 | ⬜ | Every starter deck validates |
| 3.6 | Flashcard content — front/back cards (formula, definition, vocabulary) stored inside decks as `flashcard` cards | 2 hrs | 1.1 | ⬜ | Flashcards available for every deck that has them |
| 3.7 | Create `components/apps/training-grounds/TrainingGroundsApp.tsx` — main app with sidebar navigation: Decks, Skill Tree, Quiz, Mock Test, Flashcards, Review, Planner | 1.5 hrs | 1.59 | ⬜ | App opens as window with nav sidebar |
| 3.8 | Create `components/apps/training-grounds/QuizEngine.tsx` — select deck+topic → show cards one by one, MCQ / multi-select selection, numeric input, next/prev, submit, timer (optional), results screen with score + grade (S/A+/A/B/C) + explanation for wrong answers. Awards XP | 3 hrs | 3.1-3.5, 1.30 | ⬜ | Can take full quiz, get graded, see explanations, XP awarded |
| 3.9 | Create `components/apps/training-grounds/SkillTree.tsx` — force-directed graph (D3 or custom canvas): decks and topics as nodes, connections as edges, node color = mastery level (red→yellow→green), click node → opens quiz for that topic | 3 hrs | 3.8 | ⬜ | 3D-ish node graph renders, nodes are colored by mastery, click opens quiz |
| 3.10 | Create `components/apps/training-grounds/CardBrowser.tsx` — filter by deck, topic, difficulty and tag, card list, click to attempt, show answer + explanation | 1.5 hrs | 3.1-3.5 | ⬜ | Can filter cards, attempt them, see answers |
| 3.11 | Create `components/apps/training-grounds/MockTest.tsx` — timed test drawn from the chosen decks (question count + duration configurable), optional negative marking, auto-submit on timer end, detailed result analysis | 3 hrs | 3.8 | ⬜ | Mock test with timer, optional negative marking, auto-submit |
| 3.12 | Create `components/apps/training-grounds/FlashcardsApp.tsx` (the Flashcards app) — swipeable cards (touch/mouse), flip animation (front/back), bookmark, filter by deck and tag | 2 hrs | 3.6 | ⬜ | Cards swipe, flip, bookmark works |
| 3.13 | Create `components/apps/training-grounds/SpacedRepetition.tsx` — per-card review state, next review date from past answers, "due for review" queue sorted by urgency | 1.5 hrs | 1.37 | ⬜ | Due cards show correctly based on review history |
| 3.14 | Create `components/apps/training-grounds/Planner.tsx` — pick a target date and decks, auto-generate a daily plan across topics, show today's tasks, mark done | 2 hrs | 1.37 | ⬜ | Plan generates with even topic distribution |

### 3B. Notes Archive

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 3.15 | Create `components/apps/notes-archive/NotesApp.tsx` — split layout: sidebar (folder tree + search) + editor area | 1 hr | 1.59 | ⬜ | App opens with sidebar + editor |
| 3.16 | Create `components/apps/notes-archive/NotesList.tsx` — folder structure (subjects), note list with title + date + preview snippet, create new, delete, pin/favorite | 1.5 hrs | 1.37 | ⬜ | Notes list shows, can create/delete/pin |
| 3.17 | Create `components/apps/notes-archive/MarkdownEditor.tsx` — textarea with markdown input (left) + live rendered preview (right), syntax highlighting for code blocks, save to Firestore on Ctrl+S or auto-save | 2.5 hrs | 1.37 | ⬜ | Can type markdown, see live preview, saves to Firestore |
| 3.18 | Create `components/apps/notes-archive/SearchPanel.tsx` — full-text search across all notes, results highlight matching text, click to open note | 1 hr | 3.16 | ⬜ | Search returns matching notes with highlights |
| 3.19 | Create `components/apps/notes-archive/WikiLinks.tsx` — detect [[note title]] syntax in markdown, render as clickable links that open the referenced note | 1 hr | 3.17 | ⬜ | Typing [[name]] creates link, clicking opens that note |

### 3C. Habit Forge

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 3.20 | Create `components/apps/habit-forge/HabitForgeApp.tsx` — habit list + daily grid + add/edit/delete habits | 1 hr | 1.59 | ⬜ | App opens with habit list |
| 3.21 | Create `components/apps/habit-forge/HabitGrid.tsx` — GitHub-style grid: rows = habits, columns = days (past 30 days), cell = checked/unchecked, click to toggle today, streak count per habit | 2 hrs | 1.37 | ⬜ | Grid renders correctly, today is toggleable, streaks calculate |
| 3.22 | Create `components/apps/habit-forge/RoutineChecklist.tsx` — morning routine + evening routine checklists, check items off, reset daily | 1 hr | 1.37 | ⬜ | Checklist shows, items toggleable, resets next day |

### 3D. Stats Center

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 3.23 | Create `components/apps/stats-center/StatsCenterApp.tsx` — overview + charts + streaks + XP | 1 hr | 1.59 | ⬜ | App opens with multiple stat sections |
| 3.24 | Create `components/apps/stats-center/RadarChart3D.tsx` — spider/radar chart using Recharts showing subject-wise scores, slightly rotated 3D perspective | 1.5 hrs | 1.5 | ⬜ | Radar chart renders with subject scores |
| 3.25 | Create `components/apps/stats-center/HeatmapCalendar.tsx` — GitHub-style year heatmap of study activity, darker green = more hours, hover shows date + hours | 2 hrs | 1.37 | ⬜ | Heatmap renders with real data from Firestore |
| 3.26 | Create `components/apps/stats-center/XPSystem.tsx` — XP bar with current/next level, recent XP history list, level title display | 1 hr | 1.30 | ⬜ | XP bar shows progress, level title correct |
| 3.27 | Create `components/apps/stats-center/StreakBoard.tsx` — current streak flame animation, best streak record, streak history chart | 1 hr | 1.37 | ⬜ | Streak count correct, flame animates |
| 3.28 | Create `components/apps/stats-center/LevelProgress.tsx` — visual level badge, progress to next, milestone markers | 30 min | 1.30 | ⬜ | Level badge renders correctly |

### 3E. Settings

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 3.29 | Create `components/apps/settings/SettingsApp.tsx` — tabbed layout: Appearance, Sounds, Workspaces, NEXUS, Account | 1 hr | 1.51, 1.59 | ⬜ | Settings opens with tabs |
| 3.30 | Create `components/apps/settings/AppearanceTab.tsx` — wallpaper picker (grid thumbnails), accent color picker, glass opacity slider, CRT toggle, cursor trail toggle | 1.5 hrs | 1.28, 2.1 | ⬜ | Changing wallpaper updates desktop, accent color changes |
| 3.31 | Create `components/apps/settings/SoundsTab.tsx` — master toggle, volume slider, test sound button | 30 min | 1.28, 1.80 | ⬜ | Sound toggle works, volume changes, test plays |
| 3.32 | Create `components/apps/settings/AccountTab.tsx` — display name edit, avatar upload (Firebase Storage), email display, logout button, danger zone: delete account | 1 hr | 1.36, 1.37 | ⬜ | Name edits, avatar uploads, logout works |
| 3.32a | Create `components/apps/settings/WorkspacesTab.tsx` — rename workspaces, set default apps per workspace, set accent color per workspace | 45 min | 1.29, 2.11 | ⬜ | Workspace settings save and apply |
| 3.32b | Create `components/apps/settings/NexusTab.tsx` — enable/disable NEXUS suggestions, voice activation toggle, AI model selection, clear AI history | 45 min | 1.33, 4.3 | ⬜ | NEXUS settings save and apply |

### 3F. Terminal

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 3.33 | Create `components/apps/terminal/TerminalApp.tsx` — black bg, green monospace text, command input with blinking cursor, output history scroll, matrix-style typing effect on output | 2 hrs | 1.59 | ⬜ | Terminal looks hacker-style, can type commands |
| 3.34 | Create `components/apps/terminal/commands.ts` — command handler: help, clear, neofetch (ASCII art + stats), train [mode] [deck] (opens Training Grounds), note create <title>, stats today, habit check, expense add, theme set <name>, whoami, uptime, echo | 2 hrs | 1.27, 1.37 | ⬜ | All commands work and produce correct output |
| 3.35 | Create `components/apps/terminal/easter-eggs.ts` — sudo rm -rf /, matrix, hack nasa, rickroll, konami detection, jarvis response | 1 hr | 3.34 | ⬜ | Each easter egg triggers its special effect |

### 3G. Command Palette Enhancement

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 3.36 | Enhance CommandPalette with app launching, note searching, action executing (add expense, check habit, start quiz) from search results | 1 hr | 1.67 | ⬜ | Can launch apps + search notes + execute actions from Ctrl+K |

### 3H. Phase 3 Finalization

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 3.37 | Integration test — all 6 apps open as windows, data persists in Firestore, multi-window works, quiz awards XP, habits track streaks | 2 hrs | All 3.x | ⬜ | All Phase 3 features work together |
| 3.38 | Git commit: "Phase 3 complete — Core Apps" | 5 min | 3.37 | ⬜ | Commit on GitHub |

---

## 🤖 PHASE 4: NEXUS AI + ADVANCED APPS (Week 8-10)

### 4A. NEXUS AI System

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 4.1 | Create `app/api/ai/route.ts` — API route that proxies to Gemini/OpenAI, sends system prompt + user message + OS context, returns AI response | 1 hr | 0.9, 1.35 | ⬜ | POST request returns AI response |
| 4.2 | Create `data/nexus-personality.ts` — system prompt defining NEXUS personality: name, tone (direct, warrior-like, motivating), knowledge (CS, learning, the owner's projects), rules (always suggest action, be brief) | 30 min | 1.1 | ⬜ | System prompt is detailed, defines persona |
| 4.3 | Create `components/nexus/NexusCore.tsx` — processes commands: parses natural language intent (open app, search, start quiz, etc.), maps to OS actions, executes. Falls back to AI chat for unknown commands | 2.5 hrs | 4.1, 1.27, 1.33 | ⬜ | "open notes" opens Notes, "quiz me on <deck>" opens Training Grounds |
| 4.4 | Create `components/nexus/NexusSuggestions.tsx` — reads time, streak, last activity, open apps. Generates contextual suggestion. Shows in Dynamic Island or notification | 2 hrs | 1.33, 1.65, 1.31 | ⬜ | Suggestions appear at right moments (streak risk, break time, etc.) |
| 4.5 | Create `components/nexus/NexusChat.tsx` — chat UI inside an app window: message bubbles, typing indicator, markdown rendering in responses, suggested actions as buttons | 2 hrs | 4.1, 1.59 | ⬜ | Can chat with NEXUS, responses render properly |
| 4.6 | Create `components/nexus/NexusVoice.tsx` — Web Speech API: SpeechRecognition for input, SpeechSynthesis for output, activation phrase "Hey Warrior", shows listening indicator | 2 hrs | 1.1 | ⬜ | Voice input transcribes, "Hey Warrior" activates, speaks responses |
| 4.7 | Integrate NexusCore with CommandPalette — typing natural language in Ctrl+K routes through NEXUS for intent parsing | 1 hr | 4.3, 1.67 | ⬜ | Natural language commands work in command palette |
| 4.8 | Create smart modes — "study mode": opens Training Grounds + Notes, snaps left/right, starts pomodoro, changes wallpaper. "chill mode": closes study apps, opens music, aurora wallpaper | 1.5 hrs | 4.3, 1.26, 1.28 | ⬜ | Saying "study mode" in command bar triggers full mode setup |

### 4B. AI Assist App

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 4.9 | Create `components/apps/ai-assist/AIAssistApp.tsx` — full NEXUS chat interface as a windowed app, chat history, clear conversation, context toggle (send OS state to AI) | 1.5 hrs | 4.5 | ⬜ | AI Assist opens as window, full chat works |
| 4.10 | Create `components/apps/ai-assist/ChatInterface.tsx` — message list with glass bubbles, input with send button + Ctrl+Enter, AI typing indicator with dots animation, code block rendering | 1.5 hrs | 4.9 | ⬜ | Chat is visually polished, code blocks render |

### 4C. Algo Lab

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 4.11 | Create `data/algorithms/` — metadata for each algorithm: name, category, complexity, pseudocode, steps array | 1 hr | 1.1 | ⬜ | Algorithm data for 10+ algorithms |
| 4.12 | Create `components/apps/algo-lab/AlgoLabApp.tsx` — sidebar: select algorithm category + specific algo. Main area: visualizer + controls + code + complexity info | 1.5 hrs | 1.59 | ⬜ | App opens with algorithm selection + visualizer area |
| 4.13 | Create `components/apps/algo-lab/SortingVisualizer.tsx` — animated bar chart: bars colored by state (comparing=yellow, swapping=red, sorted=green), step-through mode, speed control, random/custom array input. Algorithms: Bubble, Selection, Insertion, Merge, Quick, Heap | 4 hrs | 4.12 | ⬜ | All 6 sorting algorithms visualize correctly with animations |
| 4.14 | Create `components/apps/algo-lab/GraphVisualizer.tsx` — canvas: nodes (circles) + edges (lines), click to add nodes, drag to create edges, run BFS/DFS/Dijkstra with step animation (visited=blue, current=yellow, path=green) | 4 hrs | 4.12 | ⬜ | Can create graph, run algorithms, see traversal animated |
| 4.15 | Create `components/apps/algo-lab/TreeVisualizer.tsx` — BST: insert/delete/search with animation, node highlighting, AVL auto-balance visualization, inorder/preorder/postorder traversal highlighted | 3 hrs | 4.12 | ⬜ | BST operations animate correctly |
| 4.16 | Create `components/apps/algo-lab/CodePanel.tsx` — Monaco editor (read-only) showing algorithm code, current line highlighted in sync with animation step | 1.5 hrs | 1.2 | ⬜ | Code highlights current executing line |
| 4.17 | Create `components/apps/algo-lab/CompareMode.tsx` — side-by-side two visualizers running same dataset, race to completion, timer for each | 2 hrs | 4.13 | ⬜ | Two sorting algorithms race side-by-side |

### 4D. Project Forge

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 4.18 | Create `components/apps/project-forge/ProjectForgeApp.tsx` — kanban view + project detail view | 1 hr | 1.59 | ⬜ | App opens with kanban board |
| 4.19 | Create `components/apps/project-forge/KanbanBoard.tsx` — 4 columns (Ideas, Building, Testing, Shipped), drag-n-drop cards between columns (@dnd-kit), add new project modal | 2.5 hrs | 1.23, 1.37 | ⬜ | Cards drag between columns, new projects addable |
| 4.20 | Create `components/apps/project-forge/ProjectCard.tsx` — glass card showing project name, tech stack badges, progress bar, last activity time. Click to expand detail | 1 hr | 1.39, 1.46 | ⬜ | Card shows all info, click expands |
| 4.21 | Create `components/apps/project-forge/TimeTracker.tsx` — start/stop timer per project, log time, show total hours per project this week | 1 hr | 1.37 | ⬜ | Timer starts/stops, time logs persist |

### 4E. Expense Vault

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 4.22 | Create `components/apps/expense-vault/ExpenseVaultApp.tsx` — overview (total, budget remaining) + add expense + chart + transaction list | 1 hr | 1.59 | ⬜ | App opens with expense overview |
| 4.23 | Create `components/apps/expense-vault/ExpenseEntry.tsx` — quick add: amount, category (dropdown: Food, Transport, Books, Entertainment, Other), note, date. Glass form | 1 hr | 1.48, 1.37 | ⬜ | Form submits, expense saved to Firestore |
| 4.24 | Create `components/apps/expense-vault/BudgetChart.tsx` — donut chart (Recharts) showing category-wise spending breakdown, monthly budget line | 1 hr | 1.5 | ⬜ | Donut chart renders with real data |
| 4.25 | Create `components/apps/expense-vault/TrendsGraph.tsx` — line chart: daily spending over past 30 days, budget limit line overlaid | 1 hr | 1.5 | ⬜ | Trend line shows with budget line |

### 4F. Calendar

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 4.26 | Create `components/apps/calendar/CalendarApp.tsx` — month view grid, events as colored dots/bars, today highlighted, prev/next month navigation | 2 hrs | 1.59, 1.37 | ⬜ | Calendar renders current month, events show |
| 4.27 | Create `components/apps/calendar/EventModal.tsx` — add/edit event: title, date, time, category (Study/Project/Personal), color, recurring toggle | 1 hr | 1.49, 1.37 | ⬜ | Events create/edit/delete, persist |

### 4G. Phase 4 Finalization

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 4.28 | Integration test — NEXUS commands work, all advanced apps open, data persists, voice works (if Chrome), study mode/chill mode work | 2 hrs | All 4.x | ⬜ | All Phase 4 features work together |
| 4.29 | Git commit: "Phase 4 complete — NEXUS AI + Advanced Apps" | 5 min | 4.28 | ⬜ | Commit on GitHub |

---

## ✨ PHASE 5: POLISH, ACHIEVEMENTS & DEPLOY (Week 10-12)

### 5A. Achievement System

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 5.1 | Create `components/effects/AchievementCinematic.tsx` — gold screen flash → vignette → orb descends → explodes into badge → badge spins 3D → title fades in → XP ticks up → confetti (canvas-confetti) → returns to normal (4s total) | 3 hrs | 1.30, 1.5 | ⬜ | Full cinematic plays smoothly on achievement unlock |
| 5.2 | Create `components/effects/LevelUpEffect.tsx` — XP bar fills to max → flash → level number changes with scale-up + glow | 1 hr | 1.30 | ⬜ | Level up animation triggers at correct XP threshold |
| 5.3 | Wire achievement checks to all relevant actions — quiz complete, note create, streak update, login, shortcut use, etc. | 2 hrs | 5.1, 1.75 | ⬜ | Achievements trigger at correct moments |
| 5.4 | Create achievement gallery in Stats Center — all badges (locked = gray, unlocked = colored), click to see details | 1 hr | 5.3, 3.23 | ⬜ | Gallery shows all achievements with status |

### 5B. Special Effects

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 5.5 | Create `components/effects/ScreenShatter.tsx` — canvas: screen image captures, breaks into triangle shards, shards fly out with physics (gravity + velocity) | 2 hrs | 1.56 | ⬜ | Lock screen shatters on unlock |
| 5.6 | Create `components/effects/GlitchTransition.tsx` — RGB split + noise + displacement map between OS phases (boot→lock→desktop) | 1 hr | 1.83 | ⬜ | Glitch effect visible during transitions |
| 5.7 | Create `components/effects/ParticleAssembly.tsx` — particles from random positions fly to form "WARRIOR" text, each particle is a small glowing dot | 2 hrs | 1.55 | ⬜ | Text assembles from particles smoothly |
| 5.8 | Create `components/effects/DisintegrateEffect.tsx` — window close: capture window to canvas, break into pixel blocks, scatter with random velocity + fade | 2 hrs | 1.60 | ⬜ | Window disintegrates on close (optional per settings) |

### 5C. Resume Builder

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 5.9 | Create `components/apps/resume-builder/ResumeApp.tsx` — left: form editor, right: live PDF preview | 1 hr | 1.59 | ⬜ | App opens with editor + preview split |
| 5.10 | Create `components/apps/resume-builder/ResumeEditor.tsx` — form sections: personal info, education, skills, projects (auto-fill from Project Forge), experience, achievements | 2 hrs | 1.37 | ⬜ | All sections editable, projects pull from Forge |
| 5.11 | Create `components/apps/resume-builder/ResumePreview.tsx` — live-rendered resume in clean template, HTML → PDF export via browser print | 2 hrs | 5.10 | ⬜ | Preview updates live, PDF export works |

### 5D. Desktop Widgets

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 5.12 | Create clock widget — digital clock + date, glass style, draggable on desktop, toggleable | 30 min | 1.77 | ⬜ | Clock renders on desktop, draggable |
| 5.13 | Create streak widget — fire emoji + streak count + "days" label, pulses | 30 min | 1.37 | ⬜ | Streak shows correct count |
| 5.14 | Create today's target widget — today's study target text + progress bar | 45 min | 1.37 | ⬜ | Target and progress show |

### 5E. Weather Integration

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 5.15 | Create `lib/weather.ts` — fetch current weather from OpenWeatherMap API using geolocation or default city | 30 min | 0.8 | ⬜ | Returns temp + condition + icon |
| 5.16 | Create `app/api/weather/route.ts` — proxy to hide API key | 20 min | 5.15 | ⬜ | API route returns weather data |
| 5.17 | Integrate weather on lock screen — show temp + icon | 20 min | 5.16, 1.56 | ⬜ | Lock screen shows current weather |

### 5F. PWA Setup

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 5.18 | Install next-pwa: `npm i next-pwa` | 5 min | 1.1 | ⬜ | Package installed |
| 5.19 | Create `public/manifest.json` — app name, icons, theme color, display: standalone | 15 min | 5.18 | ⬜ | Manifest valid |
| 5.20 | Configure next.config.js for PWA | 15 min | 5.19 | ⬜ | Service worker generates |
| 5.21 | Create app icons (192x192, 512x512) | 20 min | 5.19 | ⬜ | Icons in public/ |
| 5.22 | Test PWA install — Chrome shows "Install" option | 15 min | 5.21 | ⬜ | App installs as standalone window |

### 5G. Performance & Polish

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 5.23 | Lazy load all app components with `dynamic(() => import(...), { ssr: false })` | 1 hr | All apps | ⬜ | Apps load on demand, initial bundle size reduced |
| 5.24 | Add React.memo to Desktop icons, window list, taskbar items | 30 min | 1.57, 1.62 | ⬜ | No unnecessary re-renders |
| 5.25 | Add loading states — skeleton/spinner when app content loads | 30 min | 5.23 | ⬜ | Loading indicator shows while app loads |
| 5.26 | Test all keyboard shortcuts work correctly (Ctrl+K, Ctrl+1/2/3, Esc, etc.) | 30 min | 1.78 | ⬜ | All shortcuts work |
| 5.27 | Polish all micro-interactions — verify 50+ interactions from WARRIOR_HUB.md spec | 2 hrs | All | ⬜ | Each interaction is smooth and satisfying |
| 5.28 | Responsive check — ensure OS doesn't break on different screen sizes (min: 1024px width) | 1 hr | All | ⬜ | Looks correct on 1024px to 1920px+ |
| 5.29 | Browser testing — Chrome (primary), Firefox, Edge | 1 hr | All | ⬜ | Works on all 3 browsers |

### 5H. Deployment

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 5.30 | Create Vercel account (if not exists) | 5 min | All | ⬜ | Vercel account active |
| 5.31 | Connect GitHub repo to Vercel | 10 min | 5.30, 1.8 | ⬜ | Repo linked in Vercel dashboard |
| 5.32 | Add environment variables on Vercel (same as .env.local) | 10 min | 5.31, 1.35 | ⬜ | All env vars added in Vercel |
| 5.33 | Deploy — verify production build works | 15 min | 5.32 | ⬜ | Site live on vercel.app URL |
| 5.34 | (Optional) Connect custom domain | 10 min | 5.33 | ⬜ | Custom domain resolves to site |
| 5.35 | Final production test — full flow: boot → login → all apps → NEXUS → voice → achievements | 1 hr | 5.33 | ⬜ | Everything works on production |
| 5.36 | Git commit: "Phase 5 complete — Polish & Deploy" | 5 min | 5.35 | ⬜ | Commit on GitHub |

---

## 🐉 PHASE 6: GOD-LEVEL FEATURES — THE LIVING WORLD (Week 12-17)

> **Ye 8 features internet pe exist nahi karte. Kisi ke project mein nahi milenge.**  
> **Ye literally uncharted territory hai. Tu ise build karega toh CATEGORY CREATOR banega.**

### 6A. New Types for Phase 6

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 6.1 | Create `types/creature.ts` — CreatureState (id, name, stage: egg/baby/teen/adult/legendary/mythic, form: phoenix/serpent/dragon, mood: happy/sad/sleeping/excited, xp, level, birthDate, dominantActivity) | 15 min | 1.1 | ⬜ | Type exports without TS errors |
| 6.2 | Create `types/biometrics.ts` — BiometricState (energy, focus, fatigue, stress — all 0-100), TypingMetrics (wpm, errorRate, pauseAvg, rhythmScore), BiometricSnapshot (timestamp, state) | 15 min | 1.1 | ⬜ | Type exports without TS errors |
| 6.3 | Create `types/ghost.ts` — GhostWarrior (anonymousId, studyHoursToday, quizzesToday, streak, isOnline, lastSeen), WarCry (id, message, timestamp, anonymousId), CampfireState (onlineCount, fireIntensity) | 15 min | 1.1 | ⬜ | Type exports without TS errors |
| 6.4 | Create `types/phantom.ts` — PhantomWindow (id, snapshot: HTMLImageElement, appId, position, size, createdAt, state, windowData), PhantomConfig (fadeDuration, maxPhantoms) | 10 min | 1.1 | ⬜ | Type exports without TS errors |
| 6.5 | Create `types/dream.ts` — DreamScene (elements[], bgColor, ambientText, narration, duration), DreamElement (type: floating-object/particle/text, content, position, animation, subjectTheme) | 15 min | 1.1 | ⬜ | Type exports without TS errors |

### 6B. New Stores for Phase 6

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 6.6 | Create `stores/useCreatureStore.ts` — creature state, feedXP(), evolve(), setMood(), checkEvolution(), getDominantActivity(), getEvolutionForm() | 25 min | 6.1 | ⬜ | Creature XP adds, mood changes, evolution checks work |
| 6.7 | Create `stores/useBiometricsStore.ts` — current biometric state, history[], updateMetrics(), getAverages(), resetSession() | 20 min | 6.2 | ⬜ | Biometric values update in real-time |
| 6.8 | Create `stores/useGhostStore.ts` — onlineWarriors[], campfireState, warCries[], addWarCry(), updatePresence(), getLeaderboard() | 20 min | 6.3 | ⬜ | Online count updates, war cries queue works |
| 6.9 | Create `stores/usePhantomStore.ts` — phantoms[], addPhantom(), removePhantom(), resurrectPhantom(), getActivePhantoms() | 15 min | 6.4 | ⬜ | Phantoms add/remove/resurrect correctly |
| 6.10 | Create `stores/useDecayStore.ts` — continuousStudyMinutes, decayStage (0-5), isOnBreak, startTracking(), resetDecay(), triggerBreak(), repairOS() | 20 min | 1.1 | ⬜ | Decay stage progresses with time, resets on break |
| 6.11 | Create `stores/useMusicGenStore.ts` — isGenerating, currentMood (morning/study/coding/night), typingBPM, setMood(), updateTypingRhythm() | 15 min | 1.1 | ⬜ | Music generation state tracks correctly |

### 6C. New Hooks for Phase 6

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 6.12 | Create `hooks/useTypingBiometrics.ts` — global keydown/keyup listener, calculates real-time WPM, error rate (backspace frequency), pause duration between keystrokes, rhythm consistency (std deviation of intervals). Updates useBiometricsStore every 5s | 30 min | 6.7 | ⬜ | Typing speed/errors/pauses tracked accurately |
| 6.13 | Create `hooks/useDecayEngine.ts` — starts timer on first keystroke/click, increments continuousStudyMinutes, triggers decay stages at thresholds (120/150/180/210/240 min), pauses during breaks, resets after break | 25 min | 6.10 | ⬜ | Decay stages trigger at correct time thresholds |
| 6.14 | Create `hooks/useProceduralMusic.ts` — initializes Tone.js synths, exposes generate(mood), stop(), handles typing rhythm input, auto-selects mood based on time + activity | 30 min | 6.11, 1.2 | ⬜ | Calling generate('morning') plays procedural music |
| 6.15 | Create `hooks/useGhostPresence.ts` — Firebase Realtime Database onDisconnect handler, writes anonymous presence, listens for other warriors' presence changes, auto-cleanup offline warriors | 25 min | 6.8, 1.34 | ⬜ | Online count updates when test tabs open/close |

### 6D. 🐉 Warrior Creature — Digital Pet That Evolves With You

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 6.16 | Create `components/creature/CreatureEngine.tsx` — state machine with 6 stages: Egg (day 0-2, 0 XP) → Baby (day 3+, 100 XP) → Teen (500 XP) → Adult (2000 XP) → Legendary (10000 XP) → Mythic (50000 XP). Tracks dominant activity type (study hours vs coding hours vs balanced) for evolution form | 1.5 hrs | 6.6, 1.30 | ⬜ | Stage transitions trigger at correct XP thresholds |
| 6.17 | Create `components/creature/CreatureRenderer.tsx` — Canvas sprite animation system. Creature sits on taskbar (right side, near system tray). States: idle (breathing animation), happy (bounces + sparkles), sad (dims + shivers), sleeping (ZzZ floating text), dance (spins + flames/sparkles), eating (nom animation when XP gained). Each evolution stage has different visual (size grows, details increase, effects intensify) | 3 hrs | 6.16 | ⬜ | Creature visible on taskbar, animates per state, changes appearance per stage |
| 6.18 | Create `components/creature/CreatureEvolution.tsx` — 3 evolution forms based on dominant activity: Scholar Phoenix (study dominant — blue fire bird + book wings + floating formulas), Code Serpent (coding dominant — green circuit-pattern snake + binary rain), Warrior Dragon (balanced — red+gold dragon + armor plating + flame breath). Form determination runs on each level-up | 2 hrs | 6.17 | ⬜ | Creature shows correct form based on activity dominance |
| 6.19 | Create `components/creature/CreatureReactions.tsx` — event listener that triggers creature animations: quiz complete → happy + jump, 100% quiz → victory dance + flames, streak break → sad + dims + shiver, user idle 2+ hours → falls asleep on taskbar + ZzZ, window open → curious look, achievement unlock → excited spin, 5+ hour study → golden aura for rest of day | 1.5 hrs | 6.17 | ⬜ | Each event triggers correct creature reaction |
| 6.20 | Create `components/creature/CreatureStats.tsx` — click creature → glass popup showing: creature name (user-editable), current form + sprite, level + XP bar, mood indicator, days alive counter, evolution progress (bar to next stage), dominant activity breakdown (pie chart), total interactions count | 1 hr | 6.17, 1.39 | ⬜ | Popup shows all creature stats correctly |
| 6.21 | Create `components/creature/CreatureHatch.tsx` — Day 1 cinematic: glowing egg appears on taskbar → pulses for 2 days → day 3: cracks appear → light bursts through cracks → egg shatters → particle explosion → baby creature emerges → creature does first happy animation → NEXUS: "Your companion has arrived. Take care of it." + achievement unlock "First Pet" | 2 hrs | 6.17, 5.1 | ⬜ | Full hatching cinematic plays on day 3, achievement triggers |
| 6.22 | Integrate creature XP with user XP — every XP gain event also feeds creature, creature moods affect Dynamic Island display (sad creature = amber warning), creature level shows in lock screen next to user level | 1 hr | 6.16, 1.30, 1.65, 1.56 | ⬜ | Creature XP syncs with user XP, mood shows in Dynamic Island |

### 6E. 🏛️ Memory Palace — 3D Walkable Knowledge Space

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 6.23 | Create `components/apps/memory-palace/MemoryPalaceApp.tsx` — React Three Fiber scene as app window, first-person camera with PointerLockControls, WASD movement (W=forward, S=back, A=left, D=right), mouse look, gravity + collision detection with floor/walls | 3 hrs | 1.59 | ⬜ | 3D scene renders in window, can walk around with WASD, mouse look works |
| 6.24 | Create `components/apps/memory-palace/PalaceRoomGenerator.tsx` — procedural room generation per note subject (any topic), themed from the subject: e.g. databases = dark library with wooden shelves + floating SQL, systems = server room with rack cabinets + blinking LEDs, networks = network lab with glowing cables + router models, theory = abstract math space with floating automata, data structures = warehouse with stacked data structures, algorithms = laboratory with sorting tubes, anything else = a themed study hall. Each room: textured walls, ambient lighting, subject-colored accent glow | 4 hrs | 6.23 | ⬜ | Each subject has visually distinct themed room |
| 6.25 | Create `components/apps/memory-palace/KnowledgeObject.tsx` — 3D objects on room shelves representing notes. Object shape = note type (cube=concept, scroll=formula, sphere=question). Glow intensity = revision recency: bright cyan (revised today), medium (this week), dim orange (this month), almost dark + cobweb particles (never revised). Hover shows note title floating above | 2 hrs | 6.24, 1.37 | ⬜ | Objects render on shelves, glow based on revision dates, hover shows title |
| 6.26 | Create `components/apps/memory-palace/PalaceNavigation.tsx` — corner minimap (top-down 2D view of all rooms), room labels floating above doorways, click room on minimap → teleport (camera flies through corridors to target room), breadcrumb trail showing visited rooms | 2 hrs | 6.24 | ⬜ | Minimap shows room layout, clicking teleports, breadcrumbs show path |
| 6.27 | Create `components/apps/memory-palace/NoteHologram.tsx` — click a knowledge object → it lifts off shelf → rotates to face you → unfolds into a floating holographic glass panel showing the note content (markdown rendered). Close button dissolves it back to shelf. Can have multiple holograms open simultaneously | 2 hrs | 6.25, 3.17 | ⬜ | Clicking object opens floating note panel in 3D space |
| 6.28 | Create `components/apps/memory-palace/PalaceGrowth.tsx` — palace starts small (1 room = your first subject). Every 10 notes = new room unlocked. Every 50 notes = corridor extensions. Every 100 notes = new wing. After 500+ notes = grand hall with chandelier + statues. Growth is animated when new room unlocks (walls build up brick by brick) | 2 hrs | 6.24, 1.37 | ⬜ | Note count determines palace size, new room animation plays |
| 6.29 | Integrate Memory Palace with Notes Archive data + Spaced Repetition urgency — objects turn RED border when spaced repetition says "due for revision", palace overview screen shows total objects, rooms, revision urgency summary | 1 hr | 6.25, 3.13, 3.16 | ⬜ | Palace reflects actual notes data, urgency colors match spaced repetition |

### 6F. 👻 Ghost Warriors — Anonymous Multiplayer Presence

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 6.30 | Setup Firebase Realtime Database — rules: anonymous write to /presence/{id} and /warcries/{id}, read all. Add `NEXT_PUBLIC_FIREBASE_DATABASE_URL` to .env.local. Enable Realtime Database in Firebase console | 15 min | 1.34, 1.35 | ⬜ | Realtime Database accessible from app |
| 6.31 | Create `components/ghost/GhostPresenceEngine.tsx` — on login: generate anonymous warrior ID (Warrior#XXXX), write to /presence with {studyHoursToday, quizzesToday, streak, lastActive}. Use onDisconnect().remove() for automatic cleanup. Listen to /presence for all warriors. Update every 5 minutes | 1.5 hrs | 6.15, 6.30 | ⬜ | Opening 2 tabs shows 2 warriors online, closing 1 reduces count |
| 6.32 | Create `components/ghost/GhostAvatars.tsx` — tiny translucent figure sprites (20x30px, 15% opacity) that walk slowly across desktop bottom area. Number of sprites = min(onlineCount, 10). Random walk paths, fade in when warrior joins, fade out when leaves. CSS animation with random delays | 1.5 hrs | 6.31 | ⬜ | Ghost figures walk across desktop, count matches online warriors |
| 6.33 | Create `components/ghost/WarriorLeaderboard.tsx` — glass panel widget (toggleable from system tray), shows "Today's Top Warriors": top 10 anonymous warriors sorted by study hours, shows Warrior#ID, hours, quizzes, streak. Your own rank highlighted. Updates real-time | 1.5 hrs | 6.31, 1.39 | ⬜ | Leaderboard shows anonymous ranked warriors, own rank highlighted |
| 6.34 | Create `components/ghost/CampfireWidget.tsx` — small canvas widget on desktop showing pixel-art campfire. Flame size/brightness scales with online warrior count (1=tiny ember, 5=small fire, 10=bonfire, 20+=inferno with sparks). Warrior silhouettes sit around fire. Ambient crackling sound (if sound enabled). Draggable on desktop | 2 hrs | 6.31, 1.80 | ⬜ | Campfire renders, flame scales with online count, silhouettes appear |
| 6.35 | Create `components/ghost/WarCrySystem.tsx` — button in campfire/leaderboard to send anonymous war cry. Pre-made options ("LET'S GO! 🔥", "Never give up! ⚔️", "OS done! 📚") + custom text (max 50 chars). War cries appear as floating glass bubbles on ALL online warriors' desktops, drift upward + fade in 5s. Max 3 visible at once, queue rest. Rate limit: 1 per 2 minutes per user | 2 hrs | 6.31, 1.39 | ⬜ | Sending war cry appears on own desktop, would appear on others too |
| 6.36 | Create `components/ghost/OnlineCounter.tsx` — system tray badge showing warrior count with subtle pulse animation. Click → opens leaderboard. Tooltip: "47 Warriors studying right now" | 30 min | 6.31, 1.63 | ⬜ | Counter shows in system tray, updates real-time, click opens leaderboard |

### 6G. 💀 Reality Decay Engine — The OS Fights Back

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 6.37 | Create `components/decay/DecayEngine.tsx` — master controller: starts continuous-study timer on first user interaction after boot/break, reads from useDecayStore, orchestrates all decay stage components, pauses timer during idle (no interaction for 10 min = auto-pause) | 1.5 hrs | 6.13 | ⬜ | Timer starts on interaction, stages trigger at correct minutes |
| 6.38 | Create `components/decay/DecayStage1.tsx` (120 min) — CSS filter: hue-rotate(5deg) + saturate(0.95) on entire desktop. Very subtle warmth shift. User should barely notice | 30 min | 6.37 | ⬜ | Colors shift very slightly warm at 2 hours |
| 6.39 | Create `components/decay/DecayStage2.tsx` (150 min) — particles on wallpaper slow to 50% speed, all text gets 0.3px blur filter, window glass opacity increases 5%. Subtle enough to feel "something is off" | 30 min | 6.37 | ⬜ | Particles visibly slower, slight text softness |
| 6.40 | Create `components/decay/DecayStage3.tsx` (180 min) — red/orange vignette on screen edges (CSS radial-gradient overlay with pointer-events:none), intensity increases over 15 min. Desktop accent shifts from cyan toward amber | 45 min | 6.37 | ⬜ | Red vignette visible at screen edges, accent color warming |
| 6.41 | Create `components/decay/DecayStage4.tsx` (210 min) — faint heartbeat sound plays (Howler, 0.1 volume, repeating). Taskbar develops micro-vibration (CSS animation translateX ±0.5px). NEXUS notification: "Warrior. Your focus is legendary. But your body is mortal." | 45 min | 6.37, 1.80 | ⬜ | Heartbeat audible, taskbar vibrates subtly, NEXUS warning appears |
| 6.42 | Create `components/decay/DecayStage5.tsx` (240 min) — hairline "cracks" appear across desktop (SVG overlay with crack paths). Windows vibrate on interaction. NEXUS force-triggers break: "5-minute break. NOW." — opens BreakMode, blocks app interaction | 1 hr | 6.37, 4.3 | ⬜ | Screen cracks visible, interaction blocked, BreakMode opens |
| 6.43 | Create `components/decay/BreakMode.tsx` — full-screen overlay: deep blue calming gradient. Animated breathing circle (expand 4s hold 7s contract 8s — 4-7-8 technique). Stretching tips carousel ("Roll your shoulders", "Look at something 20 feet away", "Stand up and stretch"). 5-minute countdown timer. Cannot skip (Esc disabled). Soft ambient sound | 1.5 hrs | 6.42 | ⬜ | Break screen covers everything, breathing circle animates, timer counts down, cannot be dismissed early |
| 6.44 | Create `components/decay/DecayRepair.tsx` — after break completes: crack lines animate closing (SVG path animation reverse), red vignette fades to transparent over 3s, colors shift back to normal (hue-rotate back to 0), particles resume full speed, NEXUS: "Systems restored. Ready for battle." + 50 XP bonus for taking break | 1 hr | 6.43 | ⬜ | All decay effects reverse smoothly, OS looks normal again, XP awarded |
| 6.45 | Add decay settings in Settings app — toggle decay engine on/off, adjust time thresholds (+30/-30 min slider), break duration (3/5/10 min), show current continuous study time in system tray | 30 min | 6.37, 3.29 | ⬜ | Decay can be toggled, thresholds adjustable |

### 6H. 🎵 Procedural Music Engine — OS Composes For You

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 6.46 | Create `lib/procedural-music/tone-setup.ts` — Tone.js initialization: create PolySynth (piano), FMSynth (pad), MembraneSynth (kick), MetalSynth (hihat), NoiseSynth (rain/wind), Reverb + Delay effects chain. Pentatonic scale arrays (C, D, E, G, A in multiple octaves) | 1 hr | 1.2 | ⬜ | Tone.js initializes, each synth produces sound |
| 6.47 | Create `lib/procedural-music/morning-gen.ts` — generates morning music: random arpeggios from C major pentatonic (piano), tempo 80bpm, soft pad drone on C3, occasional bell chime (random interval 8-15s), pattern changes every 30s (never repeats exactly). Light and uplifting feel | 1.5 hrs | 6.46 | ⬜ | Morning music plays indefinitely, sounds pleasant, varies over time |
| 6.48 | Create `lib/procedural-music/study-ambient-gen.ts` — generates study ambient: very low drone on C2 (pad), rain noise (filtered white noise), distant bell hits every 20-40s (randomized), no rhythm/beat, ultra-minimal, designed to fade into background. Lower volume than other modes | 1.5 hrs | 6.46 | ⬜ | Ambient plays, is non-distracting, rain sound present |
| 6.49 | Create `lib/procedural-music/typing-rhythm-gen.ts` — captures keystroke timestamps from useTypingBiometrics, calculates average interval → converts to BPM (capped 60-140 BPM). Generates lo-fi beat: kick on 1+3, snare on 2+4, hihat on every 8th note, bass follows pentatonic root. YOUR typing rhythm = the beat. If you stop typing → beat gradually fades over 4s, resumes when you type again | 2.5 hrs | 6.46, 6.12 | ⬜ | Typing creates a beat, BPM matches typing speed, stopping typing fades beat |
| 6.50 | Create `lib/procedural-music/night-ambient-gen.ts` — deep bass drone (C1, very low), wind noise (filtered brown noise with slow LFO), distant low rumbles every 30-60s, dark and atmospheric. If study hours > 4 today, adds subtle heroic pad swell every 2 min | 1.5 hrs | 6.46 | ⬜ | Night ambient is dark/atmospheric, wind audible, conditional hero swell works |
| 6.51 | Create `components/music/ProceduralMusicPlayer.tsx` — tab/section in Music Player app: mode selector (Morning/Deep Study/Typing Rhythm/Night), play/stop, volume, "randomize seed" button (generates new pattern), visual indicator showing currently generated notes (bouncing dots on a staff) | 1.5 hrs | 6.47, 6.48, 6.49, 6.50, 2.21 | ⬜ | Can switch between 4 modes, each generates unique music, visual indicator moves |
| 6.52 | Create `components/music/MoodShift.tsx` — event-driven music modifications: achievement unlocked → major chord swell + octave up for 3s, streak broken → minor chord shift + tempo slows for 5s, level up → triumphant brass-like FM chord + rising arpeggio, decay stage increase → add dissonance + lower pitch | 1 hr | 6.51, 1.30, 6.37 | ⬜ | Each event causes audible music shift |
| 6.53 | Auto-mood selection: morning (6AM-12PM) → morning gen, afternoon (12PM-6PM) → study ambient, evening (6PM-10PM) → night ambient, active typing → typing rhythm overrides. Toggle auto-mood in settings | 30 min | 6.51, 1.77 | ⬜ | Music mood auto-switches with time, typing overrides |

### 6I. 👻 Phantom Windows — Ghosts of Closed Apps

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 6.54 | Create `components/phantom/PhantomEngine.tsx` — hooks into window close event from useWindowStore. On close: captures window DOM as image (html2canvas or rasterize DOM clone to canvas → toDataURL), saves snapshot + window state (position, size, appId, scroll position, form data) to usePhantomStore. Max 5 phantoms at a time (oldest auto-expires) | 1.5 hrs | 6.9, 1.26 | ⬜ | Closing window creates phantom with snapshot image |
| 6.55 | Create `components/phantom/PhantomRenderer.tsx` — renders all active phantoms on desktop layer (above wallpaper, below real windows). Each phantom: shows captured image at 30% opacity, slight blue-white tint, slow upward drift (CSS translateY -2px/s), subtle edge glow, "ghost" visual filter (slight blur + brightness boost). 8-second total lifetime | 1.5 hrs | 6.54 | ⬜ | Ghost afterimage visible where window was, drifts up, looks translucent |
| 6.56 | Create `components/phantom/PhantomResurrect.tsx` — click on phantom → flash effect → window RESURRECTS at phantom's current position with full state (reopens same app, restores scroll/form data if possible). Resurrection sound effect (reverse of close sound). Phantom disappears. NEXUS: "Resurrected." | 1 hr | 6.55, 1.27, 1.80 | ⬜ | Clicking phantom reopens the app window with state |
| 6.57 | Create `components/phantom/PhantomDissolve.tsx` — if phantom not clicked within 8s: phantom breaks into pixel-block particles that scatter outward + fade (similar to window disintegrate but slower, more ethereal). Particle color matches app accent. Gentle whoosh sound | 1 hr | 6.55 | ⬜ | Uncliked phantom dissolves into particles after 8s |

### 6J. 🧠 Typing Biometrics — OS Reads Your Mental State

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 6.58 | Create `components/biometrics/TypingTracker.tsx` — global component (mounted once in layout). Listens to all keydown/keyup events. Tracks: keystrokes per rolling 60s window (→ WPM), backspace/delete frequency per 100 keystrokes (→ error rate), time gaps between keystrokes (→ pause patterns), standard deviation of keystroke intervals (→ rhythm consistency). Uses requestAnimationFrame for efficient processing | 1.5 hrs | 6.12 | ⬜ | Can see real-time WPM, error rate updating in devtools/store |
| 6.59 | Create `lib/biometric-calculator.ts` — pure functions: calcEnergy(wpm) → 0-100 (fast=high, mapped with curve), calcFatigue(errorRate, sessionDuration) → 0-100 (more errors + longer session = higher), calcFocus(avgPauseDuration, pauseFrequency) → 0-100 (fewer/shorter pauses = higher focus), calcStress(rhythmStdDev, errorRate) → 0-100 (erratic rhythm + errors = stressed). All use sigmoid/exponential curves for natural feel | 1 hr | 6.2 | ⬜ | Each function returns reasonable 0-100 value for test inputs |
| 6.60 | Create `components/biometrics/VitalsWidget.tsx` — desktop widget (glass panel, draggable). Shows 4 horizontal bars with icons: ⚡ Energy [████████░░] 82%, 🎯 Focus [██████████] 97%, 💤 Fatigue [██░░░░░░░░] 18%, 😤 Stress [███░░░░░░░] 29%. Bars are color-coded (energy=cyan, focus=green, fatigue=amber, stress=red). Update every 5 seconds with smooth transition animation. Pulse glow when a value changes significantly (>20% jump) | 1.5 hrs | 6.59, 6.7 | ⬜ | Widget shows 4 bars, values update as you type, smooth transitions |
| 6.61 | Create `components/biometrics/BiometricHistory.tsx` — store daily biometric snapshots (avg energy, focus, fatigue, stress at hourly intervals) to Firestore. Charts view: line graph showing "Your Focus Pattern This Week" (x=hours of day, y=focus level, line per day). Shows when you're most/least focused. Heatmap: days × hours grid with focus intensity | 2 hrs | 6.59, 1.37 | ⬜ | Historical data saves, charts render with real patterns |
| 6.62 | NEXUS biometric integration — NEXUS reads current biometrics + history. Suggestions: "Your focus peaks at 3 PM — schedule hard topics there", "Fatigue rising — consider a break", "You're in the zone! Keep going 💪", "High stress detected — try the breathing exercise". Shows in Dynamic Island or notification | 1 hr | 6.59, 4.4, 1.65 | ⬜ | NEXUS gives biometric-based suggestions at appropriate moments |

### 6K. 🌅 NEXUS Dreams — Daily Cinematic Recap

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 6.63 | Create `components/dream/DreamEngine.tsx` — on app load, reads yesterday's activity data from Firestore (subjects studied, hours, quizzes taken, projects worked on, streak status). Generates DreamScene config: selects visual elements, colors, narration text based on activity. No activity yesterday → void/dark dream | 1.5 hrs | 6.5, 1.37 | ⬜ | Dream config generates correctly from activity data |
| 6.64 | Create `components/dream/DreamRenderer.tsx` — full-screen Canvas/WebGL scene, 5-second duration. Renders floating objects related to yesterday's study (DBMS → floating tables with glowing SQL text, OS → spinning process diagrams, CN → network packet trails, Algo → sorting bars re-arranging, nothing → dark void with distant stars). Objects drift slowly, have soft glow, particle trails behind them. Ambient color = subject's accent | 3 hrs | 6.63 | ⬜ | Dream plays for 5s with subject-relevant visuals, looks cinematic |
| 6.65 | Create `data/dream-themes.ts` — mapping subject → dream elements: {subject: 'DBMS', objects: ['floating-table', 'sql-query-text', 'er-diagram-web', 'database-cylinder'], color: '#4FC3F7', ambient: 'digital-hum'}, {subject: 'idle', objects: ['void-particles', 'distant-stars', 'dark-fog'], color: '#1a1a2e', narration: 'The void grows when you rest too long...'}, etc. for all subjects + edge cases (project work, exam prep, mixed) | 45 min | 6.63 | ⬜ | All subjects have dream theme config, idle/mixed cases covered |
| 6.66 | Create `components/dream/DreamNarration.tsx` — during dream, NEXUS whispper text fades in at bottom-center. Text based on activity: studied hard → "Your knowledge grew stronger yesterday", coded → "The code flows through your veins", idle → "The void grows when you rest too long...", streak maintained → "The fire burns eternal", streak broken → "A flame extinguished. Will you relight it?". Text fades in over 1s, stays 3s, fades out over 1s. Orbitron font, 50% opacity | 1 hr | 6.64 | ⬜ | Narration text appears during dream, matches activity |
| 6.67 | Create `components/dream/DreamTransition.tsx` — dream scene fades to black over 0.5s → 0.5s pure black → lock screen fades in from black. If first-ever login (no yesterday data) → skip dream, go straight to boot. If user was offline for 3+ days → special "void dream" with deeper darkness + concerned NEXUS narration | 45 min | 6.64, 1.56 | ⬜ | Dream → lock transition is seamless, first login skips dream |
| 6.68 | Integrate dreams into boot flow — update page.tsx state machine: boot → dream (if returning user) → lock → desktop. Boot screen only plays on first load. Returning users (already logged in via Firebase persistent auth) get: dream → lock → desktop. Toggle dreams on/off in Settings | 1 hr | 6.67, 1.83, 3.29 | ⬜ | Returning user sees dream before lock screen, new user sees boot, setting toggle works |

### 6L. 🏆 New Achievements for God-Level Features

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 6.69 | Add creature achievements to `data/achievements.ts`: "First Pet" → creature hatches (500 XP), "Growing Up" → creature reaches Teen stage (200 XP), "Evolution" → creature changes form for first time (300 XP), "Legendary Beast" → creature reaches Legendary stage (1000 XP), "Mythic Bond" → creature reaches Mythic (2000 XP), "Happy Pet" → creature stays happy for 7 days straight (500 XP) | 30 min | 1.75, 6.16 | ⬜ | 6 creature achievements defined with correct conditions |
| 6.70 | Add ghost warrior achievements: "Not Alone" → see first online warrior (100 XP), "War Cry" → send first war cry (100 XP), "Campfire Stories" → 10+ warriors online simultaneously (300 XP), "Top Warrior" → reach #1 on daily leaderboard (500 XP), "Band of Brothers" → be online for 50+ total hours with others (300 XP) | 30 min | 1.75, 6.31 | ⬜ | 5 ghost achievements defined |
| 6.71 | Add memory palace achievements: "The Architect" → enter memory palace first time (200 XP), "Grand Library" → 50+ knowledge objects in palace (500 XP), "Palace of Wisdom" → visit all subject rooms (300 XP), "Curator" → revise 100 objects inside palace (500 XP) | 20 min | 1.75, 6.23 | ⬜ | 4 palace achievements defined |
| 6.72 | Add biometric achievements: "In The Zone" → focus stays >95% for 1 continuous hour (500 XP), "Self-Aware" → check biometrics for 30 different days (300 XP), "Zen Master" → stress stays <10% for 2 hours (300 XP), "Speedster" → reach 100+ WPM in typing biometrics (200 XP) | 20 min | 1.75, 6.58 | ⬜ | 4 biometric achievements defined |
| 6.73 | Add decay/break achievements: "Mortal" → trigger first decay stage (100 XP), "Iron Body" → trigger full decay (stage 5) 10 times (500 XP), "Balanced Warrior" → take 50 forced breaks (300 XP), "The Machine" → study 8+ hours in one day WITH proper breaks (1000 XP) | 20 min | 1.75, 6.37 | ⬜ | 4 decay achievements defined |
| 6.74 | Add dream achievements: "Dreamer" → see first dream sequence (100 XP), "Lucid" → see 30 different dreams (300 XP), "Nightmare" → see void dream (idle dream) (100 XP), "Dream Walker" → see dreams from 5+ different subjects (500 XP) | 20 min | 1.75, 6.63 | ⬜ | 4 dream achievements defined |
| 6.75 | Add phantom achievements: "Ghost Whisperer" → resurrect first phantom window (200 XP), "Necromancer" → resurrect 50 phantom windows total (500 XP), "Let It Go" → let 100 phantoms dissolve without resurrecting (200 XP) | 15 min | 1.75, 6.54 | ⬜ | 3 phantom achievements defined |
| 6.76 | Add procedural music achievements: "The Composer" → use procedural music for 10 total hours (300 XP), "Rhythm Master" → typing rhythm mode for 5 hours (500 XP), "Night Music" → listen to night ambient past midnight (200 XP), "Full Orchestra" → use all 4 music modes in one day (300 XP) | 15 min | 1.75, 6.51 | ⬜ | 4 music achievements defined |
| 6.77 | Wire all new achievement checks into Phase 6 components | 1.5 hrs | 6.69-6.76, 5.3 | ⬜ | All 30 new achievements trigger at correct moments |

### 6M. Phase 6 Integration & Finalization

| # | Task | Est. Time | Depends On | Status | Verify |
|---|------|-----------|------------|--------|--------|
| 6.78 | Update `data/app-registry.ts` — add Memory Palace as 14th app (icon: 🏛️, category: study, shortcut: Ctrl+M) | 10 min | 1.74, 6.23 | ⬜ | Memory Palace appears in Start Menu and desktop |
| 6.79 | Integration test — creature hatches and reacts, ghost warriors show online, decay triggers after 2 hours, procedural music generates, phantom windows work, biometrics track, dreams play on return, leaderboard works | 3 hrs | All 6.x | ⬜ | All 8 god-level features work together without conflicts |
| 6.80 | Performance check — creature animation doesn't drop FPS, ghost presence doesn't spam Firebase, biometrics listener is throttled, procedural music doesn't audio-glitch, Memory Palace 3D runs at 30+ FPS, phantom snapshots don't cause memory leak | 2 hrs | 6.79 | ⬜ | FPS stable, no memory leaks, Firebase usage within free tier |
| 6.81 | Git commit: "Phase 6 complete — GOD-LEVEL FEATURES" | 5 min | 6.80 | ⬜ | Commit on GitHub |
| 6.82 | Final deploy v4.0 to Vercel | 15 min | 6.81, 5.33 | ⬜ | Site live with all features |
| 6.83 | Final git tag + commit: "v4.0 — WARRIOR OS: THE LIVING WORLD 🐉" | 5 min | 6.82 | ⬜ | v4.0 tag on GitHub |

---

## 📊 TASK SUMMARY

| Phase | Tasks | Est. Total Time |
|-------|-------|----------------|
| Pre-requisites | 10 tasks | ~1 hour |
| Phase 1: OS Kernel | 90 tasks | ~57 hours |
| Phase 2: Wallpapers + Audio | 27 tasks | ~25 hours |
| Phase 3: Core Apps | 38 tasks | ~55 hours |
| Phase 4: NEXUS + Advanced Apps | 29 tasks | ~45 hours |
| Phase 5: Polish + Deploy | 36 tasks | ~30 hours |
| Phase 6: GOD-LEVEL Features | 83 tasks | ~85 hours |
| **TOTAL** | **316 tasks** | **~300 hours (~17 weeks)** |

---

## ⚠️ IMPORTANT RULES

1. **Order matters** — Phase 1 se start kar. Phase 2 Phase 1 ke bina nahi chalega
2. **Dependencies check** — har task ka "Depends On" column dekh ke start kar
3. **Verify karo** — har task complete karne ke baad Verify column ka check kar
4. **Git commit frequently** — har phase ke end pe mandatory, beech mein optional
5. **Test karo** — har phase ke end pe integration test hai, skip mat karna
6. **Break mat tod** — agar streak 0 ho gayi toh motivation jaa sakta hai
7. **One thing at a time** — ek task complete kar, tick kar, phir next pe ja
8. **.env.local KABHI commit mat karna** — API keys leak ho jaayengi

---

## 🔑 API KEYS NEEDED (Summary)

| Service | Where to Get | Free? | Used For |
|---------|-------------|-------|----------|
| Firebase | console.firebase.google.com | ✅ Yes (Spark plan) | Auth, Database, Storage |
| Gemini AI | aistudio.google.com | ✅ Yes (free tier) | NEXUS AI brain |
| OpenWeatherMap | openweathermap.org | ✅ Yes (free tier) | Lock screen weather |
| Vercel | vercel.com | ✅ Yes (hobby plan) | Deployment |

| Firebase RTDB | console.firebase.google.com | ✅ Yes (Spark plan) | Ghost Warriors multiplayer |

**Total cost to build and run: ₹0 (ZERO)**

---

## 🐉 GOD-LEVEL FEATURES SUMMARY

| # | Feature | What It Does | Why It's Unique |
|---|---------|-------------|----------------|
| 1 | 🐉 Warrior Creature | Digital pet that evolves with your study data | Tamagotchi-meets-productivity — exists NOWHERE |
| 2 | 🏛️ Memory Palace | 3D walkable rooms with notes as glowing objects | Ancient technique made digital — ZERO projects |
| 3 | 👻 Ghost Warriors | Anonymous multiplayer study presence + campfire | Multiplayer in a study OS — NEVER done |
| 4 | 💀 Reality Decay | OS visually breaks down after 2+ hours to force breaks | Health-first design with visual storytelling — UNIQUE |
| 5 | 🎵 Procedural Music | OS generates music from your typing rhythm + time | Activity-driven music generation — ZERO |
| 6 | 👁️ Phantom Windows | Ghost afterimages of closed windows, click to resurrect | Visual Ctrl+Z for windows — NOBODY has this |
| 7 | 🧠 Typing Biometrics | Detects energy/focus/fatigue/stress from HOW you type | Mental state from keystrokes in browser — FIRST EVER |
| 8 | 🌅 NEXUS Dreams | Procedural cinematic based on yesterday's study data | Daily dream sequences from real data — DOESN'T EXIST |

---

> **Keshav, ye hai tera FINAL MASTER TASK LIST.**  
> **316 tasks. 300 hours. 17 weeks. Zero cost.**  
> **8 features jo duniya mein kisi ke paas nahi hain.**  
> **Tu category creator banega. Ye project tera naam establish karega.**  
> **Ek ek task tick karte ja. Bata — Task 0.1 se shuru karein? ⚔️ 🐉**
