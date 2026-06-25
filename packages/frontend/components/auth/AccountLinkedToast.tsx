"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/Toast";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
};

/**
 * Reads the one-shot `piq_account_linked` flag written by the auth callback
 * when a Google sign-in is linked to a pre-existing PropertyIQ account, and
 * fires a single welcome-back toast. Renders nothing. Must be mounted inside
 * <ToastProvider>.
 */
export function AccountLinkedToast() {
  const { showToast } = useToast();

  useEffect(() => {
    const provider = sessionStorage.getItem("piq_account_linked");
    if (!provider) return;
    sessionStorage.removeItem("piq_account_linked");
    const label = PROVIDER_LABELS[provider] ?? "social";
    showToast(
      `Welcome back — your ${label} sign-in is now linked to your existing PropertyIQ account.`,
      "🔗",
    );
  }, [showToast]);

  return null;
}
