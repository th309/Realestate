"use client";

import { useState } from "react";
import Link from "next/link";
import {
  generatePost,
  type GeneratePostPlatform,
  type GeneratePostType,
  type PlannerPost,
} from "../lib/posts-api";
import {
  buildGeneratePayload,
  isGroundingComplete,
  usesTopicGrounding,
  type CreatePostState,
} from "./create-post-machine";
import { TypeStep } from "./type-step";
import { GroundingStep } from "./grounding-step";
import { PlatformStep } from "./platform-step";
import { GeneratingView } from "./generating-view";
import { GeneratedPreview } from "./generated-preview";

type Phase = "type" | "grounding" | "platform" | "generating" | "done";

const TITLES: Record<GeneratePostType, string> = {
  image_post: "Create an image post",
  carousel: "Create a carousel",
  from_topic: "Turn a topic into a post",
};

export function CreatePostFlow({
  initialType,
}: {
  initialType?: GeneratePostType;
}) {
  const typePreselected = initialType != null;
  const [type, setType] = useState<GeneratePostType>(
    initialType ?? "image_post",
  );
  const [marketQuery, setMarketQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<GeneratePostPlatform | undefined>();
  const [phase, setPhase] = useState<Phase>(
    typePreselected ? "grounding" : "type",
  );
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<PlannerPost | null>(null);

  const state: CreatePostState = { type, marketQuery, topic, platform };
  const fromTopic = usesTopicGrounding(type);

  const steps = [
    ...(typePreselected ? [] : [{ key: "type", label: "Type" }]),
    { key: "grounding", label: fromTopic ? "Topic" : "Market" },
    { key: "platform", label: "Platform" },
  ];
  const activeStepKey =
    phase === "generating" || phase === "done" ? "platform" : phase;

  async function runGenerate() {
    const payload = buildGeneratePayload(state);
    if (!payload) return;
    setError(null);
    setPhase("generating");
    try {
      const post = await generatePost(payload);
      setCreated(post);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("platform");
    }
  }

  function reset() {
    setCreated(null);
    setError(null);
    setPlatform(undefined);
    setMarketQuery("");
    setTopic("");
    if (!typePreselected) setType("image_post");
    setPhase(typePreselected ? "grounding" : "type");
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="mx-auto max-w-2xl space-y-6 p-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/admin/content-pipeline"
            className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors duration-200 hover:text-on-surface"
          >
            <span aria-hidden>←</span>
            <span>Studio</span>
          </Link>
          {phase !== "done" && (
            <StepDots steps={steps} activeKey={activeStepKey} />
          )}
        </div>

        <h1 className="text-2xl font-semibold">
          {phase === "type" ? "Create a post" : TITLES[type]}
        </h1>

        {phase === "type" && (
          <TypeStep
            onPick={(t) => {
              setType(t);
              setPhase("grounding");
            }}
          />
        )}

        {phase === "grounding" && (
          <GroundingStep
            type={type}
            marketQuery={marketQuery}
            topic={topic}
            onMarketQuery={setMarketQuery}
            onTopic={setTopic}
            canContinue={isGroundingComplete(state)}
            onBack={typePreselected ? undefined : () => setPhase("type")}
            onContinue={() => setPhase("platform")}
          />
        )}

        {phase === "platform" && (
          <PlatformStep
            selected={platform}
            onSelect={setPlatform}
            onBack={() => setPhase("grounding")}
            onGenerate={runGenerate}
            error={error}
          />
        )}

        {phase === "generating" && <GeneratingView type={type} />}

        {phase === "done" && created && (
          <GeneratedPreview post={created} onReset={reset} />
        )}
      </div>
    </div>
  );
}

/**
 * Linear progress across the flow's real steps. The order carries meaning —
 * you ground the post before you pick where it goes — so a numbered sequence
 * is honest here, not decoration.
 */
function StepDots({
  steps,
  activeKey,
}: {
  steps: { key: string; label: string }[];
  activeKey: string;
}) {
  const activeIndex = steps.findIndex((s) => s.key === activeKey);
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors duration-200 ${
                active
                  ? "bg-primary text-on-primary"
                  : done
                    ? "bg-primary-container text-on-primary-container"
                    : "bg-surface-container-high text-on-surface-variant"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {i + 1}
            </span>
            <span
              className={`hidden text-xs font-medium sm:inline ${
                active ? "text-on-surface" : "text-on-surface-variant"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="h-px w-4 bg-outline-variant" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
