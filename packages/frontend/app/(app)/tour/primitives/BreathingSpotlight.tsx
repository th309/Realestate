"use client";

import { useEffect, useState, useCallback } from "react";

interface BreathingSpotlightProps {
  targetSelector: string | null;
  visible: boolean;
  onClick?: () => void;
  onTargetMissing?: () => void;
}

const PADDING = 12;

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: number;
}

export function BreathingSpotlight({
  targetSelector,
  visible,
  onClick,
  onTargetMissing,
}: BreathingSpotlightProps) {
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);

  const measureTarget = useCallback(() => {
    if (!targetSelector) {
      setSpotlight(null);
      return;
    }
    const el = document.querySelector(targetSelector);
    if (!el) {
      setSpotlight(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const computed = getComputedStyle(el);
    const br = parseFloat(computed.borderRadius) || 12;
    setSpotlight({
      top: rect.top - PADDING,
      left: rect.left - PADDING,
      width: rect.width + PADDING * 2,
      height: rect.height + PADDING * 2,
      borderRadius: br + 4,
    });
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [targetSelector]);

  useEffect(() => {
    if (!visible) return;
    measureTarget();
    const rafId = requestAnimationFrame(measureTarget);
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    if (targetSelector) {
      let attempts = 0;
      pollInterval = setInterval(() => {
        attempts++;
        const el = document.querySelector(targetSelector);
        if (el || attempts > 20) {
          if (el) {
            measureTarget();
          } else {
            onTargetMissing?.();
          }
          if (pollInterval) clearInterval(pollInterval);
        }
      }, 200);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [visible, targetSelector, measureTarget, onTargetMissing]);

  if (!visible) return null;

  // No target found (after the poll). Render nothing — never blur the whole
  // app. Auto-skip is handled by the parent via onTargetMissing (Task 4).
  if (!spotlight) return null;

  const right = spotlight.left + spotlight.width;
  const bottom = spotlight.top + spotlight.height;
  const dim =
    "fixed z-[9998] bg-black/45 backdrop-blur-[3px] transition-all duration-300";

  return (
    <>
      {/* Four dim+blur panels tiling the viewport AROUND the target rect.
          The target rect itself is never covered, so it stays razor-sharp. */}
      <div
        data-testid="spotlight-dim-top"
        aria-hidden="true"
        className={dim}
        style={{
          top: 0,
          left: 0,
          width: "100vw",
          height: Math.max(0, spotlight.top),
        }}
        onClick={onClick}
      />
      <div
        data-testid="spotlight-dim-bottom"
        aria-hidden="true"
        className={dim}
        style={{ top: bottom, left: 0, width: "100vw", bottom: 0 }}
        onClick={onClick}
      />
      <div
        data-testid="spotlight-dim-left"
        aria-hidden="true"
        className={dim}
        style={{
          top: spotlight.top,
          left: 0,
          width: Math.max(0, spotlight.left),
          height: spotlight.height,
        }}
        onClick={onClick}
      />
      <div
        data-testid="spotlight-dim-right"
        aria-hidden="true"
        className={dim}
        style={{
          top: spotlight.top,
          left: right,
          right: 0,
          height: spotlight.height,
        }}
        onClick={onClick}
      />

      {/* Pulsing indigo glow ring around the (uncovered) target. */}
      <div
        aria-hidden="true"
        className="fixed z-[9998] pointer-events-none motion-safe:animate-[breathe_2s_ease-in-out_infinite]"
        style={{
          top: spotlight.top - 4,
          left: spotlight.left - 4,
          width: spotlight.width + 8,
          height: spotlight.height + 8,
          borderRadius: spotlight.borderRadius + 4,
          boxShadow:
            "0 0 20px 4px rgba(57,73,171,0.3), 0 0 40px 8px rgba(57,73,171,0.15)",
          transition: "all 400ms cubic-bezier(0.4,0,0.2,1)",
        }}
      />

      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
      `}</style>
    </>
  );
}
