/**
 * ORGANIZATION BRANDING FETCHERS
 *
 * API functions for org-level branding: logo, accent color, and public branding.
 */

import { fetchAPI, fetchAPIRaw } from "./base";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrgBranding {
  logo_url: string | null;
  accent_color: string;
  org_name: string;
  website_url: string | null;
}

// ---------------------------------------------------------------------------
// Read operations — use fetchAPI (auto-retries, typed return)
// ---------------------------------------------------------------------------

/**
 * Fetch branding settings for an organization (authenticated).
 */
export async function fetchOrgBranding(slug: string): Promise<OrgBranding> {
  return fetchAPI<OrgBranding>(`/api/org/${slug}/branding`);
}

/**
 * Fetch public branding for an organization by ID (no auth required).
 * Used by public-facing pages (shared reports, embeds).
 */
export async function fetchPublicBranding(orgId: string): Promise<OrgBranding> {
  return fetchAPI<OrgBranding>(`/api/org-branding/${orgId}`);
}

// ---------------------------------------------------------------------------
// Mutation operations — use fetchAPIRaw (manual error handling)
// ---------------------------------------------------------------------------

/**
 * Update organization branding settings (accent color, website URL).
 */
export async function updateOrgBranding(
  slug: string,
  data: { accent_color?: string; website_url?: string },
): Promise<OrgBranding> {
  const res = await fetchAPIRaw(`/api/org/${slug}/branding`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Update branding failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Upload a logo image for the organization.
 * Sends multipart FormData — do NOT set Content-Type header manually.
 */
export async function uploadOrgLogo(
  slug: string,
  file: File,
): Promise<{ logo_url: string }> {
  const formData = new FormData();
  formData.append("logo", file);

  const res = await fetchAPIRaw(`/api/org/${slug}/branding/logo`, {
    method: "POST",
    body: formData,
    // Do NOT set Content-Type — browser handles multipart boundary
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Logo upload failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Delete the organization's logo.
 */
export async function deleteOrgLogo(slug: string): Promise<void> {
  const res = await fetchAPIRaw(`/api/org/${slug}/branding/logo`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Delete logo failed: ${res.status}`);
  }
}
