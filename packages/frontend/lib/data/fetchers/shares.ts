/**
 * SHARE FETCHERS
 *
 * API functions for creating and managing share links.
 */

import { getAuthHeaders } from "./auth-headers";
import { API_URL } from "./base";

export interface CreateMarketShareData {
  geoLevel: string;
  geoId: string;
  geoName: string;
  score?: number;
  homeValue?: string;
  appreciation?: string;
  dom?: string;
  supply?: string;
  channel?: string;
}

export interface MarketShareResult {
  shareToken: string;
  shareUrl: string;
}

/**
 * Create a tracked share link for a market page.
 * Returns the share token and full URL.
 */
export async function createMarketShare(
  data: CreateMarketShareData,
): Promise<MarketShareResult> {
  const authHeaders = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/analytics/shares`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      title: data.geoName,
      description: `Market report for ${data.geoName}`,
      content_type: "market_share",
      content: {
        market: {
          geoLevel: data.geoLevel,
          geoId: data.geoId,
          geoName: data.geoName,
          score: data.score,
          homeValue: data.homeValue,
          appreciation: data.appreciation,
          dom: data.dom,
          supply: data.supply,
          channel: data.channel,
        },
      },
      is_public: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create share: ${response.statusText}`);
  }

  const result = await response.json();
  const token = result.data.share_token;

  return {
    shareToken: token,
    shareUrl: `${window.location.origin}/s/${token}`,
  };
}

/**
 * Send a market share link via email using Resend.
 */
export async function sendMarketShareEmail(data: {
  shareToken: string;
  recipientEmail: string;
  message?: string;
}): Promise<void> {
  const authHeaders = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/analytics/shares/market-email`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to send email");
  }
}
