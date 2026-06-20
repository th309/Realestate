"use client";

import { useInView } from "@/app/components/home/hooks/useInView";

/**
 * Scroll-reveal wrapper for the landing-v2 beats.
 *
 * Backed by the existing `useInView` (IntersectionObserver) hook, which is
 * SSR-safe (defaults visible) and already collapses to the final state under
 * `prefers-reduced-motion`. The `motion-reduce:` classes are a second guard so
 * a reduced-motion user is never left looking at opacity-0 content. Transforms
 * + opacity only — GPU-friendly, no per-frame scroll listeners (CLAUDE.md /
 * spec §7).
 */
export function Reveal({
  children,
  delayMs = 0,
  className = "",
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const [ref, inView] = useInView(0.15);
  return (
    <div
      ref={ref}
      className={`transition-all duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${
        inView
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-5 motion-reduce:opacity-100 motion-reduce:translate-y-0"
      } ${className}`}
      style={{ transitionDelay: inView ? `${delayMs}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
