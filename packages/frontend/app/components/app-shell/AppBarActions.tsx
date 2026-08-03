"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics/tracker";
import { useEntitlements } from "@/lib/entitlements";
import { useMyOrg } from "@/lib/data";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";
import {
  MenuIcon,
  CloseIcon,
  PersonIcon,
  SettingsIcon,
  CreditCardIcon,
  BookIcon,
  BuildingIcon,
  HelpIcon,
  LogoutIcon,
  HomeIcon,
} from "@/src/components/common/Icons";
import { MobileMenu } from "@/src/components/layout/MobileMenu";
import { TrialBadge } from "@/src/components/layout/TrialBadge";
import { ShareGlyphIcon } from "@/app/components/pwa/ShareGlyphIcon";
import { AlertBell } from "@/components/alerts";

/** Local, as in Header — the shared Icons module does not export this glyph. */
function DownloadIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z" />
    </svg>
  );
}

function DropdownItem({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
    >
      <Icon className="mr-3 h-4 w-4 text-on-surface-variant transition-colors group-hover:text-primary" />
      {label}
    </Link>
  );
}

/**
 * The stateful right-hand side of the dark application bar.
 *
 * This is a restyle of the marketing `Header`'s account area, not a reduction:
 * the tier badge, the paid-only alert bell, every profile menu entry, the PWA
 * install flow with its instructions panel, the admin entry, sign-out, and the
 * mobile menu are all preserved. It lives apart from `AppBar` so the bar itself
 * stays presentational and testable without an auth provider.
 */
export function AppBarActions() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { tier } = useEntitlements();
  const isPaid = tier === "pro" || tier === "enterprise" || tier === "admin";
  const { org } = useMyOrg();
  const { canPromptNatively, promptInstall, isInstalled } = useInstallPrompt();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);

  useEffect(() => {
    setIsProfileOpen(false);
    setIsMenuOpen(false);
    setShowInstallInstructions(false);
  }, [pathname]);

  async function handleGetAppClick() {
    trackEvent("pwa.get_app_clicked", {});
    if (canPromptNatively) {
      await promptInstall();
    } else {
      setShowInstallInstructions(true);
    }
  }

  return (
    <>
      <div className="ml-auto hidden items-center gap-3 lg:flex">
        {loading ? null : user ? (
          <>
            <TrialBadge />
            {isPaid && <AlertBell />}
            <div
              className="relative"
              onBlur={(e) => {
                // Only close on a genuine click-away: focus landing on another
                // element inside this dropdown (e.g. "Get the app", which opens
                // an instructions panel rather than navigating) must not close it.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setTimeout(() => setIsProfileOpen(false), 200);
                }
              }}
            >
              <button
                data-testid="user-menu"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                aria-expanded={isProfileOpen}
                aria-haspopup="true"
                aria-label="Account menu"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-on-primary shadow-md transition-all hover:shadow-lg active:scale-95"
              >
                <PersonIcon className="h-5 w-5" />
              </button>

              <div
                className={`absolute right-0 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-xl transition-all duration-200 ${
                  isProfileOpen
                    ? "visible scale-100 transform opacity-100"
                    : "invisible scale-95 transform opacity-0"
                }`}
              >
                <div className="border-b border-outline-variant bg-surface-container/50 p-4">
                  <p className="text-sm font-semibold text-on-surface">
                    {user?.user_metadata?.display_name || user?.email}
                  </p>
                  <p className="truncate text-xs text-on-surface-variant">
                    {user?.email}
                  </p>
                </div>
                <div className="space-y-0.5 p-2">
                  <DropdownItem icon={HomeIcon} label="Home" href="/" />
                  <DropdownItem
                    icon={SettingsIcon}
                    label="Settings"
                    href="/account"
                  />
                  <DropdownItem
                    icon={CreditCardIcon}
                    label="Billing"
                    href="/account"
                  />
                  <DropdownItem
                    icon={BookIcon}
                    label="Data Glossary"
                    href="/data"
                  />
                  {tier === "enterprise" && org?.slug && (
                    <DropdownItem
                      icon={BuildingIcon}
                      label="Organization"
                      href={`/org/${org.slug}/admin`}
                    />
                  )}
                  <DropdownItem icon={HelpIcon} label="Help" href="/help" />
                  {!isInstalled && (
                    <button
                      onClick={handleGetAppClick}
                      className="group flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
                    >
                      <DownloadIcon className="mr-3 h-4 w-4 text-on-surface-variant transition-colors group-hover:text-primary" />
                      Get the app
                    </button>
                  )}
                  {showInstallInstructions && (
                    <div className="mx-1 mt-1 flex items-start gap-2 rounded-lg border border-outline-variant bg-surface-container p-3 text-xs text-on-surface-variant">
                      <ShareGlyphIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="flex-1">
                        Tap the share icon, then &ldquo;Add to Home
                        Screen&rdquo; to install PropertyIQ.
                      </span>
                      <button
                        onClick={() => setShowInstallInstructions(false)}
                        aria-label="Close install instructions"
                        className="leading-none text-on-surface-variant hover:text-on-surface"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  {tier === "admin" && (
                    <DropdownItem
                      icon={SettingsIcon}
                      label="Admin Dashboard"
                      href="/admin"
                    />
                  )}
                  <div className="my-1 h-px bg-outline-variant" />
                  <button
                    onClick={async () => {
                      await signOut();
                      router.push("/");
                    }}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-error transition-colors hover:bg-error-container/30"
                  >
                    <LogoutIcon className="mr-3 h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/auth/sign-in")}
              className="px-4 py-2 text-sm font-medium text-inverse-on-surface/80 transition-colors hover:text-inverse-on-surface"
            >
              Log in
            </button>
            <button
              onClick={() => router.push("/auth/sign-up")}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-95"
            >
              Get Started
            </button>
          </div>
        )}
      </div>

      <div className="ml-auto lg:hidden">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
          aria-haspopup="true"
          className="rounded-full p-2 text-inverse-on-surface/80 transition-colors hover:bg-on-primary/10 hover:text-inverse-on-surface"
        >
          {isMenuOpen ? (
            <CloseIcon className="h-6 w-6" />
          ) : (
            <MenuIcon className="h-6 w-6" />
          )}
        </button>
      </div>

      {isMenuOpen && (
        <MobileMenu
          user={user}
          loading={loading}
          tier={tier}
          orgSlug={org?.slug}
          onClose={() => setIsMenuOpen(false)}
          onSignOut={async () => {
            await signOut();
            setIsMenuOpen(false);
            router.push("/");
          }}
          onNavigate={(path) => router.push(path)}
        />
      )}
    </>
  );
}
