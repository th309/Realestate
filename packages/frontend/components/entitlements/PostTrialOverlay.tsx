"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

interface PostTrialOverlayProps {
  featureName: string;
  usageSummary?: string;
  children: React.ReactNode;
}

export function PostTrialOverlay({
  featureName,
  usageSummary,
  children,
}: PostTrialOverlayProps) {
  return (
    <div className="relative">
      {/* Greyed-out content */}
      <div className="blur-sm pointer-events-none select-none opacity-40">
        {children}
      </div>

      {/* Unlock badge overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-surface-container-high/95 backdrop-blur-sm rounded-2xl shadow-md border border-outline-variant/20 px-6 py-4 max-w-xs text-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-on-surface mb-1">
            Unlock {featureName}
          </p>
          {usageSummary && (
            <p className="text-xs text-on-surface-variant mb-3">
              {usageSummary}
            </p>
          )}
          <Link
            href="/pricing"
            className="inline-flex items-center px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            Upgrade to Pro
          </Link>
        </div>
      </div>
    </div>
  );
}
