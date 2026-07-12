import { StatusDot } from "./StatusDot";
import { formatRelativeTimeShort } from "@/lib/format/relative-time";

interface AlertItemProps {
  severity: "critical" | "warning" | "info";
  message: string;
  triggeredAt: string;
  acknowledged?: boolean;
}

function formatTimeAgo(isoString: string): string {
  return formatRelativeTimeShort(Date.now() - new Date(isoString).getTime(), {
    zeroLabel: "Just now",
  });
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
