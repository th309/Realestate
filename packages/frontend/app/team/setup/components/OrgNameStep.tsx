"use client";

import { useState, useMemo } from "react";
import { Building2, Loader2, AlertCircle } from "lucide-react";
import { createOrganization } from "@/lib/data";
import { useQueryClient } from "@tanstack/react-query";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

interface OrgNameStepProps {
  onCreated: (slug: string) => void;
}

export function OrgNameStep({ onCreated }: OrgNameStepProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const slug = useMemo(() => slugify(name), [name]);
  const isValid = name.trim().length >= 2 && slug.length >= 2;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || saving) return;

    setSaving(true);
    setError(null);

    try {
      await createOrganization(name.trim(), slug);
      queryClient.invalidateQueries({ queryKey: ["my-org"] });
      onCreated(slug);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create organization";
      if (msg.includes("already taken") || msg.includes("conflict")) {
        setError(
          `"${slug}" is already taken. Try "${slug}-1" or a different name.`,
        );
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface-container-low rounded-2xl p-8 shadow-sm">
      <div className="text-center mb-6">
        <Building2 className="h-10 w-10 text-primary mx-auto mb-3" />
        <h1 className="text-xl font-medium text-on-surface">
          Name Your Organization
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          This is how your team will identify your workspace.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="org-name"
            className="block text-sm font-medium text-on-surface mb-1"
          >
            Organization Name
          </label>
          <input
            id="org-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Real Estate Group"
            className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            autoFocus
            disabled={saving}
          />
        </div>

        {slug && (
          <p className="text-xs text-on-surface-variant">
            URL:{" "}
            <span className="font-mono text-primary">
              propertyiq.app/org/{slug}
            </span>
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || saving}
          className="w-full px-6 py-3 bg-primary text-on-primary rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Create Organization
        </button>
      </form>
    </div>
  );
}
