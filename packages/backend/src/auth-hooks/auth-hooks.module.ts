import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from '../email/email.module';
import { AuthHooksController } from './auth-hooks.controller';
import { AuthHooksService } from './auth-hooks.service';
import { OnUserCreatedController } from './on-user-created.controller';
import { AttributionService } from '../content-pipeline/short-links/attribution.service';

@Module({
  imports: [EmailModule, ConfigModule],
  controllers: [AuthHooksController, OnUserCreatedController],
  providers: [AuthHooksService, AttributionService],
})
export class AuthHooksModule {}
