"use client";
/**
 * Post mutations for the planner and the needs-attention card. Every mutation
 * is optimistic (onMutate cancel/snapshot -> setQueryData -> onError rollback ->
 * onSettled invalidate) so a dragged, retried, or skipped post moves instantly,
 * following the same optimistic idiom as use-format-mutations.ts.
 *
 * The scheduled query is keyed by its calendar window, so we match caches by
 * the shared key PREFIX (getQueriesData/setQueriesData) rather than an exact
 * key — the patch then lands on whatever window is currently mounted.
 */
import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import {
  reschedulePost,
  skipPost,
  updatePostCopy,
  type PlannerPost,
  type PostCopy,
  type PostsListResult,
} from "./posts-api";
import { useToast } from "./toast";

/** Key prefixes — the scheduled query appends its window; the others are exact. */
export const POSTS_SCHEDULED_KEY = ["cp-posts", "scheduled"] as const;
export const POSTS_APPROVED_KEY = ["cp-posts", "approved"] as const;
export const POSTS_FAILED_KEY = ["cp-posts", "failed"] as const;

/** Every posts cache a lifecycle change can move a row between. */
const POST_LIST_KEYS = [
  POSTS_SCHEDULED_KEY,
  POSTS_APPROVED_KEY,
  POSTS_FAILED_KEY,
] as const;

type Snapshot = Array<[QueryKey, PostsListResult | undefined]>;
interface ListContext {
  snapshots: Snapshot;
}

/** Cancel in-flight reads and snapshot every posts list, for rollback. */
async function snapshotPostLists(qc: QueryClient): Promise<Snapshot> {
  const snapshots: Snapshot = [];
  for (const queryKey of POST_LIST_KEYS) {
    await qc.cancelQueries({ queryKey });
    snapshots.push(...qc.getQueriesData<PostsListResult>({ queryKey }));
  }
  return snapshots;
}

function findPostInSnapshots(
  snapshots: Snapshot,
  id: string,
): PlannerPost | undefined {
  for (const [, data] of snapshots) {
    const found = data?.posts.find((p) => p.id === id);
    if (found) return found;
  }
  return undefined;
}

function dropFromLists(qc: QueryClient, keys: readonly QueryKey[], id: string) {
  for (const queryKey of keys) {
    qc.setQueriesData<PostsListResult>({ queryKey }, (old) =>
      old ? { ...old, posts: old.posts.filter((p) => p.id !== id) } : old,
    );
  }
}

function rollback(qc: QueryClient, ctx: ListContext | undefined) {
  ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
}

function invalidatePostLists(qc: QueryClient) {
  for (const queryKey of POST_LIST_KEYS) qc.invalidateQueries({ queryKey });
}

interface RescheduleVars {
  id: string;
  iso: string;
}

/**
 * Move a post to a new instant. Also the retry path for a failed post: the
 * backend allows failed -> scheduled, so re-scheduling hands the row back to
 * the publish scanner.
 */
export function useReschedulePost() {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation<PlannerPost, Error, RescheduleVars, ListContext>({
    mutationFn: ({ id, iso }) => reschedulePost(id, iso),
    onMutate: async ({ id, iso }) => {
      const snapshots = await snapshotPostLists(qc);
      const base = findPostInSnapshots(snapshots, id);

      if (base) {
        const updated: PlannerPost = {
          ...base,
          status: "scheduled",
          scheduled_at: iso,
        };
        // Upsert into every scheduled-window cache…
        qc.setQueriesData<PostsListResult>(
          { queryKey: POSTS_SCHEDULED_KEY },
          (old) =>
            old
              ? {
                  posts: [...old.posts.filter((p) => p.id !== id), updated],
                  counts: old.counts,
                }
              : old,
        );
        // …and drop it from the lists it just left.
        dropFromLists(qc, [POSTS_APPROVED_KEY, POSTS_FAILED_KEY], id);
      }

      return { snapshots };
    },
    onError: (err, _vars, ctx) => {
      rollback(qc, ctx);
      toast.error(`Couldn't reschedule: ${err.message}`);
    },
    onSuccess: () => toast.success("Post rescheduled"),
    onSettled: () => invalidatePostLists(qc),
  });
}

/** Skip a post — it leaves every working list for good. */
export function useSkipPost() {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation<PlannerPost, Error, string, ListContext>({
    mutationFn: (id) => skipPost(id),
    onMutate: async (id) => {
      const snapshots = await snapshotPostLists(qc);
      dropFromLists(qc, POST_LIST_KEYS, id);
      return { snapshots };
    },
    onError: (err, _id, ctx) => {
      rollback(qc, ctx);
      toast.error(`Couldn't skip: ${err.message}`);
    },
    onSuccess: () => toast.success("Post skipped"),
    onSettled: () => invalidatePostLists(qc),
  });
}

interface UpdateCopyVars {
  id: string;
  copy: PostCopy;
}

/**
 * Save edited copy. Patches the row in place in every posts cache and in the
 * review queue, so the card the operator is looking at shows the saved text
 * without waiting for a refetch.
 */
export function useUpdatePostCopy() {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation<PlannerPost, Error, UpdateCopyVars, ListContext>({
    mutationFn: ({ id, copy }) => updatePostCopy(id, copy),
    onMutate: async ({ id, copy }) => {
      const snapshots = await snapshotPostLists(qc);
      for (const queryKey of POST_LIST_KEYS) {
        qc.setQueriesData<PostsListResult>({ queryKey }, (old) =>
          old
            ? {
                ...old,
                posts: old.posts.map((p) => (p.id === id ? { ...p, copy } : p)),
              }
            : old,
        );
      }
      // The review queue is a separate list of loosely-typed items.
      qc.setQueriesData<Array<{ id: string; copy?: PostCopy }>>(
        { queryKey: ["review-queue"] },
        (old) =>
          Array.isArray(old)
            ? old.map((item) => (item.id === id ? { ...item, copy } : item))
            : old,
      );
      return { snapshots };
    },
    onError: (err, _vars, ctx) => {
      rollback(qc, ctx);
      toast.error(`Couldn't save copy: ${err.message}`);
    },
    onSuccess: () => toast.success("Copy saved"),
    onSettled: () => {
      invalidatePostLists(qc);
      qc.invalidateQueries({ queryKey: ["review-queue"] });
    },
  });
}
