import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";

export interface MagnetDefinition {
  kind: string;
  display_name: string;
  description: string | null;
  audience: string;
  template_path: string;
  data_method: string;
  email_template_key: string;
  landing_page_path: string;
  cover_image_url: string | null;
  enabled: boolean;
  version: number;
  updated_at: string;
  delivered_count?: number;
  converted_to_paid_pct?: number;
}

export interface FormatBinding {
  id: string;
  format: string;
  magnet_kind: string;
  cta_text: string;
  weight: number;
  enabled: boolean;
}

export interface UpdateMagnetPatch {
  display_name?: string;
  description?: string;
  audience?: "investor" | "agent" | "broker" | "mixed";
  cover_image_url?: string;
  enabled?: boolean;
}

export interface BindMagnetBody {
  format: string;
  magnet_kind: string;
  cta_text: string;
  weight?: number;
  enabled?: boolean;
}

export interface UpdateBindingPatch {
  cta_text?: string;
  weight?: number;
  enabled?: boolean;
}

export async function fetchMagnetLibrary() {
  const res = await fetchAPI<{
    data: { magnets: MagnetDefinition[]; bindings: FormatBinding[] };
  }>("/api/admin/content-pipeline/magnets");
  return res.data;
}

export async function updateMagnet(kind: string, patch: UpdateMagnetPatch) {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/magnets/${encodeURIComponent(kind)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`updateMagnet failed: ${res.status} ${body}`);
  }
  return res.json();
}

export async function createBinding(body: BindMagnetBody) {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/magnets/bindings`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`createBinding failed: ${res.status} ${t}`);
  }
  return res.json();
}

export async function updateBinding(id: string, patch: UpdateBindingPatch) {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/magnets/bindings/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`updateBinding failed: ${res.status} ${t}`);
  }
  return res.json();
}

export async function deleteBinding(id: string) {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/magnets/bindings/${id}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`deleteBinding failed: ${res.status} ${t}`);
  }
  return res.json();
}
