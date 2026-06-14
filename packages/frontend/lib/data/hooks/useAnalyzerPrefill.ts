import { useMutation } from "@tanstack/react-query";
import {
  fetchAnalyzerPrefill,
  type AnalyzerPrefillBundle,
  type AnalyzerPrefillParams,
} from "../fetchers/analyzer-prefill";

/**
 * Mutation-style hook: prefill fires on an explicit address selection, not on
 * every keystroke. Returns the bundle (or null) for the caller to apply.
 */
export function useAnalyzerPrefill() {
  return useMutation<
    AnalyzerPrefillBundle | null,
    Error,
    AnalyzerPrefillParams
  >({
    mutationFn: (params) => fetchAnalyzerPrefill(params),
  });
}
