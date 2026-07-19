"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
// Same-origin in the browser (→ `/backend`) so ad blockers don't block it.
import { API_URL } from "@/lib/data";

const REASON_LABELS: Record<string, string> = {
  busy: "Got busy",
  unsure: "Wasn't sure what to do next",
  curious: "Just curious, not actively looking",
  missing_market: "Couldn't find my market",
  not_found: "Didn't find what I needed",
  confusing: "Confusing or unclear",
  too_expensive: "Too expensive",
  got_what_needed: "Found what I needed, done for now",
  switched_tools: "Switched to another tool",
  not_enough_new: "Not enough new information to keep checking",
  other: "Other",
};
const REASON_CODES = Object.keys(REASON_LABELS);

function WhyDidYouLeaveContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const preselectedReason = searchParams.get("reason");

  const [reasonCode, setReasonCode] = useState<string | null>(
    preselectedReason && REASON_LABELS[preselectedReason]
      ? preselectedReason
      : null,
  );
  const [detail, setDetail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  if (!token) {
    return (
      <div className="text-center py-16">
        <p className="text-on-surface-variant">
          Invalid link. Please use the link from your email.
        </p>
      </div>
    );
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!reasonCode) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`${API_URL}/api/surveys/churn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          reasonCode,
          detail: detail || undefined,
        }),
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
          Thanks for letting us know
        </h1>
        <p className="text-on-surface-variant">
          Your feedback helps us build a better product.
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

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-on-surface mb-2 text-center">
        What happened?
      </h1>
      <p className="text-on-surface-variant text-center mb-8 text-sm">
        No hard feelings — pick the closest reason, add detail if you'd like.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-wrap gap-2 justify-center">
          {REASON_CODES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setReasonCode(code)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                reasonCode === code
                  ? "bg-primary text-on-primary ring-2 ring-offset-2 ring-primary"
                  : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
              }`}
            >
              {REASON_LABELS[code]}
            </button>
          ))}
        </div>

        {reasonCode && (
          <div>
            <label
              htmlFor="churn-detail"
              className="block text-sm font-medium text-on-surface mb-1"
            >
              Anything else?{" "}
              <span className="text-on-surface-variant font-normal">
                (optional)
              </span>
            </label>
            <textarea
              id="churn-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              placeholder="Tell us more..."
              className="w-full px-4 py-3 rounded-xl bg-surface border border-outline text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        )}

        {status === "error" && (
          <p className="text-error text-sm text-center">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={!reasonCode || status === "loading"}
          className="w-full px-6 py-3 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {status === "loading" ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
}

export default function WhyDidYouLeavePage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-16 text-on-surface-variant">
          Loading...
        </div>
      }
    >
      <WhyDidYouLeaveContent />
    </Suspense>
  );
}
