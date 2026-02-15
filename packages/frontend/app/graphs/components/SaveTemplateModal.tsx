'use client';

import React, { useState } from 'react';
import type { GraphTemplate } from '../constants/templates';
import type { GraphsState } from '../hooks/useGraphsState';

const STORAGE_KEY = 'propertyiq-user-templates';

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentState: GraphsState;
}

export function SaveTemplateModal({ isOpen, onClose, currentState }: SaveTemplateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) return;

    // Strip market data from the config
    const config: Partial<GraphsState> = { ...currentState };
    config.markets = [];
    config.primaryMarket = null;
    config.comparisonMarket = null;

    const template: GraphTemplate = {
      id: String(Date.now()),
      name: name.trim(),
      description: description.trim(),
      category: 'user',
      config,
    };

    // Load existing user templates and append
    let existing: GraphTemplate[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) existing = parsed;
      }
    } catch {
      // ignore parse errors
    }

    existing.push(template);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

    // Dispatch storage event so TemplatePicker can pick up the change
    window.dispatchEvent(new Event('storage'));

    // Reset and close
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-3xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-on-surface mb-4">Save as Template</h2>

        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Template name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-outline-variant rounded-xl px-3 py-2 text-sm bg-surface-container text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary transition-colors"
            autoFocus
          />

          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="border border-outline-variant rounded-xl px-3 py-2 text-sm bg-surface-container text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary transition-colors resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={() => {
              setName('');
              setDescription('');
              onClose();
            }}
            className="text-on-surface-variant text-sm px-4 py-2 rounded-xl hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="bg-primary text-on-primary rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default SaveTemplateModal;
