"use client";
import type { PropertyLookupResult } from "@/lib/data";
import { fmtUsd } from "../lib/format-helpers";

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

      {rentcastData && (
        <div
          data-rentcast-status
          className="rounded-xl border border-[var(--md-tertiary)] bg-[var(--md-tertiary-container)] text-[var(--md-on-tertiary-container)] px-4 py-3 text-xs flex flex-wrap gap-x-6 gap-y-1"
        >
          {rentcastData.resolved_address && (
            <span className="w-full mb-1 font-semibold">
              Matched: {rentcastData.resolved_address}
              {showMismatch && (
                <span className="ml-2 text-[var(--md-warning)]">
                  (differs from your input — verify ZIP/spelling)
                </span>
              )}
            </span>
          )}
          <span>
            <strong>RentCast:</strong> AVM{" "}
            {rentcastData.avm ? fmtUsd(rentcastData.avm.value) : "unavailable"}
          </span>
          <span>
            Rent{" "}
            {rentcastData.rent
              ? `${fmtUsd(rentcastData.rent.value)}/mo`
              : "unavailable"}
          </span>
          <span>
            Sales comps {rentcastData.sales_comps.length} · Rental comps{" "}
            {rentcastData.rental_comps.length}
          </span>
        </div>
      )}
    </>
  );
}
