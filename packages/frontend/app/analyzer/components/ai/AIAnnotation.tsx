"use client";

interface AIAnnotationProps {
  text?: string | null;
  isStale?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function AIAnnotation({
  text,
  isStale = false,
  isLoading = false,
  onRefresh,
}: AIAnnotationProps) {
  if (isLoading) {
    return (
      <div
        data-ai-annotation
        data-loading
        className="text-sm italic text-primary opacity-70 pl-3 border-l-2 border-primary"
      >
        Generating insight…
      </div>
    );
  }
  if (!text) return null;
  // All AI annotations render in primary blue regardless of freshness. Stale
  // state is signaled solely by the refresh button (↻) — fading the text
  // historically made it read as grey, which the brand spec reserves for
  // unavailable data, not for cached-but-still-useful insights.
  return (
    <div
      data-ai-annotation
      data-stale={isStale ? "true" : "false"}
      className="flex items-start gap-2 text-sm italic pl-3 border-l-2 border-primary text-primary"
    >
      <span className="flex-1">{text}</span>
      {isStale && onRefresh && (
        <button
          data-ai-refresh
          aria-label="Refresh stale insight"
          onClick={onRefresh}
          className="text-primary hover:text-primary-dark text-base shrink-0"
        >
          ↻
        </button>
      )}
    </div>
  );
}
