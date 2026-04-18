// Nominatim geocoding — OpenStreetMap's free address → lat/lon service.
// Used lazily by the weather-prefill endpoint to fill projects.latitude
// and projects.longitude on first request. Non-throwing: returns null on
// failure so the daily-log create flow falls back to manual weather entry.
//
// Usage policy (https://operations.osmfoundation.org/policies/nominatim/):
// - max 1 request per second → callers are expected to be sparse
//   (geocode-once-per-project). Not wrapped in a limiter here.
// - User-Agent must identify the app. OSM reserves the right to block
//   anonymous or spoofed clients.
//
// For portfolio scope this public endpoint is fine. If traffic grows,
// self-host with the Docker image or move to a paid provider.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "BuiltCRM/0.1 (dc41124@gmail.com)";
const TIMEOUT_MS = 5000;

export type GeocodeInput = {
  addressLine1: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  country: string | null;
};

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  displayName: string;
};

export async function geocodeAddress(
  input: GeocodeInput,
): Promise<GeocodeResult | null> {
  // Skip the round-trip if the address is too thin to geocode usefully.
  const parts = [
    input.addressLine1,
    input.city,
    input.stateProvince,
    input.postalCode,
    input.country,
  ].filter((p): p is string => !!p && p.trim().length > 0);
  if (parts.length < 2) return null;
  const query = parts.join(", ");

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
    }>;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const top = rows[0];
    if (!top.lat || !top.lon) return null;
    const latitude = parseFloat(top.lat);
    const longitude = parseFloat(top.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      latitude,
      longitude,
      displayName: top.display_name ?? query,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
