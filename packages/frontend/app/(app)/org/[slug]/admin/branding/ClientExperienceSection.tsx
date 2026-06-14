"use client";

import React from "react";
import { Users, Link, FileText } from "lucide-react";

const INPUT_CLASS =
  "flex-1 px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

const TEXTAREA_CLASS =
  "w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y min-h-[72px]";

interface ClientExperienceSectionProps {
  welcomeMessage: string;
  customTosUrl: string;
  customPrivacyUrl: string;
  onWelcomeMessageChange: (value: string) => void;
  onCustomTosUrlChange: (value: string) => void;
  onCustomPrivacyUrlChange: (value: string) => void;
}

/**
 * Client Experience section — welcome message and custom legal links
 * for invited client users.
 */
export function ClientExperienceSection({
  welcomeMessage,
  customTosUrl,
  customPrivacyUrl,
  onWelcomeMessageChange,
  onCustomTosUrlChange,
  onCustomPrivacyUrlChange,
}: ClientExperienceSectionProps) {
  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <div>
          <h2 className="text-base font-medium text-on-surface tracking-wide">
            Client Experience
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Customize what invited clients see when they join your organization
          </p>
        </div>
      </div>

      {/* Welcome Message */}
      <div>
        <label className="text-sm font-medium text-on-surface tracking-wide">
          Welcome Message
        </label>
        <textarea
          value={welcomeMessage}
          onChange={(e) => onWelcomeMessageChange(e.target.value)}
          placeholder="Welcome to our analytics platform! We're glad to have you."
          className={TEXTAREA_CLASS}
          rows={3}
        />
        <p className="text-xs text-on-surface-variant mt-1">
          Shown to invited clients on first login
        </p>
      </div>

      {/* Custom Terms of Service URL */}
      <div>
        <label className="text-sm font-medium text-on-surface tracking-wide">
          Custom Terms of Service URL
        </label>
        <div className="flex items-center gap-2 mt-2">
          <FileText className="w-4 h-4 text-on-surface-variant shrink-0" />
          <input
            type="url"
            value={customTosUrl}
            onChange={(e) => onCustomTosUrlChange(e.target.value)}
            placeholder="https://yourbrokerage.com/terms"
            className={INPUT_CLASS}
          />
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          Overrides the default PropertyIQ terms for your clients
        </p>
      </div>

      {/* Custom Privacy Policy URL */}
      <div>
        <label className="text-sm font-medium text-on-surface tracking-wide">
          Custom Privacy Policy URL
        </label>
        <div className="flex items-center gap-2 mt-2">
          <Link className="w-4 h-4 text-on-surface-variant shrink-0" />
          <input
            type="url"
            value={customPrivacyUrl}
            onChange={(e) => onCustomPrivacyUrlChange(e.target.value)}
            placeholder="https://yourbrokerage.com/privacy"
            className={INPUT_CLASS}
          />
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          Overrides the default PropertyIQ privacy policy for your clients
        </p>
      </div>
    </div>
  );
}
