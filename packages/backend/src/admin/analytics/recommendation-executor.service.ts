/**
 * Recommendation Executor Service
 *
 * Sends individual recommendations to Claude for implementation planning,
 * then executes DB changes (feature flag toggles, pricing updates) or
 * generates code for code-level changes.
 *
 * Flow:
 *   1. generatePlan() — AI classifies and builds an ImplementationPlan
 *   2. executePlan() — For db_change plans, calls FeaturesService
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProviderService } from './ai-provider.service';
import { FeaturesService } from '../features/features.service';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  ImplementationPlan,
  SavedRecommendation,
  DbChangeOperation,
} from './ai-insights-persistence.types';

/** Key sections from CLAUDE.md embedded for AI context. */
const PROJECT_CONVENTIONS = `
PROJECT: PropertyIQ — Real estate analytics platform.
STACK: Next.js 16 (App Router) + NestJS 11 + Supabase (PostgreSQL) + Redis + Mapbox.
FRONTEND PATTERNS:
  - All data fetching via @/lib/data (fetchSnapshotData, fetchTimeSeriesData, hooks)
  - M3 design system: rounded-xl cards, bg-surface-container, text-on-surface
  - Tailwind CSS 4.0, Roboto font, Material Symbols icons
BACKEND PATTERNS:
  - NestJS modules with DI (Controllers → Services → Supabase)
  - Admin routes under api/admin/* with AdminGuard
  - Feature flags via tier_features table (FeaturesService.updateTierFeature)
FILE SIZE LIMITS:
  - Logic files: under 200 lines (hard limit 300)
  - React components: under 300 lines (hard limit 400)
NAMING: Descriptive, self-explanatory names everywhere.
SECURITY: RLS in Supabase, validate all inputs, no hardcoded secrets.
`;

const PLAN_SYSTEM_PROMPT = `You are a technical implementation assistant for PropertyIQ.
You analyze marketing recommendations and produce structured execution plans.

${PROJECT_CONVENTIONS}

CRITICAL RULES:
- For DB changes (feature flags, pricing): Output exact tier_slug + feature_slug + new value
- For code changes: Generate complete, working code following project conventions
- For manual steps: Give numbered, actionable steps with effort estimates
- ALWAYS output valid JSON matching the schema below
- Do NOT include markdown, code fences, or explanation outside the JSON

OUTPUT SCHEMA (respond with ONLY this JSON):
{
  "action_type": "db_change" | "code_change" | "manual",
  "summary": "Brief description of what will happen",
  "risk_level": "low" | "medium" | "high",
  "db_operations": [{ "entity": "tier_features", "field": "value", "current_value": ..., "new_value": ..., "tier_slug": "...", "feature_slug": "..." }],
  "code_files": [{ "file_path": "...", "description": "...", "code": "...", "language": "typescript" }],
  "manual_steps": [{ "step_number": 1, "description": "...", "effort_estimate": "~2 hours" }]
}

Include only the relevant array for the action_type (db_operations for db_change, etc).`;

@Injectable()
export class RecommendationExecutorService {
  private readonly logger = new Logger(RecommendationExecutorService.name);

  constructor(
    private readonly aiProvider: AiProviderService,
    private readonly features: FeaturesService,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Stream an AI-generated implementation plan for a recommendation.
   * Yields text chunks (JSON being built) so the frontend can show progress.
   */
  async *generatePlanStream(
    recommendation: SavedRecommendation,
    insightContext?: string,
  ): AsyncGenerator<string> {
    const userPrompt = this.buildPlanPrompt(recommendation, insightContext);

    const stream = this.aiProvider.streamCompletion(
      PLAN_SYSTEM_PROMPT,
      [{ role: 'user', content: userPrompt }],
      'claude',
    );

    for await (const chunk of stream) {
      yield chunk;
    }
  }

  /**
   * Generate a complete implementation plan (non-streaming).
   */
  async generatePlan(
    recommendation: SavedRecommendation,
    insightContext?: string,
  ): Promise<ImplementationPlan> {
    let fullResponse = '';
    for await (const chunk of this.generatePlanStream(
      recommendation,
      insightContext,
    )) {
      fullResponse += chunk;
    }

    return this.parsePlanResponse(fullResponse);
  }

  /**
   * Execute a DB change plan by calling FeaturesService.
   * Returns a summary of executed operations.
   */
  async executePlan(
    plan: ImplementationPlan,
  ): Promise<{ success: boolean; executed: string[]; errors: string[] }> {
    if (plan.action_type !== 'db_change' || !plan.db_operations?.length) {
      return {
        success: false,
        executed: [],
        errors: ['Only db_change plans can be auto-executed'],
      };
    }

    const executed: string[] = [];
    const errors: string[] = [];

    for (const op of plan.db_operations) {
      try {
        await this.executeDbOperation(op);
        executed.push(
          `${op.tier_slug || op.entity}.${op.feature_slug || op.field}: ${JSON.stringify(op.current_value)} → ${JSON.stringify(op.new_value)}`,
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Unknown execution error';
        errors.push(`Failed: ${op.entity}.${op.field} — ${msg}`);
        this.logger.error(`DB operation failed: ${msg}`, err);
      }
    }

    return { success: errors.length === 0, executed, errors };
  }

  // --- Private helpers ---

  private buildPlanPrompt(
    rec: SavedRecommendation,
    insightContext?: string,
  ): string {
    return `Analyze this marketing recommendation and generate an implementation plan.

RECOMMENDATION:
- Category: ${rec.category}
- Priority: ${rec.priority}
- Title: ${rec.title}
- Classified Action Type: ${rec.action_type}
- Content:
${rec.content}

${insightContext ? `ADDITIONAL CONTEXT FROM INSIGHT REPORT:\n${insightContext}\n` : ''}

Based on the action type "${rec.action_type}", generate the appropriate plan:
- If db_change: identify exact tier_slug, feature_slug, and values to change
- If code_change: generate complete code files following PropertyIQ conventions
- If manual: provide detailed numbered steps with effort estimates

Respond with ONLY the JSON plan object.`;
  }

  private parsePlanResponse(response: string): ImplementationPlan {
    // Strip any markdown code fences the AI might add despite instructions
    const cleaned = response
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      return {
        action_type: parsed.action_type || 'manual',
        summary: parsed.summary || 'No summary provided',
        risk_level: parsed.risk_level || 'medium',
        db_operations: parsed.db_operations,
        code_files: parsed.code_files,
        manual_steps: parsed.manual_steps,
      };
    } catch (err) {
      this.logger.error('Failed to parse AI plan response', err);
      return {
        action_type: 'manual',
        summary: 'AI response could not be parsed into a structured plan.',
        risk_level: 'medium',
        manual_steps: [
          {
            step_number: 1,
            description: `Review AI output manually:\n\n${response.slice(0, 500)}`,
            effort_estimate: 'Varies',
          },
        ],
      };
    }
  }

  private async executeDbOperation(op: DbChangeOperation): Promise<void> {
    if (op.tier_slug && op.feature_slug) {
      // Use FeaturesService for tier_features changes
      await this.features.updateTierFeature(
        op.tier_slug,
        op.feature_slug,
        op.new_value,
      );
      this.logger.log(
        `Executed: ${op.tier_slug}/${op.feature_slug} = ${JSON.stringify(op.new_value)}`,
      );
    } else {
      // Generic DB update — for safety, only allow known entities
      throw new Error(
        `Unsupported DB operation entity: ${op.entity}. Only tier_features changes are auto-executed.`,
      );
    }
  }
}
