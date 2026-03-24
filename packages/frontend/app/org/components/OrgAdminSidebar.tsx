"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Palette,
  Code,
  Key,
  ScrollText,
  ArrowLeft,
  Menu,
  X,
} from "lucide-react";
import { useOrg } from "../hooks/useOrg";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exactMatch?: boolean;
}

interface OrgAdminSidebarProps {
  slug: string;
}

/**
 * M3 Navigation Drawer for the enterprise org admin portal.
 * Mirrors the layout and styling of AdminCommandSidebar but scoped to
 * the /org/[slug]/admin/* routes.
 */
export function OrgAdminSidebar({ slug }: OrgAdminSidebarProps) {
  const pathname = usePathname();
  const { org } = useOrg();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: `/org/${slug}/admin`,
      icon: LayoutDashboard,
      exactMatch: true,
    },
    {
      label: "Members",
      href: `/org/${slug}/admin/members`,
      icon: Users,
    },
    {
      label: "Billing",
      href: `/org/${slug}/admin/billing`,
      icon: CreditCard,
    },
    {
      label: "Branding",
      href: `/org/${slug}/admin/branding`,
      icon: Palette,
    },
    {
      label: "Embeds",
      href: `/org/${slug}/admin/embeds`,
      icon: Code,
    },
    {
      label: "API Keys",
      href: `/org/${slug}/admin/api-keys`,
      icon: Key,
    },
    {
      label: "Audit Log",
      href: `/org/${slug}/admin/audit`,
      icon: ScrollText,
    },
  ];

  function isActive(item: NavItem): boolean {
    if (item.exactMatch) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  const sidebarContent = (
    <aside className="w-64 bg-surface-container-low border-r border-outline-variant h-screen sticky top-0 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-outline-variant">
        <h1 className="text-lg font-semibold text-on-surface truncate">
          {org?.name ?? slug}
        </h1>
        <p className="text-xs text-on-surface-variant">Organization Admin</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors
                  ${
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-outline-variant">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs text-on-surface-variant hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to PropertyIQ
        </Link>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile hamburger toggle */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-surface-container-high shadow-md text-on-surface"
        aria-label={
          isMobileOpen ? "Close org admin menu" : "Open org admin menu"
        }
      >
        {isMobileOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <Menu className="w-5 h-5" />
        )}
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`
          md:hidden fixed inset-y-0 left-0 z-40 transform transition-transform duration-300
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:block">{sidebarContent}</div>
    </>
  );
}
