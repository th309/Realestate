"use client";

import { useOrg } from "../../hooks/useOrg";
import { OrgDashboardCards } from "../../components/OrgDashboardCards";
import { OrgSettingsSection } from "./components/OrgSettingsSection";

/**
 * Enterprise admin dashboard — overview of org health.
 * Uses useOrg() context (set by layout) to get the org slug & data.
 */
export default function OrgAdminDashboard() {
  const { org } = useOrg();

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-on-surface">
          {org?.name ?? "Organization"} Admin
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Overview of your organization
        </p>
      </div>

      <OrgDashboardCards />
      <OrgSettingsSection />
    </div>
  );
}
