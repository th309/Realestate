/**
 * Custom Research Brief Page
 *
 * Orchestrates the three-step research brief flow:
 * 1. TopicSelector — user picks or types a research question
 * 2. ClarifyingQuestions — answer AI-generated scoping questions
 * 3. ResearchProgress — wait for the AI pipeline to complete
 * 4. Display the finished research brief narrative
 *
 * Gated behind the `custom_research` feature entitlement.
 */

"use client";

import React, { useState, useCallback, useRef } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";
import { EntitlementGate } from "@/components/entitlements/EntitlementGate";
import { PaywallCard } from "@/components/entitlements/PaywallCard";
import {
  fetchClarifyingQuestions,
  generateResearchBrief,
  type ClarifyingQuestion,
  type ResearchBriefResponse,
} from "@/lib/data";
import { TopicSelector } from "./components/TopicSelector";
import { ClarifyingQuestions } from "./components/ClarifyingQuestions";
import { ResearchProgress } from "./components/ResearchProgress";

// ---------------------------------------------------------------------------
// Flow steps
// ---------------------------------------------------------------------------

type FlowStep = "topic" | "clarify" | "generating" | "result";

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ResearchBriefPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <EntitlementGate
          type="feature"
          id="custom_research"
          fallback={
            <PaywallCard
              type="feature"
              id="custom_research"
              title="Custom Research Brief"
              description="Get AI-powered research briefs backed by PropertyIQ data. Ask any real estate research question and receive a detailed analysis."
            />
          }
        >
          <ResearchBriefFlow />
        </EntitlementGate>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flow orchestrator (inner component to keep page.tsx clean)
// ---------------------------------------------------------------------------

function ResearchBriefFlow() {
  const [step, setStep] = useState<FlowStep>("topic");
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [result, setResult] = useState<ResearchBriefResponse | null>(null);
  const [loadingClarify, setLoadingClarify] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Step 1: User submits a topic -> fetch clarifying questions
  const handleTopicSubmit = useCallback(async (selectedTopic: string) => {
    setTopic(selectedTopic);
    setLoadingClarify(true);
    setError(null);

    try {
      const response = await fetchClarifyingQuestions(selectedTopic);
      setQuestions(response.questions);
      setStep("clarify");
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to get clarifying questions";
      setError(message);
    } finally {
      setLoadingClarify(false);
    }
  }, []);

  // Step 2: User answers questions -> start research generation
  const handleClarifySubmit = useCallback(
    async (answers: Record<string, string>) => {
      setStep("generating");
      setGenerating(true);
      setError(null);

      // Abort any previous in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await generateResearchBrief(
          topic,
          answers,
          undefined,
          controller.signal,
        );
        setResult(response);
        setGenerating(false);
        setStep("result");
      } catch (generateError) {
        if (controller.signal.aborted) return;
        const message =
          generateError instanceof Error
            ? generateError.message
            : "Failed to generate research brief";
        setError(message);
        setGenerating(false);
      }
    },
    [topic],
  );

  // Go back to the clarify step from generating (retry)
  const handleRetry = useCallback(() => {
    setError(null);
    setStep("clarify");
  }, []);

  // Start over from the beginning
  const handleStartOver = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setStep("topic");
    setTopic("");
    setQuestions([]);
    setResult(null);
    setError(null);
    setGenerating(false);
  }, []);

  // Go back from clarify to topic
  const handleBackToTopic = useCallback(() => {
    setStep("topic");
    setQuestions([]);
    setError(null);
  }, []);

  return (
    <>
      {/* Topic selection step */}
      {step === "topic" && (
        <TopicSelector onSubmit={handleTopicSubmit} loading={loadingClarify} />
      )}

      {/* Clarifying questions step */}
      {step === "clarify" && (
        <ClarifyingQuestions
          topic={topic}
          questions={questions}
          onSubmit={handleClarifySubmit}
          onBack={handleBackToTopic}
        />
      )}

      {/* Generation progress step */}
      {step === "generating" && (
        <ResearchProgress
          isComplete={false}
          error={error}
          onRetry={handleRetry}
        />
      )}

      {/* Result display */}
      {step === "result" && result && (
        <ResearchBriefResult
          topic={topic}
          result={result}
          onStartOver={handleStartOver}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Result display
// ---------------------------------------------------------------------------

interface ResearchBriefResultProps {
  topic: string;
  result: ResearchBriefResponse;
  onStartOver: () => void;
}

function ResearchBriefResult({
  topic,
  result,
  onStartOver,
}: ResearchBriefResultProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header actions */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/reports"
          className="inline-flex items-center gap-2 text-sm font-medium
            text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All Reports
        </Link>
        <button
          type="button"
          onClick={onStartOver}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full
            text-sm font-medium text-primary
            hover:bg-primary/8
            transition-colors duration-200"
        >
          <RotateCcw className="w-4 h-4" />
          New Research
        </button>
      </div>

      {/* Topic header */}
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-on-surface tracking-tight">
          {topic}
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Generated in {(result.duration_ms / 1000).toFixed(1)}s
          {result.tool_call_count > 0 &&
            ` using ${result.tool_call_count} data queries`}
        </p>
      </div>

      {/* Narrative content */}
      <div
        className="bg-surface-container-low rounded-xl p-6 shadow-sm
          prose prose-sm max-w-none
          prose-headings:text-on-surface prose-headings:font-medium
          prose-p:text-on-surface-variant prose-p:leading-relaxed
          prose-strong:text-on-surface
          prose-li:text-on-surface-variant"
      >
        {result.narrative.split("\n").map((paragraph, index) => {
          const trimmed = paragraph.trim();
          if (!trimmed) return null;

          // Render markdown-style headings
          if (trimmed.startsWith("### ")) {
            return (
              <h3
                key={index}
                className="text-base font-medium text-on-surface mt-5 mb-2"
              >
                {trimmed.slice(4)}
              </h3>
            );
          }
          if (trimmed.startsWith("## ")) {
            return (
              <h2
                key={index}
                className="text-lg font-medium text-on-surface mt-6 mb-3"
              >
                {trimmed.slice(3)}
              </h2>
            );
          }
          if (trimmed.startsWith("# ")) {
            return (
              <h2
                key={index}
                className="text-xl font-medium text-on-surface mt-6 mb-3"
              >
                {trimmed.slice(2)}
              </h2>
            );
          }
          // Render bullet points
          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            return (
              <li key={index} className="ml-4 text-on-surface-variant">
                {trimmed.slice(2)}
              </li>
            );
          }

          return (
            <p
              key={index}
              className="text-on-surface-variant leading-relaxed mb-3"
            >
              {trimmed}
            </p>
          );
        })}
      </div>
    </div>
  );
}
