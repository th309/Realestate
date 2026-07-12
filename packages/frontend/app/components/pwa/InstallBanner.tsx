"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics/tracker";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";
import {
  dismissInstallBanner,
  isInstallBannerEligible,
  INSTALL_VALUE_MOMENT_EVENT,
} from "@/lib/pwa/install-value-moment";
import { ShareGlyphIcon } from "./ShareGlyphIcon";

/**
 * Value-moment-gated install banner. Self-contained: decides on its own
 * whether to render (never when installed or ineligible — see
 * lib/pwa/install-value-moment.ts), so it's safe to mount anywhere in the
 * tree that stays alive across route changes.
 */
export function InstallBanner() {
  const { canPromptNatively, promptInstall, isIos, isInstalled } =
    useInstallPrompt();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Same-tab localStorage writes fire no `storage` event, so crossing the
  // value-moment threshold via client-side nav wouldn't otherwise re-run the
  // eligibility check below. recordInstallValueMoment() dispatches this
  // event; bumping the tick re-runs the effect without a reload.
  const [valueMomentTick, setValueMomentTick] = useState(0);
  const shownFiredRef = useRef(false);

  useEffect(() => {
    function handleValueMoment() {
      setValueMomentTick((tick) => tick + 1);
    }
    window.addEventListener(INSTALL_VALUE_MOMENT_EVENT, handleValueMoment);
    return () =>
      window.removeEventListener(INSTALL_VALUE_MOMENT_EVENT, handleValueMoment);
  }, []);

  useEffect(() => {
    if (dismissed || isInstalled) {
      setVisible(false);
      return;
    }
    const canShow = canPromptNatively || isIos;
    setVisible(canShow && isInstallBannerEligible());
  }, [canPromptNatively, isIos, isInstalled, dismissed, valueMomentTick]);

  useEffect(() => {
    if (!visible || shownFiredRef.current) return;
    shownFiredRef.current = true;
    trackEvent("pwa.install_banner_shown", {
      platform: canPromptNatively ? "android" : "ios",
    });
  }, [visible, canPromptNatively]);

  function handleDismiss() {
    trackEvent("pwa.install_banner_dismissed", {});
    dismissInstallBanner();
    setDismissed(true);
  }

  async function handleInstallClick() {
    trackEvent("pwa.install_banner_install_clicked", {});
    await promptInstall();
  }

  if (!visible) return null;

  return (
    <div
      // Mobile: stack above BottomNavBar (fixed, 64px + safe-area — see
      // BOTTOM_NAV_HEIGHT_PX in src/components/layout/BottomNavBar.tsx).
      // Desktop: nav doesn't render, so float with a small margin.
      className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] lg:bottom-6 inset-x-0 z-50 pb-safe px-4 pb-4 pointer-events-none animate-in slide-in-from-bottom-4 duration-200"
    >
      <div
        role="dialog"
        aria-label="Install PropertyIQ"
        className="pointer-events-auto max-w-md mx-auto rounded-xl shadow-sm bg-surface-container border border-outline-variant p-4 flex items-center gap-3"
      >
        {canPromptNatively ? (
          <>
            <p className="flex-1 text-sm text-on-surface">
              Add PropertyIQ to your home screen
            </p>
            <button
              onClick={handleInstallClick}
              className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-semibold shrink-0 hover:bg-primary/90 transition-colors"
            >
              Install
            </button>
          </>
        ) : (
          <p className="flex-1 text-sm text-on-surface">
            Install PropertyIQ: tap{" "}
            <ShareGlyphIcon className="w-5 h-5 inline-block shrink-0 align-text-bottom" />{" "}
            then &ldquo;Add to Home Screen&rdquo;
          </p>
        )}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss install banner"
          className="text-on-surface-variant hover:text-on-surface text-lg leading-none p-1 shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  );
}
