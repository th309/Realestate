/**
 * ORGANIZATION DATA FETCHERS
 *
 * API functions for organization management: CRUD, members, invites,
 * audit log, and ownership transfer.
 */

import { fetchAPI, fetchAPIRaw } from "./base";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrgData {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  website_url: string | null;
  seat_count: number;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  joined_at: string;
}

export interface OrgMembersResponse {
  members: OrgMember[];
  total: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor_id: string;
  actor_email: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  next_cursor: string | null;
}

export interface InviteDetails {
  org_name: string;
  org_slug: string;
  inviter_email: string;
  role: string;
  expires_at: string;
}

// ---------------------------------------------------------------------------
// Read operations — use fetchAPI (auto-retries, typed return)
// ---------------------------------------------------------------------------

/**
 * Fetch the current user's organization membership.
 * Returns { slug, name, role } or { slug: null } if not in any org.
 */
export async function fetchMyOrg(): Promise<{
  slug: string | null;
  name: string | null;
  role: string | null;
}> {
  return fetchAPI(`/api/org/mine`);
}

/**
 * Fetch organization details by slug.
 */
export async function fetchOrg(slug: string): Promise<OrgData> {
  return fetchAPI<OrgData>(`/api/org/${slug}`);
}

/**
 * Fetch the member list for an organization.
 */
export async function fetchOrgMembers(
  slug: string,
): Promise<OrgMembersResponse> {
  return fetchAPI<OrgMembersResponse>(`/api/org/${slug}/members`);
}

/**
 * Fetch paginated audit log for an organization.
 */
export async function fetchOrgAuditLog(
  slug: string,
  params?: { cursor?: string; limit?: number },
): Promise<AuditLogResponse> {
  const query = new URLSearchParams();
  if (params?.cursor) query.set("cursor", params.cursor);
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return fetchAPI<AuditLogResponse>(
    `/api/org/${slug}/audit${qs ? "?" + qs : ""}`,
  );
}

/**
 * Fetch details for a pending invite token (used on the accept-invite page).
 */
export async function fetchInviteDetails(
  token: string,
): Promise<InviteDetails> {
  return fetchAPI<InviteDetails>(`/api/org/invite/${token}`);
}

// ---------------------------------------------------------------------------
// Mutation operations — use fetchAPIRaw (manual error handling)
// ---------------------------------------------------------------------------

/**
 * Create a new organization.
 */
export async function createOrganization(
  name: string,
  slug: string,
): Promise<OrgData> {
  const res = await fetchAPIRaw("/api/org", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, slug }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Create org failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Update organization settings (name, website URL, etc.).
 */
export async function updateOrganization(
  slug: string,
  data: { name?: string; website_url?: string },
): Promise<OrgData> {
  const res = await fetchAPIRaw(`/api/org/${slug}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Update org failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Send an email invitation to join the organization.
 */
export async function inviteOrgMember(
  slug: string,
  email: string,
  role: string,
): Promise<{ invite_id: string }> {
  const res = await fetchAPIRaw(`/api/org/${slug}/members/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Invite failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Change a member's role within the organization.
 */
export async function changeOrgMemberRole(
  slug: string,
  userId: string,
  role: string,
): Promise<void> {
  const res = await fetchAPIRaw(`/api/org/${slug}/members/${userId}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    throw new Error(`Role change failed: ${res.status}`);
  }
}

/**
 * Remove a member from the organization.
 */
export async function removeOrgMember(
  slug: string,
  userId: string,
): Promise<void> {
  const res = await fetchAPIRaw(`/api/org/${slug}/members/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Remove member failed: ${res.status}`);
  }
}

/**
 * Accept a pending organization invite using its token.
 */
export async function acceptOrgInvite(
  token: string,
): Promise<{ org_slug: string }> {
  const res = await fetchAPIRaw(`/api/org/invite/${token}/accept`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Accept invite failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Transfer organization ownership to another member.
 */
export async function transferOrgOwnership(
  slug: string,
  newOwnerId: string,
): Promise<void> {
  const res = await fetchAPIRaw(`/api/org/${slug}/transfer-ownership`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newOwnerId }),
  });
  if (!res.ok) {
    throw new Error(`Ownership transfer failed: ${res.status}`);
  }
}
