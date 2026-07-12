"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Link, Mail, Check, Download, Loader2, Send } from "lucide-react";
import {
  createMarketShare,
  sendMarketShareEmail,
  type MarketShareResult,
} from "@/lib/data";
import { useModalHistory } from "@/lib/pwa/use-modal-history";

interface ShareMarketModalProps {
  open: boolean;
  onClose: () => void;
  geoLevel: string;
  geoId: string;
  geoName: string;
  score?: number;
  homeValue?: string;
  appreciation?: string;
  dom?: string;
  supply?: string;
}

const SOCIAL_PLATFORMS = [
  {
    id: "twitter",
    label: "X (Twitter)",
    icon: "𝕏",
    getUrl: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: "f",
    getUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: "in",
    getUrl: (url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: "reddit",
    label: "Reddit",
    icon: "r/",
    getUrl: (url: string, text: string) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
] as const;

export function ShareMarketModal({
  open,
  onClose,
  geoLevel,
  geoId,
  geoName,
  score,
  homeValue,
  appreciation,
  dom,
  supply,
}: ShareMarketModalProps) {
  const [share, setShare] = useState<MarketShareResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create share record when modal opens
  useEffect(() => {
    if (!open || share || isCreating || error) return;

    setIsCreating(true);
    setError(null);

    createMarketShare({
      geoLevel,
      geoId,
      geoName,
      score,
      homeValue,
      appreciation,
      dom,
      supply,
    })
      .then(setShare)
      .catch((err) => setError(err.message))
      .finally(() => setIsCreating(false));
  }, [
    open,
    share,
    isCreating,
    geoLevel,
    geoId,
    geoName,
    score,
    homeValue,
    appreciation,
    dom,
    supply,
  ]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setShare(null);
      setCopied(false);
      setShowEmail(false);
      setEmailTo("");
      setEmailMessage("");
      setEmailSending(false);
      setEmailSent(false);
      setEmailError(null);
      setError(null);
    }
  }, [open]);

  // System back button / edge-swipe closes this modal instead of navigating
  // away or exiting the installed PWA.
  useModalHistory(open, onClose, "share-market-modal");

  const handleCopyLink = useCallback(async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.shareUrl);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = share.shareUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [share]);

  const handleSocialShare = useCallback(
    (platformId: string) => {
      if (!share) return;
      const platform = SOCIAL_PLATFORMS.find((p) => p.id === platformId);
      if (!platform) return;
      const text = `Check out the ${geoName} market on PropertyIQ`;
      const url = platform.getUrl(share.shareUrl, text);
      window.open(url, "_blank", "noopener,noreferrer,width=600,height=500");
    },
    [share, geoName],
  );

  const handleDownloadCard = useCallback(async () => {
    const params = new URLSearchParams({ title: geoName });
    if (score != null) params.set("score", String(Math.round(score)));
    if (homeValue) params.set("homeValue", homeValue);
    if (appreciation) params.set("appreciation", appreciation);
    if (dom) params.set("dom", dom);
    if (supply) params.set("supply", supply);

    const ogUrl = `/api/og?${params.toString()}`;
    const response = await fetch(ogUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `propertyiq-${geoName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [geoName, score, homeValue, appreciation, dom, supply]);

  const handleSendEmail = useCallback(async () => {
    if (!share || !emailTo) return;

    setEmailSending(true);
    setEmailError(null);

    try {
      await sendMarketShareEmail({
        shareToken: share.shareToken,
        recipientEmail: emailTo,
        message: emailMessage || undefined,
      });
      setEmailSent(true);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setEmailSending(false);
    }
  }, [share, emailTo, emailMessage]);

  if (!open) return null;

  const ogPreviewParams = new URLSearchParams({ title: geoName });
  if (score != null) ogPreviewParams.set("score", String(Math.round(score)));
  if (homeValue) ogPreviewParams.set("homeValue", homeValue);
  if (appreciation) ogPreviewParams.set("appreciation", appreciation);
  if (dom) ogPreviewParams.set("dom", dom);
  if (supply) ogPreviewParams.set("supply", supply);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-surface rounded-[28px] shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-2">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">
              Share this market
            </h2>
            <p className="text-sm text-on-surface-variant">{geoName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container transition-colors"
          >
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        {/* OG Card Preview */}
        <div className="px-6 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/og?${ogPreviewParams.toString()}`}
            alt={`${geoName} market card`}
            className="w-full rounded-xl border border-outline-variant"
          />
        </div>

        {/* Error state */}
        {error && (
          <div className="px-6 pb-4">
            <p className="text-sm text-error bg-error/10 rounded-xl px-4 py-3">
              Failed to create share link. Please try again.
            </p>
          </div>
        )}

        {/* Loading state */}
        {isCreating && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}

        {/* Share channels */}
        {share && !error && (
          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-3">
              {/* Copy Link */}
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-outline-variant hover:bg-surface-container transition-colors"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Link className="w-5 h-5 text-primary" />
                )}
                <span className="text-sm font-medium text-on-surface">
                  {copied ? "Copied!" : "Copy Link"}
                </span>
              </button>

              {/* Email */}
              <button
                onClick={() => setShowEmail(!showEmail)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                  showEmail
                    ? "border-primary bg-primary/5"
                    : "border-outline-variant hover:bg-surface-container"
                }`}
              >
                <Mail className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-on-surface">
                  Email
                </span>
              </button>

              {/* Social platforms */}
              {SOCIAL_PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => handleSocialShare(platform.id)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-outline-variant hover:bg-surface-container transition-colors"
                >
                  <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-primary">
                    {platform.icon}
                  </span>
                  <span className="text-sm font-medium text-on-surface">
                    {platform.label}
                  </span>
                </button>
              ))}

              {/* Download Card */}
              <button
                onClick={handleDownloadCard}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-outline-variant hover:bg-surface-container transition-colors col-span-2"
              >
                <Download className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-on-surface">
                  Download Card Image
                </span>
                <span className="text-xs text-on-surface-variant ml-auto">
                  For TikTok / Instagram
                </span>
              </button>
            </div>

            {/* Email form */}
            {showEmail && (
              <div className="mt-4 p-4 rounded-xl bg-surface-container">
                {emailSent ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="w-5 h-5" />
                    <span className="text-sm font-medium">Email sent!</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="email"
                      placeholder="Recipient email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface text-sm focus:outline-none focus:border-primary"
                    />
                    <textarea
                      placeholder="Add a message (optional)"
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface text-sm resize-none focus:outline-none focus:border-primary"
                    />
                    {emailError && (
                      <p className="text-xs text-error">{emailError}</p>
                    )}
                    <button
                      onClick={handleSendEmail}
                      disabled={!emailTo || emailSending}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full bg-primary text-on-primary text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      {emailSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      {emailSending ? "Sending..." : "Send"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
