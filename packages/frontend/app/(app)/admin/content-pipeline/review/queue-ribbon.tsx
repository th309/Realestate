"use client";
import { useEffect, useRef } from "react";
import { useQueueNavigator } from "../lib/queue-navigator";
import { pipelineStateToStatusChip } from "../components/home/StatusChip";
import { PostMediaThumb } from "../components/PostMediaThumb";

/**
 * Horizontal film-strip of every run in the review queue. Current run is
 * highlighted with a primary ring and brought to the center via smooth
 * scroll on every navigation. Click any tile to jump.
 *
 * The 96px tile width fits ~10-12 tiles on a 1440px viewport without
 * scrolling — wider than that is rare in practice and the native
 * overflow-x-auto handles it gracefully.
 */
export function QueueRibbon() {
  const nav = useQueueNavigator();
  const containerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!nav.currentId || !currentRef.current) return;
    currentRef.current.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [nav.currentId]);

  if (nav.totalCount === 0) return null;

  return (
    <div
      ref={containerRef}
      className="flex gap-2 overflow-x-auto py-3 px-6 scroll-smooth no-scrollbar"
      aria-label="Review queue navigator"
    >
      {nav.items.map((item, idx) => {
        const active = item.id === nav.currentId;
        const isReady = item.status === "ready_for_review";
        return (
          <button
            key={item.id}
            ref={active ? currentRef : null}
            type="button"
            onClick={() => nav.jumpTo(item.id)}
            className={`group/tile relative flex-shrink-0 w-24 h-[10.66rem] rounded-lg overflow-hidden transition-all duration-200 ${
              active
                ? "ring-2 ring-primary ring-offset-2 ring-offset-surface scale-100 shadow-lg"
                : "ring-1 ring-outline-variant scale-95 opacity-70 hover:opacity-100 hover:scale-100"
            }`}
            aria-current={active ? "true" : undefined}
            aria-label={`Run ${idx + 1} of ${nav.totalCount}: ${item.market_query ?? item.id}`}
          >
            {item.mediaUrls?.[0] ? (
              <PostMediaThumb
                urls={item.mediaUrls}
                className="h-full w-full"
                rounded="rounded-none"
              />
            ) : item.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnail_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className={`w-full h-full flex items-center justify-center text-center px-1 ${
                  active
                    ? "bg-primary-container text-on-primary-container"
                    : "bg-surface-container-low text-on-surface-variant"
                }`}
              >
                <span className="text-[10px] font-medium leading-tight">
                  {(item.market_query ?? "—").split(",")[0]}
                </span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 px-1 py-1 bg-on-surface/70 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] font-mono text-surface">
                  {idx + 1}
                </span>
                {!isReady && (
                  <span
                    className="text-[8px] font-medium text-surface/80 truncate"
                    title={pipelineStateToStatusChip(item.status).label}
                  >
                    {pipelineStateToStatusChip(item.status).label}
                  </span>
                )}
              </div>
            </div>
            {active && (
              <span
                className="absolute inset-x-0 -bottom-2 mx-auto block h-1 w-6 rounded-full bg-primary"
                aria-hidden
              />
            )}
          </button>
        );
      })}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
