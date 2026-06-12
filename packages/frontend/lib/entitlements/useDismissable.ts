// packages/frontend/lib/entitlements/useDismissable.ts
"use client";

import { useCallback, useEffect, type RefObject } from "react";

interface UseDismissableArgs {
  onDismiss: () => void;
  /** Ref to the dialog card; scrim clicks outside it dismiss. */
  cardRef: RefObject<HTMLElement | null>;
}

/**
 * Wires Escape-to-dismiss (document keydown) and returns an onScrimClick
 * handler that dismisses only when the click lands outside the card.
 */
export function useDismissable({ onDismiss, cardRef }: UseDismissableArgs) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const onScrimClick = useCallback(
    (e: React.MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    },
    [onDismiss, cardRef],
  );

  return { onScrimClick };
}
