"use client";

import React from "react";
import { Shield, Mail, Tag, Layout } from "lucide-react";

const INPUT_CLASS =
  "flex-1 px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

interface WhiteLabelSectionProps {
  poweredByVisible: boolean;
  displayName: string;
  supportEmail: string;
  tabTitleFormat: string;
  onPoweredByVisibleChange: (value: boolean) => void;
  onDisplayNameChange: (value: string) => void;
  onSupportEmailChange: (value: string) => void;
  onTabTitleFormatChange: (value: string) => void;
}

/**
 * White Label Settings section — powered-by toggle, display name,
 * support email, and browser tab title format.
 */
export function WhiteLabelSection({
  poweredByVisible,
  displayName,
  supportEmail,
  tabTitleFormat,
  onPoweredByVisibleChange,
  onDisplayNameChange,
  onSupportEmailChange,
  onTabTitleFormatChange,
}: WhiteLabelSectionProps) {
  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        <div>
          <h2 className="text-base font-medium text-on-surface tracking-wide">
            White Label Settings
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Control PropertyIQ branding visibility for your clients
          </p>
        </div>
      </div>

      {/* Powered By toggle */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-on-surface tracking-wide">
            &quot;Powered by PropertyIQ&quot;
          </label>
          <p className="text-xs text-on-surface-variant mt-1">
            Show PropertyIQ attribution on reports and shared pages
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={poweredByVisible}
          onClick={() => onPoweredByVisibleChange(!poweredByVisible)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
            poweredByVisible ? "bg-primary" : "bg-outline-variant"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              poweredByVisible ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Display Name */}
      <div>
        <label className="text-sm font-medium text-on-surface tracking-wide">
          Display Name
        </label>
        <div className="flex items-center gap-2 mt-2">
          <Tag className="w-4 h-4 text-on-surface-variant shrink-0" />
          <input
            type="text"
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            placeholder="Your Brokerage Name"
            className={INPUT_CLASS}
          />
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          Shown to clients instead of your legal business name
        </p>
      </div>

      {/* Support Email */}
      <div>
        <label className="text-sm font-medium text-on-surface tracking-wide">
          Support Email
        </label>
        <div className="flex items-center gap-2 mt-2">
          <Mail className="w-4 h-4 text-on-surface-variant shrink-0" />
          <input
            type="email"
            value={supportEmail}
            onChange={(e) => onSupportEmailChange(e.target.value)}
            placeholder="support@yourbrokerage.com"
            className={INPUT_CLASS}
          />
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          Shown in error states and report footers
        </p>
      </div>

      {/* Tab Title Format */}
      <div>
        <label className="text-sm font-medium text-on-surface tracking-wide">
          Tab Title Format
        </label>
        <div className="flex items-center gap-2 mt-2">
          <Layout className="w-4 h-4 text-on-surface-variant shrink-0" />
          <input
            type="text"
            value={tabTitleFormat}
            onChange={(e) => onTabTitleFormatChange(e.target.value)}
            placeholder="{title} | {org_name}"
            className={INPUT_CLASS}
          />
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          e.g. &quot;Market Report | Your Brokerage&quot;
        </p>
      </div>
    </div>
  );
}
