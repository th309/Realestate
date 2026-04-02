import { randomUUID } from "node:crypto";
import { requireSupabase } from "./supabase";

interface RegisterInput {
  client_name?: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
}

interface ClientRecord {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
}

export async function registerClient(
  input: RegisterInput,
): Promise<ClientRecord> {
  const sb = requireSupabase();
  const clientId = randomUUID();
  const record = {
    client_id: clientId,
    client_name: input.client_name || "",
    redirect_uris: input.redirect_uris,
    grant_types: input.grant_types || ["authorization_code", "refresh_token"],
    response_types: input.response_types || ["code"],
  };

  const { error } = await sb.from("mcp_oauth_clients").insert(record);
  if (error) throw new Error(`Client registration failed: ${error.message}`);

  return record;
}

export async function getClient(
  clientId: string,
): Promise<ClientRecord | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("mcp_oauth_clients")
    .select(
      "client_id, client_name, redirect_uris, grant_types, response_types",
    )
    .eq("client_id", clientId)
    .single();

  if (error || !data) return null;
  return data as ClientRecord;
}
