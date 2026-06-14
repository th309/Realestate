"use client";
import { ReactNode } from "react";

interface EditInputsFabProps {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * Mobile-only floating action button + slide-up panel for the InputPanel.
 * Hidden on md+ where the sticky sidebar handles inputs.
 */
export function EditInputsFab({
  open,
  onToggle,
  children,
}: EditInputsFabProps) {
  return (
    <div className="md:hidden">
      <button
        data-edit-inputs-fab
        aria-label={open ? "Close inputs" : "Edit inputs"}
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-primary text-on-primary shadow-lg w-14 h-14 flex items-center justify-center text-2xl"
      >
        {open ? "×" : "✎"}
      </button>
      {open && (
        <div
          data-edit-inputs-panel
          className="fixed inset-x-0 bottom-0 top-16 z-30 bg-surface border-t border-outline-variant overflow-y-auto p-4 rounded-t-2xl shadow-2xl"
        >
          {children}
        </div>
      )}
    </div>
  );
}
