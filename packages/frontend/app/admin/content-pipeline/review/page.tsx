"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchReviewQueue, fetchRun } from "../lib/content-pipeline-api";
import { ReviewCard } from "./review-card";

export default function ReviewQueuePage() {
  const [cursor, setCursor] = useState(0);
  const { data: queue = [], refetch } = useQuery({
    queryKey: ["review-queue"],
    queryFn: fetchReviewQueue,
  });
  const currentRun = queue[cursor];
  const { data: detail } = useQuery({
    queryKey: ["review-run", currentRun?.id],
    queryFn: () => (currentRun ? fetchRun(currentRun.id) : null),
    enabled: !!currentRun,
  });

  async function handleNext() {
    if (cursor + 1 < queue.length) {
      setCursor(cursor + 1);
    } else {
      await refetch();
      setCursor(0);
    }
  }

  if (!queue.length) {
    return (
      <div className="p-8 text-center text-outline">
        All caught up. No runs waiting.
      </div>
    );
  }
  if (!detail) return <div className="p-8">Loading...</div>;

  return (
    <div>
      <div className="text-center text-sm text-outline pt-4">
        {cursor + 1} of {queue.length} waiting
      </div>
      <ReviewCard run={detail} onNext={handleNext} />
    </div>
  );
}
