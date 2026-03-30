"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { NavItem } from "./header-nav-data";

export function NavDropdownMenu({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isChildActive = items.some(
    (item) =>
      pathname === item.href ||
      (item.href !== "/" && pathname?.startsWith(item.href)),
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, close]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
          isChildActive
            ? "text-primary bg-primary-container/30"
            : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        }`}
      >
        {label}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/50 overflow-hidden z-50">
          <div className="py-1">
            {items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={close}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "text-primary bg-primary-container/20"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
