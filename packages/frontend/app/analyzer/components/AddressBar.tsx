"use client";

import { useState } from "react";
import { useAddressAutocomplete } from "@/lib/analyzer/useAddressAutocomplete";
import type { AddressSuggestion } from "@/lib/analyzer/types";

interface Props {
  initial?: string;
  onSelect: (s: AddressSuggestion) => void;
}

export default function AddressBar({ initial = "", onSelect }: Props) {
  const { query, setQuery, suggestions, loading } = useAddressAutocomplete();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <input
        type="text"
        value={query || initial}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder="Search any US address…"
        className="w-full h-14 rounded-full bg-surface border border-outline px-6 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
        aria-label="Address search"
      />
      {loading && (
        <div className="absolute right-6 top-4 text-on-surface-variant text-sm">
          …
        </div>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-2 w-full bg-surface-container-low rounded-2xl shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(s);
                  setQuery(s.full);
                  setOpen(false);
                }}
                className="w-full text-left px-6 py-3 hover:bg-primary-container"
              >
                <div className="text-on-surface">{s.street}</div>
                <div className="text-on-surface-variant text-sm">
                  {s.city}, {s.state} {s.postalCode ?? ""}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
