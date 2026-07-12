"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Shared dismiss behavior for tooltips, popovers, and menus: closes when
 * the user presses Escape, or clicks/taps outside the element `ref` points
 * to. Listeners are only attached while `isOpen` is true.
 *
 * `onClose` is read from a ref internally so callers can pass a fresh
 * inline closure each render without re-subscribing the listeners.
 */
export function useDismissableOpen<T extends HTMLElement>(
  ref: RefObject<T | null>,
  isOpen: boolean,
  onClose: () => void,
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    function handleOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen, ref]);
}
