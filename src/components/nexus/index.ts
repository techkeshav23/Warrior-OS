// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS (barrel)
// Drop <NexusLayer /> once inside the desktop phase of page.tsx
// (after <WarriorCreature />, before <CursorManager />). It hosts
// proactive suggestions, the 'warrior:nexus-say' listener, the
// pomodoro driver and the voice/pomodoro HUD.
// ═══════════════════════════════════════════════════════════

export { NexusLayer } from './NexusLayer';
export { NexusChat, NexusOrb, NexusTypingIndicator } from './NexusChat';
export { NexusMarkdown } from './NexusMarkdown';
export {
  executeNexusCommand,
  openNexusWindow,
  processNexusInput,
  runNexusButton,
  sendToNexus,
  useNexusCore,
} from './NexusCore';
export {
  NexusVoiceButton,
  NexusVoiceIndicator,
  NexusVoiceReplyToggle,
  NexusWakeToggle,
  startPushToTalk,
  toggleWakeMode,
} from './NexusVoice';
export { NexusSuggestions, deliverNexusMessage } from './NexusSuggestions';
export { NexusPomodoroPill } from './NexusPomodoro';
export { nexusSay } from '@/lib/nexus/events';
