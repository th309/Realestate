"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";
import { RuleEditor } from "./rule-editor";
import { useToast } from "../lib/toast";

type Rule = any;

export default function AutoIdeationPage() {
  const toast = useToast();
  const [editing, setEditing] = useState<Rule | "new" | null>(null);
  const { data = [], refetch } = useQuery({
    queryKey: ["auto-ideation-rules"],
    queryFn: async () =>
      (
        await fetchAPI<{ data: { rules: Rule[] } }>(
          "/api/admin/content-pipeline/auto-ideation/rules",
        )
      ).data.rules,
  });

  async function toggle(rule: Rule) {
    const res = await fetchAPIRaw(
      `/api/admin/content-pipeline/auto-ideation/rules/${rule.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      },
    );
    if (!res.ok) throw new Error(await res.text());
    refetch();
  }

  async function del(rule: Rule) {
    if (!confirm(`Delete rule ${rule.rule_name}?`)) return;
    const res = await fetchAPIRaw(
      `/api/admin/content-pipeline/auto-ideation/rules/${rule.id}`,
      { method: "DELETE" },
    );
    if (!res.ok) throw new Error(await res.text());
    refetch();
  }

  async function fireNow(rule: Rule) {
    const res = await fetchAPIRaw(
      `/api/admin/content-pipeline/auto-ideation/rules/${rule.id}/fire-now`,
      { method: "POST" },
    );
    if (!res.ok) throw new Error(await res.text());
    toast.success("Fired. Check dashboard for new runs.");
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="p-8 space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-on-surface">
              Auto-Ideation Rules
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Configure triggers that automatically enqueue runs (with cost caps).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="bg-primary text-on-primary rounded-full px-5 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors duration-200"
          >
            + New Rule
          </button>
        </div>

        <div className="space-y-3">
          {data.map((r: Rule) => (
            <div
              key={r.id}
              className="rounded-xl bg-surface-container-low p-4 shadow-sm flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="font-semibold text-on-surface truncate">
                  {r.rule_name}
                </div>
                <div className="text-xs text-on-surface-variant mt-0.5">
                  <span className="font-mono">{r.trigger_type}</span> • target{" "}
                  <span className="font-mono">{r.target_format}</span> • last fired{" "}
                  {r.last_fired_at
                    ? new Date(r.last_fired_at).toLocaleString()
                    : "never"}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!r.enabled}
                    onChange={() =>
                      toggle(r).catch((e) =>
                        toast.error(`Toggle failed: ${String(e?.message ?? e)}`),
                      )
                    }
                  />
                  Enabled
                </label>
                <button
                  type="button"
                  onClick={() =>
                    fireNow(r).catch((e) =>
                      toast.error(`Fire failed: ${String(e?.message ?? e)}`),
                    )
                  }
                  className="text-sm bg-surface rounded-full px-3 py-1 border border-outline-variant hover:bg-on-surface/6 transition-colors duration-200"
                >
                  Run now
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(r)}
                  className="text-sm bg-surface rounded-full px-3 py-1 border border-outline-variant hover:bg-on-surface/6 transition-colors duration-200"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    del(r).catch((e) =>
                      toast.error(`Delete failed: ${String(e?.message ?? e)}`),
                    )
                  }
                  className="text-sm bg-error/10 text-error rounded-full px-3 py-1 hover:bg-error/15 transition-colors duration-200"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {data.length === 0 && (
            <div className="rounded-xl bg-surface-container-low p-8 text-sm text-on-surface-variant text-center">
              No rules yet. Create one to start.
            </div>
          )}
        </div>

        {editing && (
          <RuleEditor
            rule={editing === "new" ? null : editing}
            onClose={() => {
              setEditing(null);
              refetch();
            }}
          />
        )}
      </div>
    </div>
  );
}

