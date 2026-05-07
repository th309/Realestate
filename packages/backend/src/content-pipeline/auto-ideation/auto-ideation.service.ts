import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { TriggerRuleEvaluatorService } from './trigger-rule-evaluator.service';
import type { AutoIdeationRule, TriggerMatch, TriggerType } from './trigger-rule.types';
import { ContentRunsService } from '../content-runs.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AutoIdeationService {
  private readonly logger = new Logger(AutoIdeationService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly evaluator: TriggerRuleEvaluatorService,
    private readonly runs: ContentRunsService,
  ) {}

  async runEnabledRules(typeFilter?: TriggerType): Promise<void> {
    const client = this.supabase.getClient();
    let q = client.from('auto_ideation_rules').select('*').eq('enabled', true);
    if (typeFilter) q = q.eq('trigger_type', typeFilter);
    const { data: rules, error } = await q;
    if (error) throw error;

    for (const rule of (rules ?? []) as any[]) {
      try {
        await this.evaluateAndEnqueue(rule as AutoIdeationRule);
        await client
          .from('auto_ideation_rules')
          .update({ last_fired_at: new Date().toISOString() })
          .eq('id', rule.id);
      } catch (err) {
        this.logger.error(
          `rule ${String(rule?.rule_name ?? rule?.id)} failed: ${(err as Error).message}`,
        );
      }
    }
  }

  async previewUpcoming(): Promise<
    Array<{ rule_name: string; format: string; matches: TriggerMatch[] }>
  > {
    const client = this.supabase.getClient();
    const { data: rules, error } = await client
      .from('auto_ideation_rules')
      .select('*')
      .eq('enabled', true);
    if (error) throw error;

    const results: Array<{
      rule_name: string;
      format: string;
      matches: TriggerMatch[];
    }> = [];
    for (const rule of (rules ?? []) as any[]) {
      const matches = await this.evaluator.evaluate(rule as AutoIdeationRule);
      results.push({
        rule_name: String(rule.rule_name),
        format: String(rule.target_format),
        matches,
      });
    }
    return results;
  }

  async evaluateAndEnqueue(rule: AutoIdeationRule): Promise<void> {
    const matches = await this.evaluator.evaluate(rule);
    this.logger.log(
      `rule ${rule.rule_name} matched ${matches.length} markets`,
    );

    for (const match of matches) {
      const result = await this.runs.createRun({
        format: rule.target_format as any,
        marketQuery: match.geo.canonical_name,
        idempotencyKey: randomUUID(),
        approvalMode: (rule.approval_mode_override ?? 'review') as any,
        triggeredBy: 'auto_ideation',
        autoIdeationRuleId: rule.id,
        autoIdeationRuleName: rule.rule_name,
      } as any);

      if (result.status === 'capped') {
        this.logger.warn(
          `rule ${rule.rule_name} capped for ${match.geo.canonical_name}`,
        );
        break;
      }
    }
  }
}

