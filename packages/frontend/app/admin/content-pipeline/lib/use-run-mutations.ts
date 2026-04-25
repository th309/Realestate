"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  approveRun,
  cancelRun,
  rejectRun,
  retryRun,
} from "./content-pipeline-api";
import {
  deleteRun,
  regenerateThumbnail,
  replaceThumbnail,
  type DeleteRunResult,
} from "./thumbnail-and-delete-api";
import { useToast } from "./toast";

/**
 * One place for every operator-driven mutation. Handles:
 *   - React Query invalidation (single source of truth for query keys)
 *   - Toast on success/error
 *   - Optimistic queue advancement is the caller's responsibility
 *     (call navigator.removeCurrent() in onMutate before invoking mutate),
 *     so the hooks stay agnostic of the navigator and reusable from the
 *     dashboard hover overlay too.
 */

const KEYS = {
  dashboard: ["content-pipeline-dashboard"] as const,
  reviewQueue: ["review-queue"] as const,
  reviewRun: (id: string) => ["review-run", id] as const,
  assetUrl: (id: string, kind: string) =>
    ["content-pipeline-asset-url", id, kind] as const,
};

function invalidateRunListsAndDetail(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
) {
  qc.invalidateQueries({ queryKey: KEYS.dashboard });
  qc.invalidateQueries({ queryKey: KEYS.reviewQueue });
  qc.removeQueries({ queryKey: KEYS.reviewRun(id) });
}

export function useApproveRun() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => approveRun(id),
    onSuccess: (_data, id) => {
      invalidateRunListsAndDetail(qc, id);
      toast.success("Approved — moved to publishing");
    },
    onError: (err: Error) => toast.error(`Approve failed: ${err.message}`),
  });
}

export function useRejectRun() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectRun(id, reason),
    onSuccess: (_data, { id }) => {
      invalidateRunListsAndDetail(qc, id);
      toast.success("Rejected");
    },
    onError: (err: Error) => toast.error(`Reject failed: ${err.message}`),
  });
}

export function useCancelRun() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      cancelRun(id, reason),
    onSuccess: (_data, { id }) => {
      invalidateRunListsAndDetail(qc, id);
      toast.success("Run cancelled");
    },
    onError: (err: Error) => toast.error(`Cancel failed: ${err.message}`),
  });
}

export function useRetryRun() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => retryRun(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
      qc.invalidateQueries({ queryKey: KEYS.reviewRun(id) });
      toast.success("Retrying…");
    },
    onError: (err: Error) => toast.error(`Retry failed: ${err.message}`),
  });
}

export function useDeleteRun() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation<DeleteRunResult, Error, string>({
    mutationFn: (id: string) => deleteRun(id),
    onSuccess: (data, id) => {
      invalidateRunListsAndDetail(qc, id);
      if (data.action === "cancelled") {
        toast.success("Run cancelled");
      } else if (data.cascade.platformsLive.length > 0) {
        const platforms = data.cascade.platformsLive
          .map((p) => p.replace("_", " "))
          .join(", ");
        toast.info(`Deleted from PropertyIQ. Still live on ${platforms}.`);
      } else {
        toast.success("Run deleted");
      }
    },
    onError: (err: Error) => toast.error(`Delete failed: ${err.message}`),
  });
}

export function useRegenerateThumbnail() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, frame }: { id: string; frame: number }) =>
      regenerateThumbnail(id, frame),
    onSuccess: (_data, { id, frame }) => {
      // Render is async; give the worker time to finish before re-fetching.
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: KEYS.reviewRun(id) });
        qc.invalidateQueries({ queryKey: KEYS.assetUrl(id, "thumbnail") });
      }, 5_000);
      toast.success(`Re-rendering thumbnail at frame ${frame}…`);
    },
    onError: (err: Error) =>
      toast.error(`Thumbnail regenerate failed: ${err.message}`),
  });
}

export function useReplaceThumbnail() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      replaceThumbnail(id, file),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.reviewRun(id) });
      qc.invalidateQueries({ queryKey: KEYS.assetUrl(id, "thumbnail") });
      toast.success("Custom thumbnail uploaded");
    },
    onError: (err: Error) =>
      toast.error(`Thumbnail upload failed: ${err.message}`),
  });
}
