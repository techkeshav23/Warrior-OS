// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Offline Brain
//
// Rule-based fallback used when Gemini is unavailable (no
// GEMINI_API_KEY on the server, or the /api/ai route itself is
// unreachable). It answers what NEXUS gets asked most — greetings
// (the owner or a visitor), who built this OS and with what, what
// every app does, how to learn anything with the user's own decks,
// habits, focus, motivation, time/date — in the NEXUS voice, and
// always offers a concrete next step as action buttons.
//
// Pure module: no env, no stores, no browser APIs. Runs on the edge
// route and in the browser alike. Live state (visitor mode, decks,
// cards due, streak) arrives in the optional context; NexusCore adds
// matching cards and notes from the user's own data under the reply.
// ═══════════════════════════════════════════════════════════

import { OWNER, type OwnerProfile } from '@/config/owner';
import type { NexusChatTurn, NexusContext, NexusWireAction } from '@/types/nexus';

export interface OfflineBrainReply {
  reply: string;
  command: NexusWireAction | null;
  actions: NexusWireAction[];
}

export const NEXUS_OFFLINE_MODEL = 'nexus-offline';

const MAX_ACTIONS = 3;
const MAX_LABEL = 32;

type Ctx = Partial<NexusContext> | null;

/** Read through the profile type so empty links are plain strings, not '' literals. */
const owner: OwnerProfile = OWNER;

// ─── Action helpers ───

function openApp(app: string, label?: string): NexusWireAction {
  return { type: 'open_app', target: app, ...(label ? { label } : {}) };
}

function quiz(deck?: string | null, label?: string): NexusWireAction {
  return { type: 'start_quiz', ...(deck ? { target: deck } : {}), ...(label ? { label } : {}) };
}

function review(deck?: string | null, label = 'Review due cards'): NexusWireAction {
  return { type: 'open_flashcards', ...(deck ? { target: deck } : {}), label };
}

function ask(prompt: string, label?: string): NexusWireAction {
  return { type: 'ask', target: prompt, ...(label ? { label } : {}) };
}

function searchNotes(query: string, label = 'Search my notes'): NexusWireAction {
  return { type: 'search_notes', target: query, label };
}

const FOCUS_SESSION: NexusWireAction = { type: 'start_pomodoro', target: '25', label: '25 min focus' };
const STUDY_MODE: NexusWireAction = { type: 'study_mode', label: 'Study mode' };
const MY_DECKS: NexusWireAction = { type: 'show_decks', label: 'My decks' };
const MY_STATS: NexusWireAction = { type: 'show_stats', label: 'My stats' };
const TAKE_BREAK: NexusWireAction = { type: 'take_break', label: 'Take a break' };
const TOUR: NexusWireAction = ask('What can this OS do?', 'Tour the OS');
const HELP: NexusWireAction = ask('help', 'What can you do?');

function clipLabel(label: string): string {
  return label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label;
}

function reply(text: string, actions: NexusWireAction[] = []): OfflineBrainReply {
  return {
    reply: text,
    command: null,
    actions: actions.slice(0, MAX_ACTIONS).map((a) => (a.label ? { ...a, label: clipLabel(a.label) } : a)),
  };
}

// ─── Knowledge base: the OS and how to learn ───

interface Entry {
  /** Display name (used by "explain more" follow-ups) */
  name: string;
  /** Regexes matched against the normalised question */
  match: RegExp[];
  body: string;
  actions: NexusWireAction[];
}

const KNOWLEDGE: readonly Entry[] = [
  {
    name: 'Training Grounds',
    match: [
      /\btraining\s+grounds?\b/,
      /\bskill\s+tree\b/,
      /\bquestion\s+bank\b/,
      /\bmock\s+tests?\b/,
      /\bquest\s+planner\b/,
      /\bhow\s+(?:do|does)\s+(?:the\s+)?decks?\s+work\b/,
    ],
    body:
      '**Training Grounds** is the "learn anything" engine. You build your own **decks** (deck → topics → cards: MCQ, multi-select, numeric, flashcards) and the same cards power every mode:\n\n' +
      '- **Quiz** — quick rounds, with the explanation after each answer.\n' +
      '- **Flashcards** — spaced repetition: flip the due cards and rate them Again / Hard / Good / Easy.\n' +
      '- **Skill Tree** — mastery of every topic at a glance.\n' +
      '- **Question Bank**, **Mock Test** (timed) and **Quest Planner** (spreads topics over the days you have).\n\n' +
      'Try: `quiz me on <deck>`, `review due cards`, `my decks`.',
    actions: [openApp('Training Grounds', 'Open Training Grounds'), review(), MY_DECKS],
  },
  {
    name: 'Spaced repetition',
    match: [
      /\bspaced\s+repetition\b/,
      /\bsm-?2\b/,
      /\bforgetting\s+curve\b/,
      /\bdue\s+cards?\b/,
      /\bmastery\b/,
      /\bflash\s*cards?\b/,
    ],
    body:
      '**Spaced repetition** shows a card again right before you would forget it. Every good review stretches the gap (1 day → 3 days → about a week → …); miss it and the card comes back in 10 minutes.\n\n' +
      'Here: flip a flashcard and rate yourself honestly — **Again**, **Hard**, **Good**, **Easy**. A card\'s **mastery** comes from your recent answers; around 80% strength it counts as mastered.\n\n' +
      'Rule of thumb: due cards first, new cards after.',
    actions: [review(), MY_DECKS, ask('How do I make good flashcards?', 'Better cards')],
  },
  {
    name: 'Active recall',
    match: [
      /\bactive\s+recall\b/,
      /\b(?:good|better|effective)\s+(?:flash\s*)?cards?\b/,
      /\b(?:make|create|write)\s+(?:good\s+|better\s+)?(?:flash\s*)?cards?\b/,
      /\bhow\s+to\s+(?:make|create|build)\s+(?:a\s+)?decks?\b/,
    ],
    body:
      '**Active recall** means pulling the answer out of your head before you look. It beats re-reading by a wide margin.\n\n' +
      'Rules for good cards:\n' +
      '- One card, one fact. A long answer means the card should be split.\n' +
      '- Your own words, never copy-paste.\n' +
      '- Ask "why", not only "what".\n' +
      '- Add an explanation to every card you keep missing.\n' +
      '- MCQ for look-alike ideas, numeric cards for numbers and formulas.',
    actions: [openApp('Training Grounds', 'Open Training Grounds'), review()],
  },
  {
    name: 'Learning anything',
    match: [
      /\bhow\s+(?:do\s+i|to|can\s+i|should\s+i)\s+(?:learn|study|master|remember|revise)\b/,
      /\blearn\s+(?:anything|faster|fast|better|quickly)\b/,
      /\bstudy\s+(?:tips?|techniques?|methods?)\b/,
      /\bfeynman\b/,
      /\binterleav/,
      /^(?:i\s+want\s+to|i\s+wanna|help\s+me|lets)\s+(?:learn|study|master)\b/,
    ],
    body:
      '**The learn-anything loop:**\n\n' +
      '1. **Map** the subject into 5-8 topics — one deck topic each.\n' +
      '2. **Learn** one topic, then **Feynman** it: write it in Notes so simply a beginner would get it.\n' +
      '3. **Cards:** make 10-20 cards the same day.\n' +
      '4. **Review** due cards daily, 10-15 minutes (spaced repetition).\n' +
      '5. **Test** weekly with a mixed quiz or a mock test; write an explanation for every miss.\n\n' +
      'Mix topics while practising (interleaving) — it beats drilling one topic at a time.',
    actions: [openApp('Training Grounds', 'Open Training Grounds'), STUDY_MODE, FOCUS_SESSION],
  },
  {
    name: 'Pomodoro',
    match: [/\bpomodoros?\b/, /\bfocus\s+(?:timer|sessions?)\b/, /\bdeep\s+work\b/],
    body:
      '**Pomodoro**: 25 minutes on one task, a 5-minute break, a longer break after four rounds. One task while the timer runs; phone out of reach.\n\n' +
      'Commands: `pomodoro`, `pomodoro 50/10`, `pause timer`, `stop pomodoro`. **Study mode** starts one for you.',
    actions: [FOCUS_SESSION, STUDY_MODE],
  },
  {
    name: 'Habits and discipline',
    match: [/\bhabits?\b/, /\bhabit\s+forge\b/, /\bstreaks?\b/, /\broutines?\b/, /\bdiscipline\b/, /\bconsisten(?:t|cy)\b/],
    body:
      '**Habit Forge** tracks habits and routines; ticking them daily grows your streak and XP.\n\n' +
      'The discipline formula:\n' +
      '- Make the habit so small it is hard to skip (the 2-minute rule).\n' +
      '- Chain it to an existing routine: "after tea, 10 cards" (habit stacking).\n' +
      '- Broke the streak? Never miss twice.\n\n' +
      'Command: `check habit <name>` or `<name> done`.',
    actions: [openApp('Habit Forge', 'Open Habit Forge'), FOCUS_SESSION],
  },
  {
    name: 'Reality Decay',
    match: [/\breality\s+decay\b/, /\bdecay\b/, /\bcracks?\b/, /\bbreak\s+mode\b/, /\bheartbeat\b/],
    body:
      '**Reality Decay** is the discipline machine\'s enforcer. Work too long without a break and the OS slowly decays — glitches, cracks, then a heartbeat — until the last stage forces break mode. Take the break and the OS repairs itself.\n\n' +
      'It stops burnout before it starts. Tune it in Settings → Living World.',
    actions: [TAKE_BREAK, openApp('Settings', 'Open Settings')],
  },
  {
    name: 'Warrior Creature',
    match: [/\bcreature\b/, /\bmy\s+pet\b/, /\begg\b/, /\bevolv/, /\bhatch/],
    body:
      'The **Warrior Creature** is your digital companion. It starts as an egg and grows on your XP: egg → baby → teen → adult → legendary → mythic. Whether you study or code more decides its evolution form. Idle for 2 hours and it falls asleep; 5 focused hours earn it a golden aura.\n\n' +
      'Click its sprite on the taskbar for its stats.',
    actions: [STUDY_MODE, ask('How do I earn XP?', 'How to earn XP')],
  },
  {
    name: 'XP and levels',
    match: [/\bxp\b/, /\blevel\s*up\b/, /\bachievements?\b/, /\bhow\s+do\s+levels\s+work\b/],
    body:
      'XP comes from real work: quizzes, ticked habits, shipped projects, found easter eggs and the rest of the daily grind. XP raises your level, unlocks achievements and evolves the creature.\n\n' +
      'Say `my stats` for level, streak and weakest deck in one line.',
    actions: [MY_STATS, openApp('Profile', 'Open Profile')],
  },
  {
    name: 'Memory Palace',
    match: [/\bmemory\s+palace\b/, /\bmethod\s+of\s+loci\b/, /\bloci\b/],
    body:
      '**Memory Palace** is the method of loci in 3D: your notes become glowing objects in a space you can walk through. Tying an idea to a place is one of the strongest memory hooks there is.',
    actions: [openApp('Memory Palace', 'Open Memory Palace'), openApp('Notes', 'Open Notes')],
  },
  {
    name: 'Build apps',
    match: [/\bcode\s+lab\b/, /\balgo(?:rithm)?\s+(?:lab|visuali[sz]er)\b/, /\bproject\s+forge\b/, /\bresume\s+builder\b/, /\bkanban\b/],
    body:
      'The build side of the OS:\n\n' +
      '- **Code Lab** — code editor with live preview.\n' +
      '- **Algo Lab** — sorting, graph and tree algorithms, animated step by step.\n' +
      '- **Project Forge** — kanban board, time tracking, XP when you ship.\n' +
      '- **Resume Builder** — auto-filled from Project Forge, PDF export.',
    actions: [
      openApp('Code Lab', 'Open Code Lab'),
      openApp('Algo Lab', 'Open Algo Lab'),
      openApp('Project Forge', 'Open Project Forge'),
    ],
  },
  {
    name: 'Music and chill mode',
    match: [/\bwarbeats\b/, /\bmusic\b/, /\blo-?fi\b/, /\bchill\s+mode\b/],
    body:
      '**WarBeats** is the lo-fi player, and the procedural music can pick its mood from the time of day and your typing rhythm. **Chill mode** closes the study apps, brings the music to the centre and switches to the aurora wallpaper — a clean reset.',
    actions: [{ type: 'chill_mode', label: 'Chill mode' }, openApp('WarBeats', 'Open WarBeats')],
  },
  {
    name: 'Workspaces and shortcuts',
    match: [/\bworkspaces?\b/, /\bshortcuts?\b/, /\bhotkeys?\b/, /\bcommand\s+(?:palette|bar)\b/, /\bctrl\s*\+?\s*k\b/, /\bkeyboard\b/],
    body:
      'Three workspaces: **Study**, **Build**, **Chill** (`Ctrl+1` / `Ctrl+2` / `Ctrl+3`).\n\n' +
      '- `Ctrl+K` — command bar: apps, deck actions, or plain language ("study mode", "quiz me on <deck>").\n' +
      '- `Ctrl+.` — NEXUS chat. `Ctrl+G` — Training Grounds. Ctrl + backtick — Terminal.\n' +
      '- `Ctrl+L` — lock. `Ctrl+,` — Settings.\n\n' +
      'On a Mac, Cmd works in place of Ctrl.',
    actions: [{ type: 'switch_workspace', target: 'study', label: 'Study workspace' }, HELP],
  },
  {
    name: 'Terminal',
    match: [/\bterminal\b/, /\bcommand\s+line\b/, /\bshell\b/, /\bcli\b/],
    body:
      'The **Terminal** is a command line for the OS (Ctrl + backtick opens it). Type `help` for the full list:\n\n' +
      '- `ls` — installed apps. `stats` — today\'s study summary. `xp` — level and XP.\n' +
      '- `decks` — your decks with mastery and cards due. `train review` — straight to due cards; `train start <deck>` — a quiz.\n' +
      '- `notes <query>` — open Notes on a search. `neofetch`, `whoami`, `history`, `clear`.\n\n' +
      'Up/Down arrows walk the command history, and a few easter eggs are hidden in there.',
    actions: [openApp('Terminal', 'Open Terminal'), HELP],
  },
  {
    name: 'Everyday tools',
    match: [/\bcalculator\b/, /\bcalendar\b/, /\bweather\b/, /\bfiles?\s+(?:app|manager|explorer)\b/, /\bfile\s+manager\b/],
    body:
      'The everyday tools:\n\n' +
      '- **Calculator** — standard maths, keyboard input works.\n' +
      '- **Calendar** — month view with events, repeats and reminders (NEXUS pings you).\n' +
      '- **Weather** — search any city for current conditions and the forecast.\n' +
      '- **Files** — a virtual file manager: folders and text files, saved in this browser.',
    actions: [openApp('Calendar', 'Open Calendar'), openApp('Weather', 'Open Weather'), openApp('Files', 'Open Files')],
  },
  {
    name: 'Voice control',
    match: [/\bvoice\b/, /\bhey\s+warrior\b/, /\bwake\s+(?:word|mode)\b/, /\bmic(?:rophone)?\b/, /\bspeech\b/],
    body:
      'Voice: push-to-talk with the mic button in the NEXUS chat, or turn on the **Hey Warrior** wake mode (opt-in; the mic keeps listening). Turn on voice replies to hear the answers. Needs browser speech recognition — Chrome or Edge work best.',
    actions: [openApp('NEXUS AI', 'Open NEXUS')],
  },
  {
    name: 'Notes',
    match: [/\bnotes\s+app\b/, /\bmarkdown\b/, /\bhow\s+(?:do\s+i|to|should\s+i)\s+(?:take|write|make)\s+notes\b/],
    body:
      '**Notes** is markdown with auto-save, and NEXUS searches it: `notes on <topic>` or `<topic> ke notes`.\n\n' +
      'Tip: end every note with three cards — that is one step from note to deck.',
    actions: [openApp('Notes', 'Open Notes'), openApp('Memory Palace', 'Memory Palace')],
  },
  {
    name: 'Expense Vault',
    match: [/\bexpense/, /\bbudget\b/, /\bkharcha\b/, /\bspending\b/],
    body:
      '**Expense Vault** logs spending against a monthly budget, with trends. Straight from chat: `add expense 120 chai`, `spent 40 on metro`.',
    actions: [openApp('Expense Vault', 'Open Expense Vault')],
  },
  {
    name: 'How NEXUS works',
    match: [/\bgemini\b/, /\bapi\s+key\b/, /\boffline\s+(?:brain|mode)\b/, /\bare\s+(?:you|u)\s+(?:online|offline|an?\s+ai)\b/, /\bhow\s+do\s+(?:you|u)\s+work\b/],
    body:
      'I run on two brains: this **offline brain** (commands, the OS guide, the learning coach, your decks and notes — no internet needed) and an optional **Gemini** link for open-ended chat.\n\n' +
      'To switch Gemini on, set `GEMINI_API_KEY` in the server environment (free key at aistudio.google.com). The key stays on the server and never reaches the browser.',
    actions: [HELP, TOUR],
  },
  {
    name: 'Your data',
    match: [/\bprivacy\b/, /\bmy\s+data\b/, /\bwhere\s+is\s+(?:my\s+)?data\b/, /\blocal\s?storage\b/, /\bis\s+(?:my\s+)?data\s+(?:safe|saved|stored)\b/],
    body:
      'Everything lives in this browser (offline-first): decks, notes, habits, chats. Guests too — your changes stay in your own browser. Turn off NEXUS\'s OS-context toggle and no OS state is sent with AI requests.',
    actions: [openApp('Settings', 'Open Settings')],
  },
  {
    name: 'NEXUS Dreams',
    match: [/\bdreams?\b/],
    body:
      '**NEXUS Dreams**: when you come back, a short dream of yesterday plays before boot — what you did and how much you studied. You can turn it off in Settings.',
    actions: [openApp('Settings', 'Open Settings')],
  },
  {
    name: 'Phantom windows',
    match: [/\bphantoms?\b/, /\bghost\s+windows?\b/, /\bclosed?\s+(?:a\s+)?window\s+by\s+mistake\b/, /\breopen\s+(?:a\s+)?closed\s+window\b/],
    body:
      'A closed window lingers for 8 seconds as a **phantom** — closed it by mistake? Click the phantom and it comes back with its scroll position and form state.',
    actions: [HELP],
  },
  {
    name: 'Campfire',
    match: [/\bcampfire\b/, /\bleaderboard\b/, /\bonline\s+warriors?\b/, /\bwar\s*cry\b/],
    body:
      'The **Campfire** shows other warriors live and anonymously — who is studying, quizzes today, streaks. Without a configured server it runs a local campfire (your open tabs plus simulated warriors).',
    actions: [STUDY_MODE],
  },
  {
    name: 'Typing biometrics',
    match: [/\bbiometrics?\b/, /\btyping\s+(?:rhythm|speed|stats|biometrics)\b/, /\bvitals\b/],
    body:
      '**Typing biometrics** (opt-in, in Settings) estimate energy, focus, fatigue and stress from your typing rhythm — all computed locally. NEXUS uses them for break and flow nudges.',
    actions: [openApp('Settings', 'Open Settings'), TAKE_BREAK],
  },
];

// ─── Helpers ───

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"`‘’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function hashPick<T>(items: readonly T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return items[Math.abs(h) % items.length];
}

function greetingFor(ctx: Ctx, guest: boolean): string {
  switch (ctx?.timeOfDay) {
    case 'morning':
      return 'Good morning';
    case 'afternoon':
      return 'Good afternoon';
    case 'evening':
      return 'Good evening';
    case 'night':
    case 'late-night':
      return guest ? 'Hello, night owl' : 'Raat ho gayi hai';
    default:
      return guest ? 'Hello' : 'Namaste';
  }
}

/** Best-scoring entry for a question (longest regex match wins ties). */
function findEntry(text: string): Entry | null {
  let best: Entry | null = null;
  let bestScore = 0;
  for (const entry of KNOWLEDGE) {
    let score = 0;
    for (const re of entry.match) {
      const m = re.exec(text);
      if (m) score += 10 + m[0].length;
    }
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

/** Topic of the previous NEXUS answer, for "explain more" follow-ups. */
function previousEntry(history: readonly NexusChatTurn[]): Entry | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = findEntry(normalize(history[i].content));
    if (entry) return entry;
  }
  return null;
}

/** One of the user's decks named in the text ("javascript" in "javascript kaise yaad karu"). */
function mentionedDeck(text: string, ctx: Ctx): string | null {
  for (const name of ctx?.decks ?? []) {
    const n = normalize(name);
    if (n.length >= 2 && ` ${text} `.includes(` ${n} `)) return name;
  }
  return null;
}

const TOPIC_PATTERNS: readonly RegExp[] = [
  /^(?:what\s+(?:is|are|was|were)|whats|what\s+does|define|explain|describe|tell\s+me\s+about|teach\s+me(?:\s+about)?|meaning\s+of|how\s+does)\s+(.+?)(?:\s+(?:work|works|mean|means|do|does))?$/i,
  /^(.+?)\s+(?:kya\s+(?:hai|hota\s+hai|hoti\s+hai|hote\s+hain|hain)|samjhao|samjha\s+do|explain\s+kar(?:o|do)?)$/i,
];

const NOT_A_TOPIC_RE =
  /^(?:this|that|it|you|u|up|going\s+on|time|date|today|this\s+os|warrior\s*os|nexus|happening)$|^(?:my|mera|meri|mere|your|tera|teri|tere)\b/;

/**
 * The subject of a "what is X" / "explain X" / "X kya hai" question, or
 * null for anything else. NexusCore uses it to look X up in the user's
 * own decks and notes when no AI is available.
 */
export function extractTopicQuery(message: string): string | null {
  // Case is kept so the reply shows "useEffect", not "useeffect".
  const text = message
    .replace(/[“”"`‘’']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[?!.]+$/, '')
    .trim();
  for (const re of TOPIC_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    const topic = m[1]
      .replace(/^(?:a|an|the)\s+/i, '')
      .replace(/\s+(?:in\s+(?:short|detail|simple\s+words))$/i, '')
      .trim();
    if (topic && topic.length <= 60 && wordCount(topic) <= 6 && !NOT_A_TOPIC_RE.test(topic.toLowerCase())) return topic;
  }
  return null;
}

function ownerLinks(): string {
  const links: string[] = [];
  const bare = (url: string) => url.replace(/^https?:\/\/(?:www\.)?/, '').replace(/\/$/, '');
  if (owner.github) links.push(`- GitHub: [${owner.handle ? `@${owner.handle}` : bare(owner.github)}](${owner.github})`);
  if (owner.linkedin) links.push(`- LinkedIn: [${bare(owner.linkedin)}](${owner.linkedin})`);
  if (owner.website) links.push(`- Website: [${bare(owner.website)}](${owner.website})`);
  if (owner.email) links.push(`- Email: [${owner.email}](mailto:${owner.email})`);
  if (owner.repo) links.push(`- Source code: [${bare(owner.repo)}](${owner.repo})`);
  return links.join('\n');
}

const OWNER_NAMES = [owner.shortName, owner.name, owner.handle]
  .map((n) => n.trim().toLowerCase())
  .filter(Boolean)
  .map(escapeRegExp);

const ABOUT_OWNER_RE = new RegExp(
  [
    String.raw`\bwho\s+(?:made|built|created|developed|designed|owns|coded|wrote)\b`,
    String.raw`\bwho\s+is\s+(?:the\s+)?(?:owner|creator|developer|builder|author|dev|maker)\b`,
    String.raw`\b(?:about|contact|hire|reach)\s+(?:the\s+)?(?:owner|creator|developer|builder|author|maker)\b`,
    String.raw`\b(?:built|made|created|developed)\s+by\b`,
    String.raw`\bkisne\s+banaya\b`,
    String.raw`\b(?:portfolio|github|linkedin|contact|hire)\b`,
    ...(OWNER_NAMES.length > 0 ? [String.raw`\b(?:${OWNER_NAMES.join('|')})\b`] : []),
  ].join('|')
);

const STACK_RE =
  /\b(?:tech\s+stack|stack|built\s+with|made\s+with|written\s+in|how\s+(?:was|is)\s+(?:this|it)\s+(?:built|made|coded)|(?:what|which)\s+framework|source\s+code|open\s+source)\b/;

const TOUR_RE =
  /\b(?:what\s+is\s+(?:this|warrior\s*os|this\s+(?:os|place|thing))|what\s+can\s+(?:i|you)\s+do\s+(?:here|in\s+this\s+os)|what\s+can\s+(?:this|it)\s+(?:os\s+)?do|(?:give\s+me\s+a\s+|quick\s+)?tour|show\s+me\s+around|features?|what\s+apps|what\s+should\s+i\s+(?:try|explore|check\s+out))\b/;

const COACH_RE =
  /\b(?:what\s+should\s+i\s+(?:study|learn|do|revise|review|padhu)|kya\s+padh(?:u|oon|na\s+chahiye)|aaj\s+kya\s+(?:padhu|karu|seekhu)|study\s+plan|plan\s+(?:my|for)\s+(?:day|today|evening|morning|week|next)|plan\s+my\b|where\s+(?:do|should)\s+i\s+(?:start|begin|continue)|what\s+next|next\s+step|ab\s+kya\s+karu|timetable|time\s+table|roadmap)\b/;

// ─── Replies that read live context ───

function tourReply(ctx: Ctx, guest: boolean): OfflineBrainReply {
  const deck = ctx?.decks?.[0];
  const quizExample = deck ? `quiz me on ${deck.toLowerCase()}` : 'quiz me';
  if (guest) {
    return reply(
      `Welcome to **Warrior OS** — ${owner.shortName}'s personal operating system, running entirely in your browser. Four sides to it:\n\n` +
        '- **Command center:** `Ctrl+K` and NEXUS (me) run the whole OS from plain language.\n' +
        '- **Discipline machine:** Habit Forge, focus sessions, streaks and XP — plus Reality Decay, which makes the OS crumble if you skip breaks.\n' +
        '- **Learn anything:** Training Grounds — your own decks, quizzes, spaced-repetition flashcards, a skill tree.\n' +
        '- **Creative playground:** Code Lab, Algo Lab, WarBeats music and a 3D Memory Palace.\n\n' +
        `Try saying \`study mode\` or \`${quizExample}\`. The Terminal hides a few easter eggs too.`,
      [openApp('Training Grounds', 'Open Training Grounds'), STUDY_MODE, openApp('Algo Lab', 'Open Algo Lab')]
    );
  }
  return reply(
    'Warrior OS ke chaar hisse:\n\n' +
      '- **Command center:** `Ctrl+K` + NEXUS — poora OS natural language se.\n' +
      '- **Discipline machine:** Habit Forge, pomodoro, streaks, XP aur Reality Decay.\n' +
      '- **Learn anything:** Training Grounds — tere decks, quiz, flashcards, skill tree, Quest Planner.\n' +
      '- **Creative playground:** Code Lab, Algo Lab, WarBeats, Memory Palace.\n\n' +
      `Shuru kar: \`study mode\` ya \`${quizExample}\`.`,
    [STUDY_MODE, review(), openApp('Code Lab', 'Open Code Lab')]
  );
}

function aboutOwnerReply(ctx: Ctx, guest: boolean): OfflineBrainReply {
  const links = ownerLinks();
  const actions = [TOUR, ask('What is this built with?', 'Tech stack'), openApp('Settings', 'Open Settings')];
  if (ctx?.visitor === 'owner') {
    return reply(
      `Tu hi to hai — **${owner.name}**, is OS ka builder. Visitors ko main yahi dikhata hoon:${links ? `\n\n${links}` : ''}`,
      actions
    );
  }
  return reply(
    `**Warrior OS** is ${owner.name}'s personal operating system — built from scratch to run entirely in the browser. It doubles as ${owner.shortName}'s portfolio.` +
      `${links ? `\n\n${links}` : ''}\n\n` +
      (guest
        ? 'Everything here works offline and your changes stay in your browser, so click around freely. Settings → About has the full story.'
        : 'Settings → About has the full story.'),
    actions
  );
}

function stackReply(): OfflineBrainReply {
  return reply(
    '**Warrior OS stack:**\n\n' +
      '- **Next.js 16 + React 19**, TypeScript\n' +
      '- **Zustand + Immer** for state, **Tailwind CSS 4** for styling, **Framer Motion** for motion\n' +
      '- **Three.js + React Three Fiber** (Memory Palace), **Tone.js** (music)\n' +
      '- Offline-first: every app keeps its data in this browser\n' +
      '- NEXUS: this rule-based offline brain, plus optional Gemini through a server route that keeps the key off the client' +
      (owner.repo ? `\n\nSource: [${owner.repo.replace(/^https?:\/\/(?:www\.)?/, '')}](${owner.repo})` : ''),
    [TOUR, openApp('Code Lab', 'Open Code Lab'), openApp('Settings', 'Open Settings')]
  );
}

function greetingReply(ctx: Ctx, guest: boolean, streak: number | null): OfflineBrainReply {
  const hello = greetingFor(ctx, guest);
  if (guest) {
    return reply(
      `${hello}! Welcome to ${owner.shortName}'s Warrior OS — I'm **NEXUS**, the companion built into it. Want a quick tour, or should I show you the learning engine?`,
      [TOUR, openApp('Training Grounds', 'Open Training Grounds'), ask('Who built this OS?', 'Who built this?')]
    );
  }
  const name = ctx?.visitor === 'owner' ? owner.shortName : 'warrior';
  const due = typeof ctx?.dueCards === 'number' ? ctx.dueCards : 0;
  const streakLine = streak !== null && streak > 0 ? ` Streak ${streak} din ka hai — aaj bhi todna nahi.` : ' Aaj ka pehla kadam uthate hain.';
  const dueLine = due > 0 ? ` ${due} cards review ke liye due hain.` : '';
  return reply(`${hello}, ${name}.${streakLine}${dueLine} Kya karna hai — review, quiz ya focus session?`, [
    due > 0 ? review(ctx?.focusDeck) : STUDY_MODE,
    quiz(ctx?.focusDeck, ctx?.focusDeck ? `${ctx.focusDeck} quiz` : 'Quick quiz'),
    FOCUS_SESSION,
  ]);
}

function identityReply(guest: boolean): OfflineBrainReply {
  if (guest) {
    return reply(
      `I'm **NEXUS**, the companion built into ${owner.shortName}'s Warrior OS. I run the OS from plain language (open apps, start focus sessions, quiz you on decks), explain every feature and coach learning. Right now I'm on my offline brain — none of that needs a cloud AI.`,
      [TOUR, HELP, ask('Who built this OS?', 'Who built this?')]
    );
  }
  return reply(
    `Main **NEXUS** hoon — ${owner.shortName} ke Warrior OS ka built-in companion. Apps chalata hoon, tere decks pe learning coach hoon (quiz, review, due cards), habits aur focus track karta hoon, aur OS ke har feature ka guide hoon. Abhi offline brain mode mein: ye sab bina key ke chalta hai; open-ended AI chat ke liye server pe \`GEMINI_API_KEY\` chahiye.`,
    [HELP, STUDY_MODE, MY_DECKS]
  );
}

function statusReply(ctx: Ctx): OfflineBrainReply {
  const parts: string[] = [];
  if (typeof ctx?.currentStreak === 'number') parts.push(`streak ${ctx.currentStreak} din`);
  if (typeof ctx?.userLevel === 'number') parts.push(`level ${ctx.userLevel}`);
  if (typeof ctx?.dueCards === 'number' && ctx.dueCards > 0) parts.push(`${ctx.dueCards} cards due`);
  const due = typeof ctx?.dueCards === 'number' && ctx.dueCards > 0;
  return reply(
    parts.length > 0
      ? `${parts.join(', ')}. Poori report: \`my stats\`.`
      : '`my stats` bol — level, streak aur weakest deck ek line mein.',
    [MY_STATS, ...(due ? [review(ctx?.focusDeck)] : [MY_DECKS])]
  );
}

const DUE_COUNT_RE =
  /\b(?:how\s+many|kitne|kitni|number\s+of)\b.*\b(?:cards?|reviews?|flashcards?)\b.*\b(?:due|pending|left|baaki)\b|\b(?:how\s+many|kitne|kitni)\s+(?:due|pending)\b|\b(?:anything|whats|kya)\s+due\b|\bdue\s+(?:cards?\s+)?(?:count|kitne|kitni)\b/;

function dueReply(ctx: Ctx, guest: boolean): OfflineBrainReply {
  const due = typeof ctx?.dueCards === 'number' ? ctx.dueCards : null;
  const focus = ctx?.focusDeck ?? null;
  if (due === null) {
    return reply(
      guest
        ? 'I can\'t see the decks right now (OS context is off). Say `review due cards` and the flashcards open on whatever is due.'
        : 'Decks abhi dikh nahi rahe (OS context off hai). `review due cards` bol — jo due hai seedha khul jayega.',
      [review(), MY_DECKS]
    );
  }
  if (due === 0) {
    return reply(
      guest
        ? 'Nothing is due right now — a good time for new cards or a quiz.'
        : 'Abhi koi card due nahi. Naya topic utha ya ek quiz se khud ko check kar.',
      [quiz(focus, focus ? `${focus} quiz` : 'Quick quiz'), MY_DECKS]
    );
  }
  const where = focus ? (guest ? ` — most of them in **${focus}**` : ` — sabse zyada **${focus}** mein`) : '';
  return reply(
    guest
      ? `**${due} ${due === 1 ? 'card is' : 'cards are'} due**${where}. Reviewing them now keeps them in memory.`
      : `**${due} ${due === 1 ? 'card' : 'cards'} due hain**${where}. 10-15 minute ka review — abhi kar le.`,
    [review(focus), MY_DECKS]
  );
}

function coachReply(ctx: Ctx): OfflineBrainReply {
  const decks = ctx?.decks;
  const due = typeof ctx?.dueCards === 'number' ? ctx.dueCards : null;
  const focus = ctx?.focusDeck ?? null;
  const lastQuiz = typeof ctx?.lastQuizScore === 'number' ? Math.round(ctx.lastQuizScore) : null;
  const weakLine = lastQuiz !== null && lastQuiz < 60 ? `Your last quiz was ${lastQuiz}% — revise that deck first.\n\n` : '';
  const focusQuiz = quiz(focus, focus ? `${focus} quiz` : 'Quick quiz');

  if (decks && decks.length === 0) {
    return reply(
      'No decks yet. Pick anything you want to learn, split it into 5 topics and write 10 cards per topic. From tomorrow: 15 minutes of review a day.',
      [openApp('Training Grounds', 'Open Training Grounds'), ask('How do I learn anything faster?', 'Learning loop')]
    );
  }
  if (due !== null && due > 0) {
    return reply(
      `${weakLine}**Today's order:**\n\n` +
        `1. Review the **${due} due cards**${focus ? `, starting with ${focus}` : ''} (10-15 min).\n` +
        `2. A ${focus ?? 'deck'} quiz — read the explanation for every miss.\n` +
        '3. One new topic + 10 new cards.\n' +
        '4. Tick one habit.',
      [review(focus), focusQuiz, FOCUS_SESSION]
    );
  }
  if (due === 0) {
    return reply(
      `${weakLine}Nothing due — a day for new material:\n\n` +
        `1. Learn a new topic from ${focus ? `**${focus}**` : 'your weakest deck'} (one pomodoro).\n` +
        '2. Write 10 cards on it.\n' +
        '3. Check yourself with a mixed quiz.\n' +
        '4. Tick one habit.',
      [STUDY_MODE, focusQuiz, FOCUS_SESSION]
    );
  }
  return reply(
    `${weakLine}**The daily loop:**\n\n` +
      '1. Review due cards (10-15 min).\n' +
      '2. Quiz one deck — read the explanation for every miss.\n' +
      '3. One new topic + 10 new cards.\n' +
      '4. Tick one habit.',
    [review(), quiz(null, 'Quick quiz'), FOCUS_SESSION]
  );
}

// ─── Main entry ───

/**
 * Answer a message without any LLM. Always returns something useful:
 * a direct answer when a rule matches, otherwise an honest "offline"
 * reply with the closest actionable next steps.
 */
export function offlineNexusReply(
  rawMessage: string,
  context: Ctx = null,
  history: readonly NexusChatTurn[] = []
): OfflineBrainReply {
  const text = normalize(rawMessage);
  const guest = context?.visitor === 'guest';
  const streak = typeof context?.currentStreak === 'number' ? context.currentStreak : null;
  const late = context?.timeOfDay === 'late-night';

  if (!text) return reply(guest ? 'Type something and I will take it from there.' : 'Kuch likh to sahi.');

  // Greetings
  if (/^(?:hi+|hey+|hello+|yo|namaste|namaskar|sup|hola|good\s+(?:morning|afternoon|evening|night)|kaise\s+ho|kya\s+haal\s+hai|wassup|whats\s+up)\b[\s!.?]*(?:nexus|warrior|bhai|yaar|there)?[\s!.?]*$/.test(text)) {
    return greetingReply(context, guest, streak);
  }

  // Thanks
  if (/^(?:thanks?|thank\s+you|thx|ty|shukriya|dhanyavaad|dhanyavad|great|nice|awesome|cool|ok(?:ay)?\s+thanks?)\b/.test(text)) {
    if (guest) return reply('Anytime. Enjoy exploring!', [TOUR, ask('Who built this OS?', 'Who built this?')]);
    return reply(hashPick(['Kaam pe lag ja ab.', 'Thanks baad mein — pehle ek pomodoro.', 'Chal, ab execute kar.'], text), [
      FOCUS_SESSION,
    ]);
  }

  // Identity
  if (/\b(?:who|what)\s+are\s+(?:you|u)\b|\btum\s+kaun\b|\btu\s+kaun\b|\byour\s+name\b|\bintroduce\s+yourself\b/.test(text)) {
    return identityReply(guest);
  }
  if (/\bwho\s+am\s+i\b|\bwhoami\b|\bmain\s+kaun\s+(?:hoon|hu|hun)\b/.test(text)) {
    if (context?.visitor === 'owner') {
      return reply(`Tu **${owner.name}** hai — is OS ka maalik. Main tera NEXUS.`, [MY_STATS, STUDY_MODE]);
    }
    return guest
      ? reply(`A guest exploring ${owner.shortName}'s OS. Welcome aboard — your changes stay in your browser.`, [TOUR])
      : reply('Is browser mein tu warrior hai. Lock screen pe owner ya guest chun sakta hai.', [HELP]);
  }

  // The owner, the stack, the tour (portfolio questions). A named feature wins over the tour.
  const entry = findEntry(text);
  if (STACK_RE.test(text)) return stackReply();
  if (ABOUT_OWNER_RE.test(text)) return aboutOwnerReply(context, guest);
  if (!entry && (TOUR_RE.test(text) || (guest && /\bwhere\s+(?:do|should)\s+i\s+(?:start|begin)\b/.test(text)))) {
    return tourReply(context, guest);
  }

  // Time / date
  if (/\b(?:what\s+(?:is\s+the\s+)?time|time\s+kya\s+hai|kitne\s+baje|current\s+time)\b/.test(text)) {
    const now = context?.localTime ? `Abhi ${context.localTime} ho rahe hain.` : 'Clock taskbar pe hai.';
    return reply(`${now}${late ? ' Late ho gaya — halka revision kar, heavy kaam kal subah.' : ' Time hai — ek focus session nikaal.'}`, [
      FOCUS_SESSION,
    ]);
  }
  if (/\b(?:what\s+(?:is\s+)?(?:the\s+)?(?:date|day)|aaj\s+kya\s+(?:date|din)|todays?\s+date)\b/.test(text)) {
    return reply('Date taskbar clock pe hai (Calendar app mein poora month). Date se zyada important — aaj ka target kya hai?', [
      openApp('Calendar', 'Open Calendar'),
      ask('What should I study today?', 'Aaj kya karu?'),
    ]);
  }

  // My streak / level
  if (/\b(?:my|mera|meri)\s+(?:streak|level|xp)\b|\bstreak\s+(?:kitna|kitni|kya)\b/.test(text)) {
    return statusReply(context);
  }

  // How many cards are due
  if (DUE_COUNT_RE.test(text)) return dueReply(context, guest);

  // Motivation / fatigue / procrastination
  if (/\b(?:demotivat|unmotivat|no\s+motivation|motivation|give\s+up|quit|haar|hopeless|depress|sad|udaas|bored|boring|procrastinat|lazy|aalas|man\s+nahi|mann\s+nahi|cant\s+focus|distract)/.test(text)) {
    const base = hashPick(
      [
        'Motivation aata-jaata hai, **discipline** rehta hai. Bas 25 minute — timer start kar, baaki baad mein soch.',
        'Mann nahi hai? Theek hai. Sabse chhota task utha: sirf 5 due cards. Momentum khud aa jayega.',
        'Har pro ke bhi aise din aate hain. Farak ye hai ki woh fir bhi ek session nikaalte hain. Tu bhi nikaal.',
      ],
      text
    );
    const streakLine = streak !== null && streak > 0 ? ` ${streak} din ka streak hai — use bekaar mat jaane de.` : '';
    return reply(`${base}${streakLine}`, [FOCUS_SESSION, review(context?.focusDeck, 'Just 5 cards'), TAKE_BREAK]);
  }
  if (/\b(?:tired|thak|sleepy|neend|exhausted|burn\s?out|headache|sar\s+dard)\b/.test(text)) {
    return reply(
      late
        ? 'Thaka hua dimaag galtiyan karta hai. Aaj 10 min halka review, fir so ja — kal subah fresh start.'
        : '5 minute break le: paani pee, screen se nazar hata, 4-7-8 breathing. Fir ek chhota pomodoro.',
      [TAKE_BREAK, { type: 'chill_mode', label: 'Chill mode' }]
    );
  }

  // Learning coach: what to do next, over the user's own decks.
  if (COACH_RE.test(text)) return coachReply(context);

  // The OS and learning technique.
  if (entry) return reply(entry.body, entry.actions);
  if (/^(?:explain\s+(?:more|again)|more|aur\s+batao|example(?:\s+do)?|detail(?:\s+mein)?|elaborate|samjha(?:o)?)\b/.test(text)) {
    const prev = previousEntry(history);
    if (prev) {
      return reply(
        `**${prev.name}** ka depth offline mein itna hi hai. Best next step: apne shabdon mein ek note likh, fir usi pe 3 cards bana — likha hua yaad rehta hai.`,
        prev.actions
      );
    }
  }

  // One of the user's decks named directly.
  const deck = mentionedDeck(text, context);
  if (deck) {
    return reply(
      guest
        ? `**${deck}** is one of the decks here. Quiz yourself, review the cards that are due, or search the notes.`
        : `**${deck}** tera deck hai. Quiz se check kar, due cards review kar, ya notes mein dekh.`,
      [quiz(deck, `${deck} quiz`), review(deck, `Review ${deck}`), searchNotes(deck)]
    );
  }

  // "What is X": NexusCore adds what the user's own decks and notes say.
  const topic = extractTopicQuery(rawMessage);
  if (topic) {
    return reply(
      guest
        ? `**${topic}**: I don't have a ready explanation offline (open-ended answers need a Gemini key on the server). I also check the decks and notes in this browser — anything relevant shows up here.`
        : `**${topic}** ka ready explanation offline brain mein nahi hai — open-ended answers ke liye Gemini key chahiye. Tere apne decks aur notes check karta hoon; wahan bhi nahi hai to Notes mein Feynman-style likh aur 3 cards bana — agli baar ready rahega.`,
      [searchNotes(topic), openApp('Notes', 'Write a note'), openApp('Training Grounds', 'Open Training Grounds')]
    );
  }

  // Code questions
  if (/\b(?:code|coding|program|function|bug|error|compile|javascript|typescript|react|python|java|leetcode)\b/.test(text) || /c\+\+/.test(text)) {
    return reply(
      'Offline brain full code generation nahi karta. Approach: problem ko chhote cases mein tod, pehle brute force likh, fir optimise. Code Lab khol ke try kar — atak jaaye to exact error yahan paste kar (Gemini key ho to poora debug milega).',
      [openApp('Code Lab', 'Open Code Lab'), openApp('Algo Lab', 'Algo visualizer')]
    );
  }

  // Honest fallback
  if (guest) {
    return reply(
      "That's outside my offline brain — open-ended answers need a Gemini key on the server. Offline I can still run the whole OS: open apps, quiz you on decks, start focus sessions, search notes, switch modes, and explain any feature or who built this.",
      [TOUR, HELP, ask('Who built this OS?', 'Who built this?')]
    );
  }
  return reply(
    'Ye offline brain ke bahar hai — open-ended answers ke liye server pe `GEMINI_API_KEY` set kar. Offline main ye sab karta hoon: apps chalana, tere decks pe quiz aur review (`quiz me on <deck>`, `review due cards`), habits, pomodoro, notes search, smart modes, aur OS ke har feature ka guide.',
    [HELP, MY_DECKS, STUDY_MODE]
  );
}
