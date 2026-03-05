// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Tabs Component
// Animated tab switcher with glowing indicator
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useId, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  className?: string;
  variant?: 'underline' | 'pills';
}

export function Tabs({
  tabs,
  defaultTab,
  onChange,
  className,
  variant = 'underline',
}: TabsProps) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id);
  const instanceId = useId();

  const handleChange = (id: string) => {
    setActive(id);
    onChange?.(id);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1',
        variant === 'underline' && 'border-b border-white/5',
        variant === 'pills' && 'bg-bg-surface/50 rounded-[var(--radius-md)] p-1',
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleChange(tab.id)}
          className={cn(
            'relative flex items-center gap-1.5 px-3 py-2 text-xs font-mono transition-colors',
            variant === 'underline' && [
              'pb-2.5',
              active === tab.id ? 'text-accent-primary' : 'text-text-muted hover:text-text-secondary',
            ],
            variant === 'pills' && [
              'rounded-[var(--radius-sm)]',
              active === tab.id ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary',
            ]
          )}
        >
          {tab.icon}
          {tab.label}

          {/* Active indicator */}
          {active === tab.id && variant === 'underline' && (
            <motion.div
              layoutId={`${instanceId}-tab-indicator`}
              className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-primary"
              style={{
                boxShadow: '0 0 8px var(--accent-primary)',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          {active === tab.id && variant === 'pills' && (
            <motion.div
              layoutId={`${instanceId}-tab-pill`}
              className="absolute inset-0 bg-white/5 rounded-[var(--radius-sm)]"
              style={{ zIndex: -1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
