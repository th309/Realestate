"use client";

import React from "react";
import { Globe, Image } from "lucide-react";

const INPUT_CLASS_DISABLED =
  "flex-1 px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant cursor-not-allowed";

interface CustomDomainSectionProps {
  customSubdomain: string;
}

/**
 * Custom Domain section — subdomain and favicon configuration.
 * Currently disabled with "Coming Soon" badge.
 */
export function CustomDomainSection({
  customSubdomain,
}: CustomDomainSectionProps) {
  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-6 space-y-5 opacity-75">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-primary" />
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium text-on-surface tracking-wide">
            Custom Domain
          </h2>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            Coming Soon
          </span>
        </div>
      </div>

      {/* Custom Subdomain */}
      <div>
        <label className="text-sm font-medium text-on-surface-variant tracking-wide">
          Custom Subdomain
        </label>
        <div className="flex items-center gap-2 mt-2">
          <Globe className="w-4 h-4 text-on-surface-variant shrink-0" />
          <input
            type="text"
            value={customSubdomain}
            disabled
            placeholder="analytics.yourbrokerage.com"
            className={INPUT_CLASS_DISABLED}
          />
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          e.g. analytics.yourbrokerage.com — contact support to configure
        </p>
      </div>

      {/* Favicon Upload */}
      <div>
        <label className="text-sm font-medium text-on-surface-variant tracking-wide">
          Favicon
        </label>
        <div className="flex items-center gap-2 mt-2">
          <Image className="w-4 h-4 text-on-surface-variant shrink-0" />
          <div className="flex-1 px-3 py-2 text-sm rounded-lg border border-dashed border-outline-variant bg-surface-container text-on-surface-variant cursor-not-allowed">
            Favicon upload — coming soon
          </div>
        </div>
      </div>
    </div>
  );
}
