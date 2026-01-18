-- ============================================================================
-- PROPERTYIQ REPORT TEMPLATES - SEED DATA
-- Run this after the schema is created
-- ============================================================================

-- -----------------------------------------------------------------------------
-- TEMPLATE 1: MARKET SNAPSHOT
-- -----------------------------------------------------------------------------
INSERT INTO report_templates (slug, name, description, icon, tier_required, config) VALUES (
  'snapshot',
  'Market Snapshot',
  'Quick pulse on any single market. Current conditions, key metrics, and AI-generated summary.',
  'BarChart3',
  'free',
  '{
    "report_type": "snapshot",
    "supported_geography_types": ["metro", "county", "zip"],
    
    "user_inputs": [],
    
    "pages": [
      {
        "id": "cover",
        "name": "Cover",
        "sections": [
          { "id": "title", "type": "report_title", "config": { "template": "Market Snapshot: {{geography_name}}" } },
          { "id": "dual_scores", "type": "score_gauge_dual", "config": { "scores": ["homeready", "investoredge"], "show_trend": true } },
          { "id": "metadata", "type": "report_metadata", "config": { "show_generation_date": true, "show_data_as_of": true, "show_confidence": true } }
        ]
      },
      {
        "id": "summary",
        "name": "Executive Summary",
        "sections": [
          { "id": "market_verdict", "type": "market_verdict_bar", "config": { "labels": ["Strong Buyers", "Buyers", "Balanced", "Sellers", "Strong Sellers"] } },
          {
            "id": "hero_metrics",
            "type": "metric_grid",
            "config": {
              "columns": 3,
              "metrics": [
                { "metric": "zhvi", "label": "Home Value", "format": "currency", "show_yoy": true, "show_vs_national": true },
                { "metric": "zori", "label": "Typical Rent", "format": "currency_monthly", "show_yoy": true },
                { "metric": "market_heat_index", "label": "Market Heat", "format": "score", "max": 100 },
                { "metric": "days_to_pending", "label": "Days to Pending", "format": "days", "show_yoy": true },
                { "metric": "for_sale_inventory", "label": "Inventory", "format": "number", "show_yoy": true },
                { "metric": "affordability_index", "label": "Affordability", "format": "number" }
              ]
            }
          },
          { "id": "ai_summary", "type": "ai_narrative", "config": { "narrative_section_id": "market_summary", "style": "card" } },
          {
            "id": "quick_facts",
            "type": "fact_box",
            "config": {
              "facts": [
                { "metric": "population", "label": "Population", "format": "number_short" },
                { "metric": "median_household_income", "label": "Median Income", "format": "currency_short" },
                { "metric": "unemployment_rate", "label": "Unemployment", "format": "percent" },
                { "metric": "zhvf_1yr_pct", "label": "1-Year Forecast", "format": "percent_change" }
              ]
            }
          }
        ]
      },
      {
        "id": "trends",
        "name": "Trends",
        "sections": [
          {
            "id": "trend_charts",
            "type": "chart_grid",
            "config": {
              "columns": 2,
              "charts": [
                { "metric": "zhvi", "label": "Home Value", "periods": 12, "show_forecast": true },
                { "metric": "zori", "label": "Rent", "periods": 12 },
                { "metric": "for_sale_inventory", "label": "Inventory", "periods": 12 },
                { "metric": "days_to_pending", "label": "Days to Pending", "periods": 12 }
              ]
            }
          },
          { "id": "ai_trends", "type": "ai_narrative", "config": { "narrative_section_id": "trend_observations", "style": "bullets" } }
        ]
      }
    ],
    
    "ai_config": {
      "narrative_sections": [
        {
          "id": "market_summary",
          "prompt_template": "Generate a 3-5 sentence market summary for {{geography_name}}.\n\nData:\n- ZHVI: {{zhvi}} ({{zhvi_yoy}}% YoY)\n- ZORI: {{zori}}/mo\n- Heat Index: {{market_heat_index}}/100\n- Days to Pending: {{days_to_pending}}\n- Inventory: {{for_sale_inventory}} ({{inventory_yoy}}% YoY)\n- Forecast: {{zhvf_1yr_pct}}%\n- HomeReady Score: {{homeready_score}}\n- InvestorEdge Score: {{investoredge_score}}\n\nCover: market type, key drivers, benchmark comparison, outlook.",
          "max_tokens": 400
        },
        {
          "id": "trend_observations",
          "prompt_template": "Provide 3 key trend observations for {{geography_name}} based on 12-month data. Return as JSON array of strings.",
          "max_tokens": 300,
          "output_format": "json_array"
        }
      ],
      "conversation_starter": "I''ve analyzed {{geography_name}}. What would you like to know?",
      "initial_questions": ["Are you looking to buy, rent, or invest?", "What''s your timeline?"]
    },
    
    "data_requirements": {
      "current_metrics": ["zhvi", "zhvi_yoy", "zori", "zori_yoy", "market_heat_index", "days_to_pending", "for_sale_inventory", "inventory_yoy", "affordability_index", "zhvf_1yr_pct"],
      "historical_metrics": [
        { "metric": "zhvi", "periods": 12 },
        { "metric": "zori", "periods": 12 },
        { "metric": "for_sale_inventory", "periods": 12 },
        { "metric": "days_to_pending", "periods": 12 }
      ],
      "benchmarks": ["national", "state"],
      "scores": ["homeready", "investoredge"],
      "demographics": ["population", "median_household_income", "unemployment_rate"],
      "include_news": true,
      "news_limit": 5
    }
  }'::jsonb
);

-- -----------------------------------------------------------------------------
-- TEMPLATE 2: MARKET COMPARISON
-- -----------------------------------------------------------------------------
INSERT INTO report_templates (slug, name, description, icon, tier_required, config) VALUES (
  'comparison',
  'Market Comparison',
  'Side-by-side analysis of 2-5 markets. Compare scores, metrics, and trends.',
  'GitCompare',
  'basic',
  '{
    "report_type": "comparison",
    "supported_geography_types": ["metro", "county"],
    "comparison": { "min_geographies": 2, "max_geographies": 5 },
    
    "user_inputs": [
      { "field_name": "primary_purpose", "label": "Primary Purpose", "type": "select", "options": [
        { "value": "relocating", "label": "Relocating" },
        { "value": "investing", "label": "Investing" },
        { "value": "both", "label": "Both" }
      ]},
      { "field_name": "priority_affordability", "label": "Affordability Priority", "type": "range", "min": 1, "max": 5, "default": 3 },
      { "field_name": "priority_cash_flow", "label": "Cash Flow Priority", "type": "range", "min": 1, "max": 5, "default": 3 },
      { "field_name": "priority_appreciation", "label": "Appreciation Priority", "type": "range", "min": 1, "max": 5, "default": 3 }
    ],
    
    "pages": [
      {
        "id": "cover",
        "name": "Cover",
        "sections": [
          { "id": "title", "type": "report_title", "config": { "template": "Market Comparison" } },
          { "id": "markets_list", "type": "comparison_header", "config": { "show_scores_preview": true } }
        ]
      },
      {
        "id": "score_comparison",
        "name": "Score Comparison",
        "sections": [
          { "id": "radar_chart", "type": "comparison_radar", "config": { "show_components": true } },
          { "id": "winner_badges", "type": "winner_badges", "config": {
            "badges": [
              { "id": "best_buyers", "label": "Best for Buyers", "metric": "homeready_score" },
              { "id": "best_cash_flow", "label": "Best Cash Flow", "metric": "cash_flow_component" },
              { "id": "best_growth", "label": "Best Growth", "metric": "growth_component" },
              { "id": "lowest_risk", "label": "Lowest Risk", "metric": "risk_component", "invert": true }
            ]
          }},
          { "id": "score_table", "type": "comparison_table", "config": {
            "rows": [
              { "label": "HomeReady Score", "metric": "homeready_score" },
              { "label": "InvestorEdge Score", "metric": "investoredge_score" },
              { "label": "Affordability", "metric": "affordability_component" },
              { "label": "Cash Flow", "metric": "cash_flow_component" },
              { "label": "Growth", "metric": "growth_component" },
              { "label": "Risk", "metric": "risk_component", "invert_color": true }
            ],
            "highlight_best": true
          }}
        ]
      },
      {
        "id": "metrics_comparison",
        "name": "Metrics Comparison",
        "sections": [
          { "id": "full_metrics_table", "type": "comparison_table", "config": {
            "include_national": true,
            "rows": [
              { "label": "Home Value", "metric": "zhvi", "format": "currency" },
              { "label": "Typical Rent", "metric": "zori", "format": "currency_monthly" },
              { "label": "Rent/Price Ratio", "metric": "rent_to_price_ratio", "format": "percent" },
              { "label": "Days on Market", "metric": "days_to_pending", "format": "days" },
              { "label": "1Y Appreciation", "metric": "zhvi_yoy", "format": "percent" },
              { "label": "5Y Appreciation", "metric": "zhvi_5y_cagr", "format": "percent" },
              { "label": "Population Growth", "metric": "population_growth_yoy", "format": "percent" },
              { "label": "Job Growth", "metric": "job_growth_yoy", "format": "percent" }
            ]
          }}
        ]
      },
      {
        "id": "trends",
        "name": "Trend Comparison",
        "sections": [
          { "id": "overlaid_charts", "type": "comparison_chart_grid", "config": {
            "charts": [
              { "metric": "zhvi", "label": "Home Value (5Y)", "periods": 60 },
              { "metric": "zori", "label": "Rent (3Y)", "periods": 36 },
              { "metric": "for_sale_inventory", "label": "Inventory (2Y)", "periods": 24 }
            ]
          }}
        ]
      },
      {
        "id": "analysis",
        "name": "Analysis",
        "sections": [
          { "id": "comparative_narrative", "type": "ai_narrative", "config": { "narrative_section_id": "comparative_analysis" } },
          { "id": "best_fit", "type": "ai_narrative", "config": { "narrative_section_id": "best_fit_recommendations" } },
          { "id": "personalized", "type": "ai_narrative", "config": { "narrative_section_id": "personalized_recommendation", "show_if_inputs_provided": true } }
        ]
      },
      {
        "id": "decision",
        "name": "Decision Matrix",
        "sections": [
          { "id": "pros_cons", "type": "pros_cons_table", "config": { "pros_count": 3, "cons_count": 3 } },
          { "id": "verdict", "type": "ai_narrative", "config": { "narrative_section_id": "final_verdict", "style": "highlight" } }
        ]
      }
    ],
    
    "ai_config": {
      "narrative_sections": [
        { "id": "comparative_analysis", "prompt_template": "Compare these markets:\n{{#each markets}}{{name}}: HomeReady={{homeready_score}}, ZHVI={{zhvi}}, Rent/Price={{rent_to_price_ratio}}%\n{{/each}}\n\nProvide comprehensive comparison in 4-5 paragraphs.", "max_tokens": 800 },
        { "id": "best_fit_recommendations", "prompt_template": "Recommend best market for: first-time buyers, families, cash flow investors, appreciation investors. Return as JSON.", "max_tokens": 400, "output_format": "json_object" },
        { "id": "personalized_recommendation", "prompt_template": "User priorities: Purpose={{primary_purpose}}, Affordability={{priority_affordability}}/5, Cash Flow={{priority_cash_flow}}/5, Appreciation={{priority_appreciation}}/5.\n\nRecommend best match in 2-3 sentences.", "max_tokens": 200 },
        { "id": "final_verdict", "prompt_template": "Final verdict: which market wins overall and why? 2-3 sentences.", "max_tokens": 150 }
      ],
      "conversation_starter": "I''ve compared {{market_count}} markets. What would you like to explore?",
      "initial_questions": ["Which factors matter most to you?", "Are you leaning toward any market already?"]
    },
    
    "data_requirements": {
      "current_metrics": ["zhvi", "zhvi_yoy", "zhvi_5y_cagr", "zori", "zori_yoy", "rent_to_price_ratio", "days_to_pending", "for_sale_inventory", "population_growth_yoy", "job_growth_yoy"],
      "historical_metrics": [
        { "metric": "zhvi", "periods": 60 },
        { "metric": "zori", "periods": 36 },
        { "metric": "for_sale_inventory", "periods": 24 }
      ],
      "benchmarks": ["national"],
      "scores": ["homeready", "investoredge"],
      "score_components": true
    }
  }'::jsonb
);

-- -----------------------------------------------------------------------------
-- TEMPLATE 3: INVESTMENT ANALYSIS
-- -----------------------------------------------------------------------------
INSERT INTO report_templates (slug, name, description, icon, tier_required, config) VALUES (
  'investment',
  'Investment Analysis',
  'Deep dive for rental property investors. Cash flow, appreciation, risk, and pro forma.',
  'PiggyBank',
  'basic',
  '{
    "report_type": "investment",
    "supported_geography_types": ["metro", "county", "zip"],
    
    "user_inputs": [
      { "field_name": "purchase_price", "label": "Purchase Price", "type": "number", "placeholder": "Leave blank for median" },
      { "field_name": "down_payment_pct", "label": "Down Payment %", "type": "number", "default": 20 },
      { "field_name": "interest_rate", "label": "Interest Rate %", "type": "number", "default": 7.0 },
      { "field_name": "expected_rent", "label": "Expected Rent", "type": "number", "placeholder": "Leave blank for market median" },
      { "field_name": "investment_goal", "label": "Primary Goal", "type": "select", "options": [
        { "value": "cash_flow", "label": "Cash Flow" },
        { "value": "appreciation", "label": "Appreciation" },
        { "value": "balanced", "label": "Balanced" }
      ]},
      { "field_name": "hold_period", "label": "Hold Period", "type": "select", "options": [
        { "value": "3-5", "label": "3-5 years" },
        { "value": "5-10", "label": "5-10 years" },
        { "value": "10+", "label": "10+ years" }
      ]}
    ],
    
    "pages": [
      {
        "id": "cover",
        "name": "Cover",
        "sections": [
          { "id": "title", "type": "report_title", "config": { "template": "Investment Analysis: {{geography_name}}" } },
          { "id": "score", "type": "score_gauge_single", "config": { "score": "investoredge", "show_components_preview": true } },
          { "id": "verdict", "type": "investment_verdict", "config": { "verdicts": ["Strong Buy", "Buy", "Hold", "Caution", "Avoid"] } }
        ]
      },
      {
        "id": "summary",
        "name": "Executive Summary",
        "sections": [
          { "id": "key_metrics", "type": "metric_grid", "config": {
            "columns": 4,
            "metrics": [
              { "metric": "gross_rent_multiplier", "label": "GRM", "format": "number_1d" },
              { "metric": "rent_to_price_ratio", "label": "Rent/Price", "format": "percent" },
              { "metric": "cap_rate_proxy", "label": "Cap Rate Est.", "format": "percent" },
              { "metric": "zordi", "label": "Rental Demand", "format": "score" }
            ]
          }},
          { "id": "strengths_risks", "type": "strengths_risks", "config": { "strengths_count": 3, "risks_count": 3 } },
          { "id": "thesis", "type": "ai_narrative", "config": { "narrative_section_id": "investment_thesis" } }
        ]
      },
      {
        "id": "cash_flow",
        "name": "Cash Flow Analysis",
        "sections": [
          { "id": "rent_metrics", "type": "metric_detail", "config": {
            "metrics": [
              { "metric": "zori", "label": "Typical Rent", "format": "currency_monthly" },
              { "metric": "zori_yoy", "label": "Rent Growth YoY", "format": "percent" },
              { "metric": "zori_5y_cagr", "label": "5Y Rent CAGR", "format": "percent" }
            ]
          }},
          { "id": "zordi_chart", "type": "chart_single", "config": { "metric": "zordi", "periods": 12 } },
          { "id": "renter_affordability", "type": "metric_detail", "config": {
            "metrics": [{ "metric": "rent_to_income_ratio", "label": "Rent-to-Income", "format": "percent" }],
            "warning_threshold": { "metric": "rent_to_income_ratio", "above": 35 }
          }}
        ]
      },
      {
        "id": "appreciation",
        "name": "Appreciation Potential",
        "sections": [
          { "id": "historical_chart", "type": "chart_single", "config": { "metric": "zhvi", "periods": 120, "show_forecast": true } },
          { "id": "appreciation_metrics", "type": "metric_detail", "config": {
            "metrics": [
              { "metric": "zhvi_yoy", "label": "1Y Appreciation", "format": "percent" },
              { "metric": "zhvi_3y_cagr", "label": "3Y CAGR", "format": "percent" },
              { "metric": "zhvi_5y_cagr", "label": "5Y CAGR", "format": "percent" },
              { "metric": "zhvf_1yr_pct", "label": "1Y Forecast", "format": "percent" }
            ]
          }},
          { "id": "growth_drivers", "type": "metric_detail", "config": {
            "title": "Growth Drivers",
            "metrics": [
              { "metric": "population_growth_yoy", "label": "Population Growth", "format": "percent" },
              { "metric": "job_growth_yoy", "label": "Job Growth", "format": "percent" },
              { "metric": "net_migration", "label": "Net Migration", "format": "number_signed" }
            ]
          }}
        ]
      },
      {
        "id": "risk",
        "name": "Risk Assessment",
        "sections": [
          { "id": "risk_gauge", "type": "score_gauge_single", "config": { "score": "risk_component", "invert_color": true } },
          { "id": "risk_indicators", "type": "indicator_dashboard", "config": {
            "indicators": ["inventory_yoy", "days_to_pending", "price_cut_pct", "sale_to_list_ratio", "market_heat_index"]
          }},
          { "id": "cycle_position", "type": "cycle_indicator" },
          { "id": "risk_breakdown", "type": "ai_narrative", "config": { "narrative_section_id": "risk_factors" } }
        ]
      },
      {
        "id": "comparables",
        "name": "Comparable Markets",
        "sections": [
          { "id": "comp_table", "type": "comparison_table", "config": {
            "comparison_type": "similar_markets",
            "max_comparables": 3,
            "rows": [
              { "label": "InvestorEdge Score", "metric": "investoredge_score" },
              { "label": "Rent/Price Ratio", "metric": "rent_to_price_ratio", "format": "percent" },
              { "label": "5Y Appreciation", "metric": "zhvi_5y_cagr", "format": "percent" },
              { "label": "Risk Score", "metric": "risk_component", "invert_color": true }
            ]
          }}
        ]
      },
      {
        "id": "pro_forma",
        "name": "Pro Forma",
        "show_if_inputs": ["purchase_price"],
        "sections": [
          { "id": "assumptions", "type": "pro_forma_assumptions" },
          { "id": "cash_flow", "type": "pro_forma_cash_flow" },
          { "id": "returns", "type": "pro_forma_returns" },
          { "id": "sensitivity", "type": "pro_forma_sensitivity" }
        ]
      }
    ],
    
    "ai_config": {
      "narrative_sections": [
        { "id": "investment_thesis", "prompt_template": "Investment thesis for {{geography_name}}:\n- InvestorEdge: {{investoredge_score}}\n- GRM: {{gross_rent_multiplier}}\n- Rent/Price: {{rent_to_price_ratio}}%\n- 5Y Appreciation: {{zhvi_5y_cagr}}%\n- Risk: {{risk_component}}\n\nProvide verdict (Strong Buy/Buy/Hold/Caution/Avoid), bull case, bear case, recommended strategy.", "max_tokens": 500 },
        { "id": "risk_factors", "prompt_template": "Analyze risk factors. Return JSON: {\"elevating_risk\": [...], \"mitigating_risk\": [...]}", "max_tokens": 300, "output_format": "json_object" }
      ],
      "conversation_starter": "I''ve analyzed {{geography_name}} for investment. InvestorEdge Score: {{investoredge_score}}. What would you like to explore?",
      "initial_questions": ["What''s your investment goal - cash flow, appreciation, or balanced?", "How long do you plan to hold?"]
    },
    
    "data_requirements": {
      "current_metrics": ["zhvi", "zhvi_yoy", "zhvi_3y_cagr", "zhvi_5y_cagr", "zori", "zori_yoy", "zori_5y_cagr", "gross_rent_multiplier", "rent_to_price_ratio", "cap_rate_proxy", "zordi", "rent_to_income_ratio", "market_heat_index", "days_to_pending", "for_sale_inventory", "inventory_yoy", "price_cut_pct", "sale_to_list_ratio", "zhvf_1yr_pct"],
      "historical_metrics": [
        { "metric": "zhvi", "periods": 120 },
        { "metric": "zori", "periods": 60 },
        { "metric": "zordi", "periods": 12 }
      ],
      "benchmarks": ["national", "similar_metros"],
      "scores": ["investoredge"],
      "score_components": true,
      "demographics": ["population_growth_yoy", "job_growth_yoy", "net_migration"],
      "include_news": true,
      "include_comparables": true,
      "comparable_count": 3
    }
  }'::jsonb
);

-- -----------------------------------------------------------------------------
-- TEMPLATE 4: AFFORDABILITY & MIGRATION
-- -----------------------------------------------------------------------------
INSERT INTO report_templates (slug, name, description, icon, tier_required, config) VALUES (
  'affordability',
  'Affordability & Migration',
  'Demographics, affordability analysis, and population flow patterns.',
  'Users',
  'basic',
  '{
    "report_type": "affordability",
    "supported_geography_types": ["metro", "county"],
    
    "user_inputs": [
      { "field_name": "household_income", "label": "Your Household Income", "type": "number", "placeholder": "For personalized analysis" },
      { "field_name": "savings_rate", "label": "Monthly Savings Rate %", "type": "number", "default": 10 },
      { "field_name": "current_savings", "label": "Current Savings", "type": "number", "placeholder": "For timeline calculation" }
    ],
    
    "pages": [
      {
        "id": "cover",
        "name": "Cover",
        "sections": [
          { "id": "title", "type": "report_title", "config": { "template": "Affordability & Migration: {{geography_name}}" } },
          { "id": "score", "type": "score_gauge_single", "config": { "score": "homeready" } },
          { "id": "status", "type": "status_badge", "config": { "metric": "affordability_status", "statuses": ["Affordable", "Stretched", "Unaffordable"] } },
          { "id": "migration", "type": "metric_highlight", "config": { "metric": "net_migration", "format": "number_signed" } }
        ]
      },
      {
        "id": "affordability",
        "name": "Affordability Dashboard",
        "sections": [
          { "id": "key_metrics", "type": "metric_detail", "config": {
            "metrics": [
              { "metric": "zhvi", "label": "Median Home Price", "format": "currency" },
              { "metric": "median_household_income", "label": "Median Income", "format": "currency" },
              { "metric": "income_needed_to_buy", "label": "Income Needed to Buy", "format": "currency" },
              { "metric": "affordability_gap", "label": "Affordability Gap", "format": "currency_signed" },
              { "metric": "income_percentile_to_buy", "label": "Income Percentile Required", "format": "ordinal" }
            ]
          }},
          { "id": "gap_visual", "type": "affordability_gap_visual" },
          { "id": "trend", "type": "chart_single", "config": { "metric": "affordability_index", "periods": 60, "reference_line": 100 } },
          { "id": "savings_calc", "type": "savings_calculator", "config": { "down_payment_pct": 20 } }
        ]
      },
      {
        "id": "personalized",
        "name": "Your Affordability",
        "show_if_inputs": ["household_income"],
        "sections": [
          { "id": "assessment", "type": "personal_affordability" },
          { "id": "budget", "type": "budget_breakdown", "config": { "housing_ratio": 0.28 } },
          { "id": "timeline", "type": "savings_timeline" },
          { "id": "alternatives", "type": "alternative_areas", "config": { "max_suggestions": 3 } }
        ]
      },
      {
        "id": "migration",
        "name": "Migration Patterns",
        "sections": [
          { "id": "summary", "type": "metric_highlight", "config": { "metric": "net_migration", "subtitle": "Annual domestic migration" } },
          { "id": "flow", "type": "migration_sankey", "config": { "show_top": 5 } },
          { "id": "origins", "type": "ranked_list", "config": { "title": "Where People Come From", "metric": "migration_origins", "max_items": 5 } },
          { "id": "destinations", "type": "ranked_list", "config": { "title": "Where People Go", "metric": "migration_destinations", "max_items": 5 } },
          { "id": "trend", "type": "chart_single", "config": { "metric": "net_migration", "chart_type": "bar", "periods": 5 } },
          { "id": "analysis", "type": "ai_narrative", "config": { "narrative_section_id": "migration_analysis" } }
        ]
      },
      {
        "id": "demographics",
        "name": "Demographics",
        "sections": [
          { "id": "population", "type": "metric_detail", "config": {
            "metrics": [
              { "metric": "population", "label": "Population", "format": "number" },
              { "metric": "population_growth_yoy", "label": "Growth Rate", "format": "percent" },
              { "metric": "median_age", "label": "Median Age", "format": "number" },
              { "metric": "homeownership_rate", "label": "Homeownership", "format": "percent" }
            ]
          }},
          { "id": "age_dist", "type": "chart_single", "config": { "metric": "age_distribution", "chart_type": "horizontal_bar" } },
          { "id": "remote_work", "type": "metric_comparison", "config": { "metric": "remote_work_pct", "compare_to": "national" } }
        ]
      },
      {
        "id": "economic",
        "name": "Economic Context",
        "sections": [
          { "id": "employment", "type": "metric_detail", "config": {
            "metrics": [
              { "metric": "unemployment_rate", "label": "Unemployment", "format": "percent" },
              { "metric": "job_growth_yoy", "label": "Job Growth", "format": "percent" },
              { "metric": "income_growth_yoy", "label": "Income Growth", "format": "percent" }
            ]
          }},
          { "id": "industries", "type": "ranked_list", "config": { "title": "Major Industries", "metric": "industries_by_employment", "max_items": 5 } },
          { "id": "outlook", "type": "ai_narrative", "config": { "narrative_section_id": "economic_outlook" } }
        ]
      },
      {
        "id": "narrative",
        "name": "The Story",
        "sections": [
          { "id": "story", "type": "ai_narrative", "config": { "narrative_section_id": "market_story", "style": "long_form" } },
          { "id": "outlook", "type": "ai_narrative", "config": { "narrative_section_id": "affordability_outlook" } }
        ]
      }
    ],
    
    "ai_config": {
      "narrative_sections": [
        { "id": "migration_analysis", "prompt_template": "Analyze migration for {{geography_name}}. Net migration: {{net_migration}}. Top origins: {{migration_origins}}. Top destinations: {{migration_destinations}}. Explain push/pull factors in 2-3 sentences.", "max_tokens": 200 },
        { "id": "economic_outlook", "prompt_template": "Economic outlook for {{geography_name}}. Unemployment: {{unemployment_rate}}%, Job growth: {{job_growth_yoy}}%, Income growth: {{income_growth_yoy}}%. Assess trajectory in 2-3 sentences.", "max_tokens": 200 },
        { "id": "market_story", "prompt_template": "Tell the story of {{geography_name}} in 3-4 paragraphs. Population: {{population}}, Income: {{median_household_income}}, Home Price: {{zhvi}}, Net Migration: {{net_migration}}. Cover: who lives here, affordability trends, push/pull factors.", "max_tokens": 600 },
        { "id": "affordability_outlook", "prompt_template": "3-5 year affordability outlook for {{geography_name}}. Current index: {{affordability_index}}, Home price forecast: {{zhvf_1yr_pct}}%, Income growth: {{income_growth_yoy}}%. Improving or worsening? 2-3 sentences.", "max_tokens": 200 }
      ],
      "conversation_starter": "I''ve analyzed affordability and migration for {{geography_name}}. What would you like to explore?",
      "initial_questions": ["Are you considering moving here?", "Would you like a personalized affordability assessment?"]
    },
    
    "data_requirements": {
      "current_metrics": ["zhvi", "zori", "median_household_income", "income_needed_to_buy", "affordability_index", "affordability_gap", "income_percentile_to_buy", "net_migration", "population", "population_growth_yoy", "unemployment_rate", "job_growth_yoy", "income_growth_yoy", "remote_work_pct", "median_age", "homeownership_rate"],
      "historical_metrics": [
        { "metric": "affordability_index", "periods": 60 },
        { "metric": "net_migration", "periods": 5 }
      ],
      "benchmarks": ["national", "state"],
      "scores": ["homeready"],
      "demographics": ["age_distribution", "industries_by_employment"],
      "migration": { "include": true, "top_origins": 5, "top_destinations": 5 }
    }
  }'::jsonb
);

-- -----------------------------------------------------------------------------
-- TEMPLATE 5: MARKET CYCLE & RISK
-- -----------------------------------------------------------------------------
INSERT INTO report_templates (slug, name, description, icon, tier_required, config) VALUES (
  'cycle',
  'Market Cycle & Risk',
  'Sophisticated cycle position analysis, risk indicators, and scenario planning.',
  'Activity',
  'pro',
  '{
    "report_type": "cycle",
    "supported_geography_types": ["metro", "county"],
    
    "user_inputs": [
      { "field_name": "rate_change_scenario", "label": "Rate Change Scenario", "type": "select", "options": [
        { "value": "-1", "label": "Rates -1%" },
        { "value": "0", "label": "No Change" },
        { "value": "+1", "label": "Rates +1%" },
        { "value": "+2", "label": "Rates +2%" }
      ], "default": "0" },
      { "field_name": "inventory_change_scenario", "label": "Inventory Change", "type": "select", "options": [
        { "value": "-20", "label": "-20%" },
        { "value": "0", "label": "No Change" },
        { "value": "+20", "label": "+20%" },
        { "value": "+50", "label": "+50%" }
      ], "default": "0" },
      { "field_name": "include_recession_scenario", "label": "Include Recession Scenario", "type": "boolean", "default": true }
    ],
    
    "pages": [
      {
        "id": "cover",
        "name": "Cover",
        "sections": [
          { "id": "title", "type": "report_title", "config": { "template": "Market Cycle & Risk: {{geography_name}}" } },
          { "id": "risk_score", "type": "score_gauge_single", "config": { "score": "risk_component", "invert_color": true, "labels": ["Low", "Moderate", "Elevated", "High"] } },
          { "id": "cycle", "type": "cycle_indicator", "config": { "phases": ["Early Recovery", "Expansion", "Hyper Supply", "Recession"] } }
        ]
      },
      {
        "id": "cycle_position",
        "name": "Cycle Position",
        "sections": [
          { "id": "diagram", "type": "cycle_diagram", "config": { "highlight_current": true } },
          { "id": "historical", "type": "metric_detail", "config": {
            "title": "Historical Context",
            "metrics": [
              { "metric": "zhvi_vs_2007_peak", "label": "vs 2007 Peak", "format": "percent" },
              { "metric": "zhvi_vs_2012_trough", "label": "vs 2012 Trough", "format": "percent" },
              { "metric": "zhvi_vs_pre_covid", "label": "vs Pre-COVID", "format": "percent" }
            ]
          }},
          { "id": "percentiles", "type": "percentile_bands", "config": {
            "metrics": ["zhvi", "for_sale_inventory", "days_to_pending", "price_cut_pct"]
          }},
          { "id": "explanation", "type": "ai_narrative", "config": { "narrative_section_id": "cycle_explanation" } }
        ]
      },
      {
        "id": "leading_indicators",
        "name": "Leading Indicators",
        "sections": [
          { "id": "inventory", "type": "indicator_deep_dive", "config": { "metric": "for_sale_inventory", "periods": 24 } },
          { "id": "new_listings", "type": "indicator_deep_dive", "config": { "metric": "new_listings", "periods": 24 } },
          { "id": "pending", "type": "indicator_deep_dive", "config": { "metric": "days_to_pending", "periods": 24 } },
          { "id": "summary_table", "type": "indicator_summary_table", "config": {
            "indicators": ["for_sale_inventory", "new_listings", "days_to_pending", "price_cut_pct", "sale_to_list_ratio"]
          }}
        ]
      },
      {
        "id": "stress",
        "name": "Stress Signals",
        "sections": [
          { "id": "price_cuts", "type": "stress_indicator", "config": { "metric": "price_cut_pct", "thresholds": { "normal": 15, "elevated": 25 } } },
          { "id": "sale_to_list", "type": "stress_indicator", "config": { "metric": "sale_to_list_ratio", "thresholds": { "healthy": 98, "softening": 95 } } },
          { "id": "heat", "type": "stress_indicator", "config": { "metric": "market_heat_index", "show_direction": true } },
          { "id": "summary", "type": "stress_summary", "config": { "statuses": ["Healthy", "Caution", "Stressed"] } }
        ]
      },
      {
        "id": "scenarios",
        "name": "Scenario Analysis",
        "sections": [
          { "id": "base", "type": "scenario_card", "config": { "scenario": "base" } },
          { "id": "rates", "type": "scenario_card", "config": { "scenario": "rate_change" } },
          { "id": "inventory", "type": "scenario_card", "config": { "scenario": "inventory_change" } },
          { "id": "recession", "type": "scenario_card", "config": { "scenario": "recession", "show_if_input": "include_recession_scenario" } },
          { "id": "chart", "type": "scenario_chart", "config": { "periods_forward": 24 } }
        ]
      },
      {
        "id": "risk_breakdown",
        "name": "Risk Breakdown",
        "sections": [
          { "id": "components", "type": "score_breakdown", "config": { "score": "risk_component" } },
          { "id": "elevating", "type": "ai_narrative", "config": { "narrative_section_id": "risk_elevating", "style": "list", "color": "red" } },
          { "id": "mitigating", "type": "ai_narrative", "config": { "narrative_section_id": "risk_mitigating", "style": "list", "color": "green" } },
          { "id": "history", "type": "chart_single", "config": { "metric": "risk_score_history", "periods": 24 } },
          { "id": "vs_peers", "type": "percentile_rank", "config": { "metric": "risk_component", "comparison_set": "similar_metros" } }
        ]
      },
      {
        "id": "narrative",
        "name": "Risk Narrative",
        "sections": [
          { "id": "summary", "type": "ai_narrative", "config": { "narrative_section_id": "risk_summary", "style": "long_form" } },
          { "id": "watchlist", "type": "ai_narrative", "config": { "narrative_section_id": "watchlist_items", "title": "Watchlist" } },
          { "id": "historical", "type": "ai_narrative", "config": { "narrative_section_id": "historical_behavior", "title": "Past Downturns" } },
          { "id": "defensive", "type": "ai_narrative", "config": { "narrative_section_id": "defensive_positioning", "title": "Defensive Strategy" } }
        ]
      }
    ],
    
    "ai_config": {
      "narrative_sections": [
        { "id": "cycle_explanation", "prompt_template": "Explain cycle position for {{geography_name}}. Position: {{cycle_position}}. ZHVI vs 2007: {{zhvi_vs_2007_peak}}%. What this phase means in 2-3 sentences.", "max_tokens": 200 },
        { "id": "risk_elevating", "prompt_template": "List 3 factors elevating risk in {{geography_name}}. Return as JSON array.", "max_tokens": 200, "output_format": "json_array" },
        { "id": "risk_mitigating", "prompt_template": "List 3 factors mitigating risk in {{geography_name}}. Return as JSON array.", "max_tokens": 200, "output_format": "json_array" },
        { "id": "risk_summary", "prompt_template": "Comprehensive risk assessment for {{geography_name}} in 2-3 paragraphs. Risk score: {{risk_component}}, Cycle: {{cycle_position}}.", "max_tokens": 400 },
        { "id": "watchlist_items", "prompt_template": "3 specific indicators to monitor for early warning signs in {{geography_name}}.", "max_tokens": 250 },
        { "id": "historical_behavior", "prompt_template": "How did {{geography_name}} perform in 2008-2012? Drawdown: {{historical_drawdown}}%. Describe resilience in 2-3 sentences.", "max_tokens": 200 },
        { "id": "defensive_positioning", "prompt_template": "Defensive strategies for {{geography_name}} given {{risk_level}} risk. 2-3 sentences.", "max_tokens": 200 }
      ],
      "conversation_starter": "I''ve analyzed market cycle and risk for {{geography_name}}. Currently in {{cycle_position}} with {{risk_level}} risk. What would you like to explore?",
      "initial_questions": ["Are you concerned about specific risks?", "Want me to run additional scenarios?"]
    },
    
    "data_requirements": {
      "current_metrics": ["zhvi", "zhvi_yoy", "zhvi_vs_2007_peak", "zhvi_vs_2012_trough", "zhvi_vs_pre_covid", "for_sale_inventory", "inventory_yoy", "months_of_supply", "new_listings", "days_to_pending", "price_cut_pct", "sale_to_list_ratio", "market_heat_index", "zhvf_1yr_pct"],
      "historical_metrics": [
        { "metric": "zhvi", "periods": 120 },
        { "metric": "for_sale_inventory", "periods": 24 },
        { "metric": "days_to_pending", "periods": 24 },
        { "metric": "price_cut_pct", "periods": 12 },
        { "metric": "market_heat_index", "periods": 24 }
      ],
      "benchmarks": ["national", "similar_metros"],
      "scores": ["investoredge"],
      "score_components": true,
      "historical_extremes": { "include": true, "periods": 120 },
      "cycle_data": { "include": true },
      "include_news": true,
      "news_categories": ["economic", "policy"]
    }
  }'::jsonb
);
