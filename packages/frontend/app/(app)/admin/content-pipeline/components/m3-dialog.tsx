"use client";
import { ReactNode, useEffect, useRef } from "react";

/**
 * M3-spec dialog primitive: scrim backdrop, focus trap, Escape-to-close,
 * `rounded-[28px]` shape, M3 emphasized easing on enter/exit. Used as the
 * wrapper for DestructiveDialog, RejectDialog, and ThumbnailEditor.
 *
 * Click-outside behavior is configurable: destructive confirms close on
 * scrim click, but the thumbnail editor doesn't (operators would lose
 * scrubber state by accident).
 */
export function M3Dialog({
  open,
  onClose,
  closeOnScrim = true,
  ariaLabel,
  maxWidth = "max-w-md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  closeOnScrim?: boolean;
  ariaLabel: string;
  maxWidth?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousActive.current = document.activeElement as HTMLElement | null;

    const root = dialogRef.current;
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
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousActive.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-[m3-scrim-in_200ms_ease-out]"
      onClick={(e) => {
        // Only handle SCRIM clicks here (target === currentTarget means the
        // click hit the backdrop, not an inner element). For inner clicks
        // we MUST NOT call preventDefault — that would cancel form submits,
        // button defaults, anchor navigation, etc. inside the dialog.
        //
        // The scrim case stops propagation + preventDefault to keep
        // ancestor handlers (e.g. a wrapping <Link> on a dashboard card)
        // from also firing on this click. Inner elements take care of
        // their own propagation (the dialog content div below intercepts
        // bubbling separately).
        if (e.target !== e.currentTarget) return;
        e.stopPropagation();
        e.preventDefault();
        if (closeOnScrim) onClose();
      }}
    >
      <div
        ref={dialogRef}
        // Stop bubbling (NOT preventDefault) so dialog-internal clicks
        // don't reach an ancestor <Link> on a dashboard card while still
        // letting form submits, button defaults, and anchor navigation
        // inside the dialog work normally.
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={`relative w-full ${maxWidth} bg-surface-container-high text-on-surface rounded-[28px] shadow-2xl animate-[m3-dialog-in_200ms_cubic-bezier(0.2,0,0,1)]`}
      >
        {children}
      </div>
      <style jsx global>{`
        @keyframes m3-scrim-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes m3-dialog-in {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
