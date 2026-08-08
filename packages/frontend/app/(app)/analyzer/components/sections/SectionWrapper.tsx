"use client";
import { useState, ReactNode } from "react";
import { RotateCw } from "lucide-react";
import { AIAnnotation } from "../ai/AIAnnotation";
import { PiqCard, PiqCardHeader, PiqInsightStrip } from "../primitives/card";
import { getSectionChrome } from "./section-chrome";

interface SectionWrapperProps {
  id: string;
  title: string;
  /** Right-rail micro-label — "Monthly", "30Y", "3 comps". */
  label?: string;
  defaultOpen?: boolean;
  onRefresh?: () => void;
  /**
   * AI insight text for the section. When null/undefined/empty the insight
   * strip is hidden entirely. Previously the wrapper rendered the lightbulb
   * whenever an `aiAnnotation` JSX element was passed — but the inner
   * component returns null when text is empty, leaving an empty lightbulb
   * shell. Taking the text directly fixes that.
   */
  aiText?: string | null;
  aiIsStale?: boolean;
  aiIsLoading?: boolean;
  onRefreshAi?: () => void;
  children: ReactNode;
}

/**
 * Shell for every analyzer detail section: the mockup's `.card` with a `.sh`
 * header bar and, when the AI has something to say, a full-bleed `.ai` strip
 * along the foot.
 *
 * The insight sits outside the padded body on purpose. As a floating box
 * inside the padding it read as one more element in the stack; running edge to
 * edge under a rule reads as a footnote to the whole card, which is what it
 * is. Tone and icon come from the section registry rather than props so the
 * hue assignment stays in one place.
 */
export function SectionWrapper({
  id,
  title,
  label,
  defaultOpen = true,
  onRefresh,
  aiText,
  aiIsStale = false,
  aiIsLoading = false,
  onRefreshAi,
  children,
}: SectionWrapperProps) {
  const [open, setOpen] = useState(defaultOpen);
  const hasInsight = aiIsLoading || Boolean(aiText && aiText.trim().length > 0);
  const { tone, icon } = getSectionChrome(id);

  return (
    // Full height so a two-up row ends on one line. Ragged card bottoms read
    // as an unfinished layout, and the slack is absorbed by the chart body
    // below, which simply gets more vertical resolution — not by a band of
    // empty card.
    <PiqCard fullHeight>
      <section data-section={id} className="flex h-full flex-col">
        <PiqCardHeader
          icon={icon}
          tone={tone}
          title={title}
          label={label}
          open={open}
          onToggle={() => setOpen((o) => !o)}
          actions={
            onRefresh ? (
              <button
                type="button"
                data-section-refresh
                aria-label="Refresh insight"
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh();
                }}
                className="grid h-7 w-7 place-items-center rounded-lg text-piq-muted transition-colors duration-200 hover:bg-piq-canvas hover:text-piq-indigo"
              >
                <RotateCw size={14} strokeWidth={2} aria-hidden />
              </button>
            ) : undefined
          }
        />
        {open && (
          <>
            <div className="flex-1 space-y-3 p-4">{children}</div>
            {hasInsight && (
              <PiqInsightStrip>
                <div data-section-ai>
                  <AIAnnotation
                    text={aiText}
                    isStale={aiIsStale}
                    isLoading={aiIsLoading}
                    onRefresh={onRefreshAi}
                  />
                </div>
              </PiqInsightStrip>
            )}
          </>
        )}
      </section>
    </PiqCard>
  );
}
