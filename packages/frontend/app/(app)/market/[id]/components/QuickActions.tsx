"use client";

import Link from "next/link";
import { TrendingUp, MapPin } from "lucide-react";

interface QuickActionsProps {
  geographyId: string;
  geographyType: string;
  geographyName: string;
  userView: "investor" | "homebuyer";
  stateFilter?: string;
}

export function QuickActions({
  geographyId,
  geographyType,
  geographyName,
  userView,
  stateFilter,
}: QuickActionsProps) {
  const stateParam = stateFilter ? `&mstate=${stateFilter}` : "";

  return (
    <div className="flex flex-wrap gap-3 pt-2">
      <Link
        href={`/reports?rtype=${userView}&mid=${geographyId}&mname=${encodeURIComponent(geographyName)}&mtype=${geographyType}${stateParam}`}
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary font-medium rounded-full hover:bg-primary/90 transition-colors shadow-md"
      >
        Generate Full Report
      </Link>
      <Link
        href={`/graphs?mid=${geographyId}&mname=${encodeURIComponent(geographyName)}&mtype=${geographyType}${stateParam}`}
        className="inline-flex items-center gap-2 px-6 py-3 bg-surface-container text-on-surface font-medium rounded-full hover:bg-surface-container-high transition-colors border border-outline-variant"
      >
        <TrendingUp className="w-4 h-4" />
        View Trends
      </Link>
      <Link
        href={`/map?focus=${geographyId}`}
        className="inline-flex items-center gap-2 px-6 py-3 bg-surface-container text-on-surface font-medium rounded-full hover:bg-surface-container-high transition-colors border border-outline-variant"
      >
        <MapPin className="w-4 h-4" />
        Explore Map
      </Link>
    </div>
  );
}
