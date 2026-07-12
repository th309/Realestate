// packages/frontend/lib/pwa/use-modal-history.ts
"use client";

import { useEffect, useRef } from "react";

interface ModalHistoryState {
  piqModal: string;
  depth: number;
}

function isModalHistoryState(state: unknown): state is ModalHistoryState {
  return (
    !!state &&
    typeof state === "object" &&
    typeof (state as { piqModal?: unknown }).piqModal === "string"
  );
}

// LIFO stack of ids for modals that currently hold a live pushed history
// entry. Module-level (not component state) so every hook instance agrees
// on which modal is "on top" — a popstate only closes the top one, which is
// what makes stacked sheets unwind one at a time instead of all together.
const openModalStack: string[] = [];

/**
 * Makes the Android system back button / iOS edge-swipe close an open modal
 * or sheet in the installed PWA instead of navigating away or exiting the
 * app. Back only exits the app once nothing is open.
 *
 * While `isOpen` is true, pushes one `history` entry tagged with `id`. When
 * the user presses back, the resulting `popstate` calls `onClose` — but
 * only for the top-of-stack modal. A programmatic close (X button, Escape,
 * backdrop — anything that flips `isOpen` to false without a back-press)
 * consumes the entry itself via `history.back()`, guarded so the popstate
 * that call triggers doesn't fire `onClose` a second time.
 *
 * If the pathname changes while open (e.g. a `router.push` from inside the
 * modal), the entry is abandoned in place instead of undone — calling
 * `history.back()` across a real navigation would fight the router.
 */
export function useModalHistory(
  isOpen: boolean,
  onClose: () => void,
  id: string,
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Set right before onClose fires from a genuine popstate, so the paired
  // effect cleanup below (which runs next, once the caller flips `isOpen`
  // to false in response) knows the entry is already gone and skips
  // consuming it again.
  const closedByPopRef = useRef(false);
  // Set right before *we* call history.back() to consume our own entry, so
  // the popstate that call triggers is recognized as our own bookkeeping
  // rather than a real user back-press, and doesn't re-fire onClose.
  const consumingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPopState = () => {
      const top = openModalStack[openModalStack.length - 1];
      if (top !== id) return; // not our turn — a different modal (or none) owns this pop
      openModalStack.pop();
      if (consumingRef.current) {
        consumingRef.current = false; // our own consume() completed; nothing else to do
        return;
      }
      closedByPopRef.current = true;
      onCloseRef.current();
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [id]);

  useEffect(() => {
    if (typeof window === "undefined" || !isOpen) return;

    openModalStack.push(id);
    const openPathname = window.location.pathname;
    window.history.pushState(
      { piqModal: id, depth: openModalStack.length },
      "",
    );

    return () => {
      if (closedByPopRef.current) {
        closedByPopRef.current = false;
        return; // the popstate handler above already popped the stack
      }

      if (typeof window === "undefined") {
        const idx = openModalStack.lastIndexOf(id);
        if (idx !== -1) openModalStack.splice(idx, 1);
        return;
      }

      const navigated = window.location.pathname !== openPathname;
      const state = window.history.state;
      const isOwnLiveEntry =
        isModalHistoryState(state) && state.piqModal === id;

      if (!navigated && isOwnLiveEntry) {
        // Consume it ourselves; the popstate the call below triggers pops
        // the stack and clears consumingRef (see the listener above).
        consumingRef.current = true;
        window.history.back();
        return;
      }

      // Either a real navigation happened (don't fight the router) or our
      // entry is no longer the live one — just drop our bookkeeping.
      const idx = openModalStack.lastIndexOf(id);
      if (idx !== -1) openModalStack.splice(idx, 1);
    };
  }, [isOpen, id]);
}
