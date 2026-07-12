"use client";

/**
 * Branded offline fallback page.
 *
 * Served by the Serwist service worker (see app/sw.ts `fallbacks.entries`)
 * for any navigation request that fails while the device is offline. It must
 * render entirely from the precache — no data fetching, no server-only APIs.
 */
export default function OfflinePage() {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16 bg-surface">
      <div className="w-full max-w-sm rounded-xl bg-surface-container-low shadow-sm p-8 text-center">
        <svg
          width="56"
          height="56"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto shrink-0"
          aria-hidden="true"
        >
          <rect width="64" height="64" rx="14" fill="#3949AB" />
          <path
            d="M20 16V48H26V38H34C40.627 38 46 32.627 46 26C46 19.373 40.627 16 34 16H20Z"
            fill="white"
          />
          <circle cx="34" cy="26" r="6" fill="#3949AB" />
          <circle cx="44" cy="44" r="4" fill="#00C853" />
          <circle cx="36" cy="48" r="2.5" fill="#00C853" opacity="0.6" />
        </svg>

        <h1 className="mt-6 text-xl font-bold text-on-surface">
          You&apos;re offline
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Your markets will be right here when you&apos;re back.
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-on-primary shadow-sm transition-colors duration-200 hover:bg-primary/90 active:scale-95"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
