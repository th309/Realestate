import React from 'react';
import {
  FileText,
  TrendingUp,
  Newspaper,
  MapPin,
  Sparkles,
  BarChart3,
  Home,
  Users,
  DollarSign,
  Activity,
  AlertTriangle,
  Star,
  Target,
  Shield,
  Clock,
  Layers,
  Trophy,
  Lightbulb,
  MessageSquare,
} from 'lucide-react';

// Section Icon Helper (for new template system)
export function SectionIcon({ sectionId }: { sectionId: string }) {
  const iconClass = 'w-4 h-4 text-[var(--report-navy)]';
  const id = sectionId.toLowerCase();

  // New HomeReady sections
  if (id === 'hero') return <Home className={iconClass} />;
  if (id === 'score-story') return <BarChart3 className={iconClass} />;
  if (id === 'affordability-deep-dive') return <DollarSign className={iconClass} />;
  if (id === 'market-timing-deep-dive') return <Clock className={iconClass} />;
  if (id === 'stability-deep-dive') return <Shield className={iconClass} />;
  if (id === 'growth-potential-deep-dive') return <TrendingUp className={iconClass} />;
  if (id === 'your-priorities') return <Star className={iconClass} />;
  if (id === 'bottom-line') return <Target className={iconClass} />;
  if (id === 'market-pulse') return <Activity className={iconClass} />;

  // InvestorEdge sections
  if (id === 'investor-hero') return <Home className={iconClass} />;
  if (id === 'investor-score-story') return <BarChart3 className={iconClass} />;
  if (id === 'cash-flow') return <DollarSign className={iconClass} />;
  if (id === 'rent-demand') return <Users className={iconClass} />;
  if (id === 'appreciation') return <TrendingUp className={iconClass} />;
  if (id === 'entry-point') return <DollarSign className={iconClass} />;
  if (id === 'risk') return <AlertTriangle className={iconClass} />;
  if (id === 'investment-thesis') return <Target className={iconClass} />;
  if (id === 'pro-forma') return <BarChart3 className={iconClass} />;
  if (id === 'investor-bottom-line') return <Target className={iconClass} />;

  // Comparison sections
  if (id === 'comparison-hero') return <Trophy className={iconClass} />;
  if (id === 'head-to-head') return <BarChart3 className={iconClass} />;
  if (id === 'component-showdown') return <Layers className={iconClass} />;
  if (id === 'priority-analysis') return <Star className={iconClass} />;
  if (id === 'market-strengths') return <Sparkles className={iconClass} />;
  if (id === 'comparison-verdict') return <Target className={iconClass} />;

  // Agent Client sections
  if (id === 'client-overview') return <Home className={iconClass} />;
  if (id === 'client-price') return <DollarSign className={iconClass} />;
  if (id === 'client-conditions') return <Activity className={iconClass} />;
  if (id === 'client-meaning') return <Lightbulb className={iconClass} />;
  if (id === 'agent-branding') return <Users className={iconClass} />;

  // Agent Prep sections
  if (id === 'prep-stats') return <BarChart3 className={iconClass} />;
  if (id === 'prep-talking-points') return <MessageSquare className={iconClass} />;
  if (id === 'prep-objections') return <Shield className={iconClass} />;
  if (id === 'prep-competitive') return <MapPin className={iconClass} />;
  if (id === 'prep-signals') return <Newspaper className={iconClass} />;

  // Legacy / other report types
  if (id.includes('executive') || id.includes('summary')) return <FileText className={iconClass} />;
  if (id.includes('score') || id.includes('thesis')) return <TrendingUp className={iconClass} />;
  if (id.includes('afford')) return <DollarSign className={iconClass} />;
  if (id.includes('market') || id.includes('conditions')) return <BarChart3 className={iconClass} />;
  if (id.includes('risk')) return <AlertTriangle className={iconClass} />;
  if (id.includes('next') || id.includes('steps')) return <Activity className={iconClass} />;
  if (id.includes('cash') || id.includes('flow')) return <DollarSign className={iconClass} />;
  if (id.includes('appreciation') || id.includes('growth')) return <TrendingUp className={iconClass} />;
  if (id.includes('catalyst')) return <Sparkles className={iconClass} />;
  if (id.includes('price') || id.includes('trend')) return <BarChart3 className={iconClass} />;
  if (id.includes('supply') || id.includes('demand')) return <Activity className={iconClass} />;
  if (id.includes('talking') || id.includes('point')) return <MessageSquare className={iconClass} />;
  if (id.includes('pulse')) return <Activity className={iconClass} />;

  return <FileText className={iconClass} />;
}

// Format section ID to display name
export const SECTION_DISPLAY_NAMES: Record<string, string> = {
  // HomeReady
  'hero': 'Overview',
  'score-story': 'Score Breakdown',
  'affordability-deep-dive': 'Affordability',
  'market-timing-deep-dive': 'Market Timing',
  'stability-deep-dive': 'Stability',
  'growth-potential-deep-dive': 'Growth Potential',
  'your-priorities': 'Your Priorities',
  'bottom-line': 'Bottom Line',
  'market-pulse': 'Market Pulse',
  // InvestorEdge
  'investor-hero': 'Overview',
  'investor-score-story': 'Score Breakdown',
  'cash-flow': 'Cash Flow',
  'rent-demand': 'Rent Demand',
  'appreciation': 'Appreciation',
  'entry-point': 'Entry Point',
  'risk': 'Risk Assessment',
  'investment-thesis': 'Investment Thesis',
  'pro-forma': 'Pro Forma',
  'investor-bottom-line': 'Bottom Line',
  // Comparison
  'comparison-hero': 'Overview',
  'head-to-head': 'Score Comparison',
  'component-showdown': 'Component Breakdown',
  'priority-analysis': 'Priority Analysis',
  'market-strengths': 'Market Strengths',
  'comparison-verdict': 'The Verdict',
  // Agent Client
  'client-overview': 'Market Overview',
  'client-price': 'Price & Value',
  'client-conditions': 'Market Conditions',
  'client-meaning': 'What It Means',
  'agent-branding': 'Your Agent',
  // Agent Prep
  'prep-stats': 'Quick Stats',
  'prep-talking-points': 'Talking Points',
  'prep-objections': 'Objection Handlers',
  'prep-competitive': 'Competitive Context',
  'prep-signals': 'Market Signals',
};

export function formatSectionName(sectionId: string): string {
  if (SECTION_DISPLAY_NAMES[sectionId]) {
    return SECTION_DISPLAY_NAMES[sectionId];
  }
  return sectionId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
