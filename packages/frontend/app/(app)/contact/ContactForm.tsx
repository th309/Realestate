'use client';

import { useState, type FormEvent } from 'react';
import { submitContactForm } from '@/lib/data';

const ISSUE_TYPES = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'billing', label: 'Billing' },
  { value: 'refund', label: 'Refund Request' },
] as const;

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [issueType, setIssueType] = useState('general');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const isValid =
    name.trim() !== '' &&
    EMAIL_REGEX.test(email) &&
    message.trim() !== '';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid || status === 'submitting') return;

    setStatus('submitting');
    setErrorMessage('');

    try {
      await submitContactForm({
        name: name.trim(),
        email: email.trim(),
        issue_type: issueType,
        description: message.trim(),
      });
      setStatus('success');
      setName('');
      setEmail('');
      setIssueType('general');
      setMessage('');
    } catch {
      setStatus('error');
      setErrorMessage(
        'Something went wrong. Please try again or email us directly at info@propertyiq.app.',
      );
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-xl bg-surface-container-low p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-medium text-on-surface mb-2">Message Sent</h3>
        <p className="text-on-surface-variant mb-6">
          Thank you for reaching out. We&apos;ll get back to you shortly.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors duration-200"
        >
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {status === 'error' && (
        <div className="rounded-xl bg-error-container p-4 text-on-error-container text-sm">
          {errorMessage}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Name */}
        <div>
          <label htmlFor="contact-name" className="block text-sm font-medium text-on-surface-variant mb-1.5">
            Name
          </label>
          <input
            id="contact-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-outline bg-surface px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors duration-200"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="contact-email" className="block text-sm font-medium text-on-surface-variant mb-1.5">
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-outline bg-surface px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors duration-200"
          />
        </div>
      </div>

      {/* Issue Type */}
      <div>
        <label htmlFor="contact-issue-type" className="block text-sm font-medium text-on-surface-variant mb-1.5">
          Issue Type
        </label>
        <select
          id="contact-issue-type"
          value={issueType}
          onChange={(e) => setIssueType(e.target.value)}
          className="w-full rounded-xl border border-outline bg-surface px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors duration-200"
        >
          {ISSUE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-on-surface-variant mb-1.5">
          Message
        </label>
        <textarea
          id="contact-message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we help?"
          className="w-full rounded-xl border border-outline bg-surface px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors duration-200 resize-y"
        />
      </div>

      <button
        type="submit"
        disabled={!isValid || status === 'submitting'}
        className="rounded-full bg-primary px-8 py-3 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
      >
        {status === 'submitting' ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Sending...
          </span>
        ) : (
          'Send Message'
        )}
      </button>
    </form>
  );
}
