"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Palette, Loader2, AlertCircle, Globe } from "lucide-react";
import { useOrg } from "../../../hooks/useOrg";
import {
  fetchOrgBranding,
  updateOrgBranding,
  uploadOrgLogo,
  deleteOrgLogo,
} from "@/lib/data";
import { LogoUploader } from "../../../components/LogoUploader";
import { AccentColorPicker } from "../../../components/AccentColorPicker";
import { BrandingPreview } from "../../../components/BrandingPreview";
import { BusinessInfoSection } from "./BusinessInfoSection";

/**
 * Branding admin page — logo upload, accent color, website URL,
 * with a live preview panel on the right.
 */
export default function OrgAdminBranding() {
  const { org } = useOrg();

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [zip, setZip] = useState("");
  const [managingBroker, setManagingBroker] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Track initial values so we know when form is dirty
  const [initialAccent, setInitialAccent] = useState("#2563eb");
  const [initialWebsite, setInitialWebsite] = useState("");
  const [initialPhone, setInitialPhone] = useState("");
  const [initialStreet, setInitialStreet] = useState("");
  const [initialCity, setInitialCity] = useState("");
  const [initialAddrState, setInitialAddrState] = useState("");
  const [initialZip, setInitialZip] = useState("");
  const [initialManagingBroker, setInitialManagingBroker] = useState("");

  const loadBranding = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrgBranding(org.slug);
      setLogoUrl(data.logo_url);
      setAccentColor(data.accent_color || "#2563eb");
      setWebsiteUrl(data.website_url || "");
      setPhone(data.phone || "");
      setStreet(data.address?.street || "");
      setCity(data.address?.city || "");
      setAddrState(data.address?.state || "");
      setZip(data.address?.zip || "");
      setManagingBroker(data.managing_broker || "");
      setInitialAccent(data.accent_color || "#2563eb");
      setInitialWebsite(data.website_url || "");
      setInitialPhone(data.phone || "");
      setInitialStreet(data.address?.street || "");
      setInitialCity(data.address?.city || "");
      setInitialAddrState(data.address?.state || "");
      setInitialZip(data.address?.zip || "");
      setInitialManagingBroker(data.managing_broker || "");
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load branding");
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => {
    void loadBranding();
  }, [loadBranding]);

  // Track dirty state
  useEffect(() => {
    const changed =
      accentColor !== initialAccent ||
      websiteUrl !== initialWebsite ||
      phone !== initialPhone ||
      street !== initialStreet ||
      city !== initialCity ||
      addrState !== initialAddrState ||
      zip !== initialZip ||
      managingBroker !== initialManagingBroker;
    setDirty(changed);
    setSaveSuccess(false);
  }, [
    accentColor,
    websiteUrl,
    phone,
    street,
    city,
    addrState,
    zip,
    managingBroker,
    initialAccent,
    initialWebsite,
    initialPhone,
    initialStreet,
    initialCity,
    initialAddrState,
    initialZip,
    initialManagingBroker,
  ]);

  const handleAccentChange = useCallback((color: string) => {
    setAccentColor(color);
  }, []);

  const handleWebsiteChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setWebsiteUrl(e.target.value);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!org) return;

    // Validate required business info fields
    const errors: string[] = [];
    if (!phone.trim()) errors.push("Phone number is required");
    if (!street.trim()) errors.push("Street address is required");
    if (!city.trim()) errors.push("City is required");
    if (!addrState) errors.push("State is required");
    if (!zip.trim()) errors.push("ZIP code is required");
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const result = await updateOrgBranding(org.slug, {
        accent_color: accentColor,
        website_url: websiteUrl || undefined,
        phone: phone.trim(),
        address: {
          street: street.trim(),
          city: city.trim(),
          state: addrState,
          zip: zip.trim(),
        },
        managing_broker: managingBroker.trim() || undefined,
      });
      setInitialAccent(result.accent_color || accentColor);
      setInitialWebsite(result.website_url || "");
      setInitialPhone(result.phone || "");
      setInitialStreet(result.address?.street || "");
      setInitialCity(result.address?.city || "");
      setInitialAddrState(result.address?.state || "");
      setInitialZip(result.address?.zip || "");
      setInitialManagingBroker(result.managing_broker || "");
      setDirty(false);
      setSaveSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save branding");
    } finally {
      setSaving(false);
    }
  }, [
    org,
    accentColor,
    websiteUrl,
    phone,
    street,
    city,
    addrState,
    zip,
    managingBroker,
  ]);

  const handleLogoUpload = useCallback(
    async (file: File) => {
      if (!org) return;
      setUploading(true);
      setError(null);
      try {
        const result = await uploadOrgLogo(org.slug, file);
        setLogoUrl(result.logo_url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload logo");
      } finally {
        setUploading(false);
      }
    },
    [org],
  );

  const handleLogoDelete = useCallback(async () => {
    if (!org) return;
    setError(null);
    try {
      await deleteOrgLogo(org.slug);
      setLogoUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove logo");
    }
  }, [org]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-semibold text-on-surface">Branding</h1>
        </div>
        <p className="text-sm text-on-surface-variant">
          Customize how your organization appears on reports and shared content
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/20 p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left panel — Form (60%) */}
        <div className="flex-[3] space-y-6">
          {/* Business Information — required fields first */}
          <BusinessInfoSection
            phone={phone}
            street={street}
            city={city}
            addrState={addrState}
            zip={zip}
            managingBroker={managingBroker}
            validationErrors={validationErrors}
            onPhoneChange={setPhone}
            onStreetChange={setStreet}
            onCityChange={setCity}
            onAddrStateChange={setAddrState}
            onZipChange={setZip}
            onManagingBrokerChange={setManagingBroker}
          />

          {/* Logo section */}
          <div className="bg-surface-container-low rounded-xl shadow-sm p-6">
            <LogoUploader
              currentLogoUrl={logoUrl}
              onUpload={handleLogoUpload}
              onDelete={handleLogoDelete}
              uploading={uploading}
            />
          </div>

          {/* Accent color section */}
          <div className="bg-surface-container-low rounded-xl shadow-sm p-6">
            <AccentColorPicker
              value={accentColor}
              onChange={handleAccentChange}
            />
          </div>

          {/* Website URL */}
          <div className="bg-surface-container-low rounded-xl shadow-sm p-6">
            <label className="text-sm font-medium text-on-surface tracking-wide">
              Website URL
            </label>
            <div className="flex items-center gap-2 mt-3">
              <Globe className="w-4 h-4 text-on-surface-variant shrink-0" />
              <input
                type="url"
                value={websiteUrl}
                onChange={handleWebsiteChange}
                placeholder="https://yourcompany.com"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <p className="text-xs text-on-surface-variant mt-2">
              Displayed on branded reports and shared content
            </p>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleSave()}
              disabled={saving || !dirty}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {saveSuccess && (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                Changes saved
              </span>
            )}
          </div>
        </div>

        {/* Right panel — Preview (40%) */}
        <div className="flex-[2] lg:sticky lg:top-6 lg:self-start">
          <BrandingPreview
            logoUrl={logoUrl}
            accentColor={accentColor}
            orgName={org?.name ?? "Your Organization"}
            websiteUrl={websiteUrl || null}
          />
        </div>
      </div>
    </div>
  );
}
