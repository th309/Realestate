'use client';

import { PaywallOverlay } from '@/components/entitlements/PaywallOverlay';

export default function PaywallOverlayPreviewPage() {
  return (
    <main className="min-h-screen bg-surface p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">PaywallOverlay Preview</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Local preview for the entitlement overlay component.
          </p>
        </div>

        <PaywallOverlay
          type="metric"
          id="homeready_score"
          title="Unlock Predictive Scores"
          className="rounded-xl"
        >
          <div className="rounded-xl border border-outline-variant bg-surface-container p-6">
            <div className="mb-4">
              <div className="text-sm text-on-surface-variant">HomeReady Score</div>
              <div className="text-4xl font-semibold text-on-surface">81.2</div>
              <div className="text-xs text-on-surface-variant mt-1">
                Confidence: B • Updated monthly
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-surface p-4 border border-outline-variant/60">
                <div className="text-xs text-on-surface-variant">Rent Growth</div>
                <div className="text-lg font-medium text-on-surface">+5.4%</div>
              </div>
              <div className="rounded-lg bg-surface p-4 border border-outline-variant/60">
                <div className="text-xs text-on-surface-variant">Inventory Trend</div>
                <div className="text-lg font-medium text-on-surface">-8.1%</div>
              </div>
              <div className="rounded-lg bg-surface p-4 border border-outline-variant/60">
                <div className="text-xs text-on-surface-variant">Momentum</div>
                <div className="text-lg font-medium text-on-surface">Strong</div>
              </div>
            </div>
          </div>
        </PaywallOverlay>
      </div>
    </main>
  );
}
