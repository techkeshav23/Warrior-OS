// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Sample Deck: Warrior OS Basics
// A tour of the OS that doubles as a demo of every card kind.
// Every fact here matches the code (shortcuts, thresholds, timings).
// Ids are stable, so restoring it never creates a duplicate and
// review progress survives content updates.
// ═══════════════════════════════════════════════════════════

import type { DeckInput } from '@/types/learning';

export const WARRIOR_OS_BASICS: DeckInput = {
  id: 'sample-warrior-os-basics',
  name: 'Warrior OS Basics',
  description: 'A tour of your OS: shortcuts, NEXUS, the living world and how training works. Safe to delete.',
  color: '#22d3ee',
  icon: '🛡️',
  isSample: true,
  topics: [
    {
      id: 'sample-basics-getting-around',
      name: 'Getting Around',
      cards: [
        {
          id: 'sample-basics-palette',
          kind: 'mcq',
          prompt: 'Which shortcut opens the command palette?',
          options: ['Ctrl+K', 'Ctrl+P', 'Alt+Tab', 'Ctrl+Q'],
          answer: 0,
          explanation:
            'Ctrl+K (Cmd+K on macOS) opens the palette: launch apps, search notes, run quick actions, or type a plain request like "study mode" and NEXUS turns it into actions.',
          difficulty: 'easy',
          tags: ['shortcuts'],
        },
        {
          id: 'sample-basics-workspaces',
          kind: 'multi-select',
          prompt: 'Which of these are Warrior OS workspaces? Pick all that apply.',
          options: ['Study', 'Build', 'Chill', 'Party'],
          answers: [0, 1, 2],
          explanation:
            'Each workspace keeps its own windows, accent colour and wallpaper. Ctrl+1, Ctrl+2 and Ctrl+3 jump straight to Study, Build and Chill.',
          difficulty: 'easy',
          tags: ['workspaces', 'shortcuts'],
        },
        {
          id: 'sample-basics-app-shortcut',
          kind: 'mcq',
          prompt: 'Ctrl+G opens which app?',
          options: ['Training Grounds', 'Memory Palace', 'Code Lab', 'Terminal'],
          answer: 0,
          explanation:
            'Apps carry their own shortcuts: Ctrl+G Training Grounds, Ctrl+Shift+M Memory Palace, Ctrl+Shift+C Code Lab, Ctrl+` Terminal, Ctrl+M WarBeats.',
          difficulty: 'medium',
          tags: ['shortcuts', 'apps'],
        },
        {
          id: 'sample-basics-nexus',
          kind: 'flashcard',
          prompt: 'What is NEXUS?',
          back: 'The OS assistant with a personality. Type or say what you want in plain English or Hinglish ("open notes", "start pomodoro", "add expense 120 chai", "close terminal") and it runs it on the OS. Without an API key it answers from its offline brain.',
          difficulty: 'easy',
          tags: ['nexus'],
        },
        {
          id: 'sample-basics-study-mode',
          kind: 'mcq',
          prompt: 'What does the NEXUS command "study mode" do?',
          options: [
            'Switches to Study, minimizes distractions, opens Training Grounds and Notes side by side and starts a pomodoro',
            'Locks the screen until you finish a quiz',
            'Turns off every animation for the rest of the day',
            'Opens every deck in its own window',
          ],
          answer: 0,
          explanation: 'Smart modes chain several actions in one command; "chill mode" is the relaxed counterpart.',
          difficulty: 'medium',
          tags: ['nexus'],
        },
      ],
    },
    {
      id: 'sample-basics-living-world',
      name: 'The Living World',
      cards: [
        {
          id: 'sample-basics-creature-hatch',
          kind: 'mcq',
          prompt: 'When does the Warrior Creature hatch from its egg?',
          options: [
            'On day three, once it has been fed 100 XP',
            'The moment you first open the OS',
            'After your first perfect quiz',
            'After a full week of streaks',
          ],
          answer: 0,
          explanation:
            'The egg incubates for two days and needs 100 XP. Then it grows on the XP you earn (baby, teen, adult, legendary, mythic) and falls asleep after two idle hours.',
          difficulty: 'medium',
          tags: ['creature'],
        },
        {
          id: 'sample-basics-creature-forms',
          kind: 'multi-select',
          prompt: 'Which forms can the creature evolve into? Pick all that apply.',
          options: ['Scholar Phoenix', 'Code Serpent', 'Warrior Dragon', 'Pixel Golem'],
          answers: [0, 1, 2],
          explanation:
            'Mostly studying makes a Scholar Phoenix, mostly coding a Code Serpent, and a balance of both a Warrior Dragon.',
          difficulty: 'medium',
          tags: ['creature'],
        },
        {
          id: 'sample-basics-palace-rooms',
          kind: 'numeric',
          prompt: 'How many notes unlock each new room in the Memory Palace?',
          answer: 10,
          unit: 'notes',
          explanation:
            'Notes become glowing objects in themed rooms: a new room every 10 notes, a new wing every 100 and a Grand Hall at 500. Walk with WASD and press O for the overview map.',
          difficulty: 'medium',
          tags: ['memory-palace'],
        },
        {
          id: 'sample-basics-decay',
          kind: 'numeric',
          prompt: 'After how many hours of unbroken work does Reality Decay force a break?',
          answer: 4,
          unit: 'hours',
          explanation:
            'Decay starts at 2 hours with a warm colour shift and deepens every 30 minutes. At 4 hours the screen fractures and a short break repairs it. Stepping away for 30 minutes resets the clock.',
          difficulty: 'medium',
          tags: ['decay'],
        },
        {
          id: 'sample-basics-phantom',
          kind: 'flashcard',
          prompt: 'What is a phantom window?',
          back: 'The ghost of a window you just closed. It drifts for 8 seconds; click it to resurrect the app with its scroll position and form input restored.',
          difficulty: 'easy',
          tags: ['phantoms'],
        },
        {
          id: 'sample-basics-biometrics',
          kind: 'mcq',
          prompt: 'What do typing biometrics measure?',
          options: [
            'Only the timing of keystrokes, never the keys or the text',
            'Every word you type, per app',
            'Your webcam and microphone',
            'Whatever you copy to the clipboard',
          ],
          answer: 0,
          explanation:
            'Timing becomes live energy, focus, fatigue and stress readings. Password and payment fields are ignored, and only hourly averages are stored.',
          difficulty: 'medium',
          tags: ['biometrics', 'privacy'],
        },
        {
          id: 'sample-basics-dreams',
          kind: 'flashcard',
          prompt: 'What is a dream in Warrior OS?',
          back: 'When you come back, NEXUS replays yesterday as a short cinematic built from your quizzes, notes, habits and projects, before the lock screen. Esc skips it, and Settings can turn dreams off.',
          difficulty: 'medium',
          tags: ['dreams', 'nexus'],
        },
      ],
    },
    {
      id: 'sample-basics-system',
      name: 'Under the Hood',
      cards: [
        {
          id: 'sample-basics-lite-mode',
          kind: 'multi-select',
          prompt: 'With Performance set to Auto, which of these switch Lite mode on? Pick all that apply.',
          options: [
            '4 GB of device memory or less',
            '4 CPU threads or fewer',
            'The system asks for reduced motion',
            'More than five open windows',
          ],
          answers: [0, 1, 2],
          explanation:
            'Lite mode swaps the WebGL wallpapers for CSS ones and skips heavy canvases; every app keeps working. Settings → Performance can force it on or off.',
          difficulty: 'hard',
          tags: ['performance'],
        },
        {
          id: 'sample-basics-local-data',
          kind: 'mcq',
          prompt: 'Where do your decks, notes and habits live?',
          options: [
            'In this browser: the OS is offline-first',
            'On a server you have to sign in to',
            'In a cookie that expires every day',
            'Nowhere: they reset on reload',
          ],
          answer: 0,
          explanation:
            'Everything is saved locally first and every cloud feature is optional. Export decks from Training Grounds → Decks to back them up or move them to another browser.',
          difficulty: 'easy',
          tags: ['data'],
        },
      ],
    },
    {
      id: 'sample-basics-training',
      name: 'Training Grounds',
      cards: [
        {
          id: 'sample-basics-spaced-repetition',
          kind: 'flashcard',
          prompt: 'How does spaced repetition decide when you see a card again?',
          back: 'Every correct recall pushes the next review further out; a miss brings the card back within minutes.',
          explanation: 'Reviewing right before you would forget is what makes memories stick.',
          difficulty: 'medium',
          tags: ['learning'],
        },
        {
          id: 'sample-basics-interval',
          kind: 'numeric',
          prompt:
            'You answer a new card correctly, then correctly again when it comes due. In how many days is it due next?',
          answer: 3,
          unit: 'days',
          explanation:
            'Intervals grow with each correct recall: 1 day after the first, 3 days after the second, then roughly ×2.5 each time.',
          difficulty: 'medium',
          tags: ['learning'],
        },
        {
          id: 'sample-basics-mastery',
          kind: 'mcq',
          prompt: "What raises a deck's mastery?",
          options: [
            'Opening the deck often',
            'Answering its cards correctly, again and again',
            'Adding more cards to it',
            'Leaving it untouched for a week',
          ],
          answer: 1,
          explanation:
            'Mastery averages every card in the deck. Unseen cards count as zero, and a card reaches full strength after consistent correct answers.',
          difficulty: 'easy',
          tags: ['learning'],
        },
      ],
    },
  ],
};
