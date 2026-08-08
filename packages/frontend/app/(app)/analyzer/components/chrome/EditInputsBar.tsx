"use client";

interface EditInputsBarProps {
  onClick: () => void;
}

/**
 * Bar shown once a property is loaded, below the 1140px two-column
 * breakpoint. Gives a persistent, obvious way back into the input sheet to
 * tweak price/rent/financing — replaces the floating edit button. Hidden above
 * 1140px, where the sticky sidebar is always open.
 */
export function EditInputsBar({ onClick }: EditInputsBarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-medium text-on-primary shadow-sm transition-transform active:scale-[0.99] min-[1140px]:hidden"
    >
      <span aria-hidden>✎</span>
      Edit inputs
    </button>
  );
}
