"use client";

import React from "react";

interface BrandingPreviewProps {
  logoUrl: string | null;
  accentColor: string;
  orgName: string;
  websiteUrl: string | null;
}

/**
 * Live preview of a branded report header.
 * Shows the accent color border, logo/org name, and footer.
 */
export function BrandingPreview({
  logoUrl,
  accentColor,
  orgName,
  websiteUrl,
}: BrandingPreviewProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-on-surface tracking-wide">
        Preview
      </label>

      <div className="w-full max-w-[320px] rounded-xl border border-outline-variant bg-white shadow-sm overflow-hidden">
        {/* Accent color top border */}
        <div className="h-1" style={{ backgroundColor: accentColor }} />

        {/* Report header */}
        <div className="p-5">
          {/* Logo or placeholder */}
          <div className="flex items-center gap-3 mb-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${orgName} logo`}
                className="w-10 h-10 object-contain rounded"
              />
            ) : (
              <div
                className="w-10 h-10 rounded flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: accentColor }}
              >
                {orgName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">{orgName}</p>
              {websiteUrl && (
                <p className="text-xs text-gray-500 truncate max-w-[200px]">
                  {websiteUrl}
                </p>
              )}
            </div>
          </div>

          {/* Mock report content */}
          <div className="space-y-2 mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">
              Market Analysis Report
            </p>
            <div className="h-2.5 rounded-full bg-gray-100 w-full" />
            <div className="h-2.5 rounded-full bg-gray-100 w-4/5" />
            <div className="h-2.5 rounded-full bg-gray-100 w-3/5" />
          </div>

          {/* Prepared by */}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Prepared by{" "}
              <span className="font-medium text-gray-700">{orgName}</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-2.5 text-center"
          style={{ backgroundColor: `${accentColor}10` }}
        >
          <p className="text-[10px] text-gray-400">
            Powered by <span className="font-medium">PropertyIQ</span>
          </p>
        </div>
      </div>
    </div>
  );
}
