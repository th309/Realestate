'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Save,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { fetchAPIRaw } from '@/lib/data';

interface TierPricing {
  slug: string;
  name: string;
  price_monthly: string | null;
  price_yearly: string | null;
  stripe_product_id: string | null;
  stripe_price_monthly_id: string | null;
  stripe_price_yearly_id: string | null;
}

export default function TierPricingEditor() {
  const [tiers, setTiers] = useState<TierPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<
    Record<string, { monthly: string; yearly: string }>
  >({});

  const fetchPricing = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchAPIRaw('/api/admin/tier-pricing');
      const result = await res.json();
      if (result.success) {
        setTiers(result.data);
        // Initialize edit state from fetched tier data
        const initial: Record<string, { monthly: string; yearly: string }> = {};
        for (const t of result.data) {
          initial[t.slug] = {
            monthly: t.price_monthly ?? '0',
            yearly: t.price_yearly ?? '0',
          };
        }
        setEdits(initial);
      }
    } catch {
      setError('Failed to load pricing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const handleSave = async (slug: string) => {
    const edit = edits[slug];
    if (!edit) return;

    setSaving(slug);
    setError(null);

    try {
      const res = await fetchAPIRaw(`/api/admin/tier-pricing/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_monthly: parseFloat(edit.monthly),
          price_yearly: parseFloat(edit.yearly),
        }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Save failed');

      // Refresh to get updated Stripe IDs
      await fetchPricing();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const hasChanges = (slug: string): boolean => {
    const tier = tiers.find((t) => t.slug === slug);
    const edit = edits[slug];
    if (!tier || !edit) return false;
    return (
      edit.monthly !== (tier.price_monthly ?? '0') ||
      edit.yearly !== (tier.price_yearly ?? '0')
    );
  };

  if (loading) {
    return (
      <div className="bg-surface-container rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-on-surface-variant" />
          <span className="text-sm text-on-surface-variant">
            Loading pricing...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-medium text-on-surface">Tier Pricing</h2>
        </div>
        <span className="text-xs text-on-surface-variant">
          Prices sync to Stripe and the /pricing page
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Pricing Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="text-left pb-3 font-medium text-on-surface-variant text-xs uppercase tracking-wider">
                Tier
              </th>
              <th className="text-center pb-3 font-medium text-on-surface-variant text-xs uppercase tracking-wider">
                Monthly
              </th>
              <th className="text-center pb-3 font-medium text-on-surface-variant text-xs uppercase tracking-wider">
                Yearly
              </th>
              <th className="text-center pb-3 font-medium text-on-surface-variant text-xs uppercase tracking-wider">
                Stripe Price IDs
              </th>
              <th className="text-right pb-3 font-medium text-on-surface-variant text-xs uppercase tracking-wider" />
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier) => {
              const isFree = tier.slug === 'free';
              const edit = edits[tier.slug];

              return (
                <tr
                  key={tier.slug}
                  className="border-b border-outline-variant/50 last:border-0"
                >
                  <td className="py-3">
                    <span className="font-medium text-on-surface">
                      {tier.name}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    {isFree ? (
                      <span className="text-on-surface-variant">$0</span>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <span className="text-on-surface-variant">$</span>
                        <input
                          type="number"
                          value={edit?.monthly ?? ''}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [tier.slug]: {
                                ...prev[tier.slug],
                                monthly: e.target.value,
                              },
                            }))
                          }
                          className="w-20 px-2 py-1 bg-surface border border-outline-variant rounded text-center text-sm"
                          min={0}
                          step={1}
                        />
                        <span className="text-xs text-on-surface-variant">
                          /mo
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 text-center">
                    {isFree ? (
                      <span className="text-on-surface-variant">$0</span>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <span className="text-on-surface-variant">$</span>
                        <input
                          type="number"
                          value={edit?.yearly ?? ''}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [tier.slug]: {
                                ...prev[tier.slug],
                                yearly: e.target.value,
                              },
                            }))
                          }
                          className="w-20 px-2 py-1 bg-surface border border-outline-variant rounded text-center text-sm"
                          min={0}
                          step={1}
                        />
                        <span className="text-xs text-on-surface-variant">
                          /yr
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 text-center">
                    {tier.stripe_price_monthly_id ? (
                      <div className="text-xs text-on-surface-variant space-y-0.5">
                        <div className="font-mono">
                          {tier.stripe_price_monthly_id.slice(0, 20)}...
                        </div>
                        <div className="font-mono">
                          {tier.stripe_price_yearly_id?.slice(0, 20)}...
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-on-surface-variant/50 italic">
                        {isFree ? '\u2014' : 'Not configured'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    {!isFree && hasChanges(tier.slug) && (
                      <button
                        onClick={() => handleSave(tier.slug)}
                        disabled={saving === tier.slug}
                        className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
                      >
                        {saving === tier.slug ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                        Save
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stripe Dashboard Link */}
      <div className="mt-4 pt-3 border-t border-outline-variant/30 flex items-center gap-2">
        <a
          href="https://dashboard.stripe.com/test/products"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" />
          View in Stripe Dashboard
        </a>
        <span className="text-xs text-on-surface-variant/50">(test mode)</span>
      </div>
    </div>
  );
}
