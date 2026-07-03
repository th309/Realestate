import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { EntitlementsService } from './entitlements.service';
import { EnterpriseGraceService } from './enterprise-grace.service';
import { OrgBillingService } from '../org-billing/org-billing.service';
import { SupabaseService } from '../supabase/supabase.service';
import { TrackEventDto } from './dto/track-event.dto';

@Controller('api/entitlements')
export class EntitlementsController {
  constructor(
    private readonly service: EntitlementsService,
    private readonly graceService: EnterpriseGraceService,
    private readonly orgBilling: OrgBillingService,
    private readonly supabase: SupabaseService,
  ) {}

  @Get('check')
  async checkAccess(
    @Query('resources') resources: string,
    @Query('tier') tierOverride: string,
    @Headers('x-user-id') userId: string,
  ) {
    // Only allow tierOverride for admin users (dev tools simulation).
    // Without this, anyone can call ?tier=admin and see full access maps.
    let safeTierOverride: string | null = null;
    if (tierOverride && userId) {
      const { data: adminRow } = await this.supabase
        .getClient()
        .from('admin_users')
        .select('role')
        .eq('id', userId)
        .single();
      if (
        adminRow &&
        (adminRow.role === 'admin' || adminRow.role === 'super_admin')
      ) {
        safeTierOverride = tierOverride;
      }
    }

    const resourceList = resources ? resources.split(',') : [];
    return this.service.checkAccess(
      userId || null,
      safeTierOverride,
      resourceList,
    );
  }

  @Post('events')
  async trackEvent(
    @Body() body: TrackEventDto,
    @Headers('x-user-id') userId: string,
    @Headers('x-session-id') sessionId: string,
  ) {
    // Resolve tier server-side from the (claimed) user id — never store a
    // client-supplied x-user-tier, which would let any caller poison the
    // paywall/conversion analytics with an arbitrary tier.
    const resolvedTier = userId
      ? ((await this.service.getUserTier(userId)) ?? 'free')
      : 'free';
    await this.service.trackPaywallEvent({
      userId: userId || undefined,
      sessionId: sessionId || undefined,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      userTier: resolvedTier,
      pagePath: body.pagePath,
      eventType: body.eventType,
      metadata: body.metadata,
    });
    return { success: true };
  }

  /**
   * GET /api/entitlements/grace-status
   *
   * Returns the enterprise billing grace period status for the
   * authenticated user. If billing is already set up, clears the
   * grace period as a side effect.
   */
  @Get('grace-status')
  @UseGuards(JwtAuthGuard)
  async getGraceStatus(@AuthUserId() userId: string) {
    return this.graceService.getGraceStatus(userId);
  }

  /**
   * POST /api/entitlements/setup-billing
   *
   * Creates a Stripe checkout session with a trial period aligned to
   * the user's enterprise grace expiry. Returns { checkout_url }.
   */
  @Post('setup-billing')
  @UseGuards(JwtAuthGuard)
  async setupBilling(@AuthUserId() userId: string) {
    // Fetch the user's email for Stripe customer creation
    const { data: profile } = await this.supabase
      .getClient()
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();

    const email = profile?.email;
    if (!email) {
      throw new NotFoundException('User profile not found');
    }

    const checkoutUrl = await this.orgBilling.createEnterpriseTrialCheckout(
      userId,
      email,
    );

    return { checkout_url: checkoutUrl };
  }
}
