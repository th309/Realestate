"use client";

import React, { useState, useCallback } from "react";
import { Shield, ChevronDown, Trash2, Loader2 } from "lucide-react";
import type { OrgMember } from "@/lib/data";

interface MemberTableProps {
  members: OrgMember[];
  onChangeRole: (userId: string, newRole: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  currentUserId: string | null;
}

/** Role badge colors */
function roleBadge(role: string) {
  if (role === "admin") {
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  }
  return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
}

/** Status pill colors based on member state */
function statusPill(member: OrgMember) {
  // Infer status from presence of joined_at and role field patterns.
  // The backend may add an explicit status field in the future.
  const joinedRecently =
    member.joined_at &&
    Date.now() - new Date(member.joined_at).getTime() < 1000;
  const isPending = !member.display_name && joinedRecently;

  if (isPending) {
    return {
      label: "Pending",
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    };
  }
  return {
    label: "Active",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * Sortable member table with role toggle and remove actions.
 * Follows M3 table styling with rounded container and outline borders.
 */
export function MemberTable({
  members,
  onChangeRole,
  onRemove,
  currentUserId,
}: MemberTableProps) {
  const [roleDropdownOpen, setRoleDropdownOpen] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const handleRoleChange = useCallback(
    async (userId: string, newRole: string) => {
      setPendingAction(userId);
      setRoleDropdownOpen(null);
      try {
        await onChangeRole(userId, newRole);
      } finally {
        setPendingAction(null);
      }
    },
    [onChangeRole],
  );

  const handleRemove = useCallback(
    async (userId: string) => {
      setPendingAction(userId);
      setConfirmRemove(null);
      try {
        await onRemove(userId);
      } finally {
        setPendingAction(null);
      }
    },
    [onRemove],
  );

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-8 text-center">
        <p className="text-on-surface-variant">No members found.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-outline-variant overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-container-low border-b border-outline-variant">
            <th className="text-left px-4 py-3 font-medium text-on-surface-variant">
              Member
            </th>
            <th className="text-left px-4 py-3 font-medium text-on-surface-variant">
              Role
            </th>
            <th className="text-left px-4 py-3 font-medium text-on-surface-variant hidden sm:table-cell">
              Status
            </th>
            <th className="text-left px-4 py-3 font-medium text-on-surface-variant hidden md:table-cell">
              Joined
            </th>
            <th className="text-right px-4 py-3 font-medium text-on-surface-variant">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {members.map((member) => {
            const isSelf = member.user_id === currentUserId;
            const status = statusPill(member);
            const isLoading = pendingAction === member.user_id;

            return (
              <tr
                key={member.user_id}
                className="bg-surface hover:bg-surface-container/50 transition-colors"
              >
                {/* Name + email */}
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-on-surface">
                      {member.display_name || "Unnamed"}
                      {isSelf && (
                        <span className="ml-1.5 text-xs text-on-surface-variant">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {member.email}
                    </p>
                  </div>
                </td>

                {/* Role badge */}
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadge(member.role)}`}
                  >
                    {member.role === "admin" && <Shield className="w-3 h-3" />}
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                  >
                    {status.label}
                  </span>
                </td>

                {/* Joined date */}
                <td className="px-4 py-3 text-on-surface-variant hidden md:table-cell">
                  {formatDate(member.joined_at)}
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-on-surface-variant inline-block" />
                  ) : isSelf ? (
                    <span className="text-xs text-on-surface-variant">—</span>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      {/* Role toggle */}
                      <div className="relative">
                        <button
                          onClick={() =>
                            setRoleDropdownOpen(
                              roleDropdownOpen === member.user_id
                                ? null
                                : member.user_id,
                            )
                          }
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors"
                          aria-label="Change role"
                        >
                          Role
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {roleDropdownOpen === member.user_id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setRoleDropdownOpen(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 z-20 rounded-xl border border-outline-variant bg-surface shadow-md min-w-[120px]">
                              {["admin", "member"].map((r) => (
                                <button
                                  key={r}
                                  onClick={() =>
                                    handleRoleChange(member.user_id, r)
                                  }
                                  disabled={member.role === r}
                                  className="block w-full text-left px-3 py-2 text-sm hover:bg-surface-container-high transition-colors disabled:opacity-40 first:rounded-t-xl last:rounded-b-xl text-on-surface"
                                >
                                  {r.charAt(0).toUpperCase() + r.slice(1)}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Remove button */}
                      {confirmRemove === member.user_id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRemove(member.user_id)}
                            className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmRemove(null)}
                            className="rounded-lg px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRemove(member.user_id)}
                          className="rounded-lg p-1 text-on-surface-variant hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                          aria-label={`Remove ${member.display_name || member.email}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
