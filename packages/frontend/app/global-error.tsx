'use client';

// Minimal global error boundary to avoid prerendering issues
// See: https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-errors-in-root-layouts
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>Error</title>
      </head>
      <body style={{ margin: 0, padding: '2rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <h1>Something went wrong</h1>
        <p>An unexpected error occurred.</p>
        <button onClick={reset} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  );
}
