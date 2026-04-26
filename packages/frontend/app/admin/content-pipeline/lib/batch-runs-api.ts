import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

export interface BatchMarket {
  id: string;
  geography: "metro" | "zip";
}

export interface CreateBatchRunsRequest {
  format: string;
  markets: BatchMarket[];
  approvalMode?: "auto" | "review" | "draft";
  platforms?: string[];
  formatOptions?: { windowDays?: 30 | 90 | 180 | 365 };
}

export interface CreateBatchRunsResponse {
  batchId: string;
  created: number;
  failed: number;
  runIds: string[];
  errors?: { marketId: string; message: string }[];
}

export async function createBatchRuns(
  req: CreateBatchRunsRequest,
): Promise<CreateBatchRunsResponse> {
  const res = await fetchAPIRaw("/api/admin/content-pipeline/runs/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createBatchRuns failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as { data: CreateBatchRunsResponse };
  return json.data;
}

export function useCreateBatchRuns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBatchRuns,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-pipeline-dashboard"] });
    },
  });
}
