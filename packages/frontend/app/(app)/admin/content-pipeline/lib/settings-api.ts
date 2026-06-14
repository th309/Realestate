/**
 * Fetchers for content-pipeline /settings endpoints. Split out from
 * `content-pipeline-api.ts` to keep that file under the 300-line hard
 * limit. Consumed by:
 *   - settings/page.tsx (Settings page shell)
 *   - settings/format-* (per-format defaults editor)
 *   - lib/use-format-mutations.ts (PATCH wrapper)
 */
import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";

export async function fetchSettings() {
  const res = await fetchAPI<{ data: any }>(
    "/api/admin/content-pipeline/settings",
  );
  return res.data;
}

export async function updateSettings(patch: { strictness?: string }) {
  return fetchAPIRaw("/api/admin/content-pipeline/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export interface FormatDefaultPatch {
  default_approval_mode?: "auto" | "review" | "draft";
  default_tts_voice_id?: string;
  default_platforms?: string[];
  enabled?: boolean;
}

export async function updateFormatDefault(
  format: string,
  patch: FormatDefaultPatch,
) {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/settings/formats/${encodeURIComponent(format)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`updateFormatDefault failed: ${res.status} ${body}`);
  }
  return res.json();
}

export interface TtsVoice {
  id: string;
  provider: string;
  provider_voice_id: string;
  display_name: string;
  audience_tag: string;
  sample_url: string | null;
  cost_per_1k_chars: number;
  enabled: boolean;
}

export async function fetchVoices(): Promise<TtsVoice[]> {
  const res = await fetchAPI<{ data: { voices: TtsVoice[] } }>(
    "/api/admin/content-pipeline/settings/voices",
  );
  return res.data.voices;
}

export async function pausePipeline() {
  return fetchAPIRaw("/api/admin/content-pipeline/pause", { method: "POST" });
}

export async function resumePipeline() {
  return fetchAPIRaw("/api/admin/content-pipeline/resume", { method: "POST" });
}
