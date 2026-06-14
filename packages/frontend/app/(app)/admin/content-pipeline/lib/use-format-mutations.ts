"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateFormatDefault, type FormatDefaultPatch } from "./settings-api";
import { useToast } from "./toast";

const SETTINGS_KEY = ["content-pipeline-settings"] as const;

interface SettingsCache {
  strictness: string;
  paused: boolean;
  formatDefaults: Array<{
    format: string;
    [k: string]: unknown;
  }>;
}

/**
 * Optimistic mutation for PATCH /settings/formats/:format. Each edit fires
 * immediately, updates the React Query cache before the server responds,
 * and rolls back via setQueryData on error. Toast on error only — success
 * is silent (the visible UI change is feedback enough).
 */
export function useUpdateFormatDefault() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({
      format,
      patch,
    }: {
      format: string;
      patch: FormatDefaultPatch;
    }) => updateFormatDefault(format, patch),
    onMutate: async ({ format, patch }) => {
      await qc.cancelQueries({ queryKey: SETTINGS_KEY });
      const previous = qc.getQueryData<SettingsCache>(SETTINGS_KEY);
      qc.setQueryData<SettingsCache | undefined>(SETTINGS_KEY, (old) =>
        old
          ? {
              ...old,
              formatDefaults: old.formatDefaults.map((f) =>
                f.format === format ? { ...f, ...patch } : f,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(SETTINGS_KEY, ctx.previous);
      toast.error(`Save failed: ${err.message.slice(0, 120)}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}
