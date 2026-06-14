"use client";
import {
  ReactNode,
  RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/**
 * M3-style anchored popover. Positions itself relative to an anchor
 * element, with focus trap, click-outside-to-close, and Escape-to-close.
 * Used for the voice picker; reusable for any non-modal floating UI
 * inside the content-pipeline admin.
 *
 * Anchor positioning: by default opens to the right of the anchor with
 * top alignment. Falls back to left side if it would overflow the
 * viewport. No portal — renders in place; the parent must not have
 * `overflow: hidden` along the popover's path.
 */
export function M3Popover({
  open,
  onClose,
  anchorRef,
  ariaLabel,
  width = 360,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  ariaLabel: string;
  width?: number;
  children: ReactNode;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // Compute position relative to viewport.
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const spaceRight = window.innerWidth - rect.right;
    const openLeft = spaceRight < width + 16;
    setPosition({
      top: rect.top + window.scrollY,
      left: openLeft
        ? rect.left + window.scrollX - width - 8
        : rect.right + window.scrollX + 8,
    });
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;
    previousActive.current = document.activeElement as HTMLElement | null;
    const root = popoverRef.current;
    const focusables = root?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusables?.[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && focusables && focusables.length > 0) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    function onPointer(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !popoverRef.current?.contains(target) &&
        !anchorRef.current?.contains(target)
      ) {
        onClose();
      }
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      previousActive.current?.focus?.();
    };
  }, [open, anchorRef, onClose]);

  if (!open || !position) return null;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={ariaLabel}
      style={{ top: position.top, left: position.left, width }}
      className="absolute z-40 bg-surface-container-high text-on-surface rounded-2xl shadow-xl border border-outline-variant overflow-hidden animate-[m3-popover-in_200ms_cubic-bezier(0.2,0,0,1)]"
    >
      {children}
      <style jsx global>{`
        @keyframes m3-popover-in {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
