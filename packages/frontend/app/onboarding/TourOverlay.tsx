"use client";

import { useEffect, useState } from "react";

interface TourOverlayProps {
  targetSelector: string | null;
  visible: boolean;
  onClick?: () => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
const BORDER_RADIUS = 12;

export function TourOverlay({
  targetSelector,
  visible,
  onClick,
}: TourOverlayProps) {
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (!visible || !targetSelector) {
      setSpotlight(null);
      return;
    }

    const updateSpotlight = () => {
      const el = document.querySelector(targetSelector);
      if (!el) {
        setSpotlight(null);
        return;
      }

      const rect = el.getBoundingClientRect();
      setSpotlight({
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      });

      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    updateSpotlight();
    const rafId = requestAnimationFrame(updateSpotlight);
    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight, true);

    // Poll for target element if not found (handles post-navigation render delays)
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;
    pollInterval = setInterval(() => {
      attempts++;
      const el = document.querySelector(targetSelector);
      if (el || attempts > 20) {
        if (el) updateSpotlight();
        if (pollInterval) clearInterval(pollInterval);
      }
    }, 200);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight, true);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [targetSelector, visible]);

  if (!visible) return null;

  if (!spotlight) {
    return (
      <div
        className="fixed inset-0 z-[9998] bg-black/60 transition-opacity duration-400"
        onClick={onClick}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none transition-all duration-400">
      <div className="absolute inset-0 pointer-events-auto" onClick={onClick} />
      <div
        className="absolute pointer-events-none transition-all duration-400"
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
          borderRadius: BORDER_RADIUS,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
        }}
      />
    </div>
  );
}
