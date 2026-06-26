"use client";

import { useEffect } from "react";

/**
 * When the analyzer input layer opens (mobile sheet or desktop sidebar), move
 * focus to whichever address field is currently on screen. The hidden copy has
 * a null `offsetParent`, so it is skipped. Extracted from `AnalyzerClient.tsx`
 * to keep that component under the §1.3 400-line cap.
 */
export function useMobileInputFocus(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const fields = Array.from(
        document.querySelectorAll<HTMLInputElement>("[data-address-input]"),
      );
      fields.find((el) => el.offsetParent !== null)?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, [open]);
}
