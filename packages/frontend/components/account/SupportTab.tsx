'use client';

import React, { useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { submitSupportTicket } from '@/lib/data';
import type { SupportTicket } from '@/lib/data';
import type { User } from '@supabase/supabase-js';

// --- Issue type options -------------------------------------------------------

const ISSUE_TYPES: { value: SupportTicket['issue_type']; label: string }[] = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'billing', label: 'Billing Question' },
  { value: 'general', label: 'General Question' },
];

// --- Main component -----------------------------------------------------------

interface SupportTabProps {
  user: User;
}

export function SupportTab({ user }: SupportTabProps) {
  const [issueType, setIssueType] = useState<SupportTicket['issue_type'] | ''>('');
  const [description, setDescription] = useState('');
  const [emailOverride, setEmailOverride] = useState(user.email || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const isValid = issueType !== '' && description.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !issueType) return;

    setSubmitting(true);
    setError(null);

    try {
      await submitSupportTicket({
        issue_type: issueType,
        description: description.trim(),
        email_override: emailOverride || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit support ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setIssueType('');
    setDescription('');
    setEmailOverride(user.email || '');
    setSubmitted(false);
    setError(null);
  };

  if (submitted) {
    return (
      <div className="py-8">
        <div className="max-w-md mx-auto text-center py-12">
          <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-on-surface mb-2">
            Thanks for reaching out!
          </h3>
          <p className="text-sm text-on-surface-variant mb-6">
            We&apos;ll get back to you within 1-2 business days.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <h3 className="text-sm font-semibold text-on-surface mb-4">Contact Support</h3>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-error/10 text-error text-sm">{error}</div>
        )}

        {/* Issue type */}
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
            Issue Type
          </label>
          <select
            value={issueType}
            onChange={(e) => setIssueType(e.target.value as SupportTicket['issue_type'])}
            className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            required
          >
            <option value="" disabled>
              Select an issue type...
            </option>
            {ISSUE_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y min-h-[120px]"
            placeholder="Describe your issue or question..."
            required
            minLength={10}
            rows={5}
          />
          {description.length > 0 && description.trim().length < 10 && (
            <p className="mt-1 text-xs text-error">
              Please provide at least 10 characters
            </p>
          )}
        </div>

        {/* Email override */}
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
            Reply-to Email
          </label>
          <input
            type="email"
            value={emailOverride}
            onChange={(e) => setEmailOverride(e.target.value)}
            className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            placeholder="your@email.com"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!isValid || submitting}
          className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </div>
  );
}
