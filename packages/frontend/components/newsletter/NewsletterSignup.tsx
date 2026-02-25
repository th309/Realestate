'use client';

import { useState } from 'react';

export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="bg-surface-container-low rounded-xl p-6 my-8">
      <h3 className="text-lg font-semibold text-on-surface mb-2">
        Weekly Market Insights
      </h3>
      <p className="text-sm text-on-surface-variant mb-4">
        Get data-driven housing market analysis delivered to your inbox every week.
      </p>

      {status === 'success' ? (
        <p className="text-emerald-600 font-medium">Thanks! You&apos;re subscribed.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="flex-1 px-4 py-2 rounded-full bg-surface border border-outline text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-6 py-2 bg-primary text-on-primary rounded-full font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
          </button>
        </form>
      )}
      {status === 'error' && (
        <p className="text-error text-sm mt-2">Something went wrong. Please try again.</p>
      )}
    </section>
  );
}
