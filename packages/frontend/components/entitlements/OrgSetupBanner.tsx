"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * Persistent banner for enterprise users without an organization.
 * Not dismissible — disappears only when user creates an org.
 * Positioned below the header, same pattern as BetaBanner.
 */
export function OrgSetupBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-center">
      <p className="text-sm text-amber-900">
        <span className="inline-flex items-center gap-2 flex-wrap justify-center">
          <span className="bg-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
            Enterprise
          </span>
          <span>
            Set up your organization to unlock team features, API access, and
            embeddable widgets.
          </span>
          <Link
            href="/team/setup"
            className="inline-flex items-center gap-1 text-amber-700 font-semibold hover:text-amber-900 underline underline-offset-2"
          >
            Set Up Organization
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </span>
      </p>
    </div>
  );
}
