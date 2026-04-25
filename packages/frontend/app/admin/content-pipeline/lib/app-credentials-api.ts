import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";
import type { AppCredentialStatus } from "./content-pipeline-api";

export async function fetchAppCredentialStatus(
  platform: string,
): Promise<AppCredentialStatus> {
  const res = await fetchAPI<{ data: AppCredentialStatus }>(
    `/api/admin/content-pipeline/platforms/${encodeURIComponent(platform)}/app-credentials`,
  );
  return res.data;
}

export async function setAppCredentials(
  platform: string,
  body: { clientId: string; clientSecret: string; notes?: string },
): Promise<AppCredentialStatus> {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/platforms/${encodeURIComponent(platform)}/app-credentials`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`setAppCredentials failed: ${res.status} ${t}`);
  }
  const json = (await res.json()) as { data: AppCredentialStatus };
  return json.data;
}

export async function clearAppCredentials(
  platform: string,
): Promise<AppCredentialStatus> {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/platforms/${encodeURIComponent(platform)}/app-credentials`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error(`clearAppCredentials failed: ${res.status}`);
  const json = (await res.json()) as { data: AppCredentialStatus };
  return json.data;
}
