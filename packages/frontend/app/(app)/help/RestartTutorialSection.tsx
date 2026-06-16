"use client";

import { useRouter } from "next/navigation";

export function RestartTutorialSection() {
  const router = useRouter();

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6 mb-8">
      <h3 className="text-lg font-medium text-on-surface mb-2">
        Platform Tutorial
      </h3>
      <p className="text-sm text-on-surface-variant mb-4">
        Take a guided tour of PropertyIQ&apos;s key features. The tutorial
        covers market search, scores, charts, AI assessment, and reports.
      </p>
      <button
        onClick={() => router.push("/tour?resume=fresh")}
        className="px-6 py-2 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 rounded-full transition-colors duration-200"
      >
        Restart Tutorial
      </button>
    </div>
  );
}
