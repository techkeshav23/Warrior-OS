// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Weather App
// Live OpenWeatherMap weather through the /api/weather proxy.
// The API key stays on the server; this component only talks to
// our own route via lib/weather. Opens on the saved city, else your
// location (asks once), else the default city.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { Droplets, LocateFixed, MapPin, RefreshCw, Search, Thermometer, Wind } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  type WeatherErrorCode,
  type WeatherSource,
} from '@/lib/weather';
import { WeatherIcon } from './WeatherIcon';

const SOURCE_LABEL: Record<WeatherSource, string> = {
  'saved-city': 'Saved city',
  geolocation: 'Your location',
  'default-city': `Default city (${DEFAULT_CITY.split(',')[0]})`,
  'last-known': 'Offline · last known',
};

function formatClock(epochMs: number): string {
  if (!epochMs) return '';
  return new Date(epochMs).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

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

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-sky-900/30 to-black/50 text-white">
      {/* ─── Search bar ─── */}
      <form onSubmit={onSubmit} className="p-3 flex gap-2 border-b border-white/10">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={MAX_CITY_LENGTH}
            placeholder="Search city… (e.g. Pune)"
            aria-label="City"
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:border-sky-400/50 placeholder-white/40"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !normalizeCity(query)}
          className="px-3 py-2 rounded-lg bg-sky-500/20 border border-sky-400/30 text-sky-200 text-sm hover:bg-sky-500/30 transition-colors disabled:opacity-50"
        >
          Go
        </button>
        <button
          type="button"
          onClick={onUseLocation}
          disabled={busy}
          title="Use my location"
          aria-label="Use my location"
          className="px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 text-sky-200 hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <LocateFixed className="w-4 h-4" aria-hidden="true" />
        </button>
      </form>

      <div className="flex-1 overflow-y-auto p-4">
        {/* ─── Error state ─── */}
        {error && (
          <div
            role="alert"
            className={cn(
              'rounded-xl p-4 text-sm space-y-2 mb-4 border',
              error === 'no-key' || error === 'key-rejected'
                ? 'bg-amber-500/10 border-amber-500/20'
                : 'bg-red-500/10 border-red-500/20'
            )}
          >
            <p className={error === 'no-key' || error === 'key-rejected' ? 'text-amber-300' : 'text-red-300'}>
              {weatherErrorMessage(error)}
            </p>
            {error === 'no-key' && (
              <ol className="text-white/60 text-xs list-decimal list-inside space-y-1">
                <li>Create a free key at openweathermap.org</li>
                <li>
                  Add <span className="font-mono text-sky-300">{WEATHER_KEY_ENV_NAME}=…</span> to{' '}
                  <span className="font-mono text-sky-300">.env.local</span> (server-only, no NEXT_PUBLIC_ prefix)
                </li>
                <li>Restart the dev server</li>
              </ol>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={busy}
              className="text-xs px-3 py-1 rounded-md bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              Try again
            </button>
          </div>
        )}

        {/* ─── Loading skeleton (first load only) ─── */}
        {busy && !current && !error && (
          <div className="flex flex-col items-center gap-3 pt-6 animate-pulse" aria-label="Loading weather">
            <div className="h-3 w-28 rounded bg-white/10" />
            <div className="h-16 w-16 rounded-full bg-white/10" />
            <div className="h-10 w-20 rounded bg-white/10" />
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="grid grid-cols-3 gap-2 w-full mt-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-white/5 border border-white/10" />
              ))}
            </div>
          </div>
        )}

        {/* ─── Current weather ─── */}
        {current && (
          <motion.div
            key={`${current.city}-${current.observedAt}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: busy ? 0.6 : 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <div className="text-center">
              <p className="text-sm text-white/70 flex items-center justify-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
                <span className="truncate">
                  {current.city}
                  {current.country && `, ${current.country}`}
                </span>
              </p>
              <WeatherIcon code={current.icon} className="w-16 h-16 mx-auto my-3" />
              <div className="text-5xl font-light tabular-nums">{current.temp}°C</div>
              <p className="text-sm text-white/70 capitalize mt-1">{current.description}</p>
              <p className="text-xs text-white/50 mt-0.5">
                H: {current.max}° · L: {current.min}°
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat icon={<Thermometer className="w-3.5 h-3.5" />} label="Feels" value={`${current.feelsLike}°`} />
              <Stat icon={<Droplets className="w-3.5 h-3.5" />} label="Humidity" value={`${current.humidity}%`} />
              <Stat icon={<Wind className="w-3.5 h-3.5" />} label="Wind" value={`${current.windKph} km/h`} />
            </div>

            {current.forecast.length > 0 && (
              <div>
                <p className="text-[11px] text-white/50 uppercase tracking-wide mb-2">Next hours</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {current.forecast.map((slot, i) => (
                    <div
                      key={`${slot.time}-${i}`}
                      className="shrink-0 w-16 rounded-lg bg-white/5 border border-white/10 p-2 text-center"
                      title={slot.condition}
                    >
                      <p className="text-[10px] text-white/50 font-mono">{slot.time}</p>
                      <WeatherIcon code={slot.icon} className="w-6 h-6 mx-auto my-1" />
                      <p className="text-sm font-mono">{slot.temp}°</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {locationFallback && (
              <p className="text-[11px] text-amber-300/80 text-center">
                Location unavailable (permission denied or timed out), so this is the default city.
              </p>
            )}
          </motion.div>
        )}
      </div>

      {/* ─── Footer ─── */}
      {result && (
        <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between gap-2 text-[11px] text-white/50">
          <span className="truncate">
            {SOURCE_LABEL[result.source]}
            {result.data.observedAt > 0 && ` · Updated ${formatClock(result.data.observedAt)}`}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={busy}
            aria-label="Refresh weather"
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', busy && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-2.5 text-center min-w-0">
      <p className="text-[11px] text-white/50 uppercase tracking-wide flex items-center justify-center gap-1 min-w-0">
        <span className="text-sky-300 shrink-0" aria-hidden="true">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </p>
      <p className="text-base font-mono text-sky-300 truncate">{value}</p>
    </div>
  );
}

export const WeatherApp = memo(WeatherAppInner);
