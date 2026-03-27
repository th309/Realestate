"use client";

import React, { useState, useEffect, useCallback } from "react";
import { BellRing, Mail, TrendingUp, Megaphone, Loader2 } from "lucide-react";
import { fetchEmailPreferences, updateEmailPreferences } from "@/lib/data";
import type { EmailPreferences } from "@/lib/data";

const PREF_TOGGLES: {
  key: keyof EmailPreferences;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "weekly_digest",
    label: "Weekly Digest",
    description: "Summary of your saved markets every Monday",
    icon: <Mail className="w-4 h-4" />,
  },
  {
    key: "alert_emails",
    label: "Alert Notifications",
    description: "Get notified when alerts trigger",
    icon: <TrendingUp className="w-4 h-4" />,
  },
  {
    key: "marketing",
    label: "Product Updates",
    description: "Occasional updates about new features",
    icon: <Megaphone className="w-4 h-4" />,
  },
];

export function NotificationsSection() {
  const [prefs, setPrefs] = useState<EmailPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEmailPreferences()
      .then((data) => {
        if (!cancelled) {
          setPrefs(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrefs({
            weekly_digest: false,
            alert_emails: false,
            marketing: false,
          });
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = useCallback(
    async (key: keyof EmailPreferences) => {
      if (!prefs) return;
      const newValue = !prefs[key];
      setSavingKey(key);
      setPrefs((prev) => (prev ? { ...prev, [key]: newValue } : prev));

      try {
        await updateEmailPreferences({ [key]: newValue });
      } catch {
        setPrefs((prev) => (prev ? { ...prev, [key]: !newValue } : prev));
      } finally {
        setSavingKey(null);
      }
    },
    [prefs],
  );

  return (
    <section className="bg-white rounded-xl border border-purple-200/50 p-6">
      <div className="flex items-center gap-2 mb-4">
        <BellRing className="w-5 h-5 text-[#7C3AED]" />
        <h2 className="text-lg font-semibold text-on-surface">Notifications</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" />
        </div>
      ) : (
        <div className="space-y-3">
          {PREF_TOGGLES.map((toggle) => {
            const checked = prefs?.[toggle.key] ?? false;
            const isSaving = savingKey === toggle.key;

            return (
              <div
                key={toggle.key}
                className="flex items-center justify-between p-4 rounded-xl bg-surface-container-low border border-outline-variant"
              >
                <div className="flex items-center gap-3">
                  <div className="text-on-surface-variant">{toggle.icon}</div>
                  <div>
                    <p className="text-sm font-medium text-on-surface">
                      {toggle.label}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {toggle.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isSaving && (
                    <span className="text-xs text-on-surface-variant">
                      Saving...
                    </span>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    disabled={!!savingKey}
                    onClick={() => handleToggle(toggle.key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 disabled:opacity-50 disabled:cursor-not-allowed ${
                      checked ? "bg-[#7C3AED]" : "bg-on-surface/20"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        checked ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
