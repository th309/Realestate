const RECENT_MARKETS_KEY = "propertyiq-recent-markets";

export interface RecentMarket {
  id: string;
  name: string;
  type: "metro" | "county" | "zip";
  visitedAt: number;
}

export function getRecentMarkets(): RecentMarket[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_MARKETS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addRecentMarket(market: Omit<RecentMarket, "visitedAt">) {
  if (typeof window === "undefined") return;
  try {
    const recent = getRecentMarkets().filter((m) => m.id !== market.id);
    recent.unshift({ ...market, visitedAt: Date.now() });
    localStorage.setItem(
      RECENT_MARKETS_KEY,
      JSON.stringify(recent.slice(0, 10)),
    );
  } catch {
    // Ignore storage errors
  }
}
