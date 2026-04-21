import { Module, Global } from '@nestjs/common';
import { QueueService } from './queue.service';

/**
 * Global queue module. QueueService is exported so any feature module
 * can inject it without re-importing this module.
 */
@Global()
@Module({ providers: [QueueService], exports: [QueueService] })
export class QueueModule {}
