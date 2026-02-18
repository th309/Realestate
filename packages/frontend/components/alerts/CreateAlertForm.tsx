'use client';

import React, { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/tracker';

interface CreateAlertFormProps {
  metricId: string;
  metricName: string;
  currentValue: number;
  geographyType: string;
  geographyId: string;
  geographyName: string;
  onSubmit: (data: { metric_id: string; condition: string; threshold: number; geography_type: string; geography_id: string; geography_name: string }) => Promise<boolean>;
  onClose: () => void;
  className?: string;
}

export function CreateAlertForm({
  metricId,
  metricName,
  currentValue,
  geographyType,
  geographyId,
  geographyName,
  onSubmit,
  onClose,
  className = '',
}: CreateAlertFormProps) {
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [threshold, setThreshold] = useState(currentValue.toString());
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(threshold);
    if (isNaN(num)) return;

    setSubmitting(true);
    const success = await onSubmit({
      metric_id: metricId,
      condition,
      threshold: num,
      geography_type: geographyType,
      geography_id: geographyId,
      geography_name: geographyName,
    });
    if (success) {
      trackEvent('feature.alert_create', { metricId, condition });
    }
    setSubmitting(false);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className={`bg-surface-container rounded-xl border border-outline-variant p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold text-on-surface">Set Alert</h4>
        </div>
        <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container-high">
          <X className="w-4 h-4 text-on-surface-variant" />
        </button>
      </div>

      <p className="text-xs text-on-surface-variant mb-3">
        Alert when <span className="font-medium text-on-surface">{metricName}</span> in {geographyName}:
      </p>

      <div className="flex items-center gap-2 mb-3">
        <select
          value={condition}
          onChange={e => setCondition(e.target.value as 'above' | 'below')}
          className="px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface"
        >
          <option value="above">Goes above</option>
          <option value="below">Goes below</option>
        </select>
        <input
          type="number"
          value={threshold}
          onChange={e => setThreshold(e.target.value)}
          step="any"
          className="flex-1 px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface"
          placeholder="Threshold"
        />
      </div>

      <p className="text-[10px] text-on-surface-variant mb-3">Current value: {currentValue}</p>

      <button
        type="submit"
        disabled={submitting}
        className="w-full px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {submitting ? 'Creating...' : 'Create Alert'}
      </button>
    </form>
  );
}
