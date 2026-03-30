"use client";

import Link from "next/link";
import { NAV, isDropdown } from "./header-nav-data";
import { LogoutIcon } from "@/src/components/common/Icons";

interface MobileMenuProps {
  user: { email?: string } | null;
  loading: boolean;
  onClose: () => void;
  onSignOut: () => void;
  onNavigate: (path: string) => void;
}

export function MobileMenu({
  user,
  loading,
  onClose,
  onSignOut,
  onNavigate,
}: MobileMenuProps) {
  return (
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
                    onClick={onClose}
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
              onClick={onClose}
            >
              <entry.icon className="w-5 h-5 mr-3 text-on-surface-variant" />
              {entry.name}
            </Link>
          );
        })}
        <div className="h-px bg-outline-variant my-3" />
        {loading ? null : !!user ? (
          <button
            onClick={onSignOut}
            className="w-full flex items-center px-4 py-3 rounded-xl text-base font-medium text-error hover:bg-error-container/30"
          >
            <LogoutIcon className="w-5 h-5 mr-3" />
            Sign out
          </button>
        ) : (
          <div className="space-y-3 pt-2">
            <button
              onClick={() => {
                onNavigate("/auth/sign-in");
                onClose();
              }}
              className="block w-full text-center px-4 py-3 rounded-xl text-base font-medium text-on-surface-variant border border-outline-variant hover:bg-surface-container"
            >
              Log in
            </button>
            <button
              onClick={() => {
                onNavigate("/auth/sign-up");
                onClose();
              }}
              className="block w-full text-center px-4 py-3 rounded-xl text-base font-medium text-on-primary bg-primary hover:bg-primary/90 shadow-md"
            >
              Get Started
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
