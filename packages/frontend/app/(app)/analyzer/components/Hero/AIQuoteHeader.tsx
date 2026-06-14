"use client";

interface AIQuoteHeaderProps {
  text?: string | null;
  isStreaming?: boolean;
  placeholder?: string;
}

export function AIQuoteHeader({
  text,
  isStreaming = false,
  placeholder = "Generating verdict…",
}: AIQuoteHeaderProps) {
  const display = text && text.length > 0 ? text : placeholder;
  return (
    <blockquote
      data-ai-quote-header
      data-streaming={isStreaming ? "true" : "false"}
      className="font-serif italic text-lg md:text-xl text-on-surface-variant border-l-4 border-primary pl-4 py-1"
    >
      {display}
      {isStreaming && (
        <span
          data-ai-caret
          aria-hidden
          className="inline-block w-[2px] h-[1em] bg-primary ml-1 align-text-bottom animate-pulse"
        />
      )}
    </blockquote>
  );
}
