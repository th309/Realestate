/**
 * AnnotationPopover
 *
 * Compact popover form for creating timeline annotations.
 * Appears as a dropdown when the "Add annotation" icon button is clicked.
 * Uses M3 surface styling with rounded-xl card.
 */

"use client";

import { useState, useRef, useEffect } from "react";

interface AnnotationPopoverProps {
  onSave: (date: string, label: string, description?: string) => Promise<void>;
}

export function AnnotationPopover({ onSave }: AnnotationPopoverProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSubmit = async () => {
    if (!label.trim()) return;
    setSaving(true);
    try {
      await onSave(date, label.trim(), description.trim() || undefined);
      setLabel("");
      setDescription("");
      setDate(new Date().toISOString().slice(0, 10));
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        title="Add annotation"
        className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>

      {/* Popover dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-surface-container-high border border-outline-variant rounded-xl shadow-lg p-4 space-y-3">
          <p className="text-sm font-medium text-on-surface">Add Annotation</p>

          {/* Date */}
          <label className="block">
            <span className="text-xs font-medium text-on-surface-variant">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded-lg text-sm border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary"
            />
          </label>

          {/* Label */}
          <label className="block">
            <span className="text-xs font-medium text-on-surface-variant">
              Label <span className="text-error">*</span>
            </span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Feature launch"
              maxLength={100}
              className="mt-1 w-full px-2 py-1.5 rounded-lg text-sm border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary placeholder:text-on-surface-variant/50"
            />
          </label>

          {/* Description */}
          <label className="block">
            <span className="text-xs font-medium text-on-surface-variant">
              Description (optional)
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1 w-full px-2 py-1.5 rounded-lg text-sm border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary resize-none placeholder:text-on-surface-variant/50"
              placeholder="Additional context..."
            />
          </label>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={!label.trim() || saving}
              className="px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {saving && (
                <svg
                  className="animate-spin h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="opacity-25"
                  />
                  <path
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    fill="currentColor"
                    className="opacity-75"
                  />
                </svg>
              )}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
