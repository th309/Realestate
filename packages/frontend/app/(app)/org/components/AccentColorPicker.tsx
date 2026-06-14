"use client";

import React, { useState, useCallback } from "react";
import { Check } from "lucide-react";

/** Preset palette — all pass WCAG AA against white. */
const PRESET_COLORS = [
  { hex: "#2563eb", label: "Blue" },
  { hex: "#3949AB", label: "Indigo" },
  { hex: "#4f46e5", label: "Indigo" },
  { hex: "#059669", label: "Emerald" },
  { hex: "#0891b2", label: "Cyan" },
  { hex: "#dc2626", label: "Red" },
  { hex: "#ea580c", label: "Orange" },
  { hex: "#be185d", label: "Pink" },
] as const;

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

interface AccentColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

/**
 * Accent color picker with a preset palette and custom hex input.
 * All preset colors pass WCAG AA contrast against white text.
 */
export function AccentColorPicker({ value, onChange }: AccentColorPickerProps) {
  const [customHex, setCustomHex] = useState("");
  const [hexError, setHexError] = useState(false);

  const isPreset = PRESET_COLORS.some((c) => c.hex === value);

  const handleCustomHexChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value;
      // Auto-prepend # if missing
      if (raw.length > 0 && !raw.startsWith("#")) {
        raw = `#${raw}`;
      }
      setCustomHex(raw);

      if (HEX_PATTERN.test(raw)) {
        setHexError(false);
        onChange(raw.toLowerCase());
      } else {
        setHexError(raw.length > 0 && raw.length >= 4);
      }
    },
    [onChange],
  );

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-on-surface tracking-wide">
        Accent Color
      </label>

      {/* Preset grid */}
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color) => {
          const isActive = value === color.hex;
          return (
            <button
              key={color.hex}
              onClick={() => {
                onChange(color.hex);
                setCustomHex("");
                setHexError(false);
              }}
              className={`
                relative w-10 h-10 rounded-full border-2 transition-all
                ${
                  isActive
                    ? "border-on-surface scale-110 shadow-md"
                    : "border-transparent hover:scale-105"
                }
              `}
              style={{ backgroundColor: color.hex }}
              aria-label={`${color.label} accent color`}
              title={`${color.label} (${color.hex})`}
            >
              {isActive && (
                <Check className="absolute inset-0 m-auto w-5 h-5 text-white" />
              )}
            </button>
          );
        })}
      </div>

      {/* Custom hex input */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full border border-outline-variant shrink-0"
          style={{
            backgroundColor:
              !isPreset && HEX_PATTERN.test(value) ? value : "#e5e7eb",
          }}
          aria-hidden
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customHex || (!isPreset ? value : "")}
              onChange={handleCustomHexChange}
              placeholder="#RRGGBB"
              maxLength={7}
              className={`
                w-32 px-3 py-2 text-sm rounded-lg border bg-surface text-on-surface placeholder:text-on-surface-variant/50
                ${hexError ? "border-red-400" : "border-outline-variant"}
                focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
              `}
              aria-label="Custom hex color"
            />
            <span className="text-xs text-on-surface-variant">Custom</span>
          </div>
          {hexError && (
            <p className="text-xs text-red-600 mt-1">
              Enter a valid hex color (e.g. #2563eb)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
