"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMyOrg } from "@/lib/data";

interface MyOrgResult {
  slug: string | null;
  name: string | null;
  role: string | null;
}

export function useMyOrg() {
  const { data, isLoading, error } = useQuery<MyOrgResult>({
    queryKey: ["my-org"],
    queryFn: fetchMyOrg,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    org: data?.slug ? data : null,
    hasOrg: !!data?.slug,
    isLoading,
    error,
  };
}
