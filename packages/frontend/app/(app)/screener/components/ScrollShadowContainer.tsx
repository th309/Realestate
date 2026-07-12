"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

interface ScrollShadowContainerProps {
  children: React.ReactNode;
  /** Accessible name for the scroll region (keyboard users tab into it to
      scroll with arrow keys). */
  ariaLabel: string;
}

/**
 * Horizontal scroll container with edge affordances. Mobile browsers hide
 * scrollbars, so a wide table inside `overflow-x-auto` gives no visual cue
 * that more columns exist — this wrapper overlays a gradient fade + chevron
 * on whichever edge still has off-screen content, and removes them at the
 * scroll extremes.
 */
export function ScrollShadowContainer({
  children,
  ariaLabel,
}: ScrollShadowContainerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateShadows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  // Re-measure when the container resizes or async rows change the table's
  // intrinsic width (initial render is often the empty state).
  useEffect(() => {
    updateShadows();
    const el = scrollerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateShadows);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [updateShadows]);

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={updateShadows}
        tabIndex={0}
        role="region"
        aria-label={ariaLabel}
        className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        {children}
      </div>

      {canScrollLeft && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-surface-container-lowest to-transparent"
        />
      )}

      {canScrollRight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface-container-lowest to-transparent flex items-center justify-end pr-0.5"
        >
          <ChevronRight className="w-4 h-4 text-on-surface-variant/70" />
        </div>
      )}
    </div>
  );
}
