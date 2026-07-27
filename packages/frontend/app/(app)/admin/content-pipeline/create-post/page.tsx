"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CreatePostFlow } from "./CreatePostFlow";
import type { GeneratePostType } from "../lib/posts-api";

const VALID_TYPES: GeneratePostType[] = [
  "image_post",
  "carousel",
  "from_topic",
];

/**
 * Guided flow for making a single post (image, carousel, or from a topic).
 * `?type=` preselects the kind — `from_topic` from the "Topic → post" card,
 * or the "Carousels & images" card opens with no type so the operator picks
 * image vs. carousel first. useSearchParams needs a Suspense boundary here.
 */
export default function CreatePostPage() {
  return (
    <Suspense fallback={<FlowSkeleton />}>
      <CreatePostEntry />
    </Suspense>
  );
}

function CreatePostEntry() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("type");
  const initialType =
    raw && (VALID_TYPES as string[]).includes(raw)
      ? (raw as GeneratePostType)
      : undefined;

  return <CreatePostFlow initialType={initialType} />;
}

function FlowSkeleton() {
  return (
    <div className="min-h-screen bg-surface p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="h-6 w-40 animate-pulse rounded-lg bg-surface-container-low" />
        <div className="h-10 w-72 animate-pulse rounded-lg bg-surface-container-low" />
        <div className="h-64 animate-pulse rounded-xl bg-surface-container-low" />
      </div>
    </div>
  );
}
