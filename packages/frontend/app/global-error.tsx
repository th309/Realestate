'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6750a4',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
