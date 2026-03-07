/**
 * V2 Report Template Definitions
 *
 * These templates are used when a report's ai_narrative has _meta.version === 'v2'.
 * V2 narratives use fewer, larger narrative sections instead of the v1 pattern
 * of many small section-specific narratives.
 */

import { MarketPulse as SharedMarketPulse } from "../sections/shared";
import {
  V2HomeReadyExecutiveVerdict,
  V2HomeReadyMarketDeepDive,
  V2HomeReadyYourSituation,
  V2HomeReadyVerdictAndActions,
  V2HomeReadyWhatToWatch,
  V2InvestorExecutiveVerdict,
  V2InvestorDeepDive,
  V2InvestorRiskAndResilience,
  V2InvestorThesis,
  V2InvestorActionsAndMonitoring,
  V2ComparisonExecutiveVerdict,
  V2ComparisonHeadToHead,
  V2ComparisonScenarioAnalysis,
  V2ComparisonVerdictAndActions,
} from "../sections/v2/v2TemplateSections";
import type { ReportTemplateDefinition } from "./index";

// ---------------------------------------------------------------------------
// V2 Template Definitions
// ---------------------------------------------------------------------------

export const V2_REPORT_TEMPLATES: Record<string, ReportTemplateDefinition> = {
  homeready_v2: {
    name: "HomeReady Report",
    description: "V2 homebuyer analysis with consolidated narrative sections",
    sections: [
      { component: V2HomeReadyExecutiveVerdict, id: "executive-verdict" },
      { component: V2HomeReadyMarketDeepDive, id: "market-deep-dive" },
      { component: V2HomeReadyYourSituation, id: "your-situation" },
      { component: V2HomeReadyVerdictAndActions, id: "verdict-and-actions" },
      { component: V2HomeReadyWhatToWatch, id: "what-to-watch" },
      { component: SharedMarketPulse, id: "market-pulse" },
    ],
  },
  investoredge_v2: {
    name: "InvestorEdge Report",
    description: "V2 investment analysis with consolidated narrative sections",
    sections: [
      { component: V2InvestorExecutiveVerdict, id: "executive-verdict" },
      { component: V2InvestorDeepDive, id: "investment-deep-dive" },
      { component: V2InvestorRiskAndResilience, id: "risk-and-resilience" },
      { component: V2InvestorThesis, id: "investment-thesis" },
      {
        component: V2InvestorActionsAndMonitoring,
        id: "actions-and-monitoring",
      },
      { component: SharedMarketPulse, id: "market-pulse" },
    ],
  },
  comparison_v2: {
    name: "Market Comparison",
    description: "V2 comparison analysis with consolidated narrative sections",
    sections: [
      { component: V2ComparisonExecutiveVerdict, id: "executive-verdict" },
      { component: V2ComparisonHeadToHead, id: "head-to-head" },
      { component: V2ComparisonScenarioAnalysis, id: "scenario-analysis" },
      { component: V2ComparisonVerdictAndActions, id: "verdict-and-actions" },
      { component: SharedMarketPulse, id: "market-pulse" },
    ],
  },
};
