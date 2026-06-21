"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useEntitlements } from "@/lib/entitlements";
import { useMyOrg } from "@/lib/data";
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
import { NAV, isDropdown } from "./header-nav-data";
import { NavDropdownMenu } from "./NavDropdownMenu";
import { MobileMenu } from "./MobileMenu";
import { TrialBadge } from "./TrialBadge";

/* ─── Profile dropdown item ─── */

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
      className="group flex items-center px-3 py-2 text-sm font-medium text-on-surface-variant rounded-lg hover:bg-surface-container hover:text-primary transition-colors"
    >
      <Icon className="w-4 h-4 mr-3 text-on-surface-variant group-hover:text-primary transition-colors" />
      {label}
    </Link>
  );
}

/* ─── Header ─── */

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { tier } = useEntitlements();
  const { org } = useMyOrg();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Close menus on navigation
  useEffect(() => {
    setIsProfileOpen(false);
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "bg-surface-container-lowest/95 backdrop-blur-md shadow-sm border-b border-outline-variant"
          : "bg-surface-container-lowest border-b border-transparent"
      }`}
    >
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link
              href="/"
              className="flex items-center gap-2 group"
              aria-label="PropertyIQ home"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 64 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0"
                aria-hidden="true"
              >
                <rect width="64" height="64" rx="14" fill="#3949AB" />
                <path
                  d="M20 16V48H26V38H34C40.627 38 46 32.627 46 26C46 19.373 40.627 16 34 16H20Z"
                  fill="white"
                />
                <circle cx="34" cy="26" r="6" fill="#3949AB" />
                <circle cx="44" cy="44" r="4" fill="#00C853" />
                <circle cx="36" cy="48" r="2.5" fill="#00C853" opacity="0.6" />
              </svg>
              <span className="text-xl font-bold tracking-tight group-hover:opacity-90 transition-opacity">
                <span className="text-[#1A237E]">Property</span>
                <span className="text-[#3949AB]">IQ</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 ml-8">
            {NAV.map((entry) => {
              if (isDropdown(entry)) {
                return (
                  <NavDropdownMenu
                    key={entry.name}
                    label={entry.name}
                    items={entry.items}
                    pathname={pathname}
                  />
                );
              }
              const isActive =
                pathname === entry.href ||
                (entry.href !== "/" && pathname?.startsWith(entry.href));
              return (
                <Link
                  key={entry.name}
                  href={entry.href}
                  className={`relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-primary bg-primary-container/30"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  }`}
                >
                  {entry.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Side Actions */}
          <div className="hidden md:flex items-center gap-4">
            {loading ? null : !!user ? (
              <>
                <TrialBadge />
                <div className="relative">
                  <button
                    data-testid="user-menu"
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    onBlur={() =>
                      setTimeout(() => setIsProfileOpen(false), 200)
                    }
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary text-on-primary shadow-md hover:shadow-lg transition-all active:scale-95"
                  >
                    <PersonIcon className="w-5 h-5" />
                  </button>

                  {/* Profile Dropdown */}
                  <div
                    className={`absolute right-0 mt-2 w-64 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant transition-all duration-200 origin-top-right overflow-hidden ${
                      isProfileOpen
                        ? "transform opacity-100 scale-100 visible"
                        : "transform opacity-0 scale-95 invisible"
                    }`}
                  >
                    <div className="p-4 border-b border-outline-variant bg-surface-container/50">
                      <p className="text-sm font-semibold text-on-surface">
                        {user?.user_metadata?.display_name || user?.email}
                      </p>
                      <p className="text-xs text-on-surface-variant truncate">
                        {user?.email}
                      </p>
                    </div>
                    <div className="p-2 space-y-0.5">
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
                        className="w-full flex items-center px-3 py-2 text-sm font-medium text-error rounded-lg hover:bg-error-container/30 transition-colors"
                      >
                        <LogoutIcon className="w-4 h-4 mr-3" />
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
                  className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors"
                >
                  Log in
                </button>
                <button
                  onClick={() => router.push("/auth/sign-up")}
                  className="px-5 py-2.5 text-sm font-medium text-on-primary bg-primary rounded-full hover:bg-primary/90 transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                  Get Started
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
              aria-haspopup="true"
              className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              {isMenuOpen ? (
                <CloseIcon className="w-6 h-6" />
              ) : (
                <MenuIcon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
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
    </header>
  );
}
