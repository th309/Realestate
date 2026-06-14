export interface MarketDashboardProps {
  geographyId: string;
  geographyType: "metro" | "county" | "zip";
  userView: "investor" | "homebuyer";
  stateFilter?: string;
}

/** Shape of a single card in the snapshot response (used by MetricCard & MetricCategorySection) */
export interface MetricCardData {
  formattedValue: string;
  value?: number | null;
  percentChange: number | null;
  direction: "up" | "down" | "stable" | null;
  source?: string;
  sourceGeoLevel?: "metro" | "county" | "zip" | "state" | "national" | null;
  isInherited?: boolean;
  isFallback?: boolean;
  isLoading?: boolean;
}

/** Geography info returned by useMarketSnapshot */
export interface GeographyInfo {
  name: string;
}

/** Premium geography levels that require entitlements */
export const PREMIUM_GEO_LEVELS = ["county", "zip", "tract"];
