"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
// Same-origin in the browser (→ `/backend`) so ad blockers don't block it.
import { API_URL } from "@/lib/data";

function SurveyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const preselectedScore = searchParams.get("score");

  const [score, setScore] = useState<number | null>(
    preselectedScore !== null ? parseInt(preselectedScore, 10) : null,
  );
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-submit if score came from the email link click (no comment needed)
  useEffect(() => {
    if (
      preselectedScore !== null &&
      token &&
      score !== null &&
      status === "idle"
    ) {
      // Don't auto-submit — let user optionally add comment
    }
  }, [preselectedScore, token, score, status]);

  if (!token) {
    return (
      <div className="text-center py-16">
        <p className="text-on-surface-variant">
          Invalid survey link. Please use the link from your email.
        </p>
      </div>
    );
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (score === null) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`${API_URL}/api/surveys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, score, comment: comment || undefined }),
      });
      if (res.ok) {
        setStatus("done");
      } else {
        const data = (await res.json()) as { message?: string };
        setErrorMsg(data.message ?? "Something went wrong.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="text-center py-16 max-w-md mx-auto">
        <div className="text-5xl mb-4">🙏</div>
        <h1 className="text-2xl font-bold text-on-surface mb-3">
          Thank you for your feedback!
        </h1>
        <p className="text-on-surface-variant">
          Your input helps us build a better product.
        </p>
        <a
          href="/"
          className="inline-block mt-8 px-6 py-3 bg-primary text-on-primary rounded-full font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          Back to PropertyIQ
        </a>
      </div>
    );
  }

  const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  function scoreColor(s: number): string {
    if (s <= 6) return "bg-red-500 text-white";
    if (s <= 8) return "bg-amber-500 text-white";
    return "bg-emerald-500 text-white";
  }

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-on-surface mb-2 text-center">
        How are we doing?
      </h1>
      <p className="text-on-surface-variant text-center mb-8 text-sm">
        How likely are you to recommend PropertyIQ to a colleague or friend?
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Score selector */}
        <div>
          <div className="flex justify-between text-xs text-on-surface-variant mb-2">
            <span>Not at all likely</span>
            <span>Extremely likely</span>
          </div>
          <div className="flex gap-1 justify-center flex-wrap">
            {SCORES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScore(s)}
                className={`w-10 h-10 rounded-full font-semibold text-sm transition-all ${
                  score === s
                    ? `${scoreColor(s)} ring-2 ring-offset-2 ring-primary scale-110`
                    : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Optional comment */}
        {score !== null && (
          <div>
            <label
              htmlFor="nps-comment"
              className="block text-sm font-medium text-on-surface mb-1"
            >
              Any comments?{" "}
              <span className="text-on-surface-variant font-normal">
                (optional)
              </span>
            </label>
            <textarea
              id="nps-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="What's working well? What could be better?"
              className="w-full px-4 py-3 rounded-xl bg-surface border border-outline text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        )}

        {status === "error" && (
          <p className="text-error text-sm text-center">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={score === null || status === "loading"}
          className="w-full px-6 py-3 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {status === "loading" ? "Submitting..." : "Submit Feedback"}
        </button>
      </form>
    </div>
  );
}

export default function SurveyPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-16 text-on-surface-variant">
          Loading survey...
        </div>
      }
    >
      <SurveyContent />
    </Suspense>
  );
}
