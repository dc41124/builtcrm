// Open-Meteo weather fetcher. Free, no key, commercial-friendly terms.
// Branches automatically:
//   - historical archive API for past logDates (archive-api.open-meteo.com)
//   - forecast API for today + future (api.open-meteo.com)
// Non-throwing: returns null on any failure so the daily-log create form
// falls back to manual entry.

import type { WeatherConditions } from "@/lib/weather/types";

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 5000;

export type WeatherFetchInput = {
  latitude: number;
  longitude: number;
  // YYYY-MM-DD in the project's timezone.
  logDate: string;
  // IANA timezone; Open-Meteo needs this to anchor daily aggregates.
  timezone: string;
};

export type WeatherFetchResult = {
  conditions: WeatherConditions;
  highC: number | null;
  lowC: number | null;
  precipPct: number | null;
  windKmh: number | null;
  source: "open-meteo-archive" | "open-meteo-forecast";
};

export async function fetchDailyWeather(
  input: WeatherFetchInput,
): Promise<WeatherFetchResult | null> {
  const today = new Date().toISOString().slice(0, 10);
  const isHistorical = input.logDate < today;

  // Archive has a ~5-day lag; for "today" and recent past, forecast API
  // covers -7 to +7 days and is more current.
  const useArchive = isHistorical && daysAgo(input.logDate) > 7;

  return useArchive
    ? fetchArchive(input)
    : fetchForecast(input, isHistorical);
}

function daysAgo(logDate: string): number {
  const d = new Date(logDate + "T12:00:00Z");
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

async function fetchForecast(
  input: WeatherFetchInput,
  isHistorical: boolean,
): Promise<WeatherFetchResult | null> {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(input.latitude));
  url.searchParams.set("longitude", String(input.longitude));
  url.searchParams.set("timezone", input.timezone);
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code",
  );
  if (isHistorical) {
    url.searchParams.set("past_days", "7");
  }

  const json = await fetchJson(url.toString());
  if (!json) return null;
  const idx = findDayIndex(json, input.logDate);
  if (idx < 0) return null;

  const daily = json.daily as ForecastDaily;
  return {
    conditions: mapWeatherCode(pick(daily.weather_code, idx)),
    highC: roundOrNull(pick(daily.temperature_2m_max, idx)),
    lowC: roundOrNull(pick(daily.temperature_2m_min, idx)),
    precipPct: roundOrNull(pick(daily.precipitation_probability_max, idx)),
    windKmh: roundOrNull(pick(daily.wind_speed_10m_max, idx)),
    source: "open-meteo-forecast",
  };
}

async function fetchArchive(
  input: WeatherFetchInput,
): Promise<WeatherFetchResult | null> {
  const url = new URL(ARCHIVE_URL);
  url.searchParams.set("latitude", String(input.latitude));
  url.searchParams.set("longitude", String(input.longitude));
  url.searchParams.set("timezone", input.timezone);
  url.searchParams.set("start_date", input.logDate);
  url.searchParams.set("end_date", input.logDate);
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code",
  );

  const json = await fetchJson(url.toString());
  if (!json) return null;
  const idx = findDayIndex(json, input.logDate);
  if (idx < 0) return null;

  const daily = json.daily as ArchiveDaily;
  // Archive exposes precipitation_sum (mm), not probability. Convert to
  // a rough "precip %" by treating any measurable precip as 100%, trace
  // as 20%, none as 0%. Good enough for a form prefill.
  const precipSum = pick(daily.precipitation_sum, idx);
  const precipPct =
    precipSum == null
      ? null
      : precipSum >= 1
        ? 100
        : precipSum > 0
          ? 20
          : 0;

  return {
    conditions: mapWeatherCode(pick(daily.weather_code, idx)),
    highC: roundOrNull(pick(daily.temperature_2m_max, idx)),
    lowC: roundOrNull(pick(daily.temperature_2m_min, idx)),
    precipPct,
    windKmh: roundOrNull(pick(daily.wind_speed_10m_max, idx)),
    source: "open-meteo-archive",
  };
}

type ForecastDaily = {
  time?: string[];
  temperature_2m_max?: Array<number | null>;
  temperature_2m_min?: Array<number | null>;
  precipitation_probability_max?: Array<number | null>;
  wind_speed_10m_max?: Array<number | null>;
  weather_code?: Array<number | null>;
};

type ArchiveDaily = {
  time?: string[];
  temperature_2m_max?: Array<number | null>;
  temperature_2m_min?: Array<number | null>;
  precipitation_sum?: Array<number | null>;
  wind_speed_10m_max?: Array<number | null>;
  weather_code?: Array<number | null>;
};

type OpenMeteoResponse = {
  daily?: ForecastDaily | ArchiveDaily;
};

async function fetchJson(url: string): Promise<OpenMeteoResponse | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as OpenMeteoResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function findDayIndex(json: OpenMeteoResponse, logDate: string): number {
  const times = json.daily?.time;
  if (!Array.isArray(times)) return -1;
  return times.indexOf(logDate);
}

function pick<T>(arr: Array<T | null> | undefined, idx: number): T | null {
  if (!Array.isArray(arr)) return null;
  const v = arr[idx];
  return v ?? null;
}

function roundOrNull(v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.round(v);
}

// WMO weather interpretation codes →
// docs/specs reference: https://open-meteo.com/en/docs
// Maps onto our daily_log_weather_conditions enum.
function mapWeatherCode(code: number | null): WeatherConditions {
  if (code == null) return "partly_cloudy";
  if (code === 0 || code === 1) return "clear";
  if (code === 2) return "partly_cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "overcast"; // fog → treat as overcast
  if ((code >= 51 && code <= 57) || code === 61 || code === 63 || code === 80 || code === 81) {
    return "light_rain";
  }
  if (code === 65 || code === 82 || code === 95 || code === 96 || code === 99) {
    return "heavy_rain";
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  return "partly_cloudy";
}
