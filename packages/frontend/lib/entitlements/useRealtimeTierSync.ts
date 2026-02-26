"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { UserTier } from "./types";

/** Tier display names for the toast notification */
const TIER_DISPLAY_NAMES: Record<UserTier, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
  admin: "Admin",
};

/** Duration in ms to show the tier-change toast */
const TOAST_DISPLAY_DURATION_MS = 5000;

interface UseRealtimeTierSyncOptions {
  /** Current authenticated user ID (null if unauthenticated) */
  userId: string | null;
  /** Callback fired when a tier change is detected — should trigger entitlements refetch */
  onTierChange: () => void;
}

interface RealtimeTierSyncState {
  /** Toast message to display (null when hidden) */
  toastMessage: string | null;
  /** Dismiss the toast manually */
  dismissToast: () => void;
}

/**
 * Subscribes to Supabase Realtime broadcast on a private per-user channel
 * (`user:{userId}:profile`). A DB trigger on `user_profiles` broadcasts
 * changes to this channel. When `subscription_tier` changes (e.g., admin
 * upgrades a user), triggers a refetch of entitlements and shows a toast.
 *
 * Uses Option A (broadcast via DB trigger) for production scalability.
 */
export function useRealtimeTierSync({
  userId,
  onTierChange,
}: UseRealtimeTierSyncOptions): RealtimeTierSyncState {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    setToastMessage(null);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Only subscribe when user is authenticated
    if (!userId) return;

    const supabase = createSupabaseBrowserClient();

    // Set auth token for private channel access
    supabase.realtime.setAuth();

    const channelName = `user:${userId}:profile`;

    const channel = supabase
      .channel(channelName, { config: { private: true } })
      .on("broadcast", { event: "UPDATE" }, (payload) => {
        const record = payload.payload?.record;
        const oldRecord = payload.payload?.old_record;

        const oldTier = oldRecord?.subscription_tier as UserTier | undefined;
        const newTier = record?.subscription_tier as UserTier | undefined;

        if (newTier && oldTier !== newTier) {
          console.info(
            `[Entitlements] Realtime tier change detected: ${oldTier} → ${newTier}`,
          );

          // Show toast notification
          const displayName = TIER_DISPLAY_NAMES[newTier] ?? newTier;
          setToastMessage(`Your plan has been updated to ${displayName}.`);

          // Auto-dismiss after timeout
          if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
          }
          toastTimerRef.current = setTimeout(() => {
            setToastMessage(null);
            toastTimerRef.current = null;
          }, TOAST_DISPLAY_DURATION_MS);

          // Trigger entitlements refetch
          onTierChange();
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.info(
            "[Entitlements] Realtime tier sync subscription active (broadcast)",
          );
        }
        if (status === "CHANNEL_ERROR") {
          console.warn(
            "[Entitlements] Realtime tier sync channel error — will retry automatically",
          );
        }
      });

    channelRef.current = channel;

    return () => {
      // Cleanup: remove the channel and clear any pending toast timer
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
    // onTierChange is a stable callback (useCallback with [] deps in provider)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { toastMessage, dismissToast };
}
