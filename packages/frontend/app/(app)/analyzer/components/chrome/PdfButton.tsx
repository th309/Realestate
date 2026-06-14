"use client";

import { Download, Loader2 } from "lucide-react";

interface Props {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function PdfButton({ onClick, loading, disabled }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-low text-on-surface text-sm font-medium hover:bg-surface-container transition-colors disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      {loading ? "Rendering…" : "PDF"}
    </button>
  );
}
