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
        className="text-sm italic text-on-surface-variant pl-3 border-l-2 border-outline-variant"
      >
        Generating insight…
      </div>
    );
  }
  if (!text) return null;
  return (
    <div
      data-ai-annotation
      data-stale={isStale ? "true" : "false"}
      className={`flex items-start gap-2 text-sm italic pl-3 border-l-2 border-primary ${
        isStale ? "text-on-surface-variant opacity-70" : "text-on-surface"
      }`}
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
