// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Keyless Weather Provider (Open-Meteo)
// Used by /api/weather when no OpenWeatherMap key is configured, so
// weather works out of the box. Open-Meteo needs no API key. Results
// are mapped onto the same payload shape (and OpenWeatherMap icon
// codes) the OWM path produces, so the client never knows which
// provider answered. Every failure maps to a small error code; the
// route turns it into a normal JSON error response.
// ═══════════════════════════════════════════════════════════

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 8000;

export interface KeylessForecastSlot {
  time: string;
  temp: number;
  icon: string;
  condition: string;
}

export interface KeylessWeather {
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
  observedAt: number;
  isDay: boolean;
  forecast: KeylessForecastSlot[];
}

export type KeylessLocation =
  | { kind: 'coords'; lat: number; lon: number }
  | { kind: 'city'; city: string };

export type KeylessResult =
  | { ok: true; value: KeylessWeather }
  | { ok: false; status: number; error: string };

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

function numAt(list: unknown, index: number, fallback = 0): number {
  return Array.isArray(list) ? num(list[index], fallback) : fallback;
}

// ─── WMO weather code → OpenWeatherMap-style condition + icon ───

interface Condition {
  main: string;
  description: string;
  /** Icon code without the day/night suffix, e.g. "10" */
  icon: string;
}

export function wmoCondition(code: number): Condition {
  if (code === 0) return { main: 'Clear', description: 'clear sky', icon: '01' };
  if (code === 1) return { main: 'Clear', description: 'mainly clear', icon: '02' };
  if (code === 2) return { main: 'Clouds', description: 'partly cloudy', icon: '03' };
  if (code === 3) return { main: 'Clouds', description: 'overcast clouds', icon: '04' };
  if (code === 45 || code === 48) return { main: 'Fog', description: 'fog', icon: '50' };
  if (code >= 51 && code <= 57) return { main: 'Drizzle', description: 'drizzle', icon: '09' };
  if (code === 61) return { main: 'Rain', description: 'light rain', icon: '10' };
  if (code === 63) return { main: 'Rain', description: 'moderate rain', icon: '10' };
  if (code === 65) return { main: 'Rain', description: 'heavy rain', icon: '10' };
  if (code === 66 || code === 67) return { main: 'Rain', description: 'freezing rain', icon: '13' };
  if (code >= 71 && code <= 77) return { main: 'Snow', description: 'snow', icon: '13' };
  if (code >= 80 && code <= 82) return { main: 'Rain', description: 'rain showers', icon: '09' };
  if (code === 85 || code === 86) return { main: 'Snow', description: 'snow showers', icon: '13' };
  if (code >= 95) return { main: 'Thunderstorm', description: 'thunderstorm', icon: '11' };
  return { main: 'Clouds', description: 'cloudy', icon: '03' };
}

// ─── Upstream ───

async function getJson(url: string): Promise<{ ok: true; body: unknown } | { ok: false; status: number; error: string }> {
  let response: Response;
  try {
    response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return { ok: false, status: 504, error: 'upstream_unreachable' };
  }
  if (response.status === 429) return { ok: false, status: 429, error: 'rate_limited' };
  if (!response.ok) return { ok: false, status: 502, error: 'upstream_error' };
  const body: unknown = await response.json().catch(() => null);
  if (body === null) return { ok: false, status: 502, error: 'upstream_error' };
  return { ok: true, body };
}

interface Place {
  lat: number;
  lon: number;
  city: string;
  country: string | null;
}

/** "Pune", "Pune,IN" or "Pune, Maharashtra, IN" → first matching place. */
async function geocode(query: string): Promise<{ ok: true; place: Place } | { ok: false; status: number; error: string }> {
  const parts = query.split(',').map((p) => p.trim()).filter(Boolean);
  const name = parts[0] ?? '';
  if (!name) return { ok: false, status: 400, error: 'invalid_city' };
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const countryCode = /^[a-z]{2}$/i.test(last) ? last.toUpperCase() : null;

  const params = new URLSearchParams({ name, count: '10', language: 'en', format: 'json' });
  const result = await getJson(`${GEOCODE_URL}?${params.toString()}`);
  if (!result.ok) return result;

  const list: unknown[] = isObject(result.body) && Array.isArray(result.body.results) ? result.body.results : [];
  const places = list.filter(isObject);
  const match =
    (countryCode ? places.find((p) => str(p.country_code).toUpperCase() === countryCode) : undefined) ??
    places[0];
  if (!match || typeof match.latitude !== 'number' || typeof match.longitude !== 'number') {
    return { ok: false, status: 404, error: 'city_not_found' };
  }
  const country = str(match.country_code).toUpperCase();
  return {
    ok: true,
    place: {
      lat: match.latitude,
      lon: match.longitude,
      city: str(match.name, name),
      country: country || null,
    },
  };
}

function parseForecast(body: unknown, place: Place, slots: number): KeylessWeather | null {
  if (!isObject(body) || !isObject(body.current)) return null;
  const current = body.current;
  if (typeof current.temperature_2m !== 'number') return null;

  const code = num(current.weather_code, 3);
  const isDay = num(current.is_day, 1) === 1;
  const condition = wmoCondition(code);
  const temp = num(current.temperature_2m);
  const daily: Json = isObject(body.daily) ? body.daily : {};
  const offsetSec = num(body.utc_offset_seconds);

  // Hourly: every 3rd hour from now, for the next `slots` slots.
  const forecast: KeylessForecastSlot[] = [];
  const hourly: Json = isObject(body.hourly) ? body.hourly : {};
  const times: unknown[] = Array.isArray(hourly.time) ? hourly.time : [];
  const nowSec = Math.floor(Date.now() / 1000);
  for (let i = 0; i < times.length && forecast.length < slots; i++) {
    const t = num(times[i], NaN);
    if (!Number.isFinite(t) || t <= nowSec) continue;
    const local = new Date((t + offsetSec) * 1000);
    if (local.getUTCHours() % 3 !== 0) continue;
    const slotCondition = wmoCondition(numAt(hourly.weather_code, i, 3));
    const slotDay = numAt(hourly.is_day, i, 1) === 1;
    forecast.push({
      time: `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`,
      temp: Math.round(numAt(hourly.temperature_2m, i)),
      icon: `${slotCondition.icon}${slotDay ? 'd' : 'n'}`,
      condition: slotCondition.main,
    });
  }

  const observed = num(current.time);
  return {
    temp: Math.round(temp),
    condition: condition.main,
    icon: `${condition.icon}${isDay ? 'd' : 'n'}`,
    city: place.city,
    country: place.country,
    description: condition.description,
    feelsLike: Math.round(num(current.apparent_temperature, temp)),
    humidity: Math.round(num(current.relative_humidity_2m)),
    windKph: Math.round(num(current.wind_speed_10m)),
    min: Math.round(numAt(daily.temperature_2m_min, 0, temp)),
    max: Math.round(numAt(daily.temperature_2m_max, 0, temp)),
    observedAt: observed > 0 ? observed * 1000 : Date.now(),
    isDay,
    forecast,
  };
}

/** Current weather (+ forecast slots) without any API key. */
export async function fetchKeylessWeather(location: KeylessLocation, slots: number): Promise<KeylessResult> {
  let place: Place;
  if (location.kind === 'city') {
    const found = await geocode(location.city);
    if (!found.ok) return found;
    place = found.place;
  } else {
    // No keyless reverse geocoding: label coordinates generically.
    place = { lat: location.lat, lon: location.lon, city: 'Your location', country: null };
  }

  const params = new URLSearchParams({
    latitude: place.lat.toFixed(2),
    longitude: place.lon.toFixed(2),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    timeformat: 'unixtime',
    wind_speed_unit: 'kmh',
    forecast_days: '2',
  });
  const result = await getJson(`${FORECAST_URL}?${params.toString()}`);
  if (!result.ok) return result;
  const payload = parseForecast(result.body, place, slots);
  return payload ? { ok: true, value: payload } : { ok: false, status: 502, error: 'upstream_error' };
}
