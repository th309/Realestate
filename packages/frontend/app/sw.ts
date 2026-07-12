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
import { NetworkOnly, Serwist } from "serwist";
import type {
  PrecacheEntry,
  RuntimeCaching,
  SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Phase-4 handoff point: `/backend/*` is this app's same-origin API proxy
// (app/backend/[[...path]]/route.ts). defaultCache's same-origin "others"
// NetworkFirst catch-all would otherwise cache its GETs — its own `/api/`
// guard is a different prefix and doesn't cover this proxy. Force
// NetworkOnly here (byte-identical to having no service worker at all) until
// a later task defines the real caching policy for it (SWR allowlist,
// sign-out purge — see tasks/todo.md Phase 4). MUST stay before `defaultCache`
// in the array below: Serwist checks runtimeCaching rules in order and uses
// the first match.
const backendNetworkOnly: RuntimeCaching = {
  matcher: ({ url, sameOrigin }) =>
    sameOrigin && url.pathname.startsWith("/backend/"),
  method: "GET",
  handler: new NetworkOnly(),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [backendNetworkOnly, ...defaultCache],
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
