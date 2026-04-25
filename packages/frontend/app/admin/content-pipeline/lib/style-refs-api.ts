import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";

export interface StyleReference {
  id: string;
  user_id: string;
  kind: string;
  label: string;
  source_url: string | null;
  preview_strip_url: string | null;
  extracted_attributes: {
    palette?: string[];
    typography?: string[];
    layout?: string[];
    summary?: string;
  };
  vision_cost_usd: number;
  created_at: string;
}

export async function fetchStyleReferences(): Promise<StyleReference[]> {
  const res = await fetchAPI<{ data: { references: StyleReference[] } }>(
    "/api/admin/content-pipeline/style-references",
  );
  return res.data.references;
}

export async function createStyleReference(body: {
  label: string;
  kind: "thumbnail" | "video" | "pdf" | "general";
  source_url: string;
}): Promise<StyleReference> {
  const res = await fetchAPIRaw(
    "/api/admin/content-pipeline/style-references",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`createStyleReference failed: ${res.status} ${t}`);
  }
  const json = (await res.json()) as { data: StyleReference };
  return json.data;
}

export async function reExtractStyleReference(
  id: string,
): Promise<StyleReference> {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/style-references/${id}/re-extract`,
    { method: "POST" },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`reExtract failed: ${res.status} ${t}`);
  }
  const json = (await res.json()) as { data: StyleReference };
  return json.data;
}

export async function deleteStyleReference(id: string): Promise<void> {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/style-references/${id}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error(`delete failed: ${res.status}`);
}
