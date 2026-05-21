"use client";
import { useMode, Mode } from "../../lib/mode-context";

const OPTIONS: Array<{ value: Mode; icon: string; label: string }> = [
  { value: "pro", icon: "⚡", label: "Pro" },
  { value: "present", icon: "📊", label: "Present" },
  { value: "pdf", icon: "🖨", label: "PDF" },
];

export function ModeToolbar() {
  const { mode, setMode } = useMode();
  return (
    <div className="inline-flex rounded-full bg-surface-container-low p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setMode(opt.value)}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            mode === opt.value
              ? "bg-primary text-on-primary"
              : "text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          {opt.icon} {opt.label}
        </button>
      ))}
    </div>
  );
}
