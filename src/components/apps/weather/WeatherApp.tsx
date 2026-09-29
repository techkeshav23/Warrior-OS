// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Weather App
// Live OpenWeatherMap weather through the /api/weather proxy.
// The API key stays on the server; this component only talks to
// our own route via lib/weather. Opens on the saved city, else your
// location (asks once), else the default city.
// Layout: location bar · conditions hero (big temperature, today's
// range) · next-hours chart · details · source/refresh footer, with a
// shaped loading skeleton and designed error states.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useId, useRef, memo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  CloudOff,
  Droplets,
  Hourglass,
  KeyRound,
  LocateFixed,
  MapPin,
  MapPinOff,
  RefreshCw,
  RotateCw,
  Thermometer,
  TriangleAlert,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { Badge, Button, EmptyState, IconButton, ProgressBar, SearchField, Skeleton, type Tone } from '@/components/ui';
import { cn } from '@/lib/utils';
import { TRANSITION } from '@/styles/tokens';
import {
  DEFAULT_CITY,
  MAX_CITY_LENGTH,
  WEATHER_KEY_ENV_NAME,
  fetchWeatherByCity,
  getLocalWeather,
  getSavedCity,
  normalizeCity,
  saveCity,
  toWeatherErrorCode,
  weatherErrorMessage,
  type LocalWeather,
  type WeatherData,
  type WeatherErrorCode,
  type WeatherForecastSlot,
  type WeatherSource,
} from '@/lib/weather';
import { WeatherIcon } from './WeatherIcon';

const SOURCE_LABEL: Record<WeatherSource, string> = {
  'saved-city': 'Saved city',
  geolocation: 'Your location',
  'default-city': `Default city (${DEFAULT_CITY.split(',')[0]})`,
  'last-known': 'Offline · last known',
};

const SOURCE_TONE: Record<WeatherSource, Tone> = {
  'saved-city': 'accent',
  geolocation: 'success',
  'default-city': 'neutral',
  'last-known': 'warning',
};

const SOURCE_BADGE: Record<WeatherSource, string> = {
  'saved-city': 'Saved',
  geolocation: 'Here',
  'default-city': 'Default',
  'last-known': 'Offline',
};

function formatClock(epochMs: number): string {
  if (!epochMs) return '';
  return new Date(epochMs).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Condition-driven presentation ───────────────────────

/** Token colour for a condition family (sun, moon, rain, storm, snow, cloud/fog). */
function conditionColor(icon: string): string {
  const family = icon.slice(0, 2);
  if (family === '01' || family === '02') return icon.endsWith('n') ? 'var(--color-info)' : 'var(--color-warning)';
  if (family === '09' || family === '10') return 'var(--color-info)';
  if (family === '11') return 'var(--color-warning)';
  if (family === '13') return 'var(--color-plasma-300)';
  return 'var(--color-fg-subtle)';
}

/** Soft colour wash for the hero card. */
function conditionWash(icon: string): string {
  return `radial-gradient(120% 90% at 88% 0%, color-mix(in oklab, ${conditionColor(icon)} 16%, transparent) 0%, transparent 62%)`;
}

/** Halo behind the big condition icon. */
function conditionHalo(icon: string): string {
  return `radial-gradient(closest-side, color-mix(in oklab, ${conditionColor(icon)} 30%, transparent), transparent)`;
}

function feelsCaption(data: WeatherData): string {
  const diff = data.feelsLike - data.temp;
  if (diff >= 2) return 'Feels warmer';
  if (diff <= -2) return 'Feels cooler';
  return 'Close to actual';
}

function humidityCaption(h: number): string {
  if (h < 30) return 'Dry';
  if (h <= 60) return 'Comfortable';
  if (h <= 80) return 'Humid';
  return 'Very humid';
}

function windCaption(kph: number): string {
  if (kph < 2) return 'Calm';
  if (kph < 12) return 'Light air';
  if (kph < 29) return 'Breezy';
  if (kph < 50) return 'Strong';
  return 'Gale';
}

interface ErrorCopy {
  icon: LucideIcon;
  title: string;
  tone: 'danger' | 'ember' | 'neutral' | 'accent';
}

const ERROR_COPY: Record<WeatherErrorCode, ErrorCopy> = {
  'no-key': { icon: KeyRound, title: 'Weather needs a key', tone: 'neutral' },
  'key-rejected': { icon: KeyRound, title: 'Key not accepted', tone: 'neutral' },
  'not-found': { icon: MapPinOff, title: 'City not found', tone: 'neutral' },
  'invalid-location': { icon: MapPinOff, title: 'Check the location', tone: 'neutral' },
  'rate-limited': { icon: Hourglass, title: 'Slow down a moment', tone: 'neutral' },
  upstream: { icon: CloudOff, title: 'Forecast unavailable', tone: 'danger' },
  network: { icon: CloudOff, title: 'You’re offline', tone: 'danger' },
};

// ─── Pieces ──────────────────────────────────────────────

/** Today's low → high bar with a marker at the current temperature. */
function RangeBar({ min, max, temp }: { min: number; max: number; temp: number }) {
  const span = max - min;
  const at = span > 0 ? Math.min(1, Math.max(0, (temp - min) / span)) : 0.5;
  return (
    <div className="flex items-center gap-2.5">
      <span className="tabular flex items-center gap-0.5 font-mono text-xs text-fg-muted">
        <ArrowDown size={12} strokeWidth={2} className="text-info" aria-hidden />
        {min}°
      </span>
      <div className="relative h-1.5 flex-1 rounded-full bg-ink-700" aria-hidden>
        <div className="absolute inset-0 rounded-full bg-linear-to-r from-info/70 via-accent/60 to-warning/80" />
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink-900 bg-fg shadow-e1"
          style={{ left: `${at * 100}%` }}
        />
      </div>
      <span className="tabular flex items-center gap-0.5 font-mono text-xs text-fg-muted">
        <ArrowUp size={12} strokeWidth={2} className="text-warning" aria-hidden />
        {max}°
      </span>
    </div>
  );
}

/** Next-hours strip: temperatures on a line above icon + time columns. */
function HourlyChart({ slots }: { slots: WeatherForecastSlot[] }) {
  const gid = useId().replace(/:/g, '');
  const n = slots.length;
  const temps = slots.map((s) => s.temp);
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const H = 56; // chart row height in px
  const top = 22; // room for the labels
  const bottom = 8;
  const y = (t: number) => (hi === lo ? (top + H - bottom) / 2 : top + ((hi - t) / (hi - lo)) * (H - top - bottom));
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const line = slots.map((s, i) => `${x(i)},${y(s.temp)}`).join(' ');
  const area = `M ${x(0)},${H} L ${slots.map((s, i) => `${x(i)},${y(s.temp)}`).join(' L ')} L ${x(n - 1)},${H} Z`;

  return (
    <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
      <div style={{ minWidth: n * 52 }}>
        <div className="relative" style={{ height: H }}>
          <svg
            className="absolute inset-0 h-full w-full overflow-visible"
            viewBox={`0 0 100 ${H}`}
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-viz-1)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--color-viz-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gid})`} />
            <polyline
              points={line}
              fill="none"
              stroke="var(--color-viz-1)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {slots.map((s, i) => (
            <div key={`${s.time}-${i}`} className="absolute -translate-x-1/2" style={{ left: `${x(i)}%`, top: y(s.temp) }}>
              <span className="tabular absolute bottom-3.5 left-1/2 -translate-x-1/2 font-mono text-xs font-medium text-fg">
                {s.temp}°
              </span>
              <span className="block size-2 -translate-y-1/2 rounded-full border-2 border-ink-900 bg-viz-1" />
            </div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {slots.map((s, i) => (
            <div key={`${s.time}-${i}`} className="flex flex-col items-center gap-1.5 pt-2" title={s.condition}>
              <WeatherIcon code={s.icon} className="size-5" />
              <span className="tabular font-mono text-2xs text-fg-subtle">{s.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailTile({
  icon: Icon,
  label,
  value,
  unit,
  caption,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  unit?: string;
  caption: string;
  children?: ReactNode;
}) {
  return (
    <div className="glass-panel flex min-w-0 flex-col gap-2 rounded-card p-3">
      <span className="hud-label flex min-w-0 items-center gap-1.5">
        <Icon size={12} strokeWidth={2} className="shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <span className="flex items-baseline gap-1">
        <span className="tabular font-display text-xl font-semibold leading-none text-fg">{value}</span>
        {unit && <span className="text-xs text-fg-subtle">{unit}</span>}
      </span>
      {children}
      <span className="truncate text-xs text-fg-subtle" title={caption}>
        {caption}
      </span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading weather">
      <div className="glass-panel flex flex-col gap-4 rounded-card p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-14 w-32 rounded-card" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton shape="circle" className="size-16" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <div className="glass-panel flex flex-col gap-3 rounded-card p-4">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-20 w-full rounded-control" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 @[330px]:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} shape="block" className={i === 2 ? 'col-span-2 h-24 @[330px]:col-span-1' : 'h-24'} />
        ))}
      </div>
      <span className="sr-only">Loading weather</span>
    </div>
  );
}

function KeySetupSteps() {
  return (
    <ol className="mx-auto mt-1 flex w-full max-w-xs flex-col gap-2 text-left text-xs text-fg-muted">
      {[
        <>Create a free key at openweathermap.org</>,
        <>
          Add <code className="rounded-[4px] bg-ink-850 px-1 font-mono text-fg">{WEATHER_KEY_ENV_NAME}=…</code> to{' '}
          <code className="rounded-[4px] bg-ink-850 px-1 font-mono text-fg">.env.local</code> (server-only, no NEXT_PUBLIC_ prefix)
        </>,
        <>Restart the dev server</>,
      ].map((step, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="tabular flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-2xs text-fg-subtle">
            {i + 1}
          </span>
          <span className="min-w-0 pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

// ─── App ─────────────────────────────────────────────────

function WeatherAppInner() {
  const [query, setQuery] = useState(() => getSavedCity() ?? '');
  const [result, setResult] = useState<LocalWeather | null>(null);
  const [error, setError] = useState<WeatherErrorCode | null>(null);
  const [busy, setBusy] = useState(true); // the mount effect starts a fetch
  const [locationFallback, setLocationFallback] = useState(false);

  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  /** Run one weather load; newer loads win, older results are dropped. */
  const run = useCallback(
    (load: (signal: AbortSignal) => Promise<LocalWeather>, wantedLocation = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const id = ++requestIdRef.current;

      setBusy(true);
      setError(null);

      load(controller.signal)
        .then((next) => {
          if (requestIdRef.current !== id) return;
          setResult(next);
          setLocationFallback(wantedLocation && next.source === 'default-city');
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || requestIdRef.current !== id) return;
          setError(toWeatherErrorCode(err));
        })
        .finally(() => {
          if (requestIdRef.current === id) setBusy(false);
        });
    },
    []
  );

  // First load: saved city → location (may prompt once) → default city.
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    const id = ++requestIdRef.current;

    getLocalWeather({ allowPrompt: true, forecast: true, signal: controller.signal })
      .then((next) => {
        if (requestIdRef.current === id) setResult(next);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted && requestIdRef.current === id) {
          setError(toWeatherErrorCode(err));
        }
      })
      .finally(() => {
        if (requestIdRef.current === id) setBusy(false);
      });

    return () => controller.abort();
  }, []);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const city = normalizeCity(query);
      if (!city) return;
      run(async (signal) => {
        const data = await fetchWeatherByCity(city, { forecast: true, signal });
        saveCity(city); // only remember cities that actually resolved
        return { data, source: 'saved-city' };
      });
    },
    [query, run]
  );

  const onUseLocation = useCallback(() => {
    saveCity(null);
    setQuery('');
    run((signal) => getLocalWeather({ allowPrompt: true, forecast: true, signal }), true);
  }, [run]);

  const onRefresh = useCallback(() => {
    run((signal) => getLocalWeather({ allowPrompt: false, forecast: true, fresh: true, signal }));
  }, [run]);

  const current = result?.data ?? null;
  const keyProblem = error === 'no-key' || error === 'key-rejected';
  const locationProblem = error === 'not-found' || error === 'invalid-location';

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-950/20 text-fg">
      {/* ─── Location bar ─── */}
      <form onSubmit={onSubmit} className="flex h-12 shrink-0 items-center gap-1.5 border-b border-line px-3" role="search">
        <SearchField
          value={query}
          onValueChange={setQuery}
          maxLength={MAX_CITY_LENGTH}
          placeholder="Search city… (e.g. Pune)"
          aria-label="City"
          wrapperClassName="flex-1"
        />
        <Button type="submit" disabled={busy || !normalizeCity(query)}>
          Go
        </Button>
        <IconButton
          icon={LocateFixed}
          aria-label="Use my location"
          variant="secondary"
          tooltip
          tooltipSide="bottom"
          disabled={busy}
          onClick={onUseLocation}
        />
      </form>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="@container flex min-h-full flex-col gap-4 p-4">
          {/* ─── Error with weather still on screen: inline banner ─── */}
          {error && current && (
            <div
              role="alert"
              className={cn(
                'flex items-start gap-2.5 rounded-card border px-3 py-2.5 text-xs animate-fade-in',
                keyProblem || locationProblem ? 'border-warning/25 bg-warning/8' : 'border-danger/25 bg-danger/8'
              )}
            >
              <TriangleAlert
                size={16}
                strokeWidth={1.75}
                className={cn('mt-px shrink-0', keyProblem || locationProblem ? 'text-warning' : 'text-danger')}
                aria-hidden
              />
              <p className="min-w-0 flex-1 text-fg-muted">{weatherErrorMessage(error)}</p>
              <Button size="sm" variant="ghost" leadingIcon={RotateCw} onClick={onRefresh} disabled={busy} className="-my-1 -mr-1">
                Retry
              </Button>
            </div>
          )}

          {/* ─── Error with nothing to show: designed state ─── */}
          {error && !current && (
            <div role="alert" className="flex flex-1 flex-col justify-center animate-fade-in">
              <EmptyState
                icon={ERROR_COPY[error].icon}
                tone={ERROR_COPY[error].tone}
                title={ERROR_COPY[error].title}
                description={weatherErrorMessage(error)}
                actions={
                  <>
                    {locationProblem && (
                      <Button leadingIcon={LocateFixed} onClick={onUseLocation} disabled={busy}>
                        Use my location
                      </Button>
                    )}
                    <Button variant="primary" leadingIcon={RotateCw} onClick={onRefresh} loading={busy}>
                      Try again
                    </Button>
                  </>
                }
              />
              {error === 'no-key' && <KeySetupSteps />}
            </div>
          )}

          {/* ─── Loading skeleton (first load only) ─── */}
          {busy && !current && !error && <LoadingSkeleton />}

          {/* ─── Current weather ─── */}
          {current && (
            <motion.div
              key={`${current.city}-${current.observedAt}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: busy ? 0.6 : 1, y: 0 }}
              transition={TRANSITION.panel}
              className="flex flex-col gap-4"
            >
              {/* Hero */}
              <section
                aria-label="Current conditions"
                className="glass-panel relative isolate overflow-hidden rounded-card p-4"
              >
                <span aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ backgroundImage: conditionWash(current.icon) }} />
                <div className="flex items-center gap-2">
                  <MapPin size={14} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden />
                  <h2 className="min-w-0 flex-1 truncate text-ui font-medium text-fg" title={`${current.city}${current.country ? `, ${current.country}` : ''}`}>
                    {current.city}
                    {current.country && <span className="text-fg-subtle">, {current.country}</span>}
                  </h2>
                  {result && (
                    <Badge tone={SOURCE_TONE[result.source]} size="sm" dot title={SOURCE_LABEL[result.source]}>
                      {SOURCE_BADGE[result.source]}
                    </Badge>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-start">
                      <span className="tabular font-display text-6xl font-semibold leading-none tracking-tight text-fg">
                        {current.temp}
                      </span>
                      <span className="ml-1 mt-1.5 font-display text-xl font-medium text-fg-muted">°C</span>
                    </div>
                    <p className="mt-2 truncate text-sm capitalize text-fg-muted" title={current.description}>
                      {current.description || current.condition}
                    </p>
                  </div>
                  <div className="relative flex size-20 shrink-0 items-center justify-center">
                    <span
                      aria-hidden
                      className="absolute -inset-2 rounded-full"
                      style={{ backgroundImage: conditionHalo(current.icon) }}
                    />
                    <WeatherIcon code={current.icon} className="relative size-16" strokeWidth={1.5} />
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="hud-label">Today</span>
                    <span className="tabular font-mono text-2xs text-fg-subtle">Feels {current.feelsLike}°</span>
                  </div>
                  <RangeBar min={current.min} max={current.max} temp={current.temp} />
                </div>

                {locationFallback && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-warning">
                    <MapPinOff size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
                    Location unavailable (permission denied or timed out), so this is the default city.
                  </p>
                )}
              </section>

              {/* Next hours */}
              {current.forecast.length > 0 && (
                <section aria-label="Next hours" className="glass-panel rounded-card px-4 pb-3 pt-3.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="hud-label">Next {current.forecast.length * 3} hours</span>
                    <span className="tabular font-mono text-2xs text-fg-subtle">3 h steps</span>
                  </div>
                  <HourlyChart slots={current.forecast} />
                </section>
              )}

              {/* Details */}
              <section aria-label="Details" className="grid grid-cols-2 gap-2.5 @[330px]:grid-cols-3 [&>*:last-child]:col-span-2 @[330px]:[&>*:last-child]:col-span-1">
                <DetailTile icon={Thermometer} label="Feels" value={`${current.feelsLike}°`} caption={feelsCaption(current)} />
                <DetailTile icon={Droplets} label="Humidity" value={current.humidity} unit="%" caption={humidityCaption(current.humidity)}>
                  <ProgressBar value={current.humidity} max={100} size="sm" tone="info" aria-label="Humidity" />
                </DetailTile>
                <DetailTile icon={Wind} label="Wind" value={current.windKph} unit="km/h" caption={windCaption(current.windKph)} />
              </section>
            </motion.div>
          )}
        </div>
      </div>

      {/* ─── Footer ─── */}
      {result && (
        <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-t border-line pl-4 pr-2 text-xs text-fg-subtle">
          <span className="tabular truncate">
            {SOURCE_LABEL[result.source]}
            {result.data.observedAt > 0 && ` · Updated ${formatClock(result.data.observedAt)}`}
          </span>
          <IconButton
            icon={<RefreshCw size={14} strokeWidth={1.75} className={cn(busy && 'animate-spin')} aria-hidden />}
            aria-label="Refresh weather"
            size="sm"
            tooltip
            disabled={busy}
            onClick={onRefresh}
          />
        </div>
      )}
    </div>
  );
}

export const WeatherApp = memo(WeatherAppInner);
