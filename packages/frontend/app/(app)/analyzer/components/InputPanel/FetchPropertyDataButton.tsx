"use client";

interface FetchPropertyDataButtonProps {
  address: string;
  isPro: boolean;
  isPending?: boolean;
  onClick?: () => void;
}

export function FetchPropertyDataButton({
  address,
  isPro,
  isPending = false,
  onClick,
}: FetchPropertyDataButtonProps) {
  const disabled = !isPro || !address.trim() || isPending;
  const label = !isPro
    ? "Pro feature: fetch RentCast data"
    : isPending
      ? "Fetching…"
      : "Fetch property + comps from RentCast";
  return (
    <button
      data-fetch-property-button
      data-pro={isPro ? "true" : "false"}
      data-pending={isPending ? "true" : "false"}
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-full py-2 text-sm font-semibold transition-colors ${
        disabled
          ? "bg-surface-container-low text-on-surface-variant cursor-not-allowed"
          : "bg-primary text-on-primary hover:bg-primary-dark"
      }`}
    >
      {label}
    </button>
  );
}
