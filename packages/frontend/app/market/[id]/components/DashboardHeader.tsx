"use client";

import Link from "next/link";
import {
  ChevronLeft,
  MapPin,
  RefreshCw,
  Share2,
  Download,
  Lock,
} from "lucide-react";
import { Breadcrumbs } from "@/components/navigation";

interface DashboardHeaderProps {
  geographyId: string;
  geographyName: string;
  geographyType: string;
  updatedDateLabel: string;
  canExport: boolean;
  onRefresh: () => void;
  onShare: () => void;
  onDownload: () => void;
}

export function DashboardHeader({
  geographyId,
  geographyName,
  geographyType,
  updatedDateLabel,
  canExport,
  onRefresh,
  onShare,
  onDownload,
}: DashboardHeaderProps) {
  // Format: "80652 — Roggen, CO" for ZIPs, "Roggen, CO" for others
  const formattedName = formatGeographyDisplayName(
    geographyName,
    geographyType,
    geographyId,
  );

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-outline-variant">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4">
        <Breadcrumbs
          items={[
            { label: "Markets", href: "/market" },
            { label: formattedName },
          ]}
          className="mb-3"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/map"
              className="p-2 -ml-2 rounded-xl hover:bg-surface-container transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-on-surface-variant" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <h1 className="text-xl font-semibold text-on-surface">
                  {formattedName}
                </h1>
              </div>
              <p className="text-sm text-on-surface-variant">
                {geographyType.charAt(0).toUpperCase() + geographyType.slice(1)}{" "}
                &bull; Updated {updatedDateLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-2.5 rounded-xl hover:bg-surface-container transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5 text-on-surface-variant" />
            </button>
            <button
              onClick={onShare}
              className="p-2.5 rounded-xl hover:bg-surface-container transition-colors"
              title="Share"
            >
              <Share2 className="w-5 h-5 text-on-surface-variant" />
            </button>
            <button
              onClick={onDownload}
              className="p-2.5 rounded-xl hover:bg-surface-container transition-colors"
              title={
                canExport ? "Print / Save as PDF" : "Upgrade to Pro to download"
              }
            >
              {canExport ? (
                <Download className="w-5 h-5 text-on-surface-variant" />
              ) : (
                <Lock className="w-5 h-5 text-on-surface-variant" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

/** Capitalize each word in a geography name, with state abbreviation uppercased */
function formatGeographyDisplayName(
  name: string,
  type: string,
  id: string,
): string {
  const parts = name.split(",").map((p) => p.trim());
  const city = parts[0]
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  const state = parts[1]?.toUpperCase();
  const cityState = state ? `${city}, ${state}` : city;

  if (type === "zip") {
    return `${id} \u2014 ${cityState}`;
  }
  return cityState;
}
