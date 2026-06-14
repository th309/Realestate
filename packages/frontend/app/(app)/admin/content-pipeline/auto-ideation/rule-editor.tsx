"use client";

import { useState } from "react";
import { fetchAPIRaw } from "@/lib/data/fetchers/base";
import { useToast } from "../lib/toast";

export function RuleEditor({
  rule,
  onClose,
}: {
  rule: any | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    rule_name: rule?.rule_name ?? "",
    trigger_type: rule?.trigger_type ?? "score_movement",
    trigger_config:
      rule?.trigger_config ??
      ({
        min_delta_points: 10,
        direction: "up",
        lookback_days: 30,
        geography: "metro",
      } as any),
    target_format: rule?.target_format ?? "score_mover",
    approval_mode_override: rule?.approval_mode_override ?? "review",
  });

  async function save() {
    setSaving(true);
    try {
      const url = rule
        ? `/api/admin/content-pipeline/auto-ideation/rules/${rule.id}`
        : "/api/admin/content-pipeline/auto-ideation/rules";
      const method = rule ? "PATCH" : "POST";
      const res = await fetchAPIRaw(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Rule saved");
      onClose();
    } catch (e: any) {
      toast.error(`Save failed: ${String(e?.message ?? e).slice(0, 140)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-6">
      <div className="bg-surface rounded-xl p-6 w-full max-w-xl space-y-4 border border-outline-variant shadow-lg">
        <h3 className="text-lg font-semibold text-on-surface">
          {rule ? "Edit rule" : "New rule"}
        </h3>

        <Field label="Rule name">
          <input
            value={form.rule_name}
            onChange={(e) => setForm({ ...form, rule_name: e.target.value })}
            className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
          />
        </Field>

        <Field label="Trigger type">
          <select
            value={form.trigger_type}
            onChange={(e) =>
              setForm({
                ...form,
                trigger_type: e.target.value,
              })
            }
            className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
          >
            <option value="score_movement">Score movement</option>
            <option value="rank_change">Rank change</option>
            <option value="threshold_cross">Threshold cross</option>
          </select>
        </Field>

        {form.trigger_type === "score_movement" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min delta points">
              <input
                type="number"
                value={form.trigger_config.min_delta_points ?? 10}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      min_delta_points: parseInt(e.target.value, 10),
                    },
                  })
                }
                className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
              />
            </Field>
            <Field label="Lookback days">
              <input
                type="number"
                value={form.trigger_config.lookback_days ?? 30}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      lookback_days: parseInt(e.target.value, 10),
                    },
                  })
                }
                className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
              />
            </Field>
            <Field label="Direction">
              <select
                value={form.trigger_config.direction ?? "up"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      direction: e.target.value,
                    },
                  })
                }
                className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
              >
                <option value="up">Up</option>
                <option value="down">Down</option>
                <option value="both">Both</option>
              </select>
            </Field>
            <Field label="Geography">
              <select
                value={form.trigger_config.geography ?? "metro"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      geography: e.target.value,
                    },
                  })
                }
                className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
              >
                <option value="state">State</option>
                <option value="metro">Metro</option>
                <option value="county">County</option>
                <option value="zip">ZIP</option>
              </select>
            </Field>
          </div>
        )}

        {form.trigger_type === "rank_change" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min rank delta">
              <input
                type="number"
                value={form.trigger_config.min_rank_delta ?? 5}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      min_rank_delta: parseInt(e.target.value, 10),
                    },
                  })
                }
                className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
              />
            </Field>
            <Field label="Top N">
              <input
                type="number"
                value={form.trigger_config.top_n ?? 10}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      top_n: parseInt(e.target.value, 10),
                    },
                  })
                }
                className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
              />
            </Field>
            <Field label="Direction">
              <select
                value={form.trigger_config.direction ?? "up"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      direction: e.target.value,
                    },
                  })
                }
                className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
              >
                <option value="up">Up</option>
                <option value="down">Down</option>
                <option value="both">Both</option>
              </select>
            </Field>
            <Field label="Geography">
              <select
                value={form.trigger_config.geography ?? "metro"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      geography: e.target.value,
                    },
                  })
                }
                className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
              >
                <option value="state">State</option>
                <option value="metro">Metro</option>
                <option value="county">County</option>
                <option value="zip">ZIP</option>
              </select>
            </Field>
          </div>
        )}

        {form.trigger_type === "threshold_cross" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Metric">
              <select
                value={form.trigger_config.metric ?? "propertyiq_score"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      metric: e.target.value,
                    },
                  })
                }
                className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
              >
                <option value="propertyiq_score">PropertyIQ Score</option>
              </select>
            </Field>
            <Field label="Threshold value">
              <input
                type="number"
                value={form.trigger_config.threshold_value ?? 80}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      threshold_value: parseFloat(e.target.value),
                    },
                  })
                }
                className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
              />
            </Field>
            <Field label="Direction">
              <select
                value={form.trigger_config.direction ?? "up"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      direction: e.target.value,
                    },
                  })
                }
                className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
              >
                <option value="up">Up</option>
                <option value="down">Down</option>
              </select>
            </Field>
          </div>
        )}

        <Field label="Target format">
          <select
            value={form.target_format}
            onChange={(e) => setForm({ ...form, target_format: e.target.value })}
            className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
          >
            {[
              "grade_reveal",
              "top_10_ranking",
              "bottom_10_ranking",
              "score_mover",
              "head_to_head",
              "farm_area_spotlight",
              "brokerage_market_share",
              "recruitment_angle",
              "long_form_deep_dive",
            ].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Approval mode override">
          <select
            value={form.approval_mode_override}
            onChange={(e) =>
              setForm({ ...form, approval_mode_override: e.target.value })
            }
            className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface text-on-surface"
          >
            <option value="review">Review</option>
            <option value="auto">Auto</option>
            <option value="draft">Draft</option>
          </select>
        </Field>

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2 rounded-full text-sm font-medium text-on-surface hover:bg-on-surface/8 disabled:opacity-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-primary text-on-primary rounded-full px-5 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors duration-200"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      {children}
    </label>
  );
}

