// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Settings App
// 6 tabs: Appearance, Sounds, Account, Workspaces, Nexus, About
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AppearanceTab } from './AppearanceTab';
import { SoundsTab } from './SoundsTab';
import { AccountTab } from './AccountTab';
import { WorkspacesTab } from './WorkspacesTab';
import { NexusTab } from './NexusTab';
import { AboutTab } from './AboutTab';

type SettingsTab = 'appearance' | 'sounds' | 'account' | 'workspaces' | 'nexus' | 'about';

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'sounds', label: 'Sounds', icon: '🔊' },
  { id: 'account', label: 'Account', icon: '👤' },
  { id: 'workspaces', label: 'Workspaces', icon: '🖥️' },
  { id: 'nexus', label: 'Nexus AI', icon: '🤖' },
  { id: 'about', label: 'About', icon: 'ℹ️' },
];

function SettingsAppInner() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  return (
    <div className="flex h-full bg-black/30">
      {/* Sidebar */}
      <nav className="w-44 flex-shrink-0 border-r border-white/10 bg-black/20 p-2 flex flex-col gap-1">
        <h2 className="text-sm font-bold text-white/80 px-3 py-2">⚙️ Settings</h2>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all text-left',
              activeTab === tab.id
                ? 'bg-white/10 text-white border border-white/10'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            )}
          >
            <span className="text-xs">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeTab === 'appearance' && <AppearanceTab />}
            {activeTab === 'sounds' && <SoundsTab />}
            {activeTab === 'account' && <AccountTab />}
            {activeTab === 'workspaces' && <WorkspacesTab />}
            {activeTab === 'nexus' && <NexusTab />}
            {activeTab === 'about' && <AboutTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export const SettingsApp = memo(SettingsAppInner);
