/**
 * ANALYZER SHARE / PDF / EMAIL FETCHERS
 *
 * Split out of `analyzer.ts` to keep that file under the data-layer line
 * limit. Public endpoints — the share token itself is the capability for
 * recipient-facing routes (branding + PDF). Email send is auth-gated.
 */

import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

export interface SharedAnalysisBranding {
  logo_url: string | null;
  org_name: string | null;
  accent_color: string | null;
  phone: string | null;
  website_url: string | null;
  support_email: string | null;
  report_disclaimer: string | null;
  report_header_text: string | null;
  report_footer_text: string | null;
  powered_by_visible: boolean | null;
}

/**
 * Fetch the owner's org branding for a shared analysis. Returns `null` when
 * the owner has no organization configured — callers must fall back to
 * PropertyIQ defaults. Public endpoint; the token itself is the capability.
 */
export async function fetchSharedAnalysisBranding(
  token: string,
): Promise<SharedAnalysisBranding | null> {
  const res = await fetch(`${API_URL}/api/analyzer/share/${token}/branding`);
  if (!res.ok) return null;
  // NestJS serializes a null return as an empty body (not "null"), so we
  // can't use res.json() unconditionally.
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as SharedAnalysisBranding | null;
  } catch {
    return null;
  }
}

/**
 * Request a white-label PDF render of the shared analysis. Returns a Blob the
 * caller can wrap in `URL.createObjectURL` and trigger a download from.
 * Auth model matches the share page itself — possession of the token is the
 * entitlement.
 */
export async function downloadAnalysisPdf(token: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/analyzer/pdf/${token}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`pdf render failed: ${res.status}`);
  return res.blob();
}

/**
 * Sends a share-link email. Wraps the existing transactional email infra
 * with analyzer-specific copy. Recipient sees the sender's org branding on
 * the linked share page if the sender belongs to an org.
 */
export async function sendAnalysisShareEmail(payload: {
  shareToken: string;
  recipientEmail: string;
  message?: string;
}): Promise<{ success: boolean; error?: string }> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/analyzer/share/email`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return { success: false, error: `request failed (${res.status})` };
  }
  return res.json();
}
