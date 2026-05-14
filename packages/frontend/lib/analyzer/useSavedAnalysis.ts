import { useQuery } from "@tanstack/react-query";
import { fetchSavedAnalysis, type SavedAnalysis } from "@/lib/data";

/**
 * Fetch a saved analyzer run by id with React Query.
 *
 * Mirrors `useMarketContext` conventions: 2h staleTime per CLAUDE.md §5
 * data-binding hooks guidance, only enabled when `id` is truthy.
 */
export function useSavedAnalysis(id: string) {
  return useQuery<SavedAnalysis | null>({
    queryKey: ["analyzer", "saved", id],
    queryFn: () => fetchSavedAnalysis(id),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 60 * 2,
  });
}
