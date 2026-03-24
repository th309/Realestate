"use client";

import React, { useState, useCallback } from "react";
import {
  X,
  Link2,
  Check,
  Loader2,
  Download,
  FileSpreadsheet,
  Printer,
  Globe,
  Lock,
} from "lucide-react";
import { createReportShareLink } from "@/lib/data";
import { useEntitlements } from "@/lib/entitlements";
import { downloadCsv } from "@/lib/export";

interface ShareReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  reportTitle: string;
  userId: string;
  existingShareToken?: string | null;
  reportData?: Record<string, unknown>[] | null;
  onPrint: () => void;
  onExportPdf: () => void;
}

export function ShareReportModal({
  isOpen,
  onClose,
  reportId,
  reportTitle,
  userId,
  existingShareToken,
  reportData,
  onPrint,
  onExportPdf,
}: ShareReportModalProps) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(
    existingShareToken
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/shared/report/${existingShareToken}`
      : null,
  );
  const { canAccess } = useEntitlements();
  const canExportCsv = canAccess("feature", "export_csv");

  const handleCopyLink = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      let token = existingShareToken;
      if (!token) {
        token = await createReportShareLink(reportId, userId);
      }
      const url = `${window.location.origin}/shared/report/${token}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      await navigator.clipboard.writeText(window.location.href).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setSharing(false);
    }
  }, [reportId, userId, existingShareToken, sharing]);

  const handleExportCsv = useCallback(() => {
    if (!reportData || reportData.length === 0) return;
    const columns = Object.keys(reportData[0]).map((k) => ({
      key: k,
      label: k,
    }));
    const filename = `${reportTitle.toLowerCase().replace(/\s+/g, "-")}-report`;
    downloadCsv(reportData, columns, filename);
  }, [reportData, reportTitle]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-scrim/40" onClick={onClose} />
      <div className="relative bg-surface-container-lowest rounded-3xl elevation-3 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <h2 className="text-lg font-medium text-on-surface">
            Share &amp; Export
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-container rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        {/* Options */}
        <div className="px-6 py-4 space-y-2">
          {/* Copy share link */}
          <button
            onClick={handleCopyLink}
            disabled={sharing}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-surface-container transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              {sharing ? (
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              ) : copied ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <Link2 className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-on-surface">
                {sharing
                  ? "Creating link..."
                  : copied
                    ? "Link copied!"
                    : "Copy share link"}
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {shareUrl
                  ? "Anyone with the link can view this report"
                  : "Generate a public, view-only link"}
              </p>
            </div>
            <Globe className="w-4 h-4 text-on-surface-variant shrink-0" />
          </button>

          {/* Divider */}
          <div className="border-t border-outline-variant my-2" />

          {/* PDF Download */}
          <button
            onClick={() => {
              onExportPdf();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-surface-container transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-on-surface">
                Download PDF
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Save a formatted PDF of this report
              </p>
            </div>
          </button>

          {/* CSV Export */}
          <button
            onClick={
              canExportCsv
                ? () => {
                    handleExportCsv();
                    onClose();
                  }
                : undefined
            }
            disabled={!reportData || reportData.length === 0}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors text-left ${
              canExportCsv ? "hover:bg-surface-container" : "opacity-60"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
              {canExportCsv ? (
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
              ) : (
                <Lock className="w-5 h-5 text-on-surface-variant" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-on-surface">Export CSV</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {canExportCsv
                  ? "Download report data as a spreadsheet"
                  : "Upgrade to Pro to export CSV"}
              </p>
            </div>
          </button>

          {/* Print */}
          <button
            onClick={() => {
              onPrint();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-surface-container transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-on-surface">Print</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Print this report or save via print dialog
              </p>
            </div>
          </button>
        </div>

        {/* Footer hint */}
        {shareUrl && (
          <div className="px-6 py-3 border-t border-outline-variant bg-surface-container-low">
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Shared: {shareUrl}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
