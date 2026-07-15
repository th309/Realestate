"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Heart, Map, FileText, Bell, Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEntitlements } from "@/lib/entitlements";
import { useWatchlist } from "@/lib/watchlist/useWatchlist";
import { useIsAnonymous } from "@/lib/entitlements/useIsAnonymous";
import { buildAnonReturnTo } from "@/lib/entitlements/buildAnonReturnTo";
import { AnonCaptureModal } from "@/components/entitlements/AnonCaptureModal";
import { PaywallCard } from "@/components/entitlements/PaywallCard";
import { useModalHistory } from "@/lib/pwa/use-modal-history";
import { formatGeoDisplayName, type ScreenerRow } from "@/lib/data";
import { ScreenerRowAlertStep } from "./ScreenerRowAlertStep";

interface ScreenerRowMenuProps {
  row: ScreenerRow;
  x: number;
  y: number;
  onClose: () => void;
}

export function ScreenerRowMenu({ row, x, y, onClose }: ScreenerRowMenuProps) {
  const router = useRouter();
  const { user } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const { isInWatchlist, addToWatchlist, removeFromWatchlist, items } =
    useWatchlist({ userId: user?.id ?? "", autoLoad: !!user?.id });
  const { getAccess, loading } = useEntitlements();
  const isAnonymous = useIsAnonymous();

  const [toggling, setToggling] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [overlay, setOverlay] = useState<
    "watchlist" | "reports" | "anon-watchlist" | "anon-reports" | null
  >(null);

  const [pos, setPos] = useState({ top: y, left: x });
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const margin = 8;
    let top = y;
    let left = x;
    if (left + rect.width + margin > window.innerWidth) {
      left = window.innerWidth - rect.width - margin;
    }
    if (top + rect.height + margin > window.innerHeight) {
      top = window.innerHeight - rect.height - margin;
    }
    setPos({ top, left });
  }, [x, y]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        (!overlayRef.current || !overlayRef.current.contains(target))
      ) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useModalHistory(true, onClose, "screener-row-menu");

  if (loading) {
    return null;
  }

  const watchlistLocked =
    getAccess("feature", "watchlist_limit").level === "none";
  const reportAccess = getAccess("feature", "reports");
  const isSaved = isInWatchlist(row.geo_level, row.region_id);
  const displayName = formatGeoDisplayName(row.region_name);

  const handleFavorite = async () => {
    if (isAnonymous) {
      setOverlay("anon-watchlist");
      return;
    }
    if (watchlistLocked) {
      setOverlay("watchlist");
      return;
    }
    if (!user?.id || toggling) return;
    setToggling(true);
    try {
      if (isSaved) {
        const item = items.find(
          (i) =>
            i.geography_type === row.geo_level &&
            i.geography_id === row.region_id,
        );
        if (item) await removeFromWatchlist(item.id);
      } else {
        await addToWatchlist(row.geo_level, row.region_id, displayName);
      }
    } finally {
      setToggling(false);
    }
  };

  const handleViewOnMap = () => {
    const params = new URLSearchParams({
      geo: row.geo_level,
      id: row.region_id,
      name: displayName,
    });
    if (row.state_code) params.set("state", row.state_code);
    router.push(`/map?${params.toString()}`);
    onClose();
  };

  const handleGenerateReport = () => {
    if (isAnonymous) {
      setOverlay("anon-reports");
      return;
    }
    if (reportAccess.level === "none") {
      setOverlay("reports");
      return;
    }
    try {
      localStorage.setItem(
        "propertyiq-report-prefill",
        JSON.stringify({
          id: row.region_id,
          name: displayName,
          type: row.geo_level,
          state: row.state_code,
        }),
      );
    } catch {
      /* ignore */
    }
    router.push(
      reportAccess.level === "full"
        ? "/reports?rtype=homebuyer"
        : "/reports/sample",
    );
    onClose();
  };

  return createPortal(
    <>
      <div
        ref={menuRef}
        className="fixed z-[99999] min-w-[220px] rounded-2xl border border-outline-variant/40 bg-surface-container-lowest py-1.5 elevation-3"
        style={{ top: pos.top, left: pos.left }}
      >
        <div className="border-b border-outline-variant/30 px-3 py-2">
          <div className="truncate text-xs font-semibold text-on-surface">
            {displayName}
          </div>
          <div className="text-[10px] capitalize text-on-surface-variant">
            {row.geo_level}
          </div>
        </div>

        {showAlert ? (
          <ScreenerRowAlertStep row={row} onClose={onClose} />
        ) : (
          <>
            <button
              onClick={handleFavorite}
              disabled={toggling}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
            >
              {toggling ? (
                <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
              ) : (
                <Heart
                  className={`h-4 w-4 ${isSaved ? "fill-primary text-primary" : "text-on-surface-variant"}`}
                />
              )}
              <span className="flex-1 text-left">
                {isSaved ? "Favorited" : "Favorite"}
              </span>
              {watchlistLocked && (
                <Lock className="h-3 w-3 text-on-surface-variant/60" />
              )}
            </button>

            <button
              onClick={handleViewOnMap}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-on-surface transition-colors hover:bg-surface-container"
            >
              <Map className="h-4 w-4 text-on-surface-variant" />
              <span className="flex-1 text-left">View on Map</span>
            </button>

            <button
              onClick={handleGenerateReport}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-on-surface transition-colors hover:bg-surface-container"
            >
              <FileText className="h-4 w-4 text-on-surface-variant" />
              <span className="flex-1 text-left">Generate Report</span>
              {reportAccess.level === "none" && (
                <Lock className="h-3 w-3 text-on-surface-variant/60" />
              )}
            </button>

            <button
              onClick={() => setShowAlert(true)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-on-surface transition-colors hover:bg-surface-container"
            >
              <Bell className="h-4 w-4 text-on-surface-variant" />
              <span className="flex-1 text-left">Set Alert</span>
              <span className="text-on-surface-variant/60">›</span>
            </button>
          </>
        )}
      </div>

      {overlay &&
        (overlay === "anon-watchlist" || overlay === "anon-reports" ? (
          <div ref={overlayRef} className="fixed inset-0 z-[100000]">
            <AnonCaptureModal
              featureName={
                overlay === "anon-watchlist" ? "Favorites" : "Reports"
              }
              returnTo={buildAnonReturnTo(
                window.location.pathname,
                window.location.search,
                undefined,
              )}
              onDismiss={() => setOverlay(null)}
            />
          </div>
        ) : (
          <div
            ref={overlayRef}
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-scrim/40"
            onClick={() => setOverlay(null)}
          >
            <div className="mx-4 max-w-sm" onClick={(e) => e.stopPropagation()}>
              <PaywallCard
                type="feature"
                id={overlay === "watchlist" ? "watchlist_limit" : "reports"}
                title={
                  overlay === "watchlist"
                    ? "Unlock Favorites"
                    : "Unlock Reports"
                }
              />
            </div>
          </div>
        ))}
    </>,
    document.body,
  );
}
