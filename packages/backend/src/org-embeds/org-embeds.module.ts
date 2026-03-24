/**
 * Organization Embeds Module
 *
 * Provides:
 * - Token CRUD (admin) via OrgEmbedsController
 * - Widget data endpoints (public) via EmbedDataController
 * - EmbedTokenGuard for token authentication
 * - EmbedCorsInterceptor for dynamic CORS
 */

import { Module } from '@nestjs/common';
import { OrgAuditModule } from '../org-audit/org-audit.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ScoringModule } from '../scoring/scoring.module';
import { OrgEmbedsService } from './org-embeds.service';
import { OrgEmbedsController } from './org-embeds.controller';
import { EmbedDataController } from './embed-data.controller';
import { EmbedTokenGuard } from './embed-token.guard';
import { EmbedCorsInterceptor } from './embed-cors.interceptor';

@Module({
  imports: [OrgAuditModule, OrganizationsModule, ScoringModule],
  controllers: [OrgEmbedsController, EmbedDataController],
  providers: [OrgEmbedsService, EmbedTokenGuard, EmbedCorsInterceptor],
  exports: [OrgEmbedsService],
})
export class OrgEmbedsModule {}
