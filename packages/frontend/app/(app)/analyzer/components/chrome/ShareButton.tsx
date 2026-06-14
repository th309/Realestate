"use client";

import { Share2 } from "lucide-react";

interface Props {
  onClick: () => void;
  disabled?: boolean;
}

export function ShareButton({ onClick, disabled }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      <Share2 className="w-4 h-4" />
      Share
    </button>
  );
}
