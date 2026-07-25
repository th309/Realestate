"use client";
/**
 * Post mutations for the planner. Rescheduling is optimistic (onMutate cancel/
 * snapshot -> setQueryData -> onError rollback -> onSettled invalidate) so a
 * dragged post lands on its new day instantly, following the same optimistic
 * idiom as use-format-mutations.ts.
 *
 * The scheduled query is keyed by its calendar window, so we match caches by
 * the shared key PREFIX (getQueriesData/setQueriesData) rather than an exact
 * key — the patch then lands on whatever window is currently mounted.
 */
import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import {
  reschedulePost,
  type PlannerPost,
  type PostsListResult,
} from "./posts-api";
import { useToast } from "./toast";

/** Key prefixes — the scheduled query appends its window; approved is exact. */
export const POSTS_SCHEDULED_KEY = ["cp-posts", "scheduled"] as const;
export const POSTS_APPROVED_KEY = ["cp-posts", "approved"] as const;

type Snapshot = Array<[QueryKey, PostsListResult | undefined]>;

interface RescheduleVars {
  id: string;
  iso: string;
}
interface RescheduleContext {
  prevScheduled: Snapshot;
  prevApproved: Snapshot;
}

export function useReschedulePost() {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation<PlannerPost, Error, RescheduleVars, RescheduleContext>({
    mutationFn: ({ id, iso }) => reschedulePost(id, iso),
    onMutate: async ({ id, iso }) => {
      await qc.cancelQueries({ queryKey: POSTS_SCHEDULED_KEY });
      await qc.cancelQueries({ queryKey: POSTS_APPROVED_KEY });

      const prevScheduled = qc.getQueriesData<PostsListResult>({
        queryKey: POSTS_SCHEDULED_KEY,
      });
      const prevApproved = qc.getQueriesData<PostsListResult>({
        queryKey: POSTS_APPROVED_KEY,
      });

      let base: PlannerPost | undefined;
      for (const [, data] of [...prevScheduled, ...prevApproved]) {
        const found = data?.posts.find((p) => p.id === id);
        if (found) {
          base = found;
          break;
        }
      }

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
        // …and drop it from the approved (unscheduled) cache.
        qc.setQueriesData<PostsListResult>(
          { queryKey: POSTS_APPROVED_KEY },
          (old) =>
            old ? { ...old, posts: old.posts.filter((p) => p.id !== id) } : old,
        );
      }

      return { prevScheduled, prevApproved };
    },
    onError: (err, _vars, ctx) => {
      ctx?.prevScheduled.forEach(([key, data]) => qc.setQueryData(key, data));
      ctx?.prevApproved.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(`Couldn't reschedule: ${err.message}`);
    },
    onSuccess: () => toast.success("Post rescheduled"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: POSTS_SCHEDULED_KEY });
      qc.invalidateQueries({ queryKey: POSTS_APPROVED_KEY });
    },
  });
}
