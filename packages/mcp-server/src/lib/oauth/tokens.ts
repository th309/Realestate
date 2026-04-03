import { randomBytes } from "node:crypto";
import { requireSupabase } from "./supabase";

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

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 3600,
    scope: "mcp",
  };
}

export async function lookupAccessToken(
  accessToken: string,
): Promise<{ userId: string; clientId: string } | null> {
  console.log(
    `[OAuth:Tokens] Looking up token=${accessToken.substring(0, 8)}...`,
  );
  const sb = requireSupabase();

  const { data, error } = await sb
    .from("mcp_oauth_tokens")
    .select("user_id, client_id, access_expires_at, revoked")
    .eq("access_token", accessToken)
    .single();

  if (error || !data) {
    console.log(`[OAuth:Tokens] Token lookup result: not_found`);
    return null;
  }
  if (data.revoked) {
    console.log(`[OAuth:Tokens] Token lookup result: revoked`);
    return null;
  }
  if (new Date(data.access_expires_at) < new Date()) {
    console.log(`[OAuth:Tokens] Token lookup result: expired`);
    return null;
  }

  console.log(`[OAuth:Tokens] Token lookup result: found`);
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
