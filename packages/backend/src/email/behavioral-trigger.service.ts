import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisLockService } from '../redis/redis-lock.service';
import { EngagementTriggerService } from './engagement-trigger.service';
import { InactiveUserTriggerService } from './inactive-user-trigger.service';
import { TrialLifecycleTriggerService } from './trial-lifecycle-trigger.service';

/** Hourly cron entrypoint that fans out to each behavioral email trigger. */
@Injectable()
export class BehavioralTriggerService {
  private readonly logger = new Logger(BehavioralTriggerService.name);

  constructor(
    private readonly lockService: RedisLockService,
    private readonly engagementTriggers: EngagementTriggerService,
    private readonly inactiveUserTriggers: InactiveUserTriggerService,
    private readonly trialLifecycleTriggers: TrialLifecycleTriggerService,
  ) {}

  @Cron('0 * * * *') // Every hour
  async processTriggersHourly() {
    const locked = await this.lockService.acquireLock(
      'cron:behavioral-triggers',
      300,
    );
    if (!locked) {
      this.logger.log(
        'Another instance is processing behavioral triggers, skipping',
      );
      return;
    }
    try {
      this.logger.log('Starting behavioral trigger processing...');
      await this.engagementTriggers.processAll();
      await this.inactiveUserTriggers.fireInactive24h();
      await this.trialLifecycleTriggers.fireTrialDay10();
      await this.trialLifecycleTriggers.fireTrialDay13();
      await this.trialLifecycleTriggers.fireTrialExpired();
      this.logger.log('Behavioral trigger processing complete.');
    } finally {
      await this.lockService.releaseLock('cron:behavioral-triggers');
    }
  }
}
