"use client";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  fetchMagnetLibrary,
  updateMagnet,
  deleteBinding,
  type MagnetDefinition,
  type FormatBinding,
  type UpdateMagnetPatch,
} from "../lib/magnet-api";
import { useToast } from "../lib/toast";
import { M3Switch } from "../components/m3-switch";
import { DestructiveDialog } from "../components/destructive-dialog";
import { EditMagnetDialog } from "./edit-magnet-dialog";
import { BindDialog } from "./bind-dialog";

const QUERY_KEY = ["content-pipeline-magnets"] as const;
const AUDIENCE_LABELS: Record<string, string> = {
  investor: "Investors",
  agent: "Agents",
  broker: "Brokers",
  mixed: "Mixed",
};

/**
 * Lead Magnet Library admin page. Two stacked sections:
 *   - Magnets: editable card per magnet (display name, description, audience,
 *     enabled toggle, cover preview, edit dialog).
 *   - Bindings: table of format → magnet bindings with weight + cta_text +
 *     enable toggle + remove. Add new binding via dialog.
 */
export default function LeadMagnetsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchMagnetLibrary,
  });
  const [editingMagnet, setEditingMagnet] = useState<MagnetDefinition | null>(
    null,
  );
  const [bindOpen, setBindOpen] = useState(false);
  const [deletingBinding, setDeletingBinding] = useState<FormatBinding | null>(
    null,
  );

  const updateMagnetMut = useMutation({
    mutationFn: ({ kind, patch }: { kind: string; patch: UpdateMagnetPatch }) =>
      updateMagnet(kind, patch),
    onMutate: async ({ kind, patch }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const previous = qc.getQueryData(QUERY_KEY);
      qc.setQueryData(QUERY_KEY, (old: any) =>
        old
          ? {
              ...old,
              magnets: old.magnets.map((m: MagnetDefinition) =>
                m.kind === kind ? { ...m, ...patch } : m,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (err: Error, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(QUERY_KEY, ctx.previous);
      toast.error(`Save failed: ${err.message.slice(0, 100)}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteBindingMut = useMutation({
    mutationFn: (id: string) => deleteBinding(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Binding removed");
    },
    onError: (err: Error) =>
      toast.error(`Delete failed: ${err.message.slice(0, 100)}`),
  });

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 bg-surface-container-low rounded-xl animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-8">
        <div className="rounded-xl bg-error-container text-on-error-container px-4 py-3 text-sm">
          Couldn&apos;t load magnet library.{" "}
          <button
            type="button"
            onClick={() => qc.invalidateQueries({ queryKey: QUERY_KEY })}
            className="underline font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl space-y-10">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">
            Lead Magnets
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            The catalog of downloadable assets we offer in exchange for an email
            signup. Add a binding to set which magnet a format delivers.
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-wider text-on-surface-variant">
          Catalog ({data.magnets.length})
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {data.magnets.map((m) => (
            <MagnetCard
              key={m.kind}
              magnet={m}
              onEdit={() => setEditingMagnet(m)}
              onToggle={(enabled) =>
                updateMagnetMut.mutate({ kind: m.kind, patch: { enabled } })
              }
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-xs font-mono uppercase tracking-wider text-on-surface-variant">
            Format → Magnet bindings ({data.bindings.length})
          </h2>
          <button
            type="button"
            onClick={() => setBindOpen(true)}
            className="bg-primary text-on-primary rounded-full px-4 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors duration-200"
          >
            + Bind a magnet
          </button>
        </div>

        {data.bindings.length === 0 ? (
          <div className="rounded-xl bg-surface-container-low px-6 py-8 text-center text-sm text-on-surface-variant">
            No bindings yet. Bind a magnet to a format so its short links
            attribute signups correctly.
          </div>
        ) : (
          <div className="rounded-xl bg-surface-container-low overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Format</th>
                  <th className="px-4 py-3 font-medium">Magnet</th>
                  <th className="px-4 py-3 font-medium">CTA text</th>
                  <th className="px-4 py-3 font-medium">Weight</th>
                  <th className="px-4 py-3 font-medium">On</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.bindings.map((b) => {
                  const magnet = data.magnets.find(
                    (m) => m.kind === b.magnet_kind,
                  );
                  return (
                    <tr
                      key={b.id}
                      className="border-t border-outline-variant text-on-surface"
                    >
                      <td className="px-4 py-3 font-medium">{b.format}</td>
                      <td className="px-4 py-3">
                        {magnet?.display_name ?? b.magnet_kind}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant max-w-[24rem] truncate">
                        {b.cta_text}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {b.weight.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            b.enabled ? "bg-tertiary" : "bg-outline"
                          }`}
                          aria-label={b.enabled ? "enabled" : "disabled"}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDeletingBinding(b)}
                          className="text-error text-xs font-medium hover:bg-error/10 rounded-full px-3 py-1 transition-colors duration-200"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingMagnet && (
        <EditMagnetDialog
          magnet={editingMagnet}
          open
          onClose={() => setEditingMagnet(null)}
          onSave={async (patch) => {
            await updateMagnetMut.mutateAsync({
              kind: editingMagnet.kind,
              patch,
            });
            setEditingMagnet(null);
          }}
        />
      )}

      <BindDialog
        open={bindOpen}
        onClose={() => setBindOpen(false)}
        magnets={data.magnets}
        existingBindings={data.bindings}
      />

      <DestructiveDialog
        open={!!deletingBinding}
        onClose={() => setDeletingBinding(null)}
        onConfirm={async () => {
          if (deletingBinding) {
            await deleteBindingMut.mutateAsync(deletingBinding.id);
            setDeletingBinding(null);
          }
        }}
        title={`Remove ${deletingBinding?.format} → ${
          deletingBinding?.magnet_kind ?? ""
        }?`}
        body={
          <p>
            Future runs of <strong>{deletingBinding?.format}</strong> won&apos;t
            attribute signups to <strong>{deletingBinding?.magnet_kind}</strong>{" "}
            anymore. Past attributions are unaffected.
          </p>
        }
        confirmLabel="Remove binding"
      />
    </div>
  );
}

function MagnetCard({
  magnet,
  onEdit,
  onToggle,
}: {
  magnet: MagnetDefinition;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const delivered = magnet.delivered_count ?? null;
  const paidPct =
    magnet.converted_to_paid_pct == null
      ? null
      : Math.round(magnet.converted_to_paid_pct * 1000) / 10;
  return (
    <div
      className={`rounded-xl bg-surface-container-low p-4 shadow-sm flex gap-4 transition-opacity duration-200 ${
        magnet.enabled ? "" : "opacity-60"
      }`}
    >
      <div className="flex-shrink-0 w-20 h-28 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center overflow-hidden">
        {magnet.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={magnet.cover_image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xs font-mono px-2 text-center">
            {magnet.display_name.slice(0, 14)}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="text-sm font-semibold text-on-surface truncate">
            {magnet.display_name}
          </h3>
          <M3Switch
            checked={magnet.enabled}
            ariaLabel={`Enable ${magnet.display_name}`}
            onChange={onToggle}
          />
        </div>
        <div className="text-[11px] font-mono text-on-surface-variant mb-2">
          {AUDIENCE_LABELS[magnet.audience] ?? magnet.audience} · {magnet.kind}
        </div>
        <p className="text-xs text-on-surface-variant line-clamp-2 mb-3">
          {magnet.description ?? "(no description)"}
        </p>
        <div className="flex items-center gap-3 text-[11px] text-on-surface-variant mb-3">
          <span className="font-mono">
            delivered: {delivered == null ? "—" : delivered.toLocaleString()}
          </span>
          <span className="font-mono">
            paid conv: {paidPct == null ? "—" : `${paidPct.toFixed(1)}%`}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
          <span>v{magnet.version}</span>
          <button
            type="button"
            onClick={onEdit}
            className="text-primary text-xs font-medium hover:bg-primary/8 rounded-full px-3 py-1 transition-colors duration-200"
          >
            Edit ›
          </button>
        </div>
      </div>
    </div>
  );
}
