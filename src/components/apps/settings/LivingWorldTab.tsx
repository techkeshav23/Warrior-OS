// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Living World Tab
// Reality Decay (6.45), the living-OS presences (ghost warriors,
// phantom windows, NEXUS dreams, typing biometrics), the creature,
// big-moment effects and desktop widgets.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState } from 'react';
import { Badge, Input } from '@/components/ui';
import { useLiteMode } from '@/lib/lite-mode';
import { useEffectsStore } from '@/components/effects';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getStageInfo, useCreatureStore } from '@/stores/useCreatureStore';
import { DecaySection } from './DecaySection';
import { WidgetsSection } from './WidgetsSection';
import { SettingRow, SettingsCard, SettingsPage, SettingsSection, SwitchRow } from './parts';

function LivingWorldTabInner() {
  const ghostWarriors = useSettingsStore((s) => s.ghostWarriors);
  const phantomWindows = useSettingsStore((s) => s.phantomWindows);
  const dreams = useSettingsStore((s) => s.dreams);
  const biometricsEnabled = useSettingsStore((s) => s.biometricsEnabled);
  const achievementCinematic = useEffectsStore((s) => s.achievementCinematic);
  const levelUpEffect = useEffectsStore((s) => s.levelUpEffect);
  const disintegrateOnClose = useEffectsStore((s) => s.disintegrateOnClose);
  const lite = useLiteMode();
  const settings = useSettingsStore.getState;
  const effects = useEffectsStore.getState;

  const hiddenInLite = lite ? <Badge size="sm">Hidden in lite mode</Badge> : undefined;
  const quietInLite = lite ? <Badge size="sm">Quiet in lite mode</Badge> : undefined;

  return (
    <SettingsPage>
      <DecaySection />

      <SettingsSection title="Living OS" description="The things that make the desktop feel inhabited.">
        <SettingsCard>
          <SwitchRow
            label="Ghost warriors"
            ariaLabel="Ghost Warriors"
            description="Other warriors walking the desktop, with a shared campfire and leaderboard."
            badge={hiddenInLite}
            checked={ghostWarriors}
            onCheckedChange={() => settings().toggleGhostWarriors()}
          />
          <SwitchRow
            label="Phantom windows"
            ariaLabel="Phantom Windows"
            description="Faint echoes of the apps you just closed."
            badge={hiddenInLite}
            checked={phantomWindows}
            onCheckedChange={() => settings().togglePhantomWindows()}
          />
          <SwitchRow
            label="NEXUS dreams"
            ariaLabel="NEXUS Dreams"
            description="A short cinematic recap of yesterday when you come back."
            checked={dreams}
            onCheckedChange={() => settings().toggleDreams()}
          />
          <SwitchRow
            label="Typing biometrics"
            ariaLabel="Typing Biometrics"
            description="Reads your typing rhythm for the vitals widget. Nothing is measured while it's off."
            checked={biometricsEnabled}
            onCheckedChange={() => settings().toggleBiometrics()}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Warrior creature" description="Your companion grows as you earn XP.">
        <SettingsCard>
          <CreatureNameRow />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Effects" description="The big moments. Reduced motion and lite mode play the quiet version.">
        <SettingsCard>
          <SwitchRow
            label="Achievement cinematic"
            description="A full-screen moment when you unlock an achievement."
            badge={quietInLite}
            checked={achievementCinematic}
            onCheckedChange={() => effects().setAchievementCinematic(!achievementCinematic)}
          />
          <SwitchRow
            label="Level-up effect"
            description="A burst of light when you reach a new level."
            badge={quietInLite}
            checked={levelUpEffect}
            onCheckedChange={() => effects().setLevelUpEffect(!levelUpEffect)}
          />
          <SwitchRow
            label="Disintegrate windows on close"
            description="Closed windows crumble into particles."
            checked={disintegrateOnClose}
            onCheckedChange={() => effects().setDisintegrateOnClose(!disintegrateOnClose)}
          />
        </SettingsCard>
      </SettingsSection>

      <WidgetsSection />
    </SettingsPage>
  );
}

function CreatureNameRow() {
  const name = useCreatureStore((s) => s.name);
  const level = useCreatureStore((s) => s.level);
  const stage = useCreatureStore((s) => s.stage);
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? name;

  const commit = () => {
    if (draft !== null) useCreatureStore.getState().setName(draft);
    setDraft(null);
  };

  return (
    <SettingRow
      label="Name"
      htmlFor="settings-creature-name"
      description={
        <span className="tabular">
          {getStageInfo(stage).label} · Level {level}
        </span>
      }
      control={
        <Input
          id="settings-creature-name"
          wrapperClassName="w-48"
          value={value}
          maxLength={20}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setDraft(null);
          }}
          aria-label="Creature name"
        />
      }
    />
  );
}

export const LivingWorldTab = memo(LivingWorldTabInner);
