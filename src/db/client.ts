import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

// Neon's pooled connection benefits from a small client-side pool;
// keep `max` low for serverless/edge-friendly behavior.
const queryClient = postgres(databaseUrl, { max: 10, prepare: false });

export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
export { schema };
