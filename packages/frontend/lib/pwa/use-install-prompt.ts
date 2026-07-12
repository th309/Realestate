"use client";

import { useCallback, useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics/tracker";
import { isStandaloneDisplayMode } from "./is-standalone";

/** Chromium's non-standard `beforeinstallprompt` event — not in lib.dom.d.ts. */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type InstallOutcome = "accepted" | "dismissed" | null;

// `beforeinstallprompt` fires once per page load, often before any component
// that wants it has mounted. Stashing it at module scope means a hook
// instance that mounts later (e.g. InstallBanner appearing after a value
// moment) still sees the one-shot event instead of missing it.
let stashedPrompt: BeforeInstallPromptEvent | null = null;

function detectIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  // iPadOS 13+ masquerades as macOS Safari but exposes multi-touch, unlike
  // an actual Mac.
  return /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * Captures the browser's native install prompt and exposes install state.
 * See lib/pwa/install-value-moment.ts for the banner's eligibility gating.
 */
export function useInstallPrompt() {
  const [canPromptNatively, setCanPromptNatively] = useState(
    () => stashedPrompt !== null,
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installOutcome, setInstallOutcome] = useState<InstallOutcome>(null);

  useEffect(() => {
    setIsInstalled(isStandaloneDisplayMode());
    setIsIos(detectIos());
  }, []);

  useEffect(() => {
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      stashedPrompt = e as BeforeInstallPromptEvent;
      setCanPromptNatively(true);
    }
    function handleAppInstalled() {
      stashedPrompt = null;
      setCanPromptNatively(false);
      setIsInstalled(true);
      trackEvent("pwa_installed", {});
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!stashedPrompt) return;
    const event = stashedPrompt;
    await event.prompt();
    const choice = await event.userChoice;
    setInstallOutcome(choice.outcome);
    stashedPrompt = null;
    setCanPromptNatively(false);
  }, []);

  return {
    canPromptNatively,
    promptInstall,
    isIos,
    isInstalled,
    installOutcome,
  };
}
