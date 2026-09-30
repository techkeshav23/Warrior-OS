// ═══════════════════════════════════════════════════════════
// WARRIOR OS — JARVIS tool declarations (shared, pure)
//
// The functions the model may call. The server sends these to Gemini
// (function calling); the browser runs them (src/lib/jarvis/executors.ts)
// against the owner's live data and the OS, then returns the results.
// Schemas use Gemini's OpenAPI subset (OBJECT / STRING / NUMBER / ...).
// ═══════════════════════════════════════════════════════════

export interface JarvisToolDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: 'OBJECT';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'STRING', description, ...extra });
const num = (description: string) => ({ type: 'NUMBER', description });
const int = (description: string) => ({ type: 'INTEGER', description });

export const JARVIS_TOOLS: readonly JarvisToolDeclaration[] = [
  // ─── Read the owner's data ───
  {
    name: 'get_overview',
    description:
      'Snapshot of the owner right now: date/time, level and XP, streaks, cards due, habits done today, today and upcoming calendar events, this month\'s spending vs budget, active projects, open apps. Call this first when the question is about "today", "my progress" or planning.',
  },
  {
    name: 'search_notes',
    description: 'Search the owner\'s notes by words in the title, body or tags. Returns ids, titles, tags and a short snippet.',
    parameters: {
      type: 'OBJECT',
      properties: { query: str('Words to look for'), limit: int('Max results (default 8)') },
      required: ['query'],
    },
  },
  {
    name: 'read_note',
    description: 'Full text of one note, by id or exact/partial title.',
    parameters: { type: 'OBJECT', properties: { note: str('Note id or title') }, required: ['note'] },
  },
  {
    name: 'list_decks',
    description: 'All flashcard/quiz decks with their topics, card counts and how many cards are due now.',
  },
  {
    name: 'get_due_cards',
    description: 'Cards due for review now (question and answer), optionally for one deck. Use to quiz the owner in chat.',
    parameters: {
      type: 'OBJECT',
      properties: { deck: str('Deck name (optional)'), limit: int('Max cards (default 10)') },
    },
  },
  {
    name: 'list_habits',
    description: 'Habits with whether each is done today and its current streak.',
  },
  {
    name: 'list_events',
    description: 'Calendar events between two dates (recurring events expanded). Defaults to today through 7 days ahead.',
    parameters: {
      type: 'OBJECT',
      properties: {
        from: str('Start date, YYYY-MM-DD (default today)'),
        to: str('End date inclusive, YYYY-MM-DD (default today + 7 days)'),
      },
    },
  },
  {
    name: 'list_expenses',
    description: 'Expenses for a month with totals per category and the monthly budget.',
    parameters: {
      type: 'OBJECT',
      properties: {
        month: str('Month as YYYY-MM (default this month)'),
        category: str('Only this category (optional)'),
      },
    },
  },
  {
    name: 'list_projects',
    description: 'Projects in Project Forge with status, progress and time logged.',
    parameters: { type: 'OBJECT', properties: { status: str('Only this status column (optional)') } },
  },

  // ─── Change the owner's data ───
  {
    name: 'create_note',
    description: 'Create a new note. Markdown is fine. Use for "note this down", summaries, plans.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: str('Note title'),
        content: str('Note body (markdown)'),
        tags: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Tags (optional)' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'append_to_note',
    description: 'Add text to the end of an existing note.',
    parameters: {
      type: 'OBJECT',
      properties: { note: str('Note id or title'), text: str('Text to append') },
      required: ['note', 'text'],
    },
  },
  {
    name: 'add_expense',
    description: 'Log an expense in Expense Vault (amount in the owner\'s currency).',
    parameters: {
      type: 'OBJECT',
      properties: {
        amount: num('Amount, positive'),
        category: str('Category, e.g. food, travel, books, bills, fun, other'),
        note: str('What it was for (optional)'),
        date: str('YYYY-MM-DD (default today)'),
      },
      required: ['amount', 'category'],
    },
  },
  {
    name: 'add_event',
    description: 'Add a calendar event.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: str('Event title'),
        date: str('YYYY-MM-DD'),
        start_time: str('HH:MM 24h (omit for all-day)'),
        end_time: str('HH:MM 24h (optional)'),
        category: str('study, work, personal, health or other (optional)'),
        remind_minutes_before: int('Reminder lead time for timed events (default 10; 0 = none)'),
        note: str('Details (optional)'),
      },
      required: ['title', 'date'],
    },
  },
  {
    name: 'check_habit',
    description: 'Mark a habit done for today.',
    parameters: { type: 'OBJECT', properties: { habit: str('Habit name') }, required: ['habit'] },
  },
  {
    name: 'create_flashcards',
    description:
      'Add question/answer flashcards to a deck (the deck and topic are created if missing). Use after explaining a topic, or when the owner asks for cards.',
    parameters: {
      type: 'OBJECT',
      properties: {
        deck: str('Deck name'),
        topic: str('Topic inside the deck (optional)'),
        cards: {
          type: 'ARRAY',
          description: 'Cards to add (max 30)',
          items: {
            type: 'OBJECT',
            properties: { front: str('Question'), back: str('Answer') },
            required: ['front', 'back'],
          },
        },
      },
      required: ['deck', 'cards'],
    },
  },
  {
    name: 'add_project',
    description: 'Create a project in Project Forge.',
    parameters: {
      type: 'OBJECT',
      properties: { name: str('Project name'), description: str('Short description (optional)') },
      required: ['name'],
    },
  },

  // ─── Drive the OS ───
  {
    name: 'open_app',
    description:
      'Open (or bring forward) an app. Ids: training-grounds, study-planner (habits), flashcards, notes, memory-palace, code-editor, project-tracker, algo-lab, resume-builder, terminal, nexus-ai, settings, file-manager, calculator, calendar, expense-vault, music-player, weather, warrior-profile (stats), warrior-hall (3D warrior avatar).',
    parameters: { type: 'OBJECT', properties: { app: str('App id or name') }, required: ['app'] },
  },
  {
    name: 'start_training',
    description: 'Start studying in Training Grounds: a quiz, a spaced-repetition review, or a mock test, optionally for one deck.',
    parameters: {
      type: 'OBJECT',
      properties: {
        mode: str('quiz, review or mock', { enum: ['quiz', 'review', 'mock'] }),
        deck: str('Deck name (optional)'),
      },
      required: ['mode'],
    },
  },
  {
    name: 'pomodoro',
    description: 'Start or stop the focus timer.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: str('start or stop', { enum: ['start', 'stop'] }),
        minutes: int('Focus length in minutes when starting (default 25)'),
      },
      required: ['action'],
    },
  },
  {
    name: 'set_wallpaper',
    description:
      'Change the desktop background. Ids: void, embers, molten, dusk, steelrain, starfield, nebula, aurora, fluid, matrix, neural, or "next" / "random".',
    parameters: { type: 'OBJECT', properties: { wallpaper: str('Wallpaper id') }, required: ['wallpaper'] },
  },
  {
    name: 'warrior_action',
    description:
      'Make the owner\'s 3D warrior avatar perform a move (opens Warrior Hall if no warrior is on screen). "warrior se punch karwao" → punch.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: str('The move', { enum: ['punch', 'powerup', 'victory', 'hurt', 'stance', 'idle'] }),
      },
      required: ['action'],
    },
  },
  {
    name: 'switch_workspace',
    description: 'Switch desktop workspace: study, build or chill.',
    parameters: { type: 'OBJECT', properties: { workspace: str('study, build or chill') }, required: ['workspace'] },
  },

  // ─── Weather and reminders ───
  {
    name: 'get_weather',
    description: 'Current weather and the next few hours for the owner\'s saved city (or current location).',
  },
  {
    name: 'set_reminder',
    description:
      'Set a reminder NEXUS will announce (spoken + notification). Give either in_minutes, or at as local date-time YYYY-MM-DDTHH:MM.',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: str('What to remind about, short'),
        in_minutes: int('Minutes from now'),
        at: str('Local date-time YYYY-MM-DDTHH:MM'),
      },
      required: ['text'],
    },
  },
  {
    name: 'list_reminders',
    description: 'Upcoming reminders with ids and times.',
  },
  {
    name: 'cancel_reminder',
    description: 'Cancel an upcoming reminder by id.',
    parameters: { type: 'OBJECT', properties: { id: str('Reminder id') }, required: ['id'] },
  },

  // ─── Long-term memory ───
  {
    name: 'remember',
    description:
      'Save a lasting fact about the owner (goals, preferences, exam dates, people, routines). Only things worth knowing next week; never secrets or passwords.',
    parameters: { type: 'OBJECT', properties: { fact: str('One short sentence') }, required: ['fact'] },
  },
  {
    name: 'forget',
    description: 'Delete a remembered fact by its id (ids are listed in your memory).',
    parameters: { type: 'OBJECT', properties: { id: str('Memory id') }, required: ['id'] },
  },
];

export const JARVIS_TOOL_NAMES = new Set(JARVIS_TOOLS.map((t) => t.name));

/** Tools that change data or the screen (shown to the owner as "done" chips). */
export const JARVIS_ACTION_TOOLS = new Set([
  'create_note',
  'append_to_note',
  'add_expense',
  'add_event',
  'check_habit',
  'create_flashcards',
  'add_project',
  'open_app',
  'start_training',
  'pomodoro',
  'set_wallpaper',
  'warrior_action',
  'switch_workspace',
  'set_reminder',
  'cancel_reminder',
  'remember',
  'forget',
]);

// ─── Wire format (browser ⇄ /api/jarvis) ───

/** Gemini content parts the loop passes around (opaque extras are kept). */
export interface JarvisPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; response: Record<string, unknown>; id?: string };
  thoughtSignature?: string;
  [key: string]: unknown;
}

export interface JarvisContent {
  role: 'user' | 'model';
  parts: JarvisPart[];
}

export interface JarvisMemoryFact {
  id: string;
  fact: string;
  createdAt: string;
}

/** POST /api/jarvis body. */
export interface JarvisRequest {
  contents: JarvisContent[];
  memory?: JarvisMemoryFact[];
  /** The owner's local time, e.g. "2026-09-30T09:15:00+05:30", and IANA zone. */
  now?: string;
  timeZone?: string;
}

/** POST /api/jarvis → the model's next turn. */
export interface JarvisResponse {
  content: JarvisContent;
  model: string;
}

export const JARVIS_LIMITS = {
  /** Tool-call rounds per user message before the loop stops. */
  maxSteps: 8,
  /** Max contents entries sent per request (older turns are dropped). */
  maxContents: 60,
  /** Max request body size. */
  maxBodyChars: 400_000,
  /** Max remembered facts sent along. */
  maxMemory: 80,
} as const;
