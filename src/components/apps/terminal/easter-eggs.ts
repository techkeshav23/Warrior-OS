// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Easter Eggs (Terminal)
// Fun hidden commands for the terminal
// ═══════════════════════════════════════════════════════════

import type { CommandResult } from './commands';

type EasterEggHandler = (args: string[]) => CommandResult;

const matrixCommand: EasterEggHandler = () => ({
  type: 'ascii',
  output: `
  ⠀⠀⣀⣠⠤⠶⠶⠶⠤⣤⣀⡀⠀⠀⠀
  ⣠⡾⠋⠁⠀⠀⠀⠀⠀⠀⠈⠙⠳⣦⡀
  ⣿⠀ FOLLOW THE WHITE RABBIT ⣿
  ⠹⣧⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣴⠟
  ⠀⠈⠛⠶⣤⣄⣀⣀⣀⣤⠶⠛⠁⠀

  Wake up, warrior...
  The Matrix has you...
  Follow the white rabbit 🐇

  01001000 01100001 01100011 01101011
  01010100 01101000 01100101 01010000
  01101100 01100001 01101110 01100101 01110100`,
});

const cowsayCommand: EasterEggHandler = (args) => {
  const text = args.join(' ') || 'Moo! Study hard!';
  const border = '-'.repeat(text.length + 2);
  return {
    type: 'ascii',
    output: ` ${border}
< ${text} >
 ${border}
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||`,
  };
};

const hackCommand: EasterEggHandler = () => ({
  type: 'ascii',
  output: `[██████████████████████████] 100%

  ACCESS GRANTED
  ═══════════════════════════════
  Connecting to GATE exam server...
  Downloading question bank...
  Injecting knowledge directly...
  
  ERROR: Shortcut not found.
  
  The only hack is HARD WORK. 💪
  Get back to studying, warrior.`,
});

const motivateCommand: EasterEggHandler = () => {
  const msgs = [
    `
  ╔═══════════════════════════════╗
  ║   YOU ARE STRONGER THAN       ║
  ║   YOUR EXCUSES               ║
  ╚═══════════════════════════════╝
  
  Every hour you study is one step closer.
  AIR 1 studied the same syllabus. You can too.`,

    `
  🔥 WARRIOR MODE: ACTIVATED 🔥
  
  While others scroll, you code.
  While others sleep, you solve.
  While others quit, you persist.
  
  GATE is not about genius — it's about GRIT.`,

    `
  ┌─────────────────────────────┐
  │  DAILY REMINDER:            │
  │                             │
  │  • You chose this path      │
  │  • You can handle this      │
  │  • Consistency > Intensity  │
  │  • Progress is progress     │
  │  • You WILL crack GATE      │
  └─────────────────────────────┘`,
  ];
  return {
    type: 'success',
    output: msgs[Math.floor(Math.random() * msgs.length)],
  };
};

const warriorCommand: EasterEggHandler = () => ({
  type: 'ascii',
  output: `
    ⚔️  THE WARRIOR'S CODE  ⚔️
  ════════════════════════════
  
     ██╗    ██╗
     ██║    ██║
     ██║ █╗ ██║
     ██║███╗██║
     ╚███╔███╔╝
      ╚══╝╚══╝
  
  1. Wake up with purpose
  2. Study with intensity
  3. Rest without guilt
  4. Repeat without complaint
  5. Succeed without arrogance
  
  You are a WARRIOR. Act like one.`,
});

const sudoCommand: EasterEggHandler = () => ({
  type: 'error',
  output: `warrior is not in the sudoers file. This incident will be reported.
  
  Just kidding. There's no sudo here.
  You already have all the power you need — inside you. 💪`,
});

const exitCommand: EasterEggHandler = () => ({
  type: 'warning',
  output: 'A warrior never exits. Close this window if you dare. 😤',
});

export const EASTER_EGGS: Record<string, EasterEggHandler> = {
  matrix: matrixCommand,
  cowsay: cowsayCommand,
  hack: hackCommand,
  motivate: motivateCommand,
  warrior: warriorCommand,
  sudo: sudoCommand,
  exit: exitCommand,
};
