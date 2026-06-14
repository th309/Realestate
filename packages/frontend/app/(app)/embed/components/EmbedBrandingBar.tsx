import React from "react";

export interface EmbedBrandingBarProps {
  branding: {
    logo_url: string | null;
    accent_color: string;
    org_name: string;
  } | null;
}

/**
 * EmbedBrandingBar — 40px branded header bar for all embed widgets.
 *
 * Shows the organization logo + name on an accent color background.
 * If branding is null (public embed without a token), renders nothing.
 */
export function EmbedBrandingBar({ branding }: EmbedBrandingBarProps) {
  if (!branding) return null;

  return (
    <div
      style={{ backgroundColor: branding.accent_color }}
      className="h-10 px-3 flex items-center gap-2 shrink-0"
    >
      {branding.logo_url && (
        <img
          src={branding.logo_url}
          alt={branding.org_name}
          className="h-6 w-auto object-contain"
        />
      )}
      <span className="text-white text-sm font-medium truncate">
        {branding.org_name}
      </span>
    </div>
  );
}
