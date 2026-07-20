import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";

export function TrialStatusBadge({
  daysRemaining,
  convertedAt,
  cancelledAt,
}: {
  daysRemaining: number;
  convertedAt: string | null;
  cancelledAt: string | null;
}) {
  if (convertedAt) {
    return (
      <span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
        <CheckCircle className="w-3 h-3" />
        Converted
      </span>
    );
  }
  if (cancelledAt) {
    return (
      <span className="flex items-center gap-1 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
        <XCircle className="w-3 h-3" />
        Cancelled
      </span>
    );
  }
  if (daysRemaining <= 0) {
    return (
      <span className="flex items-center gap-1 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
        <XCircle className="w-3 h-3" />
        Expired
      </span>
    );
  }
  if (daysRemaining <= 1) {
    return (
      <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
        <AlertCircle className="w-3 h-3" />
        Expiring
      </span>
    );
  }
  if (daysRemaining <= 3) {
    return (
      <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3" />
        {daysRemaining} days left
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
      <CheckCircle className="w-3 h-3" />
      {daysRemaining} days left
    </span>
  );
}
