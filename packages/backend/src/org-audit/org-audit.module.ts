import { Module } from '@nestjs/common';
import { OrgAuditService } from './org-audit.service';
import { OrgAuditController } from './org-audit.controller';

@Module({
  controllers: [OrgAuditController],
  providers: [OrgAuditService],
  exports: [OrgAuditService],
})
export class OrgAuditModule {}
