"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface ShareRedirectClientProps {
  redirectUrl: string;
  geoName?: string;
}

export function ShareRedirectClient({
  redirectUrl,
  geoName,
}: ShareRedirectClientProps) {
  const router = useRouter();

  useEffect(() => {
    router.replace(redirectUrl);
  }, [router, redirectUrl]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center">
        <div className="w-3 h-3 rounded-full bg-primary mx-auto mb-4 animate-pulse" />
        <p className="text-sm text-on-surface-variant">
          Redirecting to {geoName || "market report"}…
        </p>
      </div>
    </div>
  );
}
