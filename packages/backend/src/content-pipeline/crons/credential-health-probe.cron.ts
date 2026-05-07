import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PlatformPublisherRegistry } from '../drivers/platform-publisher.registry';
import { AlertDispatcherService } from '../observability/alert-dispatcher.service';

@Injectable()
export class CredentialHealthProbeCron {
  constructor(
    private readonly publishers: PlatformPublisherRegistry,
    private readonly alerts: AlertDispatcherService,
  ) {}

  @Cron('0 */6 * * *')
  async run(): Promise<void> {
    for (const pub of this.publishers.listAll()) {
      const configured = await pub.isConfigured();
      if (!configured) continue;

      try {
        if (pub.refreshCredentials) {
          await pub.refreshCredentials();
        }
      } catch (err) {
        await this.alerts.sendAlert(
          'error',
          'credential_rotten',
          `Credentials for ${pub.platform} failed refresh: ${(err as Error).message}`,
          { platform: pub.platform },
        );
      }
    }
  }
}

