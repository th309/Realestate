/**
 * Not Found Page for Invalid Beta Test Tokens
 */

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4">🔗</div>
        <h1 className="text-2xl font-semibold text-on-surface mb-2">
          Invalid or Expired Link
        </h1>
        <p className="text-on-surface-variant mb-6">
          This feedback link is no longer valid. Please contact the administrator
          for a new link if you believe this is an error.
        </p>
        <Link
          href="/"
          className="inline-flex px-6 py-3 rounded-full bg-primary text-on-primary font-medium hover:bg-primary/90 transition-colors"
        >
          Go to Homepage
        </Link>
      </div>
    </div>
  );
}
