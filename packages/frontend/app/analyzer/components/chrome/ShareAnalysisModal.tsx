"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Download,
  Link as LinkIcon,
  Loader2,
  Mail,
  Send,
  X,
} from "lucide-react";
import {
  downloadAnalysisPdf,
  sendAnalysisShareEmail,
} from "@/lib/data/fetchers/analyzer";
import { emitAnalyzerEvent } from "../../lib/analyzer-telemetry";

interface ShareAnalysisModalProps {
  open: boolean;
  onClose: () => void;
  shareToken: string | null;
  saveInProgress: boolean;
  saveError: string | null;
  headingLabel: string;
}

/**
 * Share-channel modal for the analyzer. Mirrors `ShareMarketModal` but
 * scoped to the three channels the spec calls for: Copy Link, Email,
 * Download PDF. The live iframe preview at ~40vh renders
 * `/shared/analysis/:token?print=1` so the sender sees the same layout
 * the recipient (or the PDF) will get.
 */
export function ShareAnalysisModal({
  open,
  onClose,
  shareToken,
  saveInProgress,
  saveError,
  headingLabel,
}: ShareAnalysisModalProps) {
  const [copied, setCopied] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setShowEmail(false);
      setEmailTo("");
      setEmailMessage("");
      setEmailSending(false);
      setEmailSent(false);
      setEmailError(null);
      setPdfDownloading(false);
      setPdfError(null);
    }
  }, [open]);

  const shareUrl = shareToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/shared/analysis/${shareToken}`
    : "";

  const handleCopy = useCallback(async () => {
    if (!shareToken) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    emitAnalyzerEvent("analyzer_share_link_copied", { token: shareToken });
    setTimeout(() => setCopied(false), 2000);
  }, [shareToken, shareUrl]);

  const handleEmail = useCallback(async () => {
    if (!shareToken || !emailTo) return;
    setEmailSending(true);
    setEmailError(null);
    const res = await sendAnalysisShareEmail({
      shareToken,
      recipientEmail: emailTo,
      message: emailMessage || undefined,
    });
    setEmailSending(false);
    if (res.success) {
      setEmailSent(true);
      emitAnalyzerEvent("analyzer_share_email_sent", { token: shareToken });
    } else {
      setEmailError(res.error ?? "Failed to send");
    }
  }, [shareToken, emailTo, emailMessage]);

  const handleDownloadPdf = useCallback(async () => {
    if (!shareToken) return;
    setPdfDownloading(true);
    setPdfError(null);
    try {
      const blob = await downloadAnalysisPdf(shareToken);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DealAnalysis-${headingLabel.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      emitAnalyzerEvent("analyzer_pdf_downloaded", {
        token: shareToken,
        from: "modal",
      });
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "PDF render failed");
    } finally {
      setPdfDownloading(false);
    }
  }, [shareToken, headingLabel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-surface rounded-[28px] shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">
              Share this analysis
            </h2>
            <p className="text-sm text-on-surface-variant">{headingLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        {saveInProgress && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <span className="ml-3 text-sm text-on-surface-variant">
              Preparing share link…
            </span>
          </div>
        )}

        {saveError && (
          <div className="px-6 pb-4">
            <p className="text-sm text-error bg-error/10 rounded-xl px-4 py-3">
              {saveError}
            </p>
          </div>
        )}

        {shareToken && !saveInProgress && (
          <>
            <div className="px-6 pb-4">
              <p className="text-xs uppercase tracking-wide text-on-surface-variant mb-2">
                Preview
              </p>
              <iframe
                src={`/shared/analysis/${shareToken}?print=1`}
                title="Share preview"
                className="w-full h-[40vh] rounded-xl border border-outline-variant bg-white"
              />
            </div>

            <div className="px-6 pb-6 space-y-3">
              <p className="text-xs uppercase tracking-wide text-on-surface-variant">
                Send via
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-outline-variant hover:bg-surface-container transition-colors"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <LinkIcon className="w-5 h-5 text-primary" />
                  )}
                  <span className="text-sm font-medium text-on-surface">
                    {copied ? "Copied!" : "Copy Link"}
                  </span>
                </button>

                <button
                  onClick={() => setShowEmail((v) => !v)}
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

                <button
                  onClick={handleDownloadPdf}
                  disabled={pdfDownloading}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-outline-variant hover:bg-surface-container transition-colors col-span-2 disabled:opacity-50"
                >
                  {pdfDownloading ? (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  ) : (
                    <Download className="w-5 h-5 text-primary" />
                  )}
                  <span className="text-sm font-medium text-on-surface">
                    {pdfDownloading ? "Rendering PDF…" : "Download PDF"}
                  </span>
                  <span className="text-xs text-on-surface-variant ml-auto">
                    White-label · Letter size
                  </span>
                </button>
              </div>

              {pdfError && <p className="text-xs text-error">{pdfError}</p>}

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
                        onClick={handleEmail}
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

              <p className="text-xs text-on-surface-variant pt-2">
                Recipients see your branding and the analysis. They do not see
                your full address.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
