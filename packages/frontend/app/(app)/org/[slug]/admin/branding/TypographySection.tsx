"use client";

import React from "react";
import { Type } from "lucide-react";

const SELECT_CLASS =
  "flex-1 px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

const FONT_OPTIONS = [
  "Roboto",
  "Inter",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Source Sans Pro",
  "Nunito",
  "Raleway",
  "DM Sans",
] as const;

interface TypographySectionProps {
  primaryFont: string;
  secondaryFont: string;
  onPrimaryFontChange: (value: string) => void;
  onSecondaryFontChange: (value: string) => void;
}

/**
 * Typography section — primary and secondary Google Font selection
 * for branded content.
 */
export function TypographySection({
  primaryFont,
  secondaryFont,
  onPrimaryFontChange,
  onSecondaryFontChange,
}: TypographySectionProps) {
  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Type className="w-4 h-4 text-primary" />
        <div>
          <h2 className="text-base font-medium text-on-surface tracking-wide">
            Typography
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Font selections used on branded reports and client-facing pages
          </p>
        </div>
      </div>

      {/* Primary Font */}
      <div>
        <label className="text-sm font-medium text-on-surface tracking-wide">
          Primary Font
        </label>
        <div className="flex items-center gap-2 mt-2">
          <Type className="w-4 h-4 text-on-surface-variant shrink-0" />
          <select
            value={primaryFont}
            onChange={(e) => onPrimaryFontChange(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Default (Roboto)</option>
            {FONT_OPTIONS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          Used for headings and titles
        </p>
      </div>

      {/* Secondary Font */}
      <div>
        <label className="text-sm font-medium text-on-surface tracking-wide">
          Secondary Font
        </label>
        <div className="flex items-center gap-2 mt-2">
          <Type className="w-4 h-4 text-on-surface-variant shrink-0" />
          <select
            value={secondaryFont}
            onChange={(e) => onSecondaryFontChange(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Default (Roboto)</option>
            {FONT_OPTIONS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          Used for body text and labels
        </p>
      </div>
    </div>
  );
}
