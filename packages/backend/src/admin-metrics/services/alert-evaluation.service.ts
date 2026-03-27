/**
 * AlertEvaluationService
 *
 * Cron orchestrator that fires every 5 minutes. Delegates all threshold
 * evaluation logic to AlertThresholdRulesService and all DB persistence
 * to AlertPersistenceService.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertThresholdRulesService } from './alert-threshold-rules.service';

@Injectable()
export class AlertEvaluationService {
  private readonly logger = new Logger(AlertEvaluationService.name);

  constructor(private readonly thresholdRules: AlertThresholdRulesService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async evaluateThresholds(): Promise<void> {
    try {
      await Promise.all([
        this.thresholdRules.evaluateDataSourceStaleness(),
        this.thresholdRules.evaluateHighApiErrorRate(),
        this.thresholdRules.evaluateCacheLowHitRate(),
        this.thresholdRules.evaluateDataSourceUnavailability(),
      ]);
    } catch (err) {
      this.logger.error(
        '[AlertEvaluation] Unexpected error during threshold evaluation',
        err,
      );
    }
  }
}
