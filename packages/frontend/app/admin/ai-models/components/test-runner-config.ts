/**
 * Test Runner Configuration
 *
 * Defines the models, geographies, and report configs used
 * by the automated model evaluation test runner.
 */

import type { GenerateReportRequest } from "@/lib/data/fetchers/reports";

export interface TestModel {
  id: string;
  shortName: string;
  provider: string;
  model: string;
}

export const TEST_MODELS: TestModel[] = [
  {
    id: "dsreasoner",
    shortName: "DS-Reasoner",
    provider: "deepseek",
    model: "deepseek-reasoner",
  },
  {
    id: "dschat",
    shortName: "DS-Chat",
    provider: "deepseek",
    model: "deepseek-chat",
  },
  {
    id: "sonnet46",
    shortName: "Sonnet 4.6",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
  },
  {
    id: "haiku45",
    shortName: "Haiku 4.5",
    provider: "anthropic",
    model: "claude-haiku-4-5",
  },
  {
    id: "gpt41",
    shortName: "GPT-4.1",
    provider: "openai",
    model: "gpt-4.1",
  },
  {
    id: "gpt41mini",
    shortName: "GPT-4.1 Mini",
    provider: "openai",
    model: "gpt-4.1-mini",
  },
  {
    id: "gemflash",
    shortName: "Gem Flash",
    provider: "google",
    model: "gemini-2.5-flash",
  },
];

interface TestGeography {
  id: string;
  shortName: string;
  geo: GenerateReportRequest["primary_geography"];
}

export const TEST_GEOGRAPHIES: TestGeography[] = [
  {
    id: "tampa",
    shortName: "Tampa",
    geo: {
      id: "45300",
      type: "metro",
      name: "Tampa-St. Petersburg-Clearwater, FL",
      state: "FL",
    },
  },
  {
    id: "columbus",
    shortName: "Columbus",
    geo: {
      id: "18140",
      type: "metro",
      name: "Columbus, OH",
      state: "OH",
    },
  },
  {
    id: "conway-zip",
    shortName: "Conway ZIP",
    geo: { id: "72032", type: "zip", name: "Conway, AR 72032", state: "AR" },
  },
];

interface TestReportType {
  id: string;
  label: string;
  buildRequest: (geo: TestGeography) => GenerateReportRequest;
}

export const TEST_REPORT_TYPES: TestReportType[] = [
  {
    id: "homeready",
    label: "HomeReady",
    buildRequest: (geo) => ({
      template_slug: "homeready",
      user_type: "homebuyer",
      primary_geography: geo.geo,
    }),
  },
  {
    id: "investoredge",
    label: "InvestorEdge",
    buildRequest: (geo) => ({
      template_slug: "investoredge",
      user_type: "investor",
      primary_geography: geo.geo,
    }),
  },
  {
    id: "comparison",
    label: "Comparison",
    buildRequest: (geo) => ({
      template_slug: "comparison",
      user_type: "homebuyer",
      primary_geography: geo.geo,
      comparison_geographies: [
        // Always compare against the other metro
        geo.id === "tampa" ? TEST_GEOGRAPHIES[1].geo : TEST_GEOGRAPHIES[0].geo,
      ],
    }),
  },
  {
    id: "custom",
    label: "Custom",
    buildRequest: (geo) => ({
      template_slug: "custom_research",
      user_type: "homebuyer",
      primary_geography: geo.geo,
      user_inputs: {
        custom_question:
          "What are the top 3 neighborhoods to watch in this market for first-time buyers with a $350K budget, and why?",
      },
    }),
  },
];

export interface TestJob {
  testRunId: string;
  model: TestModel;
  reportType: TestReportType;
  geography: TestGeography;
  request: GenerateReportRequest;
  status: "pending" | "switching" | "generating" | "polling" | "done" | "error";
  reportId?: string;
  error?: string;
  elapsed?: string;
  stage?: string;
  /** Total generation time in seconds (from request to ready). */
  generationTimeSec?: number;
}

/**
 * Build the full job list for Phase 1 (elimination round).
 * All 7 models × 1 report type (HomeReady) × 1 geography (Tampa).
 */
export function buildPhase1Jobs(): TestJob[] {
  const reportType = TEST_REPORT_TYPES[0]; // HomeReady
  const geo = TEST_GEOGRAPHIES[0]; // Tampa

  return TEST_MODELS.map((model) => ({
    testRunId: `p1-${model.id}-${geo.id}`,
    model,
    reportType,
    geography: geo,
    request: reportType.buildRequest(geo),
    status: "pending" as const,
  }));
}

/**
 * Build the full job list for Phase 2 (deep comparison).
 * Selected models × all 4 report types × all 3 geographies.
 */
export function buildPhase2Jobs(selectedModelIds: string[]): TestJob[] {
  const models = TEST_MODELS.filter((m) => selectedModelIds.includes(m.id));
  const jobs: TestJob[] = [];

  for (const model of models) {
    for (const reportType of TEST_REPORT_TYPES) {
      for (const geo of TEST_GEOGRAPHIES) {
        jobs.push({
          testRunId: `p2-${model.id}-${reportType.id}-${geo.id}`,
          model,
          reportType,
          geography: geo,
          request: reportType.buildRequest(geo),
          status: "pending",
        });
      }
    }
  }

  return jobs;
}
