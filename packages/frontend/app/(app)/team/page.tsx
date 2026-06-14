"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { fetchMyOrg } from "@/lib/data";
import { Loader2, Building2, ArrowRight } from "lucide-react";

/**
 * /team — Redirect hub for enterprise org management.
 *
 * If the user belongs to an org → redirects to /org/{slug}/admin/members.
 * If no org exists → shows org creation prompt (enterprise onboarding).
 */
export default function TeamPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "no-org" | "error">(
    "loading",
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth/sign-in?redirect=%2Fteam");
      return;
    }

    fetchMyOrg()
      .then((result) => {
        if (result.slug) {
          router.replace(`/org/${result.slug}/admin/members`);
        } else {
          setStatus("no-org");
        }
      })
      .catch(() => setStatus("error"));
  }, [user, authLoading, router]);

  if (authLoading || status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-on-surface-variant">
          Something went wrong. Please try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  // No org — prompt to create one
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="bg-surface-container-low rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
        <Building2 className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-xl font-medium text-on-surface mb-2">
          Set Up Your Organization
        </h1>
        <p className="text-sm text-on-surface-variant mb-6">
          As an Enterprise user, you can create an organization to manage team
          members, API keys, embeddable widgets, and custom branding.
        </p>
        <button
          onClick={() => router.push("/team/setup")}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Create Organization
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
