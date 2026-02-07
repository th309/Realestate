import { Controller, Get, Post, Query, Body, Headers } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

@Controller('api/entitlements')
export class EntitlementsController {
  constructor(private readonly service: EntitlementsService) {}

  @Get('check')
  async checkAccess(
    @Query('resources') resources: string,
    @Query('tier') tierOverride: string,
    @Headers('x-user-id') userId: string,
  ) {
    const resourceList = resources ? resources.split(',') : [];
    return this.service.checkAccess(userId || null, tierOverride || null, resourceList);
  }

  @Post('events')
  async trackEvent(
    @Body() body: {
      resourceType: string;
      resourceId: string;
      eventType: string;
      pagePath?: string;
      metadata?: Record<string, unknown>;
    },
    @Headers('x-user-id') userId: string,
    @Headers('x-session-id') sessionId: string,
    @Headers('x-user-tier') userTier: string,
  ) {
    await this.service.trackPaywallEvent({
      userId: userId || undefined,
      sessionId: sessionId || undefined,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      userTier: userTier || 'free',
      pagePath: body.pagePath,
      eventType: body.eventType,
      metadata: body.metadata,
    });
    return { success: true };
  }
}
