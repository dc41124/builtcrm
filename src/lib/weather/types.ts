// Shared type for the weather-conditions enum, kept separate from the
// Open-Meteo fetcher so loaders / actions / the prefill endpoint can
// import the string union without pulling the fetch library.

export type WeatherConditions =
  | "clear"
  | "partly_cloudy"
  | "overcast"
  | "light_rain"
  | "heavy_rain"
  | "snow";

export const WEATHER_CONDITIONS: readonly WeatherConditions[] = [
  "clear",
  "partly_cloudy",
  "overcast",
  "light_rain",
  "heavy_rain",
  "snow",
] as const;
