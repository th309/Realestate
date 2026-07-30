import * as Sentry from "@sentry/nextjs";
import { hasOptedOutOfTracking } from "@/lib/analytics/privacy-signals";

// Session Replay records the DOM, so it is session recording in the sense the
// Privacy Policy uses the term, and the policy commits to letting Global
// Privacy Control and Do Not Track limit it. Omitting the integration entirely
// is the only reliable suppression: starting the recorder and stopping it later
// still captures the opening frames.
//
// Error and performance monitoring stay on regardless. Those are operational
// telemetry about our own software rather than behavioural tracking of a
// person, and the policy does not offer to disable them.
const replayIntegrations = hasOptedOutOfTracking()
  ? []
  : [
      Sentry.replayIntegration({
        // Mask all text and block all media to protect user privacy.
        maskAllText: true,
        blockAllMedia: true,
      }),
    ];

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Capture 10% of transactions for performance monitoring in production,
  // 100% in development for easier debugging.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Replay 1% of sessions, 100% of sessions with errors. Both are inert when
  // the integration is omitted above for a visitor who opted out.
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: replayIntegrations,

  // Suppress noisy errors from browser extensions and third-party scripts.
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
    /^Loading chunk \d+ failed/,
  ],
});
