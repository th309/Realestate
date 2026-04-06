import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// This file must be imported before any other modules in main.ts so that Sentry
// can instrument the Node.js runtime before NestJS loads its dependency tree.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',

  integrations: [nodeProfilingIntegration()],

  // Capture 10% of transactions for performance monitoring in production.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});
