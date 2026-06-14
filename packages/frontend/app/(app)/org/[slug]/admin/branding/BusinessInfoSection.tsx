"use client";

import React from "react";
import { Phone, MapPin, UserCheck } from "lucide-react";
import { US_STATES } from "./us-states";

const INPUT_CLASS =
  "flex-1 px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

const SELECT_CLASS =
  "px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

interface BusinessInfoSectionProps {
  phone: string;
  street: string;
  city: string;
  addrState: string;
  zip: string;
  managingBroker: string;
  validationErrors: string[];
  onPhoneChange: (value: string) => void;
  onStreetChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onAddrStateChange: (value: string) => void;
  onZipChange: (value: string) => void;
  onManagingBrokerChange: (value: string) => void;
}

/**
 * Business Information form section for the branding page.
 * Contains phone, address (street/city/state/zip), and managing broker fields.
 */
export function BusinessInfoSection({
  phone,
  street,
  city,
  addrState,
  zip,
  managingBroker,
  validationErrors,
  onPhoneChange,
  onStreetChange,
  onCityChange,
  onAddrStateChange,
  onZipChange,
  onManagingBrokerChange,
}: BusinessInfoSectionProps) {
  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-6 space-y-5">
      <div>
        <h2 className="text-base font-medium text-on-surface tracking-wide">
          Business Information
        </h2>
        <p className="text-xs text-on-surface-variant mt-1">
          Required for branded reports and compliance disclosures
        </p>
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3 space-y-1">
          {validationErrors.map((msg) => (
            <p key={msg} className="text-xs text-red-700 dark:text-red-400">
              {msg}
            </p>
          ))}
        </div>
      )}

      {/* Phone number */}
      <div>
        <label className="text-sm font-medium text-on-surface tracking-wide">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2 mt-2">
          <Phone className="w-4 h-4 text-on-surface-variant shrink-0" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="(555) 123-4567"
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-on-surface tracking-wide">
          Business Address <span className="text-red-500">*</span>
        </label>

        {/* Street */}
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-on-surface-variant shrink-0" />
          <input
            type="text"
            value={street}
            onChange={(e) => onStreetChange(e.target.value)}
            placeholder="Street address"
            className={INPUT_CLASS}
          />
        </div>

        {/* City / State / ZIP row */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 pl-6">
          <input
            type="text"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder="City"
            className={INPUT_CLASS}
          />
          <select
            value={addrState}
            onChange={(e) => onAddrStateChange(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">State</option>
            {US_STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={zip}
            onChange={(e) => onZipChange(e.target.value)}
            placeholder="ZIP"
            className={`${INPUT_CLASS} w-24`}
          />
        </div>
      </div>

      {/* Managing Broker (optional) */}
      <div>
        <label className="text-sm font-medium text-on-surface tracking-wide">
          Managing Broker
        </label>
        <div className="flex items-center gap-2 mt-2">
          <UserCheck className="w-4 h-4 text-on-surface-variant shrink-0" />
          <input
            type="text"
            value={managingBroker}
            onChange={(e) => onManagingBrokerChange(e.target.value)}
            placeholder="Broker name (optional)"
            className={INPUT_CLASS}
          />
        </div>
        <p className="text-xs text-on-surface-variant mt-2">
          Required in some states for compliance disclosures
        </p>
      </div>
    </div>
  );
}
