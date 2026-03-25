/**
 * ORGANIZATION BRANDING FETCHERS
 *
 * API functions for org-level branding: logo, accent color, and public branding.
 */

import { fetchAPI, fetchAPIRaw } from "./base";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrgBrandingAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface OrgBranding {
  logo_url: string | null;
  accent_color: string;
  org_name: string;
  website_url: string | null;
  phone: string | null;
  address: OrgBrandingAddress | null;
  managing_broker: string | null;

  // Report & Document Branding
  report_header_text: string | null;
  report_footer_text: string | null;
  report_disclaimer: string | null;

  // Powered By
  powered_by_visible: boolean;

  // Support
  support_email: string | null;

  // Email Branding
  email_from_name: string | null;
  email_reply_to: string | null;

  // Domain
  custom_subdomain: string | null;
  custom_domain_status: string | null;
  custom_domain_verified_at: string | null;
  favicon_url: string | null;
  tab_title_format: string | null;

  // Typography
  primary_font: string | null;
  secondary_font: string | null;

  // Client-Facing
  welcome_message: string | null;
  custom_tos_url: string | null;
  custom_privacy_url: string | null;

  // Organization
  display_name: string | null;
  department_label: string | null;
  default_member_role: string | null;

  // Quinn AI Assistant
  quinn_bot_name: string | null;
  quinn_greeting: string | null;
  quinn_topic_restrictions: string[] | null;
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
  data: {
    accent_color?: string;
    website_url?: string;
    phone?: string;
    address?: OrgBrandingAddress;
    managing_broker?: string;
    report_header_text?: string;
    report_footer_text?: string;
    report_disclaimer?: string;
    powered_by_visible?: boolean;
    support_email?: string;
    email_from_name?: string;
    email_reply_to?: string;
    custom_subdomain?: string;
    favicon_url?: string;
    tab_title_format?: string;
    primary_font?: string;
    secondary_font?: string;
    welcome_message?: string;
    custom_tos_url?: string;
    custom_privacy_url?: string;
    display_name?: string;
    department_label?: string;
    default_member_role?: string;
    quinn_bot_name?: string;
    quinn_greeting?: string;
  },
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

// ---------------------------------------------------------------------------
// Custom domain operations
// ---------------------------------------------------------------------------

/**
 * Add a custom domain (subdomain) for the organization.
 * Returns the CNAME target the org must point their DNS to.
 */
export async function setCustomDomain(
  slug: string,
  subdomain: string,
): Promise<{ cname_target: string }> {
  const res = await fetchAPIRaw(`/api/org/${slug}/branding/domain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subdomain }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to set custom domain");
  }
  return res.json();
}

/**
 * Verify DNS configuration for the organization's custom domain.
 * Returns whether the CNAME record has been detected.
 */
export async function verifyCustomDomain(
  slug: string,
): Promise<{ verified: boolean; error?: string }> {
  const res = await fetchAPIRaw(`/api/org/${slug}/branding/domain/verify`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to verify domain");
  }
  return res.json();
}

/**
 * Remove the organization's custom domain.
 */
export async function removeCustomDomain(slug: string): Promise<void> {
  const res = await fetchAPIRaw(`/api/org/${slug}/branding/domain`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to remove domain");
  }
}
