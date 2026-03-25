"use client";

import React, { useState } from "react";
import { Globe, CheckCircle2, Clock, Trash2, Loader2 } from "lucide-react";
import { useOrg } from "../../../hooks/useOrg";
import {
  setCustomDomain,
  verifyCustomDomain,
  removeCustomDomain,
} from "@/lib/data";

const INPUT_CLASS =
  "flex-1 px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

interface CustomDomainSectionProps {
  customSubdomain: string;
  customDomainStatus: string | null;
  customDomainVerifiedAt: string | null;
  onDomainChanged: () => void;
}

/**
 * Custom Domain section — self-service add, verify DNS, and remove flow.
 *
 * States:
 * - No domain configured: input + "Add Domain" button
 * - Pending (not verified): CNAME instructions + "Verify DNS" + "Remove"
 * - Active (verified): green check, verified date, "Remove"
 */
export function CustomDomainSection({
  customSubdomain,
  customDomainStatus,
  customDomainVerifiedAt,
  onDomainChanged,
}: CustomDomainSectionProps) {
  const { org } = useOrg();
  const slug = org?.slug;

  const [domainInput, setDomainInput] = useState("");
  const [cnameTarget, setCnameTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDomain = !!customSubdomain;
  const isVerified =
    customDomainStatus === "active" && !!customDomainVerifiedAt;
  const isPending = hasDomain && !isVerified;

  async function handleAddDomain() {
    if (!slug || !domainInput.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await setCustomDomain(slug, domainInput.trim());
      setCnameTarget(result.cname_target);
      setDomainInput("");
      onDomainChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add domain");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyDns() {
    if (!slug) return;
    setBusy(true);
    setError(null);
    try {
      const result = await verifyCustomDomain(slug);
      if (result.verified) {
        onDomainChanged();
      } else {
        setError(
          result.error ||
            "DNS record not detected yet. Please check your configuration.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveDomain() {
    if (!slug) return;
    setBusy(true);
    setError(null);
    try {
      await removeCustomDomain(slug);
      setCnameTarget(null);
      onDomainChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove domain");
    } finally {
      setBusy(false);
    }
  }

  const verifiedDate = customDomainVerifiedAt
    ? new Date(customDomainVerifiedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-primary" />
        <h2 className="text-base font-medium text-on-surface tracking-wide">
          Custom Domain
        </h2>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* --- State: No domain configured --- */}
      {!hasDomain && (
        <div>
          <label className="text-sm font-medium text-on-surface-variant tracking-wide">
            Domain
          </label>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="analytics.yourbrokerage.com"
              className={INPUT_CLASS}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddDomain();
              }}
            />
            <button
              onClick={() => void handleAddDomain()}
              disabled={busy || !domainInput.trim()}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Add Domain
            </button>
          </div>
          <p className="text-xs text-on-surface-variant mt-1.5">
            Enter the full domain you want to use (e.g.
            analytics.yourbrokerage.com)
          </p>
        </div>
      )}

      {/* --- State: Pending verification --- */}
      {isPending && (
        <DomainPendingView
          subdomain={customSubdomain}
          cnameTarget={cnameTarget || "propertyiq.up.railway.app"}
          busy={busy}
          onVerify={() => void handleVerifyDns()}
          onRemove={() => void handleRemoveDomain()}
        />
      )}

      {/* --- State: Active (verified) --- */}
      {isVerified && (
        <DomainActiveView
          subdomain={customSubdomain}
          verifiedDate={verifiedDate}
          busy={busy}
          onRemove={() => void handleRemoveDomain()}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DomainPendingView({
  subdomain,
  cnameTarget,
  busy,
  onVerify,
  onRemove,
}: {
  subdomain: string;
  cnameTarget: string;
  busy: boolean;
  onVerify: () => void;
  onRemove: () => void;
}) {
  const subdomainPrefix = subdomain.split(".")[0] || subdomain;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-on-surface">
            {subdomain}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <Clock className="w-3 h-3" />
            Pending verification
          </span>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-on-surface mb-2">
          Configure your DNS:
        </p>
        <div className="bg-surface-container rounded-lg p-4 font-mono text-sm space-y-1.5">
          <div className="flex gap-2">
            <span className="text-on-surface-variant w-14 shrink-0">Type:</span>
            <span className="text-on-surface font-medium">CNAME</span>
          </div>
          <div className="flex gap-2">
            <span className="text-on-surface-variant w-14 shrink-0">Name:</span>
            <span className="text-on-surface font-medium">
              {subdomainPrefix}
              <span className="text-on-surface-variant font-normal">
                {" "}
                (or your subdomain prefix)
              </span>
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-on-surface-variant w-14 shrink-0">
              Target:
            </span>
            <span className="text-on-surface font-medium">{cnameTarget}</span>
          </div>
        </div>
        <p className="text-xs text-on-surface-variant mt-2">
          DNS changes can take up to 48 hours to propagate.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onVerify}
          disabled={busy}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Verify DNS
        </button>
        <button
          onClick={onRemove}
          disabled={busy}
          className="text-sm text-on-surface-variant hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Remove Domain
        </button>
      </div>
    </div>
  );
}

function DomainActiveView({
  subdomain,
  verifiedDate,
  busy,
  onRemove,
}: {
  subdomain: string;
  verifiedDate: string | null;
  busy: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-on-surface">
            {subdomain}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </span>
        </div>
      </div>

      {verifiedDate && (
        <p className="text-xs text-on-surface-variant">
          Verified on: {verifiedDate}
        </p>
      )}

      <button
        onClick={onRemove}
        disabled={busy}
        className="text-sm text-on-surface-variant hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-1"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Remove Domain
      </button>
    </div>
  );
}
