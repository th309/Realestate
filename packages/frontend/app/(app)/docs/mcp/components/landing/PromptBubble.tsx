import { Sparkles } from "lucide-react";

interface PromptBubbleProps {
  prompt: string;
  compact?: boolean;
}

/**
 * The page's signature element: a spoken prompt rendered in the brand's
 * editorial serif (brand spec §8.3), because these are words said TO the
 * AI, not UI chrome. Reused in the hero, capability cards, and closing CTA.
 */
export function PromptBubble({ prompt, compact = false }: PromptBubbleProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl bg-surface-container-low border border-outline-variant/50 ${
        compact ? "px-4 py-3" : "px-5 py-4"
      }`}
    >
      <Sparkles className="w-4 h-4 text-primary shrink-0 mt-1" />
      <p
        className={`font-serif text-on-surface leading-snug ${
          compact ? "text-sm" : "text-base"
        }`}
      >
        &ldquo;{prompt}&rdquo;
      </p>
    </div>
  );
}
