import { randomBytes } from "node:crypto";
import { requireSupabase } from "./supabase";
import { config } from "../config";

// ── In-memory token cache (avoids Supabase round-trip on every request) ──
const TOKEN_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

interface TokenCacheEntry {
  userId: string;
  clientId: string;
  cachedAt: number;
}

const tokenCache = new Map<string, TokenCacheEntry>();

interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface TokenRecord {
  access_token: string;
  refresh_token: string;
  client_id: string;
  user_id: string;
  scope: string;
  access_expires_at: string;
  refresh_expires_at: string;
  revoked: boolean;
}

export async function createTokens(
  clientId: string,
  userId: string,
): Promise<TokenPair> {
  console.log(
    `[OAuth:Tokens] Creating tokens | clientId=${clientId} | userId=${userId}`,
  );
  const sb = requireSupabase();
  const accessToken = randomBytes(48).toString("hex");
  const refreshToken = randomBytes(48).toString("hex");

  const { error } = await sb.from("mcp_oauth_tokens").insert({
    access_token: accessToken,
    refresh_token: refreshToken,
    client_id: clientId,
    user_id: userId,
  });

  if (error) {
    console.log(`[OAuth:Tokens] Token creation failed: ${error.message}`);
    throw new Error(`Token creation failed: ${error.message}`);
  }

  // Best-effort coverage signal — fire-and-forget, NEVER block token issuance.
  // Lands a `feature.mcp_connected` row in `user_events` (same ingest endpoint
  // the frontend tracker uses) so the return-surface/drip can react immediately.
  await emitMcpConnectedEvent(clientId, userId);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 3600,
    scope: "mcp",
  };
}

/**
 * Posts a one-time `feature.mcp_connected` coverage event to the backend usage
 * ingest endpoint. Wrapped so any failure (network, timeout, non-2xx) is
 * swallowed — token issuance must never depend on this telemetry call.
 */
async function emitMcpConnectedEvent(
  clientId: string,
  userId: string,
): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeout);
    try {
      await fetch(`${config.apiUrl}/api/usage/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: [
            {
              visitor_id: userId,
              session_id: `mcp-${clientId}`,
              user_id: userId,
              event_category: "feature",
              event_action: "mcp_connected",
              properties: { client_id: clientId },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    /* best-effort: ignore telemetry failures */
  }
}

export async function lookupAccessToken(
  accessToken: string,
): Promise<{ userId: string; clientId: string } | null> {
  const snippet = accessToken.substring(0, 8);

  // Check in-memory cache first
  const cached = tokenCache.get(accessToken);
  if (cached && Date.now() - cached.cachedAt < TOKEN_CACHE_TTL_MS) {
    console.log(`[OAuth:Tokens] Token ${snippet}... cache hit`);
    return { userId: cached.userId, clientId: cached.clientId };
  }

  console.log(`[OAuth:Tokens] Looking up token=${snippet}...`);
  const sb = requireSupabase();

  const { data, error } = await sb
    .from("mcp_oauth_tokens")
    .select("user_id, client_id, access_expires_at, revoked")
    .eq("access_token", accessToken)
    .single();

  if (error || !data) {
    console.log(`[OAuth:Tokens] Token lookup result: not_found`);
    tokenCache.delete(accessToken);
    return null;
  }
  if (data.revoked) {
    console.log(`[OAuth:Tokens] Token lookup result: revoked`);
    tokenCache.delete(accessToken);
    return null;
  }
  if (new Date(data.access_expires_at) < new Date()) {
    console.log(`[OAuth:Tokens] Token lookup result: expired`);
    tokenCache.delete(accessToken);
    return null;
  }

  // Cache the valid token
  tokenCache.set(accessToken, {
    userId: data.user_id,
    clientId: data.client_id,
    cachedAt: Date.now(),
  });
  console.log(`[OAuth:Tokens] Token lookup result: found (cached)`);
  return { userId: data.user_id, clientId: data.client_id };
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenPair> {
  console.log(
    `[OAuth:Tokens] Refreshing token=${refreshToken.substring(0, 8)}...`,
  );
  const sb = requireSupabase();

  const { data, error } = await sb
    .from("mcp_oauth_tokens")
    .select("*")
    .eq("refresh_token", refreshToken)
    .single();

  if (error || !data) {
    console.log(`[OAuth:Tokens] Refresh result: error`);
    throw new Error("Invalid refresh token");
  }

  const record = data as TokenRecord;
  if (record.revoked) {
    console.log(`[OAuth:Tokens] Refresh result: error`);
    throw new Error("Token has been revoked");
  }
  if (new Date(record.refresh_expires_at) < new Date()) {
    console.log(`[OAuth:Tokens] Refresh result: error`);
    throw new Error("Refresh token expired");
  }

  // Revoke old tokens
  await sb
    .from("mcp_oauth_tokens")
    .update({ revoked: true })
    .eq("refresh_token", refreshToken);

  // Issue new pair
  console.log(`[OAuth:Tokens] Refresh result: success`);
  return createTokens(record.client_id, record.user_id);
}
