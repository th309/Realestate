"use client";

import { useState, useRef, useEffect } from "react";
import { useAddressAutocomplete } from "@/lib/analyzer/useAddressAutocomplete";
import type { AddressSuggestion } from "@/lib/analyzer/types";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
}

/**
 * Street-address autocomplete for the Deal Analyzer. Styled to match the map's
 * SearchWidget but resolves ADDRESSES (not markets) via Mapbox, keeping the
 * analyzer strictly property-entry.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Enter a property address",
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const { setQuery, suggestions, loading } = useAddressAutocomplete();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        aria-label="Address search"
        data-address-input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full h-12 rounded-full border border-outline bg-surface px-4 text-sm text-on-surface focus:border-primary focus:outline-none"
      />
      {open && (loading || suggestions.length > 0) && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-lg">
          {loading && suggestions.length === 0 && (
            <li className="px-4 py-2 text-sm text-on-surface-variant">
              Searching…
            </li>
          )}
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(s.full);
                  onSelect(s);
                  setOpen(false);
                }}
                className="block w-full px-4 py-2 text-left text-sm text-on-surface hover:bg-primary-container"
              >
                {`${s.street}, ${s.city}, ${s.state}`}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
