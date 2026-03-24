"use client";

import { motion } from "framer-motion";
import { RefreshCw, Lock } from "lucide-react";
import Link from "next/link";

export function DashboardLoadingSpinner() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <motion.div
        className="text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="w-12 h-12 border-4 border-surface-container-high border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-on-surface-variant">Loading market data...</p>
      </motion.div>
    </div>
  );
}

export function DashboardErrorState({
  errorMessage,
  onRetry,
}: {
  errorMessage: string;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 mx-auto bg-error/10 rounded-2xl flex items-center justify-center mb-4">
          <span className="text-3xl">{"\u26A0\uFE0F"}</span>
        </div>
        <h2 className="text-xl font-semibold text-on-surface mb-2">
          Unable to Load Market Data
        </h2>
        <p className="text-on-surface-variant mb-6">{errorMessage}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-full hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>
  );
}

export function DashboardGeoGateWall({
  geographyType,
}: {
  geographyType: string;
}) {
  return (
    <div
      data-testid="geo-gate-wall"
      className="min-h-screen bg-surface flex items-center justify-center"
    >
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-on-surface mb-2">
          {geographyType.charAt(0).toUpperCase() + geographyType.slice(1)} Level
          Data
        </h2>
        <p className="text-on-surface-variant mb-6">
          Access detailed {geographyType}-level market data with a Pro
          subscription. Get granular insights to make more informed decisions.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/pricing#data-depth"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full hover:bg-primary/90 transition-colors"
          >
            Upgrade to Pro
          </Link>
          <Link href="/map" className="text-sm text-primary hover:underline">
            &larr; Back to Map
          </Link>
        </div>
      </div>
    </div>
  );
}
