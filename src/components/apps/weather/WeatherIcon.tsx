// ═══════════════════════════════════════════════════════════
// WARRIOR OS — WeatherIcon
// Maps an OpenWeatherMap icon code ("01d", "10n", ...) to a Lucide
// glyph with a matching tint. Shared by the Weather app and the
// lock screen, so no external image assets are needed.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const WEATHER_ICONS: Record<string, LucideIcon> = {
  '01d': Sun,
  '01n': Moon,
  '02d': CloudSun,
  '02n': CloudMoon,
  '03d': Cloud,
  '03n': Cloud,
  '04d': Cloud,
  '04n': Cloud,
  '09d': CloudDrizzle,
  '09n': CloudDrizzle,
  '10d': CloudRain,
  '10n': CloudRain,
  '11d': CloudLightning,
  '11n': CloudLightning,
  '13d': CloudSnow,
  '13n': CloudSnow,
  '50d': CloudFog,
  '50n': CloudFog,
};

/** Token text colour per condition family (first two chars of the code). */
const WEATHER_TINTS: Record<string, string> = {
  '01': 'text-warning',
  '02': 'text-warning',
  '03': 'text-fg-muted',
  '04': 'text-fg-muted',
  '09': 'text-info',
  '10': 'text-info',
  '11': 'text-warning',
  '13': 'text-plasma-300',
  '50': 'text-fg-subtle',
};

/** Night codes ("01n", "02n") get the moon's cool tint instead of the sun's. */
const NIGHT_TINTS: Record<string, string> = {
  '01': 'text-info',
  '02': 'text-info',
};

interface WeatherIconProps {
  /** OpenWeatherMap icon code, e.g. "04d" */
  code: string;
  className?: string;
  /** Apply the per-condition tint (default true) */
  tinted?: boolean;
  strokeWidth?: number;
}

function WeatherIconInner({ code, className, tinted = true, strokeWidth = 1.75 }: WeatherIconProps) {
  const Icon = WEATHER_ICONS[code] ?? Cloud;
  const family = code.slice(0, 2);
  const tint = (code.endsWith('n') ? NIGHT_TINTS[family] : undefined) ?? WEATHER_TINTS[family] ?? 'text-fg-muted';
  return (
    <Icon
      aria-hidden="true"
      strokeWidth={strokeWidth}
      className={cn(tinted && tint, className)}
    />
  );
}

export const WeatherIcon = memo(WeatherIconInner);
