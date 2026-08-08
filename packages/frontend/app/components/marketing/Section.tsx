import type { ReactNode } from "react";
import {
  CONTAINER,
  RHYTHM,
  SURFACE,
  type Rhythm,
  type Surface,
} from "./layout-contract";

/**
 * A marketing section band. Owns its own surface so adjacent sections separate
 * visually without a page-wide gradient, and applies the shared container and
 * rhythm so no page picks its own width or padding.
 */
export function Section({
  surface = "a",
  rhythm = "standard",
  id,
  children,
}: {
  surface?: Surface;
  rhythm?: Rhythm;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`${SURFACE[surface]} ${RHYTHM[rhythm]}`}>
      <div className={CONTAINER}>{children}</div>
    </section>
  );
}
