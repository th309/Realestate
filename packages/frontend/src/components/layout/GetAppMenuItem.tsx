"use client";

import { useState } from "react";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";
import { ShareGlyphIcon } from "@/app/components/pwa/ShareGlyphIcon";
import { trackEvent } from "@/lib/analytics/tracker";

/**
 * "Get the app" entry for the mobile drawer — the phone-side counterpart of
 * the desktop profile-dropdown entry in Header.tsx. Android (a captured
 * beforeinstallprompt is waiting) fires the native install dialog; iOS and
 * other browsers expand inline Add-to-Home-Screen instructions. Renders
 * nothing once the app is installed.
 */
export function GetAppMenuItem({
  onAfterPrompt,
}: {
  onAfterPrompt: () => void;
}) {
  const { canPromptNatively, promptInstall, isInstalled } = useInstallPrompt();
  const [showHelp, setShowHelp] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    trackEvent("pwa.get_app_clicked", { surface: "mobile_menu" });
    if (canPromptNatively) {
      await promptInstall();
      onAfterPrompt();
    } else {
      setShowHelp((v) => !v);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        aria-expanded={canPromptNatively ? undefined : showHelp}
        className="flex w-full items-center rounded-xl px-4 py-3 text-base font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="mr-3 h-5 w-5 text-on-surface-variant"
          aria-hidden="true"
        >
          <path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z" />
        </svg>
        Get the app
      </button>
      {showHelp && (
        <div className="mx-4 mb-1 rounded-xl bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
          <p className="flex items-center gap-1.5">
            Install PropertyIQ: tap
            <ShareGlyphIcon className="inline h-4 w-4 shrink-0" />
            <span className="font-medium">Share</span>, then
            <span className="font-medium">
              &ldquo;Add to Home Screen&rdquo;
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
