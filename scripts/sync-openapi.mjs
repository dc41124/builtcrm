// Step 60 follow-up: copy the canonical OpenAPI spec into /public so
// Next.js serves it as a static asset at /openapi.yaml. Runs as a
// prebuild step.
//
// Why a copy instead of a route handler that reads from docs/specs/:
// the Docker runtime stage uses Next's standalone output and only
// copies /public, /.next/standalone, and /.next/static — `docs/` is
// not in the runtime image. A route handler that reads docs/specs at
// request time would 500 in production. Static asset in /public is
// the simplest correct shape and matches how Next's standalone mode
// is meant to be used.
//
// Source of truth stays at docs/specs/openapi.yaml. This script is
// the only thing that should write to public/openapi.yaml.

import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(process.cwd(), "docs", "specs", "openapi.yaml");
const DST = resolve(process.cwd(), "public", "openapi.yaml");

if (!existsSync(SRC)) {
  console.error(`[sync-openapi] source not found: ${SRC}`);
  process.exit(1);
}

copyFileSync(SRC, DST);
console.log(`[sync-openapi] ${SRC} → ${DST}`);
