import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { DigestService } from './digest.service';

@Module({
  imports: [SupabaseModule, ConfigModule],
  controllers: [EmailController],
  providers: [EmailService, DigestService],
  exports: [EmailService],
})
export class EmailModule {}
