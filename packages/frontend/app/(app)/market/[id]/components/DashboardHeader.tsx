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
import { formatGeoDisplayName } from "@/lib/data";

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

/** Format geography display: "80652 — Roggen, CO" for ZIPs, "Title Case, ST" for others */
function formatGeographyDisplayName(
  name: string,
  type: string,
  id: string,
): string {
  // Title-case the city and uppercase the state via the shared display helper,
  // which preserves already-correct mixed-case names (e.g. "DeKalb County").
  const cityState = formatGeoDisplayName(name);

  if (type === "zip") {
    // If the backend gave no usable city/state (empty or just the ZIP itself),
    // show the ZIP only once.
    if (!cityState || cityState === id || !name.includes(",")) {
      return id;
    }
    return `${id} \u2014 ${cityState}`;
  }
  return cityState || id;
}
