/**
 * Organization API Keys Module
 *
 * Provides:
 * - API key CRUD (admin) via OrgApiKeysController
 * - ApiKeyAuthGuard for authenticating Platform API requests
 * - ApiKeyValidatorService for key validation and scope checking
 * - OrgApiKeysService for key lifecycle management
 */

import { Module } from '@nestjs/common';
import { OrgAuditModule } from '../org-audit/org-audit.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { OrgApiKeysService } from './org-api-keys.service';
import { ApiKeyValidatorService } from './api-key-validator.service';
import { OrgApiKeysController } from './org-api-keys.controller';
import { ApiKeyAuthGuard } from './api-key-auth.guard';

@Module({
  imports: [OrgAuditModule, OrganizationsModule],
  controllers: [OrgApiKeysController],
  providers: [OrgApiKeysService, ApiKeyValidatorService, ApiKeyAuthGuard],
  exports: [OrgApiKeysService, ApiKeyValidatorService, ApiKeyAuthGuard],
})
export class OrgApiKeysModule {}
