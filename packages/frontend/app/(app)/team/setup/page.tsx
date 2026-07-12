"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useMyOrg } from "@/lib/data";
import { Loader2 } from "lucide-react";
import { OrgNameStep } from "./components/OrgNameStep";
import { InviteTeamStep } from "./components/InviteTeamStep";
import { FeatureTourStep } from "./components/FeatureTourStep";

export default function TeamSetupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { org, hasOrg, isLoading: orgLoading } = useMyOrg();
  const [step, setStep] = useState(1);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/sign-in?redirect=%2Fteam%2Fsetup");
    }
  }, [user, authLoading, router]);

  // Resume: if org exists, skip to step 2
  useEffect(() => {
    if (hasOrg && org) {
      setOrgSlug(org.slug);
      setStep(2);
    }
  }, [hasOrg, org]);

  if (authLoading || orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const steps = ["Organization", "Team", "Get Started"];

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-12">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-10">
        {steps.map((label, i) => {
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`w-8 h-px ${isDone ? "bg-primary" : "bg-outline-variant"}`}
                />
              )}
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    isActive
                      ? "bg-primary text-on-primary"
                      : isDone
                        ? "bg-primary/20 text-primary"
                        : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {stepNum}
                </div>
                <span
                  className={`text-xs ${isActive ? "text-on-surface font-medium" : "text-on-surface-variant"}`}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {step === 1 && (
        <OrgNameStep
          onCreated={(slug) => {
            setOrgSlug(slug);
            setStep(2);
          }}
        />
      )}
      {step === 2 && orgSlug && (
        <InviteTeamStep
          orgSlug={orgSlug}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && orgSlug && <FeatureTourStep orgSlug={orgSlug} />}
    </div>
  );
}
