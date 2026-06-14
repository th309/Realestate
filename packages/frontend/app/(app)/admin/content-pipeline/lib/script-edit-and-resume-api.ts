import { fetchAPIRaw } from "@/lib/data/fetchers/base";
import type { PipelineStatus } from "./content-pipeline-api";

export async function editScript(
  id: string,
  variantId: "A" | "B",
  newFullText: string,
): Promise<{ nextStatus: PipelineStatus }> {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/runs/${id}/edit-script`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, newFullText }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`editScript failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as {
    success: boolean;
    data: { nextStatus: PipelineStatus };
    error?: string;
  };
  if (!json.success)
    throw new Error(json.error ?? "editScript failed");
  return json.data;
}

/** Resume automated steps from human review without changing the script. */
export async function continuePipelineFromReview(id: string): Promise<{
  nextStatus: PipelineStatus;
}> {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/runs/${id}/continue-pipeline`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`continuePipeline failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as {
    success: boolean;
    data: { nextStatus: PipelineStatus };
    error?: string;
  };
  if (!json.success)
    throw new Error(json.error ?? "continuePipeline failed");
  return json.data;
}
