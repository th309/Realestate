"use client";

import React from "react";
import { Mail, Reply } from "lucide-react";

const INPUT_CLASS =
  "flex-1 px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

interface EmailBrandingSectionProps {
  emailFromName: string;
  emailReplyTo: string;
  onEmailFromNameChange: (value: string) => void;
  onEmailReplyToChange: (value: string) => void;
}

/**
 * Email Branding section — from name and reply-to address for outbound emails.
 */
export function EmailBrandingSection({
  emailFromName,
  emailReplyTo,
  onEmailFromNameChange,
  onEmailReplyToChange,
}: EmailBrandingSectionProps) {
  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-primary" />
        <div>
          <h2 className="text-base font-medium text-on-surface tracking-wide">
            Email Branding
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Customize how outbound emails appear to recipients
          </p>
        </div>
      </div>

      {/* From Name */}
      <div>
        <label className="text-sm font-medium text-on-surface tracking-wide">
          From Name
        </label>
        <div className="flex items-center gap-2 mt-2">
          <Mail className="w-4 h-4 text-on-surface-variant shrink-0" />
          <input
            type="text"
            value={emailFromName}
            onChange={(e) => onEmailFromNameChange(e.target.value)}
            placeholder="Acme Realty Analytics"
            className={INPUT_CLASS}
          />
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          Name shown in the email &quot;From&quot; field
        </p>
      </div>

      {/* Reply-To Email */}
      <div>
        <label className="text-sm font-medium text-on-surface tracking-wide">
          Reply-To Email
        </label>
        <div className="flex items-center gap-2 mt-2">
          <Reply className="w-4 h-4 text-on-surface-variant shrink-0" />
          <input
            type="email"
            value={emailReplyTo}
            onChange={(e) => onEmailReplyToChange(e.target.value)}
            placeholder="replies@yourbrokerage.com"
            className={INPUT_CLASS}
          />
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          Where replies to automated emails will be sent
        </p>
      </div>
    </div>
  );
}
