// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Sample Deck: Warrior OS Basics
// A short tour of the OS that doubles as a demo of every card kind.
// Ids are stable, so restoring it never creates a duplicate.
// ═══════════════════════════════════════════════════════════

import type { DeckInput } from '@/types/learning';

export const WARRIOR_OS_BASICS: DeckInput = {
  id: 'sample-warrior-os-basics',
  name: 'Warrior OS Basics',
  description: 'A quick tour of your OS, and a demo of how decks, quizzes and flashcards work. Safe to delete.',
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
          explanation: 'Ctrl+K opens the palette: launch apps, run NEXUS commands and quick actions from one box.',
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
            'Study, Build and Chill each keep their own windows. Switch from the taskbar or ask NEXUS ("go to build workspace").',
          difficulty: 'easy',
          tags: ['workspaces'],
        },
        {
          id: 'sample-basics-nexus',
          kind: 'flashcard',
          prompt: 'What is NEXUS?',
          back: 'The built-in assistant. Type or say commands like "study mode", "open notes" or "start pomodoro" and it runs them on the OS, even offline.',
          difficulty: 'easy',
          tags: ['nexus'],
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
          explanation: 'Intervals grow with each correct recall: 1 day after the first, 3 days after the second, then roughly ×2.5 each time.',
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
