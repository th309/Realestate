import { StatusDot } from "./StatusDot";

interface AlertItemProps {
  severity: "critical" | "warning" | "info";
  message: string;
  triggeredAt: string;
  acknowledged?: boolean;
}

function formatTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return "Just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const severityDotVariant: Record<
  AlertItemProps["severity"],
  "error" | "warning" | "info"
> = {
  critical: "error",
  warning: "warning",
  info: "info",
};

export function AlertItem({
  severity,
  message,
  triggeredAt,
  acknowledged = false,
}: AlertItemProps) {
  const isPulsing = severity === "critical" && !acknowledged;
  const dotVariant = severityDotVariant[severity];

  return (
    <div className="flex items-start gap-2.5 py-2">
      <div className="mt-0.5">
        <StatusDot variant={dotVariant} pulse={isPulsing} size="sm" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-on-surface leading-snug truncate">
          {message}
        </p>
      </div>
      <span className="text-xs text-on-surface-variant shrink-0">
        {formatTimeAgo(triggeredAt)}
      </span>
    </div>
  );
}
