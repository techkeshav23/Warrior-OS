// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Easter Eggs (Terminal)
// Fun hidden commands for the terminal
// ═══════════════════════════════════════════════════════════

import type { CommandResult } from './commands';

export interface EasterEggResult extends CommandResult {
  /** Stable id, so discovery XP is paid once per egg. */
  eggId: string;
  /** Secret eggs are not listed in `help`; finding one unlocks the "???" achievement. */
  secret?: boolean;
}

type EasterEggHandler = (args: string[]) => EasterEggResult;

const matrixCommand: EasterEggHandler = () => ({
  eggId: 'matrix',
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
    eggId: 'cowsay',
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

const hackNasaOutput = `> nmap -sS mission-control.nasa (simulated)
  PORT     STATE    SERVICE
  22/tcp   filtered ssh
  443/tcp  open     https
> bruteforce --target=orbital-uplink --wordlist=excuses-i-have-used.txt
  [████████████████████████████] 100%
> decrypting telemetry ......... OK
> rerouting satellite dish ..... OK
> downloading rocket-science.pdf ...

  ACCESS GRANTED — Houston, we have a warrior.

  Plot twist: the only file on the server was your own to-do list.
  (Nothing was hacked. It's an easter egg. Go ship something, astronaut. 🚀)`;

const hackCommand: EasterEggHandler = (args) => {
  if (args[0]?.toLowerCase() === 'nasa') {
    return { eggId: 'hack-nasa', secret: true, type: 'ascii', output: hackNasaOutput };
  }
  return {
    eggId: 'hack',
    type: 'ascii',
    output: `[██████████████████████████] 100%

  ACCESS GRANTED
  ═══════════════════════════════
  Connecting to skill-download server...
  Downloading 10,000 hours of practice...
  Injecting knowledge directly...

  ERROR: Shortcut not found.

  The only hack is HARD WORK. 💪
  Get back to your decks, warrior.`,
  };
};

const motivateCommand: EasterEggHandler = () => {
  const msgs = [
    `
  ╔═══════════════════════════════╗
  ║   YOU ARE STRONGER THAN       ║
  ║   YOUR EXCUSES               ║
  ╚═══════════════════════════════╝

  Every hour you put in is one step closer.
  Every master was once a disaster. Keep going.`,

    `
  🔥 WARRIOR MODE: ACTIVATED 🔥

  While others scroll, you code.
  While others sleep, you solve.
  While others quit, you persist.

  Mastery is not about genius — it's about GRIT.`,

    `
  ┌─────────────────────────────┐
  │  DAILY REMINDER:            │
  │                             │
  │  • You chose this path      │
  │  • You can handle this      │
  │  • Consistency > Intensity  │
  │  • Progress is progress     │
  │  • You WILL level up        │
  └─────────────────────────────┘`,
  ];
  return {
    eggId: 'motivate',
    type: 'success',
    output: msgs[Math.floor(Math.random() * msgs.length)],
  };
};

const warriorCommand: EasterEggHandler = () => ({
  eggId: 'warrior',
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

/** `sudo rm -rf /` — also `-fr`, `-r -f`, `/*`, `--no-preserve-root`. */
function isRootWipe(args: string[]): boolean {
  const words = args.map((a) => a.toLowerCase());
  if (words[0] !== 'rm') return false;
  const shortFlags = words.filter((a) => /^-[a-z]+$/.test(a)).join('');
  return (
    shortFlags.includes('r') &&
    shortFlags.includes('f') &&
    words.some((a) => a === '/' || a === '/*')
  );
}

const sudoCommand: EasterEggHandler = (args) => {
  if (isRootWipe(args)) {
    return {
      eggId: 'sudo-rm-rf',
      secret: true,
      type: 'warning',
      output: `[sudo] password for warrior: ********
removing /boot ............... done
removing /usr ................ done
removing /home/warrior/notes . done
removing /home/warrior/discipline ...
  ████████████████████░░░░ 83%
rm: cannot remove '/home/warrior/discipline': Resource is permanently in use

KERNEL: system restored from backup. Nothing was deleted.
Nice try 😏`,
    };
  }
  return {
    eggId: 'sudo',
    type: 'error',
    output: `warrior is not in the sudoers file. This incident will be reported.

  Just kidding. There's no sudo here.
  You already have all the power you need — inside you. 💪`,
  };
};

const exitCommand: EasterEggHandler = () => ({
  eggId: 'exit',
  type: 'warning',
  output: 'A warrior never exits. Close this window if you dare. 😤',
});

const rickrollCommand: EasterEggHandler = () => ({
  eggId: 'rickroll',
  secret: true,
  type: 'ascii',
  output: `
  ♪ ♫ ♪   INCOMING TRANSMISSION   ♪ ♫ ♪

        \\(^o^)/     \\(^o^)/     \\(^o^)/
          | |         | |         | |
         /   \\       /   \\       /   \\

  You typed it. You know what this is.
  You have been officially rickrolled, warrior. 🕺

  (Now close the dance floor and open Training Grounds.)`,
});

const jarvisCommand: EasterEggHandler = () => ({
  eggId: 'jarvis',
  secret: true,
  type: 'info',
  output: `NEXUS: I prefer NEXUS. But I appreciate the compliment.`,
});

const konamiCommand: EasterEggHandler = () => ({
  eggId: 'konami',
  type: 'info',
  output: `Legends speak of a code older than this OS itself:

      ↑  ↑  ↓  ↓  ←  →  ←  →  B  A

  Typing its name only earns you this hint. Entering it anywhere on the desktop... might do more.`,
});

export const EASTER_EGGS: Record<string, EasterEggHandler> = {
  matrix: matrixCommand,
  cowsay: cowsayCommand,
  hack: hackCommand,
  motivate: motivateCommand,
  warrior: warriorCommand,
  sudo: sudoCommand,
  exit: exitCommand,
  rickroll: rickrollCommand,
  jarvis: jarvisCommand,
  konami: konamiCommand,
};
