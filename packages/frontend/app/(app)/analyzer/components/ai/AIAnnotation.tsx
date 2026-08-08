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
      <div data-ai-annotation data-loading className="italic text-piq-muted">
        Generating insight…
      </div>
    );
  }
  if (!text) return null;
  // Freshness is signalled solely by the refresh control. Fading the text
  // historically made it read as grey, which the brand spec reserves for
  // unavailable data, not for cached-but-still-useful insights.
  //
  // No rule, no tint, no colour of its own: this always renders inside
  // PiqInsightStrip, which already supplies the lightbulb, the container and
  // the italic. Carrying its own left rule and indigo text drew a second frame
  // around the same paragraph and put two blues in one strip.
  return (
    <div
      data-ai-annotation
      data-stale={isStale ? "true" : "false"}
      className="flex items-start gap-2"
    >
      <span className="flex-1">{text}</span>
      {isStale && onRefresh && (
        <button
          data-ai-refresh
          aria-label="Refresh stale insight"
          onClick={onRefresh}
          className="shrink-0 not-italic text-piq-indigo hover:opacity-70"
        >
          ↻
        </button>
      )}
    </div>
  );
}
