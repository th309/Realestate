"use client";

import { useState, useEffect, useRef } from "react";
import { trackEvent, flush } from "@/lib/analytics/tracker";

interface BeaconProps {
  id: string;
  targetSelector: string;
  targetFeature?: string;
  tooltip: string;
  href?: string;
  onDismiss: (id: string) => void;
}

export function Beacon({
  id,
  targetSelector,
  targetFeature,
  tooltip,
  href,
  onDismiss,
}: BeaconProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const shownFiredRef = useRef(false);

  useEffect(() => {
    const el = document.querySelector(targetSelector);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({
      top: rect.top - 4,
      right: window.innerWidth - rect.right - 4,
    });

    const handleResize = () => {
      const r = el.getBoundingClientRect();
      setPosition({ top: r.top - 4, right: window.innerWidth - r.right - 4 });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [targetSelector]);

  useEffect(() => {
    if (!position || shownFiredRef.current) return;
    shownFiredRef.current = true;
    trackEvent("beacon.shown", {
      beacon_id: id,
      target_feature: targetFeature ?? id,
    });
  }, [position, id, targetFeature]);

  if (!position) return null;

  const handleClick = () => {
    if (href) {
      trackEvent("beacon.clicked", {
        beacon_id: id,
        target_feature: targetFeature ?? id,
      });
      flush();
      onDismiss(id);
      window.location.href = href;
    } else {
      trackEvent("beacon.dismissed", { beacon_id: id });
      onDismiss(id);
    }
  };

  return (
    <div
      className="fixed z-[100]"
      style={{ top: position.top, right: position.right }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        onClick={handleClick}
        className="w-3 h-3 rounded-full bg-primary animate-[beacon_2s_ease-in-out_infinite] cursor-pointer"
        aria-label={tooltip}
      />
      {showTooltip && (
        <div className="absolute right-0 top-5 bg-surface-container-high text-on-surface text-xs rounded-lg px-3 py-2 shadow-md whitespace-nowrap">
          {tooltip}
        </div>
      )}
      <style>{`
        @keyframes beacon {
          0%, 100% { transform: scale(1); opacity: 0.6; box-shadow: 0 0 0 0 rgba(57,73,171,0.4); }
          50% { transform: scale(1.3); opacity: 1; box-shadow: 0 0 8px 4px rgba(57,73,171,0.2); }
        }
      `}</style>
    </div>
  );
}
