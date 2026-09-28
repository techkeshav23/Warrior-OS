// ═══════════════════════════════════════════════════════════
// WARRIOR OS — AI Assist App
// Thin wrapper that mounts NexusChat as a window app.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { NexusChat } from '@/components/nexus/NexusChat';

function AIAssistAppInner() {
  return <NexusChat />;
}

export const AIAssistApp = memo(AIAssistAppInner);
