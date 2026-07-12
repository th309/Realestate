/**
 * Serwist service worker entry (InjectManifest `swSrc`, see next.config.mjs).
 *
 * Precaches the Next.js build output (`self.__SW_MANIFEST`, injected at build
 * time) plus Serwist's Next-aware runtime caching (`defaultCache`), and falls
 * back to the branded `/offline` page for navigation requests that fail
 * while offline.
 *
 * IMPORTANT: `skipWaiting` is intentionally NOT set — a new worker must stay
 * in the "waiting" state until the user opts in via the update toast (see
 * lib/pwa/register-service-worker.ts + app/components/pwa/ServiceWorkerManager.tsx).
 * It only skips waiting in response to an explicit `{ type: "SKIP_WAITING" }`
 * message, which this file listens for below.
 *
 * Type-checked separately from the main app under tsconfig.worker.json (this
 * file needs the "webworker" lib, which conflicts with the app's "dom" lib);
 * see tsconfig.json's `exclude` entry for app/sw.ts.
 */
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  clientsClaim: true,
  navigationPreload: true,
  // Next.js-aware runtime caching (RSC payloads, static assets, images,
  // fonts, etc.). Do NOT add /backend API caching here — that policy is
  // owned by a later task.
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

serwist.addEventListeners();
