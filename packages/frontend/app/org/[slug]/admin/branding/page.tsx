"use client";

import React from "react";
import { Palette, Loader2, AlertCircle, Globe } from "lucide-react";
import { useOrg } from "../../../hooks/useOrg";
import { LogoUploader } from "../../../components/LogoUploader";
import { AccentColorPicker } from "../../../components/AccentColorPicker";
import { BrandingPreview } from "../../../components/BrandingPreview";
import { BusinessInfoSection } from "./BusinessInfoSection";
import { ReportBrandingSection } from "./ReportBrandingSection";
import { WhiteLabelSection } from "./WhiteLabelSection";
import { EmailBrandingSection } from "./EmailBrandingSection";
import { TypographySection } from "./TypographySection";
import { ClientExperienceSection } from "./ClientExperienceSection";
import { CustomDomainSection } from "./CustomDomainSection";
import { useBrandingForm } from "./useBrandingForm";

/**
 * Branding admin page — logo upload, accent color, website URL,
 * white-label settings, and a live preview panel on the right.
 */
export default function OrgAdminBranding() {
  const { org } = useOrg();
  const form = useBrandingForm(org?.slug);

  if (form.loading) {
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
      {form.error && (
        <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/20 p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{form.error}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left panel — Form (60%) */}
        <div className="flex-[3] space-y-6">
          {/* Business Information — required fields first */}
          <BusinessInfoSection
            phone={form.fields.phone}
            street={form.fields.street}
            city={form.fields.city}
            addrState={form.fields.addrState}
            zip={form.fields.zip}
            managingBroker={form.fields.managingBroker}
            validationErrors={form.validationErrors}
            onPhoneChange={(v) => form.setField("phone", v)}
            onStreetChange={(v) => form.setField("street", v)}
            onCityChange={(v) => form.setField("city", v)}
            onAddrStateChange={(v) => form.setField("addrState", v)}
            onZipChange={(v) => form.setField("zip", v)}
            onManagingBrokerChange={(v) => form.setField("managingBroker", v)}
          />

          {/* Logo section */}
          <div className="bg-surface-container-low rounded-xl shadow-sm p-6">
            <LogoUploader
              currentLogoUrl={form.logoUrl}
              onUpload={form.handleLogoUpload}
              onDelete={form.handleLogoDelete}
              uploading={form.uploading}
            />
          </div>

          {/* Accent color section */}
          <div className="bg-surface-container-low rounded-xl shadow-sm p-6">
            <AccentColorPicker
              value={form.fields.accentColor}
              onChange={(c) => form.setField("accentColor", c)}
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
                value={form.fields.websiteUrl}
                onChange={(e) => form.setField("websiteUrl", e.target.value)}
                placeholder="https://yourcompany.com"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <p className="text-xs text-on-surface-variant mt-2">
              Displayed on branded reports and shared content
            </p>
          </div>

          {/* --- White-label sections --- */}
          <ReportBrandingSection
            reportHeaderText={form.fields.reportHeaderText}
            reportFooterText={form.fields.reportFooterText}
            reportDisclaimer={form.fields.reportDisclaimer}
            onReportHeaderTextChange={(v) =>
              form.setField("reportHeaderText", v)
            }
            onReportFooterTextChange={(v) =>
              form.setField("reportFooterText", v)
            }
            onReportDisclaimerChange={(v) =>
              form.setField("reportDisclaimer", v)
            }
          />

          <WhiteLabelSection
            poweredByVisible={form.fields.poweredByVisible}
            displayName={form.fields.displayName}
            supportEmail={form.fields.supportEmail}
            tabTitleFormat={form.fields.tabTitleFormat}
            onPoweredByVisibleChange={(v) =>
              form.setField("poweredByVisible", v)
            }
            onDisplayNameChange={(v) => form.setField("displayName", v)}
            onSupportEmailChange={(v) => form.setField("supportEmail", v)}
            onTabTitleFormatChange={(v) => form.setField("tabTitleFormat", v)}
          />

          <EmailBrandingSection
            emailFromName={form.fields.emailFromName}
            emailReplyTo={form.fields.emailReplyTo}
            onEmailFromNameChange={(v) => form.setField("emailFromName", v)}
            onEmailReplyToChange={(v) => form.setField("emailReplyTo", v)}
          />

          <TypographySection
            primaryFont={form.fields.primaryFont}
            secondaryFont={form.fields.secondaryFont}
            onPrimaryFontChange={(v) => form.setField("primaryFont", v)}
            onSecondaryFontChange={(v) => form.setField("secondaryFont", v)}
          />

          <ClientExperienceSection
            welcomeMessage={form.fields.welcomeMessage}
            customTosUrl={form.fields.customTosUrl}
            customPrivacyUrl={form.fields.customPrivacyUrl}
            onWelcomeMessageChange={(v) => form.setField("welcomeMessage", v)}
            onCustomTosUrlChange={(v) => form.setField("customTosUrl", v)}
            onCustomPrivacyUrlChange={(v) =>
              form.setField("customPrivacyUrl", v)
            }
          />

          <CustomDomainSection customSubdomain={form.fields.customSubdomain} />

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => void form.handleSave()}
              disabled={form.saving || !form.dirty}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {form.saving ? "Saving..." : "Save Changes"}
            </button>
            {form.saveSuccess && (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                Changes saved
              </span>
            )}
          </div>
        </div>

        {/* Right panel — Preview (40%) */}
        <div className="flex-[2] lg:sticky lg:top-6 lg:self-start">
          <BrandingPreview
            logoUrl={form.logoUrl}
            accentColor={form.fields.accentColor}
            orgName={org?.name ?? "Your Organization"}
            websiteUrl={form.fields.websiteUrl || null}
          />
        </div>
      </div>
    </div>
  );
}
