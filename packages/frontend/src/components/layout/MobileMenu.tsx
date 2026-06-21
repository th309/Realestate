"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NAV, isDropdown } from "./header-nav-data";
import { lockBodyScroll } from "@/lib/scroll-lock";
import {
  LogoutIcon,
  SettingsIcon,
  CreditCardIcon,
  BookIcon,
  HelpIcon,
  BuildingIcon,
  PersonIcon,
} from "@/src/components/common/Icons";

interface MobileMenuUser {
  email?: string;
  user_metadata?: { display_name?: string };
}

interface MobileMenuProps {
  user: MobileMenuUser | null;
  loading: boolean;
  tier?: string;
  orgSlug?: string | null;
  onClose: () => void;
  onSignOut: () => void;
  onNavigate: (path: string) => void;
}

interface AccountLink {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

/**
 * Mobile navigation — an M3 modal navigation drawer that slides in from the
 * right, below the sticky header. Sits at z-[60] so it covers the z-50 sticky
 * score ticker (the account links used to be unreachable behind it), is fully
 * scrollable, and reserves the bottom safe-area inset. For signed-in users it
 * surfaces the same account actions as the desktop avatar dropdown
 * (Header.tsx) — the desktop dropdown is the source of truth for this list.
 */
export function MobileMenu({
  user,
  loading,
  tier,
  orgSlug,
  onClose,
  onSignOut,
  onNavigate,
}: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<() => void>(() => {});

  // Animate out, then let the parent unmount us.
  const handleClose = () => {
    setOpen(false);
    window.setTimeout(onClose, 280);
  };

  // Slide in on mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Ref-counted body scroll lock (coordinates with other open sheets/drawers).
  useEffect(() => lockBodyScroll(), []);

  // Keep the latest close handler reachable from the keydown listener below.
  useEffect(() => {
    closeRef.current = handleClose;
  });

  // Modal a11y: move focus into the drawer, trap Tab inside it, close on
  // Escape, and restore focus to the trigger on unmount (WCAG 2.1.2 / 2.4.3).
  useEffect(() => {
    const node = drawerRef.current;
    if (!node) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // preventScroll: the drawer slides in via transform; a default focus() would
    // scroll the viewport toward the off-screen element on Safari.
    node.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = node.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',
      );
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey && (activeEl === firstEl || activeEl === node)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && activeEl === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  const displayName =
    user?.user_metadata?.display_name || user?.email || "Your account";
  const tierLabel = tier && tier !== "free" ? tier : null;

  const accountLinks: AccountLink[] = [
    { icon: SettingsIcon, label: "Settings", href: "/account" },
    { icon: CreditCardIcon, label: "Billing", href: "/account" },
    { icon: BookIcon, label: "Data Glossary", href: "/data" },
    ...(tier === "enterprise" && orgSlug
      ? [
          {
            icon: BuildingIcon,
            label: "Organization",
            href: `/org/${orgSlug}/admin`,
          },
        ]
      : []),
    { icon: HelpIcon, label: "Help", href: "/help" },
    ...(tier === "admin"
      ? [{ icon: SettingsIcon, label: "Admin Dashboard", href: "/admin" }]
      : []),
  ];

  const itemClass =
    "flex items-center px-4 py-3 rounded-xl text-base font-medium text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors";

  return (
    <div className="md:hidden">
      {/* Scrim (below the 64px header so the header's close button stays live) */}
      <div
        className={`fixed inset-x-0 bottom-0 top-16 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`fixed bottom-0 right-0 top-16 z-[60] flex w-[88%] max-w-sm flex-col rounded-l-2xl border-l border-outline-variant bg-surface-container-low shadow-xl outline-none transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 pb-safe">
          {/* Auth / account — pinned to the TOP so it's the first thing seen,
              not buried under the nav list. */}
          {loading ? null : user ? (
            <>
              {/* Account identity */}
              <div className="mb-1 flex items-center gap-3 rounded-xl bg-surface-container px-4 py-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-on-primary shadow-sm">
                  <PersonIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-on-surface">
                      {displayName}
                    </p>
                    {tierLabel && (
                      <span className="flex-shrink-0 rounded-full bg-primary-container px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-primary-container">
                        {tierLabel}
                      </span>
                    )}
                  </div>
                  {user.email && (
                    <p className="truncate text-xs text-on-surface-variant">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>

              <p className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Account
              </p>
              {accountLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={itemClass}
                  onClick={handleClose}
                >
                  <link.icon className="mr-3 h-5 w-5 text-on-surface-variant" />
                  {link.label}
                </Link>
              ))}
            </>
          ) : (
            <div className="space-y-3 pb-1">
              <button
                onClick={() => {
                  onNavigate("/auth/sign-up");
                  handleClose();
                }}
                className="block w-full rounded-xl bg-primary px-4 py-3 text-center text-base font-medium text-on-primary shadow-md hover:bg-primary/90"
              >
                Get Started
              </button>
              <button
                onClick={() => {
                  onNavigate("/auth/sign-in");
                  handleClose();
                }}
                className="block w-full rounded-xl border border-outline-variant px-4 py-3 text-center text-base font-medium text-on-surface-variant hover:bg-surface-container"
              >
                Log in
              </button>
            </div>
          )}

          {!loading && <div className="my-3 h-px bg-outline-variant" />}

          {/* Primary navigation */}
          {NAV.map((entry) => {
            if (isDropdown(entry)) {
              return (
                <div key={entry.name}>
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    {entry.name}
                  </p>
                  {entry.items.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={itemClass}
                      onClick={handleClose}
                    >
                      <item.icon className="mr-3 h-5 w-5 text-on-surface-variant" />
                      {item.name}
                    </Link>
                  ))}
                </div>
              );
            }
            return (
              <Link
                key={entry.name}
                href={entry.href}
                className={itemClass}
                onClick={handleClose}
              >
                <entry.icon className="mr-3 h-5 w-5 text-on-surface-variant" />
                {entry.name}
              </Link>
            );
          })}

          {/* Sign out pinned to the bottom (signed-in only) */}
          {!loading && user && (
            <>
              <div className="my-3 h-px bg-outline-variant" />
              <button
                onClick={() => {
                  handleClose();
                  onSignOut();
                }}
                className="flex w-full items-center rounded-xl px-4 py-3 text-base font-medium text-error hover:bg-error-container/30"
              >
                <LogoutIcon className="mr-3 h-5 w-5" />
                Sign out
              </button>
            </>
          )}
        </nav>
      </aside>
    </div>
  );
}
