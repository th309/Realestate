"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface BreathingSpotlightProps {
  targetSelector: string | null;
  visible: boolean;
  onClick?: () => void;
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
}: BreathingSpotlightProps) {
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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
          if (el) measureTarget();
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
  }, [visible, targetSelector, measureTarget]);

  if (!visible) return null;

  if (!spotlight) {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm transition-opacity duration-400"
        onClick={onClick}
      />
    );
  }

  return (
    <>
      {/* SVG mask: transparent cutout over blurred backdrop */}
      <svg
        ref={svgRef}
        aria-hidden="true"
        role="presentation"
        className="fixed inset-0 z-[9998] w-full h-full pointer-events-none"
        style={{ backdropFilter: "blur(3px)" }}
      >
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={spotlight.left}
              y={spotlight.top}
              width={spotlight.width}
              height={spotlight.height}
              rx={spotlight.borderRadius}
              fill="black"
              className="transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.45)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Pulsing glow ring */}
      <div
        aria-hidden="true"
        className="fixed z-[9998] pointer-events-none animate-[breathe_2s_ease-in-out_infinite]"
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

      {/* Click handler overlay — pointer-events only when there's a dismiss handler.
          For action-gated steps (onClick is undefined), clicks must pass through
          to the spotlighted element so the action listener can fire. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[9998]"
        onClick={onClick}
        style={{ pointerEvents: onClick ? "auto" : "none" }}
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
