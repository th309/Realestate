"use client";

import { useState, useCallback, useEffect } from "react";
import { fetchOrgBranding, updateOrgBranding } from "@/lib/data";
import { useLogoHandlers } from "./useLogoHandlers";

/**
 * All form field values managed by the branding page.
 * Each field has a current value and an initial (server) value for dirty tracking.
 */
interface BrandingFields {
  accentColor: string;
  websiteUrl: string;
  phone: string;
  street: string;
  city: string;
  addrState: string;
  zip: string;
  managingBroker: string;
  // White-label fields
  reportHeaderText: string;
  reportFooterText: string;
  reportDisclaimer: string;
  poweredByVisible: boolean;
  displayName: string;
  supportEmail: string;
  tabTitleFormat: string;
  emailFromName: string;
  emailReplyTo: string;
  primaryFont: string;
  secondaryFont: string;
  welcomeMessage: string;
  customTosUrl: string;
  customPrivacyUrl: string;
  customSubdomain: string;
}

const DEFAULT_FIELDS: BrandingFields = {
  accentColor: "#2563eb",
  websiteUrl: "",
  phone: "",
  street: "",
  city: "",
  addrState: "",
  zip: "",
  managingBroker: "",
  reportHeaderText: "",
  reportFooterText: "",
  reportDisclaimer: "",
  poweredByVisible: true,
  displayName: "",
  supportEmail: "",
  tabTitleFormat: "",
  emailFromName: "",
  emailReplyTo: "",
  primaryFont: "",
  secondaryFont: "",
  welcomeMessage: "",
  customTosUrl: "",
  customPrivacyUrl: "",
  customSubdomain: "",
};

/**
 * Custom hook encapsulating all branding form state, loading, saving,
 * dirty tracking, and logo upload/delete logic.
 */
export function useBrandingForm(orgSlug: string | undefined) {
  const [fields, setFields] = useState<BrandingFields>(DEFAULT_FIELDS);
  const [initial, setInitial] = useState<BrandingFields>(DEFAULT_FIELDS);
  const logo = useLogoHandlers(orgSlug);
  const [customDomainStatus, setCustomDomainStatus] = useState<string | null>(
    null,
  );
  const [customDomainVerifiedAt, setCustomDomainVerifiedAt] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const dirty =
    fields.accentColor !== initial.accentColor ||
    fields.websiteUrl !== initial.websiteUrl ||
    fields.phone !== initial.phone ||
    fields.street !== initial.street ||
    fields.city !== initial.city ||
    fields.addrState !== initial.addrState ||
    fields.zip !== initial.zip ||
    fields.managingBroker !== initial.managingBroker ||
    fields.reportHeaderText !== initial.reportHeaderText ||
    fields.reportFooterText !== initial.reportFooterText ||
    fields.reportDisclaimer !== initial.reportDisclaimer ||
    fields.poweredByVisible !== initial.poweredByVisible ||
    fields.displayName !== initial.displayName ||
    fields.supportEmail !== initial.supportEmail ||
    fields.tabTitleFormat !== initial.tabTitleFormat ||
    fields.emailFromName !== initial.emailFromName ||
    fields.emailReplyTo !== initial.emailReplyTo ||
    fields.primaryFont !== initial.primaryFont ||
    fields.secondaryFont !== initial.secondaryFont ||
    fields.welcomeMessage !== initial.welcomeMessage ||
    fields.customTosUrl !== initial.customTosUrl ||
    fields.customPrivacyUrl !== initial.customPrivacyUrl;

  // Reset save success when fields change
  useEffect(() => {
    setSaveSuccess(false);
  }, [fields]);

  const setField = useCallback(
    <K extends keyof BrandingFields>(key: K, value: BrandingFields[K]) => {
      setFields((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const loadBranding = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrgBranding(orgSlug);
      const loaded: BrandingFields = {
        accentColor: data.accent_color || "#2563eb",
        websiteUrl: data.website_url || "",
        phone: data.phone || "",
        street: data.address?.street || "",
        city: data.address?.city || "",
        addrState: data.address?.state || "",
        zip: data.address?.zip || "",
        managingBroker: data.managing_broker || "",
        reportHeaderText: data.report_header_text || "",
        reportFooterText: data.report_footer_text || "",
        reportDisclaimer: data.report_disclaimer || "",
        poweredByVisible: data.powered_by_visible ?? true,
        displayName: data.display_name || "",
        supportEmail: data.support_email || "",
        tabTitleFormat: data.tab_title_format || "",
        emailFromName: data.email_from_name || "",
        emailReplyTo: data.email_reply_to || "",
        primaryFont: data.primary_font || "",
        secondaryFont: data.secondary_font || "",
        welcomeMessage: data.welcome_message || "",
        customTosUrl: data.custom_tos_url || "",
        customPrivacyUrl: data.custom_privacy_url || "",
        customSubdomain: data.custom_subdomain || "",
      };
      setFields(loaded);
      setInitial(loaded);
      logo.setLogoUrl(data.logo_url);
      setCustomDomainStatus(data.custom_domain_status ?? null);
      setCustomDomainVerifiedAt(data.custom_domain_verified_at ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load branding");
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    void loadBranding();
  }, [loadBranding]);

  const handleSave = useCallback(async () => {
    if (!orgSlug) return;

    const errors: string[] = [];
    if (!fields.phone.trim()) errors.push("Phone number is required");
    if (!fields.street.trim()) errors.push("Street address is required");
    if (!fields.city.trim()) errors.push("City is required");
    if (!fields.addrState) errors.push("State is required");
    if (!fields.zip.trim()) errors.push("ZIP code is required");
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const result = await updateOrgBranding(orgSlug, {
        accent_color: fields.accentColor,
        website_url: fields.websiteUrl || undefined,
        phone: fields.phone.trim(),
        address: {
          street: fields.street.trim(),
          city: fields.city.trim(),
          state: fields.addrState,
          zip: fields.zip.trim(),
        },
        managing_broker: fields.managingBroker.trim() || undefined,
        report_header_text: fields.reportHeaderText.trim() || undefined,
        report_footer_text: fields.reportFooterText.trim() || undefined,
        report_disclaimer: fields.reportDisclaimer.trim() || undefined,
        powered_by_visible: fields.poweredByVisible,
        display_name: fields.displayName.trim() || undefined,
        support_email: fields.supportEmail.trim() || undefined,
        tab_title_format: fields.tabTitleFormat.trim() || undefined,
        email_from_name: fields.emailFromName.trim() || undefined,
        email_reply_to: fields.emailReplyTo.trim() || undefined,
        primary_font: fields.primaryFont || undefined,
        secondary_font: fields.secondaryFont || undefined,
        welcome_message: fields.welcomeMessage.trim() || undefined,
        custom_tos_url: fields.customTosUrl.trim() || undefined,
        custom_privacy_url: fields.customPrivacyUrl.trim() || undefined,
      });
      const saved: BrandingFields = {
        accentColor: result.accent_color || fields.accentColor,
        websiteUrl: result.website_url || "",
        phone: result.phone || "",
        street: result.address?.street || "",
        city: result.address?.city || "",
        addrState: result.address?.state || "",
        zip: result.address?.zip || "",
        managingBroker: result.managing_broker || "",
        reportHeaderText: result.report_header_text || "",
        reportFooterText: result.report_footer_text || "",
        reportDisclaimer: result.report_disclaimer || "",
        poweredByVisible: result.powered_by_visible ?? true,
        displayName: result.display_name || "",
        supportEmail: result.support_email || "",
        tabTitleFormat: result.tab_title_format || "",
        emailFromName: result.email_from_name || "",
        emailReplyTo: result.email_reply_to || "",
        primaryFont: result.primary_font || "",
        secondaryFont: result.secondary_font || "",
        welcomeMessage: result.welcome_message || "",
        customTosUrl: result.custom_tos_url || "",
        customPrivacyUrl: result.custom_privacy_url || "",
        customSubdomain: result.custom_subdomain || "",
      };
      setFields(saved);
      setInitial(saved);
      setSaveSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save branding");
    } finally {
      setSaving(false);
    }
  }, [orgSlug, fields]);

  return {
    fields,
    setField,
    logoUrl: logo.logoUrl,
    customDomainStatus,
    customDomainVerifiedAt,
    loading,
    saving,
    uploading: logo.uploading,
    error: error || logo.logoError,
    validationErrors,
    saveSuccess,
    dirty,
    handleSave,
    handleLogoUpload: logo.handleLogoUpload,
    handleLogoDelete: logo.handleLogoDelete,
    reloadBranding: loadBranding,
  };
}
