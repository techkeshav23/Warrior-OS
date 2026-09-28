// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Chat UI
// Glass message bubbles, typing indicator, history persisted via store.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Trash2 } from 'lucide-react';
import { useNexusStore } from '@/stores/useNexusStore';
import { useNexusCore } from './NexusCore';
import { cn } from '@/lib/utils';

function NexusChatInner() {
  const messages = useNexusStore((s) => s.messages);
  const addMessage = useNexusStore((s) => s.addMessage);
  const clearHistory = useNexusStore((s) => s.clearHistory);
  const isProcessing = useNexusStore((s) => s.isProcessing);
  const setProcessing = useNexusStore((s) => s.setProcessing);

  const { ask } = useNexusCore();

  const [input, setInput] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom whenever a message arrives.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, isProcessing]);

  // Focus input on mount.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isProcessing) return;

    setInput('');
    addMessage('user', text);

    // Send recent history (last 8) so NEXUS has short-term memory.
    const recent = useNexusStore.getState().messages.slice(-9, -1); // exclude the user msg we just added
    const history = recent
      .filter((m) => m.role === 'user' || m.role === 'nexus')
      .map((m) => ({ role: m.role as 'user' | 'nexus', content: m.content }));

    setProcessing(true);
    try {
      const { reply } = await ask(text, history);
      addMessage('nexus', reply);
    } finally {
      setProcessing(false);
    }
  }, [input, isProcessing, ask, addMessage, setProcessing]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter sends, Shift+Enter inserts newline.
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    },
    [send]
  );

  const onClear = useCallback(() => {
    if (messages.length === 0) return;
    clearHistory();
  }, [clearHistory, messages.length]);

  return (
    <div className="flex flex-col h-full bg-black/30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-cyan-400" />
          <span className="text-xs font-semibold text-white/80 tracking-wide">NEXUS</span>
          <span className="text-[10px] text-white/30 font-mono">
            {isProcessing ? 'thinking…' : 'online'}
          </span>
        </div>
        <button
          onClick={onClear}
          disabled={messages.length === 0}
          className={cn(
            'p-1 rounded text-white/40 hover:text-white/70 hover:bg-white/5 transition',
            messages.length === 0 && 'opacity-30 cursor-not-allowed'
          )}
          aria-label="Clear chat"
          title="Clear chat"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Scrollable message area */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !isProcessing && <EmptyState />}

        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'flex',
                m.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words',
                  m.role === 'user'
                    ? 'bg-cyan-500/15 text-cyan-100 border border-cyan-500/30 rounded-tr-sm'
                    : m.role === 'nexus'
                    ? 'bg-white/5 text-white/90 border border-white/10 rounded-tl-sm'
                    : 'bg-yellow-500/10 text-yellow-200 border border-yellow-500/20 text-xs italic'
                )}
              >
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isProcessing && <TypingIndicator />}
      </div>

      {/* Input */}
      <div className="border-t border-white/5 p-3">
        <div className="flex items-end gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2 focus-within:border-cyan-500/40 transition">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Pucho NEXUS se… (Enter to send, Shift+Enter newline)"
            rows={1}
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/30 resize-none max-h-32"
          />
          <button
            onClick={send}
            disabled={!input.trim() || isProcessing}
            className={cn(
              'p-1.5 rounded-lg transition shrink-0',
              !input.trim() || isProcessing
                ? 'text-white/20 cursor-not-allowed'
                : 'text-cyan-300 hover:bg-cyan-500/15'
            )}
            aria-label="Send"
          >
            <Send size={15} />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-white/30 text-center font-mono">
          Try: &ldquo;study mode&rdquo;, &ldquo;open notes&rdquo;, &ldquo;DBMS quiz&rdquo;, or just ask anything
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-2 px-6">
      <Sparkles size={28} className="text-cyan-400/40" />
      <p className="text-sm text-white/60 font-medium">NEXUS ready.</p>
      <p className="text-xs text-white/30 max-w-xs leading-relaxed">
        Ask anything about GATE, code, or this OS. Commands like &ldquo;study mode&rdquo; or
        &ldquo;open notes&rdquo; run instantly without an AI call.
      </p>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

export const NexusChat = memo(NexusChatInner);
