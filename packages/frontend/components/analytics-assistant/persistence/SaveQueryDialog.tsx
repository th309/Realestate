'use client';

/**
 * Save Query Dialog
 *
 * Modal for saving a query with name and description.
 */

import React, { useState } from 'react';
import { X, Save } from 'lucide-react';

interface SaveQueryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description?: string) => Promise<void>;
  queryText: string;
}

export function SaveQueryDialog({
  isOpen,
  onClose,
  onSave,
  queryText,
}: SaveQueryDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await onSave(name.trim(), description.trim() || undefined);
      setName('');
      setDescription('');
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-on-surface">Save Query</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Query Preview */}
        <div className="mb-4 p-3 bg-surface-container rounded-lg">
          <p className="text-xs text-on-surface-variant mb-1">Query</p>
          <p className="text-sm text-on-surface line-clamp-2">{queryText}</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label
              htmlFor="query-name"
              className="block text-sm font-medium text-on-surface mb-1.5"
            >
              Name <span className="text-error">*</span>
            </label>
            <input
              id="query-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Texas metros top performers"
              className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="query-description"
              className="block text-sm font-medium text-on-surface mb-1.5"
            >
              Description <span className="text-on-surface-variant">(optional)</span>
            </label>
            <textarea
              id="query-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this query help you find?"
              rows={2}
              className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
