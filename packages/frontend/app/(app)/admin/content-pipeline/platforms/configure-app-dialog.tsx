"use client";
import { useEffect, useState } from "react";
import { M3Dialog } from "../components/m3-dialog";
import {
  setAppCredentials,
  clearAppCredentials,
} from "../lib/app-credentials-api";
import type { AppCredentialStatus } from "../lib/content-pipeline-api";
import { useToast } from "../lib/toast";

interface PlatformGuide {
  label: string;
  /** What the platform calls the public id field. */
  clientIdLabel: string;
  /** What the platform calls the secret field. */
  clientSecretLabel: string;
  /** Copy-pasteable hint about where to register the app. */
  hint: string;
  /** External link for the platform's developer console. */
  consoleUrl: string;
}

const GUIDES: Record<string, PlatformGuide> = {
  youtube_shorts: {
    label: "YouTube Shorts",
    clientIdLabel: "Client ID",
    clientSecretLabel: "Client Secret",
    hint: "Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → Web application. YouTube Data API v3 must be enabled.",
    consoleUrl: "https://console.cloud.google.com/apis/credentials",
  },
  tiktok: {
    label: "TikTok",
    clientIdLabel: "Client Key",
    clientSecretLabel: "Client Secret",
    hint: "developers.tiktok.com → Manage apps → your app → App details. Login Kit + Content Posting API products required.",
    consoleUrl: "https://developers.tiktok.com/apps/",
  },
  instagram_reels: {
    label: "Instagram Reels (via Meta)",
    clientIdLabel: "App ID",
    clientSecretLabel: "App Secret",
    hint: "developers.facebook.com → My Apps → your Meta Business app → App settings → Basic. instagram_content_publish scope must be approved.",
    consoleUrl: "https://developers.facebook.com/apps/",
  },
  facebook_reels: {
    label: "Facebook Reels (via Meta)",
    clientIdLabel: "App ID",
    clientSecretLabel: "App Secret",
    hint: "Same Meta app as Instagram. The publish_video scope is the critical one for Reels.",
    consoleUrl: "https://developers.facebook.com/apps/",
  },
  linkedin: {
    label: "LinkedIn",
    clientIdLabel: "Client ID",
    clientSecretLabel: "Client Secret",
    hint: "linkedin.com/developers → your app → Auth tab. Marketing Developer Platform must be approved for the w_organization_social scope.",
    consoleUrl: "https://www.linkedin.com/developers/apps",
  },
};

/**
 * Modal for entering a platform's developer-app OAuth credentials. Shows
 * platform-specific guidance + the redirect URI to register on the
 * platform's console. Encrypts at rest server-side.
 */
export function ConfigureAppDialog({
  open,
  platform,
  status,
  onClose,
  onSaved,
}: {
  open: boolean;
  platform: string;
  status: AppCredentialStatus;
  onClose: () => void;
  onSaved: (next: AppCredentialStatus) => void;
}) {
  const toast = useToast();
  const guide = GUIDES[platform] ?? {
    label: platform,
    clientIdLabel: "Client ID",
    clientSecretLabel: "Client Secret",
    hint: "Refer to the platform's developer documentation.",
    consoleUrl: "",
  };
  // The redirect URI is computed by the backend from APP_BASE_URL and
  // returned in `status.redirectUri`. Falls back to a clear placeholder
  // if APP_BASE_URL isn't set on the backend.
  const redirectUri = status.redirectUri;

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"save" | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setClientId("");
      setClientSecret("");
      setNotes(status.notes ?? "");
      setBusy(null);
      setError(null);
    }
  }, [open, status]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("save");
    try {
      const next = await setAppCredentials(platform, {
        clientId,
        clientSecret,
        notes: notes.trim() || undefined,
      });
      onSaved(next);
      toast.success(
        `${guide.label} credentials saved · click Connect to authorize an account`,
      );
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg);
      toast.error(`Save failed: ${msg.slice(0, 100)}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleClear() {
    if (!confirm(`Clear stored ${guide.label} app credentials?`)) return;
    setError(null);
    setBusy("clear");
    try {
      const next = await clearAppCredentials(platform);
      onSaved(next);
      toast.success(`${guide.label} credentials cleared`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Clear failed";
      setError(msg);
      toast.error(`Clear failed: ${msg.slice(0, 100)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <M3Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      ariaLabel={`Configure ${guide.label}`}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSave}>
        <div className="p-6 space-y-5">
          <div>
            <h2 className="text-xl font-medium text-on-surface">
              Configure {guide.label}
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Enter the developer-app credentials so PropertyIQ can start the
              OAuth flow. Stored encrypted.
            </p>
          </div>

          <StatusBlock status={status} />

          <div className="rounded-xl bg-surface-container-low p-4 text-xs space-y-2">
            <p className="text-on-surface-variant">{guide.hint}</p>
            {guide.consoleUrl && (
              <a
                href={guide.consoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Open developer console ↗
              </a>
            )}
            <div className="pt-2 border-t border-outline-variant mt-2">
              <p className="text-on-surface-variant mb-1">
                Register this redirect URI on the platform&apos;s app:
              </p>
              {redirectUri ? (
                <code className="block bg-surface-container-high text-on-surface px-2 py-1.5 rounded font-mono text-[11px] break-all select-all">
                  {redirectUri}
                </code>
              ) : (
                <p className="text-error font-medium">
                  APP_BASE_URL is not set on the backend — set it before saving
                  credentials, otherwise the OAuth callback will not resolve.
                </p>
              )}
            </div>
          </div>

          <Field label={guide.clientIdLabel}>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              autoComplete="off"
              spellCheck={false}
              placeholder={
                status.lastFour ? `Currently set · ends ${status.lastFour}` : ""
              }
              className="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono"
            />
          </Field>

          <Field label={guide.clientSecretLabel}>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              required
              autoComplete="new-password"
              spellCheck={false}
              placeholder={status.configured ? "••••••••" : ""}
              className="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono"
            />
          </Field>

          <Field label="Notes (optional)">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. PropertyIQ prod app, owned by Troy"
              className="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </Field>

          {error && <p className="text-xs text-error">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 pb-6">
          <div>
            {status.configured && status.source === "database" && (
              <button
                type="button"
                onClick={handleClear}
                disabled={!!busy}
                className="text-error text-xs font-medium hover:bg-error/10 rounded-full px-3 py-1.5 disabled:opacity-50 transition-colors duration-200"
              >
                Clear stored credentials
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={!!busy}
              className="px-5 py-2.5 rounded-full text-sm font-medium text-on-surface hover:bg-on-surface/8 disabled:opacity-50 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!busy || !clientId.trim() || !clientSecret.trim()}
              className="px-5 py-2.5 rounded-full text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2 transition-colors duration-200"
            >
              {busy === "save" && (
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border-2 border-on-primary/30 border-t-on-primary animate-spin"
                  aria-hidden
                />
              )}
              Save credentials
            </button>
          </div>
        </div>
      </form>
    </M3Dialog>
  );
}

function StatusBlock({ status }: { status: AppCredentialStatus }) {
  if (!status.configured) {
    return (
      <div className="rounded-lg bg-error/5 border border-error/30 px-3 py-2 text-xs text-on-surface">
        <strong>Not configured.</strong> Connect won&apos;t work until you save
        credentials below.
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-tertiary-container/40 border border-tertiary/30 px-3 py-2 text-xs text-on-surface">
      <strong>Configured</strong> via{" "}
      {status.source === "database" ? "admin UI" : "Railway env vars"} ·{" "}
      {status.lastFour && (
        <span className="font-mono">ends {status.lastFour}</span>
      )}
      {status.updatedAt && (
        <span className="text-on-surface-variant">
          {" "}
          · updated {new Date(status.updatedAt).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}
