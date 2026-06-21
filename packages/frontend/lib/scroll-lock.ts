/**
 * Ref-counted body scroll lock.
 *
 * Multiple overlays (the mobile nav drawer, the analyzer input sheet, modals)
 * can be open at once. If each one independently sets and restores
 * `document.body.style.overflow`, the last to unmount wins and clobbers the
 * others — leaving the body either stuck locked or unlocked while another
 * overlay is still open. This shared counter sets `overflow: hidden` on the
 * first lock and only restores the original value when the last lock releases.
 *
 * Usage (inside an effect):
 *   useEffect(() => lockBodyScroll(), []);          // lock for the effect's life
 *   useEffect(() => { if (open) return lockBodyScroll(); }, [open]);
 */
let lockCount = 0;

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (lockCount === 0) {
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      // Restore to the document default. The app never sets an inline body
      // overflow except through this lock, so clearing it is correct and avoids
      // re-applying a stale "hidden" captured from an external writer.
      document.body.style.overflow = "";
    }
  };
}
