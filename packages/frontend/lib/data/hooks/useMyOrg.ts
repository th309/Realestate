"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMyOrg } from "@/lib/data";
import { useAuth } from "@/lib/auth";

interface MyOrgResult {
  slug: string | null;
  name: string | null;
  role: string | null;
}

export function useMyOrg() {
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading, error } = useQuery<MyOrgResult>({
    queryKey: ["my-org", user?.id ?? "anon"],
    queryFn: fetchMyOrg,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !authLoading && Boolean(user),
  });

  return {
    org: data?.slug ? data : null,
    hasOrg: !!data?.slug,
    isLoading,
    error,
  };
}
