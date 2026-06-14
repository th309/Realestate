/**
 * Feedback Page Client Component
 * 
 * Handles the interactive feedback form and submission history display.
 */

'use client';

import { useState } from 'react';
import { FeedbackForm } from './components/FeedbackForm';
import { SubmissionHistory } from './components/SubmissionHistory';
import type { BetaFeedback } from '../types';

interface TesterInfo {
  id: string;
  name: string;
}

interface FeedbackSummary {
  id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
}

interface FeedbackPageClientProps {
  tester: TesterInfo;
  token: string;
  previousFeedback: FeedbackSummary[];
}

export function FeedbackPageClient({ 
  tester, 
  token, 
  previousFeedback: initialFeedback 
}: FeedbackPageClientProps) {
  const [feedbackList, setFeedbackList] = useState<FeedbackSummary[]>(initialFeedback);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmitSuccess = (newFeedback: BetaFeedback) => {
    setFeedbackList(prev => [{
      id: newFeedback.id,
      title: newFeedback.title,
      category: newFeedback.category,
      status: newFeedback.status,
      created_at: newFeedback.created_at,
    }, ...prev]);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 5000);
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-surface-container border-b border-outline-variant">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-on-primary font-medium text-lg">
                {tester.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-on-surface">
                Beta Feedback
              </h1>
              <p className="text-sm text-on-surface-variant">
                Hi {tester.name}! Share your thoughts and help us improve.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2">
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span className="text-green-800 font-medium">Feedback submitted successfully!</span>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Feedback Form */}
        <section>
          <div className="bg-surface-container rounded-xl border border-outline-variant p-6">
            <h2 className="text-lg font-semibold text-on-surface mb-4">
              Submit Feedback
            </h2>
            <FeedbackForm 
              testerId={tester.id} 
              token={token}
              onSuccess={handleSubmitSuccess} 
            />
          </div>
        </section>

        {/* Previous Submissions */}
        {feedbackList.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-4">
              Your Previous Submissions
            </h2>
            <SubmissionHistory feedback={feedbackList} />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-outline-variant mt-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <p className="text-xs text-on-surface-variant text-center">
            Your feedback helps us build a better product. Thank you for testing!
          </p>
        </div>
      </footer>
    </div>
  );
}
