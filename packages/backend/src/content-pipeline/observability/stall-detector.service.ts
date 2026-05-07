import { Injectable } from '@nestjs/common';
import { AlertDispatcherService } from './alert-dispatcher.service';

@Injectable()
export class StallDetectorService {
  constructor(private readonly alerts: AlertDispatcherService) {}

  async reportStall(
    runId: string,
    status: string,
    ageMinutes: number,
  ): Promise<void> {
    if (ageMinutes >= 60) {
      await this.alerts.sendAlert(
        'error',
        'run_stalled_severe',
        `Run ${runId} stalled 60+ minutes in ${status}.`,
        { runId, status, ageMinutes },
      );
      return;
    }

    if (ageMinutes >= 30) {
      await this.alerts.sendAlert(
        'warn',
        'run_stalled',
        `Run ${runId} stalled in ${status} for ${ageMinutes.toFixed(0)} minutes.`,
        { runId, status, ageMinutes },
      );
    }
  }
}

