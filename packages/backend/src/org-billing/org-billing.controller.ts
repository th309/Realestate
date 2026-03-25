/**
 * Organization Billing Controller
 *
 * REST endpoints for enterprise org billing management:
 *   POST /api/org/billing/checkout  — Create Stripe checkout (no org context)
 *   POST /api/org/:slug/billing/portal — Stripe billing portal (admin)
 *   PUT  /api/org/:slug/billing/seats  — Update seat count (admin)
 *   GET  /api/org/:slug/billing/usage  — Current usage stats (admin)
 */

import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { OrgContextGuard } from '../organizations/guards/org-context.guard';
import { OrgAdminGuard } from '../organizations/guards/org-admin.guard';
import { OrgBillingService } from './org-billing.service';
import { OrgBillingUsageService } from './org-billing-usage.service';
import { OrgCheckoutDto } from './dto/org-checkout.dto';
import { UpdateSeatsDto } from './dto/update-seats.dto';

@Controller('api/org')
export class OrgBillingController {
  constructor(
    private readonly orgBilling: OrgBillingService,
    private readonly orgBillingUsage: OrgBillingUsageService,
  ) {}

  /**
   * Create a checkout session for a new enterprise org.
   * No OrgContextGuard — the org may not exist yet.
   */
  @Post('billing/checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckout(
    @Body() dto: OrgCheckoutDto,
    @AuthUserId() userId: string,
  ) {
    const checkoutUrl = await this.orgBilling.createCheckoutSession(
      dto.orgName,
      dto.orgSlug,
      dto.ownerEmail,
      userId,
    );
    return { checkout_url: checkoutUrl };
  }

  /** Open Stripe billing portal for org payment management. */
  @Post(':slug/billing/portal')
  @UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)
  async billingPortal(@Req() req: any) {
    const portalUrl = await this.orgBilling.createBillingPortalSession(
      req.org.id,
    );
    return { portal_url: portalUrl };
  }

  /** Update the number of additional seats for the org. */
  @Put(':slug/billing/seats')
  @UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)
  async updateSeats(
    @Req() req: any,
    @Body() dto: UpdateSeatsDto,
    @AuthUserId() userId: string,
  ) {
    await this.orgBilling.updateSeats(req.org.id, dto.additionalSeats, userId);
    return { success: true };
  }

  /** Get current billing usage: seats, members, invoice preview. */
  @Get(':slug/billing/usage')
  @UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)
  async getUsage(@Req() req: any) {
    return this.orgBillingUsage.getUsage(req.org.id);
  }
}
