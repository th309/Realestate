/**
 * GenerationProgress
 *
 * Premium loading experience that connects to the backend SSE endpoint
 * to show real pipeline stages as the report generates. Displays a
 * vertical timeline with checkmarks for completed stages, an animated
 * indicator for the current stage, and an elapsed time counter.
 */

"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Database,
  BarChart3,
  GitCompare,
  Newspaper,
  FileText,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { API_URL } from "@/lib/data/fetchers/base";
import { getAuthHeaders } from "@/lib/data/fetchers/auth-headers";

// ---------------------------------------------------------------------------
// Stage configuration
// ---------------------------------------------------------------------------

interface StageConfig {
  id: string;
  label: string;
  icon: React.ElementType;
}

const PIPELINE_STAGES: StageConfig[] = [
  {
    id: "fetching_data",
    label: "Fetching market data from 6 sources",
    icon: Database,
  },
  {
    id: "scouting_news",
    label: "Scouting recent news and economic signals",
    icon: Newspaper,
  },
  {
    id: "computing_insights",
    label: "Calculating your affordability percentile across 400+ metros",
    icon: BarChart3,
  },
  {
    id: "comparing_benchmarks",
    label: "Identifying historical market parallels",
    icon: GitCompare,
  },
  {
    id: "building_outline",
    label: "Building analytical outline",
    icon: FileText,
  },
  {
    id: "generating_analysis",
    label: "Generating deep market analysis",
    icon: Sparkles,
  },
  {
    id: "computing_scenarios",
    label: "Computing forward-looking scenarios",
    icon: TrendingUp,
  },
  {
    id: "finalizing",
    label: "Finalizing your personalized report",
    icon: CheckCircle2,
  },
];

const STAGE_INDEX_MAP = new Map(PIPELINE_STAGES.map((s, i) => [s.id, i]));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GenerationProgressProps {
  reportId: string;
  onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GenerationProgress({
  reportId,
  onComplete,
}: GenerationProgressProps) {
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("generating");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());
  const hasCompletedRef = useRef(false);

  const handleProgressData = useCallback(
    (data: {
      status: string;
      generation_stage: string | null;
      generation_stage_detail: string | null;
    }) => {
      if (data.generation_stage) {
        setCurrentStageId(data.generation_stage);
      }
      setStatus(data.status);

      if (data.status === "ready" && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        // Brief delay to show the "finalizing" checkmark before transitioning
        setTimeout(() => onComplete(), 1500);
      }

      if (data.status === "failed") {
        setErrorMessage("Report generation failed. Please try again.");
      }
    },
    [onComplete],
  );

  // Connect to SSE endpoint for real-time progress
  useEffect(() => {
    let cancelled = false;

    async function connectSSE() {
      const headers = await getAuthHeaders();
      const authToken = headers.Authorization?.replace("Bearer ", "");

      // EventSource doesn't support custom headers, so fall back to polling
      // with fetch for authenticated endpoints
      if (!authToken) return;

      const poll = async () => {
        if (cancelled) return;
        try {
          const response = await fetch(
            `${API_URL}/api/reports/${reportId}/progress`,
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
                Accept: "text/event-stream",
              },
              credentials: "include",
            },
          );

          if (!response.ok || !response.body) return;

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  handleProgressData(parsed);
                  if (parsed.status === "ready" || parsed.status === "failed") {
                    cancelled = true;
                    return;
                  }
                } catch {
                  // Ignore malformed JSON lines
                }
              }
            }
          }
        } catch {
          // SSE connection failed — the component will still show
          // timer-based progress via the elapsed counter
        }
      };

      poll();
    }

    connectSSE();

    return () => {
      cancelled = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [reportId, handleProgressData]);

  // Elapsed time counter
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const currentStageIndex = currentStageId
    ? (STAGE_INDEX_MAP.get(currentStageId) ?? -1)
    : -1;

  const isComplete = status === "ready";
  const isFailed = status === "failed";

  // Error state
  if (isFailed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-full max-w-lg mx-auto text-center px-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-medium text-on-surface mb-2">
            Report generation failed
          </h2>
          <p className="text-sm text-on-surface-variant mb-6">
            {errorMessage || "An unexpected error occurred."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-full max-w-lg mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative mb-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-surface flex items-center justify-center shadow-inner">
                {isComplete ? (
                  <CheckCircle2 className="w-7 h-7 text-green-600" />
                ) : (
                  <Loader2 className="w-7 h-7 text-primary animate-spin" />
                )}
              </div>
            </div>
          </div>
          <h2 className="text-xl font-medium text-on-surface mb-1">
            {isComplete ? "Your report is ready" : "Generating your report"}
          </h2>
          <p className="text-sm text-on-surface-variant">
            {isComplete
              ? "Analysis complete."
              : "This usually takes 1\u20133 minutes."}
          </p>
        </div>

        {/* Vertical timeline */}
        <div className="bg-surface-container-low rounded-xl shadow-sm overflow-hidden">
          <div className="p-4">
            {PIPELINE_STAGES.map((stage, index) => {
              const Icon = stage.icon;
              const isActive = index === currentStageIndex && !isComplete;
              const isDone = index < currentStageIndex || isComplete;
              const isPending = index > currentStageIndex && !isComplete;

              return (
                <div key={stage.id} className="flex items-start gap-3 relative">
                  {/* Vertical connector line */}
                  {index < PIPELINE_STAGES.length - 1 && (
                    <div
                      className={`absolute left-[18px] top-[36px] w-0.5 h-[calc(100%-12px)]
                        transition-colors duration-400
                        ${isDone ? "bg-green-400" : "bg-outline-variant"}`}
                    />
                  )}

                  {/* Icon circle */}
                  <div
                    className={`relative z-10 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                      transition-all duration-400
                      ${
                        isDone
                          ? "bg-green-500 text-white"
                          : isActive
                            ? "bg-primary text-on-primary"
                            : "bg-on-surface/8 text-on-surface-variant"
                      }`}
                  >
                    {isDone ? (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>

                  {/* Label */}
                  <div
                    className={`flex-1 min-w-0 pb-4 pt-2
                      ${isPending ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm font-medium leading-tight
                          ${
                            isActive || isDone
                              ? "text-on-surface"
                              : "text-on-surface-variant"
                          }`}
                      >
                        {stage.label}
                      </p>
                      {isActive && (
                        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Elapsed time */}
        <div className="mt-4 text-center">
          <span className="text-xs text-on-surface-variant">
            {formatElapsedTime(elapsedSeconds)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsedTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s elapsed`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s elapsed`;
}
