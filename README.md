<div align="center">

# WARRIOR OS

**A sci-fi operating system that lives in the browser: my digital home, command center, discipline machine and creative playground.**

[![CI](https://github.com/techkeshav23/Warrior-OS/actions/workflows/ci.yml/badge.svg)](https://github.com/techkeshav23/Warrior-OS/actions/workflows/ci.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs)
![React 19](https://img.shields.io/badge/React-19-149eca?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![three.js](https://img.shields.io/badge/three.js-R3F-000?logo=threedotjs)

Designed and built by **[Keshav Upadhyay](https://github.com/techkeshav23)** (@techkeshav23)

</div>

---

Warrior OS is a complete desktop operating system written in TypeScript and running in a browser tab: a cinematic boot, a lock screen, draggable glass windows, workspaces, a taskbar, a command palette that understands plain language, and 19 apps. It is my personal OS, so it knows me: a creature that grows with my work, an assistant with a personality, a world that reacts to how I study, code and rest.

**Take the tour:** open the live site, let it boot, then click **Explore as Guest** on the lock screen (or type anything and press Enter). Press **Ctrl+K** anywhere on the desktop.

> Live demo: *link goes here after the first deploy* · Deploy your own: [DEPLOY.md](DEPLOY.md)

## One OS, four sides

| | |
|---|---|
| **My digital home** | It knows its owner: my creature, my NEXUS assistant, my dreams, my stats and achievements. |
| **Sci-fi command center** | Particle-assembly boot, shader wallpapers, holographic 3D spaces, voice commands, a Dynamic Island, a palette you talk to. |
| **Discipline machine** | Habits, routines, focus timers, streaks, XP and levels, and a world that decays when I overwork. |
| **Creative playground** | Procedurally composed music, a code lab, algorithm visualizers, a terminal full of easter eggs. |

## The living world

Most "OS in a browser" projects stop at windows. These systems make this one feel alive:

- **Warrior Creature.** A digital pet that hatches from an egg on day three, feeds on the XP I earn and evolves (baby, teen, adult, legendary, mythic) into a Scholar Phoenix, Code Serpent or Warrior Dragon depending on whether I mostly study or code. It falls asleep after two idle hours.
- **Memory Palace.** A walkable 3D palace (React Three Fiber) where notes become glowing objects in themed rooms. It grows with the notes: a new room every 10, a longer corridor every 50, a new wing every 100, a Grand Hall at 500.
- **Ghost Warriors.** Anonymous live presence over Firebase Realtime Database: a pixel-art campfire that grows with the number of people online, a leaderboard, and 50-character war cries. Without a database it becomes a local campfire across open tabs.
- **Reality Decay.** Work two hours without a break and the OS starts to decay: a warm colour shift, then softness, a red vignette and a heartbeat. At four hours cracks run across the screen and it forces a break, after which it repairs itself.
- **Procedural music.** Tone.js composes endless music for the moment (morning, deep study, night) and switches to a typing-rhythm mode that plays along with my keystrokes.
- **Phantom windows.** A closed window lingers as a drifting ghost for eight seconds; click it to resurrect the app with its scroll position and form input intact.
- **Typing biometrics.** Keystroke timing (never keys, never text) becomes live energy, focus, fatigue and stress readings with an hourly history.
- **Dreams.** When I come back, NEXUS dreams about yesterday: a short cinematic built from my quizzes, notes, habits and projects, played before the lock screen.
- **NEXUS.** The assistant behind it all. Gemini when a key is configured, a rule-based offline brain when not. It runs the OS from natural language in English and Hinglish ("study mode", "add expense 120 chai", "close terminal"), listens for voice, runs pomodoros and suggests what to do next.

## Apps

| Group | App | What it does |
|---|---|---|
| Learn | **Training Grounds** | Learn anything: a quiz engine, mock tests, a mastery skill tree, spaced repetition and a planner over your own decks. |
| | **Quest Planner** | Daily quests: habits, routines and streaks. |
| | **Flashcards** | Spaced-repetition flashcards from your decks. |
| | **Notes** | Markdown notes with auto-save and search. |
| | **Memory Palace** | The 3D walkable palace of your notes. |
| Build | **Code Lab** | HTML, CSS and JS playground with a sandboxed live preview. |
| | **Project Forge** | Kanban board with time tracking and shipping rewards. |
| | **Algo Lab** | Step-by-step sorting, graph and tree algorithm visualizer with compare mode. |
| | **Resume Builder** | Live-preview resume editor, auto-filled from Project Forge, PDF export. |
| | **Terminal** | A shell with its own commands (`help`, `neofetch`, `matrix`, and secrets). |
| Utility | **NEXUS AI** | Chat with NEXUS, the OS assistant. |
| | **Calendar** | Month view, agenda and reminders. |
| | **Expense Vault** | Expense log, monthly budget and spending trends. |
| | **Files** | File explorer. |
| | **Calculator** | Scientific calculator. |
| | **Settings** | Appearance, sounds, NEXUS, workspaces, living-world toggles, performance. |
| Chill | **WarBeats** | Music player with a local library, procedural music and an audio visualizer. |
| | **Weather** | Current weather and forecast. |
| | **Profile** | Level, XP, streaks, stats and the achievement gallery. |

## Tech stack

| Layer | Tools |
|---|---|
| Framework | Next.js 16 (App Router, React Compiler), React 19, TypeScript (strict) |
| UI and motion | Tailwind CSS 4, framer-motion, react-rnd, dnd-kit, lucide-react, Recharts, tsParticles, canvas-confetti |
| 3D and graphics | three.js, React Three Fiber, drei, GLSL shader wallpapers, Canvas 2D |
| Audio | Tone.js (procedural music), Howler, Web Audio, Web Speech API |
| State | zustand 5 + immer, persisted to localStorage; IndexedDB for the music library |
| Backend (optional) | Firebase Auth, Firestore, Realtime Database; Gemini API; OpenWeatherMap or keyless Open-Meteo |
| Quality and delivery | ESLint, Playwright end-to-end smoke test, GitHub Actions CI, Vercel |

## Architecture

```
src/app/page.tsx  phase machine: dream | boot -> lock -> desktop
  WorkspaceManager (Study / Build / Chill)
    Desktop (icon grid) . DesktopWidgets . WindowManager -> Window (react-rnd) -> lazy app
  Taskbar . Start menu . Command palette . Dynamic Island . Notifications
  Living-world layers: Creature . Ghosts . Decay . Phantoms . Biometrics . Music . NEXUS
src/app/api/ai       Edge route: Gemini proxy (persona server-side, validated JSON actions)
src/app/api/weather  Node route: weather proxy with cache and keyless fallback
```

- **OS kernel.** A phase store drives boot, lock and desktop. The window manager (`useWindowStore`) owns z-order, focus, minimize and maximize, and cascade placement; the app registry (`src/data/app-registry.ts`) and `useAppStore` launch apps and enforce singletons; `useWorkspaceStore` gives each workspace its own windows, accent and wallpaper.
- **State.** Twenty-plus small zustand stores, one per concern (windows, settings, XP, creature, decay, ghosts, biometrics, NEXUS...). Cross-feature signals such as NEXUS commands and deep links travel as typed `warrior:*` DOM events, which keeps features decoupled.
- **Lazy-loaded apps.** Every app is its own client-only chunk (`next/dynamic`, `ssr: false`), fetched the first time its window opens, so three.js, Tone.js and the rest never slow down the boot.
- **Fault isolation.** Each window runs its app inside an error boundary: a crash shows a SYSTEM FAULT panel with Restart and Close, and the rest of the OS keeps running.
- **Offline-first.** All data lives in the browser first. A hand-written service worker caches the shell and static assets, the web app manifest makes it installable, and every cloud feature is optional: no keys means local mode, never a broken screen.
- **Keys stay on the server.** Gemini and weather keys are read only inside route handlers. The AI route adds a per-IP rate limit, body validation, an upstream timeout and a schema for the actions NEXUS may take.
- **Lite mode.** On modest hardware (4 GB of memory or 4 CPU threads or fewer, or reduced motion) the OS switches to CSS wallpapers and skips heavy canvases; Settings can force it on or off.

```
src/
  app/          page (phase machine), layout, manifest, API routes
  components/
    os/         kernel UI: windows, desktop, taskbar, palette, lock and boot screens
    apps/       the 19 apps, one folder each
    creature/ ghost/ decay/ phantom/ biometrics/ dream/ music/ nexus/
    effects/ wallpapers/ widgets/ achievements/ ui/
  stores/       zustand stores
  lib/          engines: procedural music, ghost presence, NEXUS, algorithms
  data/         app registry, decks, achievements, NEXUS personality
tests/e2e/      Playwright smoke test
```

## Run locally

Requires Node.js 20.9 or newer (22 recommended).

```bash
git clone https://github.com/techkeshav23/Warrior-OS.git
cd Warrior-OS
npm install
cp .env.example .env.local   # optional: every key is optional
npm run dev                  # http://localhost:3000
```

| Script | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright smoke test (run `npm run build` first) |

Without any keys everything runs locally: NEXUS answers with its offline brain, weather comes from Open-Meteo, Ghost Warriors is a local campfire. [DEPLOY.md](DEPLOY.md) covers Vercel, Firebase and every environment variable.

## Keyboard shortcuts

`Ctrl` means `Cmd` on macOS.

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Command palette (apps, actions, notes, or plain-language requests to NEXUS) |
| `Ctrl+1` / `Ctrl+2` / `Ctrl+3` | Study / Build / Chill workspace |
| `Ctrl+L` | Lock screen |
| `Ctrl+,` | Settings |
| `Cmd+D` (macOS) / `Super+D` | Show desktop |
| `Esc` | Close the Start menu, palette or notifications; skip a dream or cinematic |
| `Ctrl+G` | Training Grounds |
| `Ctrl+Shift+M` | Memory Palace |
| `Ctrl+Shift+C` | Code Lab |
| ``Ctrl+` `` | Terminal |
| `Ctrl+M` | WarBeats |
| `Up` / `Down`, `Enter` | Move through and run palette results |
| `W A S D` / arrows, `Shift`, mouse | Walk, sprint and look around the Memory Palace (`O` overview map, `X` close a note) |

App shortcuts come from each app's `shortcut` in the registry; a browser may keep a few combinations for itself. There is also a Konami code.

## Screenshots

<!-- Save captures to docs/screenshots/ and swap each placeholder for ![caption](docs/screenshots/<file>.png). -->

| | |
|---|---|
| *Boot sequence* (`boot.png`) | *Lock screen with Explore as Guest* (`lock.png`) |
| *Desktop with widgets and the creature* (`desktop.png`) | *Command palette talking to NEXUS* (`palette.png`) |
| *Memory Palace* (`memory-palace.png`) | *Training Grounds* (`training-grounds.png`) |
| *Reality Decay, stage 5* (`decay.png`) | *Ghost Warriors campfire* (`campfire.png`) |

## Privacy

Typing biometrics look only at keystroke timing (never which key, never any text), ignore password and payment fields entirely, and store nothing but hourly averages. Ghost Warriors shares an anonymous `Warrior#1234` id and three numbers (hours studied today, quizzes today, streak). Everything else stays in the browser unless you connect your own Firebase project.

## Credits

Designed and built by **Keshav Upadhyay** ([@techkeshav23](https://github.com/techkeshav23)).
