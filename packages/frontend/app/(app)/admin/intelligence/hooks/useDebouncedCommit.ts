/**
 * useDebouncedCommit Hook
 *
 * Manages local input state with debounced auto-save on change,
 * immediate commit on blur and Enter key, and cleanup on unmount.
 * Used by text, password, and number config field editors.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

const DEBOUNCE_DELAY_MS = 800;

interface UseDebouncedCommitOptions {
  /** The current persisted value from the config entry. */
  entryKey: string;
  entryValue: string;
  /** Callback to persist the value. Only called when the value has changed. */
  onSave: (key: string, value: string) => Promise<void>;
}

interface UseDebouncedCommitReturn {
  localValue: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

export function useDebouncedCommit({
  entryKey,
  entryValue,
  onSave,
}: UseDebouncedCommitOptions): UseDebouncedCommitReturn {
  const [localValue, setLocalValue] = useState(entryValue);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync local state when the persisted value changes externally
  useEffect(() => {
    setLocalValue(entryValue);
  }, [entryValue]);

  const commitValue = useCallback(
    (value: string) => {
      if (value !== entryValue) {
        onSave(entryKey, value);
      }
    },
    [entryKey, entryValue, onSave],
  );

  const clearPendingDebounce = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      clearPendingDebounce();
      debounceTimer.current = setTimeout(() => commitValue(newValue), DEBOUNCE_DELAY_MS);
    },
    [commitValue, clearPendingDebounce],
  );

  const handleBlur = useCallback(() => {
    clearPendingDebounce();
    commitValue(localValue);
  }, [localValue, commitValue, clearPendingDebounce]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        clearPendingDebounce();
        commitValue(localValue);
      }
    },
    [localValue, commitValue, clearPendingDebounce],
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => clearPendingDebounce();
  }, [clearPendingDebounce]);

  return { localValue, handleChange, handleBlur, handleKeyDown };
}
