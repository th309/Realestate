"use client";

/**
 * useAiHeaderVerdict — debounced streaming AI verdict for the Hero.
 *
 * Streams text chunks from POST /ai-insights/header (SSE). Debounces by
 * 1.5s so the user can finish editing inputs before triggering the LLM.
 * The hook owns abort + accumulation; consumers just read `text`.
 */

import { useEffect, useRef, useState } from "react";
import { streamAiHeaderInsight } from "../fetchers/ai-insights-stream";
import type { AiInsightPayload } from "../fetchers/ai-insights";

export function useAiHeaderVerdict(payload: AiInsightPayload | null) {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<{ stopped: boolean } | null>(null);

  useEffect(() => {
    if (!payload) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const ctl = { stopped: false };
      abortRef.current = ctl;
      setText("");
      setIsStreaming(true);
      try {
        let acc = "";
        for await (const chunk of streamAiHeaderInsight(payload)) {
          if (ctl.stopped) return;
          acc += chunk;
          setText(acc);
        }
      } catch {
        // Surface as empty text; UI can decide how to flag.
      } finally {
        if (!ctl.stopped) setIsStreaming(false);
      }
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.stopped = true;
    };
    // Stringify the payload for the dep — React only does shallow ref equality.
  }, [JSON.stringify(payload)]);

  return { text, isStreaming };
}
