// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Weather App
// OpenWeatherMap-powered forecast. Degrades gracefully if no API key.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, memo } from 'react';
import { cn } from '@/lib/utils';

const API_KEY = process.env.NEXT_PUBLIC_WEATHER_API_KEY || '';
const LAST_CITY_KEY = 'warrior-weather-city';

interface CurrentWeather {
  city: string;
  country: string;
  temp: number;
  feels: number;
  desc: string;
  icon: string;
  humidity: number;
  wind: number;
  min: number;
  max: number;
}

interface ForecastSlot {
  time: string;
  temp: number;
  icon: string;
}

/** Map OpenWeather icon code → emoji (no external asset needed) */
function iconEmoji(code: string): string {
  const map: Record<string, string> = {
    '01d': '☀️', '01n': '🌙',
    '02d': '⛅', '02n': '☁️',
    '03d': '☁️', '03n': '☁️',
    '04d': '☁️', '04n': '☁️',
    '09d': '🌧️', '09n': '🌧️',
    '10d': '🌦️', '10n': '🌧️',
    '11d': '⛈️', '11n': '⛈️',
    '13d': '❄️', '13n': '❄️',
    '50d': '🌫️', '50n': '🌫️',
  };
  return map[code] || '🌡️';
}

function WeatherAppInner() {
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [forecast, setForecast] = useState<ForecastSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async (city: string) => {
    if (!city.trim()) return;
    if (!API_KEY) {
      setError('no-key');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const base = 'https://api.openweathermap.org/data/2.5';
      const [curRes, foreRes] = await Promise.all([
        fetch(`${base}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`),
        fetch(`${base}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`),
      ]);
      if (!curRes.ok) {
        setError(curRes.status === 404 ? 'City not found' : 'Failed to fetch weather');
        setCurrent(null);
        setForecast([]);
        return;
      }
      const c = await curRes.json();
      setCurrent({
        city: c.name,
        country: c.sys?.country ?? '',
        temp: Math.round(c.main.temp),
        feels: Math.round(c.main.feels_like),
        desc: c.weather?.[0]?.description ?? '',
        icon: c.weather?.[0]?.icon ?? '01d',
        humidity: c.main.humidity,
        wind: Math.round((c.wind?.speed ?? 0) * 3.6), // m/s → km/h
        min: Math.round(c.main.temp_min),
        max: Math.round(c.main.temp_max),
      });

      if (foreRes.ok) {
        const f = await foreRes.json();
        const slots: ForecastSlot[] = (f.list ?? []).slice(0, 6).map((s: {
          dt_txt: string;
          main: { temp: number };
          weather: { icon: string }[];
        }) => ({
          time: s.dt_txt.split(' ')[1]?.slice(0, 5) ?? '',
          temp: Math.round(s.main.temp),
          icon: s.weather?.[0]?.icon ?? '01d',
        }));
        setForecast(slots);
      }
      localStorage.setItem(LAST_CITY_KEY, city);
    } catch {
      setError('Network error — check your connection');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load last searched city on mount
  useEffect(() => {
    const last = typeof window !== 'undefined' ? localStorage.getItem(LAST_CITY_KEY) : null;
    if (last) {
      setQuery(last);
      fetchWeather(last);
    } else if (!API_KEY) {
      setError('no-key');
    }
  }, [fetchWeather]);

  const onSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    fetchWeather(query);
  }, [query, fetchWeather]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-sky-900/30 to-black/50 text-white">
      {/* Search bar */}
      <form onSubmit={onSubmit} className="p-3 flex gap-2 border-b border-white/10">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search city… (e.g. Delhi)"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-400/50 placeholder-white/30"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-sky-500/20 border border-sky-400/30 text-sky-200 text-sm hover:bg-sky-500/30 transition-colors disabled:opacity-50"
        >
          {loading ? '…' : 'Go'}
        </button>
      </form>

      <div className="flex-1 overflow-y-auto p-4">
        {/* No API key state */}
        {error === 'no-key' && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm space-y-2">
            <p className="text-amber-300 font-semibold">🔑 Weather API key needed</p>
            <p className="text-white/60 text-xs leading-relaxed">
              Live weather ke liye ek free OpenWeatherMap key chahiye:
            </p>
            <ol className="text-white/50 text-xs list-decimal list-inside space-y-1">
              <li>openweathermap.org pe free account banao</li>
              <li>API key copy karo</li>
              <li><span className="font-mono text-sky-300">.env.local</span> mein <span className="font-mono text-sky-300">NEXT_PUBLIC_WEATHER_API_KEY</span> set karo</li>
              <li>Dev server restart karo</li>
            </ol>
          </div>
        )}

        {/* Error state */}
        {error && error !== 'no-key' && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Current weather */}
        {current && !loading && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-white/60">{current.city}{current.country && `, ${current.country}`}</p>
              <div className="text-7xl my-2">{iconEmoji(current.icon)}</div>
              <div className="text-5xl font-light tabular-nums">{current.temp}°</div>
              <p className="text-sm text-white/70 capitalize mt-1">{current.desc}</p>
              <p className="text-xs text-white/40 mt-0.5">Feels like {current.feels}° · H:{current.max}° L:{current.min}°</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
                <p className="text-[11px] text-white/40 uppercase tracking-wide">Humidity</p>
                <p className="text-lg font-mono text-sky-300">{current.humidity}%</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
                <p className="text-[11px] text-white/40 uppercase tracking-wide">Wind</p>
                <p className="text-lg font-mono text-sky-300">{current.wind} km/h</p>
              </div>
            </div>

            {/* Forecast strip */}
            {forecast.length > 0 && (
              <div>
                <p className="text-[11px] text-white/40 uppercase tracking-wide mb-2">Next hours</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {forecast.map((f, i) => (
                    <div key={i} className={cn(
                      'shrink-0 w-16 rounded-lg bg-white/5 border border-white/10 p-2 text-center'
                    )}>
                      <p className="text-[10px] text-white/40">{f.time}</p>
                      <div className="text-2xl my-1">{iconEmoji(f.icon)}</div>
                      <p className="text-sm font-mono">{f.temp}°</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty prompt */}
        {!current && !error && !loading && (
          <p className="text-center text-white/30 text-sm mt-8">Search a city to see the weather 🌤️</p>
        )}
      </div>
    </div>
  );
}

export const WeatherApp = memo(WeatherAppInner);
