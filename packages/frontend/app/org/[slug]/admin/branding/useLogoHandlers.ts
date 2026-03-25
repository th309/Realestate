"use client";

import { useState, useCallback } from "react";
import { uploadOrgLogo, deleteOrgLogo } from "@/lib/data";

/**
 * Encapsulates logo upload and delete logic for the branding page.
 * Extracted from useBrandingForm to keep file sizes under the limit.
 */
export function useLogoHandlers(orgSlug: string | undefined) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogoUpload = useCallback(
    async (file: File) => {
      if (!orgSlug) return;
      setUploading(true);
      setError(null);
      try {
        const result = await uploadOrgLogo(orgSlug, file);
        setLogoUrl(result.logo_url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload logo");
      } finally {
        setUploading(false);
      }
    },
    [orgSlug],
  );

  const handleLogoDelete = useCallback(async () => {
    if (!orgSlug) return;
    setError(null);
    try {
      await deleteOrgLogo(orgSlug);
      setLogoUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove logo");
    }
  }, [orgSlug]);

  return {
    logoUrl,
    setLogoUrl,
    uploading,
    logoError: error,
    handleLogoUpload,
    handleLogoDelete,
  };
}
