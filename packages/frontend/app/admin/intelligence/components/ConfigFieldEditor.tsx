/**
 * ConfigFieldEditor
 *
 * Renders the appropriate input control for a single app_config entry
 * based on its field_type: toggle, text, password, select, or number.
 * Supports auto-save on toggle change and on blur/Enter for text inputs.
 */

'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Check } from 'lucide-react';
import { useDebouncedCommit } from '../hooks/useDebouncedCommit';
import type { ConfigEntry } from '../hooks/useIntelligenceConfig';

interface ConfigFieldEditorProps {
  entry: ConfigEntry;
  onSave: (key: string, value: string) => Promise<void>;
  isSaved: boolean;
}

export function ConfigFieldEditor({ entry, onSave, isSaved }: ConfigFieldEditorProps) {
  const fieldType = entry.field_type ?? 'text';

  return (
    <div className="flex items-center justify-between py-3 gap-4">
      {/* Label + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-on-surface">
            {formatLabel(entry.key)}
          </span>
          {isSaved && (
            <span className="flex items-center gap-0.5 text-xs text-green-600 animate-in fade-in duration-200">
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
        </div>
        {entry.description && (
          <p className="text-xs text-on-surface-variant mt-0.5 truncate">
            {entry.description}
          </p>
        )}
      </div>

      {/* Input control */}
      <div className="shrink-0">
        <FieldInput fieldType={fieldType} entry={entry} onSave={onSave} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field type router
// ---------------------------------------------------------------------------

function FieldInput({
  fieldType,
  entry,
  onSave,
}: {
  fieldType: string;
  entry: ConfigEntry;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  switch (fieldType) {
    case 'toggle':
      return <ToggleField entry={entry} onSave={onSave} />;
    case 'password':
      return <PasswordField entry={entry} onSave={onSave} />;
    case 'select':
      return <SelectField entry={entry} onSave={onSave} />;
    case 'number':
      return <DebouncedInput type="number" entry={entry} onSave={onSave} extraClassName="font-mono" />;
    default:
      return <DebouncedInput type="text" entry={entry} onSave={onSave} />;
  }
}

/** Formats a config key like "BRIEFING_GENERATION_ENABLED" into "Briefing Generation" */
function formatLabel(key: string): string {
  return key
    .replace(/_ENABLED$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bApi\b/g, 'API')
    .replace(/\bUrl\b/g, 'URL')
    .replace(/\bLlm\b/g, 'LLM');
}

// ---------------------------------------------------------------------------
// Shared text input class
// ---------------------------------------------------------------------------

const INPUT_CLASS = `
  w-64 px-3 py-1.5 text-sm rounded-lg
  bg-surface-container border border-outline-variant
  text-on-surface placeholder:text-on-surface-variant
  focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
`;

// ---------------------------------------------------------------------------
// Toggle (boolean)
// ---------------------------------------------------------------------------

function ToggleField({
  entry,
  onSave,
}: {
  entry: ConfigEntry;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  const isOn = entry.value === 'true' || entry.value === '1';
  const [saving, setSaving] = useState(false);

  async function handleToggle(): Promise<void> {
    setSaving(true);
    try {
      await onSave(entry.key, isOn ? 'false' : 'true');
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      disabled={saving}
      onClick={handleToggle}
      className={`
        relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full
        border-2 border-transparent transition-colors duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
        disabled:opacity-50 disabled:cursor-not-allowed
        ${isOn ? 'bg-primary' : 'bg-outline'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-sm
          transform transition-transform duration-200
          ${isOn ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Debounced text/number input (shared between text and number fields)
// ---------------------------------------------------------------------------

function DebouncedInput({
  type,
  entry,
  onSave,
  extraClassName = '',
}: {
  type: 'text' | 'number';
  entry: ConfigEntry;
  onSave: (key: string, value: string) => Promise<void>;
  extraClassName?: string;
}) {
  const { localValue, handleChange, handleBlur, handleKeyDown } = useDebouncedCommit({
    entryKey: entry.key,
    entryValue: entry.value,
    onSave,
  });

  return (
    <input
      type={type}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`${INPUT_CLASS} ${extraClassName}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Password input (masked with show/hide toggle)
// ---------------------------------------------------------------------------

function PasswordField({
  entry,
  onSave,
}: {
  entry: ConfigEntry;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  const [visible, setVisible] = useState(false);
  const { localValue, handleChange, handleBlur, handleKeyDown } = useDebouncedCommit({
    entryKey: entry.key,
    entryValue: entry.value,
    onSave,
  });

  return (
    <div className="relative w-64">
      <input
        type={visible ? 'text' : 'password'}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${INPUT_CLASS} pr-10 font-mono`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface"
        aria-label={visible ? 'Hide value' : 'Show value'}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Select dropdown
// ---------------------------------------------------------------------------

function SelectField({
  entry,
  onSave,
}: {
  entry: ConfigEntry;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  const options: string[] = Array.isArray(entry.field_options?.options)
    ? (entry.field_options.options as string[])
    : [];

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    onSave(entry.key, e.target.value);
  }

  return (
    <select
      value={entry.value}
      onChange={handleChange}
      className={INPUT_CLASS}
    >
      {options.length > 0 ? (
        options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))
      ) : (
        <option value={entry.value}>{entry.value}</option>
      )}
    </select>
  );
}
