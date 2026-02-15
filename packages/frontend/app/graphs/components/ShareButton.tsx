'use client';

import React, { useState, useCallback } from 'react';
import { Share2, Check } from 'lucide-react';
import { useEntitlements } from '@/lib/entitlements';
import type { GraphsState } from '../hooks/useGraphsState';

interface ShareButtonProps {
  graphState: GraphsState;
}

export function ShareButton({ graphState }: ShareButtonProps) {
  const { canAccess } = useEntitlements();
  const canShare = canAccess('feature', 'graph_share');
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    if (!canShare) {
      // Could open upgrade modal, for now just return
      return;
    }

    const params = new URLSearchParams();
    // Encode state — only set params that differ from defaults
    if (graphState.chartType) params.set('chart', graphState.chartType);
    if (graphState.activeMetric !== 'home_value') params.set('metric', graphState.activeMetric);
    if (graphState.timeFrame !== '5Y') params.set('tf', graphState.timeFrame);
    if (graphState.scope !== 'state') params.set('scope', graphState.scope);
    if (graphState.scatterXMetric !== 'cap_rate') params.set('xm', graphState.scatterXMetric);
    if (graphState.scatterYMetric !== 'days_on_market') params.set('ymetric', graphState.scatterYMetric);
    if (!graphState.showRegression) params.set('reg', '0');
    if (!graphState.showQuadrants) params.set('quad', '0');
    if (graphState.waterfallPreset !== 'investment') params.set('wf', graphState.waterfallPreset);
    if (graphState.scoreType !== 'homeready') params.set('st', graphState.scoreType);
    if (graphState.radarPreset !== 'homebuyer') params.set('rp', graphState.radarPreset);
    if (graphState.barMetric !== 'home_value') params.set('bm', graphState.barMetric);
    if (graphState.barSort !== 'desc') params.set('bs', graphState.barSort);
    if (graphState.barCount !== 10) params.set('bc', String(graphState.barCount));
    if (graphState.scatterXScaleType !== 'auto') params.set('xst', graphState.scatterXScaleType);
    if (graphState.scatterYScaleType !== 'auto') params.set('yst', graphState.scatterYScaleType);

    const url = `${window.location.origin}/graphs?${params.toString()}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [canShare, graphState]);

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
        transition-all duration-150
        ${canShare
          ? 'text-on-surface-variant hover:bg-surface-container-high'
          : 'text-on-surface-variant/50 cursor-not-allowed'
        }
      `}
      title={canShare ? 'Copy shareable link' : 'Upgrade to share graphs'}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Share2 className="w-3.5 h-3.5" />}
      <span>{copied ? 'Copied!' : 'Share'}</span>
    </button>
  );
}

export default ShareButton;
