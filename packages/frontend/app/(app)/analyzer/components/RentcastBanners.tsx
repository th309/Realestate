"use client";
import type { PropertyLookupResult } from "@/lib/data";

interface RentcastBannersProps {
  lookupErrorMsg: string | null;
  quotaExceeded: boolean;
  rentcastData: PropertyLookupResult | null;
  address: string;
}

/**
 * Three stacked status banners surfacing RentCast lookup results: hard error,
 * partial errors (some endpoints returned, others failed), and the success
 * summary. Renders nothing when there's no signal to show.
 */
export function RentcastBanners({
  lookupErrorMsg,
  quotaExceeded,
  rentcastData,
  address,
}: RentcastBannersProps) {
  const normalizedInput = address
    .trim()
    .toLowerCase()
    .replace(/[,\s]+/g, " ");
  const normalizedResolved = rentcastData?.resolved_address
    ?.toLowerCase()
    .replace(/[,\s]+/g, " ");
  const showMismatch =
    !!rentcastData?.resolved_address &&
    !!address.trim() &&
    normalizedResolved !== normalizedInput;

  return (
    <>
      {(lookupErrorMsg || quotaExceeded) && (
        <div
          data-rentcast-status
          role="alert"
          className="rounded-xl border-2 border-[var(--md-error)] bg-[var(--md-error-container)] text-[var(--md-on-error-container)] px-4 py-3 text-sm"
        >
          <strong>RentCast lookup failed:</strong>{" "}
          {quotaExceeded
            ? "monthly quota exceeded — try again next month."
            : lookupErrorMsg}
        </div>
      )}

      {rentcastData && rentcastData.errors && (
        <div
          data-rentcast-partial-errors
          role="alert"
          className="rounded-xl border-2 border-[var(--md-warning)] bg-[var(--md-error-container)] text-[var(--md-on-error-container)] px-4 py-3 text-xs"
        >
          <strong>RentCast partial failure:</strong>
          <ul className="mt-1 list-disc list-inside">
            {rentcastData.errors.property && (
              <li>property: {rentcastData.errors.property}</li>
            )}
            {rentcastData.errors.avm && <li>avm: {rentcastData.errors.avm}</li>}
            {rentcastData.errors.rent && (
              <li>rent: {rentcastData.errors.rent}</li>
            )}
          </ul>
        </div>
      )}

      {showMismatch && (
        <div
          data-rentcast-mismatch
          role="alert"
          className="rounded-xl border border-[var(--md-warning)] bg-[var(--md-warning-container,#FFF4E5)] text-[var(--md-on-warning-container,#7A3E00)] px-4 py-2 text-xs"
        >
          <strong>Address differs from your input</strong> — RentCast matched “
          {rentcastData?.resolved_address}.” Verify the ZIP/spelling if this
          isn’t the property you meant.
        </div>
      )}
    </>
  );
}
