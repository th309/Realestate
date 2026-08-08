"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

export interface OverflowLink {
  href: string;
  label: string;
  Icon: LucideIcon;
}

/**
 * Secondary destinations for the application bar.
 *
 * These exist because the map carried its own left icon rail whose entries
 * lived in no other chrome — remove that rail without this menu and `/about`,
 * `/graphs` and `/pricing` become unreachable from every authed surface.
 * (`/market` is a first-class tool, so it went into the main row instead.)
 */
export function AppBarOverflow({ links }: { links: OverflowLink[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const containsActive = links.some(
    ({ href }) => pathname === href || pathname?.startsWith(`${href}/`),
  );

  // Close on outside click or Escape. Both listeners are only attached while
  // the menu is open, so a closed bar costs nothing on every authed page.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (links.length === 0) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="More destinations"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition-colors ${
          open || containsActive
            ? "bg-primary text-on-primary"
            : "text-inverse-on-surface/70 hover:text-inverse-on-surface"
        }`}
      >
        <MoreHorizontal className="size-4" strokeWidth={2} />
        <span className="hidden lg:inline">More</span>
      </button>

      {open && (
        // A disclosure, not an ARIA menu: these are navigation links, and
        // role="menu"/"menuitem" would both strip their link semantics and
        // promise arrow-key menu behaviour this does not implement.
        <ul
          id={menuId}
          aria-label="More destinations"
          className="absolute right-0 top-full z-50 mt-1 min-w-[180px] list-none overflow-hidden rounded-xl border border-outline-variant bg-surface py-1 shadow-lg"
        >
          {links.map(({ href, label, Icon }) => {
            const active =
              pathname === href || pathname?.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-primary-container text-on-primary-container"
                      : "text-on-surface hover:bg-surface-container"
                  }`}
                >
                  <Icon
                    className="size-4 text-on-surface-variant"
                    strokeWidth={2}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
