import type { SocialConnectSetup } from "@/lib/data";

/**
 * Shown at the top of the wall when the backend has no LATE_API_KEY. This is an
 * invitation to act, not an error — it lists exactly what Troy must do to switch
 * one-click connect on. Steps come from the backend so the copy stays in one
 * place.
 */
export function LateNotConfiguredBanner({
  setup,
}: {
  setup?: SocialConnectSetup;
}) {
  const steps = setup?.steps ?? [
    "Create a Late account at getlate.dev",
    "Generate an API key in the Late dashboard",
    "Add LATE_API_KEY to the backend service environment (Railway)",
    "Redeploy the backend, then reload this page",
  ];

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container p-5">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container"
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-on-surface">
            One-click connect isn&apos;t switched on yet
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Connecting a network runs through Late, which hosts the login screen
            for each platform — no Meta or TikTok developer app to register. Add
            your Late API key to the backend and this wall goes live.
          </p>
          <ol className="mt-3 space-y-1.5">
            {steps.map((step, i) => (
              <li
                key={step}
                className="flex items-start gap-2.5 text-sm text-on-surface"
              >
                <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-container font-mono text-[11px] font-semibold text-on-primary-container">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
