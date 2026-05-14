"use client";

import { useState } from "react";
import { saveAnalysis } from "@/lib/data";

interface Props {
  isPro: boolean;
  payload: () => Parameters<typeof saveAnalysis>[0];
  onVerdictClick: () => void;
  onSaved: (r: { id: string; share_token: string }) => void;
}

export default function ActionsRow({
  isPro,
  payload,
  onVerdictClick,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await saveAnalysis(payload());
      onSaved(r);
    } finally {
      setSaving(false);
    }
  };

  const goToPricing = () => {
    location.assign("/pricing");
  };

  return (
    <div className="flex gap-3">
      <button
        type="button"
        aria-disabled={!isPro}
        onClick={isPro ? onVerdictClick : goToPricing}
        className={`flex-1 h-12 rounded-full bg-primary text-on-primary ${
          !isPro ? "opacity-60" : ""
        }`}
      >
        {isPro ? "AI Verdict" : "🔒 AI Verdict (Pro)"}
      </button>
      <button
        type="button"
        aria-disabled={!isPro}
        disabled={isPro && saving}
        onClick={isPro ? handleSave : goToPricing}
        className={`px-8 h-12 rounded-full bg-surface border border-outline text-on-surface ${
          !isPro ? "opacity-60" : ""
        } disabled:opacity-40`}
      >
        {isPro ? (saving ? "Saving…" : "Save") : "🔒 Save"}
      </button>
    </div>
  );
}
