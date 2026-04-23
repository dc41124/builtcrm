import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  // Loaded by Next.js at runtime; for drizzle-kit invocation, ensure .env.local is sourced
  // (e.g. via `dotenv -e .env.local -- drizzle-kit ...`) or export DATABASE_URL in your shell.
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // drizzle-kit runs DDL (generate/migrate/push); needs admin role.
    // Fallback to DATABASE_URL covers environments still on single-role.
    url: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
