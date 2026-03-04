"use client";

import { useTour } from "@/app/onboarding";
import { useRouter } from "next/navigation";

export function RestartTutorialSection() {
  const { restartTour } = useTour();
  const router = useRouter();

  const handleRestart = () => {
    restartTour();
    router.push("/map");
  };

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
        onClick={handleRestart}
        className="px-6 py-2 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 rounded-full transition-colors duration-200"
      >
        Restart Tutorial
      </button>
    </div>
  );
}
