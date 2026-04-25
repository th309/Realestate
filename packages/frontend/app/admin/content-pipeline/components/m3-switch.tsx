"use client";

/**
 * M3-spec switch (track + sliding thumb). Small variant: 32×16 track,
 * 12×12 thumb that grows to 14×14 when on. Use for boolean settings
 * where the on/off state is the focus (not for triggering actions).
 */
export function M3Switch({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center h-5 w-9 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed ${
        checked
          ? "bg-primary"
          : "bg-surface-container-highest border border-outline"
      }`}
    >
      <span
        aria-hidden
        className={`inline-block rounded-full transition-all duration-200 shadow-sm ${
          checked
            ? "h-3.5 w-3.5 ml-[1.125rem] bg-on-primary"
            : "h-3 w-3 ml-1 bg-outline"
        }`}
      />
    </button>
  );
}
