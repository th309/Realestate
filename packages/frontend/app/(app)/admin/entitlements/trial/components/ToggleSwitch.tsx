import { ToggleLeft, ToggleRight } from "lucide-react";

export function ToggleSwitch({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-on-surface">{label}</div>
        {description && (
          <div className="text-xs text-on-surface-variant mt-0.5">
            {description}
          </div>
        )}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className="flex-shrink-0"
        aria-label={`Toggle ${label}`}
      >
        {enabled ? (
          <ToggleRight className="w-10 h-6 text-primary" />
        ) : (
          <ToggleLeft className="w-10 h-6 text-on-surface-variant" />
        )}
      </button>
    </div>
  );
}
