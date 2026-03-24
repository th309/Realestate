"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useEntitlements } from "@/lib/entitlements";
import { ChevronDown } from "lucide-react";
import {
  MenuIcon,
  CloseIcon,
  PersonIcon,
  SettingsIcon,
  CreditCardIcon,
  BookIcon,
  HierarchyIcon,
  HelpIcon,
  LogoutIcon,
  HomeIcon,
  MapIcon,
  TrendingIcon,
  ArticleIcon,
  InfoIcon,
  MoneyIcon,
  MarketsIcon,
  ScoreIcon,
} from "@/src/components/common/Icons";

/* ─── Nav structure ─── */

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavDropdown {
  name: string;
  items: NavItem[];
}

type NavEntry = NavItem | NavDropdown;

function isDropdown(entry: NavEntry): entry is NavDropdown {
  return "items" in entry;
}

const NAV: NavEntry[] = [
  { name: "Home", href: "/", icon: HomeIcon },
  {
    name: "Explore",
    items: [
      { name: "Maps", href: "/map", icon: MapIcon },
      { name: "Markets", href: "/market", icon: MarketsIcon },
      { name: "Graphs", href: "/graphs", icon: TrendingIcon },
    ],
  },
  { name: "Reports", href: "/reports", icon: ArticleIcon },
  { name: "Scores", href: "/scores", icon: ScoreIcon },
  { name: "Pricing", href: "/pricing", icon: MoneyIcon },
  {
    name: "More",
    items: [
      { name: "Blog", href: "/blog", icon: BookIcon },
      { name: "About us", href: "/about", icon: InfoIcon },
    ],
  },
];

/** Flat list of all nav items for mobile menu and active-state detection */
const ALL_NAV_ITEMS: NavItem[] = NAV.flatMap((entry) =>
  isDropdown(entry) ? entry.items : [entry],
);

/* ─── Dropdown component ─── */

function NavDropdownMenu({
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

/* ─── Header ─── */

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { tier } = useEntitlements();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-xl font-bold tracking-tight text-primary group-hover:opacity-90 transition-opacity">
                PropertyIQ
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
              <div className="relative">
                <button
                  data-testid="user-menu"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  onBlur={() => setTimeout(() => setIsProfileOpen(false), 200)}
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
                    {tier === "enterprise" && (
                      <DropdownItem
                        icon={HierarchyIcon}
                        label="Manage Seats"
                        href="/team"
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

      {/* Mobile Menu — flat list grouped by section */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-outline-variant bg-surface-container-lowest absolute w-full shadow-lg">
          <div className="px-4 py-4 space-y-1">
            {NAV.map((entry) => {
              if (isDropdown(entry)) {
                return (
                  <div key={entry.name}>
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                      {entry.name}
                    </p>
                    {entry.items.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="flex items-center px-4 py-3 rounded-xl text-base font-medium text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <item.icon className="w-5 h-5 mr-3 text-on-surface-variant" />
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
                  className="flex items-center px-4 py-3 rounded-xl text-base font-medium text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <entry.icon className="w-5 h-5 mr-3 text-on-surface-variant" />
                  {entry.name}
                </Link>
              );
            })}
            <div className="h-px bg-outline-variant my-3" />
            {loading ? null : !!user ? (
              <button
                onClick={async () => {
                  await signOut();
                  setIsMenuOpen(false);
                  router.push("/");
                }}
                className="w-full flex items-center px-4 py-3 rounded-xl text-base font-medium text-error hover:bg-error-container/30"
              >
                <LogoutIcon className="w-5 h-5 mr-3" />
                Sign out
              </button>
            ) : (
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => {
                    router.push("/auth/sign-in");
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-center px-4 py-3 rounded-xl text-base font-medium text-on-surface-variant border border-outline-variant hover:bg-surface-container"
                >
                  Log in
                </button>
                <button
                  onClick={() => {
                    router.push("/auth/sign-up");
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-center px-4 py-3 rounded-xl text-base font-medium text-on-primary bg-primary hover:bg-primary/90 shadow-md"
                >
                  Get Started
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
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
      className="group flex items-center px-3 py-2 text-sm font-medium text-on-surface-variant rounded-lg hover:bg-surface-container hover:text-primary transition-colors"
    >
      <Icon className="w-4 h-4 mr-3 text-on-surface-variant group-hover:text-primary transition-colors" />
      {label}
    </Link>
  );
}
