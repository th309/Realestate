import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from '../email/email.module';
import { AuthHooksController } from './auth-hooks.controller';
import { AuthHooksService } from './auth-hooks.service';

@Module({
  imports: [EmailModule, ConfigModule],
  controllers: [AuthHooksController],
  providers: [AuthHooksService],
})
export class AuthHooksModule {}
