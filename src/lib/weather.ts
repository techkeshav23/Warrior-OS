// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Weather Client
// Browser-side helper for /api/weather. It never sees an API key:
// the route handler owns it (and falls back to keyless Open-Meteo
// when no OpenWeatherMap key is set). Location order:
//   saved city (user's explicit choice) → geolocation → default city.
// Everything here is SSR-safe: browser APIs are only touched inside
// functions, behind typeof checks.
// ═══════════════════════════════════════════════════════════

export interface WeatherForecastSlot {
  /** HH:MM in the location's own timezone */
  time: string;
  temp: number;
  icon: string;
  condition: string;
}

export interface WeatherData {
  temp: number;
  /** Short group name from OpenWeatherMap, e.g. "Clouds" */
  condition: string;
  /** OpenWeatherMap icon code, e.g. "04d" (see WeatherIcon) */
  icon: string;
  city: string;
  country: string | null;
  description: string;
  feelsLike: number;
  humidity: number;
  windKph: number;
  min: number;
  max: number;
  observedAt: number;
  isDay: boolean;
  forecast: WeatherForecastSlot[];
}

export type WeatherSource = 'saved-city' | 'geolocation' | 'default-city' | 'last-known';

export interface LocalWeather {
  data: WeatherData;
  source: WeatherSource;
}

export type WeatherErrorCode =
  | 'no-key'
  | 'key-rejected'
  | 'not-found'
  | 'invalid-location'
  | 'rate-limited'
  | 'upstream'
  | 'network';

export class WeatherError extends Error {
  readonly code: WeatherErrorCode;

  constructor(code: WeatherErrorCode) {
    super(`weather:${code}`);
    this.name = 'WeatherError';
    this.code = code;
  }
}

export type WeatherQuery =
  | { kind: 'city'; city: string }
  | { kind: 'coords'; lat: number; lon: number };

export interface FetchWeatherOptions {
  /** Also fetch the next ~18 hours (3-hour slots) */
  forecast?: boolean;
  signal?: AbortSignal;
  /** Skip the in-tab cache (the server still caches for 10 min) */
  fresh?: boolean;
}

/** Fallback when there is no saved city and no location permission. */
export const DEFAULT_CITY = 'New Delhi,IN';
/** Last city searched in the Weather app (kept from the original app). */
export const WEATHER_CITY_STORAGE_KEY = 'warrior-weather-city';
export const MAX_CITY_LENGTH = 60;
/** Last successful "here" weather, shown while offline. */
export const WEATHER_LAST_KNOWN_KEY = 'warrior-weather-last';
/** Last-known weather older than this is not shown. */
export const LAST_KNOWN_MAX_AGE_MS = 12 * 60 * 60 * 1000;
/**
 * Name of the server-only env var the /api/weather route reads. Exported
 * only so setup hints can show it; nothing on the client reads env vars.
 */
export const WEATHER_KEY_ENV_NAME = 'WEATHER_API_KEY';

const CLIENT_TTL_MS = 10 * 60 * 1000;
const GEO_TIMEOUT_MS = 8000;

// ─── In-tab cache ───
// Lock screen, Weather app and remounts share results for 10 minutes.
interface MemoEntry {
  at: number;
  data: WeatherData;
  hasForecast: boolean;
}
const memo = new Map<string, MemoEntry>();
/** When the server said "no key", don't ask again for a while. */
let keyMissingUntil = 0;

export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeCity(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_CITY_LENGTH);
}

function queryKey(query: WeatherQuery): string {
  return query.kind === 'coords'
    ? `c:${roundCoord(query.lat).toFixed(2)},${roundCoord(query.lon).toFixed(2)}`
    : `q:${normalizeCity(query.city).toLowerCase()}`;
}

function errorCodeFor(status: number, apiError: string): WeatherErrorCode {
  switch (apiError) {
    case 'weather_key_missing':
      return 'no-key';
    case 'weather_key_rejected':
      return 'key-rejected';
    case 'city_not_found':
      return 'not-found';
    case 'invalid_city':
    case 'invalid_coordinates':
    case 'missing_location':
      return 'invalid-location';
    case 'rate_limited':
      return 'rate-limited';
  }
  if (status === 404) return 'not-found';
  if (status === 429) return 'rate-limited';
  if (status === 503) return 'no-key';
  return 'upstream';
}

// ─── Response validation (never trust the wire) ───

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function parseWeather(body: unknown): WeatherData | null {
  if (!isObject(body) || typeof body.temp !== 'number' || typeof body.city !== 'string') {
    return null;
  }
  const rawForecast: unknown[] = Array.isArray(body.forecast) ? body.forecast : [];
  const forecast: WeatherForecastSlot[] = [];
  for (const slot of rawForecast) {
    if (!isObject(slot)) continue;
    forecast.push({
      time: str(slot.time),
      temp: num(slot.temp),
      icon: str(slot.icon, '03d'),
      condition: str(slot.condition),
    });
  }
  const icon = str(body.icon, '03d');
  return {
    temp: num(body.temp),
    condition: str(body.condition, 'Unknown'),
    icon,
    city: body.city,
    country: typeof body.country === 'string' && body.country ? body.country : null,
    description: str(body.description),
    feelsLike: num(body.feelsLike, num(body.temp)),
    humidity: num(body.humidity),
    windKph: num(body.windKph),
    min: num(body.min, num(body.temp)),
    max: num(body.max, num(body.temp)),
    observedAt: num(body.observedAt),
    isDay: typeof body.isDay === 'boolean' ? body.isDay : !icon.endsWith('n'),
    forecast,
  };
}

// ─── Fetching ───

export async function fetchWeather(
  query: WeatherQuery,
  options: FetchWeatherOptions = {}
): Promise<WeatherData> {
  const { forecast = false, signal, fresh = false } = options;
  const now = Date.now();

  // An explicit refresh (fresh) re-checks the server even after "no key".
  if (!fresh && now < keyMissingUntil) throw new WeatherError('no-key');

  const key = queryKey(query);
  const cached = memo.get(key);
  if (!fresh && cached && now - cached.at < CLIENT_TTL_MS && (cached.hasForecast || !forecast)) {
    return cached.data;
  }

  const params = new URLSearchParams();
  if (query.kind === 'coords') {
    params.set('lat', roundCoord(query.lat).toFixed(2));
    params.set('lon', roundCoord(query.lon).toFixed(2));
  } else {
    const city = normalizeCity(query.city);
    if (!city) throw new WeatherError('invalid-location');
    params.set('city', city);
  }
  if (forecast) params.set('forecast', '1');

  let response: Response;
  try {
    response = await fetch(`/api/weather?${params.toString()}`, { signal });
  } catch (err) {
    if (signal?.aborted) throw err; // let callers see their own abort
    throw new WeatherError('network');
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const apiError = isObject(body) ? str(body.error) : '';
    const code = errorCodeFor(response.status, apiError);
    if (code === 'no-key') keyMissingUntil = Date.now() + CLIENT_TTL_MS;
    throw new WeatherError(code);
  }

  const data = parseWeather(body);
  if (!data) throw new WeatherError('upstream');

  memo.set(key, { at: Date.now(), data, hasForecast: forecast });
  return data;
}

export function fetchWeatherByCity(city: string, options?: FetchWeatherOptions): Promise<WeatherData> {
  return fetchWeather({ kind: 'city', city }, options);
}

export function fetchWeatherByCoords(
  lat: number,
  lon: number,
  options?: FetchWeatherOptions
): Promise<WeatherData> {
  return fetchWeather({ kind: 'coords', lat, lon }, options);
}

// ─── Saved city (explicit user choice from the Weather app) ───

export function getSavedCity(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(WEATHER_CITY_STORAGE_KEY);
    const city = raw ? normalizeCity(raw) : '';
    return city || null;
  } catch {
    return null;
  }
}

export function saveCity(city: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (city) window.localStorage.setItem(WEATHER_CITY_STORAGE_KEY, normalizeCity(city));
    else window.localStorage.removeItem(WEATHER_CITY_STORAGE_KEY);
  } catch {
    /* storage full or blocked: the choice just won't persist */
  }
}

// ─── Geolocation ───

type GeoPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

async function geolocationPermission(): Promise<GeoPermission> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown';
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return 'unknown';
  }
}

/**
 * Resolve the browser's position, or null. With allowPrompt=false this
 * never triggers a permission prompt (it only uses an existing grant).
 * An overall timeout covers a prompt the user simply ignores.
 */
export async function getBrowserPosition(
  options: { allowPrompt?: boolean; timeoutMs?: number } = {}
): Promise<{ lat: number; lon: number } | null> {
  const { allowPrompt = false, timeoutMs = GEO_TIMEOUT_MS } = options;
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }

  const permission = await geolocationPermission();
  if (permission === 'denied') return null;
  if (permission !== 'granted' && !allowPrompt) return null;

  return new Promise<{ lat: number; lon: number } | null>((resolve) => {
    let settled = false;
    const finish = (value: { lat: number; lon: number } | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => finish({ lat: roundCoord(pos.coords.latitude), lon: roundCoord(pos.coords.longitude) }),
        () => finish(null),
        { enableHighAccuracy: false, maximumAge: 30 * 60 * 1000, timeout: timeoutMs }
      );
    } catch {
      finish(null);
    }
  });
}

// ─── Last-known weather (offline fallback) ───

function saveLastKnown(data: WeatherData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WEATHER_LAST_KNOWN_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full or blocked */
  }
}

/** The last weather successfully shown for "here", if recent enough. */
export function getLastKnownWeather(maxAgeMs: number = LAST_KNOWN_MAX_AGE_MS): WeatherData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(WEATHER_LAST_KNOWN_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed) || Date.now() - num(parsed.at) > maxAgeMs) return null;
    return parseWeather(parsed.data);
  } catch {
    return null;
  }
}

/**
 * Weather for "here": saved city → geolocation → DEFAULT_CITY.
 * When every attempt fails (offline, no provider reachable) the last
 * weather shown in the past 12 hours is returned with source 'last-known'.
 * Configuration errors (no key, key rejected, rate limit) are thrown
 * straight away instead of being masked by the fallback chain.
 */
export async function getLocalWeather(
  options: { allowPrompt?: boolean; forecast?: boolean; signal?: AbortSignal; fresh?: boolean } = {}
): Promise<LocalWeather> {
  try {
    const result = await resolveLocalWeather(options);
    saveLastKnown(result.data);
    return result;
  } catch (err) {
    if (options.signal?.aborted) throw err;
    const code = toWeatherErrorCode(err);
    if (code === 'network' || code === 'upstream' || code === 'no-key' || code === 'rate-limited') {
      const last = getLastKnownWeather();
      if (last) return { data: last, source: 'last-known' };
    }
    throw err;
  }
}

async function resolveLocalWeather(
  options: { allowPrompt?: boolean; forecast?: boolean; signal?: AbortSignal; fresh?: boolean }
): Promise<LocalWeather> {
  const { allowPrompt = false, ...fetchOptions } = options;
  const fatal = (err: unknown) =>
    !(err instanceof WeatherError) ||
    err.code === 'no-key' ||
    err.code === 'key-rejected' ||
    err.code === 'rate-limited';

  const saved = getSavedCity();
  if (saved) {
    try {
      return { data: await fetchWeatherByCity(saved, fetchOptions), source: 'saved-city' };
    } catch (err) {
      if (fatal(err)) throw err;
      // A saved city that no longer resolves falls through to "here".
    }
  }

  const position = await getBrowserPosition({ allowPrompt });
  if (fetchOptions.signal?.aborted) throw new WeatherError('network');

  if (position) {
    try {
      return {
        data: await fetchWeatherByCoords(position.lat, position.lon, fetchOptions),
        source: 'geolocation',
      };
    } catch (err) {
      if (fatal(err)) throw err;
    }
  }

  return { data: await fetchWeatherByCity(DEFAULT_CITY, fetchOptions), source: 'default-city' };
}

export function weatherErrorMessage(code: WeatherErrorCode): string {
  switch (code) {
    case 'no-key':
      return 'Weather is unavailable: no OpenWeatherMap key is set and the keyless fallback could not be reached.';
    case 'key-rejected':
      return 'OpenWeatherMap rejected the key. New keys can take up to 2 hours to activate.';
    case 'not-found':
      return 'City not found. Try "Mumbai" or "Pune,IN".';
    case 'invalid-location':
      return 'That location looks invalid. Use letters, spaces and commas (max 60 characters).';
    case 'rate-limited':
      return 'Too many weather requests right now. Try again in a minute.';
    case 'network':
      return 'Network error. Check your connection.';
    default:
      return 'The weather service is not responding. Try again shortly.';
  }
}

export function toWeatherErrorCode(err: unknown): WeatherErrorCode {
  return err instanceof WeatherError ? err.code : 'network';
}
