// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Sounds Tab
// Sound effects and music: on/off, volume, and the procedural music's
// auto-mood (spec 6.53).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { Slider } from '@/components/ui';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useMusicGenStore } from '@/stores/useMusicGenStore';
import { RowValue, SettingRow, SettingsCard, SettingsPage, SettingsSection, SwitchRow } from './parts';

function VolumeRow({
  id,
  value,
  enabled,
  onChange,
}: {
  id: string;
  value: number;
  enabled: boolean;
  onChange: (value: number) => void;
}) {
  const pct = Math.round(value * 100);
  return (
    <SettingRow
      label="Volume"
      htmlFor={id}
      disabled={!enabled}
      description={enabled ? undefined : 'Turn it on to adjust the volume.'}
      control={<RowValue muted={!enabled}>{pct}%</RowValue>}
    >
      <Slider
        id={id}
        min={0}
        max={1}
        step={0.05}
        value={value}
        disabled={!enabled}
        onValueChange={onChange}
        aria-valuetext={`${pct}%`}
      />
    </SettingRow>
  );
}

function SoundsTabInner() {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const soundVolume = useSettingsStore((s) => s.soundVolume);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const musicVolume = useSettingsStore((s) => s.musicVolume);
  const autoMood = useMusicGenStore((s) => s.autoMood);
  const settings = useSettingsStore.getState;

  return (
    <SettingsPage>
      <SettingsSection
        title="Sound effects"
        description="Window open and close, notifications and other OS interactions."
      >
        <SettingsCard>
          <SwitchRow
            label="Sound effects"
            description="Play interface sounds."
            checked={soundEnabled}
            onCheckedChange={() => settings().toggleSound()}
          />
          <VolumeRow
            id="settings-sound-volume"
            value={soundVolume}
            enabled={soundEnabled}
            onChange={(v) => settings().setSoundVolume(v)}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Music" description="Background music plays while you use the OS.">
        <SettingsCard>
          <SwitchRow
            label="Background music"
            description="Play music in the background."
            checked={musicEnabled}
            onCheckedChange={() => settings().toggleMusic()}
          />
          <VolumeRow
            id="settings-music-volume"
            value={musicVolume}
            enabled={musicEnabled}
            onChange={(v) => settings().setMusicVolume(v)}
          />
          <SwitchRow
            label="Auto-mood music"
            description="Pick the mood from the time of day; your typing rhythm can override it."
            checked={autoMood}
            onCheckedChange={() => useMusicGenStore.getState().setAutoMood(!autoMood)}
          />
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}

export const SoundsTab = memo(SoundsTabInner);
