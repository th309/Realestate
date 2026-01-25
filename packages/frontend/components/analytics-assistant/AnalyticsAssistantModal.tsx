'use client';

/**
 * Analytics Assistant Modal
 *
 * Wraps the panel in a modal for use anywhere in the app.
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { AnalyticsAssistantPanel } from './AnalyticsAssistantPanel';
import { AnalyticsAssistantProps } from './types';

interface ModalProps extends AnalyticsAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AnalyticsAssistantModal({
  isOpen,
  onClose,
  ...panelProps
}: ModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-scrim/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg h-[80vh] max-h-[700px] bg-surface rounded-3xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Panel content */}
        <AnalyticsAssistantPanel {...panelProps} onClose={onClose} />
      </div>
    </div>
  );
}
