import { Check, Circle } from "lucide-react";
import type { PasswordRequirement } from "./helpers";

/** Live password-requirement checklist shown while typing a password. */
export function PasswordStrength({
  requirements,
}: {
  requirements: PasswordRequirement[];
}) {
  return (
    <div data-testid="password-strength" className="mt-2 space-y-1">
      {requirements.map((req) => (
        <div key={req.label} className="flex items-center gap-2 text-xs">
          {req.met ? (
            <Check className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <Circle className="w-3.5 h-3.5 text-on-surface-variant/40" />
          )}
          <span
            className={
              req.met ? "text-green-600" : "text-on-surface-variant/60"
            }
          >
            {req.label}
          </span>
        </div>
      ))}
    </div>
  );
}
