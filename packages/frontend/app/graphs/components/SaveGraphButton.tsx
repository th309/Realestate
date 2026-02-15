'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Bookmark, Check, ChevronDown, FileText } from 'lucide-react';
import { useEntitlements } from '@/lib/entitlements';
import type { GraphsState } from '../hooks/useGraphsState';

interface SaveGraphButtonProps {
  graphState: GraphsState;
  onSaveTemplate: () => void;
}

export function SaveGraphButton({ graphState, onSaveTemplate }: SaveGraphButtonProps) {
  const { canAccess } = useEntitlements();
  const canSave = canAccess('feature', 'graph_save');
  const [saved, setSaved] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleSave = useCallback(() => {
    if (!canSave) return;

    const existing = JSON.parse(localStorage.getItem('propertyiq-saved-graphs') || '[]');
    const entry = {
      id: String(Date.now()),
      name: `Graph - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      timestamp: new Date().toISOString(),
      state: graphState,
    };
    existing.push(entry);
    localStorage.setItem('propertyiq-saved-graphs', JSON.stringify(existing));

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [canSave, graphState]);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center">
        {/* Main save button */}
        <button
          type="button"
          onClick={handleSave}
          className={`
            flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-l-xl text-xs font-medium
            transition-all duration-150
            ${canSave
              ? 'text-on-surface-variant hover:bg-surface-container-high'
              : 'text-on-surface-variant/50 cursor-not-allowed'
            }
          `}
          title={canSave ? 'Save graph' : 'Upgrade to save graphs'}
        >
          {saved ? <Check className="w-3.5 h-3.5" style={{ color: '#16a34a' }} /> : <Bookmark className="w-3.5 h-3.5" />}
          <span>{saved ? 'Saved!' : 'Save'}</span>
        </button>

        {/* Dropdown toggle */}
        {canSave && (
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="px-1 py-1.5 rounded-r-xl text-on-surface-variant hover:bg-surface-container-high transition-all duration-150"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Dropdown menu */}
      {dropdownOpen && (
        <div className="absolute top-full right-0 mt-1 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1 z-50 min-w-[160px]">
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(false);
              onSaveTemplate();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Save as Template
          </button>
        </div>
      )}
    </div>
  );
}

export default SaveGraphButton;
