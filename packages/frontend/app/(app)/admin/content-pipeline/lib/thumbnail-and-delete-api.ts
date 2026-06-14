/**
 * Fetchers for the new Task 2.17 endpoints:
 *   - POST   /runs/:id/thumbnail/regenerate
 *   - POST   /runs/:id/thumbnail/replace   (multipart)
 *   - DELETE /runs/:id                     (state-aware: cancel or hard delete)
 *
 * Lives in its own file to keep `content-pipeline-api.ts` under the
 * 300-line hard limit. Re-exported from the same module path so callers
 * can import either from this file or the index — pick whatever's
 * closest to your component.
 */
import { fetchAPIRaw } from "@/lib/data/fetchers/base";
import type { PipelineStatus } from "./content-pipeline-api";

export async function regenerateThumbnail(runId: string, frame: number) {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/runs/${runId}/thumbnail/regenerate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frame }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`regenerateThumbnail failed: ${res.status} ${body}`);
  }
  return (await res.json()) as {
    success: boolean;
    data: { queued: boolean; frame: number };
  };
}

export async function replaceThumbnail(runId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/runs/${runId}/thumbnail/replace`,
    { method: "POST", body: fd },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`replaceThumbnail failed: ${res.status} ${body}`);
  }
  return (await res.json()) as {
    success: boolean;
    data: { storage_url: string; asset_id: string };
  };
}

export type DeleteRunResult = {
  action: "deleted";
  previousStatus: PipelineStatus;
  wasInFlight: boolean;
  cascade: { storageObjects: number; platformsLive: string[] };
};

export async function deleteRun(id: string): Promise<DeleteRunResult> {
  const res = await fetchAPIRaw(`/api/admin/content-pipeline/runs/${id}`, {
    method: "DELETE",
  });
  // Idempotent: parallel or duplicate client calls after a successful delete should not surface as errors.
  if (res.status === 404) {
    return {
      action: "deleted",
      previousStatus: "cancelled",
      wasInFlight: false,
      cascade: { storageObjects: 0, platformsLive: [] },
    };
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`deleteRun failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as {
    success: boolean;
    data: DeleteRunResult;
  };
  return json.data;
}
