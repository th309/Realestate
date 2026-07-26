"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  // Browsers don't always fire online/offline reliably — a transition (often
  // the recovery back to online) can be missed after sleep/network churn,
  // stranding a stale `false` even though navigator.onLine is now true. Re-read
  // whenever the tab regains focus/visibility so the snapshot can't get stuck.
  window.addEventListener("focus", callback);
  document.addEventListener("visibilitychange", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
    window.removeEventListener("focus", callback);
    document.removeEventListener("visibilitychange", callback);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

// SSR has no network concept — assume online so the server-rendered markup
// never shows an offline state that then has to flip on hydration.
function getServerSnapshot(): boolean {
  return true;
}

/**
 * Tracks browser connectivity via the `online`/`offline` window events.
 * Backed by `useSyncExternalStore` so every consumer re-renders in sync off
 * a single source of truth (`navigator.onLine`) instead of each mounting its
 * own event listener pair.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
