/** Compact disclaimer-only footer for all pages. */
export function AppFooter() {
  return (
    <footer className="flex-shrink-0 bg-surface-container border-t border-outline-variant py-2 px-4">
      <p className="text-center text-[10px] text-on-surface-variant">
        Data is provided for informational purposes only. We do not guarantee
        completeness or correctness and accept no liability for its use.
      </p>
    </footer>
  );
}
