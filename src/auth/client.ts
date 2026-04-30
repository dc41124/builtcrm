"use client";

import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  twoFactorClient,
} from "better-auth/client/plugins";
import type { Auth } from "./config";

export const authClient = createAuthClient({
  // Prefer the actual page origin in the browser. NEXT_PUBLIC_* vars are
  // baked into the client bundle at build time, so a build-time dummy
  // (or a stale value from a different deploy) would otherwise pin every
  // auth fetch to the wrong host. SSR falls back to the env var.
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  plugins: [inferAdditionalFields<Auth>(), twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
