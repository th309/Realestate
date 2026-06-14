/**
 * Feedback Form Component
 * 
 * Main form for submitting beta feedback with category selection,
 * description fields, and file upload support.
 */

'use client';

import { useState, useCallback } from 'react';
import { CategorySelector } from './CategorySelector';
import { SeveritySelector } from './SeveritySelector';
import { FileDropzone } from './FileDropzone';
import type { 
  FeedbackCategory, 
  FeedbackSeverity, 
  FeedbackFormData, 
  Attachment,
  BetaFeedback 
} from '../../types';

interface FeedbackFormProps {
  testerId: string;
  token: string;
  onSuccess: (feedback: BetaFeedback) => void;
}

export function FeedbackForm({ testerId, token, onSuccess }: FeedbackFormProps) {
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [severity, setSeverity] = useState<FeedbackSeverity>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [affectedComponent, setAffectedComponent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showBugFields = category === 'bug' || category === 'performance';

  const handleFilesAdded = useCallback((newAttachments: Attachment[]) => {
    setAttachments(prev => [...prev, ...newAttachments]);
  }, []);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const resetForm = () => {
    setCategory('bug');
    setSeverity('medium');
    setTitle('');
    setDescription('');
    setStepsToReproduce('');
    setExpectedBehavior('');
    setActualBehavior('');
    setPageUrl('');
    setAffectedComponent('');
    setAttachments([]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const formData: FeedbackFormData & { 
        tester_id: string; 
        attachments: Attachment[];
        browser_info: Record<string, string>;
      } = {
        category,
        severity: showBugFields ? severity : undefined,
        title: title.trim(),
        description: description.trim(),
        steps_to_reproduce: stepsToReproduce.trim() || undefined,
        expected_behavior: expectedBehavior.trim() || undefined,
        actual_behavior: actualBehavior.trim() || undefined,
        page_url: pageUrl.trim() || undefined,
        affected_component: affectedComponent.trim() || undefined,
        tester_id: testerId,
        attachments,
        browser_info: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          screenWidth: window.screen.width.toString(),
          screenHeight: window.screen.height.toString(),
        },
      };

      const response = await fetch('/api/betatest/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tester-Token': token,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit feedback');
      }

      const result = await response.json();
      onSuccess(result.feedback);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Category Selection */}
      <div>
        <label className="block text-sm font-medium text-on-surface mb-2">
          Category
        </label>
        <CategorySelector value={category} onChange={setCategory} />
      </div>

      {/* Severity (for bugs and performance) */}
      {showBugFields && (
        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">
            Severity
          </label>
          <SeveritySelector value={severity} onChange={setSeverity} />
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-on-surface mb-2">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief summary of your feedback"
          required
          maxLength={200}
          className="w-full px-4 py-3 rounded-xl border border-outline bg-surface text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-on-surface mb-2">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue or suggestion in detail..."
          required
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-outline bg-surface text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
        />
      </div>

      {/* Bug-specific fields */}
      {showBugFields && (
        <>
          <div>
            <label htmlFor="steps" className="block text-sm font-medium text-on-surface mb-2">
              Steps to Reproduce
            </label>
            <textarea
              id="steps"
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-outline bg-surface text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="expected" className="block text-sm font-medium text-on-surface mb-2">
                Expected Behavior
              </label>
              <textarea
                id="expected"
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
                placeholder="What should happen?"
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
              />
            </div>
            <div>
              <label htmlFor="actual" className="block text-sm font-medium text-on-surface mb-2">
                Actual Behavior
              </label>
              <textarea
                id="actual"
                value={actualBehavior}
                onChange={(e) => setActualBehavior(e.target.value)}
                placeholder="What actually happens?"
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
              />
            </div>
          </div>
        </>
      )}

      {/* Context fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pageUrl" className="block text-sm font-medium text-on-surface mb-2">
            Page URL
          </label>
          <input
            id="pageUrl"
            type="text"
            value={pageUrl}
            onChange={(e) => setPageUrl(e.target.value)}
            placeholder="e.g., /map, /graphs"
            className="w-full px-4 py-3 rounded-xl border border-outline bg-surface text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div>
          <label htmlFor="component" className="block text-sm font-medium text-on-surface mb-2">
            Affected Area
          </label>
          <input
            id="component"
            type="text"
            value={affectedComponent}
            onChange={(e) => setAffectedComponent(e.target.value)}
            placeholder="e.g., Map legend, Search bar"
            className="w-full px-4 py-3 rounded-xl border border-outline bg-surface text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-on-surface mb-2">
          Attachments
        </label>
        <FileDropzone 
          token={token}
          onFilesAdded={handleFilesAdded}
          attachments={attachments}
          onRemove={handleRemoveAttachment}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || !title.trim() || !description.trim()}
          className="px-6 py-3 rounded-full bg-primary text-on-primary font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </div>
    </form>
  );
}
