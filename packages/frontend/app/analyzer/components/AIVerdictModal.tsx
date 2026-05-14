"use client";

import { useEffect, useState } from "react";
import { streamAiVerdict, type AiVerdictResult } from "@/lib/data";

interface Props {
  input: unknown;
  result: unknown;
  marketContext?: unknown;
  onClose: () => void;
  onComplete?: (v: AiVerdictResult) => void;
}

export default function AIVerdictModal({
  input,
  result,
  marketContext,
  onClose,
  onComplete,
}: Props) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<AiVerdictResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let acc = "";
        for await (const chunk of streamAiVerdict({
          input,
          result,
          marketContext,
        })) {
          if (cancelled) return;
          acc += chunk;
          setText(acc);
        }
        const v: AiVerdictResult = JSON.parse(acc);
        if (!cancelled) {
          setParsed(v);
          onComplete?.(v);
        }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm"
    >
      <div className="bg-surface rounded-[28px] p-8 max-w-xl w-full shadow-lg">
        <h2 className="text-2xl font-light text-on-surface mb-4">
          AI Deal Verdict
        </h2>
        {err && <p className="text-error">{err}</p>}
        {parsed ? (
          <>
            <div
              className={`inline-block px-4 py-1 rounded-full text-sm font-medium mb-4 ${
                parsed.verdict === "buy"
                  ? "bg-tertiary text-on-tertiary"
                  : parsed.verdict === "pass"
                    ? "bg-error text-on-error"
                    : "bg-warning text-on-warning"
              }`}
            >
              {parsed.verdict.toUpperCase()}
            </div>
            {parsed.target_price && (
              <p className="text-on-surface mb-3">
                Target offer:{" "}
                <strong>${parsed.target_price.toLocaleString()}</strong>
              </p>
            )}
            <p className="text-on-surface mb-4">{parsed.reasoning}</p>
            <h3 className="text-sm font-bold text-tertiary">Strengths</h3>
            <ul className="list-disc list-inside text-on-surface mb-3">
              {parsed.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <h3 className="text-sm font-bold text-error">Risks</h3>
            <ul className="list-disc list-inside text-on-surface">
              {parsed.risks.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="font-mono text-sm text-on-surface-variant whitespace-pre-wrap">
            {text || "Streaming…"}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 px-6 py-2 rounded-full bg-primary text-on-primary"
        >
          Close
        </button>
      </div>
    </div>
  );
}
