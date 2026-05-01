import { promises as fs } from "node:fs";
import path from "node:path";

// Step 60 — public OpenAPI spec served verbatim from docs/specs/openapi.yaml.
//
// Single source of truth: the YAML file is the spec; this route just reads
// it from disk so we don't duplicate it into /public. The /api-docs page
// links here for the "Download OpenAPI" button and tools (Postman, Insomnia,
// `openapi-generator`) can fetch this URL directly.
//
// No auth — the spec is intentionally public so reviewers and partners can
// see the API surface without an account.

export const dynamic = "force-static";
export const revalidate = false;

const SPEC_PATH = path.join(process.cwd(), "docs", "specs", "openapi.yaml");

export async function GET() {
  const yaml = await fs.readFile(SPEC_PATH, "utf8");
  return new Response(yaml, {
    headers: {
      "Content-Type": "application/yaml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
