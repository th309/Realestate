"use client";

import { useState } from "react";
import { useOrg } from "../../../hooks/useOrg";
import { useRouter } from "next/navigation";
import { updateOrganization } from "@/lib/data";
import { Settings, AlertCircle, Loader2 } from "lucide-react";

/**
 * Organization settings form — rename org name and URL slug.
 * Slug changes trigger a 30-day redirect from the old URL.
 */
export function OrgSettingsSection() {
  const { org, refresh } = useOrg();
  const router = useRouter();
  const [name, setName] = useState(org?.name || "");
  const [slug, setSlug] = useState(org?.slug || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const nameChanged = name !== org?.name;
  const slugChanged = slug !== org?.slug;
  const isDirty = nameChanged || slugChanged;

  const slugPreview = slug
    .toLowerCase()
    .trim()
    .replace(/[^\w-]/g, "")
    .replace(/--+/g, "-");

  async function handleSave() {
    if (!isDirty || !org) return;

    if (
      slugChanged &&
      !confirm(
        "Changing the URL slug will update all org URLs. Old URLs will redirect for 30 days. Continue?",
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const payload: Record<string, string> = {};
      if (nameChanged) payload.name = name.trim();
      if (slugChanged) payload.slug = slugPreview;

      await updateOrganization(org.slug, payload);
      setSuccess(true);

      if (slugChanged) {
        router.replace(`/org/${slugPreview}/admin`);
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-6 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-medium text-on-surface-variant tracking-wide">
          ORGANIZATION SETTINGS
        </h3>
      </div>

      <div className="space-y-4 max-w-md">
        {/* Organization name */}
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">
            Organization Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg text-sm"
          />
        </div>

        {/* URL slug */}
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">
            URL Slug
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={saving}
            className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg text-sm font-mono"
          />
          {slugChanged && (
            <p className="text-xs text-on-surface-variant mt-1">
              New URL: propertyiq.app/org/
              <span className="text-primary font-mono">{slugPreview}</span>
              /admin
            </p>
          )}
          {slugChanged && (
            <p className="text-xs text-amber-600 mt-1">
              Old URL will redirect for 30 days
            </p>
          )}
        </div>

        {/* Error / success feedback */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        {success && <p className="text-sm text-green-600">Settings saved.</p>}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}
