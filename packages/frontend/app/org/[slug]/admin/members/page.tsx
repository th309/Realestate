"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Plus, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useOrg } from "../../../hooks/useOrg";
import {
  fetchOrgMembers,
  inviteOrgMember,
  changeOrgMemberRole,
  removeOrgMember,
} from "@/lib/data";
import type { OrgMember } from "@/lib/data";
import { MemberTable } from "../../../components/MemberTable";
import { InviteMemberDialog } from "../../../components/InviteMemberDialog";
import { SeatUsageBar } from "../../../components/SeatUsageBar";

/**
 * Members management page for the enterprise admin portal.
 * Fetches member list, supports invite / role change / remove.
 */
export default function OrgAdminMembers() {
  const { org } = useOrg();

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOrgMembers(org.slug);
      setMembers(res.members);
      setTotalMembers(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const handleInvite = useCallback(
    async (email: string, role: string) => {
      if (!org) return;
      await inviteOrgMember(org.slug, email, role);
      await loadMembers();
    },
    [org, loadMembers],
  );

  const handleChangeRole = useCallback(
    async (userId: string, newRole: string) => {
      if (!org) return;
      await changeOrgMemberRole(org.slug, userId, newRole);
      await loadMembers();
    },
    [org, loadMembers],
  );

  const handleRemove = useCallback(
    async (userId: string) => {
      if (!org) return;
      await removeOrgMember(org.slug, userId);
      await loadMembers();
    },
    [org, loadMembers],
  );

  // Derive current user ID from the org owner as a fallback.
  // In a real app this would come from the auth session.
  const currentUserId = org?.owner_id ?? null;

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">Members</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Manage your organization&apos;s team
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadMembers()}
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Refresh members"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Invite Member
          </button>
        </div>
      </div>

      {/* Seat usage summary */}
      {org && (
        <div className="mb-6 max-w-xs">
          <SeatUsageBar used={totalMembers} total={org.seat_limit} />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-on-surface-variant" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6 text-center">
          <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-on-surface-variant">{error}</p>
          <button
            onClick={() => void loadMembers()}
            className="mt-3 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <MemberTable
          members={members}
          onChangeRole={handleChangeRole}
          onRemove={handleRemove}
          currentUserId={currentUserId}
        />
      )}

      {/* Invite dialog */}
      <InviteMemberDialog
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={handleInvite}
        seatInfo={{
          used: totalMembers,
          total: org?.seat_limit ?? 0,
        }}
      />
    </div>
  );
}
