"use client";

import { useState } from "react";
import { useOrg } from "../../../hooks/useOrg";
import { useRouter } from "next/navigation";
import { updateOrganization } from "@/lib/data";
import { Settings, AlertCircle, Loader2 } from "lucide-react";

/** Must match the backend DTO regex in update-organization.dto.ts */
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/**
 * Sanitize raw input into a valid URL slug:
 * lowercase, strip non-alphanumeric/hyphen chars, collapse hyphens,
 * strip leading/trailing hyphens.
 */
function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/**
 * Organization settings form — rename org name and URL slug.
 * Slug changes trigger a 30-day redirect from the old URL.
 */
export function OrgSettingsSection() {
  const { org, refresh } = useOrg();
  const router = useRouter();
  const [name, setName] = useState(org?.name || "");
  const [slug, setSlug] = useState(org?.slug || "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Auto-derive slug from name unless user has manually edited the slug field
  function handleNameChange(newName: string) {
    setName(newName);
    if (!slugManuallyEdited) {
      setSlug(sanitizeSlug(newName));
    }
  }

  function handleSlugChange(newSlug: string) {
    setSlug(newSlug);
    setSlugManuallyEdited(true);
  }

  const nameChanged = name !== org?.name;
  const slugChanged = slug !== org?.slug;
  const isDirty = nameChanged || slugChanged;

  const slugPreview = sanitizeSlug(slug);
  const slugValid = slugPreview.length > 0 && SLUG_REGEX.test(slugPreview);
  const slugError =
    slugChanged && slugPreview.length > 0 && !slugValid
      ? "Slug must start and end with a letter or number, and contain only lowercase letters, numbers, and hyphens"
      : null;

  async function handleSave() {
    if (!isDirty || !org) return;

    if (slugChanged && !slugValid) {
      setError(slugError ?? "Invalid slug format");
      return;
    }

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

      const updated = await updateOrganization(org.slug, payload);

      // Verify the backend actually applied the slug change
      if (slugChanged && updated.slug !== slugPreview) {
        throw new Error(
          "Slug update was not applied. The slug may be taken or reserved.",
        );
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      if (slugChanged) {
        await refresh();
        router.replace(`/org/${updated.slug}/admin`);
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
            onChange={(e) => handleNameChange(e.target.value)}
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
            onChange={(e) => handleSlugChange(e.target.value)}
            disabled={saving}
            className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg text-sm font-mono"
          />
          {slugChanged && slugPreview && (
            <p className="text-xs text-on-surface-variant mt-1">
              New URL: propertyiq.app/org/
              <span className="text-primary font-mono">{slugPreview}</span>
              /admin
            </p>
          )}
          {slugError && (
            <p className="text-xs text-red-600 mt-1">{slugError}</p>
          )}
          {slugChanged && slugValid && (
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
          disabled={!isDirty || saving || (slugChanged && !slugValid)}
          className="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}
