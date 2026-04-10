"use client";

import React, { useState, useEffect } from "react";
import { Copy, Check, Users, Gift } from "lucide-react";
import { API_URL } from "@/lib/data/fetchers/base";
import { getAuthHeaders } from "@/lib/data/fetchers/auth-headers";

interface ReferralStats {
  signedUp: number;
  converted: number;
  creditsEarned: number;
}

interface ReferralCode {
  code: string;
  url: string;
}

export function ReferralSection() {
  const [referralData, setReferralData] = useState<ReferralCode | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const headers = await getAuthHeaders();
        const [codeRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/api/referrals/my-code`, { headers }),
          fetch(`${API_URL}/api/referrals/stats`, { headers }),
        ]);
        if (codeRes.ok) setReferralData(await codeRes.json());
        if (statsRes.ok) setStats(await statsRes.json());
      } catch {
        // Non-fatal
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function copyLink() {
    if (!referralData?.url) return;
    await navigator.clipboard.writeText(referralData.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-gray-900">
            Share PropertyIQ. Get Pro Free.
          </h2>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Every investor you send our way who signs up gives you one free month
          of Pro. No limit on referrals. No expiration.
        </p>
      </div>

      {/* Referral link */}
      <div className="px-6 py-5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Your referral link
        </p>
        {loading ? (
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        ) : referralData ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 font-mono truncate">
              {referralData.url}
            </div>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Link
                </>
              )}
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Unable to load referral link.</p>
        )}

        {/* Stats */}
        {stats && (
          <div className="mt-5 grid grid-cols-3 gap-3">
            <StatCard
              label="Signed up"
              value={stats.signedUp}
              icon={<Users className="h-4 w-4 text-indigo-400" />}
            />
            <StatCard
              label="Converted to Pro"
              value={stats.converted}
              icon={<Check className="h-4 w-4 text-green-400" />}
            />
            <StatCard
              label="Free months earned"
              value={stats.creditsEarned}
              icon={<Gift className="h-4 w-4 text-amber-400" />}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center bg-gray-50 rounded-lg p-3 text-center">
      <div className="mb-1">{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
