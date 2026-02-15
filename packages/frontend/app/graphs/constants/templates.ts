import type { GraphsState } from '../hooks/useGraphsState';

export interface GraphTemplate {
  id: string;
  name: string;
  description: string;
  category: 'platform' | 'user';
  config: Partial<GraphsState>;
  icon?: string;
}

export const PLATFORM_TEMPLATES: GraphTemplate[] = [
  {
    id: 'market-comparison',
    name: 'Market Comparison',
    description: 'Compare up to 3 markets over time',
    category: 'platform',
    config: { chartType: 'timeseries', activeMetric: 'home_value', timeFrame: '5Y', scope: 'national' },
  },
  {
    id: 'investment-scatter',
    name: 'Investment Scatter',
    description: 'Cap rate vs growth across markets',
    category: 'platform',
    config: { chartType: 'scatter', scatterXMetric: 'cap_rate', scatterYMetric: 'home_value_5yr', scope: 'national' },
  },
  {
    id: 'score-breakdown',
    name: 'Score Breakdown',
    description: 'See what drives your PropertyIQ score',
    category: 'platform',
    config: { chartType: 'waterfall', waterfallPreset: 'score', scoreType: 'homeready' },
  },
  {
    id: 'market-profile',
    name: 'Market Profile',
    description: 'Radar view of market strengths',
    category: 'platform',
    config: { chartType: 'radar', radarPreset: 'homebuyer' },
  },
  {
    id: 'top-markets',
    name: 'Top Markets',
    description: 'Ranked markets by any metric',
    category: 'platform',
    config: { chartType: 'bar', barMetric: 'cap_rate', barSort: 'desc', barCount: 10 },
  },
  {
    id: 'affordability-breakdown',
    name: 'Affordability Breakdown',
    description: 'What it takes to buy here',
    category: 'platform',
    config: { chartType: 'waterfall', waterfallPreset: 'affordability' },
  },
  {
    id: 'momentum-check',
    name: 'Momentum Check',
    description: 'What is pushing or dragging this market',
    category: 'platform',
    config: { chartType: 'waterfall', waterfallPreset: 'momentum' },
  },
];
