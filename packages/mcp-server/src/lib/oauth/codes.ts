import { randomBytes, createHash } from "node:crypto";
import { requireSupabase } from "./supabase";

interface CreateCodeInput {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
}

interface CodeRecord {
  code: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string;
  expires_at: string;
  used: boolean;
}

export async function createAuthCode(input: CreateCodeInput): Promise<string> {
  const sb = requireSupabase();
  const code = randomBytes(48).toString("hex");

  const { error } = await sb.from("mcp_oauth_codes").insert({
    code,
    client_id: input.clientId,
    user_id: input.userId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
  });

  if (error) throw new Error(`Code creation failed: ${error.message}`);
  return code;
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<{ clientId: string; userId: string }> {
  const sb = requireSupabase();

  const { data, error } = await sb
    .from("mcp_oauth_codes")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !data) throw new Error("Invalid authorization code");

  const record = data as CodeRecord;

  if (record.used) throw new Error("Authorization code already used");
  if (new Date(record.expires_at) < new Date())
    throw new Error("Authorization code expired");
  if (record.redirect_uri !== redirectUri)
    throw new Error("Redirect URI mismatch");

  // PKCE S256 verification
  const expectedChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  if (expectedChallenge !== record.code_challenge) {
    throw new Error("PKCE verification failed");
  }

  // Mark as used
  await sb.from("mcp_oauth_codes").update({ used: true }).eq("code", code);

  return { clientId: record.client_id, userId: record.user_id };
}
