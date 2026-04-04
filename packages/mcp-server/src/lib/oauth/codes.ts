import { randomBytes, createHash } from "node:crypto";
import { requireSupabase } from "./supabase";

interface CreateCodeInput {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge?: string;
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
  console.log(
    `[OAuth:Codes] Creating auth code | clientId=${input.clientId} | userId=${input.userId}`,
  );
  const sb = requireSupabase();
  const code = randomBytes(48).toString("hex");

  const { error } = await sb.from("mcp_oauth_codes").insert({
    code,
    client_id: input.clientId,
    user_id: input.userId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge || null,
  });

  if (error) throw new Error(`Code creation failed: ${error.message}`);
  return code;
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<{ clientId: string; userId: string }> {
  console.log(
    `[OAuth:Codes] Exchanging code=${code.substring(0, 8)}... | redirect_uri=${redirectUri}`,
  );
  const sb = requireSupabase();

  const { data, error } = await sb
    .from("mcp_oauth_codes")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !data) {
    console.log(`[OAuth:Codes] Code status: expired`);
    throw new Error("Invalid authorization code");
  }

  const record = data as CodeRecord;

  if (record.used) {
    console.log(`[OAuth:Codes] Code status: used`);
    throw new Error("Authorization code already used");
  }
  if (new Date(record.expires_at) < new Date()) {
    console.log(`[OAuth:Codes] Code status: expired`);
    throw new Error("Authorization code expired");
  }
  if (record.redirect_uri !== redirectUri) {
    console.log(`[OAuth:Codes] Code status: redirect_mismatch`);
    throw new Error("Redirect URI mismatch");
  }

  // PKCE S256 verification (skip for non-PKCE clients like ChatGPT Actions)
  if (record.code_challenge) {
    if (!codeVerifier) {
      console.log(`[OAuth:Codes] Code status: pkce_missing_verifier`);
      throw new Error("code_verifier required for PKCE flow");
    }
    const expectedChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    if (expectedChallenge !== record.code_challenge) {
      console.log(`[OAuth:Codes] Code status: pkce_failed`);
      throw new Error("PKCE verification failed");
    }
  }

  console.log(`[OAuth:Codes] Code status: valid`);

  // Mark as used
  await sb.from("mcp_oauth_codes").update({ used: true }).eq("code", code);

  console.log(
    `[OAuth:Codes] Code exchange success | clientId=${record.client_id} | userId=${record.user_id}`,
  );
  return { clientId: record.client_id, userId: record.user_id };
}
