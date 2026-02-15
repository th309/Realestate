'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { MyMarket } from './useMyMarkets';

export type ChartType = 'timeseries' | 'scatter' | 'waterfall' | 'radar' | 'bar';
export type TimeFrame = '1Y' | '3Y' | '5Y' | '10Y' | 'Max';
export type UserType = 'homebuyer' | 'investor';
export type BaselineType = 'none' | 'state' | 'region' | 'national';
export type ScatterScope = 'state' | 'region' | 'national';
export type WaterfallPreset = 'investment' | 'affordability' | 'momentum' | 'benchmark' | 'score';
export type RadarPreset = 'homebuyer' | 'investor' | 'market_health' | 'custom';
export type BarSort = 'asc' | 'desc';
export type BarCount = 10 | 25;
export type ScoreTypeOption = 'homeready' | 'investoredge' | 'markethealth';
export type ScaleType = 'linear' | 'log';

// Backward-compat aliases (old components still reference these)
export type TemplateType = 'affordability' | 'investment' | 'momentum' | 'cashflow' | 'custom';
export type VizType = ChartType;

/** Maximum number of markets that can be selected simultaneously */
const MAX_MARKETS = 3;

/**
 * Normalize a market's state field by parsing it from the name.
 * Geography names always contain the correct state abbreviation
 * (e.g. "Chicago-Naperville-Elgin, IL-IN" → "IL"), which is more
 * reliable than the database state_code for multi-state metros.
 */
function normalizeMarket(market: MyMarket): MyMarket {
  const match = market.name.match(/,\s*([A-Z]{2})(?:-[A-Z]{2})*\s*$/);
  if (match && match[1] !== market.state) {
    return { ...market, state: match[1] };
  }
  return market;
}

export interface GraphsState {
  // Market selection — legacy pair + new multi-market array
  primaryMarket: MyMarket | null;
  comparisonMarket: MyMarket | null;
  markets: MyMarket[];

  // Shared across chart types
  chartType: ChartType;
  timeFrame: TimeFrame;
  activeMetric: string;
  userType: UserType;
  baselineType: BaselineType;
  scope: ScatterScope;

  // Scatter-specific
  scatterXMetric: string;
  scatterYMetric: string;
  scatterXScaleType: ScaleType;
  scatterYScaleType: ScaleType;
  showRegression: boolean;
  showQuadrants: boolean;

  // Waterfall-specific
  waterfallPreset: WaterfallPreset;
  scoreType: ScoreTypeOption;

  // Radar-specific
  radarPreset: RadarPreset;
  radarMetrics: string[];

  // Bar-specific
  barMetric: string;
  barSort: BarSort;
  barCount: BarCount;
  raceMode: boolean;
}

export interface UseGraphsStateReturn extends GraphsState {
  // Backward-compat: scatterScope reads from scope
  scatterScope: ScatterScope;

  // Market setters (legacy)
  setPrimaryMarket: (market: MyMarket | null) => void;
  setComparisonMarket: (market: MyMarket | null) => void;
  selectMarket: (market: MyMarket) => void;
  clearComparison: () => void;
  swapMarkets: () => void;

  // Multi-market setters
  setMarkets: (markets: MyMarket[]) => void;
  addMarket: (market: MyMarket) => void;
  removeMarket: (index: number) => void;

  // Shared setters
  setChartType: (type: ChartType) => void;
  setTimeFrame: (tf: TimeFrame) => void;
  setActiveMetric: (metric: string) => void;
  setUserType: (type: UserType) => void;
  setBaselineType: (type: BaselineType) => void;
  setScope: (scope: ScatterScope) => void;
  setScatterScope: (scope: ScatterScope) => void; // alias for setScope

  // Scatter setters
  setScatterXMetric: (metric: string) => void;
  setScatterYMetric: (metric: string) => void;
  setScatterXScaleType: (type: ScaleType) => void;
  setScatterYScaleType: (type: ScaleType) => void;
  setShowRegression: (show: boolean) => void;
  setShowQuadrants: (show: boolean) => void;

  // Waterfall setters
  setWaterfallPreset: (preset: WaterfallPreset) => void;
  setScoreType: (scoreType: ScoreTypeOption) => void;

  // Radar setters
  setRadarPreset: (preset: RadarPreset) => void;
  setRadarMetrics: (metrics: string[]) => void;

  // Bar setters
  setBarMetric: (metric: string) => void;
  setBarSort: (sort: BarSort) => void;
  setBarCount: (count: BarCount) => void;
  setRaceMode: (race: boolean) => void;

  // Bulk update
  applyTemplate: (config: Partial<GraphsState>) => void;
}

const DEFAULT_STATE: GraphsState = {
  primaryMarket: null,
  comparisonMarket: null,
  markets: [],
  chartType: 'timeseries',
  timeFrame: '5Y',
  activeMetric: 'home_value',
  scatterXMetric: 'cap_rate',
  scatterYMetric: 'days_on_market',
  scatterXScaleType: 'linear',
  scatterYScaleType: 'linear',
  showRegression: true,
  showQuadrants: true,
  waterfallPreset: 'investment',
  scoreType: 'homeready',
  radarPreset: 'homebuyer',
  radarMetrics: [],
  barMetric: 'home_value',
  barSort: 'desc',
  barCount: 10,
  raceMode: false,
  scope: 'state',
  baselineType: 'none',
  userType: 'homebuyer',
};

/**
 * Central state management for graphs page V2 with URL sync.
 * Supports 5 chart types: timeseries, scatter, waterfall, radar, bar.
 */
export function useGraphsState(): UseGraphsStateReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isInitialRender = useRef(true);

  const [state, setState] = useState<GraphsState>(() => {
    const chart = searchParams.get('chart') as ChartType | null;
    const tf = searchParams.get('tf') as TimeFrame | null;
    const metric = searchParams.get('metric');
    const userType = searchParams.get('user') as UserType | null;
    const baseline = searchParams.get('baseline') as BaselineType | null;
    const scope = searchParams.get('scope') as ScatterScope | null;
    const ymetric = searchParams.get('ymetric');
    const xmetric = searchParams.get('xm');
    const reg = searchParams.get('reg');
    const quad = searchParams.get('quad');
    const xst = searchParams.get('xst') as ScaleType | null;
    const yst = searchParams.get('yst') as ScaleType | null;
    const wf = searchParams.get('wf') as WaterfallPreset | null;
    const st = searchParams.get('st') as ScoreTypeOption | null;
    const rp = searchParams.get('rp') as RadarPreset | null;
    const bm = searchParams.get('bm');
    const bs = searchParams.get('bs') as BarSort | null;
    const bc = searchParams.get('bc');
    const br = searchParams.get('br');

    return {
      ...DEFAULT_STATE,
      chartType: chart || DEFAULT_STATE.chartType,
      timeFrame: tf || DEFAULT_STATE.timeFrame,
      activeMetric: metric || DEFAULT_STATE.activeMetric,
      userType: userType || DEFAULT_STATE.userType,
      baselineType: baseline || DEFAULT_STATE.baselineType,
      scope: scope || DEFAULT_STATE.scope,
      scatterXMetric: xmetric || DEFAULT_STATE.scatterXMetric,
      scatterYMetric: ymetric || DEFAULT_STATE.scatterYMetric,
      scatterXScaleType: xst || DEFAULT_STATE.scatterXScaleType,
      scatterYScaleType: yst || DEFAULT_STATE.scatterYScaleType,
      showRegression: reg !== null ? reg === '1' : DEFAULT_STATE.showRegression,
      showQuadrants: quad !== null ? quad === '1' : DEFAULT_STATE.showQuadrants,
      waterfallPreset: wf || DEFAULT_STATE.waterfallPreset,
      scoreType: st || DEFAULT_STATE.scoreType,
      radarPreset: rp || DEFAULT_STATE.radarPreset,
      barMetric: bm || DEFAULT_STATE.barMetric,
      barSort: bs || DEFAULT_STATE.barSort,
      barCount: bc ? (parseInt(bc, 10) as BarCount) : DEFAULT_STATE.barCount,
      raceMode: br === '1',
    };
  });

  // Sync state to URL
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    const params = new URLSearchParams();

    if (state.primaryMarket) {
      params.set('primary', state.primaryMarket.id);
    }
    if (state.comparisonMarket) {
      params.set('compare', state.comparisonMarket.id);
    }
    if (state.chartType !== DEFAULT_STATE.chartType) {
      params.set('chart', state.chartType);
    }
    if (state.timeFrame !== DEFAULT_STATE.timeFrame) {
      params.set('tf', state.timeFrame);
    }
    if (state.activeMetric !== DEFAULT_STATE.activeMetric) {
      params.set('metric', state.activeMetric);
    }
    if (state.userType !== DEFAULT_STATE.userType) {
      params.set('user', state.userType);
    }
    if (state.baselineType !== DEFAULT_STATE.baselineType) {
      params.set('baseline', state.baselineType);
    }
    if (state.scope !== DEFAULT_STATE.scope) {
      params.set('scope', state.scope);
    }
    if (state.scatterXMetric !== DEFAULT_STATE.scatterXMetric) {
      params.set('xm', state.scatterXMetric);
    }
    if (state.scatterYMetric !== DEFAULT_STATE.scatterYMetric) {
      params.set('ymetric', state.scatterYMetric);
    }
    if (state.scatterXScaleType !== DEFAULT_STATE.scatterXScaleType) {
      params.set('xst', state.scatterXScaleType);
    }
    if (state.scatterYScaleType !== DEFAULT_STATE.scatterYScaleType) {
      params.set('yst', state.scatterYScaleType);
    }
    if (state.showRegression !== DEFAULT_STATE.showRegression) {
      params.set('reg', state.showRegression ? '1' : '0');
    }
    if (state.showQuadrants !== DEFAULT_STATE.showQuadrants) {
      params.set('quad', state.showQuadrants ? '1' : '0');
    }
    if (state.waterfallPreset !== DEFAULT_STATE.waterfallPreset) {
      params.set('wf', state.waterfallPreset);
    }
    if (state.scoreType !== DEFAULT_STATE.scoreType) {
      params.set('st', state.scoreType);
    }
    if (state.radarPreset !== DEFAULT_STATE.radarPreset) {
      params.set('rp', state.radarPreset);
    }
    if (state.barMetric !== DEFAULT_STATE.barMetric) {
      params.set('bm', state.barMetric);
    }
    if (state.barSort !== DEFAULT_STATE.barSort) {
      params.set('bs', state.barSort);
    }
    if (state.barCount !== DEFAULT_STATE.barCount) {
      params.set('bc', String(state.barCount));
    }
    if (state.raceMode !== DEFAULT_STATE.raceMode) {
      params.set('br', state.raceMode ? '1' : '0');
    }

    const paramStr = params.toString();
    const newUrl = paramStr ? `${pathname}?${paramStr}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [state, pathname, router]);

  // ── Market setters (legacy) ──────────────────────────────────────────

  const setPrimaryMarket = useCallback((market: MyMarket | null) => {
    setState(prev => {
      const m = market ? normalizeMarket(market) : null;
      const newMarkets = [...prev.markets];
      if (m) {
        newMarkets[0] = m;
      } else {
        newMarkets.splice(0, 1);
      }
      return { ...prev, primaryMarket: m, markets: newMarkets };
    });
  }, []);

  const setComparisonMarket = useCallback((market: MyMarket | null) => {
    setState(prev => {
      const m = market ? normalizeMarket(market) : null;
      const newMarkets = [...prev.markets];
      if (m) {
        if (newMarkets.length < 1) {
          return prev;
        }
        newMarkets[1] = m;
      } else {
        newMarkets.splice(1, 1);
      }
      return { ...prev, comparisonMarket: m, markets: newMarkets };
    });
  }, []);

  const selectMarket = useCallback((market: MyMarket) => {
    const m = normalizeMarket(market);
    setState(prev => {
      if (prev.primaryMarket?.id === m.id) {
        const newPrimary = prev.comparisonMarket || null;
        const newMarkets = prev.markets.filter(mk => mk.id !== m.id);
        return { ...prev, primaryMarket: newPrimary, comparisonMarket: null, markets: newMarkets };
      }
      if (prev.comparisonMarket?.id === m.id) {
        const newMarkets = prev.markets.filter(mk => mk.id !== m.id);
        return { ...prev, comparisonMarket: null, markets: newMarkets };
      }
      if (!prev.primaryMarket) {
        return { ...prev, primaryMarket: m, markets: [m, ...prev.markets.slice(1)] };
      }
      if (!prev.comparisonMarket) {
        const newMarkets = [prev.markets[0] || prev.primaryMarket, m, ...prev.markets.slice(2)];
        return { ...prev, comparisonMarket: m, markets: newMarkets };
      }
      const newMarkets = [prev.markets[0] || prev.primaryMarket, m, ...prev.markets.slice(2)];
      return { ...prev, comparisonMarket: m, markets: newMarkets };
    });
  }, []);

  const clearComparison = useCallback(() => {
    setState(prev => ({ ...prev, primaryMarket: null, comparisonMarket: null, markets: [] }));
  }, []);

  const swapMarkets = useCallback(() => {
    setState(prev => {
      const newMarkets = [...prev.markets];
      if (newMarkets.length >= 2) {
        [newMarkets[0], newMarkets[1]] = [newMarkets[1], newMarkets[0]];
      }
      return {
        ...prev,
        primaryMarket: prev.comparisonMarket,
        comparisonMarket: prev.primaryMarket,
        markets: newMarkets,
      };
    });
  }, []);

  // ── Multi-market setters ─────────────────────────────────────────────

  const setMarkets = useCallback((markets: MyMarket[]) => {
    const clamped = markets.slice(0, MAX_MARKETS).map(normalizeMarket);
    setState(prev => ({
      ...prev,
      markets: clamped,
      primaryMarket: clamped[0] || null,
      comparisonMarket: clamped[1] || null,
    }));
  }, []);

  const addMarket = useCallback((market: MyMarket) => {
    const m = normalizeMarket(market);
    setState(prev => {
      if (prev.markets.length >= MAX_MARKETS) return prev;
      if (prev.markets.some(mk => mk.id === m.id)) return prev;
      const newMarkets = [...prev.markets, m];
      return {
        ...prev,
        markets: newMarkets,
        primaryMarket: newMarkets[0] || null,
        comparisonMarket: newMarkets[1] || null,
      };
    });
  }, []);

  const removeMarket = useCallback((index: number) => {
    setState(prev => {
      const newMarkets = prev.markets.filter((_, i) => i !== index);
      return {
        ...prev,
        markets: newMarkets,
        primaryMarket: newMarkets[0] || null,
        comparisonMarket: newMarkets[1] || null,
      };
    });
  }, []);

  // ── Shared setters ───────────────────────────────────────────────────

  const setChartType = useCallback((type: ChartType) => {
    setState(prev => ({ ...prev, chartType: type }));
  }, []);

  const setTimeFrame = useCallback((tf: TimeFrame) => {
    setState(prev => ({ ...prev, timeFrame: tf }));
  }, []);

  const setActiveMetric = useCallback((metric: string) => {
    setState(prev => ({ ...prev, activeMetric: metric }));
  }, []);

  const setUserType = useCallback((type: UserType) => {
    setState(prev => ({ ...prev, userType: type }));
  }, []);

  const setBaselineType = useCallback((type: BaselineType) => {
    setState(prev => ({ ...prev, baselineType: type }));
  }, []);

  const setScope = useCallback((scope: ScatterScope) => {
    setState(prev => ({ ...prev, scope }));
  }, []);

  // Backward-compat alias: setScatterScope -> setScope
  const setScatterScope = setScope;

  // ── Scatter setters ──────────────────────────────────────────────────

  const setScatterXMetric = useCallback((metric: string) => {
    setState(prev => ({ ...prev, scatterXMetric: metric }));
  }, []);

  const setScatterYMetric = useCallback((metric: string) => {
    setState(prev => ({ ...prev, scatterYMetric: metric }));
  }, []);

  const setScatterXScaleType = useCallback((type: ScaleType) => {
    setState(prev => ({ ...prev, scatterXScaleType: type }));
  }, []);

  const setScatterYScaleType = useCallback((type: ScaleType) => {
    setState(prev => ({ ...prev, scatterYScaleType: type }));
  }, []);

  const setShowRegression = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showRegression: show }));
  }, []);

  const setShowQuadrants = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showQuadrants: show }));
  }, []);

  // ── Waterfall setters ────────────────────────────────────────────────

  const setWaterfallPreset = useCallback((preset: WaterfallPreset) => {
    setState(prev => ({ ...prev, waterfallPreset: preset }));
  }, []);

  const setScoreType = useCallback((scoreType: ScoreTypeOption) => {
    setState(prev => ({ ...prev, scoreType }));
  }, []);

  // ── Radar setters ────────────────────────────────────────────────────

  const setRadarPreset = useCallback((preset: RadarPreset) => {
    setState(prev => ({ ...prev, radarPreset: preset }));
  }, []);

  const setRadarMetrics = useCallback((metrics: string[]) => {
    setState(prev => ({ ...prev, radarMetrics: metrics }));
  }, []);

  // ── Bar setters ──────────────────────────────────────────────────────

  const setBarMetric = useCallback((metric: string) => {
    setState(prev => ({ ...prev, barMetric: metric }));
  }, []);

  const setBarSort = useCallback((sort: BarSort) => {
    setState(prev => ({ ...prev, barSort: sort }));
  }, []);

  const setBarCount = useCallback((count: BarCount) => {
    setState(prev => ({ ...prev, barCount: count }));
  }, []);

  const setRaceMode = useCallback((race: boolean) => {
    setState(prev => ({ ...prev, raceMode: race }));
  }, []);

  // ── Bulk update ──────────────────────────────────────────────────────

  const applyTemplate = useCallback((config: Partial<GraphsState>) => {
    setState(prev => ({ ...prev, ...config }));
  }, []);

  return {
    ...state,
    // Backward-compat: expose scatterScope as alias for scope
    scatterScope: state.scope,

    // Market setters (legacy)
    setPrimaryMarket,
    setComparisonMarket,
    selectMarket,
    clearComparison,
    swapMarkets,

    // Multi-market setters
    setMarkets,
    addMarket,
    removeMarket,

    // Shared setters
    setChartType,
    setTimeFrame,
    setActiveMetric,
    setUserType,
    setBaselineType,
    setScope,
    setScatterScope,

    // Scatter setters
    setScatterXMetric,
    setScatterYMetric,
    setScatterXScaleType,
    setScatterYScaleType,
    setShowRegression,
    setShowQuadrants,

    // Waterfall setters
    setWaterfallPreset,
    setScoreType,

    // Radar setters
    setRadarPreset,
    setRadarMetrics,

    // Bar setters
    setBarMetric,
    setBarSort,
    setBarCount,
    setRaceMode,

    // Bulk update
    applyTemplate,
  };
}

export default useGraphsState;
