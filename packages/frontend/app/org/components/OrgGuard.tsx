"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "../hooks/useOrg";

interface OrgGuardProps {
  children: React.ReactNode;
}

/**
 * Gate that only renders children when the authenticated user has
 * the 'admin' role for the current organization.  Non-admins are
 * redirected to the homepage.
 */
export function OrgGuard({ children }: OrgGuardProps) {
  const { role, loading } = useOrg();
  const router = useRouter();

  useEffect(() => {
    if (!loading && role !== "admin") {
      router.replace("/");
    }
  }, [loading, role, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-outline-variant border-t-primary" />
      </div>
    );
  }

  if (role !== "admin") {
    // Redirect is in flight; render nothing to avoid flash.
    return null;
  }

  return <>{children}</>;
}
