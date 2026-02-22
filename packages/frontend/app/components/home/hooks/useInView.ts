'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Intersection Observer hook for scroll-triggered animations
 * Returns a ref callback and boolean indicating if element is in view
 */
export function useInView(threshold = 0.1) {
  const [ref, setRef] = useState<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref) return;

    // Fallback: if IntersectionObserver is not available (SSR or legacy browser),
    // treat the element as always in view so animated values still display.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold }
    );

    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref, threshold]);

  const setRefCallback = useCallback((node: HTMLElement | null) => {
    setRef(node);
  }, []);

  return [setRefCallback, inView] as const;
}
