const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface MarketRecommendation {
  geography_type: string;
  geography_id: string;
  geography_name: string;
  score: number;
  reason: string;
}

export async function fetchMarketsToWatch(): Promise<MarketRecommendation[]> {
  const res = await fetch(`${API_URL}/api/recommendations/markets-to-watch`, {
    credentials: 'include',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}
