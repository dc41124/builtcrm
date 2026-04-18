import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { isIsoDate } from "@/lib/daily-logs/date-utils";
import { geocodeAddress } from "@/lib/geocoding/nominatim";
import { fetchDailyWeather } from "@/lib/weather/open-meteo";

// GET /api/daily-logs/weather-prefill?projectId=<uuid>&date=YYYY-MM-DD
//
// Looks up or lazily populates the project's lat/lon, then fetches the
// daily weather from Open-Meteo. Returns a shape the create form can
// drop straight onto its weather fields. Non-authoritative: the form
// still lets the contractor override any value and flip the source
// back to 'manual' with the edit.
//
// Authorization: only contractors — this endpoint is only called from
// the GC-side create/edit drawer. Clients and subs never need it.

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const date = url.searchParams.get("date");
  if (!projectId || !date || !isIsoDate(date)) {
    return NextResponse.json(
      {
        error: "invalid_query",
        message: "projectId (uuid) and date (YYYY-MM-DD) are required",
      },
      { status: 400 },
    );
  }

  try {
    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can prefill weather",
        "forbidden",
      );
    }

    // Load the project row including lat/lon and address. If lat/lon is
    // missing, geocode and write back so subsequent calls skip this step.
    const [row] = await db
      .select({
        id: projects.id,
        latitude: projects.latitude,
        longitude: projects.longitude,
        timezone: projects.timezone,
        addressLine1: projects.addressLine1,
        city: projects.city,
        stateProvince: projects.stateProvince,
        postalCode: projects.postalCode,
        country: projects.country,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    let latitude = row.latitude != null ? parseFloat(row.latitude) : null;
    let longitude = row.longitude != null ? parseFloat(row.longitude) : null;

    if (latitude == null || longitude == null) {
      const geocoded = await geocodeAddress({
        addressLine1: row.addressLine1,
        city: row.city,
        stateProvince: row.stateProvince,
        postalCode: row.postalCode,
        country: row.country,
      });
      if (!geocoded) {
        return NextResponse.json(
          {
            error: "geocode_failed",
            message:
              "Could not resolve project address to coordinates. Enter weather manually.",
          },
          { status: 422 },
        );
      }
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      await db
        .update(projects)
        .set({
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          geocodedAt: new Date(),
        })
        .where(eq(projects.id, projectId));
    }

    const weather = await fetchDailyWeather({
      latitude,
      longitude,
      logDate: date,
      timezone: row.timezone,
    });
    if (!weather) {
      return NextResponse.json(
        {
          error: "weather_unavailable",
          message:
            "Weather service returned no data for that date. Enter manually.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      date,
      projectId,
      weather: {
        conditions: weather.conditions,
        highC: weather.highC,
        lowC: weather.lowC,
        precipPct: weather.precipPct,
        windKmh: weather.windKmh,
        source: "api" as const,
        capturedAt: new Date().toISOString(),
        provider: weather.source,
      },
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    throw err;
  }
}
