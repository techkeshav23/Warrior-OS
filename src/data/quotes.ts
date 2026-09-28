// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior Quotes
// Motivational quotes shown on lock screen, loading, etc.
// ═══════════════════════════════════════════════════════════

export const WARRIOR_QUOTES = [
  "The only way to do great work is to love what you do.",
  "Discipline is choosing between what you want now and what you want most.",
  "The pain you feel today will be the strength you feel tomorrow.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "The warrior who trains the hardest wins the easiest.",
  "Don't wish it were easier. Wish you were better.",
  "A river cuts through rock not because of its power, but its persistence.",
  "The best time to plant a tree was 20 years ago. The second best time is now.",
  "Every expert was once a beginner.",
  "Code is like humor. When you have to explain it, it's bad.",
  "First, solve the problem. Then, write the code.",
  "The only impossible journey is the one you never begin.",
  "Hard work beats talent when talent doesn't work hard.",
  "The difference between ordinary and extraordinary is that little extra.",
  "Fall seven times, stand up eight.",
  "Champions keep playing until they get it right.",
  "The harder you work, the luckier you get.",
  "Your limitation — it's only your imagination.",
  "Push yourself, because no one else is going to do it for you.",
  "Great things never come from comfort zones.",
  "Dream it. Wish it. Do it.",
  "Success doesn't just find you. You have to go out and get it.",
  "The key to success is to focus on goals, not obstacles.",
  "In the middle of every difficulty lies opportunity.",
  "Don't stop when you're tired. Stop when you're done.",
  "Wake up with determination. Go to bed with satisfaction.",
  "Do something today that your future self will thank you for.",
  "It's not about being the best. It's about being better than you were yesterday.",
  "Little things make big days.",
  "It's going to be hard, but hard does not mean impossible.",
  "Don't wait for opportunity. Create it.",
  "Warriors are not born. They are forged.",
  "The code compiles. The warrior rises.",
  "One line of code at a time. One step closer to greatness.",
  "Every skill you master is a new module installed.",
  "Today's struggle is tomorrow's strength.",
  "Bugs are just puzzles waiting to be solved.",
  "The algorithm of success: try, fail, learn, repeat.",
  "Stack overflow → Stack overflow → understanding.",
  "You didn't come this far to only come this far.",
  "Debug your life. Optimize your path.",
  "Compile your dreams into reality.",
  "The only bad code is the code you never wrote.",
  "Sleep is a weapon. Use it wisely.",
  "The terminal is your battlefield. Commands are your arsenal.",
  "async/await for success — it takes time, but it resolves.",
  "Every bug fixed makes you stronger.",
  "Your knowledge graph is expanding. Never stop learning.",
  "Ctrl+Z doesn't work in life. Make every keystroke count.",
  "The warrior codes at dawn. And dusk. And midnight.",
] as const;

/**
 * Get a random quote
 */
export function getRandomQuote(): string {
  return WARRIOR_QUOTES[Math.floor(Math.random() * WARRIOR_QUOTES.length)];
}

/**
 * Get quote of the day (deterministic based on date)
 */
export function getQuoteOfDay(): string {
  const today = new Date();
  const dayIndex = (today.getFullYear() * 365 + today.getMonth() * 31 + today.getDate()) % WARRIOR_QUOTES.length;
  return WARRIOR_QUOTES[dayIndex];
}
