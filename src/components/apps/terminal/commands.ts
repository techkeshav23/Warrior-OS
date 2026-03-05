// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Terminal Commands
// All available terminal commands mapped to handlers
// ═══════════════════════════════════════════════════════════

export interface CommandResult {
  output: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'ascii';
}

type CommandHandler = (args: string[]) => CommandResult;

const helpCommand: CommandHandler = () => ({
  type: 'info',
  output: `Available commands:
  help          — Show this help message
  whoami        — Display current user
  neofetch      — System info
  clear         — Clear terminal
  echo <text>   — Print text
  date          — Current date/time
  uptime        — System uptime
  ls            — List installed apps
  xp            — Show XP and level
  quote         — Random warrior quote
  subjects      — List GATE subjects
  version       — OS version
  about         — About Warrior OS
  history       — Command history
  matrix        — Matrix rain (easter egg)
  cowsay <text> — ASCII cow says your text
  hack          — Fake hacking sequence
  motivate      — Get motivated!
  warrior       — Warrior ASCII art`,
});

const whoamiCommand: CommandHandler = () => ({
  type: 'info',
  output: 'warrior@warrior-os',
});

const neofetchCommand: CommandHandler = () => ({
  type: 'ascii',
  output: `
 ██╗    ██╗ █████╗ ██████╗ ██████╗ ██╗  ██████╗ ██████╗
 ██║    ██║██╔══██╗██╔══██╗██╔══██╗██║ ██╔═══██╗██╔══██╗
 ██║ █╗ ██║███████║██████╔╝██████╔╝██║ ██║   ██║██████╔╝
 ██║███╗██║██╔══██║██╔══██╗██╔══██╗██║ ██║   ██║██╔══██╗
 ╚███╔███╔╝██║  ██║██║  ██║██║  ██║██║ ╚██████╔╝██║  ██║
  ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═════╝ ╚═╝  ╚═╝
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  OS:       Warrior OS v4.0
  Kernel:   The Living World
  Shell:    warrior-bash 1.0
  UI:       React 19 + Framer Motion
  State:    Zustand + Immer
  Style:    Tailwind CSS 4
  Backend:  Firebase
  Host:     Browser
  Builder:  Keshav Upadhyay`,
});

const dateCommand: CommandHandler = () => ({
  type: 'info',
  output: new Date().toLocaleString(),
});

const uptimeCommand: CommandHandler = () => {
  const start = performance.timeOrigin;
  const elapsed = Math.floor((Date.now() - start) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return {
    type: 'info',
    output: `up ${h}h ${m}m ${s}s`,
  };
};

const lsCommand: CommandHandler = () => ({
  type: 'info',
  output: `gate-arena/  notes/  habit-forge/  stats-center/  settings/
music-player/  terminal/  calculator/  file-manager/  weather/
project-tracker/  warrior-profile/  nexus-ai/  study-planner/`,
});

const echoCommand: CommandHandler = (args) => ({
  type: 'info',
  output: args.join(' ') || '',
});

const subjectsCommand: CommandHandler = () => ({
  type: 'info',
  output: `GATE CS Subjects:
  1. Operating Systems
  2. Database Management Systems
  3. Computer Networks
  4. Theory of Computation
  5. Computer Organization & Architecture
  6. Design & Analysis of Algorithms
  7. Compiler Design
  8. Digital Logic
  9. Discrete Mathematics
  10. Engineering Mathematics
  11. C Programming
  12. Data Structures`,
});

const versionCommand: CommandHandler = () => ({
  type: 'success',
  output: 'Warrior OS v4.0.0 — The Living World',
});

const aboutCommand: CommandHandler = () => ({
  type: 'info',
  output: `Warrior OS v4.0 — The Living World
An immersive OS-in-browser for GATE exam prep.
Built by Keshav Upadhyay with Next.js 16, React 19, and passion.
"Every warrior was once a beginner who refused to give up."`,
});

const QUOTES = [
  'The only way to do great work is to love what you do.',
  'Hard work beats talent when talent doesn\'t work hard.',
  'Success is not final, failure is not fatal: courage to continue counts.',
  'The pain you feel today will be the strength you feel tomorrow.',
  'Don\'t watch the clock; do what it does. Keep going.',
  'Discipline is choosing between what you want now and what you want most.',
  'A warrior is not about perfection. It is about effort.',
  'GATE is just an exam; your will to succeed is what matters.',
  'Every expert was once a beginner. Start now.',
  'The best time to plant a tree was 20 years ago. The second best time is now.',
];

const quoteCommand: CommandHandler = () => ({
  type: 'success',
  output: `"${QUOTES[Math.floor(Math.random() * QUOTES.length)]}"`,
});

export const COMMANDS: Record<string, CommandHandler> = {
  help: helpCommand,
  whoami: whoamiCommand,
  neofetch: neofetchCommand,
  date: dateCommand,
  uptime: uptimeCommand,
  ls: lsCommand,
  echo: echoCommand,
  subjects: subjectsCommand,
  version: versionCommand,
  about: aboutCommand,
  quote: quoteCommand,
};
