/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Service worker entry — compiled by @serwist/next at build time and emitted
// to /sw.js in the public output. Step 50.
//
// Strategy (per docs/specs/phase_4plus_build_guide.md Step 50, Decision 2):
// - App shell (HTML/JS/CSS): cache-first with network fallback (Serwist's
//   defaultCache handles this).
// - API calls (/api/*): network-first with 60s fallback. Caches are flushed
//   on sign-out (see AppShell signout button) so the next user on the same
//   device can't see the prior user's cached responses.
// - Documents/photos: cache-on-demand handled at fetch time by the runtime
//   cache below. Bounded so we don't unbounded-grow the device cache.
//
// The triple-slash refs above swap the DOM lib (default) for the WebWorker
// lib so types like `ServiceWorkerGlobalScope` and `FetchEvent` resolve.

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // API: NetworkFirst with a short TTL. NetworkFirst tries the network
    // first; on failure (offline) or timeout, falls back to the cache. The
    // 60s expiration limits how stale a fallback can be.
    {
      matcher: ({ url, request }) =>
        url.pathname.startsWith("/api/") && request.method === "GET",
      handler: new NetworkFirst({
        cacheName: "builtcrm-api",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 }),
        ],
      }),
    },
    // Documents/photos served via R2 presigned URLs (bucket is on
    // *.r2.cloudflarestorage.com). Cache-on-demand with a bounded LRU so
    // a user viewing a hundred drawings doesn't exhaust device storage.
    {
      matcher: ({ url, request }) =>
        url.hostname.endsWith(".r2.cloudflarestorage.com") &&
        request.method === "GET",
      handler: new CacheFirst({
        cacheName: "builtcrm-r2-blobs",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 7,
          }),
        ],
      }),
    },
    // Everything else (app shell, static assets, fonts, …) — Serwist's
    // tuned defaults.
    ...defaultCache,
  ],
});

serwist.addEventListeners();
