// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Weather Proxy Route (OpenWeatherMap, free tier)
//
// Why a server route: the OpenWeatherMap key must never reach the
// browser bundle. The key is read here, inside the handler, and
// nowhere else. The route also validates input, rounds coordinates
// (privacy + better cache hits) and keeps a 10-minute in-memory
// cache per rounded coordinate / city so the free quota lasts.
//
//   GET /api/weather?lat=28.61&lon=77.21[&forecast=1]
//   GET /api/weather?city=New%20Delhi,IN[&forecast=1]
//
// 200 → { temp, condition, icon, city, ...extras }
// 4xx/5xx → { error: <code> }
// ═══════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';

// The in-memory cache lives in the Node.js server process.
export const runtime = 'nodejs';
// Every response depends on the query string; never prerender.
export const dynamic = 'force-dynamic';

const OWM_BASE = 'https://api.openweathermap.org/data/2.5';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const MAX_CITY_LENGTH = 60;
const UPSTREAM_TIMEOUT_MS = 8000;
const FORECAST_SLOTS = 6; // 6 × 3h = the next 18 hours
// Free tier allows 60 calls/min. Stay under it even if someone sprays
// random coordinates at the route (each would be a cache miss).
const UPSTREAM_BUDGET_PER_MIN = 50;

// Control characters and URL/markup metacharacters are never part of a
// city name. The value is URL-encoded before it goes upstream anyway;
// this keeps the accepted input small and boring.
const FORBIDDEN_CITY_CHARS = /[\u0000-\u001f\u007f<>{}[\]\\/;:"=&?#%@!$^*+|~`]/;

// ─── Response shapes ───

interface ForecastSlot {
  /** HH:MM in the location's own timezone */
  time: string;
  temp: number;
  icon: string;
  condition: string;
}

interface WeatherPayload {
  temp: number;
  condition: string;
  icon: string;
  city: string;
  country: string | null;
  description: string;
  feelsLike: number;
  humidity: number;
  windKph: number;
  min: number;
  max: number;
  /** Observation time, epoch ms */
  observedAt: number;
  isDay: boolean;
  forecast?: ForecastSlot[];
}

type WeatherLocation =
  | { kind: 'coords'; lat: number; lon: number }
  | { kind: 'city'; city: string };

type UpstreamResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string };

// ─── In-memory cache (per server instance) ───

interface CacheEntry<T> {
  expires: number;
  value: T;
}

const currentCache = new Map<string, CacheEntry<WeatherPayload>>();
const forecastCache = new Map<string, CacheEntry<ForecastSlot[]>>();
const inflight = new Map<string, Promise<UpstreamResult<unknown>>>();
const upstreamCallTimes: number[] = [];

/** Sliding one-minute budget shared by every upstream call. */
function takeUpstreamSlot(): boolean {
  const now = Date.now();
  while (upstreamCallTimes.length > 0 && now - upstreamCallTimes[0] > 60_000) {
    upstreamCallTimes.shift();
  }
  if (upstreamCallTimes.length >= UPSTREAM_BUDGET_PER_MIN) return false;
  upstreamCallTimes.push(now);
  return true;
}

function cacheGet<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
  cache.delete(key); // re-insert so Map order tracks recency
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Share one upstream call between concurrent requests for the same key. */
function dedupe<T>(key: string, run: () => Promise<UpstreamResult<T>>): Promise<UpstreamResult<T>> {
  const pending = inflight.get(key) as Promise<UpstreamResult<T>> | undefined;
  if (pending) return pending;
  const promise = run().finally(() => inflight.delete(key));
  inflight.set(key, promise as Promise<UpstreamResult<unknown>>);
  return promise;
}

// ─── Helpers ───

/** First configured key: skips empty values and `your_…` placeholders. */
function pickApiKey(...candidates: Array<string | undefined>): string | null {
  for (const raw of candidates) {
    const key = raw?.trim();
    if (key && !key.startsWith('your_')) return key;
  }
  return null;
}

function json(body: unknown, status: number, cacheSeconds = 0) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': cacheSeconds > 0 ? `private, max-age=${cacheSeconds}` : 'no-store',
    },
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseCoordinate(raw: string | null, limit: number): number | null {
  if (raw === null || raw.trim() === '' || raw.length > 24) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || Math.abs(value) > limit) return null;
  return round2(value);
}

function parseLocation(params: URLSearchParams): WeatherLocation | { error: string } {
  const rawLat = params.get('lat');
  const rawLon = params.get('lon');
  if (rawLat !== null || rawLon !== null) {
    const lat = parseCoordinate(rawLat, 90);
    const lon = parseCoordinate(rawLon, 180);
    if (lat === null || lon === null) return { error: 'invalid_coordinates' };
    return { kind: 'coords', lat, lon };
  }

  const rawCity = params.get('city');
  if (rawCity !== null) {
    const city = rawCity.replace(/\s+/g, ' ').trim();
    if (city.length === 0 || city.length > MAX_CITY_LENGTH || FORBIDDEN_CITY_CHARS.test(city)) {
      return { error: 'invalid_city' };
    }
    return { kind: 'city', city };
  }

  return { error: 'missing_location' };
}

function cacheKeyFor(location: WeatherLocation): string {
  return location.kind === 'coords'
    ? `c:${location.lat.toFixed(2)},${location.lon.toFixed(2)}`
    : `q:${location.city.toLowerCase()}`;
}

function upstreamUrl(endpoint: 'weather' | 'forecast', location: WeatherLocation, apiKey: string): string {
  const params = new URLSearchParams({ units: 'metric', appid: apiKey });
  if (location.kind === 'coords') {
    params.set('lat', String(location.lat));
    params.set('lon', String(location.lon));
  } else {
    params.set('q', location.city);
  }
  if (endpoint === 'forecast') params.set('cnt', String(FORECAST_SLOTS));
  return `${OWM_BASE}/${endpoint}?${params.toString()}`;
}

async function callUpstream(url: string): Promise<UpstreamResult<unknown>> {
  if (!takeUpstreamSlot()) {
    return { ok: false, status: 429, error: 'rate_limited' };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store', // never let Next's data cache store a URL that carries the key
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, status: 504, error: 'upstream_unreachable' };
  }

  if (response.ok) {
    const body: unknown = await response.json().catch(() => null);
    return body === null
      ? { ok: false, status: 502, error: 'upstream_error' }
      : { ok: true, value: body };
  }

  // Never forward upstream bodies: map to our own small error codes.
  switch (response.status) {
    case 404:
      return { ok: false, status: 404, error: 'city_not_found' };
    case 401:
      // Wrong key, or a brand-new key that OpenWeatherMap has not activated yet.
      return { ok: false, status: 502, error: 'weather_key_rejected' };
    case 429:
      return { ok: false, status: 429, error: 'rate_limited' };
    default:
      return { ok: false, status: 502, error: 'upstream_error' };
  }
}

// ─── Defensive JSON readers (upstream schema is not ours) ───

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

function firstCondition(value: unknown): { main: string; description: string; icon: string } {
  const head: unknown = Array.isArray(value) ? value[0] : undefined;
  const first: Json = isObject(head) ? head : {};
  return {
    main: str(first.main, 'Unknown'),
    description: str(first.description),
    icon: str(first.icon, '03d'),
  };
}

function parseCurrent(body: unknown, location: WeatherLocation): WeatherPayload | null {
  if (!isObject(body) || !isObject(body.main) || typeof body.main.temp !== 'number') return null;
  const main = body.main;
  const sys: Json = isObject(body.sys) ? body.sys : {};
  const wind: Json = isObject(body.wind) ? body.wind : {};
  const condition = firstCondition(body.weather);
  const name = str(body.name).trim();
  const country = str(sys.country).trim();

  return {
    temp: Math.round(num(main.temp)),
    condition: condition.main,
    icon: condition.icon,
    city: name || (location.kind === 'city' ? location.city : 'Your location'),
    country: country || null,
    description: condition.description || condition.main,
    feelsLike: Math.round(num(main.feels_like, num(main.temp))),
    humidity: Math.round(num(main.humidity)),
    windKph: Math.round(num(wind.speed) * 3.6), // m/s → km/h
    min: Math.round(num(main.temp_min, num(main.temp))),
    max: Math.round(num(main.temp_max, num(main.temp))),
    observedAt: num(body.dt) > 0 ? num(body.dt) * 1000 : Date.now(),
    isDay: !condition.icon.endsWith('n'),
  };
}

function parseForecast(body: unknown): ForecastSlot[] {
  if (!isObject(body) || !Array.isArray(body.list)) return [];
  const cityInfo: Json = isObject(body.city) ? body.city : {};
  const tzOffsetSec = num(cityInfo.timezone); // seconds east of UTC for the location

  const slots: ForecastSlot[] = [];
  const entries: unknown[] = body.list.slice(0, FORECAST_SLOTS);
  for (const entry of entries) {
    if (!isObject(entry) || !isObject(entry.main)) continue;
    const dt = num(entry.dt);
    if (dt <= 0) continue;
    const local = new Date((dt + tzOffsetSec) * 1000);
    const hh = String(local.getUTCHours()).padStart(2, '0');
    const mm = String(local.getUTCMinutes()).padStart(2, '0');
    const condition = firstCondition(entry.weather);
    slots.push({
      time: `${hh}:${mm}`,
      temp: Math.round(num(entry.main.temp)),
      icon: condition.icon,
      condition: condition.main,
    });
  }
  return slots;
}

async function getCurrent(location: WeatherLocation, apiKey: string): Promise<UpstreamResult<WeatherPayload>> {
  const key = cacheKeyFor(location);
  const hit = cacheGet(currentCache, key);
  if (hit) return { ok: true, value: hit };

  return dedupe<WeatherPayload>(`cur|${key}`, async () => {
    const result = await callUpstream(upstreamUrl('weather', location, apiKey));
    if (!result.ok) return result;
    const payload = parseCurrent(result.value, location);
    if (!payload) return { ok: false, status: 502, error: 'upstream_error' };
    cacheSet(currentCache, key, payload);
    return { ok: true, value: payload };
  });
}

async function getForecast(location: WeatherLocation, apiKey: string): Promise<ForecastSlot[]> {
  const key = cacheKeyFor(location);
  const hit = cacheGet(forecastCache, key);
  if (hit) return hit;

  const result = await dedupe<ForecastSlot[]>(`fc|${key}`, async () => {
    const upstream = await callUpstream(upstreamUrl('forecast', location, apiKey));
    if (!upstream.ok) return upstream;
    const slots = parseForecast(upstream.value);
    cacheSet(forecastCache, key, slots);
    return { ok: true, value: slots };
  });
  // The forecast is optional garnish: a failure never fails the request.
  return result.ok ? result.value : [];
}

// ─── Handler ───

export async function GET(request: NextRequest) {
  const location = parseLocation(request.nextUrl.searchParams);
  if ('error' in location) {
    return json({ error: location.error }, 400);
  }

  // Read per request, inside the handler, server-side only. WEATHER_API_KEY
  // is the server-only name; the legacy NEXT_PUBLIC_ name is accepted as a
  // fallback so existing .env files keep working. Both are read only here,
  // so neither is ever inlined into client code.
  const apiKey = pickApiKey(process.env.WEATHER_API_KEY, process.env.NEXT_PUBLIC_WEATHER_API_KEY);
  if (!apiKey) {
    return json({ error: 'weather_key_missing' }, 503);
  }

  const wantForecast = request.nextUrl.searchParams.get('forecast') === '1';

  const [current, forecast] = await Promise.all([
    getCurrent(location, apiKey),
    wantForecast ? getForecast(location, apiKey) : Promise.resolve(undefined),
  ]);

  if (!current.ok) {
    return json({ error: current.error }, current.status);
  }

  const body: WeatherPayload = forecast ? { ...current.value, forecast } : current.value;
  return json(body, 200, 120);
}
