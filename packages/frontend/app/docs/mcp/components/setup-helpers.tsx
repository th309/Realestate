import React from "react";
import { Info, AlertTriangle } from "lucide-react";

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded text-on-surface">
      {children}
    </code>
  );
}

export function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-primary/10 border border-primary/20 p-4 my-4">
      <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
      <div className="text-sm text-on-surface-variant">{children}</div>
    </div>
  );
}

export function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-warning/10 border border-warning/20 p-4 my-4">
      <AlertTriangle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
      <div className="text-sm text-on-surface-variant">{children}</div>
    </div>
  );
}
