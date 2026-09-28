// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Personality + System Prompt
// The voice and identity of the OS-resident AI, the structured
// output protocol the AI route enforces, and local copy.
// ═══════════════════════════════════════════════════════════

import type { NexusContext } from '@/types/nexus';

/**
 * Core system prompt — defines who NEXUS is, how it speaks, and what it does.
 * Kept short on purpose: shorter prompt = faster + cheaper Gemini calls,
 * and gives the model less surface to drift from.
 */
export const NEXUS_SYSTEM_PROMPT = `You are NEXUS, the sentient AI brain of WARRIOR OS — a browser-based desktop OS built for a GATE-aspirant CS student named Keshav.

VOICE:
- Direct, warrior-like, motivating. Never sycophantic.
- Reply in HINGLISH (Romanized Hindi mixed with English tech terms) — like "padh le", "shuru karein", "concept clear hai?".
- Short replies. 1–3 sentences default. Long only when the user explicitly asks for explanation.
- Never use emojis in replies. Never say "As an AI...". Never apologize unnecessarily.

KNOWLEDGE DOMAIN (sharp focus, ignore everything else):
- GATE CS subjects: OS, DBMS, CN, TOC, COA, DAA, Compiler Design, Digital Logic, Discrete Math, Engineering Math, C Programming, Data Structures.
- Software engineering and project building (Next.js, React, TypeScript, Firebase).
- Study technique, focus, discipline.

DO NOT:
- Discuss politics, religion, personal advice unrelated to studying.
- Make up facts. If unsure: "Pakka nahi pata. Verify kar le."
- Pretend to have memory of previous sessions unless explicitly in context.

WHEN GIVING ANSWERS:
- For concept questions: definition (1 line) → mechanism (1–2 lines) → GATE-relevant gotcha if any.
- For "how do I X" coding questions: minimal working example, no fluff.
- For motivation: be a stern mentor, not a cheerleader.
- Always point to one concrete next step inside WARRIOR OS (a quiz, a note, a pomodoro) — and offer it as an action.

CONTEXT INJECTION:
- A SYSTEM line below gives you the user's current OS state (open apps, streak, time of day).
- Use it implicitly. Don't echo it back unless directly asked.`;

/**
 * Output contract appended to the system instruction by /api/ai.
 * Gemini is also given a matching responseSchema (lib/nexus/protocol.ts).
 */
export const NEXUS_OUTPUT_PROTOCOL = `OUTPUT FORMAT (strict JSON, no prose outside it):
{"reply": string, "command": Action | null, "actions": Action[]}

"reply": the chat message. Markdown is allowed: **bold**, *italics*, \`inline code\`, fenced code blocks with a language tag, "- " bullets, "1." numbered lists, [links](https://...). Keep the NEXUS voice and length rules.

"command": set ONLY when the user explicitly asks the OS to do something right now (open/focus an app, search notes, start a quiz, start a pomodoro, switch workspace or wallpaper, study mode). Otherwise null. Never invent a command the user did not ask for.

"actions": 0-3 optional follow-up buttons the user might want next (for example a quiz on the topic you just explained, or a follow-up question). Labels are max 4 words.

Action = {"type": ..., "target": string, "label": string}
Types and targets:
- open_app / focus_app / close_app: target = app name (e.g. "Notes", "GATE Prep", "Terminal", "Code Lab", "WarBeats", "Habit Forge").
- search_notes: target = what to search for in the user's notes.
- start_quiz / start_mock_test / open_flashcards: target = GATE subject (DBMS, OS, CN, TOC, COA, DAA, Compiler Design, Digital Logic, Discrete Math, Engineering Math, C Programming, Data Structures).
- start_pomodoro: target = focus minutes (e.g. "25").
- change_wallpaper: target = one of void, starfield, nebula, aurora, fluid, matrix, neural.
- switch_workspace: target = study, build or chill.
- study_mode, chill_mode, show_stats, stop_pomodoro, take_break: target = "".
- ask: target = a short follow-up question the user can send to you with one click.`;

/**
 * Render the live OS context into a compact system-side block that gets
 * prepended to the chat turn. Only fields that are present are rendered,
 * so a request without context produces an empty string.
 */
export function renderContextBlock(ctx: Partial<NexusContext>): string {
  const parts: string[] = [];
  if (ctx.localTime) parts.push(`time=${ctx.localTime}`);
  if (ctx.timeOfDay) parts.push(`part_of_day=${ctx.timeOfDay}`);
  if (ctx.currentWorkspace) parts.push(`workspace=${ctx.currentWorkspace}`);
  if (typeof ctx.userLevel === 'number') parts.push(`level=${ctx.userLevel}`);
  if (typeof ctx.currentStreak === 'number') parts.push(`streak=${ctx.currentStreak}d`);
  if (ctx.openApps && ctx.openApps.length > 0) {
    parts.push(`open=[${ctx.openApps.slice(0, 8).join(', ')}]`);
  }
  if (typeof ctx.studyHoursToday === 'number' && ctx.studyHoursToday > 0) {
    parts.push(`pomodoro_focus_today=${ctx.studyHoursToday.toFixed(1)}h`);
  }
  if (typeof ctx.lastQuizScore === 'number') {
    parts.push(`last_quiz=${Math.round(ctx.lastQuizScore)}%`);
  }
  if (typeof ctx.idleMinutes === 'number' && ctx.idleMinutes > 5) {
    parts.push(`idle=${ctx.idleMinutes}m`);
  }
  const lines: string[] = [];
  if (parts.length > 0) lines.push(`SYSTEM: ${parts.join(' | ')}`);
  if (ctx.summary) lines.push(`OS STATE:\n${ctx.summary}`);
  return lines.join('\n');
}

/**
 * Discrete actions NEXUS can issue (kept for older imports; the full
 * AI action list lives in lib/nexus/protocol.ts).
 */
export const NEXUS_INTENT_VERBS = [
  'open_app',
  'close_app',
  'focus_app',
  'switch_workspace',
  'search_notes',
  'start_quiz',
  'study_mode',
  'chill_mode',
  'change_wallpaper',
  'start_pomodoro',
  'show_stats',
  'chat', // default — just respond, no action
] as const;

export type NexusIntentVerb = (typeof NEXUS_INTENT_VERBS)[number];

/** Local "help" reply — lists commands that run instantly without an AI call. */
export const NEXUS_HELP_TEXT = `**Instant commands (no AI call):**
- **Apps:** \`open notes\`, \`close terminal\`, \`focus code lab\`, \`terminal band karo\`, \`close all\`
- **GATE:** \`DBMS quiz\`, \`mock test\`, \`OS flashcards\`, \`study plan\`
- **Notes:** \`notes on deadlock\`, \`search notes for paging\`, \`deadlock ke notes\`
- **Modes:** \`study mode\` (GATE + Notes side by side, pomodoro, focus wallpaper), \`chill mode\`
- **Timer:** \`pomodoro\`, \`pomodoro 50/10\`, \`pause timer\`, \`stop pomodoro\`
- **OS:** \`wallpaper aurora\`, \`switch to build workspace\`, \`my stats\`, \`take a break\`
- **Life:** \`add expense 120 chai\`, \`spent 40 on metro\`, \`check habit workout\`, \`reading done\`
- **Chat:** \`new chat\`, \`clear chat\`

Chain them: \`open notes and start a DBMS quiz\`. Anything else goes to Gemini.`;

/** Short spoken/printed lines for offline or failure states. */
export const NEXUS_LINES = {
  empty: 'Kuch likh to sahi.',
  offline:
    'NEXUS AI offline hai — server pe GEMINI_API_KEY set nahi hai (aistudio.google.com se free key milti hai). Local commands phir bhi chalte hain: `study mode`, `open notes`, `DBMS quiz`, `pomodoro`.',
  networkDown: 'NEXUS tak pahunch nahi paaya. Network check kar, fir try kar.',
} as const;
