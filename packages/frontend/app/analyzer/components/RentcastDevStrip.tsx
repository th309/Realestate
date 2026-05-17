"use client";

interface RentcastDevStripProps {
  tier: string | undefined;
  isPro: boolean;
  address: string;
  propertyLookup: {
    isPending: boolean;
    isSuccess: boolean;
    isError: boolean;
    data: unknown;
    mutate: (args: { address: string }) => void;
  };
}

/**
 * Development-only debug strip showing the current RentCast lookup state.
 * Caller should already gate on `process.env.NODE_ENV !== "production"`.
 */
export function RentcastDevStrip({
  tier,
  isPro,
  address,
  propertyLookup,
}: RentcastDevStripProps) {
  const lookupStatus = propertyLookup.isPending
    ? "pending…"
    : propertyLookup.isSuccess
      ? "success"
      : propertyLookup.isError
        ? "error"
        : "idle";

  return (
    <div
      data-rentcast-debug
      className="rounded-xl border border-outline-variant bg-surface-container-low text-xs px-3 py-2 font-mono text-on-surface-variant flex flex-wrap gap-x-4 gap-y-1"
    >
      <span>
        tier: <strong>{tier ?? "?"}</strong>
      </span>
      <span>
        isPro: <strong>{String(isPro)}</strong>
      </span>
      <span>
        address: <strong>{address || "(empty)"}</strong>
      </span>
      <span>
        lookup: <strong>{lookupStatus}</strong>
      </span>
      {!propertyLookup.data && !propertyLookup.isPending && (
        <button
          onClick={() => propertyLookup.mutate({ address: address.trim() })}
          className="underline text-[var(--md-primary)]"
        >
          Force fetch
        </button>
      )}
    </div>
  );
}
